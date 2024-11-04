import gleam/erlang/process

import mist
import wisp
import wisp/wisp_mist

import server/context
import server/router

pub fn main() {
  wisp.configure_logger()
  let secret_key_base = wisp.random_string(64)

  let assert Ok(context) = context.new()

  let handler = fn(req, ws) { router.handle_request(req, ws, context) }

  let assert Ok(_) =
    wisp_mist.handler(handler, secret_key_base)
    |> mist.new
    |> mist.port(8000)
    |> mist.start_http

  process.sleep_forever()
}
