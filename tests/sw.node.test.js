// 서비스 워커 점검 (노드 전용: 파일을 직접 읽는다)
// - 앱이 불러오는 모든 파일이 미리 받기 목록(FILES)에 있어야 인터넷 없이 열린다.
// - VERSION이 파일 내용과 맞아야 설치된 앱이 새 버전을 받는다 (python tools/bump_sw.py).
import { test, eq, ok } from './harness.js';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => relative(ROOT, p).split('\\').join('/');
const swText = readFileSync(resolve(ROOT, 'sw.js'), 'utf8').replace(/\r\n/g, '\n');
const FILES = [...swText.match(/const FILES = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

function importsOf(file) {
  const src = readFileSync(resolve(ROOT, file), 'utf8');
  const out = [];
  for (const re of [/\bfrom\s*['"](\.[^'"]+)['"]/g, /\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g, /^\s*import\s*['"](\.[^'"]+)['"]/gm])
    for (const m of src.matchAll(re)) out.push(posix.normalize(posix.join(posix.dirname(file), m[1])));
  return out;
}
function graph(entry) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    stack.push(...importsOf(f));
  }
  return seen;
}

test('서비스 워커: 앱이 불러오는 파일이 모두 미리 받기 목록에 있다', () => {
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  const local = [...html.matchAll(/(?:href|src)="([^"#:]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith('http'));
  const need = new Set([...local, ...graph('src/app/main.js')]);
  const missing = [...need].filter((f) => !FILES.includes(f));
  eq(missing, []);
});

test('서비스 워커: 목록의 파일이 모두 있다', () => {
  const gone = FILES.filter((f) => f !== './' && !existsSync(resolve(ROOT, f)));
  eq(gone, []);
});

test('서비스 워커: VERSION이 파일 내용과 맞다 (틀리면 python tools/bump_sw.py)', () => {
  const h = createHash('sha256');
  for (const f of FILES) {
    if (f === './') continue;
    h.update(Buffer.concat([Buffer.from(f + '\0'), readFileSync(resolve(ROOT, f))]));
  }
  h.update(swText.replace(/const VERSION = '[^']*';/, ''));
  const want = h.digest('hex').slice(0, 12);
  const cur = swText.match(/const VERSION = '([^']*)';/)[1];
  eq(cur, want);
});

test('서비스 워커: 쓰지 않는 파일은 목록에 없다', () => {
  const used = graph('src/app/main.js');
  const extra = FILES.filter((f) => f.endsWith('.js') && !used.has(f));
  eq(extra, []);
  ok(true, rel(ROOT));
});
