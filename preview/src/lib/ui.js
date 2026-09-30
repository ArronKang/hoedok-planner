// ui.js — 작은 가상 DOM + 훅 런타임 (Preact와 비슷한 모델, 의존성 없음)
//
// - 컴포넌트는 (props) => vnode | null 함수다. 반환값은 한 개의 노드여야 한다
//   (배열을 반환하면 display:contents div로 감싼다).
// - 상태 변경은 마이크로태스크에서 모아서 다시 그린다.
// - useEffect는 화면 반영 후, useLayoutEffect는 DOM 반영 직후 실행된다.

const SVG_NS = 'http://www.w3.org/2000/svg';
const TEXT = 1;
const EMPTY = 2;

export function Fragment(props) {
  return props.children;
}

let currentInst = null;
let renderQueue = [];
let flushScheduled = false;
let layoutQueue = [];
let effectQueue = [];
let effectsScheduled = false;
let errorHandler = (err) => console.error(err);

export function setErrorHandler(fn) {
  errorHandler = fn;
}

// ---------- vnode ----------

export function h(type, props, ...children) {
  const p = {};
  let key;
  let ref;
  if (props) {
    for (const k in props) {
      if (k === 'key') key = props[k];
      else if (k === 'ref') ref = props[k];
      else p[k] = props[k];
    }
  }
  if (children.length) p.children = children.length === 1 ? children[0] : children;
  return { $$v: true, type, props: p, key: key == null ? undefined : key, ref };
}

function toNode(x) {
  if (x == null || x === false || x === true) return null;
  const t = typeof x;
  if (t === 'string' || t === 'number') return { type: TEXT, text: String(x), dom: null };
  if (x.$$v) {
    return { type: x.type, props: x.props, key: x.key, ref: x.ref, dom: null, inst: null, kids: null, child: null };
  }
  return { type: TEXT, text: String(x), dom: null };
}

function flattenInto(out, x) {
  if (Array.isArray(x)) {
    for (let i = 0; i < x.length; i++) flattenInto(out, x[i]);
    return;
  }
  if (x && x.$$v && x.type === Fragment) {
    flattenInto(out, x.props.children);
    return;
  }
  const n = toNode(x);
  if (n) out.push(n);
}

function normKids(children) {
  const out = [];
  flattenInto(out, children);
  return out;
}

function normOne(x) {
  const arr = normKids(x);
  if (arr.length === 0) return { type: EMPTY, dom: null };
  if (arr.length === 1) return arr[0];
  return toNode(h('div', { style: 'display:contents' }, x));
}

// ---------- component instances ----------

function Inst(node, parent, ns) {
  this.node = node;
  this.parent = parent;
  this.ns = ns;
  this.hooks = [];
  this.hi = 0;
  this.dirty = false;
  this.dead = false;
  this.depth = parent ? parent.depth + 1 : 0;
  this.boundary = null;
}

function renderInst(inst) {
  const prev = currentInst;
  currentInst = inst;
  inst.hi = 0;
  inst.dirty = false;
  try {
    return inst.node.type(inst.node.props);
  } finally {
    currentInst = prev;
  }
}

function safeRender(inst) {
  try {
    return renderInst(inst);
  } catch (err) {
    let p = inst.parent;
    while (p && !p.boundary) p = p.parent;
    if (p) {
      p.boundary.set(err);
      return null;
    }
    throw err;
  }
}

function collectEffects(inst) {
  const hooks = inst.hooks;
  for (let i = 0; i < hooks.length; i++) {
    const hk = hooks[i];
    if (hk.pending && !hk.queued) {
      hk.queued = true;
      (hk.layout ? layoutQueue : effectQueue).push(hk);
    }
  }
}

// ---------- DOM props ----------

const NON_DIMENSIONAL = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
const ATTR_ONLY = new Set(['list', 'form', 'type', 'width', 'height', 'href', 'download', 'role', 'draggable', 'spellcheck', 'translate', 'size']);

