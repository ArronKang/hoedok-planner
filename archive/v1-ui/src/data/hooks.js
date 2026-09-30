import { useState, useLayoutEffect, useStore } from '../lib/ui.js';
import { subscribe } from './db.js';
import { appState } from '../state/app.js';
import { today } from './model.js';

/** 저장소가 바뀌면 다시 그린다 */
export function useDB() {
  const [v, setV] = useState(0);
  useLayoutEffect(() => subscribe(() => setV((x) => x + 1)), []);
  return v;
}

/** 논리적 오늘 (하루 기준 시각 반영, 1분마다 갱신) */
export function useToday() {
  const now = useStore(appState, (s) => s.now);
  return today(now);
}

export function useSelectedDate() {
  const t = useToday();
  const sel = useStore(appState, (s) => s.selectedDate);
  return sel || t;
}
