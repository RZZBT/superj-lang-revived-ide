import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execute, JJError, transpile } from '../src/engine';

const out = (src: string, stdin = '') => execute(src, { stdin }).output;
const err = (src: string, stdin = ''): JJError => {
  try { execute(src, { stdin }); } catch (e) { return e as JJError; }
  throw new Error('expected an error');
};

describe('archive regression (archive/JJ/test.j)', () => {
  const testJ = readFileSync('archive/JJ/test.j', 'utf8');

  it('prints what the original transpiler intended: "Moga Goga Prosto Loga" + newline', () => {
    expect(out(testJ)).toBe('Moga Goga Prosto Loga\n');
  });

  it('the shipped copy in examples/ is byte-identical to the archive', () => {
    expect(readFileSync('examples/01-archive-test.j', 'utf8')).toBe(testJ);
  });
});

describe('print separators (syn.txt: "," "," ",,", ".")', () => {
  it('"," joins, ",," adds one space, "." closes the line', () => {
    expect(out('print("a","b".);')).toBe('ab\n');
    expect(out('print("a",,"b".);')).toBe('a b\n');
    expect(out('print("a",,,"b");')).toBe('a  b');
    expect(out('print("a". "b".);')).toBe('a\nb\n');
  });
  it('whitespace inside strings survives (the original stripped it by accident)', () => {
    expect(out('print("Hello World".);')).toBe('Hello World\n');
  });
  it('a decimal point is a number, not the end of the line', () => {
    expect(out('print(3.5.);')).toBe('3.5\n');
  });
  it('escapes', () => {
    expect(out('print("a\\tb\\n");')).toBe('a\tb\n');
  });
});

describe('variables and types', () => {
  it('both declaration forms', () => {
    expect(out('int a : 5; int b {7}; print(a,,b.);')).toBe('5 7\n');
  });
  it('assignment uses ":"', () => {
    expect(out('int a : 5; a : a + 1; print(a.);')).toBe('6\n');
  });
  it('whl is unsigned and sized in bytes (wraps like the C++ target)', () => {
    expect(out('whl(1) w : 250; w : w + 10; print(w.);')).toBe('4\n');
    expect(out('int(1) i : 127; i : i + 1; print(i.);')).toBe('-128\n');
    expect(out('whl w : 0; w : w - 1; print(w.);')).toBe('4294967295\n');
  });
  it('rat is exact', () => {
    expect(out('rat a : 1; rat b : 3; rat c : a / b + a / b; print(c.);')).toBe('2/3\n');
    expect(out('rat r : rat(0.75); print(r,,getUp(r),,getDown(r).);')).toBe('3/4 3 4\n');
  });
  it('real prints like C++ cout', () => {
    expect(out('real x : 1.5; print(x * 2.0,,x / 3.0.);')).toBe('3 0.5\n');
  });
  it('const takes its type from the value and cannot change', () => {
    expect(out('const pi : 3.14; print(pi.);')).toBe('3.14\n');
    expect(err('const k : 1; k : 2;').phase).toBe('transpile');
  });
  it('txt, char and state', () => {
    expect(out('txt s : "ab"; char c : \'z\'; state t : true; print(s,c,,t.);')).toBe('abz true\n');
    expect(out('txt a : "x"; txt b : a + "y"; print(b.);')).toBe('xy\n');
  });
  it('nr holds whole or fractional numbers', () => {
    expect(out('nr a : 3; nr b : 2.5; print(a,,b.);')).toBe('3 2.5\n');
  });
  it('com supports imaginary literals', () => {
    expect(out('com z : 1 + 2i; com w : z * z; print(w.);')).toBe('-3+4i\n');
  });
  it('no initial value gives a zero value', () => {
    expect(out('whl moga; print(moga.);')).toBe('0\n');
  });
});

