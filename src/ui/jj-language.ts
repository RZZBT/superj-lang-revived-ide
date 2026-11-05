import * as monaco from './monaco';

export const LANG_ID = 'jj';

const TYPES = ['whl', 'int', 'rat', 'com', 'real', 'const', 'nr', 'txt', 'char', 'state', 'bool'];
const KEYWORDS = ['if', 'elif', 'else', 'while', 'goto', 'gotor', 'break', 'skip', 'end', 'for'];
const BUILTINS = ['print', 'take', 'getUp', 'getDown', 'sqrt', 'round', 'trunc'];

let registered = false;

export function registerJJ() {
  if (registered) return;
  registered = true;
  monaco.languages.register({ id: LANG_ID, extensions: ['.j'], aliases: ['SuperJ'] });

  monaco.languages.setMonarchTokensProvider(LANG_ID, {
    types: TYPES,
    keywords: KEYWORDS,
    builtins: BUILTINS,
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/"/, 'string', '@string'],
        [/'(\\.|[^'\\])'/, 'string'],
        [/\d+\.\d+i?|\d+i?/, 'number'],
        [/\b(true|false)\b/, 'constant'],
        [/,,+/, 'jj.pause'],
        [/[a-zA-Z_]\w*/, {
          cases: { '@types': 'type', '@keywords': 'keyword', '@builtins': 'support.function', '@default': 'identifier' },
        }],
        [/\\/, 'keyword'],
        [/[{}()]/, '@brackets'],
        [/&&|\|\||==|!=|<=|>=|[+\-*/%^<>!:|=]/, 'operator'],
        [/[;,.]/, 'delimiter'],
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment'],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],
    },
  } as monaco.languages.IMonarchLanguage);

  monaco.languages.setLanguageConfiguration(LANG_ID, {
    comments: { lineComment: '//', blockComment: ['/*', '*/'] },
    brackets: [['{', '}'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string', 'comment'] },
      { open: "'", close: "'", notIn: ['string', 'comment'] },
    ],
    surroundingPairs: [{ open: '{', close: '}' }, { open: '(', close: ')' }, { open: '"', close: '"' }],
    indentationRules: {
      increaseIndentPattern: /\{[^}"']*$/,
      decreaseIndentPattern: /^\s*\}/,
    },
    onEnterRules: [{ beforeText: /\{\s*$/, action: { indentAction: monaco.languages.IndentAction.Indent } }],
  });

  const snip = (label: string, insertText: string, detail: string): monaco.languages.CompletionItem => ({
    label, detail, insertText, kind: monaco.languages.CompletionItemKind.Snippet,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    range: undefined as unknown as monaco.IRange,
  });
  monaco.languages.registerCompletionItemProvider(LANG_ID, {
    provideCompletionItems(model, position) {
      const w = model.getWordUntilPosition(position);
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: w.startColumn, endColumn: w.endColumn };
      const items = [
        snip('print', 'print(${1:"text"}.);', 'print(a,,b.); , joins, ,, adds a space, . ends the line'),
        snip('take', 'take(${1:name});', 'read values from the Input box'),
        snip('if', 'if(${1:condition}){\n\t$0\n}', 'if(state){ }'),
        snip('ifelse', 'if(${1:condition}){\n\t$2\n} \\else(){\n\t$0\n}', 'if / \\else()'),
        snip('elif', '\\elif(${1:condition}){\n\t$0\n}', '\\elif(state){ }'),
        snip('while', 'while(${1:condition}){\n\t$0\n}', 'while(condition){ }'),
        snip('func', '${1:name}(${2}){\n\t$0\n}', 'Name(params){ code }'),
        snip('int', 'int ${1:name} : ${2:0};', 'datatype name : value;'),
        snip('whl', 'whl ${1:name} : ${2:0};', 'natural number'),
        snip('rat', 'rat ${1:name} : ${2:rat(1) / 3};', 'exact rational'),
        snip('real', 'real ${1:name} : ${2:0.0};', 'real number'),
        snip('txt', 'txt ${1:name} : "${2}";', 'text'),
      ];
      for (const kw of [...KEYWORDS, ...TYPES.filter((t) => !['int', 'whl', 'rat', 'real', 'txt'].includes(t)), ...BUILTINS.filter((b) => b !== 'print' && b !== 'take')]) {
        items.push({ label: kw, insertText: kw, kind: monaco.languages.CompletionItemKind.Keyword, range } as monaco.languages.CompletionItem);
      }
      return { suggestions: items.map((i) => ({ ...i, range })) };
    },
  });

  monaco.editor.defineTheme('jj-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '4b4b4b' },
      { token: 'keyword', foreground: '4d9a7b' },
      { token: 'type', foreground: '6fbf92' },
      { token: 'support.function', foreground: 'ececec', fontStyle: 'bold' },
      { token: 'string', foreground: 'e9c46a' },
      { token: 'string.escape', foreground: '4d9a7b' },
      { token: 'number', foreground: 'ca8059' },
      { token: 'constant', foreground: 'ca8059' },
      { token: 'jj.pause', foreground: 'ececec', fontStyle: 'bold' },
      { token: 'operator', foreground: '8b8b8b' },
      { token: 'delimiter', foreground: '8b8b8b' },
    ],
    colors: {
      'editor.background': '#0a0a0a',
      'editor.foreground': '#ececec',
      'editor.lineHighlightBackground': '#141414',
      'editorLineNumber.foreground': '#303030',
      'editorLineNumber.activeForeground': '#8b8b8b',
      'editorGutter.background': '#0a0a0a',
      'editorCursor.foreground': '#ececec',
      'editor.selectionBackground': '#4d9a7b33',
      'editor.selectionHighlightBackground': '#4d9a7b1a',
      'editor.findMatchBackground': '#fa7d0044',
      'editor.findMatchHighlightBackground': '#fa7d0022',
      'editorBracketHighlight.foreground1': '#8b8b8b',
      'editorBracketHighlight.foreground2': '#8b8b8b',
      'editorBracketHighlight.foreground3': '#8b8b8b',
      'editorBracketHighlight.foreground4': '#8b8b8b',
      'editorBracketHighlight.foreground5': '#8b8b8b',
      'editorBracketHighlight.foreground6': '#8b8b8b',
      'editorBracketHighlight.unexpectedBracket.foreground': '#de0004',
      'editorOverviewRuler.background': '#0a0a0a',
      'editorOverviewRuler.border': '#303030',
      'editorError.foreground': '#de0004',
      'editorWarning.foreground': '#fa7d00',
      'editorInfo.foreground': '#83b2ed',
      'editorWidget.background': '#141414',
      'editorWidget.border': '#303030',
      'editorSuggestWidget.background': '#1c1c1c',
      'editorSuggestWidget.border': '#303030',
      'editorSuggestWidget.foreground': '#ececec',
      'editorSuggestWidget.selectedBackground': '#303030',
    },
  });
}
