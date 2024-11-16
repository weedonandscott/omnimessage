import gleam/http
import gleam/http/request
import gleam/http/response
import gleam/json
import gleam/option.{None, Some}
import gleam/result

import filepath
import lustre_omnistate
import lustre_omnistate/omniserver
import lustre_pipes/attribute
import lustre_pipes/element.{children, empty, text_content}
import lustre_pipes/element/html.{html}
import mist
import wisp.{type Request, type Response}
import wisp/wisp_mist

import server/components/chat
import server/context.{type Context}
import shared

type Msg {
  ClientMessage(shared.ClientMessage)
  ServerMessage(shared.ServerMessage)
  Noop
}

fn encoder_decoder() -> lustre_omnistate.EncoderDecoder(
  Msg,
  String,
  json.DecodeError,
) {
  lustre_omnistate.EncoderDecoder(
    fn(msg) {
      case msg {
        // Messages must be encodable
        ServerMessage(message) -> Ok(shared.encode_server_message(message))
        // Return Error(Nil) for messages you don't want to send out
        _ -> Error(Nil)
      }
    },
    fn(encoded_msg) {
      // Unsupported messages will cause TransportError(DecodeError(error)) 
      // which you can ignore if you don't care about those messages
      shared.decode_client_message(encoded_msg)
      |> result.map(ClientMessage)
    },
  )
}

fn handle(ctx: Context, msg: Msg) -> Msg {
  case msg {
    ClientMessage(shared.UserSendMessage(message)) -> {
      ctx |> context.add_message(message)

      context.get_chat_messages(ctx)
      |> shared.ServerUpsertMessages
      |> ServerMessage
    }
    ClientMessage(shared.UserDeleteMessage(message_id)) -> {
      ctx |> context.delete_message(message_id)

      context.get_chat_messages(ctx)
      |> shared.ServerUpsertMessages
      |> ServerMessage
    }
    ClientMessage(shared.FetchMessages) -> {
      context.get_chat_messages(ctx)
      |> shared.ServerUpsertMessages
      |> ServerMessage
    }
    ServerMessage(_) | Noop -> Noop
  }
}

fn cors_middleware(req: Request, fun: fn() -> Response) -> Response {
  case req.method {
    http.Options -> {
      wisp.response(200)
      |> wisp.set_header("access-control-allow-origin", "*")
      |> wisp.set_header("access-control-allow-methods", "GET, POST, OPTIONS")
      |> wisp.set_header(
        "access-control-allow-headers",
        "Content-Type,Content-Encoding",
      )
    }
    _ -> {
      fun()
      |> wisp.set_header("access-control-allow-origin", "*")
      |> wisp.set_header("access-control-allow-methods", "GET, POST, OPTIONS")
      |> wisp.set_header(
        "access-control-allow-headers",
        "Content-Type,Content-Encoding",
      )
    }
  }
}

fn static_middleware(req: Request, fun: fn() -> Response) -> Response {
  let assert Ok(priv) = wisp.priv_directory("server")
  let priv_static = filepath.join(priv, "static")
  wisp.serve_static(req, under: "/priv/static", from: priv_static, next: fun)
}

fn wisp_handler(req, ctx) {
  use <- cors_middleware(req)
  use <- static_middleware(req)

  // For handling HTTP transports
  use <- omniserver.wisp_http_middleware(
    req,
    "/omni-http",
    encoder_decoder(),
    handle(ctx, _),
  )

  case wisp.path_segments(req), req.method {
    // Home
    [], http.Get -> home()
    //
    // If you want extra control, this is how you'd do it without middleware:
    //
    // ["omni-http"], http.Post -> {
    //   use req_body <- wisp.require_string_body(req)
    //
    //   case
    //     req_body
    //     |> lustre_omnistate.pipe(encoder_decoder(), handle(ctx, _))
    //   {
    //     Ok(Some(res_body)) -> wisp.response(200) |> wisp.string_body(res_body)
    //     Ok(None) -> wisp.response(200)
    //     Error(_) -> wisp.unprocessable_entity()
    //   }
    // }
    _, _ -> wisp.not_found()
  }
}

// Wisp doesn't support websockets yet
pub fn mist_handler(
  req: request.Request(mist.Connection),
  ctx: Context,
  secret_key_base,
) -> response.Response(mist.ResponseData) {
  let wisp_mist_handler =
    fn(req) { wisp_handler(req, ctx) }
    |> wisp_mist.handler(secret_key_base)

  case request.path_segments(req), req.method {
    ["omni-app-ws"], http.Get ->
      omniserver.mist_websocket_application(req, chat.app(), ctx, fn(_) { Nil })
    ["omni-pipe-ws"], http.Get ->
      omniserver.mist_websocket_pipe(
        req,
        encoder_decoder(),
        handle(ctx, _),
        fn(_) { Nil },
      )

    _, _ -> wisp_mist_handler(req)
  }
}

fn page_scaffold(
  content: element.Element(a),
  init_json: String,
) -> element.Element(a) {
  html.html()
  |> attribute.attribute("lang", "en")
  |> children([
    html.head()
    |> children([
      html.meta()
        |> attribute.attribute("charset", "UTF-8")
        |> empty(),
      html.meta()
        |> attribute.name("viewport")
        |> attribute.attribute(
          "content",
          "width=device-width, initial-scale=1.0",
        )
        |> empty(),
      html.title()
        |> text_content("Lustre Omnistate"),
      html.link()
        |> attribute.href("/static/client.css")
        |> attribute.rel("stylesheet")
        |> empty(),
      html.script()
        |> attribute.src("/static/client.mjs")
        |> attribute.type_("module")
        |> empty(),
      html.script()
        |> attribute.id("model")
        |> attribute.type_("module")
        |> text_content(init_json),
      html.body()
        |> children([
          html.div()
          |> attribute.id("app")
          |> children([content]),
        ]),
    ]),
  ])
}

fn home() -> Response {
  wisp.response(200)
  |> wisp.set_header("Content-Type", "text/html")
  |> wisp.html_body(
    // content
    html.div()
    |> empty()
    |> page_scaffold("")
    |> element.to_document_string_builder(),
  )
}
