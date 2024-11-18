import birl
import gleam/dict
import gleam/json
import gleam/list
import gleam/option.{type Option}
import gleam/result
import gleam/string
import gluid
import lustre/effect
import lustre_pipes/attribute
import lustre_pipes/element
import lustre_pipes/element/html
import lustre_pipes/event
import omnimessage_lustre as omniclient
import omnimessage_lustre/transports

import shared.{type ClientMessage, type Message, type ServerMessage, Message}

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
  Model(messages: dict.Dict(String, Message), draft_message_content: String)
}

fn init(_initial_model: Option(Model)) -> #(Model, effect.Effect(Msg)) {
  #(Model(dict.new(), draft_message_content: ""), effect.none())
}

// UPDATE ----------------------------------------------------------------------

pub type Msg {
  UserSendDraft
  ClientMessage(ClientMessage)
  ServerMessage(ServerMessage)
  UserUpdateDraftMessageContent(content: String)
  TransportState(transports.TransportState(json.DecodeError))
}

fn update(model: Model, msg: Msg) -> #(Model, effect.Effect(Msg)) {
  case msg {
    // Good old UI
    UserSendDraft -> {
      let message =
        Message(
          id: gluid.guidv4() |> string.lowercase(),
          content: model.draft_message_content,
          status: shared.Draft,
          sent_at: birl.now() |> birl.to_iso8601,
        )

      #(
        Model(..model, draft_message_content: ""),
        effect.from(fn(dispatch) {
          dispatch(ClientMessage(shared.UserSendMessage(message)))
        }),
      )
    }
    UserUpdateDraftMessageContent(content) -> #(
      Model(..model, draft_message_content: content),
      effect.none(),
    )
    // Shared messages
    ClientMessage(shared.UserSendMessage(message)) -> {
      let message = Message(..message, status: shared.Sending)

      let messages =
        model.messages
        |> dict.insert(message.id, message)

      #(Model(..model, messages:), effect.none())
    }
    // The rest of the ClientMessages are exlusively handled by the server
    ClientMessage(_) -> {
      #(model, effect.none())
    }
    // Merge strategy
    ServerMessage(shared.ServerUpsertMessages(server_messages)) -> {
      let messages =
        model.messages
        // Omnimessage shines when you're OK with server being source of truth
        |> dict.merge(server_messages)

      #(Model(..model, messages:), effect.none())
    }
    // State handlers - use for initialization, debug, online/offline indicator
    TransportState(transports.TransportUp) -> {
      #(
        model,
        effect.from(fn(dispatch) {
          dispatch(ClientMessage(shared.FetchMessages))
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

// VIEW ------------------------------------------------------------------------

pub fn message_element(message: Message) {
  html.div()
  |> element.children([
    html.p()
    |> element.text_content(
      shared.encode_status(message.status) <> ": " <> message.content,
    ),
  ])
}

fn sort_messages(messages: List(Message)) {
  messages
  |> list.sort(fn(message_a, message_b) {
    string.compare(message_a.sent_at, message_b.sent_at)
  })
}

fn view(model: Model) -> element.Element(Msg) {
  let sorted_messages =
    model.messages
    |> dict.values
    |> sort_messages
  html.div()
  |> attribute.class("h-full flex flex-col justify-center items-center gap-y-5")
  |> element.children([
    html.div()
      |> element.keyed({
        use message <- list.map(sorted_messages)
        #(message.id, message_element(message))
      }),
    html.form()
      |> event.on_submit(UserSendDraft)
      |> element.children([
        html.input()
          |> event.on_input(UserUpdateDraftMessageContent)
          |> attribute.type_("text")
          |> attribute.value(model.draft_message_content)
          |> attribute.class("border border-black py-1 px-2")
          |> element.empty(),
        html.input()
          |> attribute.type_("submit")
          |> attribute.value("Send")
          |> attribute.class("ml-4 border border-black py-1 px-2")
          |> element.empty(),
      ]),
  ])
}
