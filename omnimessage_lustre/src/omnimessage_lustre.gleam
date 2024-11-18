/// omnimessage_lustre is the collection of tools for creating Lustre
/// applications that are able to automatically send messages to a server.
///
/// This allows you to seamlessly talk to a remote using normal Lustre
/// messages, and handle replies as such.
///
/// While most commonly this happens in a browser, omnimessage_lustre can run on
/// erlang servers as well. The rule of thumb is if it initiates the connection,
/// it's a client. If it responds to a connection request, it's a server. 
///
import lustre
import lustre/effect

import omnimessage_lustre/transports.{type TransportState}

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

/// Creates an omnimessage_lustre application. The extra parameters are:
///   - `encoder_decoder`    encodes and decodes messages
///   - `transport`          will transfer and recieve encoded messages. see
///                          `omnimessage_lustre/transports` for available ones
///   - `transport_wrapper`  a wrapper for your `Msg` type for transport status
///
pub fn application(
  init,
  update,
  view,
  encoder_decoder,
  transport,
  transport_wrapper,
) {
  let #(omniinit, omniupdate) =
    compose(init, update, transport, encoder_decoder, transport_wrapper)

  lustre.application(omniinit, omniupdate, view)
}

/// Creates an omnimessage_lustre Lustre component. The extra parameters are:
///   - `encoder_decoder`    encodes and decodes messages
///   - `transport`          will transfer and recieve encoded messages. see
///                          `omnimessage_lustre/transports` for available ones
///   - `transport_wrapper`  a wrapper for your `Msg` type for transport status
///
pub fn component(
  init,
  update,
  view,
  on_attribute_change,
  encoder_decoder,
  transport,
  transport_wrapper,
) {
  let #(omniinit, omniupdate) =
    compose(init, update, transport, encoder_decoder, transport_wrapper)

  lustre.component(omniinit, omniupdate, view, on_attribute_change)
}

fn compose(init, update, transport, encoder_decoder, meta_wrapper) {
  let coded_transport = transport |> to_coded_transport(encoder_decoder)

  let omniinit = fn(flags) {
    let transport_effect =
      fn(dispatch) {
        coded_transport.listen(dispatch, fn(state) {
          dispatch(meta_wrapper(state))
        })

        Nil
      }
      |> effect.from

    let #(model, effect) = init(flags)

    #(model, effect.batch([effect, transport_effect]))
  }

  let omniupdate = fn(model: model, msg: msg) {
    let #(updated_model, effect) = update(model, msg)

    #(
      updated_model,
      effect.batch([
        fn(dispatch) {
          coded_transport.send(msg, dispatch, fn(state) {
            dispatch(meta_wrapper(state))
          })
        }
          |> effect.from,
        effect,
      ]),
    )
  }

  #(omniinit, omniupdate)
}

type CodedTransport(msg, decode_error) {
  CodedTransport(
    listen: fn(fn(msg) -> Nil, fn(TransportState(decode_error)) -> Nil) -> Nil,
    send: fn(msg, fn(msg) -> Nil, fn(TransportState(decode_error)) -> Nil) ->
      Nil,
  )
}

fn new_handlers(
  on_message,
  on_state,
  encoder_decoder: EncoderDecoder(msg, encoding, decode_error),
) {
  transports.TransportHandlers(
    on_up: fn() { on_state(transports.TransportUp) },
    on_down: fn(code, reason) {
      on_state(transports.TransportDown(code, reason))
    },
    on_message: fn(encoded_msg) {
      case
        encoded_msg
        |> encoder_decoder.decode
      {
        Ok(msg) -> on_message(msg)
        Error(decode_error) ->
          on_state(
            transports.TransportError(transports.DecodeError(decode_error)),
          )
      }
    },
    on_error: fn(error) { on_state(transports.TransportError(error)) },
  )
}

fn to_coded_transport(
  base: transports.Transport(encoding, decode_error),
  encoder_decoder: EncoderDecoder(msg, encoding, decode_error),
) -> CodedTransport(msg, decode_error) {
  CodedTransport(
    listen: fn(on_message, on_state) {
      base.listen(new_handlers(on_message, on_state, encoder_decoder))
    },
    send: fn(msg, on_message, on_state) {
      case encoder_decoder.encode(msg) {
        Ok(msg) ->
          base.send(msg, new_handlers(on_message, on_state, encoder_decoder))
        // An encoding error means "skip this message"
        Error(_) -> Nil
      }
    },
  )
}
