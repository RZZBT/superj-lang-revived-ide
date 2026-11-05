import { JJError } from './errors';
import type { Expr, Stmt } from './ast';
import { BUILTINS } from './ops';
import { TypeSpec, Value, defaultValue, format } from './values';

/** One instruction of the generated program. */
export interface Op { op: string; a?: any; b?: any; line: number }

export interface Fn {
  name: string;
  params: { name: string; spec: TypeSpec; hasDefault: boolean }[];
  nslots: number;
  code: Op[];
}

export interface Program {
  main: Fn;
  fns: Fn[];
  globals: { name: string; spec: TypeSpec }[];
}

interface VarInfo { slot: number; spec: TypeSpec; global: boolean; isConst: boolean }

interface Ctx {
  fn: Fn;
  fnName: string | null;
  scopes: Map<string, VarInfo>[];
  loops: { breaks: number[]; skipTo: number }[];
  labels: Map<string, { start: number; end: number; line: number }>;
  fixups: { pc: number; name: string; line: number }[];
}

const BIN_OPS = new Set(['+', '-', '*', '/', '%', '^', '==', '!=', '<', '>', '<=', '>=']);

export function compile(ast: Stmt[]): Program {
  return new Compiler().run(ast);
}

class Compiler {
  private globals = new Map<string, VarInfo>();
  private globalList: Program['globals'] = [];
  private fnTable = new Map<string, { index: number; node: Extract<Stmt, { k: 'funcdef' }> }>();
  private fns: Fn[] = [];
  private ctx!: Ctx;

  private err(msg: string, line: number, col = 0): never {
    throw new JJError('transpile', msg, line, col);
  }

  run(ast: Stmt[]): Program {
    // Pass 1: functions are visible everywhere; top-level declarations are the global variables.
    for (const s of ast) {
      if (s.k === 'funcdef') {
        if (this.fnTable.has(s.name)) this.err(`function '${s.name}' is defined twice`, s.line, s.col);
        if (BUILTINS[s.name]) this.err(`'${s.name}' is a built-in math function, pick another name`, s.line, s.col);
        this.fnTable.set(s.name, { index: this.fnTable.size, node: s });
      } else if (s.k === 'decl') {
        if (this.globals.has(s.name)) this.err(`'${s.name}' is already declared`, s.line, s.col);
        this.globals.set(s.name, { slot: this.globalList.length, spec: s.spec, global: true, isConst: s.spec.type === 'const' });
        this.globalList.push({ name: s.name, spec: s.spec });
      }
    }
    for (const [name, { node }] of this.fnTable) {
      for (const a of node.allowed ?? []) {
        if (!this.fnTable.has(a)) this.err(`function '${name}' lists '${a}' as a caller, but there is no function '${a}'`, node.line, node.col);
      }
    }

    const main: Fn = { name: '<main>', params: [], nslots: 0, code: [] };
    this.fns = new Array(this.fnTable.size);
    this.ctx = this.newCtx(main, null);
    for (const s of ast) {
      if (s.k === 'funcdef') continue;
      this.stmt(s, true);
    }
    this.emit('halt', undefined, undefined, 0);
    this.finish(this.ctx);

    for (const [name, { index, node }] of this.fnTable) {
      const fn: Fn = { name, params: [], nslots: 0, code: [] };
      this.ctx = this.newCtx(fn, name);
      const seen = new Set<string>();
      for (const p of node.params) {
        if (seen.has(p.name)) this.err(`parameter '${p.name}' appears twice`, p.line);
        seen.add(p.name);
        fn.params.push({ name: p.name, spec: p.spec, hasDefault: !!p.def });
        this.ctx.scopes[0].set(p.name, { slot: fn.nslots++, spec: p.spec, global: false, isConst: false });
      }
      for (const s of node.body) this.stmt(s, false);
      this.emit('ret', undefined, undefined, node.line);
      this.finish(this.ctx);
      this.fns[index] = fn;
    }
    return { main, fns: this.fns, globals: this.globalList };
  }

