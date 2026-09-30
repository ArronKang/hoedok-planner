// 태블릿: 1~3 패널 분할, 경계 끌어서 크기 조절, 패널마다 화면·카드 선택, 레이아웃 프리셋
import { html } from '../lib/html.js';
import { useState, useStore, useRef, useEffect, memo } from '../lib/ui.js';
import { Icon } from '../ui/icons.js';
import { IconButton, SortableList, Toggle, Segmented, cx } from '../ui/kit.js';
import { openMenu, openSheet, Sheet, promptDialog, confirmDialog } from '../ui/overlay.js';
import { toast } from '../ui/toast.js';
import { device, setDevice, activePreset, layoutFor, updateLayout, PANEL_VIEWS, VIEW_CARDS, resolveCards } from '../state/device.js';
import { appState, setSelectedDate } from '../state/app.js';
import { useStack } from './nav.js';
import { VIEWS } from '../views/registry.js';
import { openSettings } from '../views/settings/index.js';
import { uid } from '../core/id.js';
import { SyncBadge } from './SyncBadge.js';

const MIN_PANEL = 300;

function CardsSheet({ viewId, cfg, onChange, close }) {
  const [state, setState] = useState(() => resolveCards(viewId, cfg));
  const commit = (next) => {
    setState(next);
    onChange({ order: next.map((c) => c.id), hidden: next.filter((c) => c.hidden).map((c) => c.id) });
  };
  const v = PANEL_VIEWS.find((x) => x.id === viewId);
  return html`<${Sheet} title=${`${v ? v.label : ''} 카드`} onClose=${() => close()}>
    <p class="sub" style="margin:0 0 10px">끌어서 순서를 바꾸고, 스위치로 보이거나 숨깁니다.</p>
    <div class="card list">
      <${SortableList}
        items=${state}
        keyOf=${(c) => c.id}
        onReorder=${(ids) => commit(ids.map((id) => state.find((c) => c.id === id)))}
        renderItem=${(c, grip) => html`<div class="list-row">
          ${grip}<span class="label">${c.label}</span>
          <${Toggle} label=${c.label + ' 표시'} checked=${!c.hidden} onChange=${(on) => commit(state.map((x) => (x.id === c.id ? { ...x, hidden: !on } : x)))} />
        </div>`}
      />
    </div>
  <//>`;
}

const Panel = memo(function Panel({ index, config, presetId, orientation, editing, shell, count }) {
  const nav = useStack({ name: config.view, params: {} }, true);
  useEffect(() => {
    if (nav.stack[0].name !== config.view) nav.reset(config.view);
  }, [config.view]);
  const setPanel = (patch) =>
    updateLayout(presetId, orientation, (l) => ({ ...l, panels: l.panels.map((p, i) => (i === index ? { ...p, ...patch } : p)) }));
  const chooseView = (anchor) =>
    openMenu({
      anchor,
      title: '이 패널에 보여줄 화면',
      items: PANEL_VIEWS.map((v) => ({ label: v.label, icon: v.icon, on: v.id === config.view, onSelect: () => setPanel({ view: v.id, cards: null }) })),
    });
  const panel = { index, viewId: config.view, cards: config.cards, chooseView };
  const top = nav.top;
  const V = VIEWS[top.name];
  const hasCards = !!VIEW_CARDS[config.view];
  const ref = useRef(null);
  return html`<section class="panel" style=${{ flexGrow: config.size || 1 }} data-index=${index}>
    ${V ? html`<${V} key=${top.key} nav=${nav} params=${top.params} panel=${panel} shell=${shell} />` : null}
    ${editing
      ? html`<div class="panel-edit">
          <div class="pe-box">
            <div class="pe-title">패널 ${index + 1}</div>
            <button class="btn block" ref=${ref} onClick=${() => chooseView(ref.current)}>
              <${Icon} name=${(PANEL_VIEWS.find((v) => v.id === config.view) || {}).icon || 'layout'} size=${18} />
              ${(PANEL_VIEWS.find((v) => v.id === config.view) || {}).label || '화면'}
              <${Icon} name="chev-down" size=${16} />
            </button>
            ${hasCards
              ? html`<button class="btn block" onClick=${() => openSheet((close) => html`<${CardsSheet} viewId=${config.view} cfg=${config.cards} onChange=${(c) => setPanel({ cards: c })} close=${close} />`)}>
                  <${Icon} name="layers" size=${18} />카드 표시·순서
                </button>`
              : null}
            ${count > 1
              ? html`<button class="btn block danger" onClick=${() =>
                  updateLayout(presetId, orientation, (l) => ({ ...l, panels: l.panels.filter((p, i) => i !== index) }))}>
                  <${Icon} name="x" size=${18} />이 패널 빼기
                </button>`
              : null}
          </div>
        </div>`
      : null}
  </section>`;
});

