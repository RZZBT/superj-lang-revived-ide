import type { ReactNode } from 'react';
import type { Version } from '../engine';

function Row({ code, children, v2 }: { code: string; children?: ReactNode; v2?: boolean }) {
  return (
    <tr>
      <td><code>{code}</code></td>
      <td>{children}{v2 && <span className="only">V2 only</span>}</td>
    </tr>
  );
}

export function Learn({ version, setVersion }: { version: Version; setVersion: (v: Version) => void }) {
  return (
    <div className="docs">
      <h2>SuperJ</h2>
      <p>
        A typed language with exact fractions, a punctuation-driven <code>print</code> and two kinds of <code>goto</code>.
        Write in <code>main.j</code> and press Run.
      </p>

      <h3>Version</h3>
      <div className="seg" role="radiogroup" aria-label="Language version">
        <button role="radio" aria-checked={version === 'v1'} className={version === 'v1' ? 'on' : ''} onClick={() => setVersion('v1')}>V1 Classic</button>
        <button role="radio" aria-checked={version === 'v2'} className={version === 'v2' ? 'on' : ''} onClick={() => setVersion('v2')}>V2</button>
      </div>
      <table className="vtable"><tbody>
        <tr><td><b>V1</b></td><td>The original design. Spaces inside strings are dropped, so <code>"a b"</code> prints <code>ab</code>.</td></tr>
        <tr><td><b>V2</b></td><td>Keeps the spaces and adds <code>take()</code>, <code>3i</code> literals and default parameters.</td></tr>
      </tbody></table>

      <h3>Variables</h3>
      <table><tbody>
        <Row code="int a : 5;">A colon assigns, for declarations and later changes alike.</Row>
        <Row code="int a {5}">Same as above.</Row>
        <Row code="whl(1) w : 250;">Size in bytes. Values wrap, so <code>w + 10</code> becomes 4.</Row>
      </tbody></table>

      <h3>Types</h3>
      <table><tbody>
        <Row code="whl">Natural number, never negative.</Row>
        <Row code="rat">Exact fraction. <code>rat(0.75)</code> is 3/4.</Row>
        <Row code="com" v2>Complex number, e.g. <code>1 + 2i</code>.</Row>
        <Row code="nr">Any number.</Row>
        <Row code="const">Type comes from the value.</Row>
      </tbody></table>
      <p><code>/</code> on whole numbers gives a whole number: <code>7/2</code> is 3, <code>rat(7)/2</code> is 7/2.</p>

      <h3>print</h3>
      <table><tbody>
        <Row code="a, b">Joined with nothing between.</Row>
        <Row code="a,,b">A space between.</Row>
        <Row code='"x".'>A dot ends the line.</Row>
      </tbody></table>
      <p><code>print("a",,"b".);</code> prints <code>a b</code> and a newline.</p>

      <h3>Branches</h3>
      <table><tbody>
        <Row code="\elif(c){...}">Other branches start with a backslash.</Row>
        <Row code="\else(){...}" />
        <Row code="if(c)(bool do_all = true)">Every true branch runs, not only the first.</Row>
      </tbody></table>

      <h3>Labels and goto</h3>
      <table><tbody>
        <Row code="if(c) \name {...}">Name an <code>if</code>...</Row>
        <Row code="while(c) |name {...}">...or a <code>while</code>.</Row>
        <Row code="goto name;">Jump there for good.</Row>
        <Row code="gotor name;">Jump there, run it, come back.</Row>
      </tbody></table>

      <h3>Functions</h3>
      <table><tbody>
        <Row code="f(int a){...}">Callable from anywhere. No return values.</Row>
        <Row code="f(int a){...}!(g, h);">Only <code>g</code> and <code>h</code> may call it.</Row>
        <Row code="f(int a = 1)" v2>Default value.</Row>
      </tbody></table>

      <h3>Other</h3>
      <table><tbody>
        <Row code="|a|">Absolute value.</Row>
        <Row code="a^(b)">Power.</Row>
        <Row code="take(a, b)" v2>Reads values from the input box or the console.</Row>
      </tbody></table>
    </div>
  );
}
