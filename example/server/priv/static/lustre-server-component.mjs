// build/dev/javascript/lustre/lustre/internals/constants.mjs
var diff = 0;
var emit = 1;
var init = 2;
var event = 4;
var attrs = 5;

// build/dev/javascript/lustre/vdom.ffi.mjs
if (window && window.customElements) {
  try {
    window.customElements.define(
      "lustre-fragment",
      class LustreFragment extends HTMLElement {
        constructor() {
          super();
        }
      }
    );
  } catch (e) {}
}
function morph(prev, next, dispatch) {
  let out;
  let stack = [{ prev, next, parent: prev.parentNode }];
  while (stack.length) {
    let { prev: prev2, next: next2, parent } = stack.pop();
    while (next2.subtree !== void 0)
      next2 = next2.subtree();
    if (next2.content !== void 0) {
      if (!prev2) {
        const created = document.createTextNode(next2.content);
        parent.appendChild(created);
        out ??= created;
      } else if (prev2.nodeType === Node.TEXT_NODE) {
        if (prev2.textContent !== next2.content)
          prev2.textContent = next2.content;
        out ??= prev2;
      } else {
        const created = document.createTextNode(next2.content);
        parent.replaceChild(created, prev2);
        out ??= created;
      }
    } else if (next2.tag !== void 0) {
      const created = createElementNode({
        prev: prev2,
        next: next2,
        dispatch,
        stack
      });
      if (!prev2) {
        parent.appendChild(created);
      } else if (prev2 !== created) {
        parent.replaceChild(created, prev2);
      }
      out ??= created;
    }
  }
  return out;
}
function patch(root, diff2, dispatch, stylesOffset = 0) {
  const rootParent = root.parentNode;
  for (const created of diff2[0]) {
    const key = created[0].split("-");
    const next = created[1];
    const prev = getDeepChild(rootParent, key, stylesOffset);
    let result;
    if (prev !== null && prev !== rootParent) {
      result = morph(prev, next, dispatch);
    } else {
      const parent = getDeepChild(rootParent, key.slice(0, -1), stylesOffset);
      const temp = document.createTextNode("");
      parent.appendChild(temp);
      result = morph(temp, next, dispatch);
    }
    if (key === "0") {
      root = result;
    }
  }
  for (const removed of diff2[1]) {
    const key = removed[0].split("-");
    const deletedNode = getDeepChild(rootParent, key, stylesOffset);
    deletedNode.remove();
  }
  for (const updated of diff2[2]) {
    const key = updated[0].split("-");
    const patches = updated[1];
    const prev = getDeepChild(rootParent, key, stylesOffset);
    const handlersForEl = registeredHandlers.get(prev);
    const delegated = [];
    for (const created of patches[0]) {
      const name = created[0];
      const value = created[1];
      if (name.startsWith("data-lustre-on-")) {
        const eventName = name.slice(15);
        const callback = dispatch(lustreServerEventHandler);
        if (!handlersForEl.has(eventName)) {
          prev.addEventListener(eventName, lustreGenericEventHandler);
        }
        handlersForEl.set(eventName, callback);
        prev.setAttribute(name, value);
      } else if ((name.startsWith("delegate:data-") || name.startsWith("delegate:aria-")) && prev instanceof HTMLSlotElement) {
        delegated.push([name.slice(10), value]);
      } else {
        prev.setAttribute(name, value);
        if (name === "value" || name === "selected") {
          prev[name] = value;
        }
      }
      if (delegated.length > 0) {
        for (const child of prev.assignedElements()) {
          for (const [name2, value2] of delegated) {
            child[name2] = value2;
          }
        }
      }
    }
    for (const removed of patches[1]) {
      if (removed.startsWith("data-lustre-on-")) {
        const eventName = removed.slice(15);
        prev.removeEventListener(eventName, lustreGenericEventHandler);
        handlersForEl.delete(eventName);
      } else {
        prev.removeAttribute(removed);
      }
    }
  }
  return root;
}
function createElementNode({ prev, next, dispatch, stack }) {
  const namespace = next.namespace || "http://www.w3.org/1999/xhtml";
  const canMorph = prev && prev.nodeType === Node.ELEMENT_NODE && prev.localName === next.tag && prev.namespaceURI === (next.namespace || "http://www.w3.org/1999/xhtml");
  const el = canMorph ? prev : namespace ? document.createElementNS(namespace, next.tag) : document.createElement(next.tag);
  let handlersForEl;
  if (!registeredHandlers.has(el)) {
    const emptyHandlers = /* @__PURE__ */ new Map();
    registeredHandlers.set(el, emptyHandlers);
    handlersForEl = emptyHandlers;
  } else {
    handlersForEl = registeredHandlers.get(el);
  }
  const prevHandlers = canMorph ? new Set(handlersForEl.keys()) : null;
  const prevAttributes = canMorph ? new Set(Array.from(prev.attributes, (a) => a.name)) : null;
  let className = null;
  let style = null;
  let innerHTML = null;
  if (canMorph && next.tag === "textarea") {
    const innertText = next.children[Symbol.iterator]().next().value?.content;
    if (innertText !== void 0)
      el.value = innertText;
  }
  const delegated = [];
  for (const attr of next.attrs) {
    const name = attr[0];
    const value = attr[1];
    if (attr.as_property) {
      if (el[name] !== value)
        el[name] = value;
      if (canMorph)
        prevAttributes.delete(name);
    } else if (name.startsWith("on")) {
      const eventName = name.slice(2);
      const callback = dispatch(value, eventName === "input");
      if (!handlersForEl.has(eventName)) {
        el.addEventListener(eventName, lustreGenericEventHandler);
      }
      handlersForEl.set(eventName, callback);
      if (canMorph)
        prevHandlers.delete(eventName);
    } else if (name.startsWith("data-lustre-on-")) {
      const eventName = name.slice(15);
      const callback = dispatch(lustreServerEventHandler);
      if (!handlersForEl.has(eventName)) {
        el.addEventListener(eventName, lustreGenericEventHandler);
      }
      handlersForEl.set(eventName, callback);
      el.setAttribute(name, value);
    } else if (name.startsWith("delegate:data-") || name.startsWith("delegate:aria-")) {
      el.setAttribute(name, value);
      delegated.push([name.slice(10), value]);
    } else if (name === "class") {
      className = className === null ? value : className + " " + value;
    } else if (name === "style") {
      style = style === null ? value : style + value;
    } else if (name === "dangerous-unescaped-html") {
      innerHTML = value;
    } else {
      if (el.getAttribute(name) !== value)
        el.setAttribute(name, value);
      if (name === "value" || name === "selected")
        el[name] = value;
      if (canMorph)
        prevAttributes.delete(name);
    }
  }
  if (className !== null) {
    el.setAttribute("class", className);
    if (canMorph)
      prevAttributes.delete("class");
  }
  if (style !== null) {
    el.setAttribute("style", style);
    if (canMorph)
      prevAttributes.delete("style");
  }
  if (canMorph) {
    for (const attr of prevAttributes) {
      el.removeAttribute(attr);
    }
    for (const eventName of prevHandlers) {
      handlersForEl.delete(eventName);
      el.removeEventListener(eventName, lustreGenericEventHandler);
    }
  }
  if (next.tag === "slot") {
    window.queueMicrotask(() => {
      for (const child of el.assignedElements()) {
        for (const [name, value] of delegated) {
          if (!child.hasAttribute(name)) {
            child.setAttribute(name, value);
          }
        }
      }
    });
  }
  if (next.key !== void 0 && next.key !== "") {
    el.setAttribute("data-lustre-key", next.key);
  } else if (innerHTML !== null) {
    el.innerHTML = innerHTML;
    return el;
  }
  let prevChild = el.firstChild;
  let seenKeys = null;
  let keyedChildren = null;
  let incomingKeyedChildren = null;
  let firstChild = children(next).next().value;
  if (canMorph && firstChild !== void 0 && // Explicit checks are more verbose but truthy checks force a bunch of comparisons
  // we don't care about: it's never gonna be a number etc.
  firstChild.key !== void 0 && firstChild.key !== "") {
    seenKeys = /* @__PURE__ */ new Set();
    keyedChildren = getKeyedChildren(prev);
    incomingKeyedChildren = getKeyedChildren(next);
    for (const child of children(next)) {
      prevChild = diffKeyedChild(
        prevChild,
        child,
        el,
        stack,
        incomingKeyedChildren,
        keyedChildren,
        seenKeys
      );
    }
  } else {
    for (const child of children(next)) {
      stack.unshift({ prev: prevChild, next: child, parent: el });
      prevChild = prevChild?.nextSibling;
    }
  }
  while (prevChild) {
    const next2 = prevChild.nextSibling;
    el.removeChild(prevChild);
    prevChild = next2;
  }
  return el;
}
var registeredHandlers = /* @__PURE__ */ new WeakMap();
function lustreGenericEventHandler(event2) {
  const target = event2.currentTarget;
  if (!registeredHandlers.has(target)) {
    target.removeEventListener(event2.type, lustreGenericEventHandler);
    return;
  }
  const handlersForEventTarget = registeredHandlers.get(target);
  if (!handlersForEventTarget.has(event2.type)) {
    target.removeEventListener(event2.type, lustreGenericEventHandler);
    return;
  }
  handlersForEventTarget.get(event2.type)(event2);
}
function lustreServerEventHandler(event2) {
  const el = event2.currentTarget;
  const tag = el.getAttribute(`data-lustre-on-${event2.type}`);
  const data = JSON.parse(el.getAttribute("data-lustre-data") || "{}");
  const include = JSON.parse(el.getAttribute("data-lustre-include") || "[]");
  switch (event2.type) {
    case "input":
    case "change":
      include.push("target.value");
      break;
  }
  return {
    tag,
    data: include.reduce(
      (data2, property) => {
        const path = property.split(".");
        for (let i = 0, o = data2, e = event2; i < path.length; i++) {
          if (i === path.length - 1) {
            o[path[i]] = e[path[i]];
          } else {
            o[path[i]] ??= {};
            e = e[path[i]];
            o = o[path[i]];
          }
        }
        return data2;
      },
      { data }
    )
  };
}
function getKeyedChildren(el) {
  const keyedChildren = /* @__PURE__ */ new Map();
  if (el) {
    for (const child of children(el)) {
      const key = child?.key || child?.getAttribute?.("data-lustre-key");
      if (key)
        keyedChildren.set(key, child);
    }
  }
  return keyedChildren;
}
function getDeepChild(el, path, stylesOffset) {
  let n;
  let rest;
  let child = el;
  let isFirstInPath = true;
  while ([n, ...rest] = path, n !== void 0) {
    child = child.childNodes.item(isFirstInPath ? n + stylesOffset : n);
    isFirstInPath = false;
    path = rest;
  }
  return child;
}
function diffKeyedChild(prevChild, child, el, stack, incomingKeyedChildren, keyedChildren, seenKeys) {
  while (prevChild && !incomingKeyedChildren.has(prevChild.getAttribute("data-lustre-key"))) {
    const nextChild = prevChild.nextSibling;
    el.removeChild(prevChild);
    prevChild = nextChild;
  }
  if (keyedChildren.size === 0) {
    stack.unshift({ prev: prevChild, next: child, parent: el });
    prevChild = prevChild?.nextSibling;
    return prevChild;
  }
  if (seenKeys.has(child.key)) {
    console.warn(`Duplicate key found in Lustre vnode: ${child.key}`);
    stack.unshift({ prev: null, next: child, parent: el });
    return prevChild;
  }
  seenKeys.add(child.key);
  const keyedChild = keyedChildren.get(child.key);
  if (!keyedChild && !prevChild) {
    stack.unshift({ prev: null, next: child, parent: el });
    return prevChild;
  }
  if (!keyedChild && prevChild !== null) {
    const placeholder = document.createTextNode("");
    el.insertBefore(placeholder, prevChild);
    stack.unshift({ prev: placeholder, next: child, parent: el });
    return prevChild;
  }
  if (!keyedChild || keyedChild === prevChild) {
    stack.unshift({ prev: prevChild, next: child, parent: el });
    prevChild = prevChild?.nextSibling;
    return prevChild;
  }
  el.insertBefore(keyedChild, prevChild);
  stack.unshift({ prev: keyedChild, next: child, parent: el });
  return prevChild;
}
function* children(element) {
  for (const child of element.children) {
    yield* forceChild(child);
  }
}
function* forceChild(element) {
  if (element.subtree !== void 0) {
    yield* forceChild(element.subtree());
  } else {
    yield element;
  }
}

