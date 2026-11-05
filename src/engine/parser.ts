import { JJError } from './errors';
import { lex, Token, TYPE_KEYWORDS, Version } from './lexer';
import type { Expr, Param, PrintPart, Stmt } from './ast';
import { DEFAULT_SIZE, mkBool, mkInt, mkReal, mkTxt, TypeSpec } from './values';

export function parse(src: string, version: Version = 'v2'): Stmt[] {
  return new Parser(lex(src, version), version).program();
}

class Parser {
  private p = 0;
  private depth = 0;
  constructor(private t: Token[], private version: Version) {}

  private get cur() { return this.t[this.p]; }
  private peek(n = 1) { return this.t[Math.min(this.p + n, this.t.length - 1)]; }
  private next() { return this.t[this.p++]; }
  private is(text: string, tok = this.cur) { return (tok.kind === 'punct' || tok.kind === 'kw') && tok.text === text; }
  private accept(text: string) { if (this.is(text)) { this.p++; return true; } return false; }

  private describe(t: Token) {
    return t.kind === 'eof' ? 'the end of the program' : `'${t.kind === 'str' ? '"' + t.text + '"' : t.text}'`;
  }
  private fail(msg: string, t = this.cur): never {
    throw new JJError('transpile', msg, t.line, t.col);
  }
  private expect(text: string, why = ''): Token {
    if (!this.is(text)) this.fail(`expected '${text}'${why ? ' ' + why : ''}, but found ${this.describe(this.cur)}`);
    return this.next();
  }
  private ident(why: string): Token {
    if (this.cur.kind !== 'ident') this.fail(`expected a name ${why}, but found ${this.describe(this.cur)}`);
    return this.next();
  }

  program(): Stmt[] {
    const out: Stmt[] = [];
    while (this.cur.kind !== 'eof') out.push(this.stmt(true));
    return out;
  }

  private block(): Stmt[] {
    this.expect('{', 'to open the block');
    const out: Stmt[] = [];
    while (!this.is('}')) {
      if (this.cur.kind === 'eof') this.fail("this block is never closed: expected '}'");
      out.push(this.stmt(false));
    }
    this.expect('}');
    return out;
  }

  private semi() {
    this.expect(';', 'at the end of the statement');
  }

  private typeSpec(): TypeSpec {
    const kw = this.next().text;
    const type = (kw === 'bool' ? 'state' : kw) as TypeSpec['type'];
    let size = DEFAULT_SIZE[type];
    if (this.is('(')) {
      this.next();
      const n = this.cur;
      if (n.kind !== 'int') this.fail('the size in bytes must be a whole number, like int(8)');
      this.next();
      size = Number(n.text);
      if (size < 1 || size > 16) this.fail('the size in bytes must be between 1 and 16', n);
      this.expect(')');
    }
    return { type, size };
  }

  private stmt(top: boolean): Stmt {
    const t = this.cur;
    const line = t.line;

    if (t.kind === 'kw') {
      if (TYPE_KEYWORDS.has(t.text)) return this.decl();
      switch (t.text) {
        case 'print': return this.print();
        case 'take': return this.take();
        case 'if': return this.ifStmt();
        case 'while': return this.whileStmt();
        case 'goto': case 'gotor': {
          this.next();
          const name = this.ident(`after '${t.text}' (the label to jump to)`);
          this.semi();
          return { k: 'goto', name: name.text, returns: t.text === 'gotor', line };
        }
        case 'break': this.next(); this.semi(); return { k: 'break', line };
        case 'skip': this.next(); this.semi(); return { k: 'skip', line };
        case 'end': this.next(); this.semi(); return { k: 'end', line };
        case 'elif': case 'else':
          this.fail(`'${t.text}' without a matching 'if' before it`);
      }
      this.fail(`unexpected ${this.describe(t)}`);
    }

    if (this.is('{')) return { k: 'block', body: this.block(), line };

    if (t.kind === 'ident') {
      const n = this.peek();
      if (this.is(':', n)) {
        this.next(); this.next();
        const e = this.expr();
        this.semi();
        return { k: 'assign', name: t.text, e, line, col: t.col };
      }
      if (this.is('(', n)) {
        // name(...) { ... } is a function definition; name(...); is a call.
        let d = 0, q = this.p + 1;
        for (; q < this.t.length; q++) {
          if (this.is('(', this.t[q])) d++;
          else if (this.is(')', this.t[q]) && --d === 0) break;
        }
        if (this.is('{', this.t[q + 1] ?? this.t[this.t.length - 1])) {
          if (!top) this.fail(`function '${t.text}' must be declared at the top level, not inside a block`);
          return this.funcdef();
        }
        this.next();
        const args = this.argList();
        this.semi();
        return { k: 'callfn', name: t.text, args, line, col: t.col };
      }
      this.fail(`I don't understand what to do with '${t.text}' here (assign with '${t.text} : value;' or call with '${t.text}();')`);
    }
    this.fail(`unexpected ${this.describe(t)}`);
  }

