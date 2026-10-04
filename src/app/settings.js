// 설정: 애플 설정처럼 — 맨 위에 계정, 그 아래 '화면'을 꾸미는 것들을 앞에, 공부 설정과 기록 관리는 그다음.
// 고를 수 있는 건 모두 미리 설계한 선택지 → 무엇을 골라도 보기 좋게. 고르는 즉시 화면에 보인다.
// 화면 설정은 이 기기에만, 공부 설정(공부 가능 시간 등)은 계정으로 기기끼리 맞춘다.
import { html } from '../lib/html.js';
import { useState, useRef, useLayoutEffect, useStore } from '../lib/ui.js';
import * as C from './core.js';
import { Icon, Sheet, Seg, Switch, Stepper, hue, DateField } from './kit.js';
import { AccountPage, syncSmall } from './account.js';
import * as M from './motion.js';
import { ns, PREVIEW } from '../env.js';
import { installable, openInstall } from './pwa.js';
import * as K from './curriculum.js';
import { wipeThisDevice } from './store.js';
import { needsAttention } from '../sync/sync.js';
import { syncState } from '../sync/state.js';

const { D, PR, setPrefs, openSheet, closeSheet, commit, toast, minutes, WD } = C;

/** 이 앱의 버전 (설정 › 정보) */
export const APP_VERSION = '베타 2.1';
export const APP_DATE = '2026년 10월';

/** 테마 = 색 묶음 (모양은 모두 같다 — docs/디자인-규칙.md). 견본 색은 밝게 기준 */
const THEMES = [
  { id: 'base', name: '기본', bg: '#f2f2f7', surf: '#ffffff', ac: '#2563eb' },
  { id: 'warm', name: '종이', bg: '#f4f1e8', surf: '#fdfcf8', ac: '#1f5c4a' },
  { id: 'forest', name: '숲', bg: '#f0f4f1', surf: '#ffffff', ac: '#15803d' },
  { id: 'ocean', name: '바다', bg: '#eef3f6', surf: '#ffffff', ac: '#0e7490' },
  { id: 'lavender', name: '라벤더', bg: '#f3f1f8', surf: '#ffffff', ac: '#6d4fd8' },
  { id: 'ink', name: '먹', bg: '#f5f5f4', surf: '#ffffff', ac: '#18181b' },
];
const MODE_LABEL = { auto: '기기 따라', light: '밝게', dark: '어둡게' };
const SIZE_LABEL = { sm: '작게', md: '보통', lg: '크게', xl: '아주 크게' };

// ─────────── 줄 조각 ───────────

/** 설정 아이콘: 둥근 네모 + 흰 그림. 색은 과목 색처럼 디자인이 정한 밝기·채도 안에서 색상만 → 어느 디자인에도 어울림 */
const SET_ICONS = {
  display: 'M12 4V2.5M12 21.5V20M4 12H2.5M21.5 12H20M6.3 6.3 5.2 5.2M18.8 18.8l-1.1-1.1M6.3 17.7l-1.1 1.1M18.8 5.2l-1.1 1.1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  text: 'M4 18 9 6l5 12M5.8 14h6.4M15 13.5c0-1.6 1.2-2.5 2.8-2.5 1.7 0 2.7 1 2.7 2.6V18M20.5 15.6c-.6-.4-1.5-.6-2.4-.6-1.6 0-2.8.8-2.8 1.9 0 1 .8 1.6 2 1.6 1.4 0 2.6-.9 3.2-2',
  tabs: 'M3.5 6.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2zM3.5 15.5h17M8 18h.01M12 18h.01M16 18h.01',
  motion: 'M3 12c2.5-5 5-5 7.5 0s5 5 7.5 0M3 17c2.5-5 5-5 7.5 0s5 5 7.5 0',
  today: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4',
  progress: 'M5 19V12M10 19V8M15 19v-5M20 19V5',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  exam: 'M5 21V4M5 4h11l-2 4 2 4H5',
  books: 'M5 4.5h4v15H5zM10 4.5h4v15h-4zM15.2 5.3l3.8-1 3.1 14.6-3.8 1z',
  time: 'M7 3h10M7 21h10M8 3c0 4 4 5 4 9s-4 5-4 9M16 3c0 4-4 5-4 9s4 5 4 9',
  data: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  phone: 'M8 2.5h8a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2zM11 18.5h2',
  info: 'M12 11v6M12 7.5v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  user: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4.5 20c1.3-3.6 4.2-5.5 7.5-5.5s6.2 1.9 7.5 5.5',
};
const Tile = ({ k, h }) =>
  html`<span class="set-ic hue" style=${hue(h)} aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d=${SET_ICONS[k]} /></svg></span>`;