// build/dev/javascript/prelude.mjs
function isEqual(x, y) {
  let values = [x, y];
  while (values.length) {
    let a = values.pop();
    let b = values.pop();
    if (a === b)
      continue;
    if (!isObject(a) || !isObject(b))
      return false;
    let unequal = !structurallyCompatibleObjects(a, b) || unequalDates(a, b) || unequalBuffers(a, b) || unequalArrays(a, b) || unequalMaps(a, b) || unequalSets(a, b) || unequalRegExps(a, b);
    if (unequal)
      return false;
    const proto = Object.getPrototypeOf(a);
    if (proto !== null && typeof proto.equals === "function") {
      try {
        if (a.equals(b))
          continue;
        else
          return false;
      } catch {
      }
    }
    let [keys, get] = getters(a);
    for (let k of keys(a)) {
      values.push(get(a, k), get(b, k));
    }
  }
  return true;
}
function getters(object) {
  if (object instanceof Map) {
    return [(x) => x.keys(), (x, y) => x.get(y)];
  } else {
    let extra = object instanceof globalThis.Error ? ["message"] : [];
    return [(x) => [...extra, ...Object.keys(x)], (x, y) => x[y]];
  }
}
function unequalDates(a, b) {
  return a instanceof Date && (a > b || a < b);
}
function unequalBuffers(a, b) {
  return a.buffer instanceof ArrayBuffer && a.BYTES_PER_ELEMENT && !(a.byteLength === b.byteLength && a.every((n, i) => n === b[i]));
}
function unequalArrays(a, b) {
  return Array.isArray(a) && a.length !== b.length;
}
function unequalMaps(a, b) {
  return a instanceof Map && a.size !== b.size;
}
function unequalSets(a, b) {
  return a instanceof Set && (a.size != b.size || [...a].some((e) => !b.has(e)));
}
function unequalRegExps(a, b) {
  return a instanceof RegExp && (a.source !== b.source || a.flags !== b.flags);
}
function isObject(a) {
  return typeof a === "object" && a !== null;
}
function structurallyCompatibleObjects(a, b) {
  if (typeof a !== "object" && typeof b !== "object" && (!a || !b))
    return false;
  let nonstructural = [Promise, WeakSet, WeakMap, Function];
  if (nonstructural.some((c) => a instanceof c))
    return false;
  return a.constructor === b.constructor;
}

