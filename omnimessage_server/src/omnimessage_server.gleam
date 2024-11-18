/// omnimessage_server is the collection of tools allowing you to handle
/// connections from omnimessage_lustre applications.
///
/// The rule of thumb is if it initiates the connection, it's a client. If it
/// responds to a connection request, it's a server. 
///
/// While you could do this manually fairly simples, theese tools can help you
/// get started quicker and provide a nicer quality-of-life.
///
/// Do read the source of the functions to understand how to make your own
/// customized solution.
///
/// Currently only the erlang target is supported, but you could easily adapt
/// the principles to the Node, Deno, or Bun targets. Or even to a runtime
/// outside Gleam's ecosystem -- as long as you can send and receive encoded
/// messages, you can communicate with omnimessage_lustre.
///
import gleam/dict.{type Dict}
import gleam/dynamic.{type Decoder}
import gleam/erlang/process.{type Subject}
import gleam/function
import gleam/http
import gleam/http/request
import gleam/option.{type Option, None, Some}
import gleam/otp/actor
import gleam/result

import lustre
import lustre/effect.{type Effect}
import lustre/element.{type Element}
import mist
import wisp

import omnimessage_server/internal/lustre/runtime.{type Action}

/// Holds decode and encode functions for omnimessage messages. Decode errors
/// will be called back for you to handle, while Encode errors are interpreted
/// as "skip this message" -- no error will be raised for them and they won't
/// be sent over.
///
/// Since an `EncoderDecoder` is expected to receive the whole message type of
/// an application, but usually will ignore messages that aren't shared, it's
/// best to define it as a thin wrapper around shared encoders/decoders:
///
/// ```gleam
/// // Holds shared message types, encoders and decoders
/// import shared
///
/// let encoder_decoder =
///   EncoderDecoder(
///     fn(msg) {
///       case msg {
///         // Messages must be encodable
///         ClientMessage(message) -> Ok(shared.encode_client_message(message))
///         // Return Error(Nil) for messages you don't want to send out
///         _ -> Error(Nil)
///       }
///     },
///     fn(encoded_msg) {
///       // Unsupported messages will cause TransportError(DecodeError(error))
///       shared.decode_server_message(encoded_msg)
///       |> result.map(ServerMessage)
///     },
///   )
/// ```
///
pub type EncoderDecoder(msg, encoding, decode_error) {
  EncoderDecoder(
    encode: fn(msg) -> Result(encoding, Nil),
    decode: fn(encoding) -> Result(msg, decode_error),
  )
}

/// A utility function for easily handling messages:
///
/// ```gleam
/// let out_msg = pipe(in_msg, encoder_decoder, handler)
/// ```
///
pub fn pipe(
  msg: encoding,
  encoder_decoder: EncoderDecoder(msg, encoding, decode_error),
  handler: fn(msg) -> msg,
) -> Result(Option(encoding), decode_error) {
  msg
  |> encoder_decoder.decode
  |> result.map(handler)
  |> result.map(encoder_decoder.encode)
  // Encoding error means "skip this message"
  |> result.map(option.from_result)
}

///
pub opaque type App(flags, model, msg) {
  App(
    init: fn(flags) -> #(model, Effect(msg)),
    update: fn(model, msg) -> #(model, Effect(msg)),
    view: fn(model) -> Element(msg),
    // The `dict.mjs` module in the standard library is huge (20+kb!). For folks
    // that don't ever build components and don't use a dictionary in any of their
    // code we'd rather not thrust that increase in bundle size on them just to
    // call `dict.new()`.
    //
    // Using `Option` here at least lets us say `None` for the empty case in the
    // `application` constructor.
    //
    on_attribute_change: Option(Dict(String, Decoder(msg))),
  )
}

///
pub opaque type ComposedApp(flags, model, msg, encoding, decode_error) {
  ComposedApp(
    app: App(flags, model, msg),
    encoder_decoder: EncoderDecoder(msg, encoding, decode_error),
  )
}

/// This creates a version of a Lustre application that can be used in
/// `omnimessage_server.start_actor` (see below). A view is not necessary, as
/// this application will never render anything.
///
pub fn application(init, update, encoder_decoder) {
  let view = fn(_) { element.none() }
  ComposedApp(app: App(init, update, view, option.None), encoder_decoder:)
}

/// This is a beefed up version of `lustre.start_actor` that allows subscribing
/// to messages dispatched inside the runtime.
///
/// This is what enables using a Lustre server component for communication,
/// powering `mist_websocket_application()` below.
///
pub fn start_actor(
  // TODO: should this be `ComposedApp`?
  app: ComposedApp(flags, model, msg, encoding, decode_error),
  with flags: flags,
) -> Result(Subject(Action(msg, lustre.ServerComponent)), lustre.Error) {
  do_start_actor(app.app, flags)
}

fn do_start_actor(
  app: App(flags, model, msg),
  flags: flags,
) -> Result(Subject(Action(msg, lustre.ServerComponent)), lustre.Error) {
  let on_attribute_change = option.unwrap(app.on_attribute_change, dict.new())

  app.init(flags)
  |> runtime.start(app.update, app.view, on_attribute_change)
  |> result.map_error(lustre.ActorError)
}