/** 한 줄: [아이콘] 이름 (작은 설명) ……… 지금 값 › */
function Row({ label, small, value, children, onClick, danger, warn, icon, h }) {
  const Tag = onClick ? 'button' : 'div';
  return html`<${Tag} class=${'set-row' + (danger ? ' danger' : '') + (icon ? ' has-ic' : '')} onClick=${onClick}>
    ${icon ? html`<${Tile} k=${icon} h=${h} />` : null}
    <span class="l"><b>${label}</b>${small ? html`<small class=${warn ? 'warn' : ''}>${small}</small>` : null}</span>
    ${value != null ? html`<span class="val">${value}</span>` : null}
    ${children}${onClick ? html`<${Icon} n="right" s=${18} />` : null}
  <//>`;
}

/** 위에 이름, 아래에 고르는 칸이 오는 줄 (고를 것이 많을 때) */
function Pick({ label, small, children }) {
  return html`<div class="set-row col">
    <span class="l"><b>${label}</b>${small ? html`<small>${small}</small>` : null}</span>
    ${children}
  </div>`;
}

function Group({ title, foot, children }) {
  return html`<div class="set-group">${title ? html`<h3>${title}</h3>` : null}<div class="set-list">${children}</div>${foot ? html`<p class="set-foot">${foot}</p>` : null}</div>`;
}

// ─────────── 기록 파일 ───────────

function exportFile() {
  const blob = new Blob([JSON.stringify(C.backupObject())], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = C.backupFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  try {
    localStorage.setItem(LAST_EXPORT, C.today());
  } catch {
    /* 저장 공간이 막힌 환경 */
  }
  toast('파일로 내보냈어요');
}

// 마지막으로 파일로 내보낸 날 (이 기기에서)
const LAST_EXPORT = ns('hoedok.lastExport');
function lastExport() {
  try {
    return localStorage.getItem(LAST_EXPORT);
  } catch {
    return null;
  }
}

async function pickBackup(e) {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const info = C.readBackup(await f.text());
    openSheet({ type: 'backup', info });
  } catch (err) {
    toast(err.message);
  }
}

/** 불러오기 확인: 무엇이 들어 있는지 보여 주고 바꾼다 (되돌리기 가능) */
export function BackupSheet({ info }) {
  if (!info) return null;
  const c = info.counts;
  const when = info.exportedAt ? new Date(info.exportedAt) : null;
  return html`<${Sheet} title="파일에서 불러오기" footer=${html`<button class="btn" onClick=${closeSheet}>취소</button><button class="btn pri" onClick=${() => {
    C.withUndo('파일의 기록으로 바꿨어요', () => C.applyBackup(info.obj));
    closeSheet();
  }}>이 파일로 바꾸기</button>`}>
    <p class="sub" style="margin:0 0 12px">${when ? `${when.getMonth() + 1}월 ${when.getDate()}일 ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}에 내보낸 파일이에요.` : ''}</p>
    <div class="kv"><span class="k">과목</span><span class="v num">${c.subjects}개</span></div>
    <div class="kv"><span class="k">할 일</span><span class="v num">${c.tasks}개</span></div>
    <div class="kv"><span class="k">지난 시험</span><span class="v num">${c.exams}개</span></div>
    <div class="kv"><span class="k">학기 성적</span><span class="v num">${c.semesters}개</span></div>
    <p class="hint">지금 이 기기의 기록이 파일 내용으로 바뀌어요. 바꾼 직후에는 되돌릴 수 있어요. 화면 설정은 그대로예요.</p>
  <//>`;
}

/** 예시 끝내기: 예시를 지우고 처음 화면으로. 서버로 보낼 것도 남기지 않는다 */
async function leaveDemo() {
  await wipeThisDevice();
  location.reload();
}

// ─────────── 첫 화면 ───────────

/** 맨 위 계정 카드 (애플 설정의 내 이름 칸처럼) */
function AccountCard({ nav }) {
  const s = useStore(syncState);
  const signed = !!s.user;
  const warn = needsAttention();
  return html`<div class="set-group"><div class="set-list">
    <button class="acct-card" onClick=${() => nav('account')}>
      <span class=${'avatar' + (signed ? ' on' : '')} aria-hidden="true">${signed ? s.user.email.slice(0, 1).toUpperCase() : html`<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d=${SET_ICONS.user} /></svg>`}</span>
      <span class="l"><b>${signed ? s.user.email : '로그인'}</b><small class=${warn ? 'warn' : ''}>${signed || warn ? syncSmall() : '기록과 설정을 휴대폰·태블릿끼리 맞춰요'}</small></span>
      <${Icon} n="right" s=${18} />
    </button>
  </div></div>`;
}

