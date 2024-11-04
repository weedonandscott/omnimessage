# Lustre Omnistate

## Use Remote State, Locally

[![Package Version](https://img.shields.io/hexpm/v/lustre_omnistate)](https://hex.pm/packages/lustre_omnistate)
[![Hex Docs](https://img.shields.io/badge/hex-docs-ffaff3)](https://hexdocs.pm/lustre_omnistate/)

```sh
gleam add lustre_omnistate@1
```
```gleam
import lustre_omnistate as lo

pub type Msg {
  // .. rest of your Msg type
  // add messages shared with the remote
  SharedMessage(SharedMessage)
  // recieve new state from the remote
  OmniMessage(lo.OmniMessage(OmniState, json.DecodeError))
}

// In your main
let #(omniinit, omniupdate) =
  lo.setup(
  // 
    init,
    update,
    transports.websocket("WEBSOCKETS_URL"),
    OmniMessage,
    encoder_decoder,
  )

lustre.application(omniinit, omniupdate, view)

// Every time you dispatch a `SharedMessage`, the server will recieve the message
// and every time the server sends a new state, it'll dispatch on the client!

// See the `example` folder for a chat app use case
```

Further documentation can be found at <https://hexdocs.pm/lustre_omnistate>.