function eventProxy(e) {
  const fn = this._l && this._l[e.type];
  if (fn) return fn(e);
}

function eventProxyCapture(e) {
  const fn = this._l && this._l[e.type + '!'];
  if (fn) return fn(e);
}

function setStyleKey(s, k, val) {
  if (k[0] === '-') s.setProperty(k, val == null ? '' : String(val));
  else s[k] = val == null ? '' : typeof val === 'number' && !NON_DIMENSIONAL.test(k) ? val + 'px' : val;
}

function applyStyle(el, v, old) {
  const s = el.style;
  if (typeof v === 'string' || v == null) {
    if (typeof old !== 'string' || old !== v) s.cssText = v || '';
    return;
  }
  if (typeof old === 'string') {
    s.cssText = '';
    old = null;
  }
  if (old) for (const k in old) if (!(k in v)) setStyleKey(s, k, '');
  for (const k in v) if (!old || v[k] !== old[k]) setStyleKey(s, k, v[k]);
}

function setProp(el, k, v, old, isSvg) {
  if (k === 'children' || k === 'dangerouslySetInnerHTML') return;
  if (k[0] === 'o' && k[1] === 'n' && k.length > 2) {
    let name = k.slice(2).toLowerCase();
    // onClickCapture 처럼 끝에 Capture가 붙으면 캡처 단계에서 듣는다
    const capture = name.length > 7 && name.endsWith('capture') && name !== 'gotpointercapture' && name !== 'lostpointercapture';
    if (capture) name = name.slice(0, -7);
    const lk = capture ? name + '!' : name;
    const proxy = capture ? eventProxyCapture : eventProxy;
    const L = el._l || (el._l = {});
    if (typeof v === 'function') {
      if (!L[lk]) el.addEventListener(name, proxy, capture);
      L[lk] = v;
    } else if (L[lk]) {
      el.removeEventListener(name, proxy, capture);
      delete L[lk];
    }
    return;
  }
  if (k === 'style') {
    applyStyle(el, v, old);
    return;
  }
  if (k === 'class' || k === 'className') {
    if (isSvg) {
      if (v) el.setAttribute('class', v);
      else el.removeAttribute('class');
    } else el.className = v || '';
    return;
  }
  if (k === 'value' && !isSvg) {
    const s = v == null ? '' : String(v);
    if (el.value !== s) el.value = s;
    return;
  }
  if (k === 'checked' && !isSvg) {
    el.checked = !!v;
    return;
  }
  if (k === 'defaultValue') {
    if (old === undefined && v != null) el.value = v;
    return;
  }
  if (!isSvg && k in el && !ATTR_ONLY.has(k)) {
    try {
      el[k] = v == null ? (typeof el[k] === 'boolean' ? false : '') : v;
    } catch (e) {
      /* read-only property */
    }
    if (v == null || v === false) el.removeAttribute(k);
    return;
  }
  if (v == null || v === false) el.removeAttribute(k);
  else el.setAttribute(k, v === true ? '' : v);
}

function setRef(ref, value) {
  if (!ref) return;
  if (typeof ref === 'function') ref(value);
  else ref.current = value;
}

// ---------- mount / patch / unmount ----------

function mount(n, ns, pinst) {
  const t = n.type;
  if (t === TEXT) return (n.dom = document.createTextNode(n.text));
  if (t === EMPTY) return (n.dom = document.createComment(''));
  if (typeof t === 'function') {
    const inst = (n.inst = new Inst(n, pinst, ns));
    const out = normOne(safeRender(inst));
    n.child = out;
    n.dom = mount(out, ns, inst);
    collectEffects(inst);
    return n.dom;
  }
  if (t === 'svg') ns = SVG_NS;
  const el = (n.dom = ns ? document.createElementNS(ns, t) : document.createElement(t));
  const props = n.props;
  const isSvg = !!ns;
  for (const k in props) if (k !== 'value' && k !== 'checked') setProp(el, k, props[k], undefined, isSvg);
  if (props.dangerouslySetInnerHTML) {
    el.innerHTML = props.dangerouslySetInnerHTML.__html;
    n.kids = [];
  } else {
    const kids = (n.kids = normKids(props.children));
    const cns = t === 'foreignObject' ? null : ns;
    for (let i = 0; i < kids.length; i++) el.appendChild(mount(kids[i], cns, pinst));
  }
  if ('value' in props) setProp(el, 'value', props.value, undefined, isSvg);
  if ('checked' in props) setProp(el, 'checked', props.checked, undefined, isSvg);
  if (n.ref) setRef(n.ref, el);
  return el;
}

