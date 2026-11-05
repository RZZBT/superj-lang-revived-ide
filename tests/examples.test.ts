import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execute, NeedInput } from '../src/engine';

// Every shipped example must keep producing exactly this output.
const EXPECTED: Record<string, string> = {
  '00-hello-world.j': 'Hello World!\n',
  '01-archive-test.j': 'Moga Goga Prosto Loga\n',
  '02-print-separators.j': 'gluedtogether\nspaced out words\ntwo  spaces\na\nb\nc\n',
  '03-types.j': 'small = 4\ncount = -7\nthird = 1/3\nratio = 2.5\nanything = 4\nanswer = 42\nSuperJ J true\n',
  '04-arithmetic.j':
    'a + b = 22\na - b = 12\na * b = 85\na / b = 3 (whole division)\na % b = 2\na ^(2) = 289\n|b - a| = 12\n' +
    'a > b && b != 0 : true\nrat(0.75) = 3/4 up 3 down 4\nsqrt(81) = 9\nround(2.5) = 3 trunc(-2.9) = -2\n',
  '05-conditions.j': 'zero\nx > 1\nx > 5\n',
  '06-loops.j': '1 3 5 7 \ncounted to 3\n',
  '07-functions.j': 'total is 25\n',
  '08-goto.j': 'Hello!\nfirst\nHello!\nsecond\nHello!\njumped here\n',
  '09-rationals.j': '1 + 1/2 + 1/3 + 1/4 + 1/5 = 137/60\nnumerator 137 denominator 60\nas a real: 2.28333\n',
  '10-input.j': 'Hello Ada - next year you will be 37\n',
};

describe('shipped examples', () => {
  for (const [file, expected] of Object.entries(EXPECTED)) {
    it(file, () => {
      const src = readFileSync('examples/' + file, 'utf8');
      expect(execute(src, { stdin: 'Ada 36' }).output).toBe(expected);
    });
  }
});

describe('README sample', () => {
  it('the program shown in the README runs', () => {
    const readme = readFileSync('README.md', 'utf8');
    const m = /## Writing SuperJ\s+```\n([\s\S]*?)```/.exec(readme);
    expect(m).not.toBeNull();
    expect(execute(m![1]).output).toBe('count = 3\n3 2 1 \npositive');
  });
});

describe('Nim game (examples/11-play-nim.j)', () => {
  const nim = readFileSync('examples/11-play-nim.j', 'utf8');
  it('can be won by the first player (take 1, then always complete 4)', () => {
    const { output } = execute(nim, { stdin: '1 3 3 3 3 3' });
    expect(output).toContain('You took the last stick. You win!');
  });
  it('is lost by a careless opening move', () => {
    const { output } = execute(nim, { stdin: '2 1 1 1 1 1' });
    expect(output).toContain('I took the last stick. I win!');
  });
  it('rejects illegal moves and lets you retry', () => {
    const { output } = execute(nim, { stdin: '7 1 3 3 3 3 3' });
    expect(output).toContain('Not allowed, try again.');
    expect(output).toContain('You win!');
  });
  it('pauses for input instead of failing when the moves run out', () => {
    expect(() => execute(nim, { stdin: '1' })).toThrow(/nothing left to read/);
  });
  it('echoes interactively typed moves like a terminal', () => {
    expect(() => execute(nim, { stdin: '1', echoFrom: 0 })).toThrow(NeedInput);
  });
});
