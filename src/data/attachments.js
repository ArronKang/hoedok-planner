// 첨부 이미지 불러오기: 이 기기(IndexedDB) → 없으면 서버에서 받아 저장
import { blobGet, blobPut } from './db.js';

const urls = new Map();
const inflight = new Map();
let remoteLoader = null;

/** 동기화 모듈이 서버 다운로드 함수를 등록한다: (att) => Promise<Blob|null> */
export function setRemoteLoader(fn) {
  remoteLoader = fn;
}

export function cachedUrl(id) {
  return urls.get(id) || null;
}

export function loadAttachmentUrl(att) {
  if (!att) return Promise.resolve(null);
  if (urls.has(att.id)) return Promise.resolve(urls.get(att.id));
  if (inflight.has(att.id)) return inflight.get(att.id);
  const p = (async () => {
    let blob = await blobGet(att.id);
    if (!blob && remoteLoader && att.uploaded) {
      try {
        blob = await remoteLoader(att);
        if (blob) await blobPut(att.id, blob);
      } catch {
        blob = null;
      }
    }
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urls.set(att.id, url);
    return url;
  })().finally(() => inflight.delete(att.id));
  inflight.set(att.id, p);
  return p;
}