/** 설정 첫 화면 (베타 2.0): 실제로 바꿀 것만 — 계정 · 공부 · 화면 · 기록. 나머지는 좋은 기본값 */
function Root({ nav }) {
  const p = PR();
  const demo = C.isDemo();
  const ex = D().exam;
  const order = [1, 2, 3, 4, 5, 6, 0];
  const week = order.reduce((a, w) => a + (p.rest.includes(w) ? 0 : p.avail[w]), 0);
  const le = lastExport();
  const sch = D().school;
  const th = THEMES.find((t) => t.id === p.theme) || THEMES[0];
  return html`<div>
    ${demo
      ? html`<div class="set-group"><div class="set-list"><button class="set-row key" onClick=${leaveDemo}>
          <span class="l"><b>예시 끝내고 시작하기</b><small>예시를 지우고 처음 설정으로 가요</small></span><${Icon} n="right" s=${18} />
        </button></div></div>`
      : null}
    <${AccountCard} nav=${nav} />

    <${Group} title="공부">
      <${Row} icon="books" h=${72} label="학년과 과목" value=${sch ? `고${sch.grade} · ${sch.sem}학기` : `${D().subjects.length}과목`} onClick=${() => nav('school')} />
      <${Row} icon="exam" h=${340} label=${C.isGoal() ? '끝낼 날' : '시험'} value=${ex ? C.md(ex.date) : '안 정함'} onClick=${() => (ex ? nav('exam') : openSheet({ type: 'cycle', step: 'next' }))} />
      <${Row} icon="time" h=${300} label="공부 시간" value=${`주 ${minutes(week)}`} onClick=${() => nav('time')} />
      <${Row} icon="clock" h=${36} label="하루가 바뀌는 시각" value=${DAYSTART[p.dayStart] || '새벽 4시'} onClick=${() => nav('dayStart')} />
    <//>

    <${Group} title="화면">
      <${Row} icon="display" h=${214} label="테마" value=${`${th.name} · ${MODE_LABEL[p.mode]}`} onClick=${() => nav('theme')} />
      <${Row} icon="text" h=${236} label="글자 크기" value=${SIZE_LABEL[p.size]} onClick=${() => nav('text')} />
      <${Row} icon="motion" h=${182} label="움직임"><${Switch} label="움직임" on=${M.level() !== 'off'} onChange=${(v) => setPrefs({ motion: v ? 'normal' : 'off' })} /><//>
    <//>

    <${Group}>
      ${installable() ? html`<${Row} icon="phone" h=${204} label="홈 화면에 추가" onClick=${openInstall} />` : null}
      <${Row} icon="data" h=${226} label="기록 관리" value=${le ? `백업 ${C.md(le)}` : null} onClick=${() => nav('data')} />
      <${Row} icon="info" h=${226} label="정보" value=${APP_VERSION} onClick=${() => nav('about')} />
    <//>
    <p class="hint" style="text-align:center">로그인하면 설정도 기기끼리 맞춰져요.</p>
  </div>`;
}

const DAYSTART = { 0: '자정', 2: '새벽 2시', 4: '새벽 4시', 6: '새벽 6시' };

// ─────────── 화면 ───────────

/** 테마: 색 6가지(모양은 하나) + 밝기. 누르는 즉시 바뀐다 */
function ThemePage() {
  const p = PR();
  return html`<div>
    <${Group} title="색">
      <div class="set-row col">
        <div class="theme-grid" role="radiogroup" aria-label="테마">${THEMES.map((t) => html`<button key=${t.id} class="theme-pick" role="radio" aria-checked=${p.theme === t.id ? 'true' : 'false'} onClick=${() => setPrefs({ theme: t.id })}>
          <span class="tp-sw" style=${{ background: t.bg }}><i style=${{ background: t.surf }}></i><b style=${{ background: t.ac }}></b></span>
          <small>${t.name}</small>
        </button>`)}</div>
      </div>
    <//>
    <${Group} title="밝기">
      <div class="set-row col"><${Seg} label="밝기" value=${p.mode} onChange=${(v) => setPrefs({ mode: v })} options=${[['auto', '기기 따라'], ['light', '밝게'], ['dark', '어둡게']]} /></div>
    <//>
  </div>`;
}

