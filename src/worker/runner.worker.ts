/// <reference lib="webworker" />
// Runs the program off the main thread so the page can terminate it.
import { JJError, NeedInput, runProgram, transpile } from '../engine';

export type ToWorker = { source: string; version: 'v1' | 'v2'; stdin: string; maxSteps: number; maxOutput: number; echoFrom: number };
export type FromWorker =
  | { type: 'transpiled' }
  | { type: 'need-input' }
  | { type: 'out'; text: string }
  | { type: 'done'; steps: number; ms: number }
  | { type: 'error'; phase: 'transpile' | 'runtime'; message: string; line: number; col: number };

const post = (m: FromWorker) => (self as unknown as Worker).postMessage(m);

self.onmessage = (ev: MessageEvent<ToWorker>) => {
  const { source, version, stdin, maxSteps, maxOutput, echoFrom } = ev.data;
  let buf = '';
  let last = Date.now();
  const flush = () => { if (buf) { post({ type: 'out', text: buf }); buf = ''; } last = Date.now(); };
  const t0 = Date.now();
  try {
    const { program } = transpile(source, version);
    post({ type: 'transpiled' });
    const r = runProgram(program, {
      stdin, maxSteps, maxOutput, echoFrom,
      write: (s) => { buf += s; if (buf.length > 8192 || Date.now() - last > 50) flush(); },
    });
    flush();
    post({ type: 'done', steps: r.steps, ms: Date.now() - t0 });
  } catch (e) {
    flush();
    if (e instanceof NeedInput) post({ type: 'need-input' });
    else if (e instanceof JJError) post({ type: 'error', phase: e.phase, message: e.message, line: e.line, col: e.col });
    else post({ type: 'error', phase: 'runtime', message: 'internal error: ' + (e as Error).message, line: 0, col: 0 });
  }
};
