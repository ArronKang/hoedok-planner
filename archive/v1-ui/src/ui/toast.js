// 토스트와 '실행 취소'
import { html } from '../lib/html.js';
import { createStore, useStore } from '../lib/ui.js';
import { beginCapture, endCapture, restore } from '../data/db.js';

const store = createStore({ items: [] });
let seq = 0;

export function toast(message, { action, onAction, duration = 4000 } = {}) {
  const id = ++seq;
  const item = { id, message, action, onAction, leaving: false };
  store.set((s) => ({ items: [...s.items.slice(-2), item] }));
  const timer = setTimeout(() => dismiss(id), duration);
  item.timer = timer;
  return id;
}

export function dismiss(id) {
  const it = store.get().items.find((i) => i.id === id);
  if (!it || it.leaving) return;
  clearTimeout(it.timer);
  store.set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, leaving: true } : i)) }));
  setTimeout(() => store.set((s) => ({ items: s.items.filter((i) => i.id !== id) })), 200);
}

/**
 * fn 안에서 일어난 저장을 기록해 두었다가 '실행 취소'로 되돌린다.
 * 삭제·이동 직후 되돌리기를 제공하는 공통 도구.
 */
export function withUndo(message, fn, { duration = 5500 } = {}) {
  beginCapture();
  let result;
  try {
    result = fn();
  } finally {
    const entries = endCapture();
    if (entries.length) {
      toast(message, {
        action: '실행 취소',
        duration,
        onAction: () => restore(entries),
      });
    }
  }
  return result;
}

export function ToastHost() {
  const { items } = useStore(store);
  if (!items.length) return null;
  return html`<div class="toasts" role="status" aria-live="polite">
    ${items.map(
      (it) => html`<div key=${it.id} class=${'toast' + (it.leaving ? ' leaving' : '')}>
        <div class="msg">${it.message}</div>
        ${it.action
          ? html`<button
              onClick=${() => {
                it.onAction && it.onAction();
                dismiss(it.id);
              }}
            >
              ${it.action}
            </button>`
          : null}
      </div>`,
    )}
  </div>`;
}
