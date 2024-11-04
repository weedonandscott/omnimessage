import gleam/dict
import gleam/json
import gleam/list

import decode/zero

pub type SharedMessage {
  UserSendMessage(Message)
  UserDeleteMessage(MessageId)
}

pub fn encode_shared_message(msg: SharedMessage) {
  case msg {
    UserSendMessage(message) -> [json.int(0), message_to_json(message)]
    UserDeleteMessage(message_id) -> [json.int(1), json.string(message_id)]
  }
  |> json.preprocessed_array
  |> json.to_string
}

pub fn decode_shared_message(str_msg: String) {
  let decoder = {
    use id <- zero.field(0, zero.int)

    case id {
      0 -> {
        use message <- zero.field(1, message_decoder())
        zero.success(UserSendMessage(message))
      }
      1 -> {
        use message_id <- zero.field(1, zero.string)
        zero.success(UserDeleteMessage(message_id))
      }
      _ -> zero.failure(UserDeleteMessage(""), "SharedMessage")
    }
  }

  str_msg
  |> json.decode(zero.run(_, decoder))
}

pub type OmniState {
  OmniState(messages: dict.Dict(String, Message))
}

pub type OmniMessage

pub fn decode_omnistate(omnistring: String) {
  let decoder = {
    use messages <- zero.field("messages", zero.list(message_decoder()))
    let messages =
      messages
      |> list.map(fn(message) { #(message.id, message) })
      |> dict.from_list()
    zero.success(OmniState(messages:))
  }
  omnistring
  |> json.decode(zero.run(_, decoder))
}

pub fn encode_omnistate(omnistate: OmniState) {
  json.object([
    #(
      "messages",
      omnistate.messages
        |> dict.values()
        |> list.map(message_to_json)
        |> json.preprocessed_array,
    ),
  ])
  |> json.to_string
}

pub type Chat {
  Chat(messages: dict.Dict(String, Message))
}

pub type MessageId =
  String

pub type Message {
  Message(
    id: MessageId,
    content: String,
    status: MessageStatus,
    sent_at: String,
  )
}

fn message_to_json(message: Message) {
  json.object([
    #("id", message.id |> json.string),
    #("content", json.string(message.content)),
    #("status", json.string(encode_status(message.status))),
    #("sent_at", json.string(message.sent_at)),
  ])
}

pub fn encode_message(message: Message) {
  message_to_json(message)
  |> json.to_string
}

fn message_decoder() {
  let status_decoder = {
    use decoded_string <- zero.then(zero.string)
    case decoded_string {
      "Client Error" -> zero.success(ClientError)
      "Server Error" -> zero.success(ServerError)
      "Sent" -> zero.success(Sent)
      "Received" -> zero.success(Received)
      "Sending" -> zero.success(Sending)
      "Draft" -> zero.success(Draft)
      _ -> zero.failure(ClientError, "MessageStatus")
    }
  }

  use id <- zero.field("id", zero.string)
  use content <- zero.field("content", zero.string)
  use status <- zero.field("status", status_decoder)
  use sent_at <- zero.field("sent_at", zero.string)

  zero.success(Message(id:, content:, status:, sent_at:))
}

pub fn decode_message(str_message: String) {
  json.decode(str_message, zero.run(_, message_decoder()))
}

pub type MessageStatus {
  ClientError
  ServerError
  Sent
  Received
  Sending
  Draft
}

pub fn encode_status(status: MessageStatus) {
  case status {
    ClientError -> "Client Error"
    ServerError -> "Server Error"
    Sent -> "Sent"
    Received -> "Received"
    Sending -> "Sending"
    Draft -> "Draft"
  }
}
