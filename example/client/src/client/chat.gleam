import birl
import gleam/dict
import gleam/io
import gleam/json
import gleam/list
import gleam/option.{type Option}
import gleam/string
import gluid
import lustre
import lustre/effect
import lustre_omnistate as lo
import lustre_pipes/attribute
import lustre_pipes/element
import lustre_pipes/element/html
import lustre_pipes/event
import lustre_websocket as ws
import transports

import shared.{
  type Message, type OmniState, type SharedMessage, Message, OmniState,
}

// MAIN ------------------------------------------------------------------------

pub fn chat() {
  let encoder_decoder =
    lo.EncoderDecoder(
      fn(msg) {
        case msg {
          // We're only interested in sending `SharedMessage`
          SharedMessage(message) -> Ok(shared.encode_shared_message(message))
          _ -> Error(Nil)
        }
      },
      shared.decode_omnistate,
    )

  let #(omniinit, omniupdate) =
    lo.setup(
      init,
      update,
      transports.websocket("http://localhost:8000/ws"),
      OmniMessage,
      encoder_decoder,
    )

  lustre.component(omniinit, omniupdate, view, dict.new())
}

// MODEL -----------------------------------------------------------------------

pub type Model {
  Model(omnistate: OmniState, draft_message_content: String)
}

fn init(_initial_model: Option(Model)) -> #(Model, effect.Effect(Msg)) {
  #(
    Model(shared.OmniState(dict.new()), draft_message_content: ""),
    effect.none(),
  )
}

// UPDATE ----------------------------------------------------------------------

pub type Msg {
  UserSendDraft
  SharedMessage(SharedMessage)
  UserUpdateDraftMessageContent(content: String)
  OmniMessage(lo.OmniMessage(OmniState, json.DecodeError))
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
          dispatch(SharedMessage(shared.UserSendMessage(message)))
        }),
      )
    }
    UserUpdateDraftMessageContent(content) -> #(
      Model(..model, draft_message_content: content),
      effect.none(),
    )
    // Omnistate
    // Shared messages
    SharedMessage(shared.UserSendMessage(message)) -> {
      let message = Message(..message, status: shared.Sending)

      let omnistate =
        model.omnistate.messages
        |> dict.insert(message.id, message)
        |> OmniState

      #(Model(..model, omnistate:), effect.none())
    }
    SharedMessage(_) -> {
      #(model, effect.none())
    }
    // Merge strategy
    OmniMessage(lo.OmnistateReceived(Ok(server_omnistate))) -> {
      let omnistate =
        model.omnistate.messages
        // Omnistate shines when you're OK with server being source of truth
        |> dict.merge(server_omnistate.messages)
        |> OmniState

      #(Model(..model, omnistate:), effect.none())
    }
    // State handlers
    OmniMessage(lo.OmnistateReceived(Error(err))) -> {
      // If we're here, the server probably sent bad data
      io.debug(err)
      #(model, effect.none())
    }
    OmniMessage(lo.TransportDown(_, _)) -> {
      // Use this for debugging, online/offline indicator
      #(model, effect.none())
    }
    OmniMessage(lo.TransportUp) -> {
      // Use this for debugging, online/offline indicator
      #(model, effect.none())
    }
    OmniMessage(lo.TransportInitError(_)) -> {
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
    model.omnistate.messages
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
