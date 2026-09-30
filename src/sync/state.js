// 동기화 상태 (화면 표시용)
import { createStore } from '../lib/ui.js';

export const syncState = createStore({
  configured: false, // 서버 주소/키가 있는지
  user: null, // { id, email }
  status: 'idle', // idle | syncing | ok | offline | error
  error: null,
  lastSync: null,
  pending: 0,
});
