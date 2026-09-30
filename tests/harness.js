// 아주 작은 테스트 도구. 노드(tests/run-node.js)와 브라우저(tests/index.html) 양쪽에서 쓴다.

const tests = [];
let currentGroup = '';

export function group(name, fn) {
  const prev = currentGroup;
  currentGroup = prev ? `${prev} › ${name}` : name;
  fn();
  currentGroup = prev;
}

export function test(name, fn) {
  tests.push({ name: currentGroup ? `${currentGroup} › ${name}` : name, fn });
}

function fmt(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
  return true;
}

export function eq(actual, expected, msg = '') {
  if (!deepEqual(actual, expected)) {
    throw new Error(`${msg ? msg + ': ' : ''}expected ${fmt(expected)}, got ${fmt(actual)}`);
  }
}

export function approx(actual, expected, eps = 1e-9, msg = '') {
  if (typeof actual !== 'number' || Math.abs(actual - expected) > eps) {
    throw new Error(`${msg ? msg + ': ' : ''}expected ≈${expected}, got ${actual}`);
  }
}

export function ok(cond, msg = 'assertion failed') {
  if (!cond) throw new Error(msg);
}

export async function run(log, filter) {
  let pass = 0;
  let fail = 0;
  const failures = [];
  for (const t of tests) {
    if (filter && !t.name.includes(filter)) continue;
    try {
      await t.fn();
      pass++;
      log(`  ✓ ${t.name}`);
    } catch (e) {
      fail++;
      failures.push(t.name);
      log(`  ✗ ${t.name}\n      ${e && e.message ? e.message : e}`);
    }
  }
  log(`\n${pass} passed, ${fail} failed`);
  if (failures.length) log('FAILED:\n' + failures.map((f) => '  - ' + f).join('\n'));
  return { pass, fail };
}