// src/server-component.mjs
var LustreServerComponent = class extends HTMLElement {
  static get observedAttributes() {
    return ["route"];
  }
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.#observer = new MutationObserver((mutations) => {
      const changed = [];
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          const { attributeName } = mutation;
          const next = this.getAttribute(attributeName);
          this[attributeName] = next;
        }
      }
      if (changed.length) {
        this.#socket?.send(JSON.stringify([attrs, changed]));
      }
    });
  }
  connectedCallback() {
    this.#observer.observe(this, { attributes: true, attributeOldValue: true });
    this.#adoptStyleSheets().finally(() => this.#connected = true);
  }
  attributeChangedCallback(name, prev, next) {
    switch (name) {
      case "route": {
        if (!next) {
          this.#socket?.close();
          this.#socket = null;
        } else if (prev !== next) {
          const id = this.getAttribute("id");
          const route = next + (id ? `?id=${id}` : "");
          const protocol = window.location.protocol === "https:" ? "wss" : "ws";
          this.#socket?.close();
          this.#socket = new WebSocket(
            `${protocol}://${window.location.host}${route}`
          );
          this.#socket.addEventListener(
            "message",
            (message) => this.messageReceivedCallback(message)
          );
        }
      }
    }
  }
  messageReceivedCallback({ data }) {
    const [kind, ...payload] = JSON.parse(data);
    switch (kind) {
      case diff:
        return this.#diff(payload);
      case emit:
        return this.#emit(payload);
      case init:
        return this.#init(payload);
    }
  }
  disconnectedCallback() {
    this.#socket?.close();
  }
  /** @type {MutationObserver} */
  #observer;
  /** @type {WebSocket | null} */
  #socket;
  /** @type {boolean} */
  #connected = false;
  /** @type {Element[]} */
  #adoptedStyleElements = [];
  #init([attrs2, vdom]) {
    const initial = [];
    for (const attr of attrs2) {
      if (attr in this) {
        initial.push([attr, this[attr]]);
      } else if (this.hasAttribute(attr)) {
        initial.push([attr, this.getAttribute(attr)]);
      }
      Object.defineProperty(this, attr, {
        get() {
          return this[`__mirrored__${attr}`];
        },
        set(value) {
          const prev2 = this[`__mirrored__${attr}`];
          if (isEqual(prev2, value))
            return;
          this[`__mirrored__${attr}`] = value;
          this.#socket?.send(
            JSON.stringify([attrs, [[attr, value]]])
          );
        }
      });
    }
    this.#observer.observe(this, {
      attributeFilter: attrs2,
      attributeOldValue: true,
      attributes: true,
      characterData: false,
      characterDataOldValue: false,
      childList: false,
      subtree: false
    });
    const prev = this.shadowRoot.childNodes[this.#adoptedStyleElements.lemgth] ?? this.shadowRoot.appendChild(document.createTextNode(""));
    const dispatch = (handler) => (event2) => {
      const data = JSON.parse(this.getAttribute("data-lustre-data") || "{}");
      const msg = handler(event2);
      msg.data = deep_merge(data, msg.data);
      this.#socket?.send(JSON.stringify([event, msg.tag, msg.data]));
    };
    morph(prev, vdom, dispatch);
    if (initial.length) {
      this.#socket?.send(JSON.stringify([attrs, initial]));
    }
  }
  #diff([diff2]) {
    const prev = this.shadowRoot.childNodes[this.#adoptedStyleElements.length - 1] ?? this.shadowRoot.appendChild(document.createTextNode(""));
    const dispatch = (handler) => (event2) => {
      const msg = handler(event2);
      this.#socket?.send(JSON.stringify([event, msg.tag, msg.data]));
    };
    patch(prev, diff2, dispatch, this.#adoptedStyleElements.length);
  }
  #emit([event2, data]) {
    this.dispatchEvent(new CustomEvent(event2, { detail: data }));
  }
  async #adoptStyleSheets() {
    const pendingParentStylesheets = [];
    for (const link of document.querySelectorAll("link[rel=stylesheet]")) {
      if (link.sheet)
        continue;
      pendingParentStylesheets.push(
        new Promise((resolve, reject) => {
          link.addEventListener("load", resolve);
          link.addEventListener("error", reject);
        })
      );
    }
    await Promise.allSettled(pendingParentStylesheets);
    while (this.#adoptedStyleElements.length) {
      this.#adoptedStyleElements.shift().remove();
      this.shadowRoot.firstChild.remove();
    }
    this.shadowRoot.adoptedStyleSheets = this.getRootNode().adoptedStyleSheets;
    const pending = [];
    for (const sheet of document.styleSheets) {
      try {
        this.shadowRoot.adoptedStyleSheets.push(sheet);
      } catch {
        try {
          const adoptedSheet = new CSSStyleSheet();
          for (const rule of sheet.cssRules) {
            adoptedSheet.insertRule(rule.cssText, adoptedSheet.cssRules.length);
          }
          this.shadowRoot.adoptedStyleSheets.push(adoptedSheet);
        } catch {
          const node = sheet.ownerNode.cloneNode();
          this.shadowRoot.prepend(node);
          this.#adoptedStyleElements.push(node);
          pending.push(
            new Promise((resolve, reject) => {
              node.onload = resolve;
              node.onerror = reject;
            })
          );
        }
      }
    }
    return Promise.allSettled(pending);
  }
};
window.customElements.define("lustre-server-component", LustreServerComponent);
var deep_merge = (target, source) => {
  for (const key in source) {
    if (source[key] instanceof Object)
      Object.assign(source[key], deep_merge(target[key], source[key]));
  }
  Object.assign(target || {}, source);
  return target;
};
export {
  LustreServerComponent
};
