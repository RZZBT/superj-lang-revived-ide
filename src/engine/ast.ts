import type { TypeSpec, Value } from './values';

export type Expr =
  | { k: 'lit'; v: Value; line: number }
  | { k: 'var'; name: string; line: number; col: number }
  | { k: 'bin'; op: string; l: Expr; r: Expr; line: number }
  | { k: 'un'; op: '-' | '!' | 'abs'; e: Expr; line: number }
  | { k: 'call'; name: string; args: Expr[]; line: number; col: number };

/** What print's separators turn into: `,` joins, `,,` adds a space, `.` closes the line. */
export type PrintPart = { k: 'expr'; e: Expr } | { k: 'space' } | { k: 'nl' };

export interface Param { name: string; spec: TypeSpec; def?: Expr; line: number }

export type Stmt =
  | { k: 'decl'; spec: TypeSpec; name: string; init?: Expr; line: number; col: number }
  | { k: 'assign'; name: string; e: Expr; line: number; col: number }
  | { k: 'print'; parts: PrintPart[]; line: number }
  | { k: 'take'; names: { name: string; line: number; col: number }[]; line: number }
  | {
      k: 'if'; cond: Expr; doAll?: Expr; label?: string; then: Stmt[];
      elifs: { cond: Expr; body: Stmt[]; line: number }[]; els?: Stmt[]; line: number;
    }
  | { k: 'while'; cond: Expr; label?: string; body: Stmt[]; line: number }
  | { k: 'goto'; name: string; returns: boolean; line: number }
  | { k: 'break'; line: number }
  | { k: 'skip'; line: number }
  | { k: 'end'; line: number }
  | { k: 'block'; body: Stmt[]; line: number }
  | { k: 'callfn'; name: string; args: Expr[]; line: number; col: number }
  | { k: 'funcdef'; name: string; params: Param[]; body: Stmt[]; allowed?: string[]; line: number; col: number };