/// This action subscribes to updates in a running application.
///
pub fn subscribe(id: String, dispatch: fn(msg) -> Nil) {
  runtime.UpdateSubscribe(id, dispatch)
}

/// Dispatch a message to a running application's `update` function.
///
pub fn dispatch(message: msg) {
  runtime.Dispatch(message)
}

/// Instruct a running application to shut down.
///
pub fn shutdown() {
  runtime.Shutdown
}

/// A wisp middleware to automatically handle HTTP POST omnimessage messages.
///
///   - `req`              The wisp request
///   - `path`             The path to which messages are POSTed
///   - `encoder_decoder`  For encoding and decoding messages
///   - `handler`          For handling the incoming messages
///
/// See a full example using this in the Readme or in the examples folder.
///
pub fn wisp_http_middleware(
  req: wisp.Request,
  path: String,
  encoder_decoder,
  handler,
  fun: fn() -> wisp.Response,
) -> wisp.Response {
  case req.path == path, req.method {
    True, http.Post -> {
      use req_body <- wisp.require_string_body(req)

      case
        req_body
        |> pipe(encoder_decoder, handler)
      {
        Ok(Some(res_body)) -> wisp.response(200) |> wisp.string_body(res_body)
        Ok(None) -> wisp.response(200)
        Error(_) -> wisp.unprocessable_entity()
      }
    }
    _, _ -> fun()
  }
}

/// A mist websocket handler to automatically responsd to omnimessage messages.
///
/// Return this as a response to the websocket init request.
///
///   - `req`              The mist request
///   - `encoder_decoder`  For encoding and decoding messages
///   - `handler`          For handling the incoming messages
///   - `on_error`         For handling decode errors
///
/// See a full example using this in the Readme or in the examples folder.
///
pub fn mist_websocket_pipe(
  req: request.Request(mist.Connection),
  encoder_decoder: EncoderDecoder(msg, String, decode_error),
  handler: fn(msg) -> msg,
  on_error: fn(decode_error) -> Nil,
) {
  mist.websocket(
    request: req,
    on_init: fn(_conn) { #(None, None) },
    handler: fn(runtime, conn, msg) {
      case msg {
        mist.Text(msg) -> {
          let _ = case pipe(msg, encoder_decoder, handler) {
            Ok(Some(encoded_msg)) -> mist.send_text_frame(conn, encoded_msg)
            Ok(None) -> Ok(Nil)
            Error(decode_error) -> Ok(on_error(decode_error))
          }
          actor.continue(runtime)
        }

        mist.Binary(_) -> actor.continue(runtime)

        mist.Custom(_) -> actor.continue(runtime)

        mist.Closed | mist.Shutdown -> actor.Stop(process.Normal)
      }
    },
    on_close: fn(_) { Nil },
  )
}

/// A mist websocket handler to automatically responsd to omnimessage messages
/// via a Lustre server component. The server component can then be used
/// similarly to one created by an `omnimessage_lustre` and handle the messages
/// via update, dispatch, and effects.
///
/// Return this as a response to the websocket init request.
///
///   - `req`       The mist request
///   - `app`       An application created with `omnimessage_server.application`
///   - `flags`     Flags to hand to the application's `init`
///   - `on_error`  For handling decode errors
///
/// See a full example using this in the Readme or in the examples folder.
///
pub fn mist_websocket_application(
  req: request.Request(mist.Connection),
  app: ComposedApp(flags, model, msg, String, decode_error),
  flags: flags,
  on_error: fn(decode_error) -> Nil,
) {
  mist.websocket(
    request: req,
    on_init: fn(_conn) {
      let self = process.new_subject()
      let assert Ok(runtime) = start_actor(app, flags)

      process.send(
        runtime,
        subscribe("OMNIMESSAGE_AUTO_MIST", process.send(self, _)),
      )

      #(
        runtime,
        option.Some(
          process.new_selector()
          |> process.selecting(self, function.identity),
        ),
      )
    },
    handler: fn(runtime, conn, msg) {
      case msg {
        mist.Text(msg) -> {
          case app.encoder_decoder.decode(msg) {
            Ok(decoded_msg) -> process.send(runtime, dispatch(decoded_msg))
            Error(decode_error) -> on_error(decode_error)
          }
          actor.continue(runtime)
        }
        mist.Binary(_) -> actor.continue(runtime)
        mist.Custom(msg) -> {
          // TODO: do we really want to crash this?
          let assert Ok(_) = case app.encoder_decoder.encode(msg) {
            Ok(msg) -> mist.send_text_frame(conn, msg)
            // Encode error is interpreted as "skip this message"
            Error(_) -> Ok(Nil)
          }

          actor.continue(runtime)
        }
        mist.Closed | mist.Shutdown -> actor.Stop(process.Normal)
      }
    },
    on_close: fn(runtime) { process.send(runtime, shutdown()) },
  )
}
