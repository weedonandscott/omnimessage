import gleam/result

import lustre/effect

import transports

pub type OmnistateError(decode_error) {
  DecodeErrors(decode_error)
}

pub type OmniMessage(omnistate, decode_error) {
  OmnistateReceived(Result(omnistate, OmnistateError(decode_error)))
  TransportUp
  TransportDown(code: Int, message: String)
  TransportInitError(message: String)
}

pub type EncoderDecoder(
  encoded_omnistate,
  omnistate,
  encoded_msg,
  msg,
  decode_error,
) {
  EncoderDecoder(
    msg_encoder: fn(msg) -> Result(encoded_msg, Nil),
    omnistate_decoder: fn(encoded_omnistate) -> Result(omnistate, decode_error),
  )
}

pub fn setup(
  init,
  update,
  transport,
  wrapper,
  encoder_decoder: EncoderDecoder(
    encoded_omnistate,
    omnistate,
    encoded_msg,
    msg,
    decode_error,
  ),
) {
  #(
    init_builder(init, transport, encoder_decoder.omnistate_decoder, wrapper),
    update_builder(update, transport, encoder_decoder.msg_encoder),
  )
}

fn init_builder(
  init: fn(flags) -> #(model, effect.Effect(msg)),
  transport: transports.Transport(
    encoded_msg,
    encoded_omnistate,
    down_reason,
    transport_error,
  ),
  decoder: fn(encoded_omnistate) -> Result(omnistate, decode_error),
  wrapper: fn(OmniMessage(omnistate, decode_error)) -> msg,
) {
  fn(flags) {
    let transport_effect =
      fn(dispatch) {
        transport.listen(
          transports.TransportHandlers(
            on_up: fn() {
              TransportUp
              |> wrapper
              |> dispatch
            },
            on_down: fn(code, message) {
              TransportDown(code, message)
              |> wrapper
              |> dispatch
            },
            on_message: fn(encoded_omnistate) {
              encoded_omnistate
              |> decoder
              |> result.map_error(fn(errors) { DecodeErrors(errors) })
              |> OmnistateReceived
              |> wrapper
              |> dispatch
            },
            on_init_error: fn(message) {
              message
              |> TransportInitError
              |> wrapper
              |> dispatch
            },
          ),
        )
      }
      |> effect.from

    let #(model, effect) = init(flags)

    #(model, effect.batch([effect, transport_effect]))
  }
}

fn update_builder(
  update: fn(model, msg) -> #(model, effect.Effect(msg)),
  transport: transports.Transport(
    encoded_msg,
    encoded_omnistate,
    down_reason,
    transport_error,
  ),
  encoder: fn(msg) -> Result(encoded_msg, Nil),
) {
  fn(model: model, message: msg) {
    let #(updated_model, effect) = update(model, message)
    let encoded_result = encoder(message)

    #(
      updated_model,
      effect.batch([
        case encoded_result {
          Ok(encoded_msg) ->
            fn(_) {
              // TODO: handle errors
              transport.send(encoded_msg)
              Nil
            }
            |> effect.from
          // TODO
          _ -> effect.none()
        },
        effect,
      ]),
    )
  }
}
