import internal/transports/websocket

pub type Transport(encoded_msg, encoded_omnistate, down_reason, transport_error) {
  Transport(
    listen: fn(TransportHandlers(encoded_omnistate)) -> Nil,
    send: fn(encoded_msg) -> Nil,
  )
}

pub type TransportHandlers(encoded_omnistate) {
  TransportHandlers(
    on_up: fn() -> Nil,
    on_down: fn(Int, String) -> Nil,
    on_message: fn(encoded_omnistate) -> Nil,
    on_init_error: fn(String) -> Nil,
  )
}

pub fn websocket(path: String) {
  case websocket.init(path) {
    Ok(ws) ->
      Transport(
        listen: fn(handlers) {
          websocket.listen(
            ws,
            on_open: fn(_) { handlers.on_up() },
            on_text_message: handlers.on_message,
            on_close: fn(reason) {
              handlers.on_down(reason.code, reason.reason)
            },
          )
        },
        send: websocket.send(ws, _),
      )
    Error(error) ->
      Transport(
        listen: fn(handlers) { handlers.on_init_error(error.message) },
        send: fn(_msg) { Nil },
      )
  }
}
