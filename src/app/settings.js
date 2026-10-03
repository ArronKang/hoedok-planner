// 설정: 애플 설정처럼 — 맨 위에 계정, 그 아래 '화면'을 꾸미는 것들을 앞에, 공부 설정과 기록 관리는 그다음.
// 고를 수 있는 건 모두 미리 설계한 선택지 → 무엇을 골라도 보기 좋게. 고르는 즉시 화면에 보인다.
// 화면 설정은 이 기기에만, 공부 설정(공부 가능 시간 등)은 계정으로 기기끼리 맞춘다.
import { html } from '../lib/html.js';
import { useState, useRef, useLayoutEffect, useStore } from '../lib/ui.js';
import * as C from './core.js';
import { Icon, Sheet, Seg, Switch, Stepper, hue, DateField, canBuzz, glassBar } from './kit.js';
import { AccountPage, syncSmall } from './account.js';
import * as M from './motion.js';
import { ns, PREVIEW } from '../env.js';
import { FONTS, fontById, loadPreviews, previewFamily } from './fonts.js';
import { installable, openInstall, platform } from './pwa.js';
import { wipeThisDevice } from './store.js';
import { needsAttention } from '../sync/sync.js';
import { syncState } from '../sync/state.js';

const { D, PR, setPrefs, openSheet, closeSheet, commit, toast, minutes, WD } = C;

/** 이 앱의 버전 (설정 › 정보) */
export const APP_VERSION = '베타 1.0';
export const APP_DATE = '2026년 10월';

