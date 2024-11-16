import lustre
import lustre/effect

import lustre_omnistate
import lustre_omnistate/omniclient/transports.{type TransportState}

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
  encoder_decoder: lustre_omnistate.EncoderDecoder(msg, encoding, decode_error),
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
  encoder_decoder: lustre_omnistate.EncoderDecoder(msg, encoding, decode_error),
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