function Divider({ index, dir, presetId, orientation, containerRef }) {
  const st = useRef(null);
  const onDown = (e) => {
    const box = containerRef.current;
    if (!box) return;
    const panels = [...box.querySelectorAll(':scope > .panel')];
    const a = panels[index - 1];
    const b = panels[index];
    if (!a || !b) return;
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const total = dir === 'row' ? ra.width + rb.width : ra.height + rb.height;
    const ga = Number(a.style.flexGrow) || 1;
    const gb = Number(b.style.flexGrow) || 1;
    st.current = { start: dir === 'row' ? e.clientX : e.clientY, sa: dir === 'row' ? ra.width : ra.height, total, sum: ga + gb, a, b, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.classList.add('active');
  };
  const onMove = (e) => {
    const s = st.current;
    if (!s || s.id !== e.pointerId) return;
    const d = (dir === 'row' ? e.clientX : e.clientY) - s.start;
    const na = Math.max(MIN_PANEL * 0.8, Math.min(s.total - MIN_PANEL * 0.8, s.sa + d));
    const fa = (na / s.total) * s.sum;
    s.fa = fa;
    s.fb = s.sum - fa;
    s.a.style.flexGrow = fa;
    s.b.style.flexGrow = s.fb;
  };
  const onUp = (e) => {
    const s = st.current;
    st.current = null;
    e.currentTarget.classList.remove('active');
    if (!s || s.fa == null) return;
    updateLayout(presetId, orientation, (l) => ({
      ...l,
      panels: l.panels.map((p, i) => (i === index - 1 ? { ...p, size: s.fa } : i === index ? { ...p, size: s.fb } : p)),
    }));
  };
  return html`<div
    class=${'divider ' + dir}
    role="separator"
    aria-orientation=${dir === 'row' ? 'vertical' : 'horizontal'}
    aria-label="패널 크기 조절"
    onPointerDown=${onDown}
    onPointerMove=${onMove}
    onPointerUp=${onUp}
    onPointerCancel=${onUp}
  ><i></i></div>`;
}

function EditBar({ preset, orientation, layout, done }) {
  const presets = useStore(device, (s) => s.presets);
  const setDir = (dir) => updateLayout(preset.id, orientation, (l) => ({ ...l, dir }));
  const addPanel = () => {
    if (layout.panels.length >= 3) return;
    const used = new Set(layout.panels.map((p) => p.view));
    const v = (PANEL_VIEWS.find((x) => !used.has(x.id)) || PANEL_VIEWS[0]).id;
    updateLayout(preset.id, orientation, (l) => ({ ...l, panels: [...l.panels, { view: v, size: 1 / (l.panels.length + 1) }] }));
  };
  const rename = async () => {
    const name = await promptDialog({ title: '프리셋 이름', value: preset.name, confirm: '저장' });
    if (name) setDevice((s) => ({ ...s, presets: s.presets.map((p) => (p.id === preset.id ? { ...p, name } : p)) }));
  };
  const addPreset = async () => {
    const name = await promptDialog({ title: '새 프리셋', label: '지금 배치를 복사해서 만듭니다', placeholder: '예: 오답 정리', confirm: '만들기' });
    if (!name) return;
    const id = uid(8);
    setDevice((s) => ({ ...s, presets: [...s.presets, { id, name, layouts: JSON.parse(JSON.stringify(preset.layouts)) }], activePreset: id }));
  };
  const delPreset = async () => {
    if (presets.length <= 1) return toast('프리셋은 하나 이상 있어야 합니다');
    const ok = await confirmDialog({ title: `'${preset.name}' 삭제`, confirm: '삭제', danger: true });
    if (!ok) return;
    setDevice((s) => {
      const list = s.presets.filter((p) => p.id !== preset.id);
      return { ...s, presets: list, activePreset: list[0].id };
    });
  };
  return html`<div class="editbar">
    <button class="btn sm" onClick=${rename}><${Icon} name="edit" size=${16} />${preset.name}</button>
    <span class="muted eb-o">${orientation === 'landscape' ? '가로 화면 배치' : '세로 화면 배치'}</span>
    <${Segmented} size="sm" label="나누는 방향" value=${layout.dir} onChange=${setDir} options=${[{ value: 'row', label: '좌우로' }, { value: 'column', label: '위아래로' }]} />
    <button class="btn sm" onClick=${addPanel} disabled=${layout.panels.length >= 3}><${Icon} name="plus" size=${16} />패널</button>
    <span class="spacer"></span>
    <button class="btn sm" onClick=${addPreset}>새 프리셋</button>
    <button class="btn sm danger" onClick=${delPreset}>프리셋 삭제</button>
    <button class="btn sm primary" onClick=${done}>완료</button>
  </div>`;
}

export function TabletShell({ dbv }) {
  const dev = useStore(device);
  const orientation = useStore(appState, (s) => s.orientation);
  const w = useStore(appState, (s) => s.w);
  const h = useStore(appState, (s) => s.h);
  const [editing, setEditing] = useState(false);
  const preset = activePreset(dev);
  const layout = layoutFor(preset, orientation);
  const box = useRef(null);
  const shellRef = useRef(null);
  if (!shellRef.current) shellRef.current = {};
  Object.assign(shellRef.current, {
    kind: 'tablet',
    openDay(date) {
      setSelectedDate(date);
    },
    editLayout: () => setEditing(true),
    openSettings: (page) => openSettings(page, shellRef.current),
  });
  useEffect(() => {
    document.documentElement.dataset.shell = 'tablet';
  }, []);
  const avail = layout.dir === 'row' ? w : h - 60;
  const maxPanels = Math.max(1, Math.min(3, Math.floor(avail / MIN_PANEL)));
  const panels = layout.panels.slice(0, maxPanels);
  const hiddenCount = layout.panels.length - panels.length;

  const items = [];
  panels.forEach((p, i) => {
    if (i > 0) items.push(html`<${Divider} key=${'d' + i} index=${i} dir=${layout.dir} presetId=${preset.id} orientation=${orientation} containerRef=${box} />`);
    items.push(
      html`<${Panel}
        key=${preset.id + orientation + i}
        index=${i}
        config=${p}
        presetId=${preset.id}
        orientation=${orientation}
        editing=${editing}
        shell=${shellRef.current}
        count=${layout.panels.length}
        v=${dbv}
      />`,
    );
  });

  return html`<div class="tablet-shell">
    <header class="topbar">
      ${editing
        ? html`<${EditBar} preset=${preset} orientation=${orientation} layout=${layout} done=${() => setEditing(false)} />`
        : html`
            <div class="presets" role="tablist" aria-label="화면 배치 프리셋">
              ${dev.presets.map(
                (p) => html`<button key=${p.id} role="tab" aria-selected=${p.id === preset.id ? 'true' : 'false'} class=${cx('preset', p.id === preset.id && 'on')} onClick=${() => setDevice({ activePreset: p.id })}>
                  ${p.name}
                </button>`,
              )}
            </div>
            <span class="spacer"></span>
            <${SyncBadge} onClick=${() => openSettings('account', shellRef.current)} />
            <${IconButton} icon="layout" label="화면 배치 편집" onClick=${() => setEditing(true)} />
            <${IconButton} icon="sliders" label="설정" onClick=${() => openSettings(null, shellRef.current)} />
          `}
    </header>
    ${hiddenCount > 0 ? html`<div class="hidden-note">화면이 좁아 패널 ${hiddenCount}개를 숨겼습니다</div>` : null}
    <div class=${'panels dir-' + layout.dir} ref=${box}>${items}</div>
  </div>`;
}