const THEMES = [
  { id: 'paper', name: '종이', desc: '따뜻한 종이와 잉크', sw: ['#f4f1e8', '#fdfcf8', '#1f5c4a', '#b8552b'] },
  { id: 'crisp', name: '선명', desc: '가는 선, 또렷한 숫자', sw: ['#fafaf9', '#ffffff', '#18181a', '#c0501a'] },
  { id: 'soft', name: '부드러움', desc: '넉넉한 여백, 둥근 모서리', sw: ['#f1f2f5', '#ffffff', '#3d5afe', '#e85d22'] },
];
/** 강조 색: '디자인 색'(디자인마다 정해 둔 색) + 고른 색. 밝기·채도는 디자인과 밝게·어둡게에 맞춰 미리 정해 두었다 (styles/app.css) */
export const ACCENTS = [
  ['theme', '디자인 색'],
  ['green', '초록'],
  ['teal', '청록'],
  ['blue', '파랑'],
  ['indigo', '남색'],
  ['purple', '보라'],
  ['rose', '분홍'],
  ['orange', '주황'],
  ['ink', '먹색'],
];
const MODE_LABEL = { auto: '기기 따라', light: '밝게', dark: '어둡게' };
const SIZE_LABEL = { sm: '작게', md: '보통', lg: '크게', xl: '아주 크게' };
const MOTION_LABEL = Object.fromEntries(M.LEVELS);
const GROUP_LABEL = { subject: '과목별', due: '마감순', time: '시간순' };

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
      <span class="l"><b>${signed ? s.user.email : '로그인'}</b><small class=${warn ? 'warn' : ''}>${signed || warn ? syncSmall() : '휴대폰과 태블릿이 같은 공부 기록을 쓰게 해요'}</small></span>
      <${Icon} n="right" s=${18} />
    </button>
  </div></div>`;
}

function Root({ nav }) {
  const p = PR();
  const theme = THEMES.find((t) => t.id === p.theme) || THEMES[0];
  const demo = C.isDemo();
  const ex = D().exam;
  const order = [1, 2, 3, 4, 5, 6, 0];
  const week = order.reduce((a, w) => a + (p.rest.includes(w) ? 0 : p.avail[w]), 0);
  const le = lastExport();
  return html`<div>
    ${demo
      ? html`<div class="set-group"><div class="set-list"><button class="set-row key" onClick=${leaveDemo}>
          <span class="l"><b>예시 끝내고 내 기록으로 시작</b><small>지금은 예시 기록이에요. 누르면 예시를 지우고 처음 설정으로 가요</small></span><${Icon} n="right" s=${18} />
        </button></div></div>`
      : null}
    <${AccountCard} nav=${nav} />

    <${Group}>
      <${Row} icon="display" h=${214} label="화면 및 밝기" value=${`${theme.name} · ${MODE_LABEL[p.mode]}`} onClick=${() => nav('display')} />
      <${Row} icon="text" h=${236} label="글자" value=${`${fontById(p.font).name} · ${SIZE_LABEL[p.size]}`} onClick=${() => nav('text')} />
      <${Row} icon="tabs" h=${262} label="탭 막대와 배치" value=${C.isPadDev() ? '태블릿' : glassBar() ? '유리' : '기본'} onClick=${() => nav('layout')} />
      <${Row} icon="motion" h=${182} label="움직임" value=${MOTION_LABEL[M.level()]} onClick=${() => nav('motion')} />
    <//>

    <${Group}>
      <${Row} icon="today" h=${14} label="오늘 화면" value=${GROUP_LABEL[p.group] || '과목별'} onClick=${() => nav('todayView')} />
      <${Row} icon="progress" h=${150} label="진도 화면" value=${p.pctStyle === 'amount' ? '분량' : '퍼센트'} onClick=${() => nav('progressView')} />
      <${Row} icon="clock" h=${36} label="달력과 시각" value=${`${p.weekStart === 1 ? '월' : '일'}요일부터 · ${p.clock === '12' ? '오전·오후' : '24시간'}`} onClick=${() => nav('calTime')} />
    <//>

    <${Group} title="공부">
      <${Row} icon="exam" h=${340} label=${C.isGoal() ? '끝낼 날' : '시험'} value=${ex ? C.md(ex.date) : '안 정함'} small=${ex ? ex.name : null} onClick=${() => (ex ? nav('exam') : openSheet({ type: 'cycle', step: 'next' }))} />
      <${Row} icon="books" h=${72} label="과목" value=${`${D().subjects.length}개`} onClick=${() => nav('subjects')} />
      <${Row} icon="time" h=${300} label="공부 가능 시간" value=${`주 ${minutes(week)}`} onClick=${() => nav('time')} />
    <//>

    <${Group}>
      ${installable() ? html`<${Row} icon="phone" h=${204} label="홈 화면에 앱으로 추가" small="아이콘을 눌러 앱처럼 열기 · 인터넷 없이도" onClick=${openInstall} />` : null}
      <${Row} icon="data" h=${226} label="기록 관리" value=${le ? `백업 ${C.md(le)}` : null} small=${le ? null : '파일로 내보내기 · 불러오기 · 지우기'} onClick=${() => nav('data')} />
      <${Row} icon="info" h=${226} label="정보" value=${APP_VERSION} onClick=${() => nav('about')} />
    <//>
  </div>`;
}

// ─────────── 화면 ───────────

/** 지금 화면 설정이 어떻게 보이는지 작은 견본 (디자인·강조 색·글꼴·글자 크기·굵기가 그대로 반영) */
function Sample() {
  return html`<div class="sample" aria-hidden="true">
    <div class="sample-row hue" style=${hue(14)}>
      <span class="check"><svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" class="ring" /><circle cx="13" cy="13" r="11" class="fill" /><path class="tick" d="M8 13.5l3.2 3.2L18 9.5" /></svg></span>
      <span class="tx"><b>1회독 · 자습서</b><small>p.31–40 · 10쪽</small></span>
      <span class="pct num">47%</span>
    </div>
    <div class="bar hue" style=${hue(14)}><span class="cell done" style="flex-grow:3;flex-basis:0"><i style="width:100%"></i></span><span class="cell doing" style="flex-grow:3;flex-basis:0"><i style="width:55%"></i></span><span class="cell todo" style="flex-grow:2;flex-basis:0"></span></div>
    <div class="sample-btns"><span class="btn pri sm">다 했어요</span><span class="chip" aria-pressed="true">과목별</span><span class="chip">마감순</span></div>
  </div>`;
}

function DisplayPage() {
  const p = PR();
  return html`<div>
    <${Sample} />
    <${Group} title="디자인" foot="셋 다 밝게·어둡게 모두 맞춰 두었어요.">
      <div class="set-row col">
        <div class="preview-themes">${THEMES.map((t) => html`<button key=${t.id} class="theme-card" aria-pressed=${p.theme === t.id ? 'true' : 'false'} onClick=${() => setPrefs({ theme: t.id })}>
          <span class="sw">${t.sw.map((c, i) => html`<i key=${i} style=${{ background: c }}></i>`)}</span>
          <b>${t.name}</b><small>${t.desc}</small>
        </button>`)}</div>
      </div>
    <//>
    <${Group} title="밝기">
      <div class="set-row col"><${Seg} label="밝기" value=${p.mode} onChange=${(v) => setPrefs({ mode: v })} options=${[['auto', '기기 따라'], ['light', '밝게'], ['dark', '어둡게']]} /></div>
    <//>
    <${Group} title="강조 색" foot="단추·고른 칸·지금 탭의 색이에요. 과목 색은 과목마다 따로 정해요.">
      <div class="set-row col">
        <div class="accents" role="radiogroup" aria-label="강조 색">${ACCENTS.map(([id, name]) => html`<button key=${id} class="accent-opt" data-a=${id} role="radio" aria-checked=${(p.accent || 'theme') === id ? 'true' : 'false'} onClick=${() => setPrefs({ accent: id })}><i></i><small>${name}</small></button>`)}</div>
      </div>
    <//>
    <p class="hint" style="text-align:center">화면 설정은 이 기기에만 저장돼요. 다른 기기는 따로 정해요.</p>
  </div>`;
}

function TextPage({ nav }) {
  const p = PR();
  return html`<div>
    <${Sample} />
    <${Group}>
      <${Row} label="글꼴" value=${fontById(p.font).name} onClick=${() => nav('font')} />
      <${Row} label="굵은 글씨" small="글자를 한 단계 두껍게"><${Switch} label="굵은 글씨" on=${!!p.bold} onChange=${(v) => setPrefs({ bold: v })} /><//>
    <//>
    <${Group} title="글자 크기">
      <div class="set-row col">
        <div class="size-pick" role="radiogroup" aria-label="글자 크기">${['sm', 'md', 'lg', 'xl'].map((k, i) => html`<button key=${k} role="radio" aria-checked=${p.size === k ? 'true' : 'false'} onClick=${() => setPrefs({ size: k })}><span style=${{ fontSize: `${14 + i * 3}px` }}>가</span><small>${SIZE_LABEL[k]}</small></button>`)}</div>
      </div>
    <//>
    <${Group} title="간격" foot="촘촘하면 한 화면에 더 많이, 넉넉하면 누르기 편하게.">
      <div class="set-row col"><${Seg} label="간격" value=${p.density} onChange=${(v) => setPrefs({ density: v })} options=${[['compact', '촘촘'], ['normal', '보통'], ['relaxed', '넉넉']]} /></div>
    <//>
  </div>`;
}

/**
 * 한글 글꼴: 이름과 설명을 각 글꼴로 보여 주고, 누르면 앱 전체가 바로 그 글꼴로 바뀐다.
 * 처음 쓰는 글꼴은 인터넷에서 받아 오는 동안 잠깐 기본 글꼴로 보인다.
 */
function FontPage() {
  const p = PR();
  const cur = fontById(p.font).id;
  loadPreviews();
  return html`<div>
    <p class="sub" style="margin:0 0 12px">누르면 바로 바뀌어요. 숫자 모양은 디자인마다 정해져 있어요.</p>
    <div class="set-list font-list" role="radiogroup" aria-label="글꼴">
      ${FONTS.map((f) => html`<button key=${f.id} class="set-row font-opt" role="radio" aria-checked=${cur === f.id ? 'true' : 'false'} onClick=${() => setPrefs({ font: f.id })}>
        <span class="l" style=${{ fontFamily: previewFamily(f) }}><b>${f.name}</b><small>${f.desc}</small></span>
        ${cur === f.id ? html`<${Icon} n="check" s=${18} />` : null}
      </button>`)}
    </div>
    <p class="hint" style="text-align:center">처음 고른 글꼴은 인터넷에서 받아 와요. 한 번 받으면 인터넷 없이도 보여요.</p>
  </div>`;
}

function LayoutPage() {
  const p = PR();
  const pad = C.isPadDev();
  const ios = platform() === 'ios';
  return html`<div>
    ${pad
      ? html`<${Group} title="태블릿 화면">
          <${Pick} label="오늘 옆에 보일 것"><${Seg} label="오늘 옆" value=${p.padAside} onChange=${(v) => setPrefs({ padAside: v })} options=${[['progress', '진도'], ['calendar', '달력'], ['none', '없음']]} /><//>
          <${Pick} label="목록 너비" small="진도·성적 왼쪽 칸"><${Seg} label="목록 너비" value=${p.listWidth} onChange=${(v) => setPrefs({ listWidth: v })} options=${[['narrow', '좁게'], ['normal', '보통'], ['wide', '넓게']]} /><//>
        <//>`
      : html`<${Group} title="아래 탭 막대" foot=${(p.tabStyle || 'auto') === 'auto' ? (ios ? '아이폰이라 유리 막대로 보여요.' : '이 기기는 기본 막대로 보여요. 아이폰에서는 유리 막대가 돼요.') : null}>
          <${Pick} label="모양" small="유리: 화면 위에 떠 있는 반투명 막대, ＋ 단추가 옆에 / 기본: 화면 아래에 붙은 막대">
            <${Seg} label="탭 막대 모양" value=${p.tabStyle || 'auto'} onChange=${(v) => setPrefs({ tabStyle: v })} options=${[['auto', '자동'], ['glass', '유리'], ['classic', '기본']]} />
          <//>
          ${!glassBar() ? html`<${Pick} label="＋ 단추 위치" small="오늘 화면, 쥐는 손 쪽으로"><${Seg} label="단추 위치" value=${p.hand} onChange=${(v) => setPrefs({ hand: v })} options=${[['left', '왼쪽'], ['right', '오른쪽']]} /><//>` : null}
        <//>`}
    <${Group}>
      <${Row} label="탭 이름 보이기" small="끄면 아이콘만"><${Switch} label="탭 이름 보이기" on=${p.tabLabels !== false} onChange=${(v) => setPrefs({ tabLabels: v })} /><//>
    <//>
    <${Group} title="앱을 열면">
      <div class="set-row col"><${Seg} label="앱을 열면" value=${p.startTab || 'today'} onChange=${(v) => setPrefs({ startTab: v, lastTab: C.UI().tab })} options=${[['today', '오늘'], ['progress', '진도'], ['grades', '성적'], ['last', '마지막 화면']]} /></div>
    <//>
  </div>`;
}

/** 움직임: 속도 하나 + 화면 옮길 때 하나 + 진동. 고르는 순간 아래 알림이 그 속도로 떠서 바로 느껴 볼 수 있다 */
function MotionPage() {
  const p = PR();
  const lv = M.level();
  const pick = (v) => {
    setPrefs({ motion: v });
    toast(v === 'off' ? '움직임을 껐어요' : `움직임: ${MOTION_LABEL[v]}`);
  };
  return html`<div>
    <${Group} title="움직이는 속도" foot=${p.motion == null && M.osReduce() ? "기기에서 '동작 줄이기'를 켜 두어서 꺼 두었어요. 여기서 고르면 그대로 따라요." : '창이 열리고 닫힐 때, 체크할 때 부드럽게 바뀌어요.'}>
      <div class="set-row col"><${Seg} label="움직이는 속도" value=${lv} onChange=${pick} options=${M.LEVELS} /></div>
    <//>
    ${lv !== 'off'
      ? html`<${Group}>
          <${Row} label="화면을 옮길 때도 부드럽게" small="탭을 옮기거나 과목·날짜를 바꿀 때 겹쳐 바뀌어요"><${Switch} label="화면을 옮길 때도 부드럽게" on=${p.motionView !== false} onChange=${(v) => setPrefs({ motionView: v })} /><//>
        <//>`
      : null}
    ${canBuzz()
      ? html`<${Group}>
          <${Row} label="체크할 때 진동" small="할 일을 끝낼 때 짧게"><${Switch} label="체크할 때 진동" on=${p.haptic !== false} onChange=${(v) => setPrefs({ haptic: v })} /><//>
        <//>`
      : null}
  </div>`;
}

function TodayViewPage() {
  const p = PR();
  const toggleShow = (k, on) => setPrefs({ show: { ...p.show, [k]: on } });
  return html`<div>
    <${Group} title="보는 방법" foot=${p.group === 'due' ? '마감일이 가까운 일부터. 마감이 없는 일은 뒤에 놓여요.' : p.group === 'time' ? '시작 시각을 적은 일부터 시각 순서로.' : '과목마다 묶어서 보여요. 과목 순서는 공부 › 과목에서.'}>
      <div class="set-row col"><${Seg} label="보는 방법" value=${p.group} onChange=${(v) => setPrefs({ group: v })} options=${[['subject', '과목별'], ['due', '마감순'], ['time', '시간순']]} /></div>
    <//>
    <${Group} title="끝낸 일">
      <div class="set-row col"><${Seg} label="끝낸 일" value=${C.doneMode()} onChange=${(v) => setPrefs({ doneMode: v, doneBottom: v === 'bottom' })} options=${[['stay', '그 자리에'], ['bottom', '아래로'], ['hide', '숨기기']]} /></div>
    <//>
    <${Group} title="위쪽">
      <${Row} label="시험 D-day"><${Switch} label="시험 D-day" on=${p.show.dday} onChange=${(v) => toggleShow('dday', v)} /><//>
      ${p.show.dday ? html`<${Pick} label="D-day 모양"><${Seg} label="D-day 모양" value=${p.ddayStyle || 'd'} onChange=${(v) => setPrefs({ ddayStyle: v })} options=${[['d', 'D-11'], ['days', '11일 남음']]} /><//>` : null}
      <${Row} label="오늘 요약 막대" small="몇 개, 몇 쪽 했는지"><${Switch} label="오늘 요약" on=${p.show.summary} onChange=${(v) => toggleShow('summary', v)} /><//>
    <//>
    <${Group} title="할 일 줄">
      <${Row} label="예상 시간" small="진도 할 일 아래에 '약 30분'"><${Switch} label="예상 시간" on=${!!p.rowEst} onChange=${(v) => setPrefs({ rowEst: v })} /><//>
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
      <${Row} label="진도 막대 아래 단계 이름"><${Switch} label="단계 이름" on=${p.legend} onChange=${(v) => setPrefs({ legend: v })} /><//>
      <${Row} label="가장 적게 본 곳 알려 주기" small="덜 본 구간·칸을 한 줄로"><${Switch} label="가장 적게 본 곳" on=${p.lowest} onChange=${(v) => setPrefs({ lowest: v })} /><//>
      <${Row} label="최근 2주 기록" small="기록 더 보기 안에"><${Switch} label="최근 2주" on=${p.recent} onChange=${(v) => setPrefs({ recent: v })} /><//>
    <//>
  </div>`;
}

function CalTimePage() {
  const p = PR();
  return html`<div>
    <${Group} title="달력 첫 요일">
      <div class="set-row col"><${Seg} label="달력 첫 요일" value=${p.weekStart === 1 ? 1 : 0} onChange=${(v) => setPrefs({ weekStart: v })} options=${[[0, '일요일'], [1, '월요일']]} /></div>
    <//>
    <${Group} title="시각 표시" foot="할 일의 시작 시각에 써요.">
      <div class="set-row col"><${Seg} label="시각 표시" value=${p.clock === '12' ? '12' : '24'} onChange=${(v) => setPrefs({ clock: v })} options=${[['24', '24시간 · 21:00'], ['12', '오전·오후 · 오후 9:00']]} /></div>
    <//>
    <${Group} title="하루가 바뀌는 시각" foot="밤늦게 공부해도 그날로 기록되도록. 기기끼리 같이 써요.">
      <div class="set-row col"><${Seg} label="하루 시작" value=${p.dayStart} onChange=${(v) => setPrefs({ dayStart: v })} options=${[[0, '자정'], [2, '새벽 2시'], [4, '새벽 4시'], [6, '새벽 6시']]} /></div>
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
    ['일부만', "할 일을 누르고 '일부만 했어요' — 쪽은 어디까지, 칸 교재는 한 칸만 골라요. 남은 건 내일로."],
    ['칸 채우기', '지문·문제·단원으로 세는 교재는 진도 › 과목에서 칸을 눌러 채워요.'],
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
      <div class="set-row"><span class="l"><b>계정</b><small>로그인하면 휴대폰과 태블릿이 같은 기록을 써요. 화면 설정은 기기마다 따로</small></span></div>
    <//>
  </div>`;
}

// [제목, 화면, 뒤로 갈 곳(없으면 설정 첫 화면)]
const PAGES = {
  display: ['화면 및 밝기', DisplayPage],
  text: ['글자', TextPage],
  font: ['글꼴', FontPage, 'text'],
  layout: ['탭 막대와 배치', LayoutPage],
  motion: ['움직임', MotionPage],
  todayView: ['오늘 화면', TodayViewPage],
  progressView: ['진도 화면', ProgressViewPage],
  calTime: ['달력과 시각', CalTimePage],
  time: ['공부 가능 시간', TimePage],
  exam: ['시험', ExamPage],
  subjects: ['과목', SubjectsPage],
  account: ['계정 · 동기화', AccountPage],
  data: ['기록 관리', DataPage],
  about: ['정보', AboutPage],
  // 예전 이름 (다른 화면에서 바로 열 때)
  views: ['오늘 화면', TodayViewPage],
};

/** 설정 창: 안쪽으로 들어가면 오른쪽에서 밀려 들어오고, 뒤로 가면 왼쪽에서 (아이폰 설정처럼) */
export function SettingsSheet({ page }) {
  const [cur, setCur] = useState(page || null);
  const P = cur && PAGES[cur];
  const up = P && P[2];
  const body = useRef(null);
  const dir = useRef(0);
  const ghost = useRef(null);
  const go = (next, back = false) => {
    dir.current = back ? -1 : 1;
    // 창 안쪽(스크롤 칸)을 통째로 복사해 그 자리에 두고, 그 안의 옛 쪽만 밀려 나간다 → 창 밖으로 삐져나오지 않는다
    const sc = body.current && body.current.closest('.sheet-b');
    ghost.current = M.viewOn() && sc ? M.capture(sc, true) : null;
    if (sc) sc.scrollTop = 0; // 새 쪽은 맨 위부터
    setCur(next);
  };
  useLayoutEffect(() => {
    const d = dir.current;
    dir.current = 0;
    const g = ghost.current;
    ghost.current = null;
    if (!d || !M.viewOn()) return;
    if (g) M.release(g, [['.set-page', [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-d * 28}%)` }]]], 260, 33, M.EASE_OUT);
    M.play(body.current, [{ opacity: 0, transform: `translateX(${d * 36}%)` }, { opacity: 1, transform: 'translateX(0)' }], 300, M.EASE_SHEET);
  }, [cur]);
  return html`<${Sheet} title=${P ? P[0] : '설정'} tall>
    <div class="set-page" ref=${body}>
      ${P ? html`<button class="back" onClick=${() => go(up || null, true)}><${Icon} n="left" s=${20} />${up ? PAGES[up][0] : '설정'}</button>` : null}
      ${P ? html`<${P[1]} nav=${(n) => go(n)} />` : html`<${Root} nav=${(n) => go(n)} />`}
    </div>
  <//>`;
}
