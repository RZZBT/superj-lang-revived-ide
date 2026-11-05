import {
  Value, mkBool, mkInt, mkRat, mkReal, mkTxt, ratFromReal, toNumber, typeName,
} from './values';

const MAX_POW_BITS = 200_000; // refuse to build gigantic integers

const isNum = (v: Value) => v.t === 'int' || v.t === 'real' || v.t === 'rat' || v.t === 'com';
const isText = (v: Value) => v.t === 'txt' || v.t === 'char';
const rank = (v: Value) => (v.t === 'int' ? 1 : v.t === 'rat' ? 2 : v.t === 'real' ? 3 : 4);

function toRatParts(v: Value): [bigint, bigint] {
  if (v.t === 'int') return [v.v, 1n];
  if (v.t === 'rat') return [v.n, v.d];
  throw new Error('internal: not rational');
}

function toCom(v: Value): { re: number; im: number } {
  return v.t === 'com' ? v : { re: toNumber(v), im: 0 };
}

function checkPowSize(base: bigint, exp: bigint) {
  const b = base < 0n ? -base : base;
  if (b <= 1n) return;
  if (exp * BigInt(b.toString(2).length) > BigInt(MAX_POW_BITS)) throw new Error('number too large (power)');
}

function ipow(base: bigint, exp: bigint): bigint {
  checkPowSize(base, exp);
  return base ** exp;
}

