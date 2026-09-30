// 설정 › 계정 · 동기화
import { html } from '../../lib/html.js';
import { useState, useStore } from '../../lib/ui.js';
import { Icon } from '../../ui/icons.js';
import { Field, Toggle } from '../../ui/kit.js';
import { confirmDialog } from '../../ui/overlay.js';
import { toast } from '../../ui/toast.js';
import { syncState } from '../../sync/state.js';
import { getConfig, reconfigure, signIn, signUp, signOut, syncNow, humanError, recoverPassword } from '../../sync/sync.js';
import { device, setDevice } from '../../state/device.js';
import { pendingCount } from '../../data/db.js';

function timeAgo(ts) {
  if (!ts) return '아직 없음';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return new Date(ts).toLocaleString('ko-KR');
}

export function ServerForm({ onSaved }) {
  const cfg = getConfig();
  const [url, setUrl] = useState((cfg && cfg.url) || '');
  const [key, setKey] = useState((cfg && cfg.key) || '');
  const [busy, setBusy] = useState(false);
  if (cfg && cfg.builtIn) return html`<p class="sub">서버 주소가 앱에 들어 있습니다 (src/config.js).</p>`;
  const save = async (e) => {
    e.preventDefault();
    const u = url.trim().replace(/\/+$/, '');
    if (!/^https:\/\/.+/.test(u) || !key.trim()) {
      toast('https://로 시작하는 Project URL과 키를 모두 입력하세요');
      return;
    }
    setBusy(true);
    try {
      await reconfigure({ url: u, key: key.trim() });
      toast('서버 설정을 저장했습니다');
      onSaved && onSaved();
    } finally {
      setBusy(false);
    }
  };
  return html`<form onSubmit=${save}>
    <${Field} label="Supabase Project URL">
      <input class="input" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://xxxx.supabase.co" value=${url} onInput=${(e) => setUrl(e.target.value)} />
    <//>
    <${Field} label="anon(public) 키 또는 publishable 키" hint="공개돼도 되는 키입니다. service_role 키는 넣지 마세요.">
      <input class="input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="eyJ… 또는 sb_publishable_…" value=${key} onInput=${(e) => setKey(e.target.value)} />
    <//>
    <button class="btn primary block" style="margin-top:14px" type="submit" disabled=${busy}>서버 설정 저장</button>
  </form>`;
}

