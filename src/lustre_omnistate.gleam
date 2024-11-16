import gleam/option.{type Option}
import gleam/result

pub type EncoderDecoder(msg, encoding, decode_error) {
  EncoderDecoder(
    encode: fn(msg) -> Result(encoding, Nil),
    decode: fn(encoding) -> Result(msg, decode_error),
  )
}

pub fn pipe(
  msg: encoding,
  encoder_decoder: EncoderDecoder(msg, encoding, decode_error),
  handler: fn(msg) -> msg,
) -> Result(Option(encoding), decode_error) {
  msg
  |> encoder_decoder.decode
  |> result.map(handler)
  |> result.map(encoder_decoder.encode)
  // Encoding error means "skip this message"
  |> result.map(option.from_result)
}
