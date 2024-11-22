import gleam/dict
import gleam/json
import gleam/list
import gleam/string

import birl
import decode/zero
import gluid

pub type ClientMessage {
  UserSendChatMessage(ChatMessage)
  UserDeleteChatMessage(ChatMessageId)
  FetchChatMessages
}

pub fn encode_client_message(msg: ClientMessage) {
  case msg {
    UserSendChatMessage(chat_msg) -> [
      json.int(0),
      chat_message_to_json(chat_msg),
    ]
    UserDeleteChatMessage(chat_msg_id) -> [
      json.int(1),
      json.string(chat_msg_id),
    ]
    FetchChatMessages -> [json.int(2), json.null()]
  }
  |> json.preprocessed_array
  |> json.to_string
}

pub fn decode_client_message(str_msg: String) {
  let decoder = {
    use id <- zero.field(0, zero.int)

    case id {
      0 -> {
        use chat_msg <- zero.field(1, chat_message_decoder())
        zero.success(UserSendChatMessage(chat_msg))
      }
      1 -> {
        use message_id <- zero.field(1, zero.string)
        zero.success(UserDeleteChatMessage(message_id))
      }
      2 -> {
        zero.success(FetchChatMessages)
      }
      _ -> zero.failure(FetchChatMessages, "SharedMessage")
    }
  }

  str_msg
  |> json.decode(zero.run(_, decoder))
}

pub type ServerMessage {
  ServerUpsertChatMessages(dict.Dict(String, ChatMessage))
}

pub fn encode_server_message(msg: ServerMessage) {
  case msg {
    ServerUpsertChatMessages(messages) -> [
      json.int(0),
      json.array(dict.values(messages), chat_message_to_json),
    ]
  }
  |> json.preprocessed_array
  |> json.to_string
}

pub fn decode_server_message(str_msg: String) {
  let decoder = {
    use id <- zero.field(0, zero.int)

    case id {
      0 -> {
        use chat_msgs <- zero.field(1, zero.list(chat_message_decoder()))
        let chat_msgs =
          chat_msgs
          |> list.map(fn(chat_msg) { #(chat_msg.id, chat_msg) })
          |> dict.from_list
        zero.success(ServerUpsertChatMessages(chat_msgs))
      }
      _ -> zero.failure(ServerUpsertChatMessages(dict.new()), "ServerMessage")
    }
  }

  str_msg
  |> json.decode(zero.run(_, decoder))
}

pub type Chat {
  Chat(messages: dict.Dict(String, ChatMessage))
}

pub type ChatMessageId =
  String

pub type ChatMessage {
  ChatMessage(
    id: ChatMessageId,
    content: String,
    status: MessageStatus,
    sent_at: birl.Time,
  )
}

pub fn new_chat_msg(content, status) {
  ChatMessage(
    id: gluid.guidv4() |> string.lowercase(),
    content: content,
    status:,
    sent_at: birl.utc_now(),
  )
}

fn chat_message_to_json(message: ChatMessage) {
  json.object([
    #("id", message.id |> json.string),
    #("content", json.string(message.content)),
    #("status", json.int(encode_status(message.status))),
    #("sent_at", json.int(birl.to_unix(message.sent_at))),
  ])
}

pub fn encode_chat_message(message: ChatMessage) {
  chat_message_to_json(message)
  |> json.to_string
}

fn chat_message_decoder() {
  use id <- zero.field("id", zero.string)
  use content <- zero.field("content", zero.string)
  use status <- zero.field("status", status_decoder())
  use sent_at_unix <- zero.field("sent_at", zero.int)
  let sent_at = birl.from_unix(sent_at_unix)

  zero.success(ChatMessage(id:, content:, status:, sent_at:))
}

pub fn decode_message(str_message: String) {
  json.decode(str_message, zero.run(_, chat_message_decoder()))
}

pub type MessageStatus {
  ClientError
  ServerError
  Sent
  Received
  Sending
}

fn status_decoder() {
  use decoded_string <- zero.then(zero.int)
  case decoded_string {
    0 -> zero.success(ClientError)
    1 -> zero.success(ServerError)
    2 -> zero.success(Sent)
    3 -> zero.success(Received)
    4 -> zero.success(Sending)
    _ -> zero.failure(ClientError, "MessageStatus")
  }
}

fn encode_status(status: MessageStatus) {
  case status {
    ClientError -> 0
    ServerError -> 1
    Sent -> 2
    Received -> 3
    Sending -> 4
  }
}

pub fn status_string(status: MessageStatus) {
  case status {
    ClientError -> "Client Error"
    ServerError -> "Server Error"
    Sent -> "Sent"
    Received -> "Received"
    Sending -> "Sending"
  }
}