function mulC(a: { re: number; im: number }, b: { re: number; im: number }) {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

function divC(a: { re: number; im: number }, b: { re: number; im: number }) {
  const den = b.re * b.re + b.im * b.im;
  if (den === 0) throw new Error('division by zero');
  return { re: (a.re * b.re + a.im * b.im) / den, im: (a.im * b.re - a.re * b.im) / den };
}

function powC(a: { re: number; im: number }, b: { re: number; im: number }) {
  if (b.im === 0 && Number.isInteger(b.re) && Math.abs(b.re) <= 1024) {
    let n = Math.abs(b.re);
    let result = { re: 1, im: 0 };
    let base = a;
    while (n > 0) {
      if (n & 1) result = mulC(result, base);
      base = mulC(base, base);
      n >>= 1;
    }
    return b.re < 0 ? divC({ re: 1, im: 0 }, result) : result;
  }
  const r = Math.hypot(a.re, a.im);
  if (r === 0) return { re: 0, im: 0 };
  const th = Math.atan2(a.im, a.re);
  const lnr = Math.log(r);
  const mag = Math.exp(b.re * lnr - b.im * th);
  const ang = b.im * lnr + b.re * th;
  return { re: mag * Math.cos(ang), im: mag * Math.sin(ang) };
}

export function arith(op: string, a: Value, b: Value): Value {
  if (op === '+' && isText(a) && isText(b)) {
    const s = (a as { v: string }).v + (b as { v: string }).v;
    if (s.length > 1_000_000) throw new Error('txt too long');
    return mkTxt(s);
  }
  if (!isNum(a) || !isNum(b)) {
    throw new Error(`operator '${op}' cannot be used on ${typeName(a)} and ${typeName(b)}`);
  }
  const r = Math.max(rank(a), rank(b));

  if (r === 4) {
    const x = toCom(a), y = toCom(b);
    switch (op) {
      case '+': return { t: 'com', re: x.re + y.re, im: x.im + y.im };
      case '-': return { t: 'com', re: x.re - y.re, im: x.im - y.im };
      case '*': return { t: 'com', ...mulC(x, y) };
      case '/': return { t: 'com', ...divC(x, y) };
      case '^': return { t: 'com', ...powC(x, y) };
      default: throw new Error(`operator '${op}' is not defined for com`);
    }
  }

  if (r === 3) {
    const x = toNumber(a), y = toNumber(b);
    let res: number;
    switch (op) {
      case '+': res = x + y; break;
      case '-': res = x - y; break;
      case '*': res = x * y; break;
      case '/': if (y === 0) throw new Error('division by zero'); res = x / y; break;
      case '^': res = Math.pow(x, y); break;
      case '%': throw new Error("operator '%' needs whole numbers (int/whl)");
      default: throw new Error(`bad operator ${op}`);
    }
    if (Number.isNaN(res)) throw new Error('result is not a number');
    return mkReal(res);
  }

  if (r === 2) {
    const [n1, d1] = toRatParts(a);
    const [n2, d2] = toRatParts(b);
    switch (op) {
      case '+': return mkRat(n1 * d2 + n2 * d1, d1 * d2);
      case '-': return mkRat(n1 * d2 - n2 * d1, d1 * d2);
      case '*': return mkRat(n1 * n2, d1 * d2);
      case '/': if (n2 === 0n) throw new Error('division by zero'); return mkRat(n1 * d2, d1 * n2);
      case '^': {
        if (d2 !== 1n) return mkReal(Math.pow(Number(n1) / Number(d1), Number(n2) / Number(d2)));
        if (n2 >= 0n) return mkRat(ipow(n1, n2), ipow(d1, n2));
        if (n1 === 0n) throw new Error('division by zero');
        return mkRat(ipow(d1, -n2), ipow(n1, -n2));
      }
      case '%': throw new Error("operator '%' needs whole numbers (int/whl)");
      default: throw new Error(`bad operator ${op}`);
    }
  }

  const x = (a as { v: bigint }).v, y = (b as { v: bigint }).v;
  switch (op) {
    case '+': return mkInt(x + y);
    case '-': return mkInt(x - y);
    case '*': return mkInt(x * y);
    case '/': if (y === 0n) throw new Error('division by zero'); return mkInt(x / y); // "a/b inpartire(return int)"
    case '%': if (y === 0n) throw new Error('modulo by zero'); return mkInt(x % y);
    case '^':
      if (y >= 0n) return mkInt(ipow(x, y));
      if (x === 0n) throw new Error('division by zero');
      return mkRat(1n, ipow(x, -y));
    default: throw new Error(`bad operator ${op}`);
  }
}

function cmpNum(a: Value, b: Value): number {
  if ((a.t === 'int' || a.t === 'rat') && (b.t === 'int' || b.t === 'rat')) {
    const [n1, d1] = toRatParts(a), [n2, d2] = toRatParts(b);
    const l = n1 * d2, r = n2 * d1;
    return l < r ? -1 : l > r ? 1 : 0;
  }
  const x = toNumber(a), y = toNumber(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export function compare(op: string, a: Value, b: Value): Value {
  let c: number;
  if (a.t === 'bool' && b.t === 'bool') {
    if (op !== '==' && op !== '!=') throw new Error(`operator '${op}' cannot order state values`);
    c = a.v === b.v ? 0 : 1;
  } else if (isText(a) && isText(b)) {
    const x = (a as { v: string }).v, y = (b as { v: string }).v;
    c = x < y ? -1 : x > y ? 1 : 0;
  } else if (a.t === 'com' || b.t === 'com') {
    if (!isNum(a) || !isNum(b) || (op !== '==' && op !== '!=')) throw new Error(`operator '${op}' cannot compare ${typeName(a)} with ${typeName(b)}`);
    const x = toCom(a), y = toCom(b);
    c = x.re === y.re && x.im === y.im ? 0 : 1;
  } else if (isNum(a) && isNum(b)) {
    c = cmpNum(a, b);
  } else {
    throw new Error(`operator '${op}' cannot compare ${typeName(a)} with ${typeName(b)}`);
  }
  switch (op) {
    case '==': return mkBool(c === 0);
    case '!=': return mkBool(c !== 0);
    case '<': return mkBool(c < 0);
    case '>': return mkBool(c > 0);
    case '<=': return mkBool(c <= 0);
    case '>=': return mkBool(c >= 0);
  }
  throw new Error(`bad operator ${op}`);
}

export function truthy(v: Value): boolean {
  switch (v.t) {
    case 'bool': return v.v;
    case 'int': return v.v !== 0n;
    case 'real': return v.v !== 0;
    case 'rat': return v.n !== 0n;
    default: throw new Error(`a condition must be a state or a number, not ${typeName(v)}`);
  }
}

export function negate(v: Value): Value {
  switch (v.t) {
    case 'int': return mkInt(-v.v);
    case 'real': return mkReal(-v.v);
    case 'rat': return mkRat(-v.n, v.d);
    case 'com': return { t: 'com', re: -v.re, im: -v.im };
    default: throw new Error(`cannot negate ${typeName(v)}`);
  }
}

export function absolute(v: Value): Value {
  switch (v.t) {
    case 'int': return mkInt(v.v < 0n ? -v.v : v.v);
    case 'real': return mkReal(Math.abs(v.v));
    case 'rat': return mkRat(v.n < 0n ? -v.n : v.n, v.d);
    case 'com': return mkReal(Math.hypot(v.re, v.im));
    default: throw new Error(`|a| needs a number, not ${typeName(v)}`);
  }
}

function realLike(name: string, v: Value): asserts v is Extract<Value, { t: 'int' | 'real' | 'rat' }> {
  if (v.t === 'int' || v.t === 'real' || v.t === 'rat') return;
  throw new Error(`${name}() needs a number, not ${typeName(v)}`);
}

/** Math functions from syn.txt: rat() getUp() getDown() sqrt() round() trunc(). */
export const BUILTINS: Record<string, { argc: number; fn: (args: Value[]) => Value }> = {
  rat: {
    argc: 1,
    fn: ([x]) => {
      realLike('rat', x);
      if (x.t === 'rat') return x;
      if (x.t === 'int') return mkRat(x.v, 1n);
      return ratFromReal((x as { v: number }).v);
    },
  },
  getUp: {
    argc: 1,
    fn: ([x]) => {
      realLike('getUp', x);
      const r = x.t === 'real' ? ratFromReal(x.v) : x;
      return mkInt(r.t === 'rat' ? r.n : (r as { v: bigint }).v);
    },
  },
  getDown: {
    argc: 1,
    fn: ([x]) => {
      realLike('getDown', x);
      const r = x.t === 'real' ? ratFromReal(x.v) : x;
      return mkInt(r.t === 'rat' ? r.d : 1n);
    },
  },
  sqrt: {
    argc: 1,
    fn: ([x]) => {
      realLike('sqrt', x);
      const n = toNumber(x);
      if (n < 0) throw new Error('sqrt() of a negative number');
      return mkReal(Math.sqrt(n));
    },
  },
  round: {
    argc: 1,
    fn: ([x]) => {
      realLike('round', x);
      if (x.t === 'int') return x;
      if (x.t === 'rat') {
        const neg = x.n < 0n;
        const n = neg ? -x.n : x.n;
        const q = (2n * n + x.d) / (2n * x.d); // half away from zero
        return mkInt(neg ? -q : q);
      }
      if (!Number.isFinite(x.v)) throw new Error('round() of a non-finite number');
      const a = Math.floor(Math.abs(x.v) + 0.5);
      return mkInt(BigInt(x.v < 0 ? -a : a));
    },
  },
  trunc: {
    argc: 1,
    fn: ([x]) => {
      realLike('trunc', x);
      if (x.t === 'int') return x;
      if (x.t === 'rat') return mkInt(x.n / x.d);
      if (!Number.isFinite(x.v)) throw new Error('trunc() of a non-finite number');
      return mkInt(BigInt(Math.trunc(x.v)));
    },
  },
};
