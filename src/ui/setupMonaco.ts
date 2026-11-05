import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';

// Bundle Monaco locally so the site works offline and under any base path.
(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};
