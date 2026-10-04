// 동기화 상태 (화면 표시용)
import { createStore } from '../lib/ui.js';

export const syncState = createStore({
  configured: false, // 서버 주소/키가 있는지
  builtIn: false, // 서버 주소/키가 앱에 들어 있는지 (src/config.js) → 로그인 칸만 보인다
  user: null, // { id, email }
  status: 'idle', // idle | syncing | ok | offline | error | demo(예시를 보는 중이라 멈춤)
  error: null,
  lastSync: null, // 마지막으로 맞춘 때 (기기에 저장해 둠)
  pending: 0,
  lost: false, // 서버가 로그인을 끊었다 → 다시 로그인할 때까지 설정 단추에 점
  first: false, // 로그인한 뒤 아직 한 번도 못 맞춤
  firstDone: null, // { at, pulled: {표: 수}, pushed } — 로그인 뒤 처음 맞춘 결과 (한 줄 알림용)
});
