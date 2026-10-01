// 미리 보기: 사용자가 올리기 전에 수정본을 먼저 써 보는 주소 (…/hoedok-planner/preview/).
// 같은 사이트라 저장 공간이 같으므로, 미리 보기는 모든 저장 이름 앞에 'preview.'를 붙여
// 실제 앱의 기록과 절대 섞이지 않게 한다. 동기화도 하지 않는다 (실제 계정 기록을 건드리지 않게).
// 만드는 법: python tools/preview.py "무엇을 바꿨나"
export const PREVIEW = typeof location !== 'undefined' && /\/preview\//.test(location.pathname);

/** 저장 이름 (IndexedDB 이름, localStorage 키, 탭끼리 알리는 채널) */
export const ns = (name) => (PREVIEW ? 'preview.' + name : name);

/** 미리 보기를 만든 때와 내용 (tools/preview.py가 index.html에 적어 둔다) */
export const previewLabel = () => (typeof document !== 'undefined' && document.documentElement.getAttribute('data-preview')) || '';
