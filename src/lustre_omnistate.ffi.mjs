import { Ok, Error } from './gleam.mjs';

const cache = {};

export function set(key, val) {
  cache[key] = val;
}

export function get(key) {
  return cache[key] ? new Ok(cache[key]) : new Error();
}

export function remove(key) {
  delete cache[key];
}
