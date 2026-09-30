// 앱 설정 — 배포 전에 한 번만 채우면 된다 (docs/설치와-동기화.md 참고)
//
// Supabase 프로젝트의 Project URL과 anon(public) 또는 publishable 키를 넣으면
// 두 기기 모두 앱 안에서 서버 주소를 따로 입력할 필요가 없다.
// 이 두 값은 공개되어도 되는 값이다 (데이터는 로그인한 본인만 읽고 쓸 수 있도록 서버 규칙으로 막는다).

export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

export const APP_NAME = '회독 플래너';
export const APP_VERSION = '1.0.0';