function TextPage() {
  const p = PR();
  return html`<div>
    <${Group} title="글자 크기">
      <div class="set-row col">
        <div class="size-pick" role="radiogroup" aria-label="글자 크기">${['sm', 'md', 'lg', 'xl'].map((k, i) => html`<button key=${k} role="radio" aria-checked=${p.size === k ? 'true' : 'false'} onClick=${() => setPrefs({ size: k })}><span style=${{ fontSize: `${14 + i * 3}px` }}>가</span><small>${SIZE_LABEL[k]}</small></button>`)}</div>
      </div>
    <//>
    <${Group}>
      <${Row} label="굵은 글씨" small="글자를 한 단계 두껍게"><${Switch} label="굵은 글씨" on=${!!p.bold} onChange=${(v) => setPrefs({ bold: v })} /><//>
    <//>
  </div>`;
}

function DayStartPage() {
  const p = PR();
  return html`<div>
    <${Group} foot="밤늦게 공부해도 그날로 기록돼요. 예: 새벽 4시면 새벽 2시에 체크한 것도 어제 공부.">
      <div class="set-row col"><${Seg} label="하루가 바뀌는 시각" value=${p.dayStart} onChange=${(v) => setPrefs({ dayStart: v })} options=${[[0, '자정'], [2, '새벽 2시'], [4, '새벽 4시'], [6, '새벽 6시']]} /></div>
    <//>
  </div>`;
}

