# omnimessage_server

**Seamless communication with Lustre applications**

[![Package Version](https://img.shields.io/hexpm/v/omnimessage_server)](https://hex.pm/packages/omnimessage_server)
[![Hex Docs](https://img.shields.io/badge/hex-docs-ffaff3)](https://hexdocs.pm/omnimessage_server/)

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

This is where Omnimessage comes in. When paired with a properly set up client
(see [omnimessage_luster](https://hexdocs.pm/omnimessage_lustre)), all you need
to do to communicate is handle Lustre messages.

You can do that via websockets:

```gleam
import omnimessage_server as omniserver

  case request.path_segments(req), req.method {
    ["omni-ws"], http.Get ->
      omniserver.mist_websocket_pipe(
        req,
        // this is for encoding/decoding, supplied by you
        encoder_decoder(),
        // message handler, recieves a message from the client and whatever
        // it returns will be sent back to the client
        handler,
        // error handler
        fn(_) { Nil },
      )
  }
```
via HTTP:

```gleam
import omnimessage_server as omniserver

fn wisp_handler(req, ctx) {
  use <- cors_middleware(req)
  use <- static_middleware(req)

  // For handling HTTP transports
  use <- omniserver.wisp_http_middleware(
    req,
    "/omni-http",
    encoder_decoder(),
    handler,
  )

  // ...rest of handler
}
```

or via full-blown lustre server component, communicating via websockets:

```gleam
import omnimessage_server as omniserver

  case request.path_segments(req), req.method {
    ["omni-ws"], http.Get ->
      // chat.app() is a special lustre server component that'll recieve
      // message form the client and can dispatch message to answer
      omniserver.mist_websocket_application(req, chat.app(), ctx, fn(_) { Nil })
  }
```


Further documentation can be found at <https://hexdocs.pm/omnimessage_server>.
