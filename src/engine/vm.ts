import { JJError, NeedInput } from './errors';
import type { Fn, Op, Program } from './compiler';
import { BUILTINS, absolute, arith, compare, negate, truthy } from './ops';
import { Value, TypeSpec, coerce, format, mkBool, mkInt, mkRat, mkReal, mkTxt, ratFromReal } from './values';

export interface RunOptions {
  write: (s: string) => void;
  stdin?: string;
  maxSteps?: number;
  timeoutMs?: number;
  maxOutput?: number;
  maxDepth?: number;
  /** Echo tokens read by take() after this many have been read, like a terminal. */
  echoFrom?: number;
}

export interface RunResult { steps: number }

interface Frame {
  fn: Fn;
  pc: number;
  locals: (Value | undefined)[];
  /** gotor: "go there, run that statement, then come back" */
  rs: { ret: number; stop: number }[];
}

class InputReader {
  private pos = 0;
  private count = 0;
  constructor(private s: string, private echoFrom: number | undefined, private echo: (s: string) => void) {}
  private skip() {
    while (this.pos < this.s.length && /\s/.test(this.s[this.pos])) this.pos++;
    if (this.pos >= this.s.length) throw new NeedInput();
  }
  private done(tok: string): string {
    this.count++;
    if (this.echoFrom !== undefined && this.count > this.echoFrom) this.echo(tok + '\n');
    return tok;
  }
  token(): string {
    this.skip();
    const st = this.pos;
    while (this.pos < this.s.length && !/\s/.test(this.s[this.pos])) this.pos++;
    return this.done(this.s.slice(st, this.pos));
  }
  char(): string {
    this.skip();
    const cp = String.fromCodePoint(this.s.codePointAt(this.pos)!);
    this.pos += cp.length;
    return this.done(cp);
  }
}

function readInto(spec: TypeSpec, name: string, inp: InputReader): Value {
  const bad = (tok: string) => new Error(`take(${name}): '${tok}' is not a valid ${spec.type}`);
  switch (spec.type) {
    case 'txt': return mkTxt(inp.token());
    case 'char': return coerce(spec, { t: 'char', v: inp.char() });
    case 'state': {
      const t = inp.token();
      if (t === 'true' || t === '1') return mkBool(true);
      if (t === 'false' || t === '0') return mkBool(false);
      throw bad(t);
    }
    case 'whl': case 'int': case 'nr': {
      const t = inp.token();
      if (/^[+-]?\d+$/.test(t)) return coerce(spec, mkInt(BigInt(t)));
      if (spec.type !== 'nr' && /^[+-]?\d+\.\d+$/.test(t)) return coerce(spec, mkReal(Number(t)));
      if (spec.type === 'nr' && /^[+-]?\d+\.\d+$/.test(t)) return mkReal(Number(t));
      throw bad(t);
    }
    case 'real': {
      const t = inp.token();
      if (!/^[+-]?\d+(\.\d+)?$/.test(t)) throw bad(t);
      return coerce(spec, mkReal(Number(t)));
    }
    case 'rat': {
      const t = inp.token();
      const m = /^([+-]?\d+)\/(\d+)$/.exec(t);
      if (m) {
        if (BigInt(m[2]) === 0n) throw bad(t);
        return mkRat(BigInt(m[1]), BigInt(m[2]));
      }
      if (/^[+-]?\d+$/.test(t)) return mkRat(BigInt(t), 1n);
      if (/^[+-]?\d+\.\d+$/.test(t)) return ratFromReal(Number(t));
      throw bad(t);
    }
    default:
      throw new Error(`take(${name}): cannot read into a ${spec.type}`);
  }
}