  private newCtx(fn: Fn, fnName: string | null): Ctx {
    return { fn, fnName, scopes: [new Map()], loops: [], labels: new Map(), fixups: [] };
  }

  private finish(c: Ctx) {
    for (const f of c.fixups) {
      const lab = c.labels.get(f.name);
      if (!lab) this.err(`there is no label '${f.name}' to jump to${c.fnName ? ` inside function '${c.fnName}'` : ''}`, f.line);
      const op = c.fn.code[f.pc];
      op.a = lab.start;
      op.b = lab.end;
    }
  }

  private emit(op: string, a?: any, b?: any, line = 0): number {
    this.ctx.fn.code.push({ op, a, b, line });
    return this.ctx.fn.code.length - 1;
  }
  private pc() { return this.ctx.fn.code.length; }

  private lookup(name: string): VarInfo | undefined {
    for (let i = this.ctx.scopes.length - 1; i >= 0; i--) {
      const v = this.ctx.scopes[i].get(name);
      if (v) return v;
    }
    return this.globals.get(name);
  }

  private blockBody(body: Stmt[]) {
    this.ctx.scopes.push(new Map());
    for (const s of body) this.stmt(s, false);
    this.ctx.scopes.pop();
  }

  private label(name: string | undefined, line: number, start: number) {
    if (!name) return;
    if (this.ctx.labels.has(name)) this.err(`label '${name}' is used twice`, line);
    this.ctx.labels.set(name, { start, end: -1, line });
  }
  private labelEnd(name: string | undefined) {
    if (name) this.ctx.labels.get(name)!.end = this.pc();
  }

