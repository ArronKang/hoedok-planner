// 안드로이드 뒤로 가기(제스처/버튼)를 앱 안의 '닫기/뒤로'에 연결한다.
// 시트를 열거나 화면을 한 단계 들어갈 때 history에 항목을 쌓고, popstate가 오면 맨 위 처리기를 부른다.

const stack = [];
let seq = 0;
let ignore = 0;

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (ignore > 0) {
      ignore--;
      return;
    }
    const top = stack.pop();
    if (top) top.handler();
  });
}

/**
 * 뒤로 가기 처리기를 등록한다.
 * @returns release — 앱 안에서 직접 닫을 때 호출(쌓은 history 항목을 되돌린다)
 */
export function pushBack(handler) {
  const id = ++seq;
  stack.push({ id, handler });
  try {
    history.pushState({ bk: id }, '');
  } catch {
    /* 일부 환경에서 실패해도 무시 */
  }
  return () => {
    const i = stack.findIndex((s) => s.id === id);
    if (i === -1) return;
    stack.splice(i, 1);
    ignore++;
    history.back();
  };
}

export function backDepth() {
  return stack.length;
}