function unmount(n, removeDom) {
  if (n.inst) {
    const inst = n.inst;
    inst.dead = true;
    for (const hk of inst.hooks) {
      if (hk.cleanup) {
        try {
          hk.cleanup();
        } catch (e) {
          errorHandler(e);
        }
        hk.cleanup = null;
      }
    }
    if (n.child) unmount(n.child, false);
  } else if (n.kids) {
    for (let i = 0; i < n.kids.length; i++) unmount(n.kids[i], false);
  }
  if (n.ref) setRef(n.ref, null);
  if (removeDom && n.dom && n.dom.parentNode) n.dom.parentNode.removeChild(n.dom);
}

function patch(o, n, ns, pinst) {
  if (o.type !== n.type || o.key !== n.key) {
    const parent = o.dom && o.dom.parentNode;
    const dom = mount(n, ns, pinst);
    if (parent) parent.replaceChild(dom, o.dom);
    unmount(o, false);
    return;
  }
  const t = n.type;
  if (t === TEXT) {
    n.dom = o.dom;
    if (o.text !== n.text) n.dom.data = n.text;
    return;
  }
  if (t === EMPTY) {
    n.dom = o.dom;
    return;
  }
  if (typeof t === 'function') {
    const inst = (n.inst = o.inst);
    inst.node = n;
    if (t._memo && !inst.dirty && t._memo(o.props, n.props)) {
      n.child = o.child;
      n.dom = o.dom;
      return;
    }
    const out = normOne(safeRender(inst));
    patch(o.child, out, ns, inst);
    n.child = out;
    n.dom = out.dom;
    collectEffects(inst);
    return;
  }
  const el = (n.dom = o.dom);
  if (t === 'svg') ns = SVG_NS;
  const isSvg = !!ns;
  const op = o.props;
  const np = n.props;
  for (const k in op) if (!(k in np) && k !== 'children') setProp(el, k, undefined, op[k], isSvg);
  for (const k in np) if (k !== 'value' && k !== 'checked' && np[k] !== op[k]) setProp(el, k, np[k], op[k], isSvg);
  if (np.dangerouslySetInnerHTML) {
    if (!op.dangerouslySetInnerHTML || op.dangerouslySetInnerHTML.__html !== np.dangerouslySetInnerHTML.__html) {
      if (o.kids) for (const k of o.kids) unmount(k, false);
      el.innerHTML = np.dangerouslySetInnerHTML.__html;
    }
    n.kids = [];
  } else {
    if (op.dangerouslySetInnerHTML) el.innerHTML = '';
    n.kids = diffKids(el, op.dangerouslySetInnerHTML ? [] : o.kids || [], normKids(np.children), t === 'foreignObject' ? null : ns, pinst);
  }
  if ('value' in np) setProp(el, 'value', np.value, op.value, isSvg);
  if ('checked' in np) setProp(el, 'checked', np.checked, op.checked, isSvg);
  if (o.ref !== n.ref) {
    if (o.ref) setRef(o.ref, null);
    if (n.ref) setRef(n.ref, el);
  }
}