  private argList(): Expr[] {
    this.expect('(');
    const args: Expr[] = [];
    if (!this.is(')')) {
      do args.push(this.expr()); while (this.accept(','));
    }
    this.expect(')', 'to close the argument list');
    return args;
  }

  // datatype name : value;      datatype name {value}
  private decl(): Stmt {
    const first = this.cur;
    const spec = this.typeSpec();
    const name = this.ident(`for the ${first.text} variable`);
    let init: Expr | undefined;
    if (this.accept(':')) {
      init = this.expr();
      this.semi();
    } else if (this.accept('{')) {
      init = this.expr();
      this.expect('}', 'to close the initial value');
      this.accept(';');
    } else {
      this.semi();
    }
    return { k: 'decl', spec, name: name.text, init, line: first.line, col: name.col };
  }

  private funcdef(): Stmt {
    const nameTok = this.next();
    this.expect('(');
    const params: Param[] = [];
    if (!this.is(')')) {
      do {
        if (this.cur.kind !== 'kw' || !TYPE_KEYWORDS.has(this.cur.text)) {
          this.fail(`expected a parameter like 'int a', but found ${this.describe(this.cur)}`);
        }
        const line = this.cur.line;
        const spec = this.typeSpec();
        const n = this.ident('for the parameter');
        let def: Expr | undefined;
        if (this.is('=') && this.version === 'v1') this.fail('default parameter values are not part of V1 (Classic); switch to V2');
        if (this.accept('=')) def = this.expr();
        params.push({ name: n.text, spec, def, line });
      } while (this.accept(','));
    }
    this.expect(')', 'to close the parameter list');
    const body = this.block();
    let allowed: string[] | undefined;
    // Main(params){}!(functions);   or   Main(params){} for (functions)
    if (this.is('!') || this.is('for')) {
      this.next();
      this.expect('(', 'to list the functions allowed to call this one');
      allowed = [];
      if (!this.is(')')) {
        do allowed.push(this.ident('(a function allowed to call this one)').text); while (this.accept(','));
      }
      this.expect(')');
    }
    this.accept(';');
    return { k: 'funcdef', name: nameTok.text, params, body, allowed, line: nameTok.line, col: nameTok.col };
  }

  private print(): Stmt {
    const kw = this.next();
    this.expect('(', "after 'print'");
    const parts: PrintPart[] = [];
    let expectItem = true; // false right after an expression (a separator or ')' must follow)
    while (!this.is(')')) {
      const t = this.cur;
      if (t.kind === 'eof') this.fail("print( is never closed: expected ')'", kw);
      if (this.is(',')) {
        this.next();
        // a second comma in a row means a pause (syn.txt)
        if (this.t[this.p - 2] && this.is(',', this.t[this.p - 2]) && this.p - 2 >= 0) parts.push({ k: 'space' });
        expectItem = true;
        continue;
      }
      if (this.is('.')) {
        this.next();
        parts.push({ k: 'nl' });
        expectItem = true;
        continue;
      }
      if (!expectItem) this.fail(`expected ',' or ',,' or '.' or ')' between the things to print, but found ${this.describe(t)}`);
      parts.push({ k: 'expr', e: this.expr() });
      expectItem = false;
    }
    this.expect(')');
    this.semi();
    return { k: 'print', parts, line: kw.line };
  }

  private take(): Stmt {
    const kw = this.next();
    if (this.version === 'v1') this.fail("take() is not part of V1 (Classic); switch to V2", kw);
    this.expect('(', "after 'take'");
    const names: { name: string; line: number; col: number }[] = [];
    if (!this.is(')')) {
      do {
        const n = this.ident('(a variable to read into)');
        names.push({ name: n.text, line: n.line, col: n.col });
      } while (this.accept(','));
    }
    this.expect(')');
    this.semi();
    return { k: 'take', names, line: kw.line };
  }

