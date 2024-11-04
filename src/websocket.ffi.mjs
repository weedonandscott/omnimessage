import { Ok, Error } from './gleam.mjs';
import {
  InvalidUrl,
  UnsupportedEnvironment
} from './internal/transports/websocket.mjs';

export const ws_init = (url, on_open, on_text, on_close) => {
  if (typeof WebSocket === "function") {
    try {
      const ws = new WebSocket(url);
      return new Ok(ws);
    } catch (error) {
      return Error(new InvalidUrl(error.message));
    }
  } else {
    return Error(new UnsupportedEnvironment("WebSocket global unavailable"));
  }
}

export const ws_listen = (ws, on_open, on_text, on_close) => {
  ws.addEventListener("open",  (_) => on_open(ws));

  ws.addEventListener("message", (event) => {
    // this transport supports text only
    if (typeof event.data === "string") {
      on_text(event.data);
    }
  });

  ws.addEventListener("close",  (event) =>
    on_close(event.code, event.reason ?? "")
  );
}

export const ws_send = (ws, msg) => {
  ws.send(msg);
}

export const ws_close = (ws) => {
  ws.close();
}

export const get_page_url = () => document.URL;

