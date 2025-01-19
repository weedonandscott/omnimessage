import birl
import gleam/dict
import gleam/json
import gleam/list
import gleam/option.{type Option}
import gleam/result
import lustre/effect
import lustre_pipes/attribute
import lustre_pipes/element
import lustre_pipes/element/html
import lustre_pipes/event
import lustre_pipes/server_component
import omnimessage/lustre as omniclient
import omnimessage/lustre/transports
import plinth/browser/document
import plinth/browser/element as plinth_element

import shared.{
  type ChatMessage, type ClientMessage, type ServerMessage, ChatMessage,
}

// MAIN ------------------------------------------------------------------------

pub fn chat() {
  let encoder_decoder =
    omniclient.EncoderDecoder(
      fn(msg) {
        case msg {
          // Messages must be encodable
          ClientMessage(message) -> Ok(shared.encode_client_message(message))
          // Return Error(Nil) for messages you don't want to send out
          _ -> Error(Nil)
        }
      },
      fn(encoded_msg) {
        // Unsupported messages will cause TransportError(DecodeError(error)) 
        shared.decode_server_message(encoded_msg)
        |> result.map(ServerMessage)
      },
    )

  omniclient.component(
    init,
    update,
    view,
    dict.new(),
    encoder_decoder,
    transports.websocket("http://localhost:8000/omni-app-ws"),
    // transports.websocket("http://localhost:8000/omni-pipe-ws"),
    // transports.http("http://localhost:8000/omni-http", option.None, dict.new()),
    TransportState,
  )
}

// MODEL -----------------------------------------------------------------------

pub type Model {
  Model(chat_msgs: dict.Dict(String, ChatMessage), draft_content: String)
}

fn init(_initial_model: Option(Model)) -> #(Model, effect.Effect(Msg)) {
  #(Model(dict.new(), draft_content: ""), effect.none())
}

// UPDATE ----------------------------------------------------------------------

pub type Msg {
  UserSendDraft
  UserScrollToLatest
  UserUpdateDraftContent(String)
  ClientMessage(ClientMessage)
  ServerMessage(ServerMessage)
  TransportState(transports.TransportState(json.DecodeError))
}

fn update(model: Model, msg: Msg) -> #(Model, effect.Effect(Msg)) {
  case msg {
    // Good old UI
    UserUpdateDraftContent(content) -> #(
      Model(..model, draft_content: content),
      effect.none(),
    )
    UserSendDraft -> {
      #(
        Model(..model, draft_content: ""),
        effect.from(fn(dispatch) {
          shared.new_chat_msg(model.draft_content, shared.Sending)
          |> shared.UserSendChatMessage
          |> ClientMessage
          |> dispatch
        }),
      )
    }
    UserScrollToLatest -> #(model, scroll_to_latest_message())
    // Shared messages
    ClientMessage(shared.UserSendChatMessage(chat_msg)) -> {
      let chat_msgs =
        model.chat_msgs
        |> dict.insert(chat_msg.id, chat_msg)

      #(Model(..model, chat_msgs:), scroll_to_latest_message())
    }
    // The rest of the ClientMessages are exlusively handled by the server
    ClientMessage(_) -> {
      #(model, effect.none())
    }
    // Merge strategy
    ServerMessage(shared.ServerUpsertChatMessages(server_messages)) -> {
      let chat_msgs =
        model.chat_msgs
        // Omnimessage shines when you're OK with server being source of truth
        |> dict.merge(server_messages)

      #(Model(..model, chat_msgs:), effect.none())
    }
    // State handlers - use for initialization, debug, online/offline indicator
    TransportState(transports.TransportUp) -> {
      #(
        model,
        effect.from(fn(dispatch) {
          dispatch(ClientMessage(shared.FetchChatMessages))
        }),
      )
    }
    TransportState(transports.TransportDown(_, _)) -> {
      // Use this for debugging, online/offline indicator
      #(model, effect.none())
    }
    TransportState(transports.TransportError(_)) -> {
      // Use this for debugging, online/offline indicator
      #(model, effect.none())
    }
  }
}

const msgs_container_id = "chat-msgs"

fn scroll_to_latest_message() {
  effect.from(fn(_dispatch) {
    let _ =
      document.get_element_by_id(msgs_container_id)
      |> result.then(fn(container) {
        plinth_element.scroll_height(container)
        |> plinth_element.set_scroll_top(container, _)
        Ok(Nil)
      })

    Nil
  })
}

// VIEW ------------------------------------------------------------------------

fn chat_message_element(chat_msg: ChatMessage) {
  html.div()
  |> element.children([
    html.p()
    |> element.text_content(
      shared.status_string(chat_msg.status) <> ": " <> chat_msg.content,
    ),
  ])
}

fn sort_chat_messages(chat_msgs: List(ChatMessage)) {
  use msg_a, msg_b <- list.sort(chat_msgs)
  birl.compare(msg_a.sent_at, msg_b.sent_at)
}

fn view(model: Model) -> element.Element(Msg) {
  let sorted_chat_msgs =
    model.chat_msgs
    |> dict.values
    |> sort_chat_messages

  html.div()
  |> attribute.class("h-full flex flex-col justify-center items-center gap-y-5")
  |> element.children([
    html.div()
      |> attribute.class("flex justify-center")
      |> element.children([
        server_component.component()
        |> server_component.route("/sessions-count")
        |> element.empty(),
      ]),
    html.div()
      |> attribute.id(msgs_container_id)
      |> attribute.class(
        "h-80 w-80 overflow-y-auto p-5 border border-gray-400 rounded-xl",
      )
      |> element.keyed({
        use chat_msg <- list.map(sorted_chat_msgs)
        #(chat_msg.id, chat_message_element(chat_msg))
      }),
    html.form()
      |> attribute.class("w-80 flex gap-x-4")
      |> event.on_submit(UserSendDraft)
      |> element.children([
        html.input()
          |> event.on_input(UserUpdateDraftContent)
          |> attribute.type_("text")
          |> attribute.value(model.draft_content)
          |> attribute.class("flex-1 border border-gray-400 rounded-lg p-1.5")
          |> element.empty(),
        html.input()
          |> attribute.type_("submit")
          |> attribute.value("Send")
          |> attribute.class(
            "border border-gray-400 rounded-lg p-1.5 text-gray-700 font-bold",
          )
          |> element.empty(),
      ]),
  ])
}
