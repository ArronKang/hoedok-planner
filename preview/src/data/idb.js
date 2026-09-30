// IndexedDB를 Promise로 쓰기 위한 최소 래퍼

export function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function openDB(name, version, upgrade) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    let wait = null;
    req.onupgradeneeded = (e) => upgrade(req.result, e.oldVersion, req.transaction);
    req.onsuccess = () => {
      clearTimeout(wait);
      resolve(req.result);
    };
    req.onerror = () => {
      clearTimeout(wait);
      reject(req.error);
    };
    // 새 버전으로 올릴 때 옛 버전 탭이 열려 있으면 잠깐 막힌다. 옛 탭은 스스로 닫히므로 조금 기다린다.
    req.onblocked = () => {
      clearTimeout(wait);
      wait = setTimeout(() => reject(new Error('데이터베이스가 다른 탭에서 사용 중입니다. 다른 탭을 닫고 다시 열어 주세요.')), 8000);
    };
  });
}

export function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
  });
}

export async function getAll(db, store) {
  const tx = db.transaction(store, 'readonly');
  return reqP(tx.objectStore(store).getAll());
}
