/// Transports tell an omnimessage_lustre application how to communicate with
/// the server.
///
/// You hand them to `omniclient.application()` or `omniclient.component()`
/// alongside an `EncoderDecoder` that corresponds to the encoding they use.
///
/// Various transports are available, but you can always write your own if
/// something is missing. Underneath, a transport is just some callbacks for
/// when you receive an already encoded message.
///
/// Note that transports do not your support automatic reconnection on errors.
///
import gleam/dict
import gleam/fetch
import gleam/http
import gleam/http/request
import gleam/http/response
import gleam/javascript/promise
import gleam/option
import gleam/result

import omnimessage_lustre/internal/transports/websocket

/// This type represents the state messages sent to your Lustre application via
/// the wrapper you gave on application creation.
///
/// It allows you to do housekeeping such as init calls, online/offline
/// inidcators, and debugging.
///
pub type TransportState(decode_error) {
  TransportUp
  TransportDown(code: Int, message: String)
  TransportError(TransportError(decode_error))
}

/// This represents an error in the transport itself (e.g, loss of connection),
/// sent inside a `TransportError` record.
///
/// Note that this isn't for error handling of your app logic, use omnimessage
/// messages for that.
///
pub type TransportError(decode_error) {
  InitError(message: String)
  DecodeError(decode_error)
  SendError(message: String)
}

/// Represents the handlers a transport uses for communication. Unless you're
/// building a transport, you don't need to know about this.
///
pub type TransportHandlers(encoding, decode_error) {
  TransportHandlers(
    on_up: fn() -> Nil,
    on_down: fn(Int, String) -> Nil,
    on_message: fn(encoding) -> Nil,
    on_error: fn(TransportError(decode_error)) -> Nil,
  )
}

///
pub type Transport(encoding, decode_error) {
  Transport(
    listen: fn(TransportHandlers(encoding, decode_error)) -> Nil,
    send: fn(encoding, TransportHandlers(encoding, decode_error)) -> Nil,
  )
}

@target(javascript)
/// A websocket transport using text frames
pub fn websocket(path: String) -> Transport(String, decode_error) {
  case websocket.init(path) {
    Ok(ws) -> {
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
        send: fn(msg, _handlers) { websocket.send(ws, msg) },
      )
    }
    Error(error) ->
      Transport(
        listen: fn(handlers) { handlers.on_error(InitError(error.message)) },
        send: fn(_msg, _handlers) { Nil },
      )
  }
}

fn prepare_http_request(
  path path: String,
  method method: option.Option(http.Method),
  headers headers: dict.Dict(String, String),
  encoded_msg encoded_msg: String,
) {
  let method = option.unwrap(method, http.Post)

  let assert Ok(req) = request.to(path)

  let req =
    req
    |> request.set_method(method)
    |> request.set_body(encoded_msg)
    |> request.set_header("content-encoding", "application/json")

  let req = {
    use req, key, value <- dict.fold(headers, req)
    request.set_header(req, key, value)
    req
  }

  req
}

fn handle_http_response(
  rest res: Result(response.Response(String), TransportError(decode_error)),
  handlers handlers: TransportHandlers(String, decode_error),
) {
  let encoded_msg = {
    use res <- result.try(res)

    case res.status >= 200 && res.status < 300 {
      True -> Ok(res.body)
      // TODO
      False -> Error(SendError(""))
    }
  }

  case encoded_msg {
    Ok(encoded_msg) -> handlers.on_message(encoded_msg)
    Error(error) -> handlers.on_error(error)
  }
}

@external(javascript, "../omnimessage_lustre.ffi.mjs", "on_online_change")
fn on_online_change(callback: fn(Bool) -> Nil) -> Bool

@target(javascript)
/// An http transport using text requests
pub fn http(
  path path: String,
  method method: option.Option(http.Method),
  headers headers: dict.Dict(String, String),
) -> Transport(String, decode_error) {
  Transport(
    listen: fn(handlers) {
      let is_online =
        on_online_change(fn(is_online) {
          case is_online {
            True -> handlers.on_up()
            False -> handlers.on_down(0, "Offline")
          }
        })

      case is_online {
        True -> handlers.on_up()
        False -> handlers.on_down(0, "Offline")
      }
    },
    send: fn(encoded_msg: String, handlers) {
      let req = prepare_http_request(path:, method:, headers:, encoded_msg:)

      fetch.send(req)
      |> promise.await(fn(res) {
        case res {
          Ok(res) -> fetch.read_text_body(res)
          Error(error) -> promise.resolve(Error(error))
        }
      })
      |> promise.tap(fn(res) {
        result.map_error(res, fn(_) { SendError("") })
        |> handle_http_response(handlers)
      })

      Nil
    },
  )
}
// @target(erlang)
// /// An http transport using text requests
// pub fn http(
//   path path: String,
//   method method: option.Option(http.Method),
//   headers headers: dict.Dict(String, String),
// ) -> Transport(String, decode_error) {
//   Transport(
//     listen: fn(handlers) { handlers.on_up() },
//     send: fn(encoded_msg: String, handlers) {
//       let req = prepare_http_request(path:, method:, headers:, encoded_msg:)
//
//       httpc.send(req)
//       |> result.map_error(fn(_) { SendError("") })
//       |> handle_http_response(handlers)
//
//       Nil
//     },
//   )
// }
