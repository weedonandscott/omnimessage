import gleam/int
import gleam/option.{type Option, None, Some}
import lustre
import lustre/effect
import lustre_pipes/element
import lustre_pipes/element/html

pub type Model {
  Model(user_count: Option(Int))
}

pub fn app() {
  // An omnimessage_server app has no view
  lustre.application(init, update, view)
}

fn init(count_listener: fn(fn(Int) -> Nil) -> Nil) {
  #(
    Model(None),
    effect.from(fn(dispatch) {
      count_listener(fn(new_count) { dispatch(GotNewCount(new_count)) })
    }),
  )
}

pub type Msg {
  GotNewCount(Int)
}

fn update(_model: Model, msg: Msg) {
  case msg {
    GotNewCount(new_count) -> #(Model(Some(new_count)), effect.none())
  }
}

fn view(model: Model) {
  let count_message =
    model.user_count
    |> option.map(int.to_string)
    |> option.unwrap("Getting user count...")

  html.p()
  |> element.text_content("Online users: " <> count_message)
}