/** 학년과 과목: 학년·학기, 과목마다 교과서(출판사) — 바꾸면 단원이 바뀐다 */
function SchoolPage({ nav }) {
  const d = D();
  const sch = d.school || { grade: 1, sem: K.guessSem(C.today()), pubs: {} };
  const set = (patch) => {
    d.school = { ...sch, ...patch };
    commit();
  };
  const rec = K.recommend(sch.grade, sch.sem).filter((r) => !d.subjects.some((s) => s.name === r.name));
  const changePub = (s, pub) => {
    const b = s.books.find((x) => x.labels) || s.books[0];
    const u = K.units(s.name, sch.sem, pub);
    const name = (K.publishers(s.name).find((x) => x[0] === pub) || [])[1];
    C.withUndo(`${s.name} 교과서를 바꿨어요`, () => {
      if (b && b.labels) {
        C.setBookLabels(s, b, [...u.labels]);
        const [a, z] = K.scopeGuess(u.labels.length, d.exam ? d.exam.kind : 'mid');
        C.setBookRange(s, b, a, z);
        b.pace = u.pace;
        if (pub === 'other') delete b.pub;
        else b.pub = name;
      }
      d.school = { ...sch, pubs: { ...(sch.pubs || {}), [s.name]: pub } };
    });
  };
  return html`<div>
    <${Group} title="학년">
      <div class="set-row col"><${Seg} label="학년" value=${sch.grade} onChange=${(v) => set({ grade: v })} options=${K.GRADES} /></div>
      <div class="set-row col"><${Seg} label="학기" value=${sch.sem} onChange=${(v) => set({ sem: v })} options=${[[1, '1학기'], [2, '2학기']]} /></div>
    <//>
    <${Group} title="과목과 교과서" foot="교과서를 바꾸면 단원 칸이 바뀌어요. 채운 칸은 같은 이름의 단원으로 옮겨져요. 바꾼 뒤에는 진도 › … › 다시 나누기.">
      ${d.subjects.map((s) => {
        const pubs = K.publishers(s.name);
        const b = s.books.find((x) => x.labels);
        return html`<div class="set-row hue" key=${s.id} style=${hue(s.h)}>
          <span class="dot"></span>
          <span class="l"><b>${s.name}</b><small>${b ? `${b.pub || '교과서'} · 단원 ${b.labels.length}개` : s.books.length ? `교재 ${s.books.length}권` : '교재 없음'}</small></span>
          ${pubs.length > 1 && b
            ? html`<select class="input sel" aria-label=${s.name + ' 교과서'} value=${(sch.pubs || {})[s.name] || 'other'} onChange=${(e) => changePub(s, e.target.value)}>${pubs.map(([id, n]) => html`<option key=${id} value=${id}>${n}</option>`)}</select>`
            : null}
        </div>`;
      })}
      <${Row} label="과목 순서와 색" onClick=${() => nav('subjects')} />
    <//>
    ${rec.length
      ? html`<${Group} title=${`고${sch.grade} ${sch.sem}학기에 있는 과목`} foot="누르면 교과서 단원과 함께 넣어요.">
          <div class="set-row col"><div class="chips">${rec.map((r) => html`<button key=${r.name} class="chip hue" style=${hue(r.h)} onClick=${() => {
            const [a, z] = K.scopeGuess(K.units(r.name, sch.sem, 'other').labels.length, d.exam ? d.exam.kind : 'mid');
            C.withUndo(`${r.name} 과목을 넣었어요`, () => d.subjects.push(K.makeSubject({ ...r, pub: 'other', from: a, to: z }, sch.sem)));
          }}><span class="dot"></span>${r.name}</button>`)}</div></div>
        <//>`
      : null}
  </div>`;
}

function TodayViewPage() {
  const p = PR();
  const toggleShow = (k, on) => setPrefs({ show: { ...p.show, [k]: on } });
  return html`<div>
    <${Group} title="보는 방법" foot=${p.group === 'due' ? '마감일이 가까운 일부터. 마감이 없는 일은 뒤에 놓여요.' : p.group === 'time' ? '시작 시각을 적은 일부터 시각 순서로.' : '과목마다 묶어서 보여요. 과목 순서는 설정 › 학년과 과목에서.'}>
      <div class="set-row col"><${Seg} label="보는 방법" value=${p.group} onChange=${(v) => setPrefs({ group: v })} options=${[['subject', '과목별'], ['due', '마감순'], ['time', '시간순']]} /></div>
    <//>
    <${Group} title="끝낸 일">
      <div class="set-row col"><${Seg} label="끝낸 일" value=${C.doneMode()} onChange=${(v) => setPrefs({ doneMode: v, doneBottom: v === 'bottom' })} options=${[['stay', '그 자리에'], ['bottom', '아래로'], ['hide', '숨기기']]} /></div>
    <//>
    <${Group} title="위쪽">
      <${Row} label="시험 D-day"><${Switch} label="시험 D-day" on=${p.show.dday} onChange=${(v) => toggleShow('dday', v)} /><//>
      <${Row} label="오늘 요약 막대" small="몇 개, 몇 쪽 했는지"><${Switch} label="오늘 요약" on=${p.show.summary} onChange=${(v) => toggleShow('summary', v)} /><//>
    <//>
    <${Group} title="알림 줄" foot="그 상황일 때만 한 줄로 떠요.">
      <${Row} label="지난 날 못 끝낸 일"><${Switch} label="못 끝낸 일 알림" on=${p.show.overdue} onChange=${(v) => toggleShow('overdue', v)} /><//>
      <${Row} label="다가오는 마감" small=${`마감이 ${C.DUE_SOON}일 안인데 다른 날로 잡아 둔 일`}><${Switch} label="다가오는 마감 알림" on=${p.show.due !== false} onChange=${(v) => toggleShow('due', v)} /><//>
    <//>
  </div>`;
}

function ProgressViewPage() {
  const p = PR();
  return html`<div>
    <${Group} title="과목 줄의 숫자" foot="분량은 단위가 하나인 과목만 (쪽과 지문이 섞이면 퍼센트로).">
      <div class="set-row col"><${Seg} label="과목 줄의 숫자" value=${p.pctStyle || 'pct'} onChange=${(v) => setPrefs({ pctStyle: v })} options=${[['pct', '퍼센트 47%'], ['amount', '분량 56/120쪽']]} /></div>
    <//>
    <${Group} title="과목 화면">
      <${Row} label="가장 적게 본 곳 알려 주기" small="덜 본 단원·구간을 한 줄로"><${Switch} label="가장 적게 본 곳" on=${p.lowest} onChange=${(v) => setPrefs({ lowest: v })} /><//>
    <//>
  </div>`;
}

// ─────────── 공부 ───────────

function TimePage() {
  const p = PR();
  const order = [1, 2, 3, 4, 5, 6, 0];
  const total = order.reduce((a, w) => a + (p.rest.includes(w) ? 0 : p.avail[w]), 0);
  return html`<div>
    <p class="sub" style="margin:0 0 12px">학원 같은 고정 일정을 뺀, 혼자 공부할 수 있는 시간이에요. 날짜별로 나눌 때 시간이 긴 날에 더 많이 넣어요.</p>
    <${Group} foot=${`일주일 합계 ${minutes(total)}`}>
      ${order.map((w) => html`<div class="set-row" key=${w}>
        <span class="l"><b style=${w === 0 ? 'color:#c9473f' : w === 6 ? 'color:#3a64c8' : ''}>${WD[w]}요일</b>${p.rest.includes(w) ? html`<small>쉬는 날</small>` : null}</span>
        ${p.rest.includes(w)
          ? null
          : html`<${Stepper} label=${WD[w] + '요일 공부 가능 시간'} value=${p.avail[w]} fmtv=${(v) => (v ? minutes(v) : '없음')} onChange=${(v) => {
              const a = [...p.avail];
              a[w] = v;
              setPrefs({ avail: a });
            }} />`}
        <button class="btn sm quiet" onClick=${() => setPrefs({ rest: p.rest.includes(w) ? p.rest.filter((x) => x !== w) : [...p.rest, w] })}>${p.rest.includes(w) ? '공부하기' : '쉬기'}</button>
      </div>`)}
    <//>
    <${DayChanges} />
    <${Group} title="쪽당 걸리는 시간 (기본)" foot="오늘 화면의 예상 시간과 나누기에 써요. 교재마다 따로 바꿀 수 있어요 (과목 › … › 교재와 단계 고치기).">
      <div class="set-row col"><${Seg} label="쪽당 시간" value=${p.pace} onChange=${(v) => setPrefs({ pace: v })} options=${[[2, '2분'], [3, '3분'], [5, '5분'], [8, '8분']]} /></div>
    <//>
  </div>`;
}

/** 그날만 바꾼 공부 가능 시간 (학원 보충, 학교 행사, 여행…) */
function DayChanges() {
  const p = PR();
  const td = C.today();
  const [pick, setPick] = useState(C.addDays(td, 1));
  const list = Object.keys(p.dayMin || {}).filter((d) => d >= td).sort();
  return html`<${Group} title="날짜마다 바꾼 시간">
    ${list.map((d) => html`<div class="set-row" key=${d}>
      <span class="l"><b>${C.mdws(d)}</b><small>요일 기본 ${C.weekdayCap(d) ? minutes(C.weekdayCap(d)) : '쉬는 날'}</small></span>
      <${Stepper} label=${C.mdws(d) + ' 공부 가능 시간'} value=${C.capacity(d)} fmtv=${(v) => (v ? minutes(v) : '쉼')} onChange=${(v) => C.setDayCap(d, v)} />
      <button class="btn sm quiet" onClick=${() => C.setDayCap(d, null)}>되돌리기</button>
    </div>`)}
    <div class="set-row wrap">
      <span class="l"><b>날짜 하나 바꾸기</b><small>그날만 시간을 다르게. 다시 나눌 때 반영돼요</small></span>
      <${DateField} style="width:auto" value=${pick} min=${td} why="오늘이나 그 뒤의 날짜를 골라 주세요" label="바꿀 날짜" onCommit=${setPick} />
      <button class="btn sm" onClick=${() => C.setDayCap(pick, C.capacity(pick) ? 0 : 180)}>${C.capacity(pick) ? '이날 쉬기' : '이날 공부'}</button>
    </div>
  <//>`;
}

