// DOM이 필요한 런타임 테스트 (브라우저 전용: tests/index.html)
import { test, eq, ok } from './harness.js';
import { html } from '../src/lib/html.js';
import { render, act, useState, useEffect, useLayoutEffect, useRef, useMemo, memo, useErrorBoundary, createStore, useStore } from '../src/lib/ui.js';

const box = () => document.createElement('div');

test('ui: 마운트와 텍스트 갱신', () => {
  const c = box();
  render(html`<p class="x">${'a'}</p>`, c);
  eq(c.innerHTML, '<p class="x">a</p>');
  const p = c.firstChild;
  render(html`<p class="y">${'b'}</p>`, c);
  ok(c.firstChild === p, '같은 노드 재사용');
  eq(c.innerHTML, '<p class="y">b</p>');
});

test('ui: 키 있는 목록 재정렬 시 DOM 노드 보존', () => {
  const c = box();
  const list = (ks) => html`<ul>${ks.map((k) => html`<li key=${k}>${k}</li>`)}</ul>`;
  render(list(['a', 'b', 'c', 'd']), c);
  const nodes = {};
  c.querySelectorAll('li').forEach((li) => (nodes[li.textContent] = li));
  render(list(['d', 'b', 'e', 'a']), c);
  eq([...c.querySelectorAll('li')].map((l) => l.textContent), ['d', 'b', 'e', 'a']);
  ok(c.querySelectorAll('li')[0] === nodes.d);
  ok(c.querySelectorAll('li')[1] === nodes.b);
  ok(c.querySelectorAll('li')[3] === nodes.a);
  ok(!c.contains(nodes.c));
});

test('ui: 컴포넌트 상태 갱신', () => {
  const c = box();
  let setN;
  function Counter() {
    const [n, set] = useState(0);
    setN = set;
    return html`<b>${n}</b>`;
  }
  render(html`<div><${Counter} /></div>`, c);
  eq(c.textContent, '0');
  setN(5);
  act();
  eq(c.textContent, '5');
  setN((x) => x + 1);
  act();
  eq(c.textContent, '6');
});

test('ui: 컴포넌트 루트 타입이 바뀌어도 부모 참조 유지', () => {
  const c = box();
  let setMode;
  function Inner() {
    const [m, s] = useState('a');
    setMode = s;
    return m === 'a' ? html`<i>a</i>` : html`<b>b</b>`;
  }
  function Outer() {
    return html`<${Inner} />`;
  }
  render(html`<div><${Outer} /><span>z</span></div>`, c);
  setMode('b');
  act();
  eq(c.innerHTML, '<div><b>b</b><span>z</span></div>');
  // 부모가 다시 그려져도 올바른 노드를 패치
  render(html`<div><${Outer} /><span>y</span></div>`, c);
  eq(c.innerHTML, '<div><b>b</b><span>y</span></div>');
  setMode(null);
  act();
  eq(c.innerHTML, '<div><b>b</b><span>y</span></div>');
});

test('ui: null 반환 컴포넌트', () => {
  const c = box();
  let setShow;
  function Maybe() {
    const [show, s] = useState(false);
    setShow = s;
    return show ? html`<em>on</em>` : null;
  }
  render(html`<div><${Maybe} /></div>`, c);
  eq(c.textContent, '');
  setShow(true);
  act();
  eq(c.querySelector('em').textContent, 'on');
  setShow(false);
  act();
  ok(!c.querySelector('em'));
});

test('ui: effect 실행/정리 순서', async () => {
  const c = box();
  const log = [];
  function E({ v }) {
    useLayoutEffect(() => {
      log.push('layout ' + v);
      return () => log.push('unlayout ' + v);
    }, [v]);
    useEffect(() => {
      log.push('effect ' + v);
      return () => log.push('clean ' + v);
    }, [v]);
    return html`<i>${v}</i>`;
  }
  render(html`<${E} v=${1} />`, c);
  eq(log, ['layout 1']);
  await new Promise((r) => setTimeout(r, 5));
  eq(log, ['layout 1', 'effect 1']);
  render(html`<${E} v=${2} />`, c);
  await new Promise((r) => setTimeout(r, 5));
  eq(log, ['layout 1', 'effect 1', 'unlayout 1', 'layout 2', 'clean 1', 'effect 2']);
  render(html`<p />`, c);
  eq(log.slice(-2), ['unlayout 2', 'clean 2']);
});

test('ui: useRef와 ref 속성', () => {
  const c = box();
  let r;
  function R() {
    r = useRef(null);
    return html`<input ref=${r} />`;
  }
  render(html`<${R} />`, c);
  ok(r.current && r.current.tagName === 'INPUT');
});

test('ui: useMemo 의존성', () => {
  const c = box();
  let calls = 0;
  function M({ a, b }) {
    const v = useMemo(() => (calls++, a * 2), [a]);
    return html`<b>${v}${b}</b>`;
  }
  render(html`<${M} a=${1} b=${'x'} />`, c);
  render(html`<${M} a=${1} b=${'y'} />`, c);
  eq(calls, 1);
  render(html`<${M} a=${2} b=${'y'} />`, c);
  eq(calls, 2);
  eq(c.textContent, '4y');
});

