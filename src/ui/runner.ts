import type { FromWorker, ToWorker } from '../worker/runner.worker';

export const WALL_CLOCK_MS = 10_000;

export interface RunHandle { stop: () => void }

/** Runs a program in a fresh Web Worker, terminated on finish, stop or timeout. */
export function startRun(
  source: string,
  version: 'v1' | 'v2',
  stdin: string,
  echoFrom: number,
  onMessage: (m: FromWorker | { type: 'stopped' } | { type: 'timeout' }) => void,
): RunHandle {
  const worker = new Worker(new URL('../worker/runner.worker.ts', import.meta.url), { type: 'module' });
  let finished = false;
  const end = () => { finished = true; clearTimeout(timer); worker.terminate(); };
  const timer = setTimeout(() => {
    if (finished) return;
    end();
    onMessage({ type: 'timeout' });
  }, WALL_CLOCK_MS);

  worker.onmessage = (ev: MessageEvent<FromWorker>) => {
    if (finished) return;
    if (ev.data.type === 'done' || ev.data.type === 'error' || ev.data.type === 'need-input') end();
    onMessage(ev.data);
  };
  worker.onerror = (ev) => {
    if (finished) return;
    end();
    onMessage({ type: 'error', phase: 'runtime', message: 'the worker crashed: ' + ev.message, line: 0, col: 0 });
  };
  const msg: ToWorker = { source, version, stdin, echoFrom, maxSteps: 50_000_000, maxOutput: 1_000_000 };
  worker.postMessage(msg);

  return {
    stop() {
      if (finished) return;
      end();
      onMessage({ type: 'stopped' });
    },
  };
}