describe('expressions (syn.txt "basic actions")', () => {
  it('+ - * / % ^ with integer division', () => {
    expect(out('print(7/2,,7%3,,2^(10),,2+3*4,,10-4.);')).toBe('3 1 1024 14 6\n');
  });
  it('negative integer division truncates like C++', () => {
    expect(out('print(-7/2,,-7%3.);')).toBe('-3 -1\n');
  });
  it('|a| absolute value', () => {
    expect(out('int a : -5; print(|a|,,|a-10|.);')).toBe('5 15\n');
  });
  it('comparison and logic', () => {
    expect(out('print(1<2,,2<=1,,1!=2,,1==1,,true&&false,,true||false,,!true.);')).toBe('true false true true false true false\n');
  });
  it('power of a negative exponent is rational', () => {
    expect(out('print(2^(-2).);')).toBe('1/4\n');
  });
  it('math functions', () => {
    expect(out('print(sqrt(16),,round(2.5),,round(-2.5),,trunc(-2.7),,round(rat(7)/rat(2)).);')).toBe('4 3 -3 -2 4\n');
  });
});

describe('control flow', () => {
  it('if / elif / else with backslash forms', () => {
    const src = (n: number) => `int n : ${n}; if(n < 0){ print("neg"); } \\elif(n == 0){ print("zero"); } \\else(){ print("pos"); }`;
    expect(out(src(-1))).toBe('neg');
    expect(out(src(0))).toBe('zero');
    expect(out(src(5))).toBe('pos');
  });
  it('else works without the backslash too', () => {
    expect(out('if(false){print("a");} else {print("b");}')).toBe('b');
  });
  it('do_all runs every matching branch', () => {
    const body = (flag: string) =>
      `int n : 5; if(n > 1)(bool do_all = ${flag}){print("a");} \\elif(n > 2){print("b");} \\else(){print("c");}`;
    expect(out(body('false'))).toBe('a');
    expect(out(body('true'))).toBe('ab');
    expect(out('if(false)(bool do_all = true){print("a");} \\else(){print("c");}')).toBe('c');
  });
  it('while, break and skip', () => {
    expect(out('int i : 0; while(i < 5){ i : i + 1; if(i == 2){ skip; } if(i == 4){ break; } print(i); }')).toBe('13');
  });
  it('goto jumps and never comes back', () => {
    expect(out('int n : 0; if(true) \\here { print("A"); } goto skipit; print("B"); if(true) \\skipit { print("C"); }')).toBe('AC');
  });
  it('gotor runs the labelled statement and returns', () => {
    expect(out('if(true) \\hello { print("Hi "); } print("1 "); gotor hello; print("2");')).toBe('Hi 1 Hi 2');
  });
  it('labelled while with a name', () => {
    expect(out('int i : 0; while(i < 3) |loop { i : i + 1; } print(i);')).toBe('3');
  });
  it('end stops the whole program', () => {
    expect(out('print("a"); end; print("b");')).toBe('a');
  });
  it('block scoping', () => {
    expect(err('{ int x : 1; } print(x);').phase).toBe('transpile');
  });
});

describe('functions', () => {
  it('Name(params){code} can be called anywhere, even before its definition', () => {
    expect(out('greet("JJ"); greet(txt who){ print("hi ",who.); }')).toBe('hi JJ\n');
  });
  it('defaults and global access', () => {
    expect(out('int total : 0; add(int a, int b = 10){ total : total + a + b; } add(1); add(1,2); print(total);')).toBe('14');
  });
  it('recursion', () => {
    expect(out('int n : 3; down(int k){ if(k > 0){ print(k); down(k - 1); } } down(n);')).toBe('321');
  });
  it('!(...) restricts who may call a function', () => {
    const base = 'inner(){ print("x"); }!(outer); outer(){ inner(); }';
    expect(out(base + ' outer();')).toBe('x');
    const e = err(base + ' inner();');
    expect(e.phase).toBe('transpile');
    expect(e.message).toMatch(/can only be called from 'outer'/);
  });
  it('the "for (functions)" spelling does the same', () => {
    const e = err('inner(){ print("x"); } for (outer); outer(){ inner(); } inner();');
    expect(e.message).toMatch(/can only be called from 'outer'/);
  });
  it('wrong argument count is a transpile error', () => {
    expect(err('f(int a){} f();').phase).toBe('transpile');
  });
});

