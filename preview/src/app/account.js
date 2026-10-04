// 계정 · 동기화: 로그인 → 두 기기가 같은 기록을 쓴다.
// 서버 주소·공개 키가 앱에 들어 있으면(src/config.js) 이메일·비밀번호만 보인다. 가입은 서버 관리 화면에서 한 번.
// 겉에는 드러내지 않고 설정 안에만 둔다. 문제가 있을 때만 설정 단추에 점이 찍힌다 (main.js).
import { html } from '../lib/html.js';
import { useState, useStore } from '../lib/ui.js';
import * as C from './core.js';
import { syncState } from '../sync/state.js';
import * as S from '../sync/sync.js';
import { getSyncSettings } from '../sync/settings.js';
import { PREVIEW } from '../env.js';
import { platform, isStandalone } from './pwa.js';

function ago(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function statusText(s) {
  if (s.status === 'demo') return '예시를 보는 동안은 맞추지 않아요';
  if (s.status === 'syncing') return s.first ? '계정 기록을 받아 오는 중…' : '맞추는 중…';
  if (s.status === 'offline') return `인터넷 없음${s.pending ? ` · 올릴 것 ${s.pending}개` : ''}`;
  if (s.status === 'error') return `맞추지 못했어요${s.lastSync ? ` · 마지막 ${ago(s.lastSync)}` : ''}`;
  if (s.lastSync) return `${ago(s.lastSync)} 맞춤`;
  return '로그인됨';
}

/** 설정 첫 화면 계정 카드의 작은 글씨 (큰 글씨가 이미 이메일이라 여기는 상태만) */
export function syncSmall() {
  const s = syncState.get();
  if (C.isDemo()) return '예시를 보는 동안은 맞추지 않아요';
  if (s.lost) return '로그인이 풀렸어요 · 다시 로그인해 주세요';
  if (!s.user) return PREVIEW ? '미리 보기 기록끼리만 맞춰요 · 실제 앱 기록과 따로' : '로그인하면 휴대폰과 태블릿이 같은 기록을 써요';
  return `기기끼리 맞춤 · ${statusText(s)}`;
}

const hasLocalData = () => C.D().onboarded || C.D().tasks.length > 0 || C.D().subjects.length > 0;

const Err = ({ msg }) => (msg ? html`<p class="hint err" role="alert">${msg}</p>` : null);

export function AccountPage() {
  const s = useStore(syncState);
  const [editServer, setEditServer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [note, setNote] = useState(null);
  const [ask, setAsk] = useState(null); // { kind, res }
  const [wipeAsk, setWipeAsk] = useState(false);
  const cfg = S.getConfig();
  const demo = C.isDemo();
  const askUser = (kind) => new Promise((res) => setAsk({ kind, res }));
  const answer = (v) => {
    const a = ask;
    setAsk(null);
    a.res(v);
  };
  const run = async (fn) => {
    setBusy(true);
    setMsg(null);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setMsg(S.humanError(e));
    }
    setBusy(false);
  };
  const space = PREVIEW ? html`<p class="hint">미리 보기는 같은 계정이어도 기록을 따로 맞춰요. 실제 앱의 기록을 받지도, 올리지도 않아요.</p>` : null;

  // 로그인 중에 묻는 것
  if (ask) {
    if (ask.kind === 'demo')
      return html`<div class="stack">
        <p class="sub" style="margin:0">지금 이 기기에는 <b>예시 기록</b>만 있어요. 예시는 지우고, 계정에 있는 기록을 받아 올게요. 예시가 계정에 섞이지 않아요.</p>
        <div class="btns"><button class="btn" onClick=${() => answer(false)}>취소</button><button class="btn pri" onClick=${() => answer(true)}>예시 지우고 로그인</button></div>
      </div>`;
    if (ask.kind === 'wipe')
      return html`<div class="stack">
        <p class="sub" style="margin:0">이 기기에는 <b>다른 계정</b>의 기록이 있어요. 이 계정으로 바꾸면 이 기기의 기록을 지우고, 계정에 있는 기록을 받아 와요.</p>
        <div class="btns"><button class="btn" onClick=${() => answer(false)}>취소</button><button class="btn danger" onClick=${() => answer(true)}>지우고 로그인</button></div>
      </div>`;
    return html`<div class="stack">
      <p class="sub" style="margin:0">이 기기에도 기록이 있어요. 어떻게 할까요?</p>
      <button class="rt" onClick=${() => answer('merge')}><b>이 기기 기록을 계정에 합치기</b><small>이 기기에서 처음 쓰기 시작했거나, 계정이 비어 있을 때</small></button>
      <button class="rt" onClick=${() => answer('replace')}><b>계정 기록만 쓰기</b><small>이 기기 기록은 지우고 계정에 있는 기록을 받아요. 다른 기기에서 쓰던 기록을 가져올 때</small></button>
      <button class="btn quiet" onClick=${() => answer(null)}>취소</button>
    </div>`;
  }

  // 1) 서버가 아직 연결 안 됨 (앱에 넣어 두지 않았을 때만)
  if (!cfg || editServer) {
    const cur = getSyncSettings();
    return html`<div>
      <p class="sub" style="margin:0 0 12px">동기화 서버가 아직 연결되지 않았어요. 서버(Supabase)의 <b>주소</b>와 <b>공개 키</b>를 한 번 넣으면, 그다음부터는 로그인만 하면 돼요. 만드는 법은 앱 폴더의 <b>docs/설치와-동기화.md</b>에 있어요.</p>
      ${space}
      <form onSubmit=${(e) => {
        e.preventDefault();
        const url = e.target.elements.url.value.trim();
        const key = e.target.elements.key.value.trim();
        if (!/^https?:\/\//.test(url) || !key) return setMsg('주소(https://…)와 키를 둘 다 넣어 주세요.');
        run(async () => {
          await S.reconfigure({ url, key });
          setEditServer(false);
        });
      }}>
        <span class="label">서버 주소 (Project URL)</span>
        <input class="input" name="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://xxxx.supabase.co" defaultValue=${cur.url || ''} />
        <span class="label">공개 키 (publishable · anon)</span>
        <input class="input" name="key" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="sb_publishable_… 또는 eyJ…" defaultValue=${cur.key || ''} />
        <p class="hint">이 두 값은 공개돼도 괜찮아요. 기록은 로그인한 본인만 읽고 쓸 수 있게 서버가 막아요. <b>secret · service_role</b> 키는 넣지 마세요.</p>
        <${Err} msg=${msg} />
        <div class="btns" style="margin-top:14px">${editServer ? html`<button type="button" class="btn" onClick=${() => setEditServer(false)}>취소</button>` : null}<button class="btn pri" type="submit" disabled=${busy}>저장</button></div>
      </form>
    </div>`;
  }

  // 2) 로그인 전
  if (!s.user) {
    const iosBrowser = platform() === 'ios' && !isStandalone();
    const submit = (kind) => (e) => {
      e && e.preventDefault && e.preventDefault();
      const f = document.getElementById('acct-form');
      const email = f.elements.email.value.trim();
      const pw = f.elements.pw.value;
      if (!email || !pw) return setMsg('이메일과 비밀번호를 넣어 주세요.');
      run(async () => {
        if (kind === 'up') {
          const r = await S.signUp(email, pw);
          if (r.needsConfirm) setNote('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 여기서 로그인해 주세요.');
          else C.toast('가입하고 로그인했어요');
          return;
        }
        const r = await S.signIn(email, pw, {
          confirmDemo: () => askUser('demo'),
          confirmWipe: () => askUser('wipe'),
          chooseNew: () => (hasLocalData() ? askUser('new') : Promise.resolve('merge')),
        });
        if (r.wiped) location.reload(); // 지운 자료가 화면에 남지 않게 새로 연다
        else C.toast('로그인했어요. 기록을 맞추는 중이에요');
      });
    };
    return html`<div>
      ${s.lost
        ? html`<p class="note-line warn">로그인이 풀렸어요. 같은 이메일로 다시 로그인하면 이어서 맞춰요. 이 기기 기록은 그대로예요.</p>`
        : html`<p class="sub" style="margin:0 0 12px">로그인하면 휴대폰과 태블릿이 같은 공부 기록을 써요. 화면 설정(디자인·글꼴·글자 크기)은 기기마다 따로예요.</p>`}
      ${demo ? html`<p class="note-line">지금은 예시를 보고 있어요. 로그인하면 예시는 지우고 계정의 기록을 받아 와요.</p>` : null}
      ${iosBrowser
        ? html`<p class="note-line">아이폰은 <b>홈 화면 아이콘으로 연 앱</b>에서 로그인해 주세요. Safari와 아이콘 앱은 기록이 따로예요. <button class="link" onClick=${() => C.openSheet({ type: 'install' })}>홈 화면에 추가하는 법</button></p>`
        : null}
      ${space}
      <form id="acct-form" onSubmit=${submit('in')}>
        <span class="label">이메일</span>
        <input class="input" name="email" type="email" autocomplete="username" inputmode="email" autocapitalize="off" spellcheck="false" />
        <span class="label">비밀번호</span>
        <input class="input" name="pw" type="password" autocomplete="current-password" />
        <${Err} msg=${msg} />
        ${note ? html`<p class="hint">${note}</p>` : null}
        <div class="btns" style="margin-top:16px">
          ${cfg.builtIn ? null : html`<button type="button" class="btn" disabled=${busy} onClick=${submit('up')}>처음이면 가입</button>`}
          <button type="submit" class=${'btn pri' + (cfg.builtIn ? ' block' : '')} disabled=${busy}>${busy ? '잠깐만요…' : '로그인'}</button>
        </div>
      </form>
      <details class="other-dev" style="margin-top:20px">
        <summary>비밀번호를 잊었어요</summary>
        ${cfg.builtIn
          ? html`<p class="hint">혼자 쓰는 계정이라 메일 대신 서버 관리 화면에서 바꿔요. supabase.com › 내 프로젝트 › <b>Authentication › Users</b>에서 계정을 누르고 새 비밀번호를 정한 뒤, 여기서 그 비밀번호로 로그인하세요.</p>`
          : html`<p class="hint">위 칸에 이메일을 넣고 아래를 누르면 비밀번호를 다시 정하는 메일을 보내요.</p>
              <button class="btn sm" disabled=${busy} onClick=${() => {
                const email = document.getElementById('acct-form').elements.email.value.trim();
                if (!email) return setMsg('비밀번호를 다시 정할 이메일을 위 칸에 넣어 주세요.');
                run(async () => {
                  await S.recoverPassword(email);
                  setNote('비밀번호를 다시 정하는 메일을 보냈어요.');
                });
              }}>메일 보내기</button>`}
      </details>
      ${cfg.builtIn ? null : html`<div class="set-list" style="margin-top:18px"><button class="set-row" onClick=${() => setEditServer(true)}><span class="l"><b>서버 설정 바꾸기</b><small>${cfg.url}</small></span></button></div>`}
    </div>`;
  }

  // 3) 로그인됨
  return html`<div>
    ${space}
    <div class="set-list">
      <div class="set-row"><span class="l"><b>계정</b><small>${s.user.email}</small></span></div>
      <div class="set-row"><span class="l"><b>상태</b><small class=${s.status === 'error' ? 'warn' : ''}>${statusText(s)}</small></span>
        <button class="btn sm" disabled=${s.status === 'syncing' || s.status === 'demo'} onClick=${() => S.syncNow({ full: true })}>지금 맞추기</button>
      </div>
      ${s.pending && s.status !== 'syncing' ? html`<div class="set-row"><span class="l"><b>아직 안 올린 변경</b><small>${s.pending}개 · 인터넷이 되면 저절로 올라가요</small></span></div>` : null}
    </div>
    ${s.status === 'error' && s.error ? html`<${Err} msg=${s.error} />` : null}
    <p class="hint">한 기기에서 체크하면 다른 기기에는 앱을 열 때와 켜 둔 동안 45초마다 맞춰져요. 두 기기에서 같은 것을 고치면 나중에 고친 쪽이 남아요. 화면 설정(디자인·글꼴·글자 크기)은 기기마다 따로예요.</p>
    <div class="set-list" style="margin-top:18px">
      <button class="set-row" onClick=${() => run(() => S.signOut())}><span class="l"><b>로그아웃</b><small>이 기기 기록은 그대로 둬요</small></span></button>
      <button class="set-row danger" onClick=${() => {
        if (!wipeAsk) return setWipeAsk(true);
        run(async () => {
          await S.signOut({ wipe: true });
          location.reload();
        });
      }}><span class="l"><b>${wipeAsk ? '한 번 더 누르면 지워져요' : '로그아웃하고 이 기기 기록 지우기'}</b><small>계정(서버)의 기록은 그대로예요</small></span></button>
    </div>
    <${Err} msg=${msg} />
  </div>`;
}
