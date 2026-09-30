// 화면 공통: 머리글, 본문, 과목 선택 등
import { html } from '../lib/html.js';
import { useRef, useStore } from '../lib/ui.js';
import { Icon } from '../ui/icons.js';
import { IconButton, cx } from '../ui/kit.js';
import { activeSubjects, subjectVars } from '../data/model.js';
import { appState } from '../state/app.js';
import { PANEL_VIEWS } from '../state/device.js';

/**
 * 화면 머리글. 태블릿 패널의 첫 화면이면 왼쪽에 '화면 바꾸기' 단추가 붙는다.
 * title은 문자열 또는 요소. onTitle이 있으면 제목을 누를 수 있다.
 */
export function ViewHeader({ nav, panel, title, sub, actions, onTitle, titleLabel }) {
  const ref = useRef(null);
  const atRoot = !nav || !nav.canPop;
  const view = panel ? PANEL_VIEWS.find((v) => v.id === panel.viewId) : null;
  let left = null;
  if (!atRoot) left = html`<${IconButton} icon="chev-left" label="뒤로" onClick=${() => nav.pop()} />`;
  else if (panel)
    left = html`<button class="view-switch" ref=${ref} onClick=${() => panel.chooseView(ref.current)} aria-label=${`화면 바꾸기 (지금: ${view ? view.label : ''})`}>
      <${Icon} name=${view ? view.icon : 'layout'} size=${20} /><${Icon} name="chev-down" size=${14} stroke=${2.2} />
    </button>`;
  const t = typeof title === 'string' ? html`<span class="ellipsis">${title}</span>` : title;
  return html`<header class=${cx('view-head', panel && 'in-panel')}>
    ${left}
    <div class="vh-main">
      ${onTitle
        ? html`<button class="vh-title tappable" onClick=${onTitle} aria-label=${titleLabel}>${t}</button>`
        : html`<div class="vh-title">${t}</div>`}
      ${sub ? html`<div class="vh-sub ellipsis">${sub}</div>` : null}
    </div>
    <div class="vh-actions">${actions}</div>
  </header>`;
}

export function ViewBody({ children, class: cls, pad = true, refEl }) {
  return html`<div class=${cx('view-body', pad && 'padded', cls)} ref=${refEl}>${children}</div>`;
}

/** 가로 스크롤 과목 칩 (필수 선택) */
export function SubjectChips({ value, onChange, subjects }) {
  const list = subjects || activeSubjects();
  return html`<div class="chips scroll" role="radiogroup" aria-label="과목">
    ${list.map(
      (s) => html`<button key=${s.id} role="radio" aria-checked=${s.id === value ? 'true' : 'false'} class=${cx('chip subject', s.id === value && 'on')} style=${subjectVars(s)} onClick=${() => onChange(s.id)}>
        <span class="dot"></span>${s.name}
      </button>`,
    )}
  </div>`;
}

export function useIsTablet() {
  return useStore(appState, (s) => s.isTablet);
}

export function Fab({ onClick, label = '할 일 추가', icon = 'plus' }) {
  return html`<button class="fab" onClick=${onClick} aria-label=${label}><${Icon} name=${icon} size=${26} stroke=${2.2} /></button>`;
}

export function Card({ title, actions, children, class: cls, pad = true, style }) {
  return html`<section class=${cx('card', cls)} style=${style}>
    ${title || actions ? html`<div class="card-head"><h3 class="grow ellipsis">${title}</h3>${actions}</div>` : null}
    ${pad ? html`<div class="card-pad" style=${title ? 'padding-top:6px' : ''}>${children}</div>` : children}
  </section>`;
}
