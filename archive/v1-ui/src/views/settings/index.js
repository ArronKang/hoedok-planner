// 설정 (전체 시트 + 안쪽 화면 스택)
import { html } from '../../lib/html.js';
import { useStore } from '../../lib/ui.js';
import { openSheet, openMenu } from '../../ui/overlay.js';
import { Icon } from '../../ui/icons.js';
import { IconButton } from '../../ui/kit.js';
import { useStack } from '../../shell/nav.js';
import { prefs, activeSubjects, semesters, currentSemester, semesterLabel } from '../../data/model.js';
import { setPrefs } from '../../data/actions.js';
import { device } from '../../state/device.js';
import { syncState } from '../../sync/state.js';
import { SubjectsPage } from './subjects.js';
import { AvailabilityPage } from './availability.js';
import { SemestersPage } from './semesters.js';
import { DisplayPage } from './display.js';
import { AccountPage } from './account.js';
import { DataPage } from './data.js';
import { AboutPage } from './about.js';

const PAGES = {
  subjects: { title: '과목과 교재', C: SubjectsPage },
  availability: { title: '공부 가능 시간', C: AvailabilityPage },
  semesters: { title: '학기', C: SemestersPage },
  display: { title: '화면 (이 기기)', C: DisplayPage },
  account: { title: '계정 · 동기화', C: AccountPage },
  data: { title: '백업 · 데이터', C: DataPage },
  about: { title: '앱 정보', C: AboutPage },
};

const HOURS = [0, 1, 2, 3, 4, 5, 6];
const hourLabel = (h) => (h === 0 ? '자정 (0시)' : `새벽 ${h}시`);

function Row({ icon, label, value, onClick }) {
  return html`<button class="list-row" onClick=${onClick}>
    <${Icon} name=${icon} />
    <span class="label">${label}</span>
    ${value != null ? html`<span class="value ellipsis">${value}</span>` : null}
    <${Icon} name="chev-right" size=${18} class="chev" />
  </button>`;
}

function Root({ nav }) {
  const p = prefs();
  const sync = useStore(syncState);
  const dev = useStore(device);
  const sem = currentSemester();
  const pickHour = (el) =>
    openMenu({
      anchor: el,
      title: '하루가 바뀌는 시각',
      items: HOURS.map((h) => ({ label: hourLabel(h), on: p.dayStartHour === h, onSelect: () => setPrefs({ dayStartHour: h }) })),
    });
  const syncLabel = sync.user ? sync.user.email : dev.localOnly ? '이 기기에만 저장 중' : sync.configured ? '로그인 필요' : '서버 설정 필요';
  return html`<div class="settings-root">
    <div class="card list">
      <${Row} icon="book" label="과목과 교재" value=${`${activeSubjects().length}개`} onClick=${() => nav.push('subjects')} />
      <${Row} icon="clock" label="공부 가능 시간" onClick=${() => nav.push('availability')} />
      <${Row} icon="calendar" label="학기" value=${sem ? semesterLabel(sem) : semesters().length ? '' : '없음'} onClick=${() => nav.push('semesters')} />
      <button class="list-row" onClick=${(e) => pickHour(e.currentTarget)}>
        <${Icon} name="moon" />
        <span class="label">하루가 바뀌는 시각<small class="row-sub">밤늦게 공부해도 그날로 기록되도록</small></span>
        <span class="value">${hourLabel(p.dayStartHour)}</span>
        <${Icon} name="chev-down" size=${18} class="chev" />
      </button>
    </div>
    <div class="card list" style="margin-top:var(--gap)">
      <${Row} icon="layout" label="화면 (이 기기)" onClick=${() => nav.push('display')} />
      <${Row} icon="cloud" label="계정 · 동기화" value=${syncLabel} onClick=${() => nav.push('account')} />
      <${Row} icon="download" label="백업 · 데이터" onClick=${() => nav.push('data')} />
      <${Row} icon="info" label="앱 정보" onClick=${() => nav.push('about')} />
    </div>
  </div>`;
}

function SettingsSheet({ close, page, shell }) {
  const nav = useStack({ name: page || 'root', params: {} });
  const top = nav.top;
  const P = PAGES[top.name];
  return html`<div class="sheet full settings-sheet" role="dialog" aria-modal="true" aria-label="설정">
    <div class="sheet-grab"></div>
    <div class="sheet-head">
      ${nav.canPop ? html`<${IconButton} icon="chev-left" label="뒤로" onClick=${() => nav.pop()} />` : null}
      <h2 class="ellipsis">${P ? P.title : '설정'}</h2>
      <${IconButton} icon="x" label="닫기" onClick=${() => close()} />
    </div>
    <div class="sheet-body" key=${top.key}>
      ${P ? html`<${P.C} nav=${nav} params=${top.params} close=${close} shell=${shell} />` : html`<${Root} nav=${nav} />`}
    </div>
  </div>`;
}

export function openSettings(page, shell) {
  return openSheet((close) => html`<${SettingsSheet} close=${close} page=${page} shell=${shell} />`);
}
