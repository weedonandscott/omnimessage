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

import lustre_omnistate.{type EncoderDecoder}
import lustre_omnistate/internal/lustre/runtime.{type Action}

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

pub opaque type ComposedApp(flags, model, msg, encoding, decode_error) {
  ComposedApp(
    app: App(flags, model, msg),
    encoder_decoder: EncoderDecoder(msg, encoding, decode_error),
  )
}

pub fn application(init, update, encoder_decoder) {
  let view = fn(_) { element.none() }
  ComposedApp(app: App(init, update, view, option.None), encoder_decoder:)
}

pub fn start_actor(
  // TODO: should this be `ComposedApp`?
  app: ComposedApp(flags, model, msg, encoding, decode_error),
  with flags: flags,
) -> Result(Subject(Action(msg, lustre.ServerComponent)), lustre.Error) {
  do_start_actor(app.app, flags)
}

@target(javascript)
fn do_start_actor(_, _) {
  Error(lustre.NotErlang)
}

@target(erlang)
fn do_start_actor(
  app: App(flags, model, msg),
  flags: flags,
) -> Result(Subject(Action(msg, lustre.ServerComponent)), lustre.Error) {
  let on_attribute_change = option.unwrap(app.on_attribute_change, dict.new())

  app.init(flags)
  |> runtime.start(app.update, app.view, on_attribute_change)
  |> result.map_error(lustre.ActorError)
}

@target(erlang)
pub fn subscribe(id: String, dispatch: fn(msg) -> Nil) {
  runtime.UpdateSubscribe(id, dispatch)
}

@target(erlang)
pub fn dispatch(message: msg) {
  runtime.Dispatch(message)
}

@target(erlang)
pub fn shutdown() {
  runtime.Shutdown
}

@target(erlang)
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
        |> lustre_omnistate.pipe(encoder_decoder, handler)
      {
        Ok(Some(res_body)) -> wisp.response(200) |> wisp.string_body(res_body)
        Ok(None) -> wisp.response(200)
        Error(_) -> wisp.unprocessable_entity()
      }
    }
    _, _ -> fun()
  }
}

@target(erlang)
pub fn mist_websocket_pipe(
  req: request.Request(mist.Connection),
  encoder_decoder: lustre_omnistate.EncoderDecoder(msg, String, decode_error),
  handler: fn(msg) -> msg,
  on_error: fn(decode_error) -> Nil,
) {
  mist.websocket(
    request: req,
    on_init: fn(_conn) { #(None, None) },
    handler: fn(runtime, conn, msg) {
      case msg {
        mist.Text(msg) -> {
          let _ = case lustre_omnistate.pipe(msg, encoder_decoder, handler) {
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

@target(erlang)
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

      // TODO: initial response

      process.send(
        runtime,
        subscribe("LUSTRE_OMNISTATE_AUTO_MIST", process.send(self, _)),
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
