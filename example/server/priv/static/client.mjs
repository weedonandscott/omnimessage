// build/dev/javascript/prelude.mjs
var CustomType = class {
  withFields(fields) {
    let properties = Object.keys(this).map(
      (label) => label in fields ? fields[label] : this[label]
    );
    return new this.constructor(...properties);
  }
};
var List = class {
  static fromArray(array3, tail) {
    let t = tail || new Empty();
    for (let i = array3.length - 1; i >= 0; --i) {
      t = new NonEmpty(array3[i], t);
    }
    return t;
  }
  [Symbol.iterator]() {
    return new ListIterator(this);
  }
  toArray() {
    return [...this];
  }
  // @internal
  atLeastLength(desired) {
    for (let _ of this) {
      if (desired <= 0)
        return true;
      desired--;
    }
    return desired <= 0;
  }
  // @internal
  hasLength(desired) {
    for (let _ of this) {
      if (desired <= 0)
        return false;
      desired--;
    }
    return desired === 0;
  }
  // @internal
  countLength() {
    let length5 = 0;
    for (let _ of this)
      length5++;
    return length5;
  }
};
function prepend(element3, tail) {
  return new NonEmpty(element3, tail);
}
function toList(elements2, tail) {
  return List.fromArray(elements2, tail);
}
var ListIterator = class {
  #current;
  constructor(current) {
    this.#current = current;
  }
  next() {
    if (this.#current instanceof Empty) {
      return { done: true };
    } else {
      let { head, tail } = this.#current;
      this.#current = tail;
      return { value: head, done: false };
    }
  }
};
var Empty = class extends List {
};
var NonEmpty = class extends List {
  constructor(head, tail) {
    super();
    this.head = head;
    this.tail = tail;
  }
};
var BitArray = class _BitArray {
  constructor(buffer) {
    if (!(buffer instanceof Uint8Array)) {
      throw "BitArray can only be constructed from a Uint8Array";
    }
    this.buffer = buffer;
  }
  // @internal
  get length() {
    return this.buffer.length;
  }
  // @internal
  byteAt(index4) {
    return this.buffer[index4];
  }
  // @internal
  floatFromSlice(start3, end, isBigEndian) {
    return byteArrayToFloat(this.buffer, start3, end, isBigEndian);
  }
  // @internal
  intFromSlice(start3, end, isBigEndian, isSigned) {
    return byteArrayToInt(this.buffer, start3, end, isBigEndian, isSigned);
  }
  // @internal
  binaryFromSlice(start3, end) {
    return new _BitArray(this.buffer.slice(start3, end));
  }
  // @internal
  sliceAfter(index4) {
    return new _BitArray(this.buffer.slice(index4));
  }
};
function byteArrayToInt(byteArray, start3, end, isBigEndian, isSigned) {
  let value4 = 0;
  if (isBigEndian) {
    for (let i = start3; i < end; i++) {
      value4 = value4 * 256 + byteArray[i];
    }
  } else {
    for (let i = end - 1; i >= start3; i--) {
      value4 = value4 * 256 + byteArray[i];
    }
  }
  if (isSigned) {
    const byteSize = end - start3;
    const highBit = 2 ** (byteSize * 8 - 1);
    if (value4 >= highBit) {
      value4 -= highBit * 2;
    }
  }
  return value4;
}
function byteArrayToFloat(byteArray, start3, end, isBigEndian) {
  const view2 = new DataView(byteArray.buffer);
  const byteSize = end - start3;
  if (byteSize === 8) {
    return view2.getFloat64(start3, !isBigEndian);
  } else if (byteSize === 4) {
    return view2.getFloat32(start3, !isBigEndian);
  } else {
    const msg = `Sized floats must be 32-bit or 64-bit on JavaScript, got size of ${byteSize * 8} bits`;
    throw new globalThis.Error(msg);
  }
}
var Result = class _Result extends CustomType {
  // @internal
  static isResult(data) {
    return data instanceof _Result;
  }
};
var Ok = class extends Result {
  constructor(value4) {
    super();
    this[0] = value4;
  }
  // @internal
  isOk() {
    return true;
  }
};
var Error = class extends Result {
  constructor(detail) {
    super();
    this[0] = detail;
  }
  // @internal
  isOk() {
    return false;
  }
};
function isEqual(x, y) {
  let values2 = [x, y];
  while (values2.length) {
    let a = values2.pop();
    let b = values2.pop();
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
    let [keys2, get2] = getters(a);
    for (let k of keys2(a)) {
      values2.push(get2(a, k), get2(b, k));
    }
  }
  return true;
}
function getters(object3) {
  if (object3 instanceof Map) {
    return [(x) => x.keys(), (x, y) => x.get(y)];
  } else {
    let extra = object3 instanceof globalThis.Error ? ["message"] : [];
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
function remainderInt(a, b) {
  if (b === 0) {
    return 0;
  } else {
    return a % b;
  }
}
function divideInt(a, b) {
  return Math.trunc(divideFloat(a, b));
}
function divideFloat(a, b) {
  if (b === 0) {
    return 0;
  } else {
    return a / b;
  }
}
function makeError(variant, module, line, fn, message, extra) {
  let error = new globalThis.Error(message);
  error.gleam_error = variant;
  error.module = module;
  error.line = line;
  error.function = fn;
  error.fn = fn;
  for (let k in extra)
    error[k] = extra[k];
  return error;
}

// build/dev/javascript/gleam_stdlib/gleam/option.mjs
var Some = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var None = class extends CustomType {
};
function to_result(option, e) {
  if (option instanceof Some) {
    let a = option[0];
    return new Ok(a);
  } else {
    return new Error(e);
  }
}
function from_result(result) {
  if (result.isOk()) {
    let a = result[0];
    return new Some(a);
  } else {
    return new None();
  }
}
function unwrap(option, default$) {
  if (option instanceof Some) {
    let x = option[0];
    return x;
  } else {
    return default$;
  }
}
function map(option, fun) {
  if (option instanceof Some) {
    let x = option[0];
    return new Some(fun(x));
  } else {
    return new None();
  }
}
function or(first4, second2) {
  if (first4 instanceof Some) {
    return first4;
  } else {
    return second2;
  }
}

// build/dev/javascript/gleam_stdlib/gleam/regex.mjs
var Match = class extends CustomType {
  constructor(content, submatches) {
    super();
    this.content = content;
    this.submatches = submatches;
  }
};
var CompileError = class extends CustomType {
  constructor(error, byte_index) {
    super();
    this.error = error;
    this.byte_index = byte_index;
  }
};
var Options = class extends CustomType {
  constructor(case_insensitive, multi_line) {
    super();
    this.case_insensitive = case_insensitive;
    this.multi_line = multi_line;
  }
};
function compile(pattern, options) {
  return compile_regex(pattern, options);
}
function scan(regex, string4) {
  return regex_scan(regex, string4);
}

// build/dev/javascript/gleam_stdlib/gleam/order.mjs
var Lt = class extends CustomType {
};
var Eq = class extends CustomType {
};
var Gt = class extends CustomType {
};

// build/dev/javascript/gleam_stdlib/gleam/float.mjs
function floor2(x) {
  return floor(x);
}
function negate(x) {
  return -1 * x;
}
function do_round(x) {
  let $ = x >= 0;
  if ($) {
    return round(x);
  } else {
    return 0 - round(negate(x));
  }
}
function round2(x) {
  return do_round(x);
}

// build/dev/javascript/gleam_stdlib/gleam/int.mjs
function parse(string4) {
  return parse_int(string4);
}
function to_string2(x) {
  return to_string(x);
}
function to_base16(x) {
  return int_to_base_string(x, 16);
}
function to_float(x) {
  return identity(x);
}
function random(max) {
  let _pipe = random_uniform() * to_float(max);
  let _pipe$1 = floor2(_pipe);
  return round2(_pipe$1);
}

// build/dev/javascript/gleam_stdlib/gleam/pair.mjs
function second(pair) {
  let a = pair[1];
  return a;
}

// build/dev/javascript/gleam_stdlib/gleam/list.mjs
var Ascending = class extends CustomType {
};
var Descending = class extends CustomType {
};
function length_loop(loop$list, loop$count) {
  while (true) {
    let list4 = loop$list;
    let count = loop$count;
    if (list4.atLeastLength(1)) {
      let list$1 = list4.tail;
      loop$list = list$1;
      loop$count = count + 1;
    } else {
      return count;
    }
  }
}
function length(list4) {
  return length_loop(list4, 0);
}
function reverse_loop(loop$remaining, loop$accumulator) {
  while (true) {
    let remaining = loop$remaining;
    let accumulator = loop$accumulator;
    if (remaining.hasLength(0)) {
      return accumulator;
    } else {
      let item = remaining.head;
      let rest$1 = remaining.tail;
      loop$remaining = rest$1;
      loop$accumulator = prepend(item, accumulator);
    }
  }
}
function reverse(list4) {
  return reverse_loop(list4, toList([]));
}
function first(list4) {
  if (list4.hasLength(0)) {
    return new Error(void 0);
  } else {
    let x = list4.head;
    return new Ok(x);
  }
}
function map_loop(loop$list, loop$fun, loop$acc) {
  while (true) {
    let list4 = loop$list;
    let fun = loop$fun;
    let acc = loop$acc;
    if (list4.hasLength(0)) {
      return reverse(acc);
    } else {
      let first$1 = list4.head;
      let rest$1 = list4.tail;
      loop$list = rest$1;
      loop$fun = fun;
      loop$acc = prepend(fun(first$1), acc);
    }
  }
}
function map2(list4, fun) {
  return map_loop(list4, fun, toList([]));
}
function take_loop(loop$list, loop$n, loop$acc) {
  while (true) {
    let list4 = loop$list;
    let n = loop$n;
    let acc = loop$acc;
    let $ = n <= 0;
    if ($) {
      return reverse(acc);
    } else {
      if (list4.hasLength(0)) {
        return reverse(acc);
      } else {
        let first$1 = list4.head;
        let rest$1 = list4.tail;
        loop$list = rest$1;
        loop$n = n - 1;
        loop$acc = prepend(first$1, acc);
      }
    }
  }
}
function take(list4, n) {
  return take_loop(list4, n, toList([]));
}
function append_loop(loop$first, loop$second) {
  while (true) {
    let first4 = loop$first;
    let second2 = loop$second;
    if (first4.hasLength(0)) {
      return second2;
    } else {
      let item = first4.head;
      let rest$1 = first4.tail;
      loop$first = rest$1;
      loop$second = prepend(item, second2);
    }
  }
}
function append(first4, second2) {
  return append_loop(reverse(first4), second2);
}
function fold(loop$list, loop$initial, loop$fun) {
  while (true) {
    let list4 = loop$list;
    let initial = loop$initial;
    let fun = loop$fun;
    if (list4.hasLength(0)) {
      return initial;
    } else {
      let x = list4.head;
      let rest$1 = list4.tail;
      loop$list = rest$1;
      loop$initial = fun(initial, x);
      loop$fun = fun;
    }
  }
}
function index_fold_loop(loop$over, loop$acc, loop$with, loop$index) {
  while (true) {
    let over = loop$over;
    let acc = loop$acc;
    let with$ = loop$with;
    let index4 = loop$index;
    if (over.hasLength(0)) {
      return acc;
    } else {
      let first$1 = over.head;
      let rest$1 = over.tail;
      loop$over = rest$1;
      loop$acc = with$(acc, first$1, index4);
      loop$with = with$;
      loop$index = index4 + 1;
    }
  }
}
function index_fold(list4, initial, fun) {
  return index_fold_loop(list4, initial, fun, 0);
}
function sequences(loop$list, loop$compare, loop$growing, loop$direction, loop$prev, loop$acc) {
  while (true) {
    let list4 = loop$list;
    let compare4 = loop$compare;
    let growing = loop$growing;
    let direction = loop$direction;
    let prev = loop$prev;
    let acc = loop$acc;
    let growing$1 = prepend(prev, growing);
    if (list4.hasLength(0)) {
      if (direction instanceof Ascending) {
        return prepend(reverse_loop(growing$1, toList([])), acc);
      } else {
        return prepend(growing$1, acc);
      }
    } else {
      let new$1 = list4.head;
      let rest$1 = list4.tail;
      let $ = compare4(prev, new$1);
      if ($ instanceof Gt && direction instanceof Descending) {
        loop$list = rest$1;
        loop$compare = compare4;
        loop$growing = growing$1;
        loop$direction = direction;
        loop$prev = new$1;
        loop$acc = acc;
      } else if ($ instanceof Lt && direction instanceof Ascending) {
        loop$list = rest$1;
        loop$compare = compare4;
        loop$growing = growing$1;
        loop$direction = direction;
        loop$prev = new$1;
        loop$acc = acc;
      } else if ($ instanceof Eq && direction instanceof Ascending) {
        loop$list = rest$1;
        loop$compare = compare4;
        loop$growing = growing$1;
        loop$direction = direction;
        loop$prev = new$1;
        loop$acc = acc;
      } else if ($ instanceof Gt && direction instanceof Ascending) {
        let acc$1 = (() => {
          if (direction instanceof Ascending) {
            return prepend(reverse_loop(growing$1, toList([])), acc);
          } else {
            return prepend(growing$1, acc);
          }
        })();
        if (rest$1.hasLength(0)) {
          return prepend(toList([new$1]), acc$1);
        } else {
          let next = rest$1.head;
          let rest$2 = rest$1.tail;
          let direction$1 = (() => {
            let $1 = compare4(new$1, next);
            if ($1 instanceof Lt) {
              return new Ascending();
            } else if ($1 instanceof Eq) {
              return new Ascending();
            } else {
              return new Descending();
            }
          })();
          loop$list = rest$2;
          loop$compare = compare4;
          loop$growing = toList([new$1]);
          loop$direction = direction$1;
          loop$prev = next;
          loop$acc = acc$1;
        }
      } else if ($ instanceof Lt && direction instanceof Descending) {
        let acc$1 = (() => {
          if (direction instanceof Ascending) {
            return prepend(reverse_loop(growing$1, toList([])), acc);
          } else {
            return prepend(growing$1, acc);
          }
        })();
        if (rest$1.hasLength(0)) {
          return prepend(toList([new$1]), acc$1);
        } else {
          let next = rest$1.head;
          let rest$2 = rest$1.tail;
          let direction$1 = (() => {
            let $1 = compare4(new$1, next);
            if ($1 instanceof Lt) {
              return new Ascending();
            } else if ($1 instanceof Eq) {
              return new Ascending();
            } else {
              return new Descending();
            }
          })();
          loop$list = rest$2;
          loop$compare = compare4;
          loop$growing = toList([new$1]);
          loop$direction = direction$1;
          loop$prev = next;
          loop$acc = acc$1;
        }
      } else {
        let acc$1 = (() => {
          if (direction instanceof Ascending) {
            return prepend(reverse_loop(growing$1, toList([])), acc);
          } else {
            return prepend(growing$1, acc);
          }
        })();
        if (rest$1.hasLength(0)) {
          return prepend(toList([new$1]), acc$1);
        } else {
          let next = rest$1.head;
          let rest$2 = rest$1.tail;
          let direction$1 = (() => {
            let $1 = compare4(new$1, next);
            if ($1 instanceof Lt) {
              return new Ascending();
            } else if ($1 instanceof Eq) {
              return new Ascending();
            } else {
              return new Descending();
            }
          })();
          loop$list = rest$2;
          loop$compare = compare4;
          loop$growing = toList([new$1]);
          loop$direction = direction$1;
          loop$prev = next;
          loop$acc = acc$1;
        }
      }
    }
  }
}
function merge_ascendings(loop$list1, loop$list2, loop$compare, loop$acc) {
  while (true) {
    let list1 = loop$list1;
    let list22 = loop$list2;
    let compare4 = loop$compare;
    let acc = loop$acc;
    if (list1.hasLength(0)) {
      let list4 = list22;
      return reverse_loop(list4, acc);
    } else if (list22.hasLength(0)) {
      let list4 = list1;
      return reverse_loop(list4, acc);
    } else {
      let first1 = list1.head;
      let rest1 = list1.tail;
      let first22 = list22.head;
      let rest2 = list22.tail;
      let $ = compare4(first1, first22);
      if ($ instanceof Lt) {
        loop$list1 = rest1;
        loop$list2 = list22;
        loop$compare = compare4;
        loop$acc = prepend(first1, acc);
      } else if ($ instanceof Gt) {
        loop$list1 = list1;
        loop$list2 = rest2;
        loop$compare = compare4;
        loop$acc = prepend(first22, acc);
      } else {
        loop$list1 = list1;
        loop$list2 = rest2;
        loop$compare = compare4;
        loop$acc = prepend(first22, acc);
      }
    }
  }
}
function merge_ascending_pairs(loop$sequences, loop$compare, loop$acc) {
  while (true) {
    let sequences2 = loop$sequences;
    let compare4 = loop$compare;
    let acc = loop$acc;
    if (sequences2.hasLength(0)) {
      return reverse_loop(acc, toList([]));
    } else if (sequences2.hasLength(1)) {
      let sequence = sequences2.head;
      return reverse_loop(
        prepend(reverse_loop(sequence, toList([])), acc),
        toList([])
      );
    } else {
      let ascending1 = sequences2.head;
      let ascending2 = sequences2.tail.head;
      let rest$1 = sequences2.tail.tail;
      let descending = merge_ascendings(
        ascending1,
        ascending2,
        compare4,
        toList([])
      );
      loop$sequences = rest$1;
      loop$compare = compare4;
      loop$acc = prepend(descending, acc);
    }
  }
}
function merge_descendings(loop$list1, loop$list2, loop$compare, loop$acc) {
  while (true) {
    let list1 = loop$list1;
    let list22 = loop$list2;
    let compare4 = loop$compare;
    let acc = loop$acc;
    if (list1.hasLength(0)) {
      let list4 = list22;
      return reverse_loop(list4, acc);
    } else if (list22.hasLength(0)) {
      let list4 = list1;
      return reverse_loop(list4, acc);
    } else {
      let first1 = list1.head;
      let rest1 = list1.tail;
      let first22 = list22.head;
      let rest2 = list22.tail;
      let $ = compare4(first1, first22);
      if ($ instanceof Lt) {
        loop$list1 = list1;
        loop$list2 = rest2;
        loop$compare = compare4;
        loop$acc = prepend(first22, acc);
      } else if ($ instanceof Gt) {
        loop$list1 = rest1;
        loop$list2 = list22;
        loop$compare = compare4;
        loop$acc = prepend(first1, acc);
      } else {
        loop$list1 = rest1;
        loop$list2 = list22;
        loop$compare = compare4;
        loop$acc = prepend(first1, acc);
      }
    }
  }
}
function merge_descending_pairs(loop$sequences, loop$compare, loop$acc) {
  while (true) {
    let sequences2 = loop$sequences;
    let compare4 = loop$compare;
    let acc = loop$acc;
    if (sequences2.hasLength(0)) {
      return reverse_loop(acc, toList([]));
    } else if (sequences2.hasLength(1)) {
      let sequence = sequences2.head;
      return reverse_loop(
        prepend(reverse_loop(sequence, toList([])), acc),
        toList([])
      );
    } else {
      let descending1 = sequences2.head;
      let descending2 = sequences2.tail.head;
      let rest$1 = sequences2.tail.tail;
      let ascending = merge_descendings(
        descending1,
        descending2,
        compare4,
        toList([])
      );
      loop$sequences = rest$1;
      loop$compare = compare4;
      loop$acc = prepend(ascending, acc);
    }
  }
}
function merge_all(loop$sequences, loop$direction, loop$compare) {
  while (true) {
    let sequences2 = loop$sequences;
    let direction = loop$direction;
    let compare4 = loop$compare;
    if (sequences2.hasLength(0)) {
      return toList([]);
    } else if (sequences2.hasLength(1) && direction instanceof Ascending) {
      let sequence = sequences2.head;
      return sequence;
    } else if (sequences2.hasLength(1) && direction instanceof Descending) {
      let sequence = sequences2.head;
      return reverse_loop(sequence, toList([]));
    } else if (direction instanceof Ascending) {
      let sequences$1 = merge_ascending_pairs(sequences2, compare4, toList([]));
      loop$sequences = sequences$1;
      loop$direction = new Descending();
      loop$compare = compare4;
    } else {
      let sequences$1 = merge_descending_pairs(sequences2, compare4, toList([]));
      loop$sequences = sequences$1;
      loop$direction = new Ascending();
      loop$compare = compare4;
    }
  }
}
function sort(list4, compare4) {
  if (list4.hasLength(0)) {
    return toList([]);
  } else if (list4.hasLength(1)) {
    let x = list4.head;
    return toList([x]);
  } else {
    let x = list4.head;
    let y = list4.tail.head;
    let rest$1 = list4.tail.tail;
    let direction = (() => {
      let $ = compare4(x, y);
      if ($ instanceof Lt) {
        return new Ascending();
      } else if ($ instanceof Eq) {
        return new Ascending();
      } else {
        return new Descending();
      }
    })();
    let sequences$1 = sequences(
      rest$1,
      compare4,
      toList([x]),
      direction,
      y,
      toList([])
    );
    return merge_all(sequences$1, new Ascending(), compare4);
  }
}
function repeat_loop(loop$item, loop$times, loop$acc) {
  while (true) {
    let item = loop$item;
    let times = loop$times;
    let acc = loop$acc;
    let $ = times <= 0;
    if ($) {
      return acc;
    } else {
      loop$item = item;
      loop$times = times - 1;
      loop$acc = prepend(item, acc);
    }
  }
}
function repeat(a, times) {
  return repeat_loop(a, times, toList([]));
}

// build/dev/javascript/gleam_stdlib/gleam/string_tree.mjs
function from_strings(strings) {
  return concat(strings);
}
function from_string(string4) {
  return identity(string4);
}
function to_string3(tree) {
  return identity(tree);
}
function split2(tree, pattern) {
  return split(tree, pattern);
}

// build/dev/javascript/gleam_stdlib/gleam/string.mjs
function is_empty(str) {
  return str === "";
}
function length3(string4) {
  return string_length(string4);
}
function lowercase2(string4) {
  return lowercase(string4);
}
function slice(string4, idx, len) {
  let $ = len < 0;
  if ($) {
    return "";
  } else {
    let $1 = idx < 0;
    if ($1) {
      let translated_idx = length3(string4) + idx;
      let $2 = translated_idx < 0;
      if ($2) {
        return "";
      } else {
        return string_slice(string4, translated_idx, len);
      }
    } else {
      return string_slice(string4, idx, len);
    }
  }
}
function drop_start(string4, num_graphemes) {
  let $ = num_graphemes < 0;
  if ($) {
    return string4;
  } else {
    return slice(string4, num_graphemes, length3(string4) - num_graphemes);
  }
}
function drop_left(string4, num_graphemes) {
  return drop_start(string4, num_graphemes);
}
function starts_with2(string4, prefix) {
  return starts_with(string4, prefix);
}
function concat2(strings) {
  let _pipe = strings;
  let _pipe$1 = from_strings(_pipe);
  return to_string3(_pipe$1);
}
function repeat_loop2(loop$string, loop$times, loop$acc) {
  while (true) {
    let string4 = loop$string;
    let times = loop$times;
    let acc = loop$acc;
    let $ = times <= 0;
    if ($) {
      return acc;
    } else {
      loop$string = string4;
      loop$times = times - 1;
      loop$acc = acc + string4;
    }
  }
}
function repeat2(string4, times) {
  return repeat_loop2(string4, times, "");
}
function join2(strings, separator) {
  return join(strings, separator);
}
function padding(size, pad_string) {
  let pad_string_length = length3(pad_string);
  let num_pads = divideInt(size, pad_string_length);
  let extra = remainderInt(size, pad_string_length);
  return repeat2(pad_string, num_pads) + slice(pad_string, 0, extra);
}
function pad_start(string4, desired_length, pad_string) {
  let current_length = length3(string4);
  let to_pad_length = desired_length - current_length;
  let $ = to_pad_length <= 0;
  if ($) {
    return string4;
  } else {
    return padding(to_pad_length, pad_string) + string4;
  }
}
function pad_left(string4, desired_length, pad_string) {
  return pad_start(string4, desired_length, pad_string);
}
function trim2(string4) {
  return trim(string4);
}
function pop_grapheme2(string4) {
  return pop_grapheme(string4);
}
function split3(x, substring) {
  if (substring === "") {
    return graphemes(x);
  } else {
    let _pipe = x;
    let _pipe$1 = from_string(_pipe);
    let _pipe$2 = split2(_pipe$1, substring);
    return map2(_pipe$2, to_string3);
  }
}

// build/dev/javascript/gleam_stdlib/gleam/result.mjs
function map3(result, fun) {
  if (result.isOk()) {
    let x = result[0];
    return new Ok(fun(x));
  } else {
    let e = result[0];
    return new Error(e);
  }
}
function map_error(result, fun) {
  if (result.isOk()) {
    let x = result[0];
    return new Ok(x);
  } else {
    let error = result[0];
    return new Error(fun(error));
  }
}
function try$(result, fun) {
  if (result.isOk()) {
    let x = result[0];
    return fun(x);
  } else {
    let e = result[0];
    return new Error(e);
  }
}
function then$(result, fun) {
  return try$(result, fun);
}
function unwrap2(result, default$) {
  if (result.isOk()) {
    let v = result[0];
    return v;
  } else {
    return default$;
  }
}
function replace_error(result, error) {
  if (result.isOk()) {
    let x = result[0];
    return new Ok(x);
  } else {
    return new Error(error);
  }
}

// build/dev/javascript/gleam_stdlib/gleam/dynamic.mjs
var DecodeError = class extends CustomType {
  constructor(expected, found, path) {
    super();
    this.expected = expected;
    this.found = found;
    this.path = path;
  }
};
function classify(data) {
  return classify_dynamic(data);
}
function int(data) {
  return decode_int(data);
}
function any(decoders) {
  return (data) => {
    if (decoders.hasLength(0)) {
      return new Error(
        toList([new DecodeError("another type", classify(data), toList([]))])
      );
    } else {
      let decoder = decoders.head;
      let decoders$1 = decoders.tail;
      let $ = decoder(data);
      if ($.isOk()) {
        let decoded = $[0];
        return new Ok(decoded);
      } else {
        return any(decoders$1)(data);
      }
    }
  };
}
function push_path(error, name) {
  let name$1 = identity(name);
  let decoder = any(
    toList([string, (x) => {
      return map3(int(x), to_string2);
    }])
  );
  let name$2 = (() => {
    let $ = decoder(name$1);
    if ($.isOk()) {
      let name$22 = $[0];
      return name$22;
    } else {
      let _pipe = toList(["<", classify(name$1), ">"]);
      let _pipe$1 = from_strings(_pipe);
      return to_string3(_pipe$1);
    }
  })();
  return error.withFields({ path: prepend(name$2, error.path) });
}
function map_errors(result, f) {
  return map_error(
    result,
    (_capture) => {
      return map2(_capture, f);
    }
  );
}
function string(data) {
  return decode_string(data);
}
function field(name, inner_type) {
  return (value4) => {
    let missing_field_error = new DecodeError("field", "nothing", toList([]));
    return try$(
      decode_field(value4, name),
      (maybe_inner) => {
        let _pipe = maybe_inner;
        let _pipe$1 = to_result(_pipe, toList([missing_field_error]));
        let _pipe$2 = try$(_pipe$1, inner_type);
        return map_errors(
          _pipe$2,
          (_capture) => {
            return push_path(_capture, name);
          }
        );
      }
    );
  };
}

// build/dev/javascript/gleam_stdlib/dict.mjs
var referenceMap = /* @__PURE__ */ new WeakMap();
var tempDataView = new DataView(new ArrayBuffer(8));
var referenceUID = 0;
function hashByReference(o) {
  const known = referenceMap.get(o);
  if (known !== void 0) {
    return known;
  }
  const hash = referenceUID++;
  if (referenceUID === 2147483647) {
    referenceUID = 0;
  }
  referenceMap.set(o, hash);
  return hash;
}
function hashMerge(a, b) {
  return a ^ b + 2654435769 + (a << 6) + (a >> 2) | 0;
}
function hashString(s) {
  let hash = 0;
  const len = s.length;
  for (let i = 0; i < len; i++) {
    hash = Math.imul(31, hash) + s.charCodeAt(i) | 0;
  }
  return hash;
}
function hashNumber(n) {
  tempDataView.setFloat64(0, n);
  const i = tempDataView.getInt32(0);
  const j = tempDataView.getInt32(4);
  return Math.imul(73244475, i >> 16 ^ i) ^ j;
}
function hashBigInt(n) {
  return hashString(n.toString());
}
function hashObject(o) {
  const proto = Object.getPrototypeOf(o);
  if (proto !== null && typeof proto.hashCode === "function") {
    try {
      const code2 = o.hashCode(o);
      if (typeof code2 === "number") {
        return code2;
      }
    } catch {
    }
  }
  if (o instanceof Promise || o instanceof WeakSet || o instanceof WeakMap) {
    return hashByReference(o);
  }
  if (o instanceof Date) {
    return hashNumber(o.getTime());
  }
  let h = 0;
  if (o instanceof ArrayBuffer) {
    o = new Uint8Array(o);
  }
  if (Array.isArray(o) || o instanceof Uint8Array) {
    for (let i = 0; i < o.length; i++) {
      h = Math.imul(31, h) + getHash(o[i]) | 0;
    }
  } else if (o instanceof Set) {
    o.forEach((v) => {
      h = h + getHash(v) | 0;
    });
  } else if (o instanceof Map) {
    o.forEach((v, k) => {
      h = h + hashMerge(getHash(v), getHash(k)) | 0;
    });
  } else {
    const keys2 = Object.keys(o);
    for (let i = 0; i < keys2.length; i++) {
      const k = keys2[i];
      const v = o[k];
      h = h + hashMerge(getHash(v), hashString(k)) | 0;
    }
  }
  return h;
}
function getHash(u) {
  if (u === null)
    return 1108378658;
  if (u === void 0)
    return 1108378659;
  if (u === true)
    return 1108378657;
  if (u === false)
    return 1108378656;
  switch (typeof u) {
    case "number":
      return hashNumber(u);
    case "string":
      return hashString(u);
    case "bigint":
      return hashBigInt(u);
    case "object":
      return hashObject(u);
    case "symbol":
      return hashByReference(u);
    case "function":
      return hashByReference(u);
    default:
      return 0;
  }
}
var SHIFT = 5;
var BUCKET_SIZE = Math.pow(2, SHIFT);
var MASK = BUCKET_SIZE - 1;
var MAX_INDEX_NODE = BUCKET_SIZE / 2;
var MIN_ARRAY_NODE = BUCKET_SIZE / 4;
var ENTRY = 0;
var ARRAY_NODE = 1;
var INDEX_NODE = 2;
var COLLISION_NODE = 3;
var EMPTY = {
  type: INDEX_NODE,
  bitmap: 0,
  array: []
};
function mask(hash, shift) {
  return hash >>> shift & MASK;
}
function bitpos(hash, shift) {
  return 1 << mask(hash, shift);
}
function bitcount(x) {
  x -= x >> 1 & 1431655765;
  x = (x & 858993459) + (x >> 2 & 858993459);
  x = x + (x >> 4) & 252645135;
  x += x >> 8;
  x += x >> 16;
  return x & 127;
}
function index(bitmap, bit) {
  return bitcount(bitmap & bit - 1);
}
function cloneAndSet(arr, at, val) {
  const len = arr.length;
  const out = new Array(len);
  for (let i = 0; i < len; ++i) {
    out[i] = arr[i];
  }
  out[at] = val;
  return out;
}
function spliceIn(arr, at, val) {
  const len = arr.length;
  const out = new Array(len + 1);
  let i = 0;
  let g = 0;
  while (i < at) {
    out[g++] = arr[i++];
  }
  out[g++] = val;
  while (i < len) {
    out[g++] = arr[i++];
  }
  return out;
}
function spliceOut(arr, at) {
  const len = arr.length;
  const out = new Array(len - 1);
  let i = 0;
  let g = 0;
  while (i < at) {
    out[g++] = arr[i++];
  }
  ++i;
  while (i < len) {
    out[g++] = arr[i++];
  }
  return out;
}
function createNode(shift, key1, val1, key2hash, key2, val2) {
  const key1hash = getHash(key1);
  if (key1hash === key2hash) {
    return {
      type: COLLISION_NODE,
      hash: key1hash,
      array: [
        { type: ENTRY, k: key1, v: val1 },
        { type: ENTRY, k: key2, v: val2 }
      ]
    };
  }
  const addedLeaf = { val: false };
  return assoc(
    assocIndex(EMPTY, shift, key1hash, key1, val1, addedLeaf),
    shift,
    key2hash,
    key2,
    val2,
    addedLeaf
  );
}
function assoc(root, shift, hash, key2, val, addedLeaf) {
  switch (root.type) {
    case ARRAY_NODE:
      return assocArray(root, shift, hash, key2, val, addedLeaf);
    case INDEX_NODE:
      return assocIndex(root, shift, hash, key2, val, addedLeaf);
    case COLLISION_NODE:
      return assocCollision(root, shift, hash, key2, val, addedLeaf);
  }
}
function assocArray(root, shift, hash, key2, val, addedLeaf) {
  const idx = mask(hash, shift);
  const node = root.array[idx];
  if (node === void 0) {
    addedLeaf.val = true;
    return {
      type: ARRAY_NODE,
      size: root.size + 1,
      array: cloneAndSet(root.array, idx, { type: ENTRY, k: key2, v: val })
    };
  }
  if (node.type === ENTRY) {
    if (isEqual(key2, node.k)) {
      if (val === node.v) {
        return root;
      }
      return {
        type: ARRAY_NODE,
        size: root.size,
        array: cloneAndSet(root.array, idx, {
          type: ENTRY,
          k: key2,
          v: val
        })
      };
    }
    addedLeaf.val = true;
    return {
      type: ARRAY_NODE,
      size: root.size,
      array: cloneAndSet(
        root.array,
        idx,
        createNode(shift + SHIFT, node.k, node.v, hash, key2, val)
      )
    };
  }
  const n = assoc(node, shift + SHIFT, hash, key2, val, addedLeaf);
  if (n === node) {
    return root;
  }
  return {
    type: ARRAY_NODE,
    size: root.size,
    array: cloneAndSet(root.array, idx, n)
  };
}
function assocIndex(root, shift, hash, key2, val, addedLeaf) {
  const bit = bitpos(hash, shift);
  const idx = index(root.bitmap, bit);
  if ((root.bitmap & bit) !== 0) {
    const node = root.array[idx];
    if (node.type !== ENTRY) {
      const n = assoc(node, shift + SHIFT, hash, key2, val, addedLeaf);
      if (n === node) {
        return root;
      }
      return {
        type: INDEX_NODE,
        bitmap: root.bitmap,
        array: cloneAndSet(root.array, idx, n)
      };
    }
    const nodeKey = node.k;
    if (isEqual(key2, nodeKey)) {
      if (val === node.v) {
        return root;
      }
      return {
        type: INDEX_NODE,
        bitmap: root.bitmap,
        array: cloneAndSet(root.array, idx, {
          type: ENTRY,
          k: key2,
          v: val
        })
      };
    }
    addedLeaf.val = true;
    return {
      type: INDEX_NODE,
      bitmap: root.bitmap,
      array: cloneAndSet(
        root.array,
        idx,
        createNode(shift + SHIFT, nodeKey, node.v, hash, key2, val)
      )
    };
  } else {
    const n = root.array.length;
    if (n >= MAX_INDEX_NODE) {
      const nodes = new Array(32);
      const jdx = mask(hash, shift);
      nodes[jdx] = assocIndex(EMPTY, shift + SHIFT, hash, key2, val, addedLeaf);
      let j = 0;
      let bitmap = root.bitmap;
      for (let i = 0; i < 32; i++) {
        if ((bitmap & 1) !== 0) {
          const node = root.array[j++];
          nodes[i] = node;
        }
        bitmap = bitmap >>> 1;
      }
      return {
        type: ARRAY_NODE,
        size: n + 1,
        array: nodes
      };
    } else {
      const newArray = spliceIn(root.array, idx, {
        type: ENTRY,
        k: key2,
        v: val
      });
      addedLeaf.val = true;
      return {
        type: INDEX_NODE,
        bitmap: root.bitmap | bit,
        array: newArray
      };
    }
  }
}
function assocCollision(root, shift, hash, key2, val, addedLeaf) {
  if (hash === root.hash) {
    const idx = collisionIndexOf(root, key2);
    if (idx !== -1) {
      const entry = root.array[idx];
      if (entry.v === val) {
        return root;
      }
      return {
        type: COLLISION_NODE,
        hash,
        array: cloneAndSet(root.array, idx, { type: ENTRY, k: key2, v: val })
      };
    }
    const size = root.array.length;
    addedLeaf.val = true;
    return {
      type: COLLISION_NODE,
      hash,
      array: cloneAndSet(root.array, size, { type: ENTRY, k: key2, v: val })
    };
  }
  return assoc(
    {
      type: INDEX_NODE,
      bitmap: bitpos(root.hash, shift),
      array: [root]
    },
    shift,
    hash,
    key2,
    val,
    addedLeaf
  );
}
function collisionIndexOf(root, key2) {
  const size = root.array.length;
  for (let i = 0; i < size; i++) {
    if (isEqual(key2, root.array[i].k)) {
      return i;
    }
  }
  return -1;
}
function find(root, shift, hash, key2) {
  switch (root.type) {
    case ARRAY_NODE:
      return findArray(root, shift, hash, key2);
    case INDEX_NODE:
      return findIndex(root, shift, hash, key2);
    case COLLISION_NODE:
      return findCollision(root, key2);
  }
}
function findArray(root, shift, hash, key2) {
  const idx = mask(hash, shift);
  const node = root.array[idx];
  if (node === void 0) {
    return void 0;
  }
  if (node.type !== ENTRY) {
    return find(node, shift + SHIFT, hash, key2);
  }
  if (isEqual(key2, node.k)) {
    return node;
  }
  return void 0;
}
function findIndex(root, shift, hash, key2) {
  const bit = bitpos(hash, shift);
  if ((root.bitmap & bit) === 0) {
    return void 0;
  }
  const idx = index(root.bitmap, bit);
  const node = root.array[idx];
  if (node.type !== ENTRY) {
    return find(node, shift + SHIFT, hash, key2);
  }
  if (isEqual(key2, node.k)) {
    return node;
  }
  return void 0;
}
function findCollision(root, key2) {
  const idx = collisionIndexOf(root, key2);
  if (idx < 0) {
    return void 0;
  }
  return root.array[idx];
}
function without(root, shift, hash, key2) {
  switch (root.type) {
    case ARRAY_NODE:
      return withoutArray(root, shift, hash, key2);
    case INDEX_NODE:
      return withoutIndex(root, shift, hash, key2);
    case COLLISION_NODE:
      return withoutCollision(root, key2);
  }
}
function withoutArray(root, shift, hash, key2) {
  const idx = mask(hash, shift);
  const node = root.array[idx];
  if (node === void 0) {
    return root;
  }
  let n = void 0;
  if (node.type === ENTRY) {
    if (!isEqual(node.k, key2)) {
      return root;
    }
  } else {
    n = without(node, shift + SHIFT, hash, key2);
    if (n === node) {
      return root;
    }
  }
  if (n === void 0) {
    if (root.size <= MIN_ARRAY_NODE) {
      const arr = root.array;
      const out = new Array(root.size - 1);
      let i = 0;
      let j = 0;
      let bitmap = 0;
      while (i < idx) {
        const nv = arr[i];
        if (nv !== void 0) {
          out[j] = nv;
          bitmap |= 1 << i;
          ++j;
        }
        ++i;
      }
      ++i;
      while (i < arr.length) {
        const nv = arr[i];
        if (nv !== void 0) {
          out[j] = nv;
          bitmap |= 1 << i;
          ++j;
        }
        ++i;
      }
      return {
        type: INDEX_NODE,
        bitmap,
        array: out
      };
    }
    return {
      type: ARRAY_NODE,
      size: root.size - 1,
      array: cloneAndSet(root.array, idx, n)
    };
  }
  return {
    type: ARRAY_NODE,
    size: root.size,
    array: cloneAndSet(root.array, idx, n)
  };
}
function withoutIndex(root, shift, hash, key2) {
  const bit = bitpos(hash, shift);
  if ((root.bitmap & bit) === 0) {
    return root;
  }
  const idx = index(root.bitmap, bit);
  const node = root.array[idx];
  if (node.type !== ENTRY) {
    const n = without(node, shift + SHIFT, hash, key2);
    if (n === node) {
      return root;
    }
    if (n !== void 0) {
      return {
        type: INDEX_NODE,
        bitmap: root.bitmap,
        array: cloneAndSet(root.array, idx, n)
      };
    }
    if (root.bitmap === bit) {
      return void 0;
    }
    return {
      type: INDEX_NODE,
      bitmap: root.bitmap ^ bit,
      array: spliceOut(root.array, idx)
    };
  }
  if (isEqual(key2, node.k)) {
    if (root.bitmap === bit) {
      return void 0;
    }
    return {
      type: INDEX_NODE,
      bitmap: root.bitmap ^ bit,
      array: spliceOut(root.array, idx)
    };
  }
  return root;
}
function withoutCollision(root, key2) {
  const idx = collisionIndexOf(root, key2);
  if (idx < 0) {
    return root;
  }
  if (root.array.length === 1) {
    return void 0;
  }
  return {
    type: COLLISION_NODE,
    hash: root.hash,
    array: spliceOut(root.array, idx)
  };
}
function forEach(root, fn) {
  if (root === void 0) {
    return;
  }
  const items = root.array;
  const size = items.length;
  for (let i = 0; i < size; i++) {
    const item = items[i];
    if (item === void 0) {
      continue;
    }
    if (item.type === ENTRY) {
      fn(item.v, item.k);
      continue;
    }
    forEach(item, fn);
  }
}
var Dict = class _Dict {
  /**
   * @template V
   * @param {Record<string,V>} o
   * @returns {Dict<string,V>}
   */
  static fromObject(o) {
    const keys2 = Object.keys(o);
    let m = _Dict.new();
    for (let i = 0; i < keys2.length; i++) {
      const k = keys2[i];
      m = m.set(k, o[k]);
    }
    return m;
  }
  /**
   * @template K,V
   * @param {Map<K,V>} o
   * @returns {Dict<K,V>}
   */
  static fromMap(o) {
    let m = _Dict.new();
    o.forEach((v, k) => {
      m = m.set(k, v);
    });
    return m;
  }
  static new() {
    return new _Dict(void 0, 0);
  }
  /**
   * @param {undefined | Node<K,V>} root
   * @param {number} size
   */
  constructor(root, size) {
    this.root = root;
    this.size = size;
  }
  /**
   * @template NotFound
   * @param {K} key
   * @param {NotFound} notFound
   * @returns {NotFound | V}
   */
  get(key2, notFound) {
    if (this.root === void 0) {
      return notFound;
    }
    const found = find(this.root, 0, getHash(key2), key2);
    if (found === void 0) {
      return notFound;
    }
    return found.v;
  }
  /**
   * @param {K} key
   * @param {V} val
   * @returns {Dict<K,V>}
   */
  set(key2, val) {
    const addedLeaf = { val: false };
    const root = this.root === void 0 ? EMPTY : this.root;
    const newRoot = assoc(root, 0, getHash(key2), key2, val, addedLeaf);
    if (newRoot === this.root) {
      return this;
    }
    return new _Dict(newRoot, addedLeaf.val ? this.size + 1 : this.size);
  }
  /**
   * @param {K} key
   * @returns {Dict<K,V>}
   */
  delete(key2) {
    if (this.root === void 0) {
      return this;
    }
    const newRoot = without(this.root, 0, getHash(key2), key2);
    if (newRoot === this.root) {
      return this;
    }
    if (newRoot === void 0) {
      return _Dict.new();
    }
    return new _Dict(newRoot, this.size - 1);
  }
  /**
   * @param {K} key
   * @returns {boolean}
   */
  has(key2) {
    if (this.root === void 0) {
      return false;
    }
    return find(this.root, 0, getHash(key2), key2) !== void 0;
  }
  /**
   * @returns {[K,V][]}
   */
  entries() {
    if (this.root === void 0) {
      return [];
    }
    const result = [];
    this.forEach((v, k) => result.push([k, v]));
    return result;
  }
  /**
   *
   * @param {(val:V,key:K)=>void} fn
   */
  forEach(fn) {
    forEach(this.root, fn);
  }
  hashCode() {
    let h = 0;
    this.forEach((v, k) => {
      h = h + hashMerge(getHash(v), getHash(k)) | 0;
    });
    return h;
  }
  /**
   * @param {unknown} o
   * @returns {boolean}
   */
  equals(o) {
    if (!(o instanceof _Dict) || this.size !== o.size) {
      return false;
    }
    let equal = true;
    this.forEach((v, k) => {
      equal = equal && isEqual(o.get(k, !v), v);
    });
    return equal;
  }
};

// build/dev/javascript/gleam_stdlib/gleam_stdlib.mjs
var Nil = void 0;
var NOT_FOUND = {};
function identity(x) {
  return x;
}
function parse_int(value4) {
  if (/^[-+]?(\d+)$/.test(value4)) {
    return new Ok(parseInt(value4));
  } else {
    return new Error(Nil);
  }
}
function to_string(term) {
  return term.toString();
}
function int_to_base_string(int4, base) {
  return int4.toString(base).toUpperCase();
}
function string_length(string4) {
  if (string4 === "") {
    return 0;
  }
  const iterator = graphemes_iterator(string4);
  if (iterator) {
    let i = 0;
    for (const _ of iterator) {
      i++;
    }
    return i;
  } else {
    return string4.match(/./gsu).length;
  }
}
function graphemes(string4) {
  const iterator = graphemes_iterator(string4);
  if (iterator) {
    return List.fromArray(Array.from(iterator).map((item) => item.segment));
  } else {
    return List.fromArray(string4.match(/./gsu));
  }
}
var segmenter = void 0;
function graphemes_iterator(string4) {
  if (globalThis.Intl && Intl.Segmenter) {
    segmenter ||= new Intl.Segmenter();
    return segmenter.segment(string4)[Symbol.iterator]();
  }
}
function pop_grapheme(string4) {
  let first4;
  const iterator = graphemes_iterator(string4);
  if (iterator) {
    first4 = iterator.next().value?.segment;
  } else {
    first4 = string4.match(/./su)?.[0];
  }
  if (first4) {
    return new Ok([first4, string4.slice(first4.length)]);
  } else {
    return new Error(Nil);
  }
}
function lowercase(string4) {
  return string4.toLowerCase();
}
function split(xs, pattern) {
  return List.fromArray(xs.split(pattern));
}
function join(xs, separator) {
  const iterator = xs[Symbol.iterator]();
  let result = iterator.next().value || "";
  let current = iterator.next();
  while (!current.done) {
    result = result + separator + current.value;
    current = iterator.next();
  }
  return result;
}
function concat(xs) {
  let result = "";
  for (const x of xs) {
    result = result + x;
  }
  return result;
}
function string_slice(string4, idx, len) {
  if (len <= 0 || idx >= string4.length) {
    return "";
  }
  const iterator = graphemes_iterator(string4);
  if (iterator) {
    while (idx-- > 0) {
      iterator.next();
    }
    let result = "";
    while (len-- > 0) {
      const v = iterator.next().value;
      if (v === void 0) {
        break;
      }
      result += v.segment;
    }
    return result;
  } else {
    return string4.match(/./gsu).slice(idx, idx + len).join("");
  }
}
function starts_with(haystack, needle) {
  return haystack.startsWith(needle);
}
var unicode_whitespaces = [
  " ",
  // Space
  "	",
  // Horizontal tab
  "\n",
  // Line feed
  "\v",
  // Vertical tab
  "\f",
  // Form feed
  "\r",
  // Carriage return
  "\x85",
  // Next line
  "\u2028",
  // Line separator
  "\u2029"
  // Paragraph separator
].join("");
var left_trim_regex = new RegExp(`^([${unicode_whitespaces}]*)`, "g");
var right_trim_regex = new RegExp(`([${unicode_whitespaces}]*)$`, "g");
function trim(string4) {
  return trim_start(trim_end(string4));
}
function trim_start(string4) {
  return string4.replace(left_trim_regex, "");
}
function trim_end(string4) {
  return string4.replace(right_trim_regex, "");
}
function floor(float3) {
  return Math.floor(float3);
}
function round(float3) {
  return Math.round(float3);
}
function random_uniform() {
  const random_uniform_result = Math.random();
  if (random_uniform_result === 1) {
    return random_uniform();
  }
  return random_uniform_result;
}
function compile_regex(pattern, options) {
  try {
    let flags = "gu";
    if (options.case_insensitive)
      flags += "i";
    if (options.multi_line)
      flags += "m";
    return new Ok(new RegExp(pattern, flags));
  } catch (error) {
    const number = (error.columnNumber || 0) | 0;
    return new Error(new CompileError(error.message, number));
  }
}
function regex_scan(regex, string4) {
  const matches = Array.from(string4.matchAll(regex)).map((match) => {
    const content = match[0];
    const submatches = [];
    for (let n = match.length - 1; n > 0; n--) {
      if (match[n]) {
        submatches[n - 1] = new Some(match[n]);
        continue;
      }
      if (submatches.length > 0) {
        submatches[n - 1] = new None();
      }
    }
    return new Match(content, List.fromArray(submatches));
  });
  return List.fromArray(matches);
}
function new_map() {
  return Dict.new();
}
function map_to_list(map6) {
  return List.fromArray(map6.entries());
}
function map_get(map6, key2) {
  const value4 = map6.get(key2, NOT_FOUND);
  if (value4 === NOT_FOUND) {
    return new Error(Nil);
  }
  return new Ok(value4);
}
function map_insert(key2, value4, map6) {
  return map6.set(key2, value4);
}
function classify_dynamic(data) {
  if (typeof data === "string") {
    return "String";
  } else if (typeof data === "boolean") {
    return "Bool";
  } else if (data instanceof Result) {
    return "Result";
  } else if (data instanceof List) {
    return "List";
  } else if (data instanceof BitArray) {
    return "BitArray";
  } else if (data instanceof Dict) {
    return "Dict";
  } else if (Number.isInteger(data)) {
    return "Int";
  } else if (Array.isArray(data)) {
    return `Tuple of ${data.length} elements`;
  } else if (typeof data === "number") {
    return "Float";
  } else if (data === null) {
    return "Null";
  } else if (data === void 0) {
    return "Nil";
  } else {
    const type = typeof data;
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
}
function decoder_error(expected, got) {
  return decoder_error_no_classify(expected, classify_dynamic(got));
}
function decoder_error_no_classify(expected, got) {
  return new Error(
    List.fromArray([new DecodeError(expected, got, List.fromArray([]))])
  );
}
function decode_string(data) {
  return typeof data === "string" ? new Ok(data) : decoder_error("String", data);
}
function decode_int(data) {
  return Number.isInteger(data) ? new Ok(data) : decoder_error("Int", data);
}
function decode_field(value4, name) {
  const not_a_map_error = () => decoder_error("Dict", value4);
  if (value4 instanceof Dict || value4 instanceof WeakMap || value4 instanceof Map) {
    const entry = map_get(value4, name);
    return new Ok(entry.isOk() ? new Some(entry[0]) : new None());
  } else if (value4 === null) {
    return not_a_map_error();
  } else if (Object.getPrototypeOf(value4) == Object.prototype) {
    return try_get_field(value4, name, () => new Ok(new None()));
  } else {
    return try_get_field(value4, name, not_a_map_error);
  }
}
function try_get_field(value4, field3, or_else) {
  try {
    return field3 in value4 ? new Ok(new Some(value4[field3])) : or_else();
  } catch {
    return or_else();
  }
}
function bitwise_and(x, y) {
  return Number(BigInt(x) & BigInt(y));
}
function bitwise_not(x) {
  return Number(~BigInt(x));
}
function bitwise_or(x, y) {
  return Number(BigInt(x) | BigInt(y));
}
function bitwise_shift_left(x, y) {
  return Number(BigInt(x) << BigInt(y));
}

// build/dev/javascript/gleam_stdlib/gleam/dict.mjs
function new$() {
  return new_map();
}
function insert(dict2, key2, value4) {
  return map_insert(key2, value4, dict2);
}
function from_list_loop(loop$list, loop$initial) {
  while (true) {
    let list4 = loop$list;
    let initial = loop$initial;
    if (list4.hasLength(0)) {
      return initial;
    } else {
      let x = list4.head;
      let rest = list4.tail;
      loop$list = rest;
      loop$initial = insert(initial, x[0], x[1]);
    }
  }
}
function from_list(list4) {
  return from_list_loop(list4, new$());
}
function reverse_and_concat(loop$remaining, loop$accumulator) {
  while (true) {
    let remaining = loop$remaining;
    let accumulator = loop$accumulator;
    if (remaining.hasLength(0)) {
      return accumulator;
    } else {
      let item = remaining.head;
      let rest = remaining.tail;
      loop$remaining = rest;
      loop$accumulator = prepend(item, accumulator);
    }
  }
}
function do_keys_loop(loop$list, loop$acc) {
  while (true) {
    let list4 = loop$list;
    let acc = loop$acc;
    if (list4.hasLength(0)) {
      return reverse_and_concat(acc, toList([]));
    } else {
      let first4 = list4.head;
      let rest = list4.tail;
      loop$list = rest;
      loop$acc = prepend(first4[0], acc);
    }
  }
}
function do_keys(dict2) {
  let list_of_pairs = map_to_list(dict2);
  return do_keys_loop(list_of_pairs, toList([]));
}
function keys(dict2) {
  return do_keys(dict2);
}
function do_values_loop(loop$list, loop$acc) {
  while (true) {
    let list4 = loop$list;
    let acc = loop$acc;
    if (list4.hasLength(0)) {
      return reverse_and_concat(acc, toList([]));
    } else {
      let first4 = list4.head;
      let rest = list4.tail;
      loop$list = rest;
      loop$acc = prepend(first4[1], acc);
    }
  }
}
function do_values(dict2) {
  let list_of_pairs = map_to_list(dict2);
  return do_values_loop(list_of_pairs, toList([]));
}
function values(dict2) {
  return do_values(dict2);
}
function insert_pair(dict2, pair) {
  return insert(dict2, pair[0], pair[1]);
}
function fold_inserts(loop$new_entries, loop$dict) {
  while (true) {
    let new_entries = loop$new_entries;
    let dict2 = loop$dict;
    if (new_entries.hasLength(0)) {
      return dict2;
    } else {
      let first4 = new_entries.head;
      let rest = new_entries.tail;
      loop$new_entries = rest;
      loop$dict = insert_pair(dict2, first4);
    }
  }
}
function do_merge(dict2, new_entries) {
  let _pipe = new_entries;
  let _pipe$1 = map_to_list(_pipe);
  return fold_inserts(_pipe$1, dict2);
}
function merge(dict2, new_entries) {
  return do_merge(dict2, new_entries);
}

// build/dev/javascript/gleam_stdlib/gleam/bool.mjs
function guard(requirement, consequence, alternative) {
  if (requirement) {
    return consequence;
  } else {
    return alternative();
  }
}

// build/dev/javascript/gleam_json/gleam_json_ffi.mjs
function json_to_string(json) {
  return JSON.stringify(json);
}
function object(entries) {
  return Object.fromEntries(entries);
}
function identity2(x) {
  return x;
}
function array(list4) {
  return list4.toArray();
}
function do_null() {
  return null;
}
function decode(string4) {
  try {
    const result = JSON.parse(string4);
    return new Ok(result);
  } catch (err) {
    return new Error(getJsonDecodeError(err, string4));
  }
}
function getJsonDecodeError(stdErr, json) {
  if (isUnexpectedEndOfInput(stdErr))
    return new UnexpectedEndOfInput();
  return toUnexpectedByteError(stdErr, json);
}
function isUnexpectedEndOfInput(err) {
  const unexpectedEndOfInputRegex = /((unexpected (end|eof))|(end of data)|(unterminated string)|(json( parse error|\.parse)\: expected '(\:|\}|\])'))/i;
  return unexpectedEndOfInputRegex.test(err.message);
}
function toUnexpectedByteError(err, json) {
  let converters = [
    v8UnexpectedByteError,
    oldV8UnexpectedByteError,
    jsCoreUnexpectedByteError,
    spidermonkeyUnexpectedByteError
  ];
  for (let converter of converters) {
    let result = converter(err, json);
    if (result)
      return result;
  }
  return new UnexpectedByte("", 0);
}
function v8UnexpectedByteError(err) {
  const regex = /unexpected token '(.)', ".+" is not valid JSON/i;
  const match = regex.exec(err.message);
  if (!match)
    return null;
  const byte = toHex(match[1]);
  return new UnexpectedByte(byte, -1);
}
function oldV8UnexpectedByteError(err) {
  const regex = /unexpected token (.) in JSON at position (\d+)/i;
  const match = regex.exec(err.message);
  if (!match)
    return null;
  const byte = toHex(match[1]);
  const position = Number(match[2]);
  return new UnexpectedByte(byte, position);
}
function spidermonkeyUnexpectedByteError(err, json) {
  const regex = /(unexpected character|expected .*) at line (\d+) column (\d+)/i;
  const match = regex.exec(err.message);
  if (!match)
    return null;
  const line = Number(match[2]);
  const column = Number(match[3]);
  const position = getPositionFromMultiline(line, column, json);
  const byte = toHex(json[position]);
  return new UnexpectedByte(byte, position);
}
function jsCoreUnexpectedByteError(err) {
  const regex = /unexpected (identifier|token) "(.)"/i;
  const match = regex.exec(err.message);
  if (!match)
    return null;
  const byte = toHex(match[2]);
  return new UnexpectedByte(byte, 0);
}
function toHex(char) {
  return "0x" + char.charCodeAt(0).toString(16).toUpperCase();
}
function getPositionFromMultiline(line, column, string4) {
  if (line === 1)
    return column - 1;
  let currentLn = 1;
  let position = 0;
  string4.split("").find((char, idx) => {
    if (char === "\n")
      currentLn += 1;
    if (currentLn === line) {
      position = idx + column;
      return true;
    }
    return false;
  });
  return position;
}

// build/dev/javascript/gleam_json/gleam/json.mjs
var UnexpectedEndOfInput = class extends CustomType {
};
var UnexpectedByte = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var UnexpectedFormat = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
function do_decode(json, decoder) {
  return then$(
    decode(json),
    (dynamic_value) => {
      let _pipe = decoder(dynamic_value);
      return map_error(
        _pipe,
        (var0) => {
          return new UnexpectedFormat(var0);
        }
      );
    }
  );
}
function decode2(json, decoder) {
  return do_decode(json, decoder);
}
function to_string5(json) {
  return json_to_string(json);
}
function string2(input2) {
  return identity2(input2);
}
function int2(input2) {
  return identity2(input2);
}
function null$() {
  return do_null();
}
function object2(entries) {
  return object(entries);
}
function preprocessed_array(from2) {
  return array(from2);
}

// build/dev/javascript/lustre/lustre/effect.mjs
var Effect = class extends CustomType {
  constructor(all) {
    super();
    this.all = all;
  }
};
function custom(run2) {
  return new Effect(
    toList([
      (actions) => {
        return run2(actions.dispatch, actions.emit, actions.select, actions.root);
      }
    ])
  );
}
function from(effect) {
  return custom((dispatch, _, _1, _2) => {
    return effect(dispatch);
  });
}
function none() {
  return new Effect(toList([]));
}
function batch(effects) {
  return new Effect(
    fold(
      effects,
      toList([]),
      (b, _use1) => {
        let a = _use1.all;
        return append(b, a);
      }
    )
  );
}

// build/dev/javascript/lustre/lustre/internals/vdom.mjs
var Text = class extends CustomType {
  constructor(content) {
    super();
    this.content = content;
  }
};
var Element2 = class extends CustomType {
  constructor(key2, namespace, tag, attrs, children3, self_closing, void$) {
    super();
    this.key = key2;
    this.namespace = namespace;
    this.tag = tag;
    this.attrs = attrs;
    this.children = children3;
    this.self_closing = self_closing;
    this.void = void$;
  }
};
var Map2 = class extends CustomType {
  constructor(subtree) {
    super();
    this.subtree = subtree;
  }
};
var Attribute = class extends CustomType {
  constructor(x0, x1, as_property) {
    super();
    this[0] = x0;
    this[1] = x1;
    this.as_property = as_property;
  }
};
var Event2 = class extends CustomType {
  constructor(x0, x1) {
    super();
    this[0] = x0;
    this[1] = x1;
  }
};
function attribute_to_event_handler(attribute3) {
  if (attribute3 instanceof Attribute) {
    return new Error(void 0);
  } else {
    let name = attribute3[0];
    let handler = attribute3[1];
    let name$1 = drop_left(name, 2);
    return new Ok([name$1, handler]);
  }
}
function do_element_list_handlers(elements2, handlers2, key2) {
  return index_fold(
    elements2,
    handlers2,
    (handlers3, element3, index4) => {
      let key$1 = key2 + "-" + to_string2(index4);
      return do_handlers(element3, handlers3, key$1);
    }
  );
}
function do_handlers(loop$element, loop$handlers, loop$key) {
  while (true) {
    let element3 = loop$element;
    let handlers2 = loop$handlers;
    let key2 = loop$key;
    if (element3 instanceof Text) {
      return handlers2;
    } else if (element3 instanceof Map2) {
      let subtree = element3.subtree;
      loop$element = subtree();
      loop$handlers = handlers2;
      loop$key = key2;
    } else {
      let attrs = element3.attrs;
      let children3 = element3.children;
      let handlers$1 = fold(
        attrs,
        handlers2,
        (handlers3, attr) => {
          let $ = attribute_to_event_handler(attr);
          if ($.isOk()) {
            let name = $[0][0];
            let handler = $[0][1];
            return insert(handlers3, key2 + "-" + name, handler);
          } else {
            return handlers3;
          }
        }
      );
      return do_element_list_handlers(children3, handlers$1, key2);
    }
  }
}
function handlers(element3) {
  return do_handlers(element3, new$(), "0");
}

// build/dev/javascript/lustre/lustre/attribute.mjs
function attribute(name, value4) {
  return new Attribute(name, identity(value4), false);
}
function on(name, handler) {
  return new Event2("on" + name, handler);
}

// build/dev/javascript/lustre/lustre/element.mjs
function element(tag, attrs, children3) {
  if (tag === "area") {
    return new Element2("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "base") {
    return new Element2("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "br") {
    return new Element2("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "col") {
    return new Element2("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "embed") {
    return new Element2("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "hr") {
    return new Element2("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "img") {
    return new Element2("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "input") {
    return new Element2("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "link") {
    return new Element2("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "meta") {
    return new Element2("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "param") {
    return new Element2("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "source") {
    return new Element2("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "track") {
    return new Element2("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "wbr") {
    return new Element2("", "", tag, attrs, toList([]), false, true);
  } else {
    return new Element2("", "", tag, attrs, children3, false, false);
  }
}
function do_keyed(el, key2) {
  if (el instanceof Element2) {
    let namespace = el.namespace;
    let tag = el.tag;
    let attrs = el.attrs;
    let children3 = el.children;
    let self_closing = el.self_closing;
    let void$ = el.void;
    return new Element2(
      key2,
      namespace,
      tag,
      attrs,
      children3,
      self_closing,
      void$
    );
  } else if (el instanceof Map2) {
    let subtree = el.subtree;
    return new Map2(() => {
      return do_keyed(subtree(), key2);
    });
  } else {
    return el;
  }
}
function keyed(el, children3) {
  return el(
    map2(
      children3,
      (_use0) => {
        let key2 = _use0[0];
        let child = _use0[1];
        return do_keyed(child, key2);
      }
    )
  );
}
function text(content) {
  return new Text(content);
}

// build/dev/javascript/gleam_stdlib/gleam/set.mjs
var Set2 = class extends CustomType {
  constructor(dict2) {
    super();
    this.dict = dict2;
  }
};
function new$3() {
  return new Set2(new$());
}

// build/dev/javascript/lustre/lustre/internals/patch.mjs
var Diff = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var Emit = class extends CustomType {
  constructor(x0, x1) {
    super();
    this[0] = x0;
    this[1] = x1;
  }
};
var Init = class extends CustomType {
  constructor(x0, x1) {
    super();
    this[0] = x0;
    this[1] = x1;
  }
};
function is_empty_element_diff(diff2) {
  return isEqual(diff2.created, new$()) && isEqual(
    diff2.removed,
    new$3()
  ) && isEqual(diff2.updated, new$());
}

// build/dev/javascript/lustre/lustre/internals/runtime.mjs
var Attrs = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var Batch = class extends CustomType {
  constructor(x0, x1) {
    super();
    this[0] = x0;
    this[1] = x1;
  }
};
var Debug = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var Dispatch = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var Emit2 = class extends CustomType {
  constructor(x0, x1) {
    super();
    this[0] = x0;
    this[1] = x1;
  }
};
var Event3 = class extends CustomType {
  constructor(x0, x1) {
    super();
    this[0] = x0;
    this[1] = x1;
  }
};
var Shutdown = class extends CustomType {
};
var Subscribe = class extends CustomType {
  constructor(x0, x1) {
    super();
    this[0] = x0;
    this[1] = x1;
  }
};
var Unsubscribe = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var ForceModel = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};

// build/dev/javascript/lustre/vdom.ffi.mjs
if (window && window.customElements) {
  window.customElements.define(
    "lustre-fragment",
    class LustreFragment extends HTMLElement {
      constructor() {
        super();
      }
    }
  );
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
  let style2 = null;
  let innerHTML = null;
  if (canMorph && next.tag === "textarea") {
    const innertText = next.children[Symbol.iterator]().next().value?.content;
    if (innertText !== void 0)
      el.value = innertText;
  }
  const delegated = [];
  for (const attr of next.attrs) {
    const name = attr[0];
    const value4 = attr[1];
    if (attr.as_property) {
      if (el[name] !== value4)
        el[name] = value4;
      if (canMorph)
        prevAttributes.delete(name);
    } else if (name.startsWith("on")) {
      const eventName = name.slice(2);
      const callback = dispatch(value4, eventName === "input");
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
      el.setAttribute(name, value4);
    } else if (name.startsWith("delegate:data-") || name.startsWith("delegate:aria-")) {
      el.setAttribute(name, value4);
      delegated.push([name.slice(10), value4]);
    } else if (name === "class") {
      className = className === null ? value4 : className + " " + value4;
    } else if (name === "style") {
      style2 = style2 === null ? value4 : style2 + value4;
    } else if (name === "dangerous-unescaped-html") {
      innerHTML = value4;
    } else {
      if (el.getAttribute(name) !== value4)
        el.setAttribute(name, value4);
      if (name === "value" || name === "selected")
        el[name] = value4;
      if (canMorph)
        prevAttributes.delete(name);
    }
  }
  if (className !== null) {
    el.setAttribute("class", className);
    if (canMorph)
      prevAttributes.delete("class");
  }
  if (style2 !== null) {
    el.setAttribute("style", style2);
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
        for (const [name, value4] of delegated) {
          if (!child.hasAttribute(name)) {
            child.setAttribute(name, value4);
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
  const target2 = event2.currentTarget;
  if (!registeredHandlers.has(target2)) {
    target2.removeEventListener(event2.type, lustreGenericEventHandler);
    return;
  }
  const handlersForEventTarget = registeredHandlers.get(target2);
  if (!handlersForEventTarget.has(event2.type)) {
    target2.removeEventListener(event2.type, lustreGenericEventHandler);
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
      (data2, property2) => {
        const path = property2.split(".");
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
      const key2 = child?.key || child?.getAttribute?.("data-lustre-key");
      if (key2)
        keyedChildren.set(key2, child);
    }
  }
  return keyedChildren;
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
function* children(element3) {
  for (const child of element3.children) {
    yield* forceChild(child);
  }
}
function* forceChild(element3) {
  if (element3.subtree !== void 0) {
    yield* forceChild(element3.subtree());
  } else {
    yield element3;
  }
}

// build/dev/javascript/lustre/lustre.ffi.mjs
var LustreClientApplication = class _LustreClientApplication {
  /**
   * @template Flags
   *
   * @param {object} app
   * @param {(flags: Flags) => [Model, Lustre.Effect<Msg>]} app.init
   * @param {(msg: Msg, model: Model) => [Model, Lustre.Effect<Msg>]} app.update
   * @param {(model: Model) => Lustre.Element<Msg>} app.view
   * @param {string | HTMLElement} selector
   * @param {Flags} flags
   *
   * @returns {Gleam.Ok<(action: Lustre.Action<Lustre.Client, Msg>>) => void>}
   */
  static start({ init: init4, update: update2, view: view2 }, selector, flags) {
    if (!is_browser())
      return new Error(new NotABrowser());
    const root = selector instanceof HTMLElement ? selector : document.querySelector(selector);
    if (!root)
      return new Error(new ElementNotFound(selector));
    const app = new _LustreClientApplication(root, init4(flags), update2, view2);
    return new Ok((action) => app.send(action));
  }
  /**
   * @param {Element} root
   * @param {[Model, Lustre.Effect<Msg>]} init
   * @param {(model: Model, msg: Msg) => [Model, Lustre.Effect<Msg>]} update
   * @param {(model: Model) => Lustre.Element<Msg>} view
   *
   * @returns {LustreClientApplication}
   */
  constructor(root, [init4, effects], update2, view2) {
    this.root = root;
    this.#model = init4;
    this.#update = update2;
    this.#view = view2;
    this.#tickScheduled = window.requestAnimationFrame(
      () => this.#tick(effects.all.toArray(), true)
    );
  }
  /** @type {Element} */
  root;
  /**
   * @param {Lustre.Action<Lustre.Client, Msg>} action
   *
   * @returns {void}
   */
  send(action) {
    if (action instanceof Debug) {
      if (action[0] instanceof ForceModel) {
        this.#tickScheduled = window.cancelAnimationFrame(this.#tickScheduled);
        this.#queue = [];
        this.#model = action[0][0];
        const vdom = this.#view(this.#model);
        const dispatch = (handler, immediate = false) => (event2) => {
          const result = handler(event2);
          if (result instanceof Ok) {
            this.send(new Dispatch(result[0], immediate));
          }
        };
        const prev = this.root.firstChild ?? this.root.appendChild(document.createTextNode(""));
        morph(prev, vdom, dispatch);
      }
    } else if (action instanceof Dispatch) {
      const msg = action[0];
      const immediate = action[1] ?? false;
      this.#queue.push(msg);
      if (immediate) {
        this.#tickScheduled = window.cancelAnimationFrame(this.#tickScheduled);
        this.#tick();
      } else if (!this.#tickScheduled) {
        this.#tickScheduled = window.requestAnimationFrame(() => this.#tick());
      }
    } else if (action instanceof Emit2) {
      const event2 = action[0];
      const data = action[1];
      this.root.dispatchEvent(
        new CustomEvent(event2, {
          detail: data,
          bubbles: true,
          composed: true
        })
      );
    } else if (action instanceof Shutdown) {
      this.#tickScheduled = window.cancelAnimationFrame(this.#tickScheduled);
      this.#model = null;
      this.#update = null;
      this.#view = null;
      this.#queue = null;
      while (this.root.firstChild) {
        this.root.firstChild.remove();
      }
    }
  }
  /** @type {Model} */
  #model;
  /** @type {(model: Model, msg: Msg) => [Model, Lustre.Effect<Msg>]} */
  #update;
  /** @type {(model: Model) => Lustre.Element<Msg>} */
  #view;
  /** @type {Array<Msg>} */
  #queue = [];
  /** @type {number | undefined} */
  #tickScheduled;
  /**
   * @param {Lustre.Effect<Msg>[]} effects
   * @param {boolean} isFirstRender
   */
  #tick(effects = [], isFirstRender = false) {
    this.#tickScheduled = void 0;
    if (!this.#flush(effects, isFirstRender))
      return;
    const vdom = this.#view(this.#model);
    const dispatch = (handler, immediate = false) => (event2) => {
      const result = handler(event2);
      if (result instanceof Ok) {
        this.send(new Dispatch(result[0], immediate));
      }
    };
    const prev = this.root.firstChild ?? this.root.appendChild(document.createTextNode(""));
    morph(prev, vdom, dispatch);
  }
  #flush(effects = [], didUpdate = false) {
    while (this.#queue.length > 0) {
      const msg = this.#queue.shift();
      const [next, effect] = this.#update(this.#model, msg);
      didUpdate ||= this.#model !== next;
      effects = effects.concat(effect.all.toArray());
      this.#model = next;
    }
    while (effects.length > 0) {
      const effect = effects.shift();
      const dispatch = (msg) => this.send(new Dispatch(msg));
      const emit2 = (event2, data) => this.root.dispatchEvent(
        new CustomEvent(event2, {
          detail: data,
          bubbles: true,
          composed: true
        })
      );
      const select = () => {
      };
      const root = this.root;
      effect({ dispatch, emit: emit2, select, root });
    }
    if (this.#queue.length > 0) {
      return this.#flush(effects, didUpdate);
    } else {
      return didUpdate;
    }
  }
};
var start = LustreClientApplication.start;
var LustreServerApplication = class _LustreServerApplication {
  static start({ init: init4, update: update2, view: view2, on_attribute_change }, flags) {
    const app = new _LustreServerApplication(
      init4(flags),
      update2,
      view2,
      on_attribute_change
    );
    return new Ok((action) => app.send(action));
  }
  constructor([model, effects], update2, view2, on_attribute_change) {
    this.#model = model;
    this.#update = update2;
    this.#view = view2;
    this.#html = view2(model);
    this.#onAttributeChange = on_attribute_change;
    this.#renderers = /* @__PURE__ */ new Map();
    this.#handlers = handlers(this.#html);
    this.#tick(effects.all.toArray());
  }
  send(action) {
    if (action instanceof Attrs) {
      for (const attr of action[0]) {
        const decoder = this.#onAttributeChange.get(attr[0]);
        if (!decoder)
          continue;
        const msg = decoder(attr[1]);
        if (msg instanceof Error)
          continue;
        this.#queue.push(msg);
      }
      this.#tick();
    } else if (action instanceof Batch) {
      this.#queue = this.#queue.concat(action[0].toArray());
      this.#tick(action[1].all.toArray());
    } else if (action instanceof Debug) {
    } else if (action instanceof Dispatch) {
      this.#queue.push(action[0]);
      this.#tick();
    } else if (action instanceof Emit2) {
      const event2 = new Emit(action[0], action[1]);
      for (const [_, renderer] of this.#renderers) {
        renderer(event2);
      }
    } else if (action instanceof Event3) {
      const handler = this.#handlers.get(action[0]);
      if (!handler)
        return;
      const msg = handler(action[1]);
      if (msg instanceof Error)
        return;
      this.#queue.push(msg[0]);
      this.#tick();
    } else if (action instanceof Subscribe) {
      const attrs = keys(this.#onAttributeChange);
      const patch = new Init(attrs, this.#html);
      this.#renderers = this.#renderers.set(action[0], action[1]);
      action[1](patch);
    } else if (action instanceof Unsubscribe) {
      this.#renderers = this.#renderers.delete(action[0]);
    }
  }
  #model;
  #update;
  #queue;
  #view;
  #html;
  #renderers;
  #handlers;
  #onAttributeChange;
  #tick(effects = []) {
    if (!this.#flush(false, effects))
      return;
    const vdom = this.#view(this.#model);
    const diff2 = elements(this.#html, vdom);
    if (!is_empty_element_diff(diff2)) {
      const patch = new Diff(diff2);
      for (const [_, renderer] of this.#renderers) {
        renderer(patch);
      }
    }
    this.#html = vdom;
    this.#handlers = diff2.handlers;
  }
  #flush(didUpdate = false, effects = []) {
    while (this.#queue.length > 0) {
      const msg = this.#queue.shift();
      const [next, effect] = this.#update(this.#model, msg);
      didUpdate ||= this.#model !== next;
      effects = effects.concat(effect.all.toArray());
      this.#model = next;
    }
    while (effects.length > 0) {
      const effect = effects.shift();
      const dispatch = (msg) => this.send(new Dispatch(msg));
      const emit2 = (event2, data) => this.root.dispatchEvent(
        new CustomEvent(event2, {
          detail: data,
          bubbles: true,
          composed: true
        })
      );
      const select = () => {
      };
      const root = null;
      effect({ dispatch, emit: emit2, select, root });
    }
    if (this.#queue.length > 0) {
      return this.#flush(didUpdate, effects);
    } else {
      return didUpdate;
    }
  }
};
var start_server_application = LustreServerApplication.start;
var is_browser = () => globalThis.window && window.document;
var prevent_default = (event2) => event2.preventDefault();

// build/dev/javascript/lustre/lustre.mjs
var App = class extends CustomType {
  constructor(init4, update2, view2, on_attribute_change) {
    super();
    this.init = init4;
    this.update = update2;
    this.view = view2;
    this.on_attribute_change = on_attribute_change;
  }
};
var ElementNotFound = class extends CustomType {
  constructor(selector) {
    super();
    this.selector = selector;
  }
};
var NotABrowser = class extends CustomType {
};
function component(init4, update2, view2, on_attribute_change) {
  return new App(init4, update2, view2, new Some(on_attribute_change));
}
function start2(app, selector, flags) {
  return guard(
    !is_browser(),
    new Error(new NotABrowser()),
    () => {
      return start(app, selector, flags);
    }
  );
}

// build/dev/javascript/plinth/document_ffi.mjs
function querySelector(query) {
  let found = document.querySelector(query);
  if (!found) {
    return new Error();
  }
  return new Ok(found);
}
function getElementById(id2) {
  let found = document.getElementById(id2);
  if (!found) {
    return new Error();
  }
  return new Ok(found);
}

// build/dev/javascript/plinth/element_ffi.mjs
function innerText(element3) {
  return element3.innerText;
}
function scrollHeight(element3) {
  return element3.scrollHeight;
}
function setScrollTop(element3, value4) {
  element3.scrollTop = value4;
}

// build/dev/javascript/birl/birl_ffi.mjs
function now() {
  return Date.now() * 1e3;
}
function monotonic_now() {
  return Math.floor(globalThis.performance.now() * 1e3);
}

// build/dev/javascript/birl/birl.mjs
var Time = class extends CustomType {
  constructor(wall_time, offset, timezone, monotonic_time) {
    super();
    this.wall_time = wall_time;
    this.offset = offset;
    this.timezone = timezone;
    this.monotonic_time = monotonic_time;
  }
};
function to_unix(value4) {
  {
    let t = value4.wall_time;
    return divideInt(t, 1e6);
  }
}
function from_unix(value4) {
  return new Time(value4 * 1e6, 0, new None(), new None());
}
function compare3(a, b) {
  let wta = a.wall_time;
  let mta = a.monotonic_time;
  let wtb = b.wall_time;
  let mtb = b.monotonic_time;
  let $ = (() => {
    if (mta instanceof Some && mtb instanceof Some) {
      let ta2 = mta[0];
      let tb2 = mtb[0];
      return [ta2, tb2];
    } else {
      return [wta, wtb];
    }
  })();
  let ta = $[0];
  let tb = $[1];
  let $1 = ta === tb;
  let $2 = ta < tb;
  if ($1) {
    return new Eq();
  } else if ($2) {
    return new Lt();
  } else {
    return new Gt();
  }
}
function utc_now() {
  let now$1 = now();
  let monotonic_now$1 = monotonic_now();
  return new Time(
    now$1,
    0,
    new Some("Etc/UTC"),
    new Some(monotonic_now$1)
  );
}

// build/dev/javascript/lustre_pipes/lustre_pipes/element.mjs
function element2(tag) {
  return [tag, toList([])];
}
function empty(scaffold) {
  return element(scaffold[0], scaffold[1], toList([]));
}
function text_content(scaffold, content) {
  return element(
    scaffold[0],
    scaffold[1],
    toList([text(content)])
  );
}
function children2(scaffold, children3) {
  return element(scaffold[0], scaffold[1], children3);
}
function keyed2(scaffold, pairs) {
  return keyed(
    (_capture) => {
      return children2(scaffold, _capture);
    },
    pairs
  );
}

// build/dev/javascript/lustre_pipes/lustre_pipes/attribute.mjs
function attribute2(scaffold, name, value4) {
  return [
    scaffold[0],
    prepend(attribute(name, value4), scaffold[1])
  ];
}
function class$(scaffold, name) {
  let _pipe = scaffold;
  return attribute2(_pipe, "class", name);
}
function id(scaffold, name) {
  let _pipe = scaffold;
  return attribute2(_pipe, "id", name);
}
function type_(scaffold, name) {
  let _pipe = scaffold;
  return attribute2(_pipe, "type", name);
}
function value2(scaffold, val) {
  let _pipe = scaffold;
  return attribute2(_pipe, "value", val);
}

// build/dev/javascript/lustre_pipes/lustre_pipes/element/html.mjs
function div() {
  return ["div", toList([])];
}
function p() {
  return ["p", toList([])];
}
function form() {
  return ["form", toList([])];
}
function input() {
  return ["input", toList([])];
}

// build/dev/javascript/lustre_pipes/lustre_pipes/event.mjs
function on2(scaffold, name, handler) {
  return [scaffold[0], prepend(on(name, handler), scaffold[1])];
}
function on_submit(scaffold, msg) {
  return on2(
    scaffold,
    "submit",
    (event2) => {
      let $ = prevent_default(event2);
      return new Ok(msg);
    }
  );
}
function value3(event2) {
  let _pipe = event2;
  return field("target", field("value", string))(
    _pipe
  );
}
function on_input(scaffold, msg) {
  return on2(
    scaffold,
    "input",
    (event2) => {
      let _pipe = value3(event2);
      return map3(_pipe, msg);
    }
  );
}

// build/dev/javascript/lustre_pipes/lustre_pipes/server_component.mjs
function component2() {
  return element2("lustre-server-component");
}
function route(server_component, path) {
  let _pipe = server_component;
  return attribute2(_pipe, "route", path);
}

// build/dev/javascript/gleam_stdlib/gleam/uri.mjs
var Uri = class extends CustomType {
  constructor(scheme, userinfo, host, port, path, query, fragment) {
    super();
    this.scheme = scheme;
    this.userinfo = userinfo;
    this.host = host;
    this.port = port;
    this.path = path;
    this.query = query;
    this.fragment = fragment;
  }
};
function regex_submatches(pattern, string4) {
  let _pipe = pattern;
  let _pipe$1 = compile(_pipe, new Options(true, false));
  let _pipe$2 = replace_error(_pipe$1, void 0);
  let _pipe$3 = map3(
    _pipe$2,
    (_capture) => {
      return scan(_capture, string4);
    }
  );
  let _pipe$4 = try$(_pipe$3, first);
  let _pipe$5 = map3(_pipe$4, (m) => {
    return m.submatches;
  });
  return unwrap2(_pipe$5, toList([]));
}
function noneify_query(x) {
  if (x instanceof None) {
    return new None();
  } else {
    let x$1 = x[0];
    let $ = pop_grapheme2(x$1);
    if ($.isOk() && $[0][0] === "?") {
      let query = $[0][1];
      return new Some(query);
    } else {
      return new None();
    }
  }
}
function noneify_empty_string(x) {
  if (x instanceof Some && x[0] === "") {
    return new None();
  } else if (x instanceof None) {
    return new None();
  } else {
    return x;
  }
}
function extra_required(loop$list, loop$remaining) {
  while (true) {
    let list4 = loop$list;
    let remaining = loop$remaining;
    if (remaining === 0) {
      return 0;
    } else if (list4.hasLength(0)) {
      return remaining;
    } else {
      let rest = list4.tail;
      loop$list = rest;
      loop$remaining = remaining - 1;
    }
  }
}
function pad_list(list4, size) {
  let _pipe = list4;
  return append(
    _pipe,
    repeat(new None(), extra_required(list4, size))
  );
}
function split_authority(authority) {
  let $ = unwrap(authority, "");
  if ($ === "") {
    return [new None(), new None(), new None()];
  } else if ($ === "//") {
    return [new None(), new Some(""), new None()];
  } else {
    let authority$1 = $;
    let matches = (() => {
      let _pipe = "^(//)?((.*)@)?(\\[[a-zA-Z0-9:.]*\\]|[^:]*)(:(\\d*))?";
      let _pipe$1 = regex_submatches(_pipe, authority$1);
      return pad_list(_pipe$1, 6);
    })();
    if (matches.hasLength(6)) {
      let userinfo = matches.tail.tail.head;
      let host = matches.tail.tail.tail.head;
      let port = matches.tail.tail.tail.tail.tail.head;
      let userinfo$1 = noneify_empty_string(userinfo);
      let host$1 = noneify_empty_string(host);
      let port$1 = (() => {
        let _pipe = port;
        let _pipe$1 = unwrap(_pipe, "");
        let _pipe$2 = parse(_pipe$1);
        return from_result(_pipe$2);
      })();
      return [userinfo$1, host$1, port$1];
    } else {
      return [new None(), new None(), new None()];
    }
  }
}
function do_parse(uri_string) {
  let pattern = "^(([a-z][a-z0-9\\+\\-\\.]*):)?(//([^/?#]*))?([^?#]*)(\\?([^#]*))?(#.*)?";
  let matches = (() => {
    let _pipe = pattern;
    let _pipe$1 = regex_submatches(_pipe, uri_string);
    return pad_list(_pipe$1, 8);
  })();
  let $ = (() => {
    if (matches.hasLength(8)) {
      let scheme2 = matches.tail.head;
      let authority_with_slashes = matches.tail.tail.head;
      let path2 = matches.tail.tail.tail.tail.head;
      let query_with_question_mark = matches.tail.tail.tail.tail.tail.head;
      let fragment2 = matches.tail.tail.tail.tail.tail.tail.tail.head;
      return [
        scheme2,
        authority_with_slashes,
        path2,
        query_with_question_mark,
        fragment2
      ];
    } else {
      return [new None(), new None(), new None(), new None(), new None()];
    }
  })();
  let scheme = $[0];
  let authority = $[1];
  let path = $[2];
  let query = $[3];
  let fragment = $[4];
  let scheme$1 = noneify_empty_string(scheme);
  let path$1 = unwrap(path, "");
  let query$1 = noneify_query(query);
  let $1 = split_authority(authority);
  let userinfo = $1[0];
  let host = $1[1];
  let port = $1[2];
  let fragment$1 = (() => {
    let _pipe = fragment;
    let _pipe$1 = to_result(_pipe, void 0);
    let _pipe$2 = try$(_pipe$1, pop_grapheme2);
    let _pipe$3 = map3(_pipe$2, second);
    return from_result(_pipe$3);
  })();
  let scheme$2 = (() => {
    let _pipe = scheme$1;
    let _pipe$1 = noneify_empty_string(_pipe);
    return map(_pipe$1, lowercase2);
  })();
  return new Ok(
    new Uri(scheme$2, userinfo, host, port, path$1, query$1, fragment$1)
  );
}
function parse2(uri_string) {
  return do_parse(uri_string);
}
function remove_dot_segments_loop(loop$input, loop$accumulator) {
  while (true) {
    let input2 = loop$input;
    let accumulator = loop$accumulator;
    if (input2.hasLength(0)) {
      return reverse(accumulator);
    } else {
      let segment = input2.head;
      let rest = input2.tail;
      let accumulator$1 = (() => {
        if (segment === "") {
          let accumulator$12 = accumulator;
          return accumulator$12;
        } else if (segment === ".") {
          let accumulator$12 = accumulator;
          return accumulator$12;
        } else if (segment === ".." && accumulator.hasLength(0)) {
          return toList([]);
        } else if (segment === ".." && accumulator.atLeastLength(1)) {
          let accumulator$12 = accumulator.tail;
          return accumulator$12;
        } else {
          let segment$1 = segment;
          let accumulator$12 = accumulator;
          return prepend(segment$1, accumulator$12);
        }
      })();
      loop$input = rest;
      loop$accumulator = accumulator$1;
    }
  }
}
function remove_dot_segments(input2) {
  return remove_dot_segments_loop(input2, toList([]));
}
function to_string9(uri) {
  let parts = (() => {
    let $ = uri.fragment;
    if ($ instanceof Some) {
      let fragment = $[0];
      return toList(["#", fragment]);
    } else {
      return toList([]);
    }
  })();
  let parts$1 = (() => {
    let $ = uri.query;
    if ($ instanceof Some) {
      let query = $[0];
      return prepend("?", prepend(query, parts));
    } else {
      return parts;
    }
  })();
  let parts$2 = prepend(uri.path, parts$1);
  let parts$3 = (() => {
    let $ = uri.host;
    let $1 = starts_with2(uri.path, "/");
    if ($ instanceof Some && !$1 && $[0] !== "") {
      let host = $[0];
      return prepend("/", parts$2);
    } else {
      return parts$2;
    }
  })();
  let parts$4 = (() => {
    let $ = uri.host;
    let $1 = uri.port;
    if ($ instanceof Some && $1 instanceof Some) {
      let port = $1[0];
      return prepend(":", prepend(to_string2(port), parts$3));
    } else {
      return parts$3;
    }
  })();
  let parts$5 = (() => {
    let $ = uri.scheme;
    let $1 = uri.userinfo;
    let $2 = uri.host;
    if ($ instanceof Some && $1 instanceof Some && $2 instanceof Some) {
      let s = $[0];
      let u = $1[0];
      let h = $2[0];
      return prepend(
        s,
        prepend(
          "://",
          prepend(u, prepend("@", prepend(h, parts$4)))
        )
      );
    } else if ($ instanceof Some && $1 instanceof None && $2 instanceof Some) {
      let s = $[0];
      let h = $2[0];
      return prepend(s, prepend("://", prepend(h, parts$4)));
    } else if ($ instanceof Some && $1 instanceof Some && $2 instanceof None) {
      let s = $[0];
      return prepend(s, prepend(":", parts$4));
    } else if ($ instanceof Some && $1 instanceof None && $2 instanceof None) {
      let s = $[0];
      return prepend(s, prepend(":", parts$4));
    } else if ($ instanceof None && $1 instanceof None && $2 instanceof Some) {
      let h = $2[0];
      return prepend("//", prepend(h, parts$4));
    } else {
      return parts$4;
    }
  })();
  return concat2(parts$5);
}
function drop_last(elements2) {
  return take(elements2, length(elements2) - 1);
}
function join_segments(segments) {
  return join2(prepend("", segments), "/");
}
function merge2(base, relative) {
  if (base instanceof Uri && base.scheme instanceof Some && base.host instanceof Some) {
    if (relative instanceof Uri && relative.host instanceof Some) {
      let path = (() => {
        let _pipe = split3(relative.path, "/");
        let _pipe$1 = remove_dot_segments(_pipe);
        return join_segments(_pipe$1);
      })();
      let resolved = new Uri(
        or(relative.scheme, base.scheme),
        new None(),
        relative.host,
        or(relative.port, base.port),
        path,
        relative.query,
        relative.fragment
      );
      return new Ok(resolved);
    } else {
      let $ = (() => {
        let $1 = relative.path;
        if ($1 === "") {
          return [base.path, or(relative.query, base.query)];
        } else {
          let path_segments$1 = (() => {
            let $2 = starts_with2(relative.path, "/");
            if ($2) {
              return split3(relative.path, "/");
            } else {
              let _pipe = split3(base.path, "/");
              let _pipe$1 = drop_last(_pipe);
              return append(_pipe$1, split3(relative.path, "/"));
            }
          })();
          let path = (() => {
            let _pipe = path_segments$1;
            let _pipe$1 = remove_dot_segments(_pipe);
            return join_segments(_pipe$1);
          })();
          return [path, relative.query];
        }
      })();
      let new_path = $[0];
      let new_query = $[1];
      let resolved = new Uri(
        base.scheme,
        new None(),
        base.host,
        base.port,
        new_path,
        new_query,
        relative.fragment
      );
      return new Ok(resolved);
    }
  } else {
    return new Error(void 0);
  }
}

// build/dev/javascript/omnimessage_lustre/websocket.ffi.mjs
var ws_init = (url, on_open, on_text, on_close) => {
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
};
var ws_listen = (ws, on_open, on_text, on_close) => {
  ws.addEventListener("open", (_) => on_open(ws));
  ws.addEventListener("message", (event2) => {
    if (typeof event2.data === "string") {
      on_text(event2.data);
    }
  });
  ws.addEventListener(
    "close",
    (event2) => on_close(event2.code, event2.reason ?? "")
  );
};
var ws_send = (ws, msg) => {
  ws.send(msg);
};
var get_page_url = () => document.URL;

// build/dev/javascript/omnimessage_lustre/omnimessage_lustre/internal/transports/websocket.mjs
var Normal = class extends CustomType {
  constructor(code2, reason) {
    super();
    this.code = code2;
    this.reason = reason;
  }
};
var GoingAway = class extends CustomType {
  constructor(code2, reason) {
    super();
    this.code = code2;
    this.reason = reason;
  }
};
var ProtocolError = class extends CustomType {
  constructor(code2, reason) {
    super();
    this.code = code2;
    this.reason = reason;
  }
};
var UnexpectedTypeOfData = class extends CustomType {
  constructor(code2, reason) {
    super();
    this.code = code2;
    this.reason = reason;
  }
};
var NoCodeFromServer = class extends CustomType {
  constructor(code2, reason) {
    super();
    this.code = code2;
    this.reason = reason;
  }
};
var AbnormalClose = class extends CustomType {
  constructor(code2, reason) {
    super();
    this.code = code2;
    this.reason = reason;
  }
};
var IncomprehensibleFrame = class extends CustomType {
  constructor(code2, reason) {
    super();
    this.code = code2;
    this.reason = reason;
  }
};
var PolicyViolated = class extends CustomType {
  constructor(code2, reason) {
    super();
    this.code = code2;
    this.reason = reason;
  }
};
var MessageTooBig = class extends CustomType {
  constructor(code2, reason) {
    super();
    this.code = code2;
    this.reason = reason;
  }
};
var FailedExtensionNegotation = class extends CustomType {
  constructor(code2, reason) {
    super();
    this.code = code2;
    this.reason = reason;
  }
};
var UnexpectedFailure = class extends CustomType {
  constructor(code2, reason) {
    super();
    this.code = code2;
    this.reason = reason;
  }
};
var ServiceRestart = class extends CustomType {
  constructor(code2, reason) {
    super();
    this.code = code2;
    this.reason = reason;
  }
};
var TryAgainLater = class extends CustomType {
  constructor(code2, reason) {
    super();
    this.code = code2;
    this.reason = reason;
  }
};
var BadGateway = class extends CustomType {
  constructor(code2, reason) {
    super();
    this.code = code2;
    this.reason = reason;
  }
};
var FailedTLSHandshake = class extends CustomType {
  constructor(code2, reason) {
    super();
    this.code = code2;
    this.reason = reason;
  }
};
var OtherCloseReason = class extends CustomType {
  constructor(code2, reason) {
    super();
    this.code = code2;
    this.reason = reason;
  }
};
var InvalidUrl = class extends CustomType {
  constructor(message) {
    super();
    this.message = message;
  }
};
var UnsupportedEnvironment = class extends CustomType {
  constructor(message) {
    super();
    this.message = message;
  }
};
function parse_reason(code2, reason) {
  if (code2 === 1e3) {
    return new Normal(code2, reason);
  } else if (code2 === 1001) {
    return new GoingAway(code2, reason);
  } else if (code2 === 1002) {
    return new ProtocolError(code2, reason);
  } else if (code2 === 1003) {
    return new UnexpectedTypeOfData(code2, reason);
  } else if (code2 === 1005) {
    return new NoCodeFromServer(code2, reason);
  } else if (code2 === 1006) {
    return new AbnormalClose(code2, reason);
  } else if (code2 === 1007) {
    return new IncomprehensibleFrame(code2, reason);
  } else if (code2 === 1008) {
    return new PolicyViolated(code2, reason);
  } else if (code2 === 1009) {
    return new MessageTooBig(code2, reason);
  } else if (code2 === 1010) {
    return new FailedExtensionNegotation(code2, reason);
  } else if (code2 === 1011) {
    return new UnexpectedFailure(code2, reason);
  } else if (code2 === 1012) {
    return new ServiceRestart(code2, reason);
  } else if (code2 === 1013) {
    return new TryAgainLater(code2, reason);
  } else if (code2 === 1014) {
    return new BadGateway(code2, reason);
  } else if (code2 === 1015) {
    return new FailedTLSHandshake(code2, reason);
  } else {
    return new OtherCloseReason(code2, reason);
  }
}
function convert_scheme(scheme) {
  if (scheme === "https") {
    return new Ok("wss");
  } else if (scheme === "http") {
    return new Ok("ws");
  } else if (scheme === "ws") {
    return new Ok(scheme);
  } else if (scheme === "wss") {
    return new Ok(scheme);
  } else {
    return new Error(void 0);
  }
}
function do_get_websocket_path(path, page_uri2) {
  let path_uri = (() => {
    let _pipe = parse2(path);
    return unwrap2(
      _pipe,
      new Uri(
        new None(),
        new None(),
        new None(),
        new None(),
        path,
        new None(),
        new None()
      )
    );
  })();
  return try$(
    merge2(page_uri2, path_uri),
    (merged) => {
      return try$(
        to_result(merged.scheme, void 0),
        (merged_scheme) => {
          return try$(
            convert_scheme(merged_scheme),
            (ws_scheme) => {
              let _pipe = merged.withFields({ scheme: new Some(ws_scheme) });
              let _pipe$1 = to_string9(_pipe);
              return new Ok(_pipe$1);
            }
          );
        }
      );
    }
  );
}
function listen(ws, on_open, on_text_message, on_close) {
  return ws_listen(
    ws,
    on_open,
    on_text_message,
    (code2, reason) => {
      let _pipe = parse_reason(code2, reason);
      return on_close(_pipe);
    }
  );
}
function page_uri() {
  let _pipe = get_page_url();
  return parse2(_pipe);
}
function get_websocket_path(path) {
  let _pipe = page_uri();
  return try$(
    _pipe,
    (_capture) => {
      return do_get_websocket_path(path, _capture);
    }
  );
}
function init2(path) {
  let $ = get_websocket_path(path);
  if ($.isOk()) {
    let url = $[0];
    return ws_init(url);
  } else {
    return new Error(new InvalidUrl("Invalid Url"));
  }
}

// build/dev/javascript/omnimessage_lustre/omnimessage_lustre/transports.mjs
var TransportUp = class extends CustomType {
};
var TransportDown = class extends CustomType {
  constructor(code2, message) {
    super();
    this.code = code2;
    this.message = message;
  }
};
var TransportError = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var InitError = class extends CustomType {
  constructor(message) {
    super();
    this.message = message;
  }
};
var DecodeError2 = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var TransportHandlers = class extends CustomType {
  constructor(on_up, on_down, on_message, on_error) {
    super();
    this.on_up = on_up;
    this.on_down = on_down;
    this.on_message = on_message;
    this.on_error = on_error;
  }
};
var Transport = class extends CustomType {
  constructor(listen2, send2) {
    super();
    this.listen = listen2;
    this.send = send2;
  }
};
function websocket(path) {
  let $ = init2(path);
  if ($.isOk()) {
    let ws = $[0];
    return new Transport(
      (handlers2) => {
        return listen(
          ws,
          (_) => {
            return handlers2.on_up();
          },
          handlers2.on_message,
          (reason) => {
            return handlers2.on_down(reason.code, reason.reason);
          }
        );
      },
      (msg, _) => {
        return ws_send(ws, msg);
      }
    );
  } else {
    let error = $[0];
    return new Transport(
      (handlers2) => {
        return handlers2.on_error(new InitError(error.message));
      },
      (_, _1) => {
        return void 0;
      }
    );
  }
}

// build/dev/javascript/omnimessage_lustre/omnimessage_lustre.mjs
var EncoderDecoder = class extends CustomType {
  constructor(encode, decode3) {
    super();
    this.encode = encode;
    this.decode = decode3;
  }
};
var CodedTransport = class extends CustomType {
  constructor(listen2, send2) {
    super();
    this.listen = listen2;
    this.send = send2;
  }
};
function new_handlers(on_message, on_state, encoder_decoder) {
  return new TransportHandlers(
    () => {
      return on_state(new TransportUp());
    },
    (code2, reason) => {
      return on_state(new TransportDown(code2, reason));
    },
    (encoded_msg) => {
      let $ = (() => {
        let _pipe = encoded_msg;
        return encoder_decoder.decode(_pipe);
      })();
      if ($.isOk()) {
        let msg = $[0];
        return on_message(msg);
      } else {
        let decode_error2 = $[0];
        return on_state(
          new TransportError(
            new DecodeError2(decode_error2)
          )
        );
      }
    },
    (error) => {
      return on_state(new TransportError(error));
    }
  );
}
function to_coded_transport(base, encoder_decoder) {
  return new CodedTransport(
    (on_message, on_state) => {
      return base.listen(new_handlers(on_message, on_state, encoder_decoder));
    },
    (msg, on_message, on_state) => {
      let $ = encoder_decoder.encode(msg);
      if ($.isOk()) {
        let msg$1 = $[0];
        return base.send(
          msg$1,
          new_handlers(on_message, on_state, encoder_decoder)
        );
      } else {
        return void 0;
      }
    }
  );
}
function compose(init4, update2, transport, encoder_decoder, meta_wrapper) {
  let coded_transport = (() => {
    let _pipe = transport;
    return to_coded_transport(_pipe, encoder_decoder);
  })();
  let omniinit = (flags) => {
    let transport_effect = (() => {
      let _pipe = (dispatch) => {
        coded_transport.listen(
          dispatch,
          (state) => {
            return dispatch(meta_wrapper(state));
          }
        );
        return void 0;
      };
      return from(_pipe);
    })();
    let $ = init4(flags);
    let model = $[0];
    let effect = $[1];
    return [model, batch(toList([effect, transport_effect]))];
  };
  let omniupdate = (model, msg) => {
    let $ = update2(model, msg);
    let updated_model = $[0];
    let effect = $[1];
    return [
      updated_model,
      batch(
        toList([
          (() => {
            let _pipe = (dispatch) => {
              return coded_transport.send(
                msg,
                dispatch,
                (state) => {
                  return dispatch(meta_wrapper(state));
                }
              );
            };
            return from(_pipe);
          })(),
          effect
        ])
      )
    ];
  };
  return [omniinit, omniupdate];
}
function component3(init4, update2, view2, on_attribute_change, encoder_decoder, transport, transport_wrapper) {
  let $ = compose(init4, update2, transport, encoder_decoder, transport_wrapper);
  let omniinit = $[0];
  let omniupdate = $[1];
  return component(omniinit, omniupdate, view2, on_attribute_change);
}

// build/dev/javascript/decode/decode_ffi.mjs
function strict_index(data, key2) {
  const int4 = Number.isInteger(key2);
  if (data instanceof Dict || data instanceof WeakMap || data instanceof Map) {
    const token = {};
    const entry = data.get(key2, token);
    if (entry === token)
      return new Ok(new None());
    return new Ok(new Some(entry));
  }
  if ((key2 === 0 || key2 === 1 || key2 === 2) && data instanceof List) {
    let i = 0;
    for (const value4 of data) {
      if (i === key2)
        return new Ok(new Some(value4));
      i++;
    }
    return new Error("Indexable");
  }
  if (int4 && Array.isArray(data) || data && typeof data === "object" || data && Object.getPrototypeOf(data) === Object.prototype) {
    if (key2 in data)
      return new Ok(new Some(data[key2]));
    return new Ok(new None());
  }
  return new Error(int4 ? "Indexable" : "Dict");
}
function list2(data, decode3, pushPath, index4, emptyList) {
  if (!(data instanceof List || Array.isArray(data))) {
    let error = new DecodeError("List", classify(data), emptyList);
    return [emptyList, List.fromArray([error])];
  }
  const decoded = [];
  for (const element3 of data) {
    const layer = decode3(element3);
    const [out, errors] = layer;
    if (errors instanceof NonEmpty) {
      const [_, errors2] = pushPath(layer, index4.toString());
      return [emptyList, errors2];
    }
    decoded.push(out);
    index4++;
  }
  return [List.fromArray(decoded), emptyList];
}

// build/dev/javascript/decode/decode/zero.mjs
var Decoder = class extends CustomType {
  constructor(function$) {
    super();
    this.function = function$;
  }
};
function run(data, decoder) {
  let $ = decoder.function(data);
  let maybe_invalid_data = $[0];
  let errors = $[1];
  if (errors.hasLength(0)) {
    return new Ok(maybe_invalid_data);
  } else {
    return new Error(errors);
  }
}
function success(data) {
  return new Decoder((_) => {
    return [data, toList([])];
  });
}
function run_dynamic_function(data, zero, f) {
  let $ = f(data);
  if ($.isOk()) {
    let data$1 = $[0];
    return [data$1, toList([])];
  } else {
    let errors = $[0];
    return [zero, errors];
  }
}
function then$2(decoder, next) {
  return new Decoder(
    (dynamic_data) => {
      let $ = decoder.function(dynamic_data);
      let data = $[0];
      let errors = $[1];
      let decoder$1 = next(data);
      let $1 = decoder$1.function(dynamic_data);
      let layer = $1;
      let data$1 = $1[0];
      if (errors.hasLength(0)) {
        return layer;
      } else {
        return [data$1, errors];
      }
    }
  );
}
function decode_error(expected, found) {
  return toList([
    new DecodeError(expected, classify(found), toList([]))
  ]);
}
function decode_string2(data) {
  return run_dynamic_function(data, "", string);
}
function decode_int2(data) {
  return run_dynamic_function(data, 0, int);
}
function failure(zero, expected) {
  return new Decoder((d) => {
    return [zero, decode_error(expected, d)];
  });
}
var string3 = /* @__PURE__ */ new Decoder(decode_string2);
var int3 = /* @__PURE__ */ new Decoder(decode_int2);
function list3(inner) {
  return new Decoder(
    (data) => {
      return list2(
        data,
        inner.function,
        (p2, k) => {
          return push_path2(p2, toList([k]));
        },
        0,
        toList([])
      );
    }
  );
}
function push_path2(layer, path) {
  let decoder = any(
    toList([
      string,
      (x) => {
        return map3(int(x), to_string2);
      }
    ])
  );
  let path$1 = map2(
    path,
    (key2) => {
      let key$1 = identity(key2);
      let $ = decoder(key$1);
      if ($.isOk()) {
        let key$2 = $[0];
        return key$2;
      } else {
        return "<" + classify(key$1) + ">";
      }
    }
  );
  let errors = map2(
    layer[1],
    (error) => {
      return error.withFields({ path: append(path$1, error.path) });
    }
  );
  return [layer[0], errors];
}
function index3(loop$path, loop$position, loop$inner, loop$data, loop$handle_miss) {
  while (true) {
    let path = loop$path;
    let position = loop$position;
    let inner = loop$inner;
    let data = loop$data;
    let handle_miss = loop$handle_miss;
    if (path.hasLength(0)) {
      let _pipe = inner(data);
      return push_path2(_pipe, reverse(position));
    } else {
      let key2 = path.head;
      let path$1 = path.tail;
      let $ = strict_index(data, key2);
      if ($.isOk() && $[0] instanceof Some) {
        let data$1 = $[0][0];
        loop$path = path$1;
        loop$position = prepend(key2, position);
        loop$inner = inner;
        loop$data = data$1;
        loop$handle_miss = handle_miss;
      } else if ($.isOk() && $[0] instanceof None) {
        return handle_miss(data, prepend(key2, position));
      } else {
        let kind = $[0];
        let $1 = inner(data);
        let default$ = $1[0];
        let _pipe = [
          default$,
          toList([new DecodeError(kind, classify(data), toList([]))])
        ];
        return push_path2(_pipe, reverse(position));
      }
    }
  }
}
function subfield(field_path, field_decoder, next) {
  return new Decoder(
    (data) => {
      let $ = index3(
        field_path,
        toList([]),
        field_decoder.function,
        data,
        (data2, position) => {
          let $12 = field_decoder.function(data2);
          let default$ = $12[0];
          let _pipe = [
            default$,
            toList([new DecodeError("Field", "Nothing", toList([]))])
          ];
          return push_path2(_pipe, reverse(position));
        }
      );
      let out = $[0];
      let errors1 = $[1];
      let $1 = next(out).function(data);
      let out$1 = $1[0];
      let errors2 = $1[1];
      return [out$1, append(errors1, errors2)];
    }
  );
}
function field2(field_name, field_decoder, next) {
  return subfield(toList([field_name]), field_decoder, next);
}

// build/dev/javascript/gluid/gluid.mjs
function format_uuid(src) {
  return slice(src, 0, 8) + "-" + slice(src, 8, 4) + "-" + slice(
    src,
    12,
    4
  ) + "-" + slice(src, 16, 4) + "-" + slice(src, 20, 12);
}
function guidv4() {
  let randoma = random(4294967295);
  let a = (() => {
    let _pipe = to_base16(randoma);
    return pad_left(_pipe, 8, "0");
  })();
  let randomb = random(4294967295);
  let clear_mask = bitwise_not(bitwise_shift_left(15, 12));
  let randomb$1 = bitwise_and(randomb, clear_mask);
  let value_mask = bitwise_shift_left(4, 12);
  let randomb$2 = bitwise_or(randomb$1, value_mask);
  let b = (() => {
    let _pipe = to_base16(randomb$2);
    return pad_left(_pipe, 8, "0");
  })();
  let randomc = random(4294967295);
  let clear_mask$1 = bitwise_not(bitwise_shift_left(3, 30));
  let randomc$1 = bitwise_and(randomc, clear_mask$1);
  let value_mask$1 = bitwise_shift_left(2, 30);
  let randomc$2 = bitwise_or(randomc$1, value_mask$1);
  let c = (() => {
    let _pipe = to_base16(randomc$2);
    return pad_left(_pipe, 8, "0");
  })();
  let randomd = random(4294967295);
  let d = (() => {
    let _pipe = randomd;
    let _pipe$1 = to_base16(_pipe);
    return pad_left(_pipe$1, 8, "0");
  })();
  let concatened = a + b + c + d;
  return format_uuid(concatened);
}

// build/dev/javascript/shared/shared.mjs
var UserSendChatMessage = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var UserDeleteChatMessage = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var FetchChatMessages = class extends CustomType {
};
var ServerUpsertChatMessages = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var ChatMessage = class extends CustomType {
  constructor(id2, content, status, sent_at) {
    super();
    this.id = id2;
    this.content = content;
    this.status = status;
    this.sent_at = sent_at;
  }
};
var ClientError = class extends CustomType {
};
var ServerError = class extends CustomType {
};
var Sent = class extends CustomType {
};
var Received = class extends CustomType {
};
var Sending = class extends CustomType {
};
function new_chat_msg(content, status) {
  return new ChatMessage(
    (() => {
      let _pipe = guidv4();
      return lowercase2(_pipe);
    })(),
    content,
    status,
    utc_now()
  );
}
function status_decoder() {
  return then$2(
    int3,
    (decoded_string) => {
      if (decoded_string === 0) {
        return success(new ClientError());
      } else if (decoded_string === 1) {
        return success(new ServerError());
      } else if (decoded_string === 2) {
        return success(new Sent());
      } else if (decoded_string === 3) {
        return success(new Received());
      } else if (decoded_string === 4) {
        return success(new Sending());
      } else {
        return failure(new ClientError(), "MessageStatus");
      }
    }
  );
}
function chat_message_decoder() {
  return field2(
    "id",
    string3,
    (id2) => {
      return field2(
        "content",
        string3,
        (content) => {
          return field2(
            "status",
            status_decoder(),
            (status) => {
              return field2(
                "sent_at",
                int3,
                (sent_at_unix) => {
                  let sent_at = from_unix(sent_at_unix);
                  return success(
                    new ChatMessage(id2, content, status, sent_at)
                  );
                }
              );
            }
          );
        }
      );
    }
  );
}
function decode_server_message(str_msg) {
  let decoder = field2(
    0,
    int3,
    (id2) => {
      if (id2 === 0) {
        return field2(
          1,
          list3(chat_message_decoder()),
          (chat_msgs) => {
            let chat_msgs$1 = (() => {
              let _pipe2 = chat_msgs;
              let _pipe$1 = map2(
                _pipe2,
                (chat_msg) => {
                  return [chat_msg.id, chat_msg];
                }
              );
              return from_list(_pipe$1);
            })();
            return success(new ServerUpsertChatMessages(chat_msgs$1));
          }
        );
      } else {
        return failure(
          new ServerUpsertChatMessages(new$()),
          "ServerMessage"
        );
      }
    }
  );
  let _pipe = str_msg;
  return decode2(
    _pipe,
    (_capture) => {
      return run(_capture, decoder);
    }
  );
}
function encode_status(status) {
  if (status instanceof ClientError) {
    return 0;
  } else if (status instanceof ServerError) {
    return 1;
  } else if (status instanceof Sent) {
    return 2;
  } else if (status instanceof Received) {
    return 3;
  } else {
    return 4;
  }
}
function chat_message_to_json(message) {
  return object2(
    toList([
      [
        "id",
        (() => {
          let _pipe = message.id;
          return string2(_pipe);
        })()
      ],
      ["content", string2(message.content)],
      ["status", int2(encode_status(message.status))],
      ["sent_at", int2(to_unix(message.sent_at))]
    ])
  );
}
function encode_client_message(msg) {
  let _pipe = (() => {
    if (msg instanceof UserSendChatMessage) {
      let chat_msg = msg[0];
      return toList([int2(0), chat_message_to_json(chat_msg)]);
    } else if (msg instanceof UserDeleteChatMessage) {
      let chat_msg_id = msg[0];
      return toList([int2(1), string2(chat_msg_id)]);
    } else {
      return toList([int2(2), null$()]);
    }
  })();
  let _pipe$1 = preprocessed_array(_pipe);
  return to_string5(_pipe$1);
}
function status_string(status) {
  if (status instanceof ClientError) {
    return "Client Error";
  } else if (status instanceof ServerError) {
    return "Server Error";
  } else if (status instanceof Sent) {
    return "Sent";
  } else if (status instanceof Received) {
    return "Received";
  } else {
    return "Sending";
  }
}

// build/dev/javascript/client/client/chat.mjs
var Model2 = class extends CustomType {
  constructor(chat_msgs, draft_content) {
    super();
    this.chat_msgs = chat_msgs;
    this.draft_content = draft_content;
  }
};
var UserSendDraft = class extends CustomType {
};
var UserScrollToLatest = class extends CustomType {
};
var UserUpdateDraftContent = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var ClientMessage = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var ServerMessage = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var TransportState = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
function init3(_) {
  return [new Model2(new$(), ""), none()];
}
function chat_message_element(chat_msg) {
  let _pipe = div();
  return children2(
    _pipe,
    toList([
      (() => {
        let _pipe$1 = p();
        return text_content(
          _pipe$1,
          status_string(chat_msg.status) + ": " + chat_msg.content
        );
      })()
    ])
  );
}
function sort_chat_messages(chat_msgs) {
  return sort(
    chat_msgs,
    (msg_a, msg_b) => {
      return compare3(msg_a.sent_at, msg_b.sent_at);
    }
  );
}
var msgs_container_id = "chat-msgs";
function scroll_to_latest_message() {
  return from(
    (_) => {
      let $ = (() => {
        let _pipe = getElementById(msgs_container_id);
        return then$(
          _pipe,
          (container) => {
            let _pipe$1 = scrollHeight(container);
            ((_capture) => {
              return setScrollTop(container, _capture);
            })(_pipe$1);
            return new Ok(void 0);
          }
        );
      })();
      return void 0;
    }
  );
}
function update(model, msg) {
  if (msg instanceof UserUpdateDraftContent) {
    let content = msg[0];
    return [model.withFields({ draft_content: content }), none()];
  } else if (msg instanceof UserSendDraft) {
    return [
      model.withFields({ draft_content: "" }),
      from(
        (dispatch) => {
          let _pipe = new_chat_msg(
            model.draft_content,
            new Sending()
          );
          let _pipe$1 = new UserSendChatMessage(_pipe);
          let _pipe$2 = new ClientMessage(_pipe$1);
          return dispatch(_pipe$2);
        }
      )
    ];
  } else if (msg instanceof UserScrollToLatest) {
    return [model, scroll_to_latest_message()];
  } else if (msg instanceof ClientMessage && msg[0] instanceof UserSendChatMessage) {
    let chat_msg = msg[0][0];
    let chat_msgs = (() => {
      let _pipe = model.chat_msgs;
      return insert(_pipe, chat_msg.id, chat_msg);
    })();
    return [
      model.withFields({ chat_msgs }),
      scroll_to_latest_message()
    ];
  } else if (msg instanceof ClientMessage) {
    return [model, none()];
  } else if (msg instanceof ServerMessage && msg[0] instanceof ServerUpsertChatMessages) {
    let server_messages = msg[0][0];
    let chat_msgs = (() => {
      let _pipe = model.chat_msgs;
      return merge(_pipe, server_messages);
    })();
    return [model.withFields({ chat_msgs }), none()];
  } else if (msg instanceof TransportState && msg[0] instanceof TransportUp) {
    return [
      model,
      from(
        (dispatch) => {
          return dispatch(new ClientMessage(new FetchChatMessages()));
        }
      )
    ];
  } else if (msg instanceof TransportState && msg[0] instanceof TransportDown) {
    return [model, none()];
  } else {
    return [model, none()];
  }
}
function view(model) {
  let sorted_chat_msgs = (() => {
    let _pipe2 = model.chat_msgs;
    let _pipe$12 = values(_pipe2);
    return sort_chat_messages(_pipe$12);
  })();
  let _pipe = div();
  let _pipe$1 = class$(
    _pipe,
    "h-full flex flex-col justify-center items-center gap-y-5"
  );
  return children2(
    _pipe$1,
    toList([
      (() => {
        let _pipe$2 = div();
        let _pipe$3 = class$(_pipe$2, "flex justify-center");
        return children2(
          _pipe$3,
          toList([
            (() => {
              let _pipe$4 = component2();
              let _pipe$5 = route(_pipe$4, "/sessions-count");
              return empty(_pipe$5);
            })()
          ])
        );
      })(),
      (() => {
        let _pipe$2 = div();
        let _pipe$3 = id(_pipe$2, msgs_container_id);
        let _pipe$4 = class$(
          _pipe$3,
          "h-80 w-80 overflow-y-auto p-5 border border-gray-400 rounded-xl"
        );
        return keyed2(
          _pipe$4,
          map2(
            sorted_chat_msgs,
            (chat_msg) => {
              return [chat_msg.id, chat_message_element(chat_msg)];
            }
          )
        );
      })(),
      (() => {
        let _pipe$2 = form();
        let _pipe$3 = class$(_pipe$2, "w-80 flex gap-x-4");
        let _pipe$4 = on_submit(_pipe$3, new UserSendDraft());
        return children2(
          _pipe$4,
          toList([
            (() => {
              let _pipe$5 = input();
              let _pipe$6 = on_input(
                _pipe$5,
                (var0) => {
                  return new UserUpdateDraftContent(var0);
                }
              );
              let _pipe$7 = type_(_pipe$6, "text");
              let _pipe$8 = value2(_pipe$7, model.draft_content);
              let _pipe$9 = class$(
                _pipe$8,
                "flex-1 border border-gray-400 rounded-lg p-1.5"
              );
              return empty(_pipe$9);
            })(),
            (() => {
              let _pipe$5 = input();
              let _pipe$6 = type_(_pipe$5, "submit");
              let _pipe$7 = value2(_pipe$6, "Send");
              let _pipe$8 = class$(
                _pipe$7,
                "border border-gray-400 rounded-lg p-1.5 text-gray-700 font-bold"
              );
              return empty(_pipe$8);
            })()
          ])
        );
      })()
    ])
  );
}
function chat() {
  let encoder_decoder = new EncoderDecoder(
    (msg) => {
      if (msg instanceof ClientMessage) {
        let message = msg[0];
        return new Ok(encode_client_message(message));
      } else {
        return new Error(void 0);
      }
    },
    (encoded_msg) => {
      let _pipe = decode_server_message(encoded_msg);
      return map3(_pipe, (var0) => {
        return new ServerMessage(var0);
      });
    }
  );
  return component3(
    init3,
    update,
    view,
    new$(),
    encoder_decoder,
    websocket("http://localhost:8000/omni-app-ws"),
    (var0) => {
      return new TransportState(var0);
    }
  );
}

// build/dev/javascript/client/client.mjs
function main() {
  let init_model = (() => {
    let _pipe = querySelector("#model");
    let _pipe$1 = map3(_pipe, innerText);
    let _pipe$2 = then$(
      _pipe$1,
      (text2) => {
        let $2 = (() => {
          let _pipe$22 = text2;
          let _pipe$32 = trim2(_pipe$22);
          return is_empty(_pipe$32);
        })();
        if ($2) {
          return new Error(void 0);
        } else {
          return new Ok(text2);
        }
      }
    );
    let _pipe$3 = then$(
      _pipe$2,
      (_) => {
        return new Ok(new Model2(new$(), ""));
      }
    );
    return from_result(_pipe$3);
  })();
  let $ = start2(chat(), "#app", init_model);
  if (!$.isOk()) {
    throw makeError(
      "let_assert",
      "client",
      34,
      "main",
      "Pattern match failed, no pattern matched the value.",
      { value: $ }
    );
  }
  return void 0;
}

// build/.lustre/entry.mjs
main();
