# Language Archaeology: what the SuperJ archive actually tells us

This document is the historical record. It describes **only the surviving files** and what can honestly be concluded from them.
Everything done to bring the language back to life is documented separately in [COMPATIBILITY.md](COMPATIBILITY.md) and
[RECONSTRUCTION.md](RECONSTRUCTION.md).

Every claim carries one of three labels:

| Label | Meaning |
|---|---|
| **CONFIRMED** | Stated directly by a surviving file (source, notes, example, or string inside a binary). |
| **INFERRED** | Strongly suggested by the architecture or by the wording of the notes, but never stated outright. |
| **SPECULATIVE** | A plausible reading with little or no evidence. Implemented only where a feature would otherwise be unusable, and always flagged. |

The files are preserved byte-for-byte in [`archive/JJ/`](../archive/JJ) (SHA-256 list in [`archive/MANIFEST.sha256`](../archive/MANIFEST.sha256)).

## 1. Inventory

| File | Size | What it is |
|---|---|---|
| `syn.txt` | 1,761 B | The **language design notes**, in Romanian, written as a comment block inside a `.cpp`-style file. The only description of the language. |
| `test.j` | 52 B | The **only surviving SuperJ program** (`.j` source). |
| `cmp.cpp` | 1,673 B | The compiler driver: reads a `.j` file, writes `writer.cpp`, calls `g++`. |
| `cmp.hpp` | 4,900 B | The "keyword engine": decides what C++ to emit for each SuperJ keyword. |
| `writer.cpp` | 129 B | A leftover **generated** C++ file from one run of the compiler. |
| `a.out` | 40,944 B | A compiled build of the compiler itself (Linux x86-64 ELF). |
| `JJexe` | 25,544 B | A compiled program produced by the compiler (Linux x86-64 ELF, gcc 12.2.1). |

Only the four files named in the task plus `test.j` carry readable evidence; `a.out` and `JJexe` were examined with `strings` only. They were **not
executed** (they are Linux binaries and this reconstruction was done on Windows).

## 2. What was the language trying to be?

**CONFIRMED** (`syn.txt`, `cmp.cpp`): a small, **statically typed, imperative language** with its own syntax, compiled by *transpiling to C++* and then
invoking `g++`. Source files use the extension **`.j`**; the compiler binary is named **`JJexe`** by its own `g++ writer.cpp -o JJexe` line
(`cmp.cpp:32`), and the archive folder is called `JJ`: those are the **historical file names**. The language itself is called **SuperJ**
(the name of this project, "SuperJ Revived"), and that is the name used everywhere else in this documentation and in the playground.

Its distinguishing ideas, all from `syn.txt`:

1. **Numeric tower as first-class types**: natural numbers (`whl`), integers (`int`), **rationals (`rat`)**, **complex numbers (`com`)**, reals
   (`real`). Rationals even get their own function family (`rat()`, `getUp()`, `getDown()`). This is mathematics-flavoured rather than
   systems-flavoured.
2. **Types sized in bytes** with defaults ("size in bytes, default is 4").
3. **`print` with punctuation as formatting**: `,` / `,,` / `.` (see §5).
4. **Two kinds of `goto`**: `goto` (one-way) and `gotor` (go, run that statement, *come back*), plus **names for `if` and `while` statements** that
   act as the labels.
5. **`if` with a `do_all` option** and `elif`/`else` written with backslashes.
6. **Function visibility lists**: a function can be callable from anywhere, or only from a named set of other functions.

## 3. The transpilation pipeline

**CONFIRMED** (`cmp.cpp:16-39`, `cmp.cpp:42-84`). The original pipeline, step by step:

```
test.j -> read file -> strip all whitespace -> scan for 'p' -> keyword engine (cmp.hpp)
  -> writer.cpp -> g++ writer.cpp -o JJexe -> prints "Gata"
```

