import gleam/option.{None, Some}
import gleam/result
import gleam/uri.{type Uri, Uri}

pub type WebSocket

pub type WebSocketCloseReason {
  // 1000
  Normal(code: Int, reason: String)
  // 1001
  GoingAway(code: Int, reason: String)
  // 1002
  ProtocolError(code: Int, reason: String)
  // 1003
  UnexpectedTypeOfData(code: Int, reason: String)
  // 1004 Reserved
  // 1005
  NoCodeFromServer(code: Int, reason: String)
  // 1006, no close frame
  AbnormalClose(code: Int, reason: String)
  // 1007
  IncomprehensibleFrame(code: Int, reason: String)
  // 1008
  PolicyViolated(code: Int, reason: String)
  // 1009
  MessageTooBig(code: Int, reason: String)
  // 1010
  FailedExtensionNegotation(code: Int, reason: String)
  // 1011
  UnexpectedFailure(code: Int, reason: String)
  // 1012
  ServiceRestart(code: Int, reason: String)
  // 1013
  TryAgainLater(code: Int, reason: String)
  // 1014
  BadGateway(code: Int, reason: String)
  // 1015
  FailedTLSHandshake(code: Int, reason: String)
  // unlisted
  OtherCloseReason(code: Int, reason: String)
}

fn parse_reason(code: Int, reason: String) -> WebSocketCloseReason {
  case code {
    1000 -> Normal(code, reason)
    1001 -> GoingAway(code, reason)
    1002 -> ProtocolError(code, reason)
    1003 -> UnexpectedTypeOfData(code, reason)
    1005 -> NoCodeFromServer(code, reason)
    1006 -> AbnormalClose(code, reason)
    1007 -> IncomprehensibleFrame(code, reason)
    1008 -> PolicyViolated(code, reason)
    1009 -> MessageTooBig(code, reason)
    1010 -> FailedExtensionNegotation(code, reason)
    1011 -> UnexpectedFailure(code, reason)
    1012 -> ServiceRestart(code, reason)
    1013 -> TryAgainLater(code, reason)
    1014 -> BadGateway(code, reason)
    1015 -> FailedTLSHandshake(code, reason)
    _ -> OtherCloseReason(code, reason)
  }
}

pub type WebSocketError {
  InvalidUrl(message: String)
  UnsupportedEnvironment(message: String)
}

pub type WebSocketEvent {
  OnOpen(WebSocket)
  OnTextMessage(String)
  OnBinaryMessage(BitArray)
  OnClose(WebSocketCloseReason)
}

/// Initialize a websocket. These constructs are fully asynchronous, so you must provide a wrapper
/// that takes a `WebSocketEvent` and turns it into a lustre message of your application.
/// If the path given is a URL, that is used.
/// If the path is an absolute path, host and port are taken from
/// document.URL, and scheme will become ws for http and wss for https.
/// If the path is a relative path, ditto, but the the path will be
/// relative to the path from document.URL
pub fn init(path: String) -> Result(WebSocket, WebSocketError) {
  case get_websocket_path(path) {
    Ok(url) -> do_init(url)
    _ -> Error(InvalidUrl("Invalid Url"))
  }
}

pub fn listen(
  ws: WebSocket,
  on_open on_open,
  on_text_message on_text_message,
  on_close on_close,
) {
  do_listen(ws, on_open:, on_text_message:, on_close: fn(code, reason) {
    parse_reason(code, reason)
    |> on_close
  })
}

fn get_websocket_path(path) -> Result(String, Nil) {
  page_uri()
  |> result.try(do_get_websocket_path(path, _))
}

fn do_get_websocket_path(path: String, page_uri: Uri) -> Result(String, Nil) {
  let path_uri =
    uri.parse(path)
    |> result.unwrap(Uri(
      scheme: None,
      userinfo: None,
      host: None,
      port: None,
      path: path,
      query: None,
      fragment: None,
    ))
  use merged <- result.try(uri.merge(page_uri, path_uri))
  use merged_scheme <- result.try(option.to_result(merged.scheme, Nil))
  use ws_scheme <- result.try(convert_scheme(merged_scheme))
  Uri(..merged, scheme: Some(ws_scheme))
  |> uri.to_string
  |> Ok
}

fn convert_scheme(scheme: String) -> Result(String, Nil) {
  case scheme {
    "https" -> Ok("wss")
    "http" -> Ok("ws")
    "ws" | "wss" -> Ok(scheme)
    _ -> Error(Nil)
  }
}

@external(javascript, "../../websocket.ffi.mjs", "ws_init")
fn do_init(a: path) -> Result(WebSocket, WebSocketError)

@external(javascript, "../../websocket.ffi.mjs", "ws_listen")
fn do_listen(
  ws: WebSocket,
  on_open on_open: fn(WebSocket) -> Nil,
  on_text_message on_text_message: fn(String) -> Nil,
  on_close on_close: fn(Int, String) -> Nil,
) -> Nil

@external(javascript, "../../websocket.ffi.mjs", "ws_send")
pub fn send(ws ws: WebSocket, msg msg: String) -> Nil

@external(javascript, "../../websocket.ffi.mjs", "ws_close")
pub fn close(ws ws: WebSocket) -> Nil

fn page_uri() -> Result(Uri, Nil) {
  do_get_page_url()
  |> uri.parse
}

@external(javascript, "../../websocket.ffi.mjs", "get_page_url")
fn do_get_page_url() -> String