  private stmt(s: Stmt, top: boolean) {
    const c = this.ctx;
    switch (s.k) {
      case 'decl': {
        if (top && c.scopes.length === 1 && c.fnName === null) {
          const g = this.globals.get(s.name)!;
          this.initValue(s);
          this.emit('stg', g.slot, { spec: s.spec, name: s.name }, s.line);
        } else {
          const scope = c.scopes[c.scopes.length - 1];
          if (scope.has(s.name)) this.err(`'${s.name}' is already declared in this block`, s.line, s.col);
          this.initValue(s);
          const slot = c.fn.nslots++;
          scope.set(s.name, { slot, spec: s.spec, global: false, isConst: s.spec.type === 'const' });
          this.emit('stl', slot, { spec: s.spec, name: s.name }, s.line);
        }
        return;
      }
      case 'assign': {
        const v = this.lookup(s.name);
        if (!v) this.err(`'${s.name}' has not been declared`, s.line, s.col);
        if (v.isConst) this.err(`'${s.name}' is a const and cannot change`, s.line, s.col);
        this.expr(s.e);
        this.emit(v.global ? 'stg' : 'stl', v.slot, { spec: v.spec, name: s.name }, s.line);
        return;
      }
      case 'print':
        for (const p of s.parts) {
          if (p.k === 'expr') { this.expr(p.e); this.emit('out', undefined, undefined, s.line); }
          else this.emit('outs', p.k === 'space' ? ' ' : '\n', undefined, s.line);
        }
        return;
      case 'take':
        for (const n of s.names) {
          const v = this.lookup(n.name);
          if (!v) this.err(`'${n.name}' has not been declared`, n.line, n.col);
          if (v.isConst) this.err(`'${n.name}' is a const and cannot change`, n.line, n.col);
          this.emit(v.global ? 'tkg' : 'tkl', v.slot, { spec: v.spec, name: n.name }, s.line);
        }
        return;
      case 'block': this.blockBody(s.body); return;
      case 'end': this.emit('halt', undefined, undefined, s.line); return;
      case 'break': case 'skip': {
        const loop = c.loops[c.loops.length - 1];
        if (!loop) this.err(`'${s.k}' only makes sense inside a while loop`, s.line);
        if (s.k === 'break') loop.breaks.push(this.emit('jmp', -1, undefined, s.line));
        else this.emit('jmp', loop.skipTo, undefined, s.line);
        return;
      }
      case 'goto': {
        const pc = this.emit(s.returns ? 'gotor' : 'jmp', -1, -1, s.line);
        c.fixups.push({ pc, name: s.name, line: s.line });
        return;
      }
      case 'while': {
        const start = this.pc();
        this.label(s.label, s.line, start);
        this.expr(s.cond);
        const jz = this.emit('jz', -1, undefined, s.line);
        c.loops.push({ breaks: [], skipTo: start });
        this.blockBody(s.body);
        this.emit('jmp', start, undefined, s.line);
        const loop = c.loops.pop()!;
        const end = this.pc();
        c.fn.code[jz].a = end;
        for (const b of loop.breaks) c.fn.code[b].a = end;
        this.labelEnd(s.label);
        return;
      }
      case 'if': this.ifStmt(s); return;
      case 'callfn': {
        const target = this.fnTable.get(s.name);
        if (!target) this.err(`there is no function called '${s.name}'`, s.line, s.col);
        const allowed = target.node.allowed;
        if (allowed && c.fnName !== s.name && !(c.fnName && allowed.includes(c.fnName))) {
          this.err(
            `function '${s.name}' can only be called from ${allowed.length ? allowed.map((a) => `'${a}'`).join(', ') : 'nowhere'}` +
              ` (it was declared with !(...)), not from ${c.fnName ? `'${c.fnName}'` : 'the top level'}`,
            s.line, s.col,
          );
        }
        const params = target.node.params;
        const required = params.filter((p) => !p.def).length;
        if (s.args.length < required || s.args.length > params.length) {
          this.err(
            `'${s.name}' takes ${required === params.length ? required : `${required} to ${params.length}`} argument(s) but you gave ${s.args.length}`,
            s.line, s.col,
          );
        }
        for (let i = 0; i < params.length; i++) {
          if (i < s.args.length) this.expr(s.args[i]);
          else this.expr(params[i].def!);
        }
        this.emit('call', target.index, params.length, s.line);
        return;
      }
      case 'funcdef':
        this.err('functions must be declared at the top level', s.line, s.col);
    }
  }

  private initValue(s: Extract<Stmt, { k: 'decl' }>) {
    if (s.init) { this.expr(s.init); return; }
    if (s.spec.type === 'const') this.err(`const '${s.name}' needs a value: const ${s.name} : ...;`, s.line, s.col);
    this.emit('push', defaultValue(s.spec), undefined, s.line);
  }

  private ifStmt(s: Extract<Stmt, { k: 'if' }>) {
    const c = this.ctx;
    const start = this.pc();
    this.label(s.label, s.line, start);
    const ends: number[] = [];

    // do_all: every branch whose condition holds runs, instead of only the first one.
    let flagSlot = -1, matchedSlot = -1;
    if (s.doAll) {
      flagSlot = c.fn.nslots++;
      matchedSlot = c.fn.nslots++;
      this.expr(s.doAll);
      this.emit('stl', flagSlot, { spec: { type: 'state', size: 0 }, name: 'do_all' }, s.line);
      this.emit('push', { t: 'bool', v: false } as Value, undefined, s.line);
      this.emit('stl', matchedSlot, { spec: { type: 'state', size: 0 }, name: '' }, s.line);
    }
    const branches = [{ cond: s.cond, body: s.then, line: s.line }, ...s.elifs];
    for (const br of branches) {
      this.expr(br.cond);
      const jz = this.emit('jz', -1, undefined, br.line);
      this.blockBody(br.body);
      if (s.doAll) {
        this.emit('push', { t: 'bool', v: true } as Value, undefined, br.line);
        this.emit('stl', matchedSlot, { spec: { type: 'state', size: 0 }, name: '' }, br.line);
        this.emit('ldl', flagSlot, 'do_all', br.line);
        ends.push(this.emit('jz', -1, undefined, br.line));
      } else {
        ends.push(this.emit('jmp', -1, undefined, br.line));
      }
      c.fn.code[jz].a = this.pc();
    }
    if (s.els) {
      if (s.doAll) {
        this.emit('ldl', matchedSlot, '', s.line);
        ends.push(this.emit('jnz', -1, undefined, s.line));
      }
      this.blockBody(s.els);
    }
    const end = this.pc();
    for (const e of ends) c.fn.code[e].a = end;
    this.labelEnd(s.label);
  }

