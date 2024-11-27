/// NOTE! This is a very rudimentary PubSub for the purpose of demonstrating
/// OmniMessage. In production, use a proper PubSub, remove listeners when
/// requests are closed, etc.
import carpenter/table
import gleam/dict.{type Dict}
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

pub type SessionCountListener =
  fn(Int) -> Nil

pub type ChatMessagesListener =
  fn(Dict(String, shared.ChatMessage)) -> Nil

pub type Message {
  GetChatMessages(to: process.Subject(Dict(String, shared.ChatMessage)))
  AddChatMessage(shared.ChatMessage)
  DeleteChatMessage(shared.ChatMessageId)
  IncremenetSessionCount
  DecremenetSessionCount
  AddSessionCountListener(String, SessionCountListener)
  AddChatMessagesListener(String, ChatMessagesListener)
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

type ContextState {
  ContextState(
    tables: Tables,
    session_count_listeners: Dict(String, SessionCountListener),
    chat_msgs_listeners: Dict(String, ChatMessagesListener),
  )
}

fn handle_message(
  message: Message,
  state: ContextState,
) -> actor.Next(Message, ContextState) {
  case message {
    Shutdown -> actor.Stop(process.Normal)

    GetChatMessages(to) -> {
      do_get_chat_messages(state.tables)
      |> process.send(to, _)

      actor.continue(state)
    }

    AddChatMessage(chat_msg) -> {
      let messages =
        do_get_chat_messages(state.tables)
        |> dict.insert(chat_msg.id, chat_msg)

      state.tables.chats |> table.insert([#(chat_id, Chat(messages))])

      state.chat_msgs_listeners
      |> dict.each(fn(_, listener) { listener(messages) })

      actor.continue(state)
    }

    DeleteChatMessage(chat_msg_id) -> {
      let messages =
        do_get_chat_messages(state.tables) |> dict.delete(chat_msg_id)

      state.tables.chats |> table.insert([#(chat_id, Chat(messages))])

      state.chat_msgs_listeners
      |> dict.each(fn(_, listener) { listener(messages) })

      actor.continue(state)
    }

    IncremenetSessionCount -> {
      let new_count = get_sessions_count(state.tables) + 1

      state.tables.sessions_count |> table.insert([#(chat_id, new_count)])

      state.session_count_listeners
      |> dict.each(fn(_, listener) { listener(new_count) })

      actor.continue(state)
    }

    DecremenetSessionCount -> {
      let new_count = int.max(0, get_sessions_count(state.tables) - 1)

      state.tables.sessions_count |> table.insert([#(chat_id, new_count)])

      state.session_count_listeners
      |> dict.each(fn(_, listener) { listener(new_count) })

      actor.continue(state)
    }

    AddSessionCountListener(id, listener) -> {
      listener(get_sessions_count(state.tables))

      actor.continue(
        ContextState(
          ..state,
          session_count_listeners: state.session_count_listeners
            |> dict.insert(id, listener),
        ),
      )
    }

    AddChatMessagesListener(id, listener) -> {
      listener(do_get_chat_messages(state.tables))

      actor.continue(
        ContextState(
          ..state,
          chat_msgs_listeners: state.chat_msgs_listeners
            |> dict.insert(id, listener),
        ),
      )
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

  ContextState(
    tables: Tables(chats:, sessions_count:),
    session_count_listeners: dict.new(),
    chat_msgs_listeners: dict.new(),
  )
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

pub fn add_chat_messages_listener(
  ctx: Context,
  id: String,
  listener: ChatMessagesListener,
) {
  process.send(ctx, AddChatMessagesListener(id, listener))
}

pub fn add_session_listener(
  ctx: Context,
  id: String,
  listener: SessionCountListener,
) {
  process.send(ctx, AddSessionCountListener(id, listener))
}

pub fn increment_session_count(ctx: Context) {
  process.send(ctx, IncremenetSessionCount)
}

pub fn decrement_session_count(ctx: Context) {
  process.send(ctx, DecremenetSessionCount)
}
