import { JJError } from './errors';

export type TokKind =
  | 'ident' | 'kw' | 'int' | 'real' | 'imag' | 'str' | 'chr' | 'punct' | 'eof';

export interface Token {
  kind: TokKind;
  text: string; // identifier/keyword/punct text, or decoded string contents
  line: number;
  col: number;
}

export const TYPE_KEYWORDS = new Set([
  'whl', 'int', 'rat', 'com', 'real', 'const', 'nr', 'txt', 'char', 'state', 'bool',
]);

export const KEYWORDS = new Set([
  ...TYPE_KEYWORDS,
  'if', 'elif', 'else', 'while', 'goto', 'gotor', 'break', 'skip', 'end',
  'print', 'take', 'true', 'false', 'for',
]);

const PUNCT2 = ['&&', '||', '==', '!=', '<=', '>='];
const PUNCT1 = '+-*/%^<>!:;,.(){}|\\='.split('');

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\', '"': '"', "'": "'" };

export type Version = 'v1' | 'v2';

export function lex(src: string, version: Version = 'v2'): Token[] {
  const toks: Token[] = [];
  let i = 0, line = 1, col = 1;
  const adv = (n = 1) => {
    for (let k = 0; k < n; k++) {
      if (src[i] === '\n') { line++; col = 1; } else col++;
      i++;
    }
  };
  const err = (msg: string, l = line, c = col): never => { throw new JJError('transpile', msg, l, c); };

  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { adv(); continue; }
    if (ch === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') adv(); continue; }
    if (ch === '/' && src[i + 1] === '*') {
      const sl = line, sc = col;
      adv(2);
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) adv();
      if (i >= src.length) err("this comment starts with /* but is never closed with */", sl, sc);
      adv(2);
      continue;
    }
    const startLine = line, startCol = col;

    if (/[0-9]/.test(ch)) {
      let j = i;
      while (/[0-9]/.test(src[j] ?? '')) j++;
      let kind: TokKind = 'int';
      // A '.' is a decimal point only when digits follow; otherwise it is print's "close the line" dot.
      if (src[j] === '.' && /[0-9]/.test(src[j + 1] ?? '')) {
        j++;
        while (/[0-9]/.test(src[j] ?? '')) j++;
        kind = 'real';
      }
      let text = src.slice(i, j);
      if (src[j] === 'i' && !/[A-Za-z0-9_]/.test(src[j + 1] ?? '')) {
        if (version === 'v1') err('imaginary literals like 3i are not part of V1 (Classic); switch to V2');
        kind = 'imag'; j++;
      }
      toks.push({ kind, text, line: startLine, col: startCol });
      adv(j - i);
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (/[A-Za-z0-9_]/.test(src[j] ?? '')) j++;
      const text = src.slice(i, j);
      toks.push({ kind: KEYWORDS.has(text) ? 'kw' : 'ident', text, line: startLine, col: startCol });
      adv(j - i);
      continue;
    }

    if (ch === '"' || ch === "'") {
      const q = ch;
      adv();
      let out = '';
      for (;;) {
        if (i >= src.length || src[i] === '\n') err(`this ${q === '"' ? 'txt' : 'char'} literal is never closed`, startLine, startCol);
        const c = src[i];
        if (c === q) { adv(); break; }
        if (c === '\\') {
          const n = src[i + 1];
          if (n === undefined || !(n in ESCAPES)) err(`unknown escape sequence '\\${n ?? ''}'`);
          out += ESCAPES[n];
          adv(2);
          continue;
        }
        // V1 (Classic) keeps the original's bug: reading the file with >> dropped all whitespace, even inside strings.
        if (!(version === 'v1' && /\s/.test(c))) out += c;
        adv();
      }
      if (q === "'" && [...out].length !== 1) err('a char literal must hold exactly one character', startLine, startCol);
      toks.push({ kind: q === '"' ? 'str' : 'chr', text: out, line: startLine, col: startCol });
      continue;
    }

    const two = src.slice(i, i + 2);
    if (PUNCT2.includes(two)) {
      toks.push({ kind: 'punct', text: two, line: startLine, col: startCol });
      adv(2);
      continue;
    }
    if (PUNCT1.includes(ch)) {
      toks.push({ kind: 'punct', text: ch, line: startLine, col: startCol });
      adv();
      continue;
    }
    err(`I don't know what '${ch}' is`);
  }
  toks.push({ kind: 'eof', text: '', line, col });
  return toks;
}