1. `main` checks that `argv[1]` ends in `.j` (`cmp.cpp:47`) and otherwise says *"Bro what type of file is that? (should be .j) Bye"*.
2. It opens a file and prints **"Got that, begin processing!"** (`cmp.cpp:77`).
3. `BeginWriting` creates `writer.cpp`, writes `#include <iostream>`, `#include <cmath>`, `int main(){` (`cmp.cpp:20-21`).
4. It loops over every character; whenever it sees `'p'` it calls `checkKeyword` (`cmp.cpp:23-27`).
5. `checkKeyword` (`cmp.hpp:212`) takes a 5-character window, builds a pseudo-header string, and `syntaxChecker` dispatches **by keyword length**
   (`k_5` for 5-letter keywords, `k_3` for 3-letter ones) (`cmp.hpp:171-210`).
6. `print()` (`cmp.hpp:115`) translates the argument list into a `std::cout << ...;` statement.
7. The closing `}` is written, **"Gata"** ("Done", Romanian) is printed and `g++` is run (`cmp.cpp:29-32`).
8. `CleanUp()` (delete `writer.cpp`) exists but its call is commented out (`cmp.cpp:33`), which is why `writer.cpp` survived.

**CONFIRMED architectural character**: the whole program body goes into a single C++ `main()`. A SuperJ file is a **sequence of top-level statements**, not a
`main` function plus definitions. (`test.j` agrees: it has no function at all.)

**INFERRED**: the keyword-by-length dispatch and the "header string" `print"32"5;` (a comment at `cmp.hpp:231`) show the author was experimenting
with *encoding a keyword's position and length into a string* to decide how to parse it. It is an early, abandoned parsing idea rather than a design
the language depends on.

## 4. Implemented, partial, planned

| Feature | Status | Evidence |
|---|---|---|
| `print(...)` with `,` `,,` `.` | **Implemented** (with bugs) | `cmp.hpp:115-142`, `test.j`, `writer.cpp`, strings in `JJexe` |
| `whl` declaration | **Started, stubbed** | `cmp.hpp:144-169`: parses a size and a name, then writes the placeholder `" int a = 3"` and ignores both. Also unreachable: only `'p'` triggers the engine (`cmp.cpp:24`). |
| `.j` extension check, error message, progress messages | Implemented | `cmp.cpp:42-77` |
| `datatype name : value;` / `name {value}` | **Designed only** | `syn.txt:10-11` |
| `int`, `rat`, `com`, `real`, `const`, `nr`, `txt`, `char`, `state/bool` | **Designed only** | `syn.txt:13-24` |
| `if` / `elif` / `else`, `do_all`, `while`, `goto`, `gotor`, `break`, `skip`, `end` | **Designed only** | `syn.txt:26-39` |
| Operators `+ - / % ^ \|a\| < > <= >= != == && \|\|` | **Designed only** | `syn.txt:43-56` |
| `rat() getUp() getDown() sqrt() round() trunc()` | **Designed only** | `syn.txt:60-65` |
| `take()` | **Named only** | `syn.txt:74` (no description) |
| Functions `Main(params){code}` and visibility lists | **Designed only** | `syn.txt:4-8` |

## 5. The syntax, from the notes

### 5.1 Declarations: CONFIRMED (`syn.txt:10-11`)

```
datatype name : value;
datatype name {value}
```

Two spellings of the same thing. **`:` is the "gets the value" mark**, not `=`. **INFERRED**: plain assignment to an existing variable uses the same
`name : value;` (the language already has `==` for equality, and `=` appears only for a parameter default in `(bool do_all = false)`).

`whl` in `cmp.hpp:149` looks for a `(` straight after the keyword and collects the characters up to `)` into `byteSize`: **CONFIRMED** that the byte size
is written in parentheses right after the type, e.g. `whl(1) x`. (`syn.txt:14`: *"whl(size in bytes, default is 4)"*.)

### 5.2 Data types: CONFIRMED names and defaults (`syn.txt:13-24`)

| Type | Notes in `syn.txt` (translated) | Default size |
|---|---|---|
| `whl` | natural numbers | 4 |
| `int` | integers | 4 |
| `rat` | rationals | 4 |
| `com` | complex numbers | 4 |
| `real` | real numbers | 4 |
| `const` | constants, *"decided automatically"* | 2 |
| `nr` | *(no description)* | 4 |
| `txt`, `char`, `state`/`bool` | text, character, truth value | - |