  // if(state)(bool do_all = false)  \name  {..}  \elif(..){..}  \else(){..}
  private ifStmt(): Stmt {
    const kw = this.next();
    this.expect('(', "after 'if'");
    const cond = this.expr();
    this.expect(')', 'to close the condition');
    let doAll: Expr | undefined;
    if (this.is('(')) {
      this.next();
      if (this.is('bool') || this.is('state')) this.next();
      const n = this.ident('(the option, only do_all exists)');
      if (n.text !== 'do_all') this.fail("the only option an 'if' knows is do_all, as in (bool do_all = true)", n);
      this.expect('=');
      doAll = this.expr();
      this.expect(')');
    }
    let label: string | undefined;
    if (this.is('\\')) { this.next(); label = this.ident('for the label after \\').text; }
    if (++this.depth > 200) this.fail('blocks are nested too deeply');
    const then = this.block();
    const elifs: { cond: Expr; body: Stmt[]; line: number }[] = [];
    let els: Stmt[] | undefined;
    for (;;) {
      const bs = this.is('\\');
      const after = bs ? this.peek() : this.cur;
      if (after.kind === 'kw' && after.text === 'elif') {
        if (bs) this.next();
        const e = this.next();
        this.expect('(', "after 'elif'");
        const c = this.expr();
        this.expect(')');
        elifs.push({ cond: c, body: this.block(), line: e.line });
      } else if (after.kind === 'kw' && after.text === 'else') {
        if (bs) this.next();
        this.next();
        if (this.accept('(')) this.expect(')', "('else' takes empty parentheses)");
        els = this.block();
        break;
      } else break;
    }
    this.depth--;
    return { k: 'if', cond, doAll, label, then, elifs, els, line: kw.line };
  }

  // while(condition) |name { ... }
  private whileStmt(): Stmt {
    const kw = this.next();
    this.expect('(', "after 'while'");
    const cond = this.expr();
    this.expect(')', 'to close the condition');
    let label: string | undefined;
    if (this.is('|')) { this.next(); label = this.ident('for the label after |').text; }
    if (++this.depth > 200) this.fail('blocks are nested too deeply');
    const body = this.block();
    this.depth--;
    return { k: 'while', cond, label, body, line: kw.line };
  }

  // precedence, loosest first: ||   // ---- expressions: || < && < == != < < > <= >= < + - < * / % < unary < ^ ----  // ---- expressions: || < && < == != < < > <= >= < + - < * / % < unary < ^ ---- == != < > <= >= + - * / % unary ^
  expr(): Expr {
    if (++this.depth > 200) this.fail('expression is nested too deeply');
    const e = this.binary(0);
    this.depth--;
    return e;
  }

  private static LEVELS: string[][] = [['||'], ['&&'], ['==', '!='], ['<', '>', '<=', '>='], ['+', '-'], ['*', '/', '%']];

  private binary(level: number): Expr {
    if (level >= Parser.LEVELS.length) return this.unary();
    let l = this.binary(level + 1);
    while (this.cur.kind === 'punct' && Parser.LEVELS[level].includes(this.cur.text)) {
      const op = this.next();
      const r = this.binary(level + 1);
      l = { k: 'bin', op: op.text, l, r, line: op.line };
    }
    return l;
  }

  private unary(): Expr {
    const t = this.cur;
    if (this.is('-') || this.is('!')) {
      this.next();
      return { k: 'un', op: t.text as '-' | '!', e: this.unary(), line: t.line };
    }
    return this.power();
  }

  private power(): Expr {
    const base = this.primary();
    if (this.is('^')) {
      const op = this.next();
      return { k: 'bin', op: '^', l: base, r: this.unary(), line: op.line };
    }
    return base;
  }

  private primary(): Expr {
    const t = this.cur;
    const line = t.line;
    switch (t.kind) {
      case 'int': this.next(); return { k: 'lit', v: mkInt(BigInt(t.text)), line };
      case 'real': this.next(); return { k: 'lit', v: mkReal(Number(t.text)), line };
      case 'imag': this.next(); return { k: 'lit', v: { t: 'com', re: 0, im: Number(t.text) }, line };
      case 'str': this.next(); return { k: 'lit', v: mkTxt(t.text), line };
      case 'chr': this.next(); return { k: 'lit', v: { t: 'char', v: t.text }, line };
      case 'kw':
        if (t.text === 'true' || t.text === 'false') { this.next(); return { k: 'lit', v: mkBool(t.text === 'true'), line }; }
        // rat(...) is both a type and a math function; in an expression it is the function.
        if (t.text === 'rat' && this.is('(', this.peek())) {
          this.next();
          return { k: 'call', name: 'rat', args: this.argList(), line, col: t.col };
        }
        break;
      case 'ident':
        this.next();
        if (this.is('(')) return { k: 'call', name: t.text, args: this.argList(), line, col: t.col };
        return { k: 'var', name: t.text, line, col: t.col };
      case 'punct':
        if (t.text === '(') {
          this.next();
          const e = this.expr();
          this.expect(')');
          return e;
        }
        if (t.text === '|') { // |a| absolute value
          this.next();
          const e = this.binary(0);
          this.expect('|', 'to close the absolute value');
          return { k: 'un', op: 'abs', e, line };
        }
    }
    this.fail(`expected a value, but found ${this.describe(t)}`);
  }
}
