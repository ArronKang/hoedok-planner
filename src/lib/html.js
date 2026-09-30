// html.js — JSX 비슷한 문법을 태그드 템플릿으로 쓰기 위한 파서 (htm과 같은 아이디어)
//
//   html`<div class="row" onClick=${fn}>${title}</div>`
//   html`<${Comp} a=${1} ...${rest}>자식<//>`
//
// 규칙: 엔티티(&amp; 등)는 해석하지 않는다(실제 문자를 쓸 것). 텍스트 안의 '<' 다음에
// 공백/숫자가 오면 글자로 취급한다. 줄바꿈이 들어간 공백은 JSX처럼 정리된다.

import { h } from './ui.js';

const CACHE = new WeakMap();
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

const S_TEXT = 0;
const S_TAGNAME = 1;
const S_INTAG = 2;
const S_ATTRNAME = 3;
const S_AFTERNAME = 4;
const S_BEFOREVAL = 5;
const S_VALQ = 6;
const S_VALU = 7;
const S_CLOSE = 8;
const S_COMMENT = 9;

const isWS = (c) => c === ' ' || c === '\n' || c === '\t' || c === '\r' || c === '\f';

function parse(strings) {
  const root = { kids: [] };
  const stack = [root];
  let cur = root;
  let mode = S_TEXT;
  let buf = '';
  let quote = '';
  let el = null;
  let attr = null;
  let parts = null;
  let spread = false;

  const flushText = () => {
    let t = buf;
    buf = '';
    if (!t) return;
    if (t.indexOf('\n') !== -1) {
      t = t.replace(/^\s*\n\s*/, '').replace(/\s*\n\s*$/, '').replace(/\s*\n\s*/g, ' ');
    }
    if (t) cur.kids.push({ t: 'text', v: t });
  };
  const open = () => {
    cur.kids.push(el);
    if (typeof el.tag === 'string' && VOID.has(el.tag)) {
      el = null;
      return;
    }
    stack.push(el);
    cur = el;
    el = null;
  };
  const selfClose = () => {
    cur.kids.push(el);
    el = null;
  };
  const endValue = () => {
    attr.v = buf;
    buf = '';
  };

  for (let i = 0; i < strings.length; i++) {
    const s = strings[i];
    for (let j = 0; j < s.length; j++) {
      const c = s[j];
      switch (mode) {
        case S_TEXT:
          if (c === '<') {
            const nx = s[j + 1];
            if (nx === '!' && s.startsWith('!--', j + 1)) {
              flushText();
              mode = S_COMMENT;
              j += 3;
            } else if (nx === '/') {
              flushText();
              mode = S_CLOSE;
              j++;
            } else if (nx === undefined ? i < strings.length - 1 : !(isWS(nx) || (nx >= '0' && nx <= '9') || nx === '=')) {
              flushText();
              mode = S_TAGNAME;
              el = { t: 'el', tag: '', attrs: [], kids: [] };
            } else buf += c;
          } else buf += c;
          break;
        case S_COMMENT:
          if (c === '-' && s.startsWith('->', j + 1)) {
            mode = S_TEXT;
            j += 2;
          }
          break;
        case S_CLOSE:
          if (c === '>') {
            if (stack.length > 1) stack.pop();
            cur = stack[stack.length - 1];
            mode = S_TEXT;
          }
          break;
        case S_TAGNAME:
          if (isWS(c)) {
            if (el.tag) mode = S_INTAG;
          } else if (c === '>') {
            open();
            mode = S_TEXT;
          } else if (c === '/' && s[j + 1] === '>') {
            selfClose();
            j++;
            mode = S_TEXT;
          } else el.tag += c;
          break;
        case S_INTAG:
          if (isWS(c)) break;
          if (c === '>') {
            open();
            mode = S_TEXT;
          } else if (c === '/' && s[j + 1] === '>') {
            selfClose();
            j++;
            mode = S_TEXT;
          } else if (c === '.' && s.startsWith('...', j)) {
            spread = true;
            j += 2;
          } else {
            attr = { n: c, v: true };
            el.attrs.push(attr);
            mode = S_ATTRNAME;
          }
          break;
        case S_ATTRNAME:
          if (c === '=') mode = S_BEFOREVAL;
          else if (isWS(c)) mode = S_AFTERNAME;
          else if (c === '>') {
            open();
            mode = S_TEXT;
          } else if (c === '/' && s[j + 1] === '>') {
            selfClose();
            j++;
            mode = S_TEXT;
          } else attr.n += c;
          break;
        case S_AFTERNAME:
          if (c === '=') mode = S_BEFOREVAL;
          else if (!isWS(c)) {
            j--;
            mode = S_INTAG;
          }
          break;
        case S_BEFOREVAL:
          if (c === '"' || c === "'") {
            quote = c;
            parts = [];
            buf = '';
            mode = S_VALQ;
          } else if (!isWS(c)) {
            buf = c;
            mode = S_VALU;
          }
          break;
        case S_VALQ:
          if (c === quote) {
            if (buf || parts.length === 0) parts.push(buf);
            buf = '';
            attr.v = parts.length === 1 ? parts[0] : parts;
            parts = null;
            mode = S_INTAG;
          } else buf += c;
          break;
        case S_VALU:
          if (isWS(c)) {
            endValue();
            mode = S_INTAG;
          } else if (c === '>') {
            endValue();
            open();
            mode = S_TEXT;
          } else if (c === '/' && s[j + 1] === '>') {
            endValue();
            selfClose();
            j++;
            mode = S_TEXT;
          } else buf += c;
          break;
      }
    }
    if (i < strings.length - 1) {
      const slot = { i };
      switch (mode) {
        case S_TEXT:
          flushText();
          cur.kids.push({ t: 'slot', i });
          break;
        case S_TAGNAME:
          el.tag = slot;
          mode = S_INTAG;
          break;
        case S_INTAG:
        case S_ATTRNAME:
        case S_AFTERNAME:
          if (spread) {
            el.attrs.push({ spread: i });
            spread = false;
            mode = S_INTAG;
          }
          break;
        case S_BEFOREVAL:
          attr.v = slot;
          mode = S_INTAG;
          break;
        case S_VALQ:
          if (buf) parts.push(buf);
          buf = '';
          parts.push(slot);
          break;
        case S_VALU:
          // a=x${y} 같은 형태: 문자열로 이어 붙인다
          attr.v = buf ? [buf, slot] : slot;
          buf = '';
          mode = S_INTAG;
          break;
        default:
          break;
      }
    }
  }
  flushText();
  return root.kids;
}

