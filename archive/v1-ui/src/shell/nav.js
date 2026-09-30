// 패널/탭 안의 화면 스택. 활성 상태일 때만 안드로이드 뒤로 가기에 연결한다.
import { useState, useRef, useEffect } from '../lib/ui.js';
import { pushBack } from '../ui/back.js';
import { uid } from '../core/id.js';

export function useStack(initial, active = true) {
  const [stack, setStack] = useState(() => [{ ...initial, key: uid(8) }]);
  const releases = useRef([]);
  const activeRef = useRef(active);
  activeRef.current = active;

  const register = () => {
    releases.current.push(
      pushBack(() => {
        releases.current.pop();
        setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
      }),
    );
  };
  const releaseAll = () => {
    while (releases.current.length) releases.current.pop()();
  };

  // 활성/비활성 전환 시 history 항목을 맞춘다
  useEffect(() => {
    if (active) {
      const need = stack.length - 1 - releases.current.length;
      for (let i = 0; i < need; i++) register();
    } else releaseAll();
  }, [active]);
  useEffect(() => () => releaseAll(), []);

  const nav = {
    stack,
    top: stack[stack.length - 1],
    canPop: stack.length > 1,
    push(name, params = {}) {
      setStack((s) => [...s, { name, params, key: uid(8) }]);
      if (activeRef.current) register();
    },
    pop() {
      const r = releases.current.pop();
      if (r) r();
      setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    },
    replace(name, params = {}) {
      setStack((s) => [...s.slice(0, -1), { name, params, key: uid(8) }]);
    },
    reset(name, params = {}) {
      releaseAll();
      setStack([{ name, params, key: uid(8) }]);
    },
  };
  return nav;
}
