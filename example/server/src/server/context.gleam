import carpenter/table
import gleam/dict
import gleam/list
import gleam/result

import shared.{type Chat, Chat}

// this is demo without users, so just a single chat:
const chat_id = 1

pub type Context {
  Context(chats: table.Set(Int, Chat))
}

pub fn new() {
  table.build("chats")
  |> table.privacy(table.Public)
  |> table.write_concurrency(table.AutoWriteConcurrency)
  |> table.read_concurrency(True)
  |> table.decentralized_counters(True)
  |> table.compression(False)
  |> table.set
  |> result.map(Context)
}

pub fn get_chat_messages(ctx: Context) {
  case
    ctx.chats
    |> table.lookup(chat_id)
    |> list.first
  {
    Ok(entry) -> { entry.1 }.messages
    Error(_) -> dict.new()
  }
}

pub fn add_message(ctx: Context, message: shared.Message) {
  let message = shared.Message(..message, status: shared.Sent)
  let chat = Chat(get_chat_messages(ctx) |> dict.insert(message.id, message))

  ctx.chats |> table.insert([#(chat_id, chat)])

  message
}

pub fn delete_message(ctx: Context, message_id: shared.MessageId) {
  let chat = Chat(get_chat_messages(ctx) |> dict.delete(message_id))

  ctx.chats |> table.insert([#(chat_id, chat)])
}
