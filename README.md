# Omnimessage

**Seamless server communication using Lustre messages**

[![Package Version](https://img.shields.io/hexpm/v/omnimessage_lustre)](https://hex.pm/packages/omnimessage_lustre)
[![Hex Docs](https://img.shields.io/badge/hex-docs-ffaff3)](https://hexdocs.pm/omnimessage_lustre/)

A main challenge of maintaining a client side application is state
synchronization. Usually, a complete separation is ideal, where client state is
managed exclusively at the client, and server state exclusively at the server.
There's nuance to this take, but it's a good general rule to follow.

[Lustre](https://hexdocs.pm/lustre/) exceles at this with having both the power
of a full-blown single page application, and the flexibility of using server
components for a LiveView/HTMX like solution to state fully owned by the server.

This approach becomes brittle when the state is shared between both the client
and server. In a chat app, for example, the messages are state owned by the
server, but you still need to display a message as `Sending...` before the
server knows it exists. This is usually where LiveView or HTMLX will recommend
you sprinkle some Javascript. Lustre has an easier time dealing with this, but
it can become quite cumbersome to manage the different HTTP requests and
websocket connections.

This is where Omnimessage comes in. When a lustre application is paired with a
properly set up server, they can communicate by dispatching messages in Lustre.

```gleam
import omnimessage_lustre as omniclient

pub fn chat_component() {
  // Instead of lustre.component, use:
  omniclient.component(
    init,
    update,
    view,
    dict.new(),
    // this is for encoding/decoding, supplied by you
    encoder_decoder,
    // this transfers the encoded messages
    transports.websocket("http://localhost:8000/omni-app-ws"),
    TransportState,
  )
}

// Divide you messages wisely:
pub type Msg {
  UserSendDraft
  UserUpdateDraftMessageContent(content: String)
  // Messages from the client
  ClientMessage(ClientMessage)
  // Messages from the server
  ServerMessage(ServerMessage)
  // Messages about transport health
  TransportState(transports.TransportState(json.DecodeError))
}


fn update(model: Model, msg: Msg) -> #(Model, effect.Effect(Msg)) {
  case msg {
    // Merge strategy
    ServerMessage(shared.ServerUpsertMessages(server_messages)) -> {
      let messages =
        model.messages
        // Omnimessage shines when you're OK with server being source of truth
        |> dict.merge(server_messages)

      #(Model(..model, messages:), effect.none())
    }
    // ...handle the rest of the messages
  }
}

// Then in your view, all you need to do is:
    html.form()
      |> event.on_submit(UserSendChat)
// That message will go to both the client, that can use it to disaply the chat
// in a sending state, and to the server, which can handle the new message
// and reply with an updated, correct state.
```

Further documentation can be found at <https://hexdocs.pm/omnimessage_lustre>
and <https://hexdocs.pm/omnimessage_server>
