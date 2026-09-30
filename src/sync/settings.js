// 동기화 서버 설정 (이 기기에만 저장). 앱에 기본값(src/config.js)이 있으면 그것을 먼저 쓴다.
const KEY = 'hoedok.sync.v1';

export function getSyncSettings() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function setSyncSettings(patch) {
  const v = { ...getSyncSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* 저장 공간이 막힌 환경 */
  }
  return v;
}
