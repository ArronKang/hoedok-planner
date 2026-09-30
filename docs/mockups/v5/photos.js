// 사진: 줄여서 이 기기(IndexedDB)에 저장한다. 할 일에는 사진 id만 남긴다.
// 실제 앱에서는 같은 함수 이름으로 src/data/db.js의 blob 저장소를 쓴다.
import { uid } from './core.js';

const DB = 'hoedok-proto-photos';
const MAX = 1600; // 긴 변 최대 픽셀 — 안내문 글자가 읽힐 정도
const QUALITY = 0.82;

let dbp = null;
function db() {
  if (!dbp)
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('p');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('p', mode);
    const out = fn(t.objectStore('p'));
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
}

/** 사진 파일을 줄여서 저장하고 id를 돌려준다 */
export async function savePhoto(file) {
  const blob = await shrink(file);
  const id = 'ph' + uid();
  await tx('readwrite', (s) => s.put(blob, id));
  return id;
}

export async function deletePhoto(id) {
  urls.delete(id);
  await tx('readwrite', (s) => s.delete(id));
}

const urls = new Map();
/** 화면에 보일 주소 (한 번 만든 건 기억) */
export async function photoURL(id) {
  if (urls.has(id)) return urls.get(id);
  const blob = await tx('readonly', (s) => s.get(id));
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  urls.set(id, u);
  return u;
}

async function shrink(file) {
  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    bmp = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('사진을 읽을 수 없어요'));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = bmp.width, h = bmp.height;
  const k = Math.min(1, MAX / Math.max(w, h));
  if (k === 1 && file.size < 900 * 1024 && /jpeg|png|webp/.test(file.type)) return file;
  const c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', QUALITY));
}
