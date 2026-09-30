// 동기화 상태 표시 (작은 점 + 글자)
import { html } from '../lib/html.js';
import { useStore } from '../lib/ui.js';
import { Icon } from '../ui/icons.js';
import { syncState } from '../sync/state.js';
import { device } from '../state/device.js';

export function syncSummary(st, dev) {
  if (!st.configured) return { icon: 'cloud-off', text: '이 기기에만 저장', tone: 'muted' };
  if (!st.user) return { icon: 'cloud-off', text: dev.localOnly ? '이 기기에만 저장' : '로그인 필요', tone: 'muted' };
  if (st.status === 'syncing') return { icon: 'sync', text: '동기화 중', tone: 'busy' };
  if (st.status === 'offline') return { icon: 'cloud-off', text: `오프라인${st.pending ? ` · 대기 ${st.pending}` : ''}`, tone: 'muted' };
  if (st.status === 'error') return { icon: 'cloud-off', text: '동기화 오류', tone: 'err' };
  if (st.pending) return { icon: 'cloud', text: `올릴 변경 ${st.pending}`, tone: 'muted' };
  return { icon: 'cloud', text: '동기화됨', tone: 'ok' };
}

export function SyncBadge({ onClick }) {
  const st = useStore(syncState);
  const dev = useStore(device);
  const s = syncSummary(st, dev);
  return html`<button class=${'sync-badge ' + s.tone} onClick=${onClick} aria-label=${'동기화 상태: ' + s.text}>
    <${Icon} name=${s.icon} size=${18} />
    <span>${s.text}</span>
  </button>`;
}
