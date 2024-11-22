import carpenter/table
import gleam/dict
import gleam/erlang/process
import gleam/int
import gleam/list
import gleam/otp/actor
import gleam/result

import shared.{type Chat, Chat}

// this is demo without users, so just a single chat:
const chat_id = 1

type Tables {
  Tables(chats: table.Set(Int, Chat), sessions_count: table.Set(Int, Int))
}

pub type Context =
  process.Subject(Message)

pub type Message {
  GetChatMessages(to: process.Subject(dict.Dict(String, shared.ChatMessage)))
  AddChatMessage(shared.ChatMessage)
  DeleteChatMessage(shared.ChatMessageId)
  IncremenetSessionCount
  DecremenetSessionCount
  AddSessionListener(String, fn(Int) -> Nil)
  Shutdown
}

fn get_sessions_count(tables: Tables) {
  case
    tables.sessions_count
    |> table.lookup(chat_id)
    |> list.first
  {
    Ok(entry) -> {
      entry.1
    }
    Error(_) -> 0
  }
}

fn do_get_chat_messages(tables: Tables) {
  case
    tables.chats
    |> table.lookup(chat_id)
    |> list.first
  {
    Ok(entry) -> { entry.1 }.messages
    Error(_) -> dict.new()
  }
}

type State =
  #(Tables, dict.Dict(String, fn(Int) -> Nil))

fn handle_message(message: Message, state: State) -> actor.Next(Message, State) {
  let tables = state.0
  let listeners = state.1

  case message {
    Shutdown -> actor.Stop(process.Normal)

    GetChatMessages(to) -> {
      do_get_chat_messages(tables)
      |> process.send(to, _)

      actor.continue(state)
    }

    AddChatMessage(chat_msg) -> {
      let chat =
        Chat(do_get_chat_messages(tables) |> dict.insert(chat_msg.id, chat_msg))

      tables.chats |> table.insert([#(chat_id, chat)])

      actor.continue(state)
    }

    DeleteChatMessage(chat_msg_id) -> {
      let chat = Chat(do_get_chat_messages(tables) |> dict.delete(chat_msg_id))

      tables.chats |> table.insert([#(chat_id, chat)])

      actor.continue(state)
    }

    IncremenetSessionCount -> {
      let new_count = get_sessions_count(tables) + 1

      tables.sessions_count |> table.insert([#(chat_id, new_count)])

      listeners |> dict.each(fn(_, listener) { listener(new_count) })

      actor.continue(state)
    }

    DecremenetSessionCount -> {
      let new_count = int.max(0, get_sessions_count(tables) - 1)

      tables.sessions_count |> table.insert([#(chat_id, new_count)])

      listeners |> dict.each(fn(_, listener) { listener(new_count) })

      actor.continue(state)
    }

    AddSessionListener(id, listener) -> {
      listener(get_sessions_count(tables))

      actor.continue(#(tables, listeners |> dict.insert(id, listener)))
    }
  }
}

pub fn new() {
  use chats <- result.try(
    table.build("chats")
    |> table.privacy(table.Public)
    |> table.write_concurrency(table.AutoWriteConcurrency)
    |> table.read_concurrency(True)
    |> table.decentralized_counters(True)
    |> table.compression(False)
    |> table.set,
  )

  use sessions_count <- result.try(
    table.build("sessions_count")
    |> table.privacy(table.Public)
    |> table.write_concurrency(table.AutoWriteConcurrency)
    |> table.read_concurrency(True)
    |> table.decentralized_counters(True)
    |> table.compression(False)
    |> table.set,
  )

  #(Tables(chats:, sessions_count:), dict.new())
  |> actor.start(handle_message)
  |> result.replace_error(Nil)
}

const timeout = 1000

pub fn get_chat_messages(ctx: Context) {
  actor.call(ctx, GetChatMessages, timeout)
}

pub fn add_chat_message(ctx: Context, chat_msg: shared.ChatMessage) {
  process.send(ctx, AddChatMessage(chat_msg))
}

pub fn delete_chat_message(ctx: Context, chat_msg_id: shared.ChatMessageId) {
  process.send(ctx, DeleteChatMessage(chat_msg_id))
}

pub fn add_session_listener(ctx: Context, id: String, listener: fn(Int) -> Nil) {
  process.send(ctx, AddSessionListener(id, listener))
}

pub fn increment_session_count(ctx: Context) {
  process.send(ctx, IncremenetSessionCount)
}

pub fn decrement_session_count(ctx: Context) {
  process.send(ctx, DecremenetSessionCount)
}