describe('take()', () => {
  it('reads values by variable type', () => {
    expect(out('int a; txt s; real r; rat q; take(a, s, r, q); print(a,,s,,r,,q.);', '42 hello 2.5 3/6')).toBe('42 hello 2.5 1/2\n');
  });
  it('runs out of input with a NeedInput signal that says what happened', () => {
    expect(() => execute('int a; take(a);')).toThrow(/nothing left to read/);
  });
  it('a value of the wrong type is a runtime error', () => {
    const e = err('int a; take(a);', 'hello');
    expect(e.phase).toBe('runtime');
    expect(e.message).toMatch(/not a valid int/);
  });
});

describe('errors', () => {
  it('syntax errors are transpile errors with a line number', () => {
    const e = err('print("a")\nprint("b");');
    expect(e.phase).toBe('transpile');
    expect(e.line).toBe(2);
    expect(e.message).toMatch(/expected ';'/);
  });
  it('division by zero is a runtime error with a line number', () => {
    const e = err('int a : 0;\nprint(1 / a);');
    expect(e.phase).toBe('runtime');
    expect(e.line).toBe(2);
  });
  it('undeclared names are caught before running', () => {
    expect(err('print(nope);').phase).toBe('transpile');
  });
  it('type mismatches are runtime errors', () => {
    expect(err('int a : "x";').phase).toBe('runtime');
  });
  it('infinite loops stop at the step limit', () => {
    expect(() => execute('while(true){}', { maxSteps: 10_000 })).toThrow(/step limit/);
  });
  it('runaway recursion stops', () => {
    expect(() => execute('f(){ f(); } f();')).toThrow(/call stack overflow/);
  });
  it('huge powers are refused instead of freezing', () => {
    expect(() => execute('print(9^(99999999));')).toThrow(/too large/);
  });
  it('output is capped', () => {
    expect(() => execute('while(true){ print("xxxxxxxxxx"); }', { maxOutput: 1000 })).toThrow(/output limit/);
  });
  it('transpile never executes anything', () => {
    expect(() => transpile('while(true){}')).not.toThrow();
  });
});

describe('safety caps on exact numbers', () => {
  it('nr growing without bound is stopped', () => {
    expect(() => execute('nr a : 3; while(true){ a : a * a; }')).toThrow(/number too large/);
  });
  it('rat growing without bound is stopped', () => {
    expect(() => execute('rat a : rat(3); while(true){ a : a * a; }')).toThrow(/number too large/);
  });
});

describe('V1 (Classic) vs V2', () => {
  const v1 = (s: string) => execute(s, { version: 'v1' }).output;
  it('V1 runs everything syn.txt designed', () => {
    expect(v1('int a : 7; rat r : rat(1) / 3; print(a / 2,,r.);')).toBe('3 1/3\n');
    expect(v1('f(int a){ print(a); } f(2); if(true) \\x { print("y"); }')).toBe('2y');
  });
  it('V1 keeps the original whitespace bug inside strings; V2 repairs it', () => {
    expect(v1('print("Hello World".);')).toBe('HelloWorld\n');
    expect(execute('print("Hello World".);').output).toBe('Hello World\n');
  });
  it('V1 rejects the finished-in-V2 features with a transpile error', () => {
    for (const src of ['int a; take(a);', 'com z : 2i;', 'f(int a = 1){} f();']) {
      expect(() => execute(src, { version: 'v1' })).toThrow(/not part of V1/);
    }
  });
  it('the archived test.j under V1 still prints its words (glued by the bug in strings only)', () => {
    expect(v1(readFileSync('archive/JJ/test.j', 'utf8'))).toBe('Moga Goga Prosto Loga\n');
  });
});

describe('interactive input (replay model)', () => {
  it('signals NeedInput (not a runtime error) when take() runs dry', async () => {
    const { NeedInput } = await import('../src/engine');
    expect(() => execute('int a; take(a); print(a);')).toThrow(NeedInput);
  });
  it('echoes tokens typed after echoFrom, so the console looks like a terminal', () => {
    const r = execute('int a; int b; print("a? "); take(a); print("b? "); take(b); print(a + b.);', { stdin: '1 2', echoFrom: 1 });
    expect(r.output).toBe('a? b? 2\n3\n');
  });
});
