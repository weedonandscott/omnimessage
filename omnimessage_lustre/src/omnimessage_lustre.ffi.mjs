import { Ok, Error } from './gleam.mjs';

export function on_online_change(cb) {
  addEventListener("online", (_) => cb(true));
  addEventListener("offline", (_) => cb(false));
  return navigator.onLine;
}