function ExamPage() {
  const ex = D().exam;
  if (!ex)
    return html`<div><p class="muted">지금 준비 중인 시험이 없어요.</p><button class="btn pri block" onClick=${() => openSheet({ type: 'cycle', step: 'next' })}>다음 시험이나 끝낼 날 정하기</button></div>`;
  const goal = C.isGoal(ex);
  return html`<div>
    <span class="label">이름</span>
    <input class="input" key=${'n' + ex.id} defaultValue=${ex.name} enterkeyhint="done" onChange=${(e) => {
      ex.name = e.target.value.trim() || ex.name;
      commit();
    }} />
    <span class="label">${goal ? '끝낼 날' : '시험 첫날'}</span>
    <${DateField} style="max-width:220px" value=${ex.date} min=${C.addDays(C.today(), 1)} why="오늘 뒤의 날짜를 골라 주세요" label=${goal ? '끝낼 날' : '시험 첫날'} onCommit=${(v) => {
      ex.date = v;
      commit();
    }} />
    <p class="hint">${C.mdws(ex.date)} · ${C.daysLeft()}일 남았어요. 날짜를 바꾼 뒤에는 진도 › … › 모든 과목 다시 나누기를 하면 새 날짜에 맞춰져요.</p>
    <div class="set-list" style="margin-top:22px">
      <${Row} label=${goal ? '이 기간 정리하기' : '이 시험 정리하기'} small=${goal ? '남은 할 일을 치우고 다음을 정해요' : '결과를 적고, 다음 시험을 준비해요. 시험 날이 되면 오늘 화면에도 떠요.'} onClick=${() => openSheet({ type: 'cycle' })} />
    </div>
  </div>`;
}

