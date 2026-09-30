// 사진: 줄여서 이 기기(IndexedDB)에 저장하고, 사진 정보는 attachments 표에 둔다(동기화 때 서버로 올라감).
// 할 일에는 사진 id만 남긴다.
import { uid } from './core.js';
import { blobPut, blobDel, put, get, all, remove } from '../data/db.js';
import { loadAttachmentUrl } from '../data/attachments.js';

const MAX = 1600; // 긴 변 최대 픽셀 — 안내문 글자가 읽힐 정도
const QUALITY = 0.82;
const KEEP_DAYS = 3; // 빼 놓은 사진은 되돌리기에 대비해 며칠 두었다가 지운다

/** 사진 파일을 줄여서 저장하고 id를 돌려준다 */
export async function savePhoto(file) {
  const blob = await shrink(file);
  const id = 'ph' + uid();
  await blobPut(id, blob);
  put('attachments', { id, kind: 'photo', type: blob.type || 'image/jpeg', size: blob.size });
  return id;
}

/** 화면에 보일 주소. 이 기기에 없으면(다른 기기에서 넣은 사진) 서버에서 받아 온다 */
export function photoURL(id) {
  return loadAttachmentUrl(get('attachments', id) || { id });
}

/** 어느 할 일에도 없는 사진을 정리한다 (앱 시작 때) */
export async function gcPhotos(tasks) {
  const used = new Set();
  for (const t of tasks) for (const p of t.photos || []) used.add(p);
  const old = Date.now() - KEEP_DAYS * 86400000;
  for (const a of all('attachments')) {
    if (used.has(a.id) || (a.createdAt || 0) > old) continue;
    remove('attachments', a.id);
    try {
      await blobDel(a.id);
    } catch {
      /* 다음에 다시 */
    }
  }
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