export function run(prog: Program, opts: RunOptions): RunResult {
  const maxSteps = opts.maxSteps ?? 50_000_000;
  const maxOutput = opts.maxOutput ?? 1_000_000;
  const maxDepth = opts.maxDepth ?? 5000;
  const deadline = opts.timeoutMs ? Date.now() + opts.timeoutMs : Infinity;

  const globals: (Value | undefined)[] = new Array(prog.globals.length);
  const frames: Frame[] = [{ fn: prog.main, pc: 0, locals: new Array(prog.main.nslots), rs: [] }];
  const stack: Value[] = [];
  let frame = frames[0];
  let code = frame.fn.code;
  let pc = 0;
  let steps = 0;
  let written = 0;
  let ins: Op = code[0];

  const out: (s: string) => void = (s) => {
    written += s.length;
    if (written > maxOutput) throw new Error('output limit exceeded (the program printed too much)');
    opts.write(s);
  };

  const input = new InputReader(opts.stdin ?? '', opts.echoFrom, out);

  try {
    for (;;) {
      if (frame.rs.length) {
        const top = frame.rs[frame.rs.length - 1];
        if (pc === top.stop) { pc = top.ret; frame.rs.pop(); continue; }
      }
      ins = code[pc++];
      if (++steps > maxSteps) throw new Error(`step limit reached (${maxSteps.toLocaleString('en')} steps). Is there an endless loop?`);
      if ((steps & 0xfff) === 0 && Date.now() > deadline) throw new Error(`time limit reached (${opts.timeoutMs} ms). Is there an endless loop?`);

      switch (ins.op) {
        case 'push': stack.push(ins.a); break;
        case 'ldl': {
          const v = frame.locals[ins.a];
          if (!v) throw new Error(`'${ins.b}' has no value (its declaration was jumped over)`);
          stack.push(v);
          break;
        }
        case 'ldg': {
          const v = globals[ins.a];
          if (!v) throw new Error(`'${ins.b}' has no value yet (it is declared further down)`);
          stack.push(v);
          break;
        }
        case 'stl': frame.locals[ins.a] = coerce(ins.b.spec, stack.pop()!); break;
        case 'stg': globals[ins.a] = coerce(ins.b.spec, stack.pop()!); break;
        case 'bin': {
          const r = stack.pop()!, l = stack.pop()!;
          stack.push(ins.a === '==' || ins.a === '!=' || ins.a === '<' || ins.a === '>' || ins.a === '<=' || ins.a === '>='
            ? compare(ins.a, l, r)
            : arith(ins.a, l, r));
          break;
        }
        case 'neg': stack.push(negate(stack.pop()!)); break;
        case 'abs': stack.push(absolute(stack.pop()!)); break;
        case 'not': stack.push(mkBool(!truthy(stack.pop()!))); break;
        case 'bool': stack.push(mkBool(truthy(stack.pop()!))); break;
        case 'jfk': if (!(stack[stack.length - 1] as { v: boolean }).v) pc = ins.a; else stack.pop(); break;
        case 'jtk': if ((stack[stack.length - 1] as { v: boolean }).v) pc = ins.a; else stack.pop(); break;
        case 'jmp': pc = ins.a; break;
        case 'jz': if (!truthy(stack.pop()!)) pc = ins.a; break;
        case 'jnz': if (truthy(stack.pop()!)) pc = ins.a; break;
        case 'out': out(format(stack.pop()!)); break;
        case 'outs': out(ins.a); break;
        case 'bi': {
          const args = stack.splice(stack.length - ins.b, ins.b);
          stack.push(BUILTINS[ins.a].fn(args));
          break;
        }
        case 'tkl': frame.locals[ins.a] = readInto(ins.b.spec, ins.b.name, input); break;
        case 'tkg': globals[ins.a] = readInto(ins.b.spec, ins.b.name, input); break;
        case 'gotor': frame.rs.push({ ret: pc, stop: ins.b }); pc = ins.a; break;
        case 'call': {
          if (frames.length >= maxDepth) throw new Error('call stack overflow (a function calls itself too deeply)');
          const fn = prog.fns[ins.a];
          const args = stack.splice(stack.length - ins.b, ins.b);
          const locals: (Value | undefined)[] = new Array(fn.nslots);
          for (let i = 0; i < fn.params.length; i++) {
            try { locals[i] = coerce(fn.params[i].spec, args[i]); }
            catch (e) { throw new Error(`argument '${fn.params[i].name}' of ${fn.name}(): ${(e as Error).message}`); }
          }
          frame.pc = pc;
          frame = { fn, pc: 0, locals, rs: [] };
          frames.push(frame);
          code = fn.code;
          pc = 0;
          break;
        }
        case 'ret':
          frames.pop();
          frame = frames[frames.length - 1];
          code = frame.fn.code;
          pc = frame.pc;
          break;
        case 'halt': return { steps };
        default: throw new Error('internal: unknown instruction ' + ins.op);
      }
    }
  } catch (e) {
    if (e instanceof JJError || e instanceof NeedInput) throw e;
    if (e instanceof RangeError) throw new JJError('runtime', 'the engine ran out of memory or stack: ' + e.message, ins?.line ?? 0);
    throw new JJError('runtime', (e as Error).message, ins?.line ?? 0);
  }
}
