// 동기화·글꼴 점검 (노드 전용: 서버 요청을 흉내 내고, css 파일을 직접 읽는다)
// 두 기기로 하는 점검은 docs/동기화-체크리스트.md (가짜 서버 tools/fake_supabase.py)
import { test, eq, ok } from './harness.js';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '../src/sync/supabase.js';
import { humanError } from '../src/sync/sync.js';
import { FONTS, fontById } from '../src/app/fonts.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

/** fetch를 흉내 내서 앱이 어떤 주소로 묻는지 본다 */
async function urlOf(fn) {
  const seen = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    seen.push(String(url));
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const c = createClient({ url: 'https://x.supabase.co', key: 'sb_publishable_test' });
    c.setSession({ access_token: 't', refresh_token: 'r', expires_in: 3600, user: { id: 'u1' } });
    await fn(c);
  } finally {
    globalThis.fetch = real;
  }
  return seen[0];
}

test('동기화: 실제 앱은 미리 보기 기록(preview:)을 받지 않는다', async () => {
  const u = await urlOf((c) => c.selectRecords(0, 1000, { skip: 'preview:' }));
  ok(u.includes('&tbl=not.like.preview%3A*'), u);
});

test('동기화: 미리 보기는 preview: 기록만 받는다', async () => {
  const u = await urlOf((c) => c.selectRecords(5, 1000, { prefix: 'preview:' }));
  ok(u.includes('&tbl=like.preview%3A*') && u.includes('rev=gt.5'), u);
});

test('동기화: 서버 오류를 알아듣는 말로', () => {
  eq(humanError({ message: 'Invalid login credentials', status: 400 }), '이메일이나 비밀번호가 맞지 않아요.');
  ok(humanError({ message: 'Signups not allowed for this instance', status: 422 }).includes('새 가입을 받지 않아요'));
  ok(humanError({ message: 'Invalid Refresh Token: Refresh Token Not Found', status: 400 }).includes('로그인이 풀렸어요'));
  ok(humanError({ message: 'Could not find the function public.sync_push', status: 404 }).includes('SQL'));
  ok(humanError({ message: 'upstream', status: 503 }).includes('잠시'));
  const net = new TypeError('Failed to fetch');
  ok(humanError(net).includes('인터넷'));
  // 영어가 그대로 나오지 않는다 (알 수 없는 오류도 한국어로 시작)
  for (const m of ['Invalid API key', 'Email not confirmed', 'Password should be at least 6 characters', 'rate limit exceeded'])
    ok(/[가-힣]/.test(humanError({ message: m, status: 400 })), m);
});

test('글꼴: 목록의 글꼴마다 화면 규칙(css)이 있고, 모르는 이름이면 기본 글꼴', () => {
  const css = read('styles/app.css');
  for (const f of FONTS) if (f.id !== 'pretendard') ok(css.includes(`.device[data-font='${f.id}']`), f.id + ' 규칙 없음');
  eq(fontById('없는글꼴').id, 'pretendard');
  eq(new Set(FONTS.map((f) => f.id)).size, FONTS.length, '아이디 겹침');
});

test('움직임: 사라지는 복사본의 이름(m-ghost)을 다른 화면 요소가 쓰지 않는다', () => {
  // 'ghost'가 단추 모양(.btn.ghost)과 겹쳐서 처음 화면 단추 둘이 눌리지 않던 일이 있었다
  ok(read('src/app/motion.js').includes("classList.add('m-ghost')"));
  ok(read('styles/app.css').includes('.m-ghost, .m-ghost * { pointer-events: none'));
  ok(!/^\s*\.ghost\s*[,{]/m.test(read('styles/app.css')), '.ghost 단독 규칙이 다시 생김');
  for (const f of readdirSync(resolve(ROOT, 'src/app')).filter((x) => x.endsWith('.js') && x !== 'motion.js'))
    ok(!read('src/app/' + f).includes('m-ghost'), f);
});