function build(nodes, values) {
  const out = [];
  for (let k = 0; k < nodes.length; k++) {
    const n = nodes[k];
    if (n.t === 'text') out.push(n.v);
    else if (n.t === 'slot') out.push(values[n.i]);
    else out.push(buildEl(n, values));
  }
  return out;
}

function buildEl(n, values) {
  const tag = typeof n.tag === 'string' ? n.tag : values[n.tag.i];
  let props = null;
  const attrs = n.attrs;
  for (let k = 0; k < attrs.length; k++) {
    const a = attrs[k];
    if (!props) props = {};
    if (a.spread !== undefined) {
      const sp = values[a.spread];
      if (sp) Object.assign(props, sp);
    } else {
      let v = a.v;
      if (v !== null && typeof v === 'object') {
        v = Array.isArray(v) ? v.map((p) => (typeof p === 'string' ? p : values[p.i] ?? '')).join('') : values[v.i];
      }
      props[a.n] = v;
    }
  }
  const kids = n.kids.length ? build(n.kids, values) : [];
  return h(tag, props, ...kids);
}

export function html(strings, ...values) {
  let tpl = CACHE.get(strings);
  if (!tpl) {
    tpl = parse(strings);
    CACHE.set(strings, tpl);
  }
  const out = build(tpl, values);
  return out.length === 1 ? out[0] : out;
}
