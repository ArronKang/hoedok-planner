import { test, eq, ok } from './harness.js';
import { html } from '../src/lib/html.js';

const strip = (v) => {
  if (Array.isArray(v)) return v.map(strip);
  if (v && v.$$v) {
    const props = { ...v.props };
    if ('children' in props) props.children = strip(props.children);
    const out = { type: typeof v.type === 'function' ? v.type.name : v.type, props };
    if (v.key !== undefined) out.key = v.key;
    return out;
  }
  return v;
};

test('html: 기본 요소와 정적 속성', () => {
  eq(strip(html`<div class="a b" id="x">hi</div>`), { type: 'div', props: { class: 'a b', id: 'x', children: 'hi' } });
});

test('html: 동적 속성, 불리언 속성, 이벤트', () => {
  const fn = () => {};
  const v = html`<input disabled value=${3} onInput=${fn} />`;
  eq(v.type, 'input');
  eq(v.props.disabled, true);
  eq(v.props.value, 3);
  ok(v.props.onInput === fn);
});

test('html: 따옴표 안 섞인 값', () => {
  const v = html`<div class="row ${'on'} end" title='a ${1}'></div>`;
  eq(v.props.class, 'row on end');
  eq(v.props.title, 'a 1');
});

test('html: 빈 따옴표 값', () => {
  eq(html`<a href="">x</a>`.props.href, '');
});

test('html: 컴포넌트 태그와 <//> 닫기, 스프레드', () => {
  function Comp() {}
  const rest = { b: 2, c: 3 };
  const v = html`<${Comp} a=${1} ...${rest}>kid<//>`;
  ok(v.type === Comp);
  eq(v.props.a, 1);
  eq(v.props.b, 2);
  eq(v.props.c, 3);
  eq(v.props.children, 'kid');
});

test('html: 스프레드 뒤 속성이 우선', () => {
  const v = html`<div ...${{ a: 1, b: 1 }} b=${2} />`;
  eq(v.props, { a: 1, b: 2 });
});

test('html: key 추출', () => {
  const v = html`<li key=${'k1'}>a</li>`;
  eq(v.key, 'k1');
  ok(!('key' in v.props));
});

test('html: 여러 루트는 배열', () => {
  const v = html`<a></a><b></b>`;
  ok(Array.isArray(v));
  eq(v.length, 2);
});

test('html: 줄바꿈 공백 정리 & 공백 보존', () => {
  const v = html`
    <p>
      안녕
      하세요
    </p>
  `;
  eq(v.props.children, '안녕 하세요');
  const w = html`<span>${'a'} ${'b'}</span>`;
  eq(w.props.children, ['a', ' ', 'b']);
});

test('html: void 요소는 자동으로 닫힘', () => {
  const v = html`<div><input type="text"><span>x</span></div>`;
  eq(v.props.children.length, 2);
  eq(v.props.children[0].type, 'input');
  eq(v.props.children[1].type, 'span');
});

test('html: 중첩과 슬롯 자식', () => {
  const items = ['x', 'y'];
  const v = html`<ul>${items.map((i) => html`<li key=${i}>${i}</li>`)}</ul>`;
  eq(v.props.children.length, 2);
  eq(v.props.children[1].key, 'y');
});

test('html: 텍스트 속 < 기호(뒤에 공백/숫자)는 글자', () => {
  const v = html`<p>a < b, 1<2</p>`;
  eq(v.props.children, 'a < b, 1<2');
});

test('html: 주석 무시', () => {
  const v = html`<div><!-- 메모 --><b>x</b></div>`;
  eq(v.props.children.type, 'b');
});

test('html: 따옴표 없는 값과 SVG 속성 이름', () => {
  const v = html`<svg viewBox="0 0 24 24"><path stroke-width=2 d="M0 0L1 1" /></svg>`;
  eq(v.props.viewBox, '0 0 24 24');
  eq(v.props.children.props['stroke-width'], '2');
});

test('html: 같은 템플릿은 파싱 캐시 재사용하되 값은 새로', () => {
  const f = (x) => html`<b>${x}</b>`;
  eq(f(1).props.children, 1);
  eq(f(2).props.children, 2);
});
