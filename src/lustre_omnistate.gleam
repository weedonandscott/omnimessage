/// Lustre Omnimessage has different tools for clients and servers.
///
/// Please see `lustre_omnimessage/omniclient` for client-side usage and
/// `lustre_omnimessage/omniserver` for server side usage.
///
import gleam/option.{type Option}
import gleam/result

///
/// Holds decode and encode functions for messages in a lustre_omnimessage
/// application. Decode errors will be called back for you to handle,
/// while Encode errors are interpreted as "skip this message" -- no error will
/// be raised for them and they won't be sent over.
///
/// Since an `EncoderDecoder` is expected to receive the whole message type of
/// an application, but usually will ignore messages that aren't shared, it's
/// best to define it as a thin wrapper around shared encoders/decoders:
///
/// ```gleam
/// // Holds shared message types, encoders and decoders
/// import shared
///
/// let encoder_decoder =
///   lustre_omnistate.EncoderDecoder(
///     fn(msg) {
///       case msg {
///         // Messages must be encodable
///         ClientMessage(message) -> Ok(shared.encode_client_message(message))
///         // Return Error(Nil) for messages you don't want to send out
///         _ -> Error(Nil)
///       }
///     },
///     fn(encoded_msg) {
///       // Unsupported messages will cause TransportError(DecodeError(error))
///       shared.decode_server_message(encoded_msg)
///       |> result.map(ServerMessage)
///     },
///   )
/// ```
///
pub type EncoderDecoder(msg, encoding, decode_error) {
  EncoderDecoder(
    encode: fn(msg) -> Result(encoding, Nil),
    decode: fn(encoding) -> Result(msg, decode_error),
  )
}

/// A utility function for easily handling messages:
///
/// ```gleam
/// let out_msg = lustre_omnimessage.pipe(in_msg, encoder_decoder, handler)
/// ```
///
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
