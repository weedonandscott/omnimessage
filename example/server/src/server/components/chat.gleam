import gleam/dict
import gleam/result
import lustre/effect
import lustre_omnistate
import lustre_omnistate/omniserver
import shared.{type ClientMessage, type ServerMessage}

import server/context.{type Context}

pub fn app() {
  let encoder_decoder =
    lustre_omnistate.EncoderDecoder(
      fn(msg) {
        case msg {
          // Messages must be encodable
          ServerMessage(message) -> Ok(shared.encode_server_message(message))
          // Return Error(Nil) for messages you don't want to send out
          _ -> Error(Nil)
        }
      },
      fn(encoded_msg) {
        // Unsupported messages will cause TransportError(DecodeError(error)) 
        // which you can ignore if you don't care about those messages
        shared.decode_client_message(encoded_msg)
        |> result.map(ClientMessage)
      },
    )

  // An omniserver app has no view
  omniserver.application(init, update, encoder_decoder)
}

// MODEL -----------------------------------------------------------------------

fn get_messages(ctx: Context) {
  ctx
  |> context.get_chat_messages()
}

pub type Model {
  Model(messages: dict.Dict(String, shared.Message), ctx: Context)
}

fn init(ctx: Context) -> #(Model, effect.Effect(Msg)) {
  #(Model(messages: get_messages(ctx), ctx:), effect.none())
}

// UPDATE ----------------------------------------------------------------------

pub type Msg {
  ClientMessage(ClientMessage)
  ServerMessage(ServerMessage)
}

pub fn update(model: Model, msg: Msg) {
  case msg {
    ClientMessage(shared.UserSendMessage(message)) -> #(
      model,
      effect.from(fn(dispatch) {
        model.ctx |> context.add_message(message)

        get_messages(model.ctx)
        |> shared.ServerUpsertMessages
        |> ServerMessage
        |> dispatch
      }),
    )
    ClientMessage(shared.UserDeleteMessage(message_id)) -> #(
      model,
      effect.from(fn(dispatch) {
        model.ctx |> context.delete_message(message_id)

        get_messages(model.ctx)
        |> shared.ServerUpsertMessages
        |> ServerMessage
        |> dispatch
      }),
    )
    ClientMessage(shared.FetchMessages) -> #(
      model,
      effect.from(fn(dispatch) {
        get_messages(model.ctx)
        |> shared.ServerUpsertMessages
        |> ServerMessage
        |> dispatch
      }),
    )
    ServerMessage(shared.ServerUpsertMessages(messages)) -> #(
      Model(..model, messages:),
      effect.none(),
    )
  }
}
