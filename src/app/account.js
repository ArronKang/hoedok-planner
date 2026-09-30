// 계정 · 동기화: 서버(Supabase) 설정 → 로그인 → 두 기기가 같은 기록을 쓴다.
// 겉에는 드러내지 않고 설정 안에만 둔다. 동기화 상태는 여기서만 보인다.
import { html } from '../lib/html.js';
import { useState, useStore } from '../lib/ui.js';
import * as C from './core.js';
import { syncState } from '../sync/state.js';
import * as S from '../sync/sync.js';
import { getSyncSettings } from '../sync/settings.js';

function ago(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function statusText(s) {
  if (s.status === 'syncing') return '맞추는 중…';
  if (s.status === 'offline') return `인터넷 없음${s.pending ? ` · 올릴 것 ${s.pending}개` : ''}`;
  if (s.status === 'error') return '맞추지 못했어요';
  if (s.lastSync) return `${ago(s.lastSync)} 맞춤`;
  return '로그인됨';
}

/** 설정 첫 화면 '계정 · 동기화' 줄의 작은 글씨 */
export function syncSmall() {
  const s = syncState.get();
  if (!s.user) return '지금은 이 기기에만 저장 · 로그인하면 휴대폰과 태블릿이 같은 기록을 써요';
  return `${s.user.email} · ${statusText(s)}`;
}

const hasLocalData = () => C.D().onboarded || C.D().tasks.length > 0 || C.D().subjects.length > 0;

export function AccountPage() {
  const s = useStore(syncState);
  const [editServer, setEditServer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [ask, setAsk] = useState(null); // { kind, res }
  const [wipeAsk, setWipeAsk] = useState(false);
  const cfg = S.getConfig();
  const askUser = (kind) => new Promise((res) => setAsk({ kind, res }));
  const answer = (v) => {
    const a = ask;
    setAsk(null);
    a.res(v);
  };
  const run = async (fn) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(S.humanError(e));
    }
    setBusy(false);
  };

  // 로그인 중에 묻는 것
  if (ask) {
    return ask.kind === 'wipe'
      ? html`<div class="stack">
          <p class="sub" style="margin:0">이 기기에는 <b>다른 계정</b>의 기록이 있어요. 이 계정으로 바꾸면 이 기기의 기록을 지우고, 계정에 있는 기록을 받아 와요.</p>
          <div class="btns"><button class="btn" onClick=${() => answer(false)}>취소</button><button class="btn danger" onClick=${() => answer(true)}>지우고 로그인</button></div>
        </div>`
      : html`<div class="stack">
          <p class="sub" style="margin:0">이 기기에도 기록이 있어요. 어떻게 할까요?</p>
          <button class="rt" onClick=${() => answer('merge')}><b>이 기기 기록을 계정에 합치기</b><small>처음 로그인하는 기기거나, 계정이 비어 있을 때</small></button>
          <button class="rt" onClick=${() => answer('replace')}><b>계정 기록만 쓰기</b><small>이 기기 기록은 지우고 계정에 있는 기록을 받아요. 다른 기기에서 쓰던 기록을 가져올 때</small></button>
          <button class="btn quiet" onClick=${() => answer(null)}>취소</button>
        </div>`;
  }

  // 1) 서버 설정
  if (!cfg || editServer) {
    const cur = getSyncSettings();
    return html`<div>
      <p class="sub" style="margin:0 0 12px">두 기기에서 같은 기록을 쓰려면 기록을 맡아 둘 서버가 필요해요. Supabase 무료 프로젝트를 하나 만들고, 주소와 공개 키를 넣어 주세요. 만드는 법은 앱 폴더의 <b>docs/설치와-동기화.md</b>에 있어요.</p>
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
        <input class="input" name="url" inputmode="url" autocomplete="off" placeholder="https://xxxx.supabase.co" defaultValue=${cur.url || ''} />
        <span class="label">공개 키 (anon · publishable)</span>
        <input class="input" name="key" autocomplete="off" placeholder="eyJ… 또는 sb_publishable_…" defaultValue=${cur.key || ''} />
        <p class="hint">이 두 값은 공개돼도 괜찮은 값이에요. 기록은 로그인한 본인만 읽고 쓸 수 있게 서버에서 막아요.</p>
        ${msg ? html`<p class="hint" style="color:var(--flag)">${msg}</p>` : null}
        <div class="btns" style="margin-top:14px">${editServer ? html`<button type="button" class="btn" onClick=${() => setEditServer(false)}>취소</button>` : null}<button class="btn pri" type="submit" disabled=${busy}>저장</button></div>
      </form>
    </div>`;
  }

  // 2) 로그인 전
  if (!s.user) {
    const submit = (kind) => (e) => {
      e && e.preventDefault && e.preventDefault();
      const f = document.getElementById('acct-form');
      const email = f.elements.email.value.trim();
      const pw = f.elements.pw.value;
      if (!email || !pw) return setMsg('이메일과 비밀번호를 넣어 주세요.');
      run(async () => {
        if (kind === 'up') {
          const r = await S.signUp(email, pw);
          if (r.needsConfirm) setMsg('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 여기서 로그인해 주세요.');
          else C.toast('가입하고 로그인했어요');
          return;
        }
        const r = await S.signIn(email, pw, {
          confirmWipe: () => askUser('wipe'),
          chooseNew: () => (hasLocalData() ? askUser('new') : Promise.resolve('merge')),
        });
        if (r.wiped) location.reload(); // 지운 자료가 화면에 남지 않게 새로 연다
        else C.toast('로그인했어요. 기록을 맞추는 중이에요');
      });
    };
    return html`<div>
      <p class="sub" style="margin:0 0 12px">로그인하면 휴대폰과 태블릿이 같은 기록을 써요. 화면 설정(디자인·글자 크기)은 기기마다 따로예요.</p>
      <form id="acct-form" onSubmit=${submit('in')}>
        <span class="label">이메일</span>
        <input class="input" name="email" type="email" autocomplete="username" inputmode="email" />
        <span class="label">비밀번호 <span class="muted" style="font-weight:500">— 6자 이상</span></span>
        <input class="input" name="pw" type="password" autocomplete="current-password" />
        ${msg ? html`<p class="hint" style="color:var(--flag)">${msg}</p>` : null}
        <div class="btns" style="margin-top:16px">
          <button type="button" class="btn" disabled=${busy} onClick=${submit('up')}>처음이면 가입</button>
          <button type="submit" class="btn pri" disabled=${busy}>${busy ? '잠깐만요…' : '로그인'}</button>
        </div>
      </form>
      <div class="set-list" style="margin-top:22px">
        <button class="set-row" onClick=${() => {
          const email = document.getElementById('acct-form').elements.email.value.trim();
          if (!email) return setMsg('비밀번호를 다시 정할 이메일을 위 칸에 넣어 주세요.');
          run(async () => {
            await S.recoverPassword(email);
            setMsg('비밀번호를 다시 정하는 메일을 보냈어요.');
          });
        }}><span class="l"><b>비밀번호를 잊었어요</b></span></button>
        ${cfg.builtIn ? null : html`<button class="set-row" onClick=${() => setEditServer(true)}><span class="l"><b>서버 설정 바꾸기</b><small>${cfg.url}</small></span></button>`}
      </div>
    </div>`;
  }

  // 3) 로그인됨
  return html`<div>
    <div class="set-list">
      <div class="set-row"><span class="l"><b>계정</b><small>${s.user.email}</small></span></div>
      <div class="set-row"><span class="l"><b>상태</b><small>${statusText(s)}</small></span>
        <button class="btn sm" disabled=${s.status === 'syncing'} onClick=${() => S.syncNow({ full: true })}>지금 맞추기</button>
      </div>
      ${s.pending ? html`<div class="set-row"><span class="l"><b>아직 안 올린 변경</b><small>${s.pending}개 · 인터넷이 되면 저절로 올라가요</small></span></div>` : null}
    </div>
    ${s.error ? html`<p class="hint" style="color:var(--flag)">${s.error}</p>` : null}
    <p class="hint">한 기기에서 체크하면 다른 기기에는 앱을 열 때와 45초마다 맞춰져요. 두 기기에서 같은 것을 동시에 고치면 나중에 고친 쪽이 남아요.</p>
    <div class="set-list" style="margin-top:18px">
      <button class="set-row" onClick=${() => run(() => S.signOut())}><span class="l"><b>로그아웃</b><small>이 기기 기록은 그대로 둬요</small></span></button>
      <button class="set-row" onClick=${() => {
        if (!wipeAsk) return setWipeAsk(true);
        run(async () => {
          await S.signOut({ wipe: true });
          location.reload();
        });
      }}><span class="l"><b style="color:var(--flag)">${wipeAsk ? '한 번 더 누르면 지워져요' : '로그아웃하고 이 기기 기록 지우기'}</b><small>계정(서버)의 기록은 그대로예요</small></span></button>
    </div>
    ${msg ? html`<p class="hint" style="color:var(--flag)">${msg}</p>` : null}
  </div>`;
}
