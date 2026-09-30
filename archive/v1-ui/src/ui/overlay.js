// 시트(휴대폰: 아래에서 올라옴) / 모달(태블릿: 가운데), 메뉴, 확인 창
import { html } from '../lib/html.js';
import { createStore, useStore, useEffect, useRef, useState } from '../lib/ui.js';
import { pushBack } from './back.js';
import { appState } from '../state/app.js';
import { Icon } from './icons.js';

const store = createStore({ list: [] });
let seq = 0;

/**
 * 오버레이를 연다. render(close)는 시트 요소를 돌려줘야 한다.
 * opts: { modal: 'auto'|'always'|'never', wide, dismissable }
 * @returns Promise<결과> — close(결과)로 닫을 때의 값 (배경/뒤로 가기로 닫으면 undefined)
 */
export function openSheet(render, opts = {}) {
  return new Promise((resolve) => {
    const id = ++seq;
    let closed = false;
    let release = null;
    const close = (result) => {
      if (closed) return;
      closed = true;
      if (release) {
        const r = release;
        release = null;
        r();
      }
      store.set((s) => ({ list: s.list.map((o) => (o.id === id ? { ...o, closing: true } : o)) }));
      setTimeout(() => store.set((s) => ({ list: s.list.filter((o) => o.id !== id) })), 200);
      resolve(result);
    };
    release = pushBack(() => {
      release = null;
      close(undefined);
    });
    store.set((s) => ({ list: [...s.list, { id, render, opts, close, closing: false }] }));
  });
}

export function closeAllOverlays() {
  for (const o of store.get().list) o.close();
}

export function hasOverlay() {
  return store.get().list.some((o) => !o.closing);
}

function OverlayItem({ o, isTablet }) {
  const mode = o.opts.modal || 'auto';
  const modal = mode === 'always' || (mode === 'auto' && isTablet);
  const cls = ['overlay', modal ? 'modal' : '', o.opts.wide ? 'wide' : '', o.closing ? 'closing' : ''].join(' ');
  return html`<div class=${cls}>
    <div class="backdrop" onClick=${() => o.opts.dismissable !== false && o.close()}></div>
    ${o.render(o.close)}
  </div>`;
}

export function OverlayHost() {
  const { list } = useStore(store);
  const isTablet = useStore(appState, (s) => s.isTablet);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const open = store.get().list.filter((o) => !o.closing);
      if (open.length) open[open.length - 1].close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = list.length ? 'hidden' : '';
  }, [list.length]);
  return html`<div class="overlays">${list.map((o) => html`<${OverlayItem} key=${o.id} o=${o} isTablet=${isTablet} />`)}</div>`;
}

/** 시트 틀 */
export function Sheet({ title, onClose, children, footer, full, headLeft, headRight, label, bodyRef }) {
  return html`<div class=${'sheet' + (full ? ' full' : '')} role="dialog" aria-modal="true" aria-label=${label || title}>
    <div class="sheet-grab"></div>
    <div class="sheet-head">
      ${headLeft}
      <h2 class="ellipsis">${title}</h2>
      ${headRight}
      ${onClose ? html`<button class="icon-btn" aria-label="닫기" onClick=${() => onClose()}><${Icon} name="x" /></button>` : null}
    </div>
    <div class="sheet-body" ref=${bodyRef}>${children}</div>
    ${footer ? html`<div class="sheet-foot">${footer}</div>` : null}
  </div>`;
}

// ---------- 확인 / 입력 ----------

export function confirmDialog({ title, message, confirm = '확인', cancel = '취소', danger = false }) {
  return openSheet(
    (close) => html`<${Sheet}
      title=${title}
      onClose=${() => close(false)}
      footer=${html`<button class="btn" onClick=${() => close(false)}>${cancel}</button>
        <button class=${'btn ' + (danger ? 'danger solid' : 'primary')} onClick=${() => close(true)}>${confirm}</button>`}
    >
      ${message ? html`<p class="sub" style="margin:4px 0 8px">${message}</p>` : null}
    <//>`,
  ).then((r) => !!r);
}

