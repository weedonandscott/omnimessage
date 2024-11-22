import gleam/dict
import gleam/result
import lustre/effect
import omnimessage_server as omniserver
import shared.{type ClientMessage, type ServerMessage}

import server/context.{type Context}

pub fn app() {
  let encoder_decoder =
    omniserver.EncoderDecoder(
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

  // An omnimessage_server app has no view
  omniserver.application(init, update, encoder_decoder)
}

// MODEL -----------------------------------------------------------------------

fn get_messages(ctx: Context) {
  ctx
  |> context.get_chat_messages()
}

pub type Model {
  Model(messages: dict.Dict(String, shared.ChatMessage), ctx: Context)
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
    ClientMessage(shared.UserSendChatMessage(chat_msg)) -> #(
      model,
      effect.from(fn(dispatch) {
        shared.ChatMessage(..chat_msg, status: shared.Sent)
        |> context.add_chat_message(model.ctx, _)

        get_messages(model.ctx)
        |> shared.ServerUpsertChatMessages
        |> ServerMessage
        |> dispatch
      }),
    )
    ClientMessage(shared.UserDeleteChatMessage(message_id)) -> #(
      model,
      effect.from(fn(dispatch) {
        model.ctx |> context.delete_chat_message(message_id)

        get_messages(model.ctx)
        |> shared.ServerUpsertChatMessages
        |> ServerMessage
        |> dispatch
      }),
    )
    ClientMessage(shared.FetchChatMessages) -> #(
      model,
      effect.from(fn(dispatch) {
        get_messages(model.ctx)
        |> shared.ServerUpsertChatMessages
        |> ServerMessage
        |> dispatch
      }),
    )
    ServerMessage(shared.ServerUpsertChatMessages(messages)) -> #(
      Model(..model, messages:),
      effect.none(),
    )
  }
}
