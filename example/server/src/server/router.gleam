import gleam/erlang/process
import gleam/function
import gleam/http
import gleam/http/request
import gleam/http/response
import gleam/json
import gleam/option.{Some}
import gleam/otp/actor
import gleam/result
import gleam/string_tree

import lustre
import lustre/server_component
import lustre_pipes/attribute
import lustre_pipes/element.{children, empty, text_content}
import lustre_pipes/element/html

import filepath
import mist
import wisp.{type Request, type Response}
import wisp/wisp_mist

import omnimessage/server as omniserver

import server/components/chat
import server/components/sessions_count
import server/context.{type Context}
import shared

type Msg {
  ClientMessage(shared.ClientMessage)
  ServerMessage(shared.ServerMessage)
  Noop
}

fn encoder_decoder() -> omniserver.EncoderDecoder(Msg, String, json.DecodeError) {
  omniserver.EncoderDecoder(
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
    ClientMessage(shared.UserSendChatMessage(chat_msg)) -> {
      shared.ChatMessage(..chat_msg, status: shared.Sent)
      |> context.add_chat_message(ctx, _)

      context.get_chat_messages(ctx)
      |> shared.ServerUpsertChatMessages
      |> ServerMessage
    }
    ClientMessage(shared.UserDeleteChatMessage(message_id)) -> {
      ctx |> context.delete_chat_message(message_id)

      context.get_chat_messages(ctx)
      |> shared.ServerUpsertChatMessages
      |> ServerMessage
    }
    ClientMessage(shared.FetchChatMessages) -> {
      context.get_chat_messages(ctx)
      |> shared.ServerUpsertChatMessages
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
    //     |> omniserver.pipe(encoder_decoder(), handle(ctx, _))
    //   {
    //     Ok(Some(res_body)) -> wisp.response(200) |> wisp.string_body(res_body)
    //     Ok(None) -> wisp.response(200)
    //     Error(_) -> wisp.unprocessable_entity()
    //   }
    // }
    _, _ -> wisp.not_found()
  }
}

type SessionCountState {
  SessionCountState(
    runtime: lustre.Runtime(sessions_count.Msg),
    self: process.Subject(server_component.ClientMessage(sessions_count.Msg)),
  )
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
    //
    // This is an example of manual websocket implementation, in case custom
    // functionality is needed, such as custom push logic. It is commented out
    // becuase the rudimentary PubSub implemented in `context` does not support
    // sending mist websocket messages, therefore the added listener will cause
    // a panic. I leave this code here for your reference, in case you want to
    // implement similar (yet working) logic.
    //
    // ["omni-manual-ws"], http.Get ->
    //   mist.websocket(
    //     request: req,
    //     on_init: fn(conn) {
    //       context.add_chat_messages_listener(
    //         ctx,
    //         wisp.random_string(5),
    //         fn(chat_msgs) {
    //           let encoded_msg =
    //             chat_msgs
    //             |> shared.ServerUpsertChatMessages
    //             |> ServerMessage
    //             |> encoder_decoder().encode
    //
    //           let _ = case encoded_msg {
    //             Ok(encoded_msg) -> mist.send_text_frame(conn, encoded_msg)
    //             _ -> Ok(Nil)
    //           }
    //
    //           Nil
    //         },
    //       )
    //
    //       #(None, None)
    //     },
    //     handler: fn(runtime, conn, msg) {
    //       case msg {
    //         mist.Text(msg) -> {
    //           let _ = case
    //             omniserver.pipe(msg, encoder_decoder(), handle(ctx, _))
    //           {
    //             Ok(Some(encoded_msg)) -> mist.send_text_frame(conn, encoded_msg)
    //             Ok(None) -> Ok(Nil)
    //             Error(decode_error) -> Ok(Nil)
    //           }
    //           actor.continue(runtime)
    //         }
    //
    //         mist.Binary(_) -> actor.continue(runtime)
    //
    //         mist.Custom(_) -> actor.continue(runtime)
    //
    //         mist.Closed | mist.Shutdown -> actor.Stop(process.Normal)
    //       }
    //     },
    //     on_close: fn(_) { Nil },
    //   )
    ["sessions-count"], http.Get ->
      mist.websocket(
        req,
        on_init: fn(_) {
          let count_app = sessions_count.app()
          let assert Ok(runtime) =
            lustre.start_server_component(
              count_app,
              context.add_session_listener(ctx, wisp.random_string(5), _),
            )

          context.increment_session_count(ctx)

          let self = process.new_subject()

          server_component.register_subject(self)
          |> lustre.send(to: runtime)

          #(
            SessionCountState(runtime:, self:),
            Some(process.selecting(
              process.new_selector(),
              self,
              function.identity,
            )),
          )
        },
        handler: fn(state: SessionCountState, conn, msg) {
          case msg {
            mist.Text(json) -> {
              let action =
                json.parse(json, server_component.runtime_message_decoder())

              case action {
                Ok(action) -> lustre.send(state.runtime, action)
                Error(_) -> Nil
              }

              actor.continue(state)
            }
            mist.Custom(patch) -> {
              let assert Ok(_) =
                patch
                |> server_component.client_message_to_json
                |> json.to_string
                |> mist.send_text_frame(conn, _)

              actor.continue(state)
            }
            mist.Closed | mist.Shutdown -> {
              server_component.deregister_subject(state.self)
              |> lustre.send(to: state.runtime)

              actor.Stop(process.Normal)
            }
            mist.Binary(_) -> actor.continue(state)
          }
        },
        on_close: fn(state: SessionCountState) {
          context.decrement_session_count(ctx)

          server_component.deregister_subject(state.self)
          |> lustre.send(to: state.runtime)

          lustre.send(state.runtime, lustre.shutdown())
        },
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
  |> attribute.class("h-full w-full overflow-hidden")
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
          |> text_content("OmniMessage"),
        html.link()
          |> attribute.href("/priv/static/client.css")
          |> attribute.rel("stylesheet")
          |> empty(),
        html.script()
          |> attribute.src("/priv/static/client.mjs")
          |> attribute.type_("module")
          |> empty(),
        server_component.script(),
        html.script()
          |> attribute.id("model")
          |> attribute.type_("module")
          |> text_content(init_json),
      ]),
    html.body()
      |> attribute.class("h-full w-full")
      |> children([
        html.div()
        |> attribute.id("app")
        |> attribute.class("h-full w-full")
        |> children([content]),
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
    |> element.to_document_string_tree()
    // https://github.com/lustre-labs/lustre/issues/315
    |> string_tree.replace("\\n", ""),
  )
}