  private expr(e: Expr) {
    switch (e.k) {
      case 'lit': this.emit('push', e.v, undefined, e.line); return;
      case 'var': {
        const v = this.lookup(e.name);
        if (!v) this.err(`'${e.name}' has not been declared`, e.line, e.col);
        this.emit(v.global ? 'ldg' : 'ldl', v.slot, e.name, e.line);
        return;
      }
      case 'un':
        this.expr(e.e);
        this.emit(e.op === '-' ? 'neg' : e.op === '!' ? 'not' : 'abs', undefined, undefined, e.line);
        return;
      case 'bin': {
        if (e.op === '&&' || e.op === '||') {
          this.expr(e.l);
          this.emit('bool', undefined, undefined, e.line);
          const j = this.emit(e.op === '&&' ? 'jfk' : 'jtk', -1, undefined, e.line);
          this.expr(e.r);
          this.emit('bool', undefined, undefined, e.line);
          this.ctx.fn.code[j].a = this.pc();
          return;
        }
        if (!BIN_OPS.has(e.op)) this.err(`unknown operator ${e.op}`, e.line);
        this.expr(e.l);
        this.expr(e.r);
        this.emit('bin', e.op, undefined, e.line);
        return;
      }
      case 'call': {
        const b = BUILTINS[e.name];
        if (!b) {
          if (this.fnTable.has(e.name)) this.err(`'${e.name}' is a function that returns nothing, so it can only be used as a statement: ${e.name}(...);`, e.line, e.col);
          this.err(`there is no math function called '${e.name}'`, e.line, e.col);
        }
        if (e.args.length !== b.argc) this.err(`${e.name}() takes ${b.argc} argument(s) but you gave ${e.args.length}`, e.line, e.col);
        for (const a of e.args) this.expr(a);
        this.emit('bi', e.name, e.args.length, e.line);
        return;
      }
    }
  }
}

/** Text listing of the program, shown in the Generated tab. */
export function listing(p: Program): string {
  const out: string[] = [];
  const show = (v: any) => (v && typeof v === 'object' && 't' in v ? (v.t === 'txt' || v.t === 'char' ? `${v.t} ${JSON.stringify(v.v)}` : `${v.t} ${format(v)}`) : JSON.stringify(v));
  const dump = (fn: Fn) => {
    fn.code.forEach((o, i) => {
      let arg = '';
      if (o.a !== undefined) arg += ' ' + (o.op === 'push' ? show(o.a) : typeof o.a === 'object' ? show(o.a) : String(o.a));
      if (o.b !== undefined) arg += ' ' + (o.b?.spec ? `${o.b.spec.type}(${o.b.spec.size}) ${o.b.name}` : String(o.b));
      out.push(`  ${String(i).padStart(4, '0')}  ${o.op.padEnd(6)}${arg}`.trimEnd());
    });
  };
  out.push(`; globals: ${p.globals.map((g) => `${g.spec.type}(${g.spec.size}) ${g.name}`).join(', ') || '(none)'}`);
  out.push('main:');
  dump(p.main);
  for (const f of p.fns) {
    out.push('');
    out.push(`${f.name}(${f.params.map((x) => `${x.spec.type} ${x.name}`).join(', ')}):`);
    dump(f);
  }
  return out.join('\n');
}
