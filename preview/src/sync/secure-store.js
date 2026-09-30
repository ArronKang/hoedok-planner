// 로그인 토큰 저장: 평문으로 두지 않는다.
// 기기 안에서 만든 AES-GCM 키(내보낼 수 없는 키, IndexedDB에 보관)로 암호화해서 저장한다.
// 보안 컨텍스트(https/localhost)가 아니면 저장하지 않고 메모리에만 둔다.
import { kvGet, kvSet, kvDel } from '../data/db.js';

const KEY_NAME = 'secure:key';

function available() {
  return typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.encrypt === 'function';
}

async function getKey() {
  let key = await kvGet(KEY_NAME);
  if (!key) {
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await kvSet(KEY_NAME, key);
  }
  return key;
}

export async function saveSecret(name, value) {
  if (!available()) return false;
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  await kvSet('secret:' + name, { iv, ct });
  return true;
}

export async function loadSecret(name) {
  if (!available()) return null;
  const v = await kvGet('secret:' + name);
  if (!v) return null;
  try {
    const key = await getKey();
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: v.iv }, key, v.ct);
    return JSON.parse(new TextDecoder().decode(pt));
  } catch {
    return null;
  }
}

export async function deleteSecret(name) {
  await kvDel('secret:' + name);
}

export const SECURE_KV_KEYS = [KEY_NAME];