export function LoginForm({ onDone }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const run = async (mode) => {
    if (!email.trim() || (mode !== 'recover' && !pw)) {
      setMsg({ err: true, text: mode === 'recover' ? '이메일을 입력하세요' : '이메일과 비밀번호를 입력하세요' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'in') {
        await signIn(email, pw, {
          confirmWipe: () =>
            confirmDialog({
              title: '다른 계정의 데이터가 있습니다',
              message: '이 기기에는 다른 계정으로 쓰던 데이터가 남아 있습니다. 이 기기의 데이터를 지우고 새 계정의 데이터를 받을까요? (그 계정의 서버 데이터는 지워지지 않습니다)',
              confirm: '지우고 로그인',
              danger: true,
            }),
        });
        toast('로그인했습니다. 동기화를 시작합니다');
        onDone && onDone();
      } else if (mode === 'up') {
        const r = await signUp(email, pw);
        if (r.needsConfirm) setMsg({ text: '가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 여기서 로그인하세요.' });
        else {
          toast('가입하고 로그인했습니다');
          onDone && onDone();
        }
      } else {
        await recoverPassword(email);
        setMsg({ text: '비밀번호 재설정 메일을 보냈습니다.' });
      }
    } catch (e) {
      setMsg({ err: true, text: humanError(e) });
    } finally {
      setBusy(false);
    }
  };
  return html`<form onSubmit=${(e) => {
    e.preventDefault();
    run('in');
  }}>
    <${Field} label="이메일"><input class="input" type="email" autocomplete="email" autocapitalize="off" value=${email} onInput=${(e) => setEmail(e.target.value)} /><//>
    <${Field} label="비밀번호" hint="6자 이상"><input class="input" type="password" autocomplete="current-password" value=${pw} onInput=${(e) => setPw(e.target.value)} /><//>
    ${msg ? html`<p class=${msg.err ? 'form-msg err' : 'form-msg'} role="alert">${msg.text}</p>` : null}
    <div class="hstack" style="margin-top:14px">
      <button class="btn grow" type="button" disabled=${busy} onClick=${() => run('up')}>새로 가입</button>
      <button class="btn primary grow" type="submit" disabled=${busy}>${busy ? '처리 중…' : '로그인'}</button>
    </div>
    <button class="btn ghost block" type="button" style="margin-top:6px" disabled=${busy} onClick=${() => run('recover')}>비밀번호를 잊었어요</button>
  </form>`;
}

const STATUS = { idle: '대기', syncing: '동기화 중…', ok: '동기화됨', offline: '오프라인 — 연결되면 올립니다', error: '오류' };

export function AccountPage() {
  const st = useStore(syncState);
  const dev = useStore(device);
  const cfg = getConfig();
  const [showServer, setShowServer] = useState(!cfg);

  return html`<div>
    ${!cfg
      ? html`<div class="card card-pad">
          <h4 style="margin:0 0 6px">두 기기에서 같은 데이터를 쓰려면</h4>
          <p class="sub" style="margin:0 0 12px">무료 Supabase 프로젝트를 하나 만들고 주소와 키를 넣어 주세요. 방법은 앱 폴더의 <b>docs/설치와-동기화.md</b>에 있습니다. 설정 전에도 이 기기 안에서는 모든 기능을 쓸 수 있습니다.</p>
          <${ServerForm} />
        </div>`
      : st.user
        ? html`<div class="card list">
            <div class="list-row"><${Icon} name="user" /><span class="label ellipsis">${st.user.email}</span></div>
            <div class="list-row">
              <${Icon} name=${st.status === 'offline' ? 'cloud-off' : 'cloud'} />
              <span class="label">${STATUS[st.status] || st.status}<small class="row-sub">마지막 동기화: ${timeAgo(st.lastSync)} · 올릴 변경 ${st.pending || pendingCount()}건</small></span>
            </div>
            ${st.error ? html`<div class="list-row"><span class="label form-msg err" style="margin:0">${st.error}</span></div>` : null}
          </div>
          <div class="hstack wrap" style="margin-top:12px">
            <button class="btn primary" onClick=${async () => {
              const ok = await syncNow();
              toast(ok ? '동기화했습니다' : syncState.get().error || '지금은 동기화할 수 없습니다');
            }}><${Icon} name="sync" size=${18} />지금 동기화</button>
            <button class="btn" onClick=${async () => {
              const ok = await syncNow({ full: true });
              toast(ok ? '서버의 모든 데이터를 다시 받았습니다' : syncState.get().error || '실패했습니다');
            }}>전체 다시 받기</button>
          </div>
          <div class="section-title">로그아웃</div>
          <div class="hstack wrap">
            <button class="btn" onClick=${async () => {
              await signOut({ wipe: false });
              toast('로그아웃했습니다. 이 기기의 데이터는 남아 있습니다');
            }}><${Icon} name="logout" size=${18} />로그아웃</button>
            <button class="btn danger" onClick=${async () => {
              const ok = await confirmDialog({ title: '로그아웃하고 이 기기 데이터 지우기', message: '서버에 올라간 데이터는 남습니다. 올리지 못한 변경이 있으면 사라집니다.', confirm: '지우기', danger: true });
              if (ok) {
                await signOut({ wipe: true });
                toast('로그아웃하고 이 기기의 데이터를 지웠습니다');
              }
            }}>로그아웃 + 이 기기 데이터 지우기</button>
          </div>`
        : html`<div class="card card-pad">
            <p class="sub" style="margin:0 0 12px">로그인하면 이 기기의 기록이 서버에 올라가고, 같은 계정으로 로그인한 다른 기기와 공유됩니다. 화면 배치 같은 기기별 설정은 공유되지 않습니다.</p>
            <${LoginForm} />
          </div>
          <div class="card list" style="margin-top:var(--gap)">
            <div class="list-row">
              <span class="label">로그인 없이 이 기기에서만 쓰기<small class="row-sub">시작 화면에서 로그인을 묻지 않습니다</small></span>
              <${Toggle} label="이 기기에서만 쓰기" checked=${!!dev.localOnly} onChange=${(v) => setDevice({ localOnly: v })} />
            </div>
          </div>`}
    ${cfg && !cfg.builtIn
      ? html`<div class="section-title">
            <button class="btn ghost sm" onClick=${() => setShowServer(!showServer)}>${showServer ? '서버 설정 닫기' : '서버 설정 바꾸기'}</button>
          </div>
          ${showServer ? html`<div class="card card-pad"><${ServerForm} onSaved=${() => setShowServer(false)} /></div>` : null}`
      : null}
  </div>`;
}
