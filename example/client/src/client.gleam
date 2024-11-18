import gleam/dict
import gleam/option
import gleam/result
import gleam/string

import lustre
import plinth/browser/document
import plinth/browser/element as e

import client/chat

// MAIN ------------------------------------------------------------------------

pub fn main() {
  let init_model =
    document.query_selector("#model")
    |> result.map(e.inner_text)
    |> result.then(fn(text) {
      case
        text
        |> string.trim
        |> string.is_empty
      {
        True -> Error(Nil)
        False -> Ok(text)
      }
    })
    |> result.then(fn(_string_model) {
      // TODO: Hydrate
      Ok(chat.Model(dict.new(), draft_message_content: ""))
    })
    |> option.from_result

  let assert Ok(_) = lustre.start(chat.chat(), "#app", init_model)

  Nil
}