function SubjectsPage() {
  const subs = D().subjects;
  const move = (i, d) => {
    [subs[i], subs[i + d]] = [subs[i + d], subs[i]];
    commit();
  };
  return html`<div>
    <p class="sub" style="margin:0 0 12px">과목 순서는 오늘 화면에서 묶이는 순서예요. 색을 누르면 바꿀 수 있어요.</p>
    <${Group}>
      ${subs.map((s, i) => html`<div class="set-row hue" key=${s.id} style=${hue(s.h)}>
        <button class="swatch" style="width:28px;height:28px" aria-label=${s.name + ' 색 바꾸기'} onClick=${() => openSheet({ type: 'color', id: s.id })}></button>
        <span class="l"><b>${s.name}</b><small>${s.books.length ? `교재 ${s.books.length}권 · ${s.stages.length}단계 · ${C.unitsUsed(s).map((k) => C.unitDef(k).name).join('·') || '쪽'}` : '교재 없음'}</small></span>
        <button class="btn sm quiet" onClick=${() => C.openGradeSetup(s.id)}>성적 계산</button>
        <button class="mini-ib" aria-label="위로" disabled=${i === 0} onClick=${() => move(i, -1)}>↑</button>
        <button class="mini-ib" aria-label="아래로" disabled=${i === subs.length - 1} onClick=${() => move(i, 1)}>↓</button>
      </div>`)}
    <//>
    <button class="btn block" onClick=${() => openSheet({ type: 'addSubject' })}>+ 과목 추가</button>
  </div>`;
}

// ─────────── 기록 관리 · 정보 ───────────