function diffKids(parent, olds, news, ns, pinst) {
  const keyed = new Map();
  const unkeyed = [];
  for (let i = 0; i < olds.length; i++) {
    const o = olds[i];
    if (o.key != null) keyed.set(o.key, o);
    else unkeyed.push(o);
  }
  const matched = new Array(news.length);
  const reused = new Set();
  let u = 0;
  for (let i = 0; i < news.length; i++) {
    const n = news[i];
    let o = null;
    if (n.key != null) {
      o = keyed.get(n.key) || null;
      if (o && o.type === n.type) keyed.delete(n.key);
      else o = null;
    } else {
      o = unkeyed[u++] || null;
      if (o && o.type !== n.type) o = null;
    }
    matched[i] = o;
    if (o) reused.add(o);
  }
  for (let i = 0; i < olds.length; i++) if (!reused.has(olds[i])) unmount(olds[i], true);
  // 1) 패치/마운트 먼저 (패치 중 루트가 바뀌면 제자리에서 교체된다)
  for (let i = 0; i < news.length; i++) {
    const o = matched[i];
    if (o) patch(o, news[i], ns, pinst);
    else mount(news[i], ns, pinst);
  }
  // 2) 그다음 순서 맞추기
  let cursor = parent.firstChild;
  for (let i = 0; i < news.length; i++) {
    const dom = news[i].dom;
    if (dom === cursor) cursor = cursor.nextSibling;
    else parent.insertBefore(dom, cursor);
  }
  return news;
}

// ---------- scheduling ----------

function enqueue(inst) {
  if (inst.dirty || inst.dead) return;
  inst.dirty = true;
  renderQueue.push(inst);
  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(flush);
  }
}

function rerender(inst) {
  const n = inst.node;
  const oldDom = n.dom;
  const out = normOne(safeRender(inst));
  patch(n.child, out, inst.ns, inst);
  n.child = out;
  n.dom = out.dom;
  collectEffects(inst);
  if (n.dom !== oldDom) {
    let p = inst.parent;
    while (p && p.node.dom === oldDom) {
      p.node.dom = n.dom;
      p = p.parent;
    }
  }
}

function flush() {
  flushScheduled = false;
  let guard = 0;
  while (renderQueue.length) {
    if (++guard > 50) {
      renderQueue = [];
      errorHandler(new Error('render loop'));
      break;
    }
    const q = renderQueue.sort((a, b) => a.depth - b.depth);
    renderQueue = [];
    for (let i = 0; i < q.length; i++) {
      const inst = q[i];
      if (inst.dirty && !inst.dead) {
        try {
          rerender(inst);
        } catch (e) {
          inst.dirty = false;
          errorHandler(e);
        }
      }
    }
  }
  flushEffects();
}

function runHook(hk) {
  hk.queued = false;
  if (hk.inst.dead || !hk.pending) return;
  hk.pending = false;
  if (hk.cleanup) {
    try {
      hk.cleanup();
    } catch (e) {
      errorHandler(e);
    }
    hk.cleanup = null;
  }
  try {
    const r = hk.fn();
    hk.cleanup = typeof r === 'function' ? r : null;
  } catch (e) {
    errorHandler(e);
  }
}

function flushEffects() {
  if (layoutQueue.length) {
    const lq = layoutQueue;
    layoutQueue = [];
    for (let i = 0; i < lq.length; i++) runHook(lq[i]);
  }
  if (effectQueue.length && !effectsScheduled) {
    effectsScheduled = true;
    setTimeout(runPassive, 0);
  }
}

function runPassive() {
  effectsScheduled = false;
  const q = effectQueue;
  effectQueue = [];
  for (let i = 0; i < q.length; i++) runHook(q[i]);
}

// ---------- public render ----------

export function render(vnode, container) {
  const n = toNode(vnode) || { type: EMPTY, dom: null };
  const old = container.__uiRoot;
  if (old) patch(old, n, null, null);
  else {
    container.textContent = '';
    container.appendChild(mount(n, null, null));
  }
  container.__uiRoot = n;
  flushEffects();
}

