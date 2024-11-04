import filepath
import gleam/erlang/process
import gleam/http
import gleam/int
import gleam/io
import gleam/option
import gleam/otp/actor
import gleam/result
import lustre/element
import lustre_pipes/attribute
import lustre_pipes/element.{children, empty, text_content} as _
import lustre_pipes/element/html.{html}
import wisp.{type Request, type Response}

import server/context.{type Context}

import shared

pub fn update(msg: shared.SharedMessage, ctx: Context) -> shared.OmniState {
  case msg {
    shared.UserSendMessage(message) -> {
      ctx |> context.add_message(message)

      ctx
      |> context.get_chat_messages()
      |> shared.OmniState
    }
    shared.UserDeleteMessage(message_id) -> {
      ctx |> context.delete_message(message_id)

      ctx
      |> context.get_chat_messages()
      |> shared.OmniState
    }
  }
}

fn cors_middleware(req: Request, fun: fn() -> Response) -> Response {
  case req.method {
    http.Options -> {
      wisp.response(200)
      |> wisp.set_header("Access-Control-Allow-Origin", "*")
      |> wisp.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
      |> wisp.set_header("Access-Control-Allow-Headers", "Content-Type")
    }
    _ -> {
      fun()
      |> wisp.set_header("Access-Control-Allow-Origin", "*")
      |> wisp.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
      |> wisp.set_header("Access-Control-Allow-Headers", "Content-Type")
    }
  }
}

fn static_middleware(req: Request, fun: fn() -> Response) -> Response {
  let assert Ok(priv) = wisp.priv_directory("server")
  let priv_static = filepath.join(priv, "static")
  wisp.serve_static(req, under: "/priv/static", from: priv_static, next: fun)
}

/// Route the request to the appropriate handler based on the path segments.
pub fn handle_request(
  req: Request,
  ws: wisp.WsCapability(Int, String),
  ctx: Context,
) -> Response {
  use <- cors_middleware(req)
  use <- static_middleware(req)
  case wisp.path_segments(req) |> io.debug, req.method |> io.debug {
    // Home
    [], http.Get -> home()
    ["ws"], http.Get -> ws_handler(req, ws, ctx)
    _, _ -> wisp.not_found()
  }
}

pub fn ws_handler(
  req: Request,
  ws: wisp.WsCapability(Int, String),
  ctx: Context,
) -> Response {
  let on_init = fn(conn: wisp.WsConnection) {
    let _ =
      ctx
      |> context.get_chat_messages()
      |> shared.OmniState
      |> shared.encode_omnistate
      |> wisp.WsSendText
      |> conn
    #(0, option.None)
  }

  let handler = fn(state: Int, conn: wisp.WsConnection, msg) {
    case msg {
      wisp.WsText(text) -> {
        let result = {
          use msg <- result.try(shared.decode_shared_message(text))

          Ok(update(msg, ctx))
        }

        // For demo purposes
        case int.random(2) == 0 {
          True -> process.sleep(2000)
          False -> Nil
        }

        case result {
          Ok(omnistate) -> {
            let _ =
              shared.encode_omnistate(omnistate)
              |> wisp.WsSendText
              |> conn

            actor.continue(state)
          }
          _ -> actor.continue(state)
        }
      }
      wisp.WsBinary(_binary) -> actor.continue(state)
      wisp.WsCustom(_selector) -> actor.continue(state)
      wisp.WsClosed | wisp.WsShutdown -> actor.continue(state)
    }
  }
  let on_close = fn(_state) { Nil }

  wisp.WsHandler(handler, on_init, on_close)
  |> wisp.websocket(req, ws)
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
