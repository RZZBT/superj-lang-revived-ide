/** Runtime values of the SuperJ data types. */
export type Value =
  | { t: 'int'; v: bigint } // whl / int / nr(integral)
  | { t: 'real'; v: number }
  | { t: 'rat'; n: bigint; d: bigint } // always reduced, d > 0
  | { t: 'com'; re: number; im: number }
  | { t: 'txt'; v: string }
  | { t: 'char'; v: string }
  | { t: 'bool'; v: boolean };

/** A declared type: name plus size in bytes (syn.txt: "size in bytes, default is 4"). */
export interface TypeSpec {
  type: 'whl' | 'int' | 'rat' | 'com' | 'real' | 'const' | 'nr' | 'txt' | 'char' | 'state';
  size: number;
}

export const DEFAULT_SIZE: Record<TypeSpec['type'], number> = {
  whl: 4, int: 4, rat: 4, com: 4, real: 4, const: 2, nr: 4, txt: 0, char: 0, state: 0,
};

export const mkInt = (v: bigint): Value => ({ t: 'int', v });
export const mkReal = (v: number): Value => ({ t: 'real', v });
export const mkBool = (v: boolean): Value => ({ t: 'bool', v });
export const mkTxt = (v: string): Value => ({ t: 'txt', v });

export function gcd(a: bigint, b: bigint): bigint {
  if (a < 0n) a = -a;
  if (b < 0n) b = -b;
  while (b) [a, b] = [b, a % b];
  return a;
}

export function mkRat(n: bigint, d: bigint): Value {
  if (d === 0n) throw new Error('rational with denominator 0');
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d) || 1n;
  return { t: 'rat', n: n / g, d: d / g };
}

/** 0.1 -> 1/10 (uses the shortest decimal form, so rat(0.75) is 3/4 and rat(0.1) is 1/10). */
export function ratFromReal(x: number): Value {
  if (!Number.isFinite(x)) throw new Error('cannot rationalize a non-finite number');
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(x.toString());
  if (!m) throw new Error('cannot rationalize ' + x);
  const frac = m[3] ?? '';
  const exp10 = Number(m[4] ?? 0) - frac.length;
  let n = BigInt(m[2] + frac);
  let d = 1n;
  if (exp10 >= 0) n *= 10n ** BigInt(exp10);
  else d = 10n ** BigInt(-exp10);
  if (m[1]) n = -n;
  return mkRat(n, d);
}

export function typeName(v: Value): string {
  return v.t === 'bool' ? 'state' : v.t;
}

export function wrapInt(v: bigint, bytes: number, signed: boolean): bigint {
  const bits = BigInt(bytes * 8);
  const mod = 1n << bits;
  let r = ((v % mod) + mod) % mod;
  if (signed && r >= mod >> 1n) r -= mod;
  return r;
}

export function toNumber(v: Value): number {
  switch (v.t) {
    case 'int': return Number(v.v);
    case 'real': return v.v;
    case 'rat': return Number(v.n) / Number(v.d);
    default: throw new Error(`expected a number but got ${typeName(v)}`);
  }
}

/** Truncate a real-valued number toward zero, as C++ does when converting to an integer type. */
function truncToBig(v: Value): bigint {
  switch (v.t) {
    case 'int': return v.v;
    case 'rat': return v.n / v.d;
    case 'real':
      if (!Number.isFinite(v.v)) throw new Error('cannot convert a non-finite number to an integer');
      return BigInt(Math.trunc(v.v));
    case 'bool': return v.v ? 1n : 0n;
    default: throw new Error(`cannot store ${typeName(v)} in an integer variable`);
  }
}