test('ui: memo는 props가 같으면 건너뜀', () => {
  const c = box();
  let renders = 0;
  const Child = memo(function Child({ v }) {
    renders++;
    return html`<b>${v}</b>`;
  });
  render(html`<div><${Child} v=${1} /></div>`, c);
  render(html`<div><${Child} v=${1} /></div>`, c);
  eq(renders, 1);
  render(html`<div><${Child} v=${2} /></div>`, c);
  eq(renders, 2);
});

test('ui: select 값은 option 뒤에 적용', () => {
  const c = box();
  render(html`<select value=${'b'}><option value="a">A</option><option value="b">B</option></select>`, c);
  eq(c.firstChild.value, 'b');
});

test('ui: SVG 네임스페이스', () => {
  const c = box();
  render(html`<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" class="dot" /></svg>`, c);
  const circle = c.querySelector('circle');
  eq(circle.namespaceURI, 'http://www.w3.org/2000/svg');
  eq(circle.getAttribute('class'), 'dot');
});

test('ui: 스타일 객체 diff와 CSS 변수', () => {
  const c = box();
  render(html`<div style=${{ width: 10, opacity: 0.5, '--c': 'red' }} />`, c);
  const d = c.firstChild;
  eq(d.style.width, '10px');
  eq(d.style.opacity, '0.5');
  eq(d.style.getPropertyValue('--c'), 'red');
  render(html`<div style=${{ height: '2px' }} />`, c);
  eq(d.style.width, '');
  eq(d.style.height, '2px');
});

test('ui: 이벤트 핸들러 교체', () => {
  const c = box();
  let hit = '';
  render(html`<button onClick=${() => (hit = 'a')}>x</button>`, c);
  c.firstChild.click();
  render(html`<button onClick=${() => (hit = 'b')}>x</button>`, c);
  c.firstChild.click();
  eq(hit, 'b');
  render(html`<button>x</button>`, c);
  hit = '';
  c.firstChild.click();
  eq(hit, '');
});

test('ui: 제어 입력값은 다를 때만 갱신', () => {
  const c = box();
  render(html`<input value=${'abc'} />`, c);
  const inp = c.firstChild;
  eq(inp.value, 'abc');
  inp.value = 'abcd';
  render(html`<input value=${'abcd'} />`, c);
  eq(inp.value, 'abcd');
});

test('ui: 에러 경계', () => {
  const c = box();
  function Boom() {
    throw new Error('펑');
  }
  function Boundary({ children }) {
    const [err] = useErrorBoundary();
    return err ? html`<p>오류: ${err.message}</p>` : html`<div>${children}</div>`;
  }
  render(html`<${Boundary}><${Boom} /><//>`, c);
  act();
  eq(c.textContent, '오류: 펑');
});

test('ui: createStore + useStore', () => {
  const c = box();
  const st = createStore({ a: 1, b: 1 });
  let renders = 0;
  function A() {
    renders++;
    const a = useStore(st, (s) => s.a);
    return html`<b>${a}</b>`;
  }
  render(html`<${A} />`, c);
  st.set({ b: 2 });
  act();
  eq(renders, 1, 'b 변경에는 다시 그리지 않음');
  st.set({ a: 3 });
  act();
  eq(c.textContent, '3');
  eq(renders, 2);
});

test('ui: 배열 반환 컴포넌트는 감싸서 렌더', () => {
  const c = box();
  function Two() {
    return [html`<i>1</i>`, html`<i>2</i>`];
  }
  render(html`<div><${Two} /></div>`, c);
  eq(c.querySelectorAll('i').length, 2);
});

test('ui: 키 없는 형제 타입 변경', () => {
  const c = box();
  render(html`<div>${[html`<a>1</a>`, 'txt', html`<b>2</b>`]}</div>`, c);
  render(html`<div>${[html`<b>1</b>`, html`<b>2</b>`]}</div>`, c);
  eq(c.innerHTML, '<div><b>1</b><b>2</b></div>');
});

test('ui: 형제 목록에서 자식 루트 타입이 바뀌어도 순서 유지 (insertBefore 회귀)', () => {
  const c = box();
  function Item({ v }) {
    return v === 'a' ? html`<i>${v}</i>` : html`<b>${v}</b>`;
  }
  render(html`<div>${[html`<${Item} key="1" v="a" />`, html`<${Item} key="2" v="a" />`, html`<${Item} key="3" v="a" />`]}</div>`, c);
  render(html`<div>${[html`<${Item} key="1" v="b" />`, html`<${Item} key="3" v="b" />`]}</div>`, c);
  eq(c.innerHTML, '<div><b>b</b><b>b</b></div>');
  render(html`<div>${[html`<${Item} key="3" v="a" />`, html`<${Item} key="1" v="b" />`, html`<${Item} key="4" v="a" />`]}</div>`, c);
  eq(c.innerHTML, '<div><i>a</i><b>b</b><i>a</i></div>');
});

test('ui: 언마운트된 컴포넌트의 setState는 무시', () => {
  const c = box();
  let set;
  function S() {
    const [v, s] = useState(0);
    set = s;
    return html`<b>${v}</b>`;
  }
  render(html`<${S} />`, c);
  render(html`<p>gone</p>`, c);
  set(3);
  act();
  eq(c.textContent, 'gone');
});
