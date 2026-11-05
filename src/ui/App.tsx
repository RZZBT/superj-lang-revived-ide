import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import * as monaco from './monaco';
import { LANG_ID, registerJJ } from './jj-language';
import { Learn } from './Learn';
import { JJError, transpile, Version } from '../engine';
import { startRun, RunHandle, WALL_CLOCK_MS } from './runner';
import logo from './assets/rzzbt.png';

const rawExamples = import.meta.glob('../../examples/*.j', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
interface Example { id: string; title: string; code: string; needsV2: boolean }
const EXAMPLES: Example[] = Object.entries(rawExamples)
  .map(([path, code]) => {
    const file = path.split('/').pop()!.replace(/\.j$/, '');
    let needsV2 = false;
    try { transpile(code, 'v1'); } catch { needsV2 = true; }
    return { id: file, title: file.replace(/^\d+-/, '').replace(/-/g, ' '), code, needsV2 };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

const STARTER = 'print("Hello World!".);\n';
const STORAGE_KEY = 'superj-revived:main.j:v2';
const VERSION_KEY = 'superj-revived:version';

type Line = { kind: 'sys' | 'out' | 'err' | 'ok'; text: string; src?: number };
type Tab = 'learn' | 'examples' | 'generated';

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const handle = useRef<RunHandle | null>(null);
  const runRef = useRef<() => void>(() => {});
  const [code, setCode] = useState(() => localStorage.getItem(STORAGE_KEY) ?? STARTER);
  const [version, setVersionState] = useState<Version>(() => (localStorage.getItem(VERSION_KEY) === 'v1' ? 'v1' : 'v2'));
  const [stdin, setStdin] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<Tab>('learn');
  const [consoleTab, setConsoleTab] = useState<'console' | 'input'>('console');
  const [problem, setProblem] = useState<JJError | null>(null);
  const [generated, setGenerated] = useState('');
  const consoleEnd = useRef<HTMLDivElement>(null);
  const typedRef = useRef<string[]>([]);
  const promptRef = useRef<HTMLInputElement>(null);
  const [waiting, setWaiting] = useState(false);
  const [promptText, setPromptText] = useState('');

  const setVersion = (v: Version) => { setVersionState(v); localStorage.setItem(VERSION_KEY, v); };

  useEffect(() => {
    registerJJ();
    const ed = monaco.editor.create(host.current!, {
      value: code,
      language: LANG_ID,
      theme: 'jj-dark',
      automaticLayout: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
      minimap: { enabled: false },
      lineNumbers: 'on',
      matchBrackets: 'always',
      autoIndent: 'full',
      tabSize: 4,
      scrollBeyondLastLine: false,
      renderWhitespace: 'none',
      padding: { top: 10 },
      bracketPairColorization: { enabled: false },
    });
    editor.current = ed;
    ed.onDidChangeModelContent(() => setCode(ed.getValue()));
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
    return () => { ed.dispose(); editor.current = null; };
  }, []);

  const setEditorText = (text: string) => {
    const ed = editor.current;
    if (ed && ed.getValue() !== text) ed.setValue(text);
    setCode(text);
  };

  useEffect(() => { localStorage.setItem(STORAGE_KEY, code); }, [code]);

  useEffect(() => {
    const t = setTimeout(() => {
      const model = editor.current?.getModel();
      try {
        const r = transpile(code, version);
        setProblem(null);
        setGenerated(r.listing);
        if (model) monaco.editor.setModelMarkers(model, 'jj', []);
      } catch (e) {
        if (!(e instanceof JJError)) throw e;
        setProblem(e);
        if (model) {
          const ln = Math.min(Math.max(e.line, 1), model.getLineCount());
          monaco.editor.setModelMarkers(model, 'jj', [{
            severity: monaco.MarkerSeverity.Error,
            message: e.message,
            startLineNumber: ln,
            endLineNumber: ln,
            startColumn: e.col || 1,
            endColumn: e.col ? e.col + 1 : model.getLineMaxColumn(ln),
          }]);
        }
      }
    }, 300);
    return () => clearTimeout(t);
  }, [code, version]);

  const push = useCallback((l: Line) => setLines((p) => [...p, l]), []);

  // `typed` is what the player has typed so far. When take() runs dry the console asks for a line
  // and the program is re-run from the start with it added (programs are deterministic).
  // Replays swap their output in at once so the console does not flicker.
  const run = useCallback((typed: string[] = []) => {
    handle.current?.stop();
    typedRef.current = typed;
    const replay = typed.length > 0;
    const head: Line[] = [{ kind: 'sys', text: 'Got that, begin processing!' }];
    let transpiled = false;
    let outText = '';
    const snapshot = (tail: Line[]) => {
      const l: Line[] = [...head];
      if (transpiled) l.push({ kind: 'sys', text: 'Gata' });
      if (outText) l.push({ kind: 'out', text: outText });
      return [...l, ...tail];
    };
    if (!replay) setLines(head);
    setConsoleTab('console');
    setWaiting(false);
    setRunning(true);
    const t0 = performance.now();
    const preset = stdin;
    const echoFrom = preset.split(/\s+/).filter(Boolean).length;
    handle.current = startRun(code, version, [preset, ...typed].join('\n'), echoFrom, (m) => {
      switch (m.type) {
        case 'transpiled': transpiled = true; if (!replay) push({ kind: 'sys', text: 'Gata' }); break;
        case 'out':
          outText += m.text;
          if (!replay) {
            setLines((p) => {
              const last = p[p.length - 1];
              if (last?.kind === 'out') return [...p.slice(0, -1), { kind: 'out', text: last.text + m.text }];
              return [...p, { kind: 'out', text: m.text }];
            });
          }
          break;
        case 'need-input': setLines(snapshot([])); setWaiting(true); break;
        case 'done':
          setLines(snapshot([{ kind: 'ok', text: `Finished in ${Math.max(1, Math.round(performance.now() - t0))} ms (${m.steps.toLocaleString('en')} steps)` }]));
          setRunning(false);
          break;
        case 'error':
          setLines(snapshot([{
            kind: 'err',
            text: `${m.phase === 'transpile' ? 'Transpile error' : 'Runtime error'}${m.line ? ` (line ${m.line})` : ''}: ${m.message}`,
            src: m.line || undefined,
          }]));
          setRunning(false);
          break;
        case 'stopped': setLines(snapshot([{ kind: 'sys', text: 'Stopped.' }])); setRunning(false); break;
        case 'timeout':
          setLines(snapshot([{ kind: 'err', text: `Runtime error: stopped after ${WALL_CLOCK_MS / 1000} seconds. Is there an endless loop?` }]));
          setRunning(false);
          break;
      }
    });
  }, [code, version, stdin, push]);
  runRef.current = () => run();

  const stop = () => {
    handle.current?.stop();
    if (waiting) {
      setWaiting(false);
      setRunning(false);
      push({ kind: 'sys', text: 'Stopped.' });
    }
  };

  const submitLine = (e: FormEvent) => {
    e.preventDefault();
    const line = promptText;
    setPromptText('');
    run([...typedRef.current, line]);
  };
  useEffect(() => () => handle.current?.stop(), []);
  useEffect(() => { consoleEnd.current?.scrollIntoView({ block: 'end' }); }, [lines, waiting]);
  useEffect(() => { if (waiting) promptRef.current?.focus(); }, [waiting, lines]);

  const reveal = (line: number) => {
    editor.current?.revealLineInCenter(line);
    editor.current?.setPosition({ lineNumber: line, column: 1 });
    editor.current?.focus();
  };

  const loadExample = (ex: Example) => {
    const known = code === STARTER || EXAMPLES.some((e) => e.code === code);
    if (!known && !window.confirm('Replace the contents of main.j with this example?')) return;
    setEditorText(ex.code);
  };

  const status = useMemo(
    () => (problem ? `1 problem: line ${problem.line || '?'}` : 'No problems'),
    [problem],
  );

  return (
    <div className="app">
      <header className="top">
        <img className="logo-img" src={logo} alt="rzzbt" />
        <div className="actions">
          {running ? (
            <button className="btn stop" onClick={stop} title="Stop the program">Stop</button>
          ) : (
            <button className="btn run" onClick={() => run()} title="Run (Ctrl+Enter)">Run</button>
          )}
          <button className="btn" onClick={() => setLines([])}>Clear console</button>
          <button className="btn" onClick={() => { if (window.confirm('Reset main.j to the Hello World starter?')) setEditorText(STARTER); }}>
            Reset example
          </button>
        </div>
      </header>

      <main className="main">
        <section className="left">
          <div className="filetab">main.j</div>
          <div className="editor" ref={host} />
          <div className="console">
            <div className="tabs small">
              <button className={consoleTab === 'console' ? 'on' : ''} onClick={() => setConsoleTab('console')}>Console</button>
              <button className={consoleTab === 'input' ? 'on' : ''} onClick={() => setConsoleTab('input')}>Input for take()</button>
            </div>
            {consoleTab === 'console' ? (
              <div className="console-body" role="log" aria-live="polite">
                {lines.length === 0 && <div className="sys">Press Run (Ctrl+Enter) to run the program.</div>}
                {lines.map((l, i) => (
                  <pre key={i} className={l.kind} onClick={l.src ? () => reveal(l.src!) : undefined} style={l.src ? { cursor: 'pointer' } : undefined}>{l.text}</pre>
                ))}
                {waiting && (
                  <form className="prompt" onSubmit={submitLine}>
                    <span>&gt;</span>
                    <input ref={promptRef} value={promptText} onChange={(e) => setPromptText(e.target.value)} placeholder="type here and press Enter" aria-label="Input for the running program" spellCheck={false} autoComplete="off" />
                  </form>
                )}
                <div ref={consoleEnd} />
              </div>
            ) : (
              <textarea
                className="stdin"
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="Values for take(), separated by spaces or new lines. Example: Ada 36"
                spellCheck={false}
              />
            )}
          </div>
        </section>

        <aside className="side">
          <div className="tabs">
            <button className={tab === 'learn' ? 'on' : ''} onClick={() => setTab('learn')}>Learn</button>
            <button className={tab === 'examples' ? 'on' : ''} onClick={() => setTab('examples')}>Examples</button>
            <button className={tab === 'generated' ? 'on' : ''} onClick={() => setTab('generated')}>Generated</button>
          </div>
          <div className="side-body">
            {tab === 'learn' && <Learn version={version} setVersion={setVersion} />}
            {tab === 'examples' && (
              <ul className="examples">
                {EXAMPLES.map((ex) => (
                  <li key={ex.id}>
                    <button onClick={() => loadExample(ex)}>
                      <span className="ex-title">{ex.title}</span>
                      {ex.needsV2 && <span className="only">V2 only</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {tab === 'generated' && <pre className="listing">{problem ? `; nothing generated: ${problem.message}` : generated}</pre>}
          </div>
        </aside>
      </main>

      <footer className="status">
        <span className={problem ? 'bad' : 'good'}>{status}</span>
        <span>SuperJ {version === 'v1' ? 'V1 Classic' : 'V2'}</span>
      </footer>
    </div>
  );
}