/** Convert `v` to what a variable of declared type `spec` can hold (the assignment rules). */
export function coerce(spec: TypeSpec, v: Value): Value {
  switch (spec.type) {
    case 'const': return v;
    case 'whl': return mkInt(wrapInt(truncToBig(v), spec.size, false));
    case 'int': return mkInt(wrapInt(truncToBig(v), spec.size, true));
    case 'real': {
      if (v.t === 'com' || v.t === 'txt' || v.t === 'char') throw new Error(`cannot store ${typeName(v)} in a real variable`);
      const x = v.t === 'bool' ? (v.v ? 1 : 0) : toNumber(v);
      return mkReal(spec.size <= 4 ? Math.fround(x) : x);
    }
    case 'rat':
      if (v.t === 'rat') return checkSize(v);
      if (v.t === 'int') return checkSize(mkRat(v.v, 1n));
      if (v.t === 'real') return ratFromReal(v.v);
      if (v.t === 'bool') return mkRat(v.v ? 1n : 0n, 1n);
      throw new Error(`cannot store ${typeName(v)} in a rat variable`);
    case 'com':
      if (v.t === 'com') return v;
      if (v.t === 'txt' || v.t === 'char' || v.t === 'bool') throw new Error(`cannot store ${typeName(v)} in a com variable`);
      return { t: 'com', re: toNumber(v), im: 0 };
    case 'nr':
      if (v.t === 'int' || v.t === 'real' || v.t === 'rat') return checkSize(v);
      if (v.t === 'bool') return mkInt(v.v ? 1n : 0n);
      throw new Error(`cannot store ${typeName(v)} in an nr variable`);
    case 'txt':
      if (v.t === 'txt') return v;
      if (v.t === 'char') return mkTxt(v.v);
      throw new Error(`cannot store ${typeName(v)} in a txt variable`);
    case 'char':
      if (v.t === 'char') return v;
      if (v.t === 'txt' && [...v.v].length === 1) return { t: 'char', v: v.v };
      throw new Error(`cannot store ${typeName(v)} in a char variable`);
    case 'state':
      if (v.t === 'bool') return v;
      if (v.t === 'int') return mkBool(v.v !== 0n);
      if (v.t === 'real') return mkBool(v.v !== 0);
      if (v.t === 'rat') return mkBool(v.n !== 0n);
      throw new Error(`cannot store ${typeName(v)} in a state variable`);
  }
}

export function defaultValue(spec: TypeSpec): Value {
  switch (spec.type) {
    case 'whl': case 'int': case 'nr': case 'const': return mkInt(0n);
    case 'real': return mkReal(0);
    case 'rat': return mkRat(0n, 1n);
    case 'com': return { t: 'com', re: 0, im: 0 };
    case 'txt': return mkTxt('');
    case 'char': return { t: 'char', v: ' ' };
    case 'state': return mkBool(false);
  }
}

/** C++ `cout` style (%g, 6 significant digits) for reals. */
export function formatG(x: number): string {
  if (Number.isNaN(x)) return 'nan';
  if (!Number.isFinite(x)) return x < 0 ? '-inf' : 'inf';
  if (x === 0) return Object.is(x, -0) ? '-0' : '0';
  const strip = (s: string) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);
  const [mant, ex] = x.toExponential(5).split('e');
  const e = parseInt(ex, 10);
  if (e < -4 || e >= 6) {
    return strip(mant) + 'e' + (e < 0 ? '-' : '+') + String(Math.abs(e)).padStart(2, '0');
  }
  return strip(x.toFixed(5 - e));
}

function fmtPart(n: number): string {
  return formatG(n);
}

export function format(v: Value): string {
  switch (v.t) {
    case 'int': return v.v.toString();
    case 'real': return formatG(v.v);
    case 'rat': return v.d === 1n ? v.n.toString() : `${v.n}/${v.d}`;
    case 'com': {
      const im = fmtPart(Math.abs(v.im)) + 'i';
      return `${fmtPart(v.re)}${v.im < 0 || Object.is(v.im, -0) ? '-' : '+'}${im}`;
    }
    case 'txt': case 'char': return v.v;
    case 'bool': return v.v ? 'true' : 'false';
  }
}

const MAX_BITS = 1_000_000n; // exact numbers (rat / nr) stay below ~300k digits

/** Throws if an exact number grows too large, e.g. `a : a * a;` in a loop. */
export function checkSize(v: Value): Value {
  const big = (x: bigint) => (x < 0n ? -x : x) >> MAX_BITS !== 0n;
  if ((v.t === 'int' && big(v.v)) || (v.t === 'rat' && (big(v.n) || big(v.d)))) throw new Error('number too large');
  return v;
}
