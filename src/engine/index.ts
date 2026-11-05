import { compile, listing, Program } from './compiler';
import { JJError } from './errors';
import { parse } from './parser';
import type { Version } from './lexer';
import { run, RunOptions, RunResult } from './vm';

export { JJError, NeedInput } from './errors';
export type { Program } from './compiler';
export type { RunOptions, RunResult } from './vm';

export type { Version } from './lexer';

/** Parses and compiles. Throws a JJError, never runs anything. */
export function transpile(source: string, version: Version = 'v2'): { program: Program; listing: string } {
  try {
    const program = compile(parse(source, version));
    return { program, listing: listing(program) };
  } catch (e) {
    if (e instanceof JJError) throw e;
    if (e instanceof RangeError) throw new JJError('transpile', 'the program is nested too deeply');
    throw e;
  }
}

export function runProgram(program: Program, opts: RunOptions): RunResult {
  return run(program, opts);
}

/** Transpile and run, collecting the output. */
export function execute(source: string, opts: Partial<RunOptions> & { version?: Version } = {}): { output: string; result: RunResult } {
  const { program } = transpile(source, opts.version);
  let output = '';
  const result = run(program, { ...opts, write: (s) => { output += s; } });
  return { output, result };
}
