# Compatibility: what was preserved, repaired, reconstructed

Every meaningful decision is recorded here with its reasoning. The vocabulary:

* **PRESERVED**: the original behaviour or design, kept as it was.
* **REPAIRED**: the original *implementation* was defective; the design intent was kept and made to work.
* **RECONSTRUCTED**: the original only *designed* it (`syn.txt`); this project filled in the details, as faithfully as the evidence allows.
* **CHOICE**: the evidence does not decide it; a choice was made (flagged in the in-app reference as SPECULATIVE where it matters).

Evidence labels (CONFIRMED / INFERRED / SPECULATIVE) are defined in [LANGUAGE_ARCHAEOLOGY.md](LANGUAGE_ARCHAEOLOGY.md).
Bug numbers (B1 to B10) refer to the table in §6 of that document.

Every example below is checked by the automated tests (`tests/engine.test.ts`, `tests/examples.test.ts`).

## 1. The one surviving program

`archive/JJ/test.j`:

```
whl moga;
print("Moga",,"Goga",,"Prosto",,"Loga".);
```

| | Result |
|---|---|
| Original compiler, as it ran | Generated `std::cout<<a;print("Moga" << " ""Goga" << ...`, not valid C++ (B3, B4). The surviving `writer.cpp`. |
| This reconstruction | `Moga Goga Prosto Loga
` |

**REPAIRED.** The expected output is what `syn.txt` describes (`,,` = pause, `.` = close the line) and what the fragments inside `JJexe`
(`" Goga"`, `" Prosto"`, `" Loga"`) show the author reached at least once. `whl moga;` declares a natural number with no value (it becomes `0`).
The test `archive regression` pins this, and checks that `examples/00-archive-test.j` is byte-identical to the archive.

## 2. Decisions

### Syntax and design (all PRESERVED unless noted)

