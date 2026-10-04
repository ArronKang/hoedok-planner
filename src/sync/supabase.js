// Supabase REST 최소 클라이언트 (라이브러리 없이 fetch만 사용)
//  - 인증: /auth/v1 (이메일+비밀번호)
//  - 데이터: /rest/v1 (records 테이블, sync_push 함수)
//  - 첨부: /storage/v1 (attachments 버킷)

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function msgOf(j, status) {
  return (j && (j.msg || j.error_description || j.message || j.error || j.hint)) || `HTTP ${status}`;
}

export function createClient({ url, key }) {
  const base = String(url || '').replace(/\/+$/, '');
  let session = null;
  let refreshing = null;
  const client = { session: null, onSession: null };

  const baseHeaders = () => {
    const h = { apikey: key };
    // 예전 형식(anon JWT) 키는 Authorization에도 넣어야 한다
    if (!session && key && key.startsWith('eyJ')) h.Authorization = 'Bearer ' + key;
    if (session) h.Authorization = 'Bearer ' + session.access_token;
    return h;
  };

  function setSession(s) {
    if (s && !s.expires_at && s.expires_in) s.expires_at = Math.floor(Date.now() / 1000) + s.expires_in;
    session = s || null;
    client.session = session;
    if (client.onSession) client.onSession(session);
  }

  async function authPost(path, body, withAuth = false) {
    const h = { apikey: key, 'Content-Type': 'application/json' };
    if (withAuth && session) h.Authorization = 'Bearer ' + session.access_token;
    const r = await fetch(base + path, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new ApiError(msgOf(j, r.status), r.status, j);
    return j;
  }

  async function refresh() {
    if (!session || !session.refresh_token) throw new ApiError('로그인이 필요합니다', 401);
    if (!refreshing) {
      refreshing = authPost('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token })
        .then((j) => {
          setSession(j);
          return j;
        })
        .finally(() => (refreshing = null));
    }
    return refreshing;
  }

  async function ensureFresh() {
    if (!session) throw new ApiError('로그인이 필요합니다', 401);
    const exp = (session.expires_at || 0) * 1000;
    if (exp - Date.now() < 90 * 1000) await refresh();
  }

  async function request(method, path, { body, headers = {}, raw = false, retry = true } = {}) {
    await ensureFresh();
    const h = { ...baseHeaders(), ...headers };
    if (body !== undefined && !(body instanceof Blob) && !h['Content-Type']) h['Content-Type'] = 'application/json';
    const r = await fetch(base + path, {
      method,
      headers: h,
      body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body),
    });
    if (r.status === 401 && retry) {
      await refresh();
      return request(method, path, { body, headers, raw, retry: false });
    }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new ApiError(msgOf(j, r.status), r.status, j);
    }
    if (raw) return r;
    if (r.status === 204) return null;
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }

  Object.assign(client, {
    setSession,
    async signIn(email, password) {
      const j = await authPost('/auth/v1/token?grant_type=password', { email, password });
      setSession(j);
      return j.user;
    },
    async signUp(email, password) {
      const j = await authPost('/auth/v1/signup', { email, password });
      if (j.access_token) {
        setSession(j);
        return { user: j.user, needsConfirm: false };
      }
      return { user: j.user || j, needsConfirm: true };
    },
    async recover(email) {
      await authPost('/auth/v1/recover', { email });
    },
    async signOut() {
      try {
        if (session) await authPost('/auth/v1/logout', {}, true);
      } catch {
        /* 서버 응답과 관계없이 이 기기에서는 로그아웃 */
      }
      setSession(null);
    },
    refresh,
    rpc(fn, args) {
      return request('POST', '/rest/v1/rpc/' + fn, { body: args });
    },
    /** prefix: 이 이름으로 시작하는 표만 / skip: 이 이름으로 시작하는 표는 빼고 (기록 공간 나누기, src/env.js) */
    selectRecords(afterRev, limit = 1000, { prefix = '', skip = '' } = {}) {
      const sp = prefix ? `&tbl=like.${encodeURIComponent(prefix)}*` : skip ? `&tbl=not.like.${encodeURIComponent(skip)}*` : '';
      return request('GET', `/rest/v1/records?select=tbl,id,data,deleted,client_updated_at,rev&rev=gt.${afterRev}${sp}&order=rev.asc&limit=${limit}`);
    },
    async upload(path, blob) {
      return request('POST', '/storage/v1/object/attachments/' + path, {
        body: blob,
        headers: { 'Content-Type': blob.type || 'application/octet-stream', 'x-upsert': 'true', 'cache-control': '3600' },
      });
    },
    async download(path) {
      const r = await request('GET', '/storage/v1/object/authenticated/attachments/' + path, { raw: true });
      return r.blob();
    },
    async removeObject(path) {
      return request('DELETE', '/storage/v1/object/attachments', { body: { prefixes: [path] } });
    },
  });
  return client;
}
