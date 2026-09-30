// 휴대폰: 한 화면 + 아래 탭 (탭마다 화면 스택 유지)
import { html } from '../lib/html.js';
import { useState, useStore, useRef, memo, useEffect } from '../lib/ui.js';
import { Icon } from '../ui/icons.js';
import { device, PHONE_TABS } from '../state/device.js';
import { setSelectedDate } from '../state/app.js';
import { useStack } from './nav.js';
import { VIEWS } from '../views/registry.js';
import { version } from '../data/db.js';
import { openSettings } from '../views/settings/index.js';

const TabStack = memo(function TabStack({ id, active, shell, navs }) {
  const nav = useStack({ name: id, params: {} }, active);
  navs.current[id] = nav;
  const top = nav.top;
  const V = VIEWS[top.name];
  return html`<div class="tab-pane" hidden=${!active} aria-hidden=${active ? 'false' : 'true'}>
    ${V ? html`<${V} key=${top.key} nav=${nav} params=${top.params} shell=${shell} />` : null}
  </div>`;
});

export function PhoneShell({ dbv }) {
  const tabs = useStore(device, (s) => s.phoneTabs);
  const [tab, setTab] = useState(tabs[0] || 'today');
  const [visited, setVisited] = useState(() => new Set([tabs[0] || 'today']));
  const navs = useRef({});
  const shellRef = useRef(null);
  if (!shellRef.current) shellRef.current = {};
  const go = (id) => {
    if (!visited.has(id)) setVisited(new Set([...visited, id]));
    setTab(id);
  };
  Object.assign(shellRef.current, {
    kind: 'phone',
    openDay(date) {
      setSelectedDate(date);
      go('today');
      const n = navs.current.today;
      if (n && n.canPop) n.reset('today');
    },
    openView: go,
    openSettings: (page) => openSettings(page, shellRef.current),
  });
  useEffect(() => {
    document.documentElement.dataset.shell = 'phone';
  }, []);
  const list = tabs.map((id) => PHONE_TABS.find((t) => t.id === id)).filter(Boolean);
  return html`<div class="phone-shell">
    ${list.map((t) =>
      visited.has(t.id) || t.id === tab
        ? html`<${TabStack} key=${t.id} id=${t.id} active=${t.id === tab} shell=${shellRef.current} navs=${navs} v=${t.id === tab ? dbv : -1} />`
        : null,
    )}
    <nav class="tabbar" aria-label="주요 화면">
      ${list.map(
        (t) => html`<button
          key=${t.id}
          class=${'tab' + (t.id === tab ? ' on' : '')}
          aria-current=${t.id === tab ? 'page' : undefined}
          onClick=${() => {
            if (t.id === tab) {
              const n = navs.current[t.id];
              if (n && n.canPop) n.reset(t.id);
              else if (t.id === 'today') setSelectedDate(null);
            } else go(t.id);
          }}
        >
          <${Icon} name=${t.icon} size=${24} stroke=${t.id === tab ? 2.1 : 1.7} />
          <span>${t.label}</span>
        </button>`,
      )}
    </nav>
  </div>`;
}
