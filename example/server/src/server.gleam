import gleam/erlang/process

import mist
import wisp

import server/context
import server/router

pub fn main() {
  wisp.configure_logger()
  let secret_key_base = wisp.random_string(64)

  let assert Ok(context) = context.new()

  let handler = fn(req) { router.mist_handler(req, context, secret_key_base) }

  let assert Ok(_) =
    handler
    |> mist.new
    |> mist.port(8000)
    |> mist.start_http

  process.sleep_forever()
}
