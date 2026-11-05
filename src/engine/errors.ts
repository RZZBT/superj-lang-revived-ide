/** Errors found before the program starts ('transpile') or while it runs ('runtime'). */
export type Phase = 'transpile' | 'runtime';

export class JJError extends Error {
  constructor(
    public phase: Phase,
    message: string,
    public line = 0,
    public col = 0,
  ) {
    super(message);
    this.name = 'JJError';
  }
}

/** take() ran out of input. The UI asks for a line and re-runs the program with it added. */
export class NeedInput extends Error {
  constructor() {
    super('take() has nothing left to read');
    this.name = 'NeedInput';
  }
}