What is **INFERRED**: that `whl` is unsigned and `int` signed, and that sizes behave like C++ integer widths (the target language is C++).
**SPECULATIVE**: what `nr` means (it sits among the numeric types with a size, so "number" is the natural guess), and how a `com` literal is written
(the notes never say).

### 5.3 Actions: CONFIRMED names, SPECULATIVE spellings (`syn.txt:26-39`)

```
if(state)(bool do_all = false)   \else()   \elif()   \(you can specify a name for goto)
while(condition) |(you can specify a name for goto)
gotor name   (goes to the label, but after the statement runs, you come back)
goto name    (goes to any label and does not come back)
break   skip   end
```

* **CONFIRMED**: `elif`/`else` exist, `\` introduces them in the notes, and `if` takes an optional second parenthesis `(bool do_all = false)`.
* **INFERRED**: `do_all = true` means *every* true branch runs rather than the first only (the name says "do all"; nothing else could be meant).
* **CONFIRMED**: an `if` and a `while` can carry a **name** that `goto`/`gotor` use; `|` introduces the name on a `while` and `\` on an `if`.
* **SPECULATIVE**: the exact position of the name (this reconstruction puts it after the condition, before `{`), and whether `\` is mandatory before
  `elif`/`else` (this reconstruction accepts both).
* **INFERRED**: `break` leaves a loop; `skip` jumps to the next iteration (the usual meaning of such a pair).
* **SPECULATIVE**: `end`. The notes list it beside `break` and `skip` with no explanation. This reconstruction makes it **stop the program**.

### 5.4 Operators: CONFIRMED (`syn.txt:43-56`)

`a+b`, `a-b`, `a/b` (**"division, returns int"**), `a%b`, `a^(b)`, `|a|`, `<`, `>`, `<=`, `>=`, `!=`, `==`, `&&`, `||`.

* **INFERRED**: multiplication exists. It is the one arithmetic operator missing from the list, in a language that has division, modulo, powers and
  complex numbers; this is an omission, not a design choice. (`*` is therefore used.)
* The note on `/` says it returns an integer. **CONFIRMED** as a deliberate rule (`int / int` is whole division).

### 5.5 Math functions: CONFIRMED (`syn.txt:60-65`)

`rat()` *rationalizes*, `getUp()` numerator, `getDown()` denominator, `sqrt()`, `round()`, `trunc()`.

### 5.6 `print`: CONFIRMED (`syn.txt:70-73`, `cmp.hpp:115-142`, `test.j`)

```
print("Moga",,"Goga",,"Prosto",,"Loga".);
```

| Mark | Note in `syn.txt` | What `cmp.hpp` does |
|---|---|---|
| `,` | "if you put `,` it will also write the other part" | emits ` << ` |
| `,,` | "if you put `,,` it puts a pause between the elements" | emits `" "` after the first comma's ` << ` |
| `.` | "if you put `.` the line closes" | emits `<<std::endl` |
| `)` outside a string | end of arguments | stops scanning |

`test.j` is a complete demonstration of all three marks. The survivors agree on what it should print: **`Moga Goga Prosto Loga`** and a newline:
`JJexe` contains the strings `" Goga"`, `" Prosto"`, `" Loga"` (**CONFIRMED** by `strings`), i.e. each word after the first is preceded by a space.

### 5.7 Functions: CONFIRMED fragments (`syn.txt:4-8`)

```
// Accesibile oriunde            (accessible from anywhere)
// Main(params){code}
// Accesibile doar in alte functii:   (accessible only in other functions:)
// Main(params){}!(functions);   sau   Main(params){} for (functions)
```

* **CONFIRMED**: a function is written `Name(params){code}`.
* **CONFIRMED**: it is either public, or restricted with `!(...)` or `for (...)` followed by the functions allowed to use it.
* **INFERRED**: `Main` in these lines is a placeholder name, not an entry point (the only real program, `test.j`, has top-level statements and no `Main`).
* **SPECULATIVE / unknown**: parameter syntax, return values (`return` is not in the list of actions), whether functions can be called inside
  expressions. This reconstruction gives functions **typed parameters and no return value**.

The last line of `syn.txt` is `int main(){}`: leftover C++ scaffolding.

## 6. Bugs in the original implementation

These are **CONFIRMED defects** (visible in the code), not design. Their treatment is in [COMPATIBILITY.md](COMPATIBILITY.md).

| # | Where | Defect |
|---|---|---|
| B1 | `cmp.cpp:61` | Always opens the literal `"test.j"`; the `argv[1]` filename is only checked, never used. |
| B2 | `cmp.cpp:63-68` | Reads with `reader >> tmpBuf`, which **drops all whitespace, including inside strings**: `print("Hello World")` becomes `HelloWorld`. |
| B3 | `cmp.cpp:24` | Only a `p` triggers keyword handling, so no other keyword (including `whl`) can ever be recognised. |
| B4 | `cmp.hpp:172-175`, `cmp.hpp:195` | **`print` is handed the keyword's *size* instead of its *position*.** `syntaxChecker` calls `deFormatSize(keyword)`, which returns the length (5), and `k_5` then calls `print(deFormatSize(keyword))`, so `print(5)` starts scanning at `u_code[6]`. **CONFIRMED by hand-trace**: `test.j` with whitespace stripped is `whlmoga;print("Moga",,...`; offset 6 is the `a` of `moga`, so the scan swallows `a;print(`, exactly the `std::cout<<a;print("Moga" << ...` line in the surviving `writer.cpp`. (A second flaw: the real index is appended with `returnStr += tempIndex` at `cmp.hpp:226` as one *character code* but is read back as decimal digits, so it could never have round-tripped anyway.) |
| B5 | `cmp.hpp:12-69` | `convertStringToInt`: `returnInt` is never initialised (undefined behaviour). |
| B6 | `cmp.hpp:76` | `deFormatSize` starts at `word[word.size()]`, one past the last character. |
| B7 | `cmp.hpp:120-123` | For `,,` the generated text is `<< " ""Goga"`: adjacent string literals. It works only when a literal follows; `a,,b` with a variable would produce invalid C++. |
| B8 | `cmp.hpp:128` | Any `.` outside a string becomes `std::endl`, so the decimal point in `print(3.5)` would end the line. |
| B9 | `cmp.hpp:166` | `whl()` writes a hard-coded placeholder (`" int a = 3"`) and discards the parsed size and name. |
| B10 | `cmp.cpp:13,33` | `CleanUp()` is disabled; the compiler leaves `writer.cpp` behind and runs `g++` through `system()`. |

## 7. Other facts worth knowing

* **CONFIRMED**: the author's voice survives in the messages: *"Got that, begin processing!"*, *"Gata"*, *"Bro what type of file is that?"*. The
  playground reuses the first two as its console banner.
* **CONFIRMED**: example words *Moga, Goga, Prosto, Loga* and variable name `moga`.
* **INFERRED**: `JJexe` and `a.out` were built on Linux (`ld-linux-x86-64.so.2`, gcc 12.2.1 with the `annobin` plugin, typical of Fedora).
* `syn.txt` begins with `#include <iostream>` and ends with `int main(){}`: the notes were written inside a scratch C++ file.

## 8. The nine questions

1. **What was it meant to accomplish?** A math-flavoured, typed, C++-transpiled language with rationals/complex numbers, byte-sized types and a very
   short `print`.
2. **What syntax?** §5.
3. **Variables, functions, expressions, control flow?** §5.1, §5.7, §5.4, §5.3.
4. **Pipeline?** §3: `.j`, a single C++ `main()`, `g++`, binary.
5. **Actually implemented?** `print`; the CLI shell (§4).
6. **Partially implemented?** `whl` (stub).
7. **Planned, never completed?** Everything else in `syn.txt`.
8. **Bugs vs. intent?** §6 are bugs. The `,,` pause, `.` = end-of-line, `/` returning int, `gotor`, `do_all`, and function visibility lists are *design*.
9. **What makes it distinct?** The numeric tower with exact rationals and complex numbers as ordinary types, byte-sized declarations, punctuation-driven
   `print`, `gotor` ("go and come back"), named `if`/`while` as labels, and per-function visibility lists. None of these exist in C++ (its transpilation target).