function PromptBody({ close, label, value, placeholder, confirm, inputMode, multiline }) {
  const [v, setV] = useState(value || '');
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.focus();
      try {
        el.setSelectionRange(el.value.length, el.value.length);
      } catch {
        /* number 입력 등 */
      }
    }
  }, []);
  const submit = (e) => {
    if (e) e.preventDefault();
    close(v.trim());
  };
  return html`<form onSubmit=${submit}>
    <div class="field">
      ${label ? html`<label>${label}</label>` : null}
      ${multiline
        ? html`<textarea ref=${ref} class="textarea" value=${v} placeholder=${placeholder || ''} onInput=${(e) => setV(e.target.value)}></textarea>`
        : html`<input ref=${ref} class="input" value=${v} placeholder=${placeholder || ''} inputmode=${inputMode} enterkeyhint="done" onInput=${(e) => setV(e.target.value)} />`}
    </div>
    <div class="hstack" style="margin-top:16px">
      <button type="button" class="btn grow" onClick=${() => close(null)}>취소</button>
      <button type="submit" class="btn primary grow">${confirm || '확인'}</button>
    </div>
  </form>`;
}

export function promptDialog({ title, label, value, placeholder, confirm, inputMode, multiline }) {
  return openSheet(
    (close) => html`<${Sheet} title=${title} onClose=${() => close(null)}>
      <${PromptBody} close=${close} label=${label} value=${value} placeholder=${placeholder} confirm=${confirm} inputMode=${inputMode} multiline=${multiline} />
    <//>`,
  ).then((r) => (r == null ? null : r));
}

// ---------- 메뉴 ----------

const menuStore = createStore({ menu: null });

/**
 * 선택 메뉴. 태블릿에서 anchor가 있으면 팝오버, 아니면 액션 시트.
 * items: [{ label, icon, onSelect, danger, on, sub }] | 'sep'
 */
export function openMenu({ anchor, title, items }) {
  const isTablet = appState.get().isTablet;
  if (isTablet && anchor && anchor.getBoundingClientRect) {
    const r = anchor.getBoundingClientRect();
    return new Promise((resolve) => {
      let release = null;
      const close = (v) => {
        if (release) {
          const rr = release;
          release = null;
          rr();
        }
        menuStore.set({ menu: null });
        resolve(v);
      };
      release = pushBack(() => {
        release = null;
        menuStore.set({ menu: null });
        resolve(undefined);
      });
      menuStore.set({ menu: { rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, items, close } });
    }).then((it) => {
      if (it && it.onSelect) it.onSelect();
      return it;
    });
  }
  return openSheet(
    (close) => html`<${Sheet} title=${title || '선택'} onClose=${() => close()}>
      <div class="actions" style="margin:0 calc(var(--pad) * -1)">
        ${items.map((it, i) =>
          it === 'sep'
            ? html`<div key=${'s' + i} style="height:1px;background:var(--line);margin:6px 16px"></div>`
            : html`<button key=${i} class=${'action' + (it.danger ? ' danger' : '')} onClick=${() => close(it)}>
                ${it.icon ? html`<${Icon} name=${it.icon} />` : null}
                <span class="grow" style=${it.on ? 'color:var(--accent);font-weight:700' : ''}>${it.label}${it.sub ? html`<small>${it.sub}</small>` : null}</span>
                ${it.on ? html`<${Icon} name="check" size=${20} />` : null}
              </button>`,
        )}
      </div>
    <//>`,
  ).then((it) => {
    if (it && it.onSelect) it.onSelect();
    return it;
  });
}

export function MenuHost() {
  const { menu } = useStore(menuStore);
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (!menu || !ref.current) {
      setPos(null);
      return;
    }
    const el = ref.current;
    const w = el.offsetWidth;
    const hgt = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = Math.min(Math.max(12, menu.rect.left), vw - w - 12);
    let top = menu.rect.bottom + 6;
    if (top + hgt > vh - 12) top = Math.max(12, menu.rect.top - hgt - 6);
    setPos({ left, top });
  }, [menu]);
  if (!menu) return null;
  return html`<div>
    <div class="menu-scrim" onClick=${() => menu.close()}></div>
    <div class="menu-pop" ref=${ref} role="menu" style=${pos ? { left: pos.left + 'px', top: pos.top + 'px' } : { left: '-9999px', top: '0px' }}>
      ${menu.items.map((it, i) =>
        it === 'sep'
          ? html`<div key=${'s' + i} class="sep"></div>`
          : html`<button key=${i} role="menuitem" class=${it.on ? 'on' : ''} style=${it.danger ? 'color:var(--danger)' : ''} onClick=${() => menu.close(it)}>
              ${it.icon ? html`<${Icon} name=${it.icon} size=${20} />` : null}
              <span class="grow">${it.label}</span>
              ${it.on ? html`<${Icon} name="check" size=${18} />` : null}
            </button>`,
      )}
    </div>
  </div>`;
}