| # | Topic | Decision | Basis |
|---|---|---|---|
| D1 | `:` is the assignment mark | **PRESERVED** `int a : 5;` and `int a {5}`; assignment `a : a + 1;` is **RECONSTRUCTED** | `syn.txt:10-11` CONFIRMED; plain assignment INFERRED |
| D2 | Type names | **PRESERVED** `whl int rat com real const nr txt char state bool` (`state` and `bool` are synonyms) | `syn.txt:13-24` |
| D3 | Byte sizes | **PRESERVED** `whl(1) x`, default 4 (`const` 2); allowed 1-16 | `syn.txt:14-20`, `cmp.hpp:149` |
| D4 | `/` returns int for whole numbers | **PRESERVED** `7/2` gives `3`; `rat(7)/2` gives `7/2` | `syn.txt:45`. Deliberately *not* "fixed" to give 3.5. |
| D5 | `*` | **RECONSTRUCTED** | Missing from `syn.txt`; INFERRED omission |
| D6 | `^` | `a^(b)`; integer powers stay exact; a negative integer power gives a `rat` (`2^(-2)` = `1/4`) | `syn.txt:47` CONFIRMED; the negative case is a **CHOICE** |
| D7 | `\|a\|` | **PRESERVED** | `syn.txt:48` |
| D8 | Comments `//` and `/* */` | **CHOICE** (the notes themselves are comments in this style) | - |
| D9 | `elif`/`else` with or without the backslash; `else` with or without `()` | accepts all spellings | `syn.txt:27` shows backslashes and empty parentheses; unclear if required |
| D10 | `do_all` | **RECONSTRUCTED**: with `(bool do_all = true)` *every* branch whose condition holds runs, and `else` runs only if none did | INFERRED from the name |
| D11 | Labels | `if(c) \name {...}` and `while(c) \|name {...}` | `syn.txt:27,29` CONFIRMED that they exist; exact position **SPECULATIVE** |
| D12 | `goto name;` | jumps to the **start** of the labelled statement (an `if` re-tests its condition; a `while` re-starts) and never comes back | `syn.txt:33` |
| D13 | `gotor name;` | jumps there, runs the labelled statement **to its end**, then continues after the `gotor` | `syn.txt:31` CONFIRMED |
| D14 | Labels are local to a function/top level; unknown label = transpile error | **CHOICE** (cannot jump into another function's frame) | - |
| D15 | `break` / `skip` | leave the loop / next iteration; outside a loop they are transpile errors | INFERRED |
| D16 | `end;` | **stops the whole program** | **SPECULATIVE** (no explanation survives) |
| D17 | Functions | `Name(params){code}`; hoisted (callable before the definition); `!(f,g)` / `for (f,g)` restrict callers; a function may always call itself; calling from elsewhere is a **transpile error** naming the allowed callers | `syn.txt:4-8` CONFIRMED; the rest RECONSTRUCTED |
| D18 | Parameters | typed like variables (`int a`, `txt who`, `int(2) small`), optional default (`int b = 10`) | the `=` default is borrowed from `(bool do_all = false)`; **INFERRED** |
| D19 | No return values | **PRESERVED by omission**: `return` appears nowhere in `syn.txt`; functions act on globals and print. Using a function inside an expression is a transpile error with an explanation | - |
| D20 | `Main` | **not** treated as an entry point; top-level statements run in order | `test.j` has no `Main`; the `Main(...)` in `syn.txt` is INFERRED to be a placeholder name |
| D21 | Variable scope | top-level declarations are **global** and visible inside functions; declarations inside `{}` blocks and function bodies are local to that block | **RECONSTRUCTED** (needed because functions cannot return values) |
| D22 | `take(a, b)` | reads whitespace-separated values from the **Input** box into the named variables, by their type | **SPECULATIVE** (`take()` is only named) |
| D23 | `com` literals | `3i` is an imaginary literal, so `1 + 2i` works | **SPECULATIVE** (no literal syntax survives) |
| D24 | `nr` | holds any whole or fractional number (an `int`, `real` or `rat` value, unchanged) | **SPECULATIVE** |
| D25 | `const` | type comes from the value; cannot be reassigned; needs a value | `syn.txt:19` "decided automatically" CONFIRMED; immutability INFERRED |

### `print` (the most evidenced feature)

| Source | Output | Notes |
|---|---|---|
| `print("a","b".);` | `ab
` | `,` writes the other part too. **PRESERVED** |
| `print("a",,"b");` | `a b` | `,,` = one pause (space). **PRESERVED** |
| `print("a",,,"b");` | `a  b` | each extra comma adds another space. **PRESERVED** (this is exactly what `cmp.hpp:120` does) |
| `print("a".,"b".);` | `a
b
` | `.` closes the line. **PRESERVED** |
| `print("Hello World".);` | `Hello World
` | **REPAIRED** (B2: the original deleted the space) |
| `print(3.5.);` | `3.5
` | **REPAIRED** (B8: a decimal point is not "end of line"; a `.` that is not between two digits is) |
| `print(a,,b);` with variables | `<a> <b>` | **REPAIRED** (B7: the original generated invalid C++ here) |
| `print(1<2);` | `true` | **CHOICE**: C++ would print `1`; `true`/`false` is clearer (**SPECULATIVE**) |
| `print(rat(3)/6);` | `1/2` | **CHOICE**: a whole rational prints as `5`, not `5/1` |
| `print(1.5 * 2.0);` | `3` | real numbers print like C++ `cout` (6 significant digits), the target the original wrote |

The text of a `print` is a list of *expressions*, not raw C++ text: in the original, whatever sat between the punctuation was pasted into the C++ line
(so `print(a+b)` "worked" only because C++ understood it). Parsing it is the **REPAIR** that makes the language independent of C++.

### Types and numbers

| Example | Result | Decision |
|---|---|---|
| `whl(1) w : 250; w : w + 10;` | `w` is `4` | **INFERRED**: sizes behave like C++ integer widths (the target), so values wrap |
| `int(1) i : 127; i : i + 1;` | `-128` | same |
| `whl w : 0; w : w - 1;` | `4294967295` | same (`whl` is unsigned) |
| `rat r : rat(0.75);` | `r = 3/4`, `getUp(r)` = 3, `getDown(r)` = 4 | `rat()` "rationalizes": **uses the shortest decimal form**, so `rat(0.1)` is `1/10`, not a 56-digit binary fraction |
| `rat a : 1; rat b : 3; a / b + a / b` | `2/3` | rationals are exact |
| `int a : 3.9;` | `3` | storing into an integer **truncates**, like C++ |
| `int a : "x";` | runtime error | a `txt` cannot be stored in an `int` |
| `round(2.5)`, `round(-2.5)` | `3`, `-3` | half away from zero (C `round`) |
| `trunc(-2.7)` | `-2` | toward zero |
| `sqrt(16)` | `4` (a `real`) | negative argument is a runtime error |
| `7 / 0`, `7 % 0` | runtime error | the original would crash/UB |

Intermediate arithmetic is **not wrapped**: `a * b` is computed exactly, and wrapping happens when the result is stored into a sized variable. (In C++
every operation would wrap; wrapping at the store keeps results predictable and is the only place a size is visible.) **CHOICE.**

### Error behaviour

| Kind | When | Example message |
|---|---|---|
| **Transpile error** | before anything runs | `Transpile error (line 2): expected ';' at the end of the statement, but found 'print'` |
| **Runtime error** | while running | `Runtime error (line 2): division by zero` |

The split mirrors the original's two stages (`g++` failing vs. the program failing). Errors carry a line number and click through to the editor.
Further transpile errors: undeclared names, assigning to a `const`, `break` outside a loop, unknown labels, calling a restricted function from a
disallowed place, wrong argument counts. (**REPAIRED**: the original had *no* error handling beyond the file-extension message.)

### Limits (playground safety, not language design)

| Limit | Value |
|---|---|
| Steps per run | 50,000,000 |
| Wall-clock time | 10 s (the worker is killed) |
| Output | 1,000,000 characters |
| Call depth | 5,000 |
| Exact numbers | below about 300,000 digits (`number too large`) |
| `txt` length | 1,000,000 characters |

## 3. Defects of the original and what became of them

| Bug | Treatment |
|---|---|
| B1 always opens `test.j` | **N/A**: there are no files in a browser; you edit the program directly |
| B2 whitespace stripped | **REPAIRED** (lexer) |
| B3 only `p` triggers keywords | **REPAIRED** (a real lexer/parser recognises every keyword) |
| B4 wrong offset | **REPAIRED** (the parser knows each token's position) |
| B5 uninitialised `returnInt` | **N/A** (the helper code is gone; numbers are parsed by a lexer) |
| B6 off-by-one read | **N/A** |
| B7 invalid C++ for `,,` | **REPAIRED** |
| B8 decimal point = end of line | **REPAIRED** |
| B9 `whl` placeholder | **REPAIRED**, so all declarations work |
| B10 leaves `writer.cpp`, shells out to `g++` | **REPLACED**: no files, no shell. See [RECONSTRUCTION.md](RECONSTRUCTION.md) |

## 4. Not reconstructed (and why)

| Item | Why |
|---|---|
| Return values / functions in expressions | No evidence at all; adding them would be inventing a feature |
| `Main` as an entry point | Contradicted by `test.j` |
| Complex-number printing format | Never specified; `3+4i` chosen (**SPECULATIVE**) |
| Hexadecimal/binary/scientific literals, arrays, user types, imports, `#include` | Not mentioned anywhere |
| Running the original C++ pipeline | Needs `g++` and a filesystem; see RECONSTRUCTION |
| Executing `JJexe` / `a.out` | Linux binaries; examined only with `strings` |

## 5. Versions in the playground

The app has a **V1 / V2** switch (Learn tab). V2 is the default.

| | V1 Classic | V2 |
|---|---|---|
| Everything designed in `syn.txt` (types, `print` marks, `if`/`elif`/`else`/`do_all`, `while`, `goto`/`gotor`, functions + visibility lists, operators, math functions) | yes | yes |
| Spaces inside strings | **dropped**, as the original reader did (B2): `"Hello World"` prints `HelloWorld` | kept |
| `take()` | no | yes |
| Imaginary literals (`3i`) | no | yes |
| Default parameter values | no | yes |

V1 is a feature restriction plus the one original bug that is cheap and safe to reproduce; it does **not** reproduce the other original defects
(wrong print offset, `.` ending a line inside numbers, etc.), because those made the language unusable rather than "classic".
Choosing V1 reports the V2-only features as a transpile error ("... is not part of V1 (Classic); switch to V2").

## 6. Interactive `take()` in the playground

`take()` is SPECULATIVE (see D22). In the playground it is interactive: when the Input box has no more values, the console shows a prompt. Because SuperJ has
no randomness, time or other hidden input, a program is a pure function of its inputs, so the playground answers the prompt by running the program again
from the start with the new line appended (output of the earlier run is replaced, not duplicated). Lines typed this way are echoed in the output.
Consequence: very long-running programs repeat their work on each answer.