/** 테스트용: 대기 중인 렌더와 effect를 즉시 모두 처리한다. */
export function act() {
  if (flushScheduled || renderQueue.length) flush();
  flushEffects();
  if (effectQueue.length) {
    effectsScheduled = false;
    runPassive();
    if (renderQueue.length) flush();
  }
}

// ---------- hooks ----------

function getHook() {
  const inst = currentInst;
  if (!inst) throw new Error('훅은 컴포넌트 렌더 중에만 호출할 수 있습니다');
  const i = inst.hi++;
  return inst.hooks[i] || (inst.hooks[i] = { inst, init: false });
}

function depsChanged(a, b) {
  if (!a || !b || a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return true;
  return false;
}

function basicReducer(s, a) {
  return typeof a === 'function' ? a(s) : a;
}

export function useReducer(reducer, initial) {
  const hk = getHook();
  hk.reducer = reducer;
  if (!hk.init) {
    hk.init = true;
    hk.value = initial;
    hk.dispatch = (action) => {
      const next = hk.reducer(hk.value, action);
      if (!Object.is(next, hk.value)) {
        hk.value = next;
        enqueue(hk.inst);
      }
    };
  }
  return [hk.value, hk.dispatch];
}

export function useState(initial) {
  const hk = getHook();
  hk.reducer = basicReducer;
  if (!hk.init) {
    hk.init = true;
    hk.value = typeof initial === 'function' ? initial() : initial;
    hk.dispatch = (action) => {
      const next = basicReducer(hk.value, action);
      if (!Object.is(next, hk.value)) {
        hk.value = next;
        enqueue(hk.inst);
      }
    };
  }
  return [hk.value, hk.dispatch];
}

function effectHook(fn, deps, layout) {
  const hk = getHook();
  if (!hk.init || depsChanged(hk.deps, deps)) {
    hk.init = true;
    hk.fn = fn;
    hk.deps = deps;
    hk.pending = true;
    hk.layout = layout;
  }
}

export function useEffect(fn, deps) {
  effectHook(fn, deps, false);
}

export function useLayoutEffect(fn, deps) {
  effectHook(fn, deps, true);
}

export function useMemo(fn, deps) {
  const hk = getHook();
  if (!hk.init || depsChanged(hk.deps, deps)) {
    hk.init = true;
    hk.value = fn();
    hk.deps = deps;
  }
  return hk.value;
}

export function useCallback(fn, deps) {
  return useMemo(() => fn, deps);
}

export function useRef(initial) {
  const hk = getHook();
  if (!hk.init) {
    hk.init = true;
    hk.value = { current: initial };
  }
  return hk.value;
}

/** 이 컴포넌트를 에러 경계로 만든다. 하위 렌더 오류 시 [error, reset]의 error가 채워진다. */
export function useErrorBoundary() {
  const inst = currentInst;
  const [err, setErr] = useState(null);
  inst.boundary = { set: setErr };
  return [err, () => setErr(null)];
}

/** 강제 재렌더 함수 */
export function useForceUpdate() {
  const [, set] = useState(0);
  return useCallback(() => set((x) => x + 1), []);
}

export function shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (!Object.is(a[k], b[k])) return false;
  return true;
}

export function memo(Comp, eq = shallowEqual) {
  function Memo(props) {
    return Comp(props);
  }
  Memo._memo = eq;
  return Memo;
}

// ---------- 간단한 외부 저장소 ----------

export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
      if (next === state) return;
      state = next;
      for (const fn of [...subs]) fn(state);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

/** 저장소 구독 훅. selector 결과가 바뀔 때만 다시 그린다. */
export function useStore(store, selector = (s) => s) {
  const [, force] = useState(0);
  const sel = useRef(selector);
  sel.current = selector;
  const value = selector(store.get());
  const last = useRef(value);
  last.current = value;
  useLayoutEffect(
    () =>
      store.subscribe((s) => {
        const v = sel.current(s);
        if (!Object.is(v, last.current)) force((x) => x + 1);
      }),
    [store],
  );
  return value;
}
