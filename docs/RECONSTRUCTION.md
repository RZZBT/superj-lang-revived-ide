# Reconstruction

How the playground works. For what the original files show, see [LANGUAGE_ARCHAEOLOGY.md](LANGUAGE_ARCHAEOLOGY.md).

## Pipeline

| Original | Here |
|---|---|
| read `test.j`, drop all whitespace | lexer (`src/engine/lexer.ts`) |
| scan for `p`, ask `cmp.hpp` what to emit | parser (`parser.ts`) and syntax tree (`ast.ts`) |
| write C++ to `writer.cpp` | compiler (`compiler.ts`), which emits an instruction list |
| `g++ writer.cpp -o JJexe` | VM (`vm.ts`) in a Web Worker |

A static site cannot run `g++`, so the target is an instruction list instead of C++. The shape stays the same: source, transpile, run. The console prints
the original's "Got that, begin processing!" and "Gata". The Generated tab shows the instruction list, the closest thing to `writer.cpp`.

Not JavaScript, because `goto`/`gotor` and the exact number types don't map onto it cleanly. A flat instruction list makes jumps simple, and no
generated code is ever evaluated.

## Layout

```
archive/JJ/         original files, unmodified
docs/               documentation
examples/*.j        example programs (01 is the archive's test.j)
src/engine/         lexer, parser, compiler, vm, values, ops
src/worker/         Web Worker that transpiles and runs a program
src/ui/             React and Monaco front end
tests/              Vitest
```

The engine uses no browser or Node APIs, so the worker and the tests run the same code.

## Running untrusted programs

Programs are interpreted. They never become JavaScript and nothing is passed to `eval`. A program can compute and print, nothing else.

| Limit | Value |
|---|---|
| Worker | off the main thread; terminated by Stop or after 10 s |
| Steps | 50,000,000 |
| Output | 1,000,000 characters |
| Call depth | 5,000 |
| Exact numbers (`rat`, `nr`), `txt` | about 300,000 digits, 1,000,000 characters |

The parser and compiler also run on the main thread, for live error markers. They don't execute anything, and nesting depth is capped.

Known gaps: browsers give no memory limit for a worker, so a hostile program can use a fair amount of memory for up to 10 s. The engine hasn't been
audited by anyone else. `take()` reads the input box first and then asks in the console, by re-running the program from the start.