function DataPage() {
  const [wipeAsk, setWipeAsk] = useState(false);
  const demo = C.isDemo();
  const le = lastExport();
  return html`<div>
    <${Group} foot="공부 기록 전체를 파일 하나로. 화면 설정과 사진은 빼고요. 로그인해 두면 계정에도 따로 맞춰져요.">
      <${Row} label="파일로 내보내기" small=${le ? `마지막 ${C.mdws(le)}` : '아직 안 했어요'} onClick=${exportFile} />
      <label class="set-row" style="cursor:pointer">
        <span class="l"><b>파일에서 불러오기</b><small>내보낸 파일로 지금 기록을 바꿔요</small></span><${Icon} n="right" s=${18} />
        <input type="file" accept="application/json,.json" style="display:none" onChange=${pickBackup} />
      </label>
    <//>
    ${demo
      ? null
      : html`<${Group}>
          <${Row}
            danger
            label=${wipeAsk ? '한 번 더 누르면 모두 지워져요' : '모든 기록 지우고 처음부터'}
            small=${wipeAsk ? '지운 직후에는 되돌릴 수 있어요' : syncState.get().user ? '과목·할 일·성적을 모두 지워요. 계정과 다른 기기에서도 지워져요' : '과목·할 일·성적을 모두 지워요. 먼저 파일로 내보내 두면 안전해요'}
            onClick=${() => {
              if (!wipeAsk) return setWipeAsk(true);
              C.withUndo('모든 기록을 지웠어요', () => C.resetAll());
              closeSheet();
            }}
          />
        <//>`}
  </div>`;
}

/** 정보: 버전, 이 앱이 하는 일, 쓰는 법 (짧게) */
function AboutPage() {
  const tips = [
    ['체크', '동그라미를 누르면 끝. 진도에 연결된 할 일은 진도 막대가 저절로 채워져요.'],
    ['밀기', '할 일을 오른쪽으로 밀면 끝, 왼쪽으로 밀면 내일로.'],
    ['일부만', "할 일을 누르고 '일부만 했어요' — 한 데까지만 골라요. 남은 건 내일로."],
    ['공부 기록', '진도 › 과목에서 한 단원·쪽을 바로 적을 수 있어요.'],
    ['막대 밀기', '아래 막대를 누른 채 옆으로 밀면 탭을 옮겨요.'],
    ['당겨 오기', '＋를 누르면 그 과목에서 다음에 잡혀 있는 것을 오늘로 당겨 올 수 있어요.'],
    ['다시 나누기', '밀린 게 많으면 오늘 › … › 남은 계획 다시 나누기. 시험 전날까지 다시 고르게 나눠요.'],
    ['되돌리기', "지우거나 옮긴 직후 아래 알림의 '되돌리기'를 누르면 돌아가요."],
  ];
  return html`<div>
    <div class="about-head">
      <img src="icons/icon-192.png" alt="" width="64" height="64" />
      <b>회독 플래너</b>
      <span>${APP_VERSION}${PREVIEW ? ' · 미리 보기' : ''} · ${APP_DATE}</span>
    </div>
    <p class="sub" style="text-align:center;margin:0 0 18px">공부할 양을 날짜별로 나눠 주고, 체크하면 진도가 저절로 채워지는 플래너예요. 예측이나 점수 매기기 없이, 한 것을 사실 그대로 보여 줘요.</p>
    <${Group} title="쓰는 법">
      ${tips.map(([k, v]) => html`<div class="set-row tip" key=${k}><span class="l"><b>${k}</b><small>${v}</small></span></div>`)}
    <//>
    <${Group} title="기록은 어디에" foot="베타 버전이에요. 쓰다가 이상한 곳이 있으면 알려 주세요.">
      <div class="set-row"><span class="l"><b>이 기기</b><small>인터넷이 없어도 저장되고 열려요</small></span></div>
      <div class="set-row"><span class="l"><b>계정</b><small>로그인하면 휴대폰과 태블릿이 같은 기록과 설정을 써요</small></span></div>
    <//>
  </div>`;
}

// [제목, 화면, 뒤로 갈 곳(없으면 설정 첫 화면)]
const PAGES = {
  school: ['학년과 과목', SchoolPage],
  subjects: ['과목 순서와 색', SubjectsPage, 'school'],
  exam: ['시험', ExamPage],
  time: ['공부 시간', TimePage],
  dayStart: ['하루가 바뀌는 시각', DayStartPage],
  theme: ['테마', ThemePage],
  text: ['글자 크기', TextPage],
  account: ['계정', AccountPage],
  data: ['기록 관리', DataPage],
  about: ['정보', AboutPage],
  // 오늘·진도의 … 메뉴에서 바로 여는 쪽
  todayView: ['오늘 화면', TodayViewPage],
  progressView: ['진도 화면', ProgressViewPage],
  views: ['오늘 화면', TodayViewPage],
  // 예전 이름
  display: ['테마', ThemePage],
};

/**
 * 설정 창 (아이폰 설정처럼): 안쪽으로 들어가면 새 쪽이 오른쪽에서 덮으며 들어오고, 뒤로 가면 지금 쪽이 오른쪽으로 걷힌다.
 * 뒤로 가면 앞 쪽은 보던 스크롤 자리 그대로.
 */
export function SettingsSheet({ page }) {
  const [cur, setCur] = useState(page || null);
  const P = cur && PAGES[cur];
  const up = P && P[2];
  const body = useRef(null);
  const job = useRef(null);
  const mem = useRef({}); // 쪽마다 마지막 스크롤 자리
  const go = (next, back = false) => {
    const sb = body.current && body.current.closest('.sheet-b');
    if (sb) mem.current[cur || ''] = sb.scrollTop;
    // 다시 그리기 전에 지금 쪽(창 안쪽 칸 통째)을 그 자리에 복사해 둔다
    job.current = { back, g: sb ? M.viewCapture(sb) : null, top: back ? mem.current[next || ''] || 0 : 0 };
    setCur(next);
  };
  useLayoutEffect(() => {
    const j = job.current;
    job.current = null;
    if (!j) return;
    const sb = body.current && body.current.closest('.sheet-b');
    if (!sb) return;
    sb.scrollTop = j.top; // 새 쪽은 맨 위부터, 뒤로 가면 보던 자리
    // 움직임 규칙 ② 다음으로: 옛 쪽이 먼저 흐려지고 새 쪽이 오른쪽(뒤로면 왼쪽)에서 들어온다. 창 안쪽 칸 자체를 움직인다
    M.axis(j.g, sb, j.back ? -1 : 1, '.set-page', 33);
  }, [cur]);
  return html`<${Sheet} title=${P ? P[0] : '설정'} tall>
    <div class="set-page" ref=${body}>
      ${P ? html`<button class="back" onClick=${() => go(up || null, true)}><${Icon} n="left" s=${20} />${up ? PAGES[up][0] : '설정'}</button>` : null}
      ${P ? html`<${P[1]} nav=${(n) => go(n)} />` : html`<${Root} nav=${(n) => go(n)} />`}
    </div>
  <//>`;
}
