// 서버가 설정된 상태에서 처음 열었을 때: 로그인 또는 이 기기에서만 쓰기
import { html } from '../lib/html.js';
import { LoginForm } from './settings/account.js';
import { setDevice } from '../state/device.js';
import { APP_NAME } from '../config.js';

export function AuthScreen() {
  return html`<div class="onboarding">
    <div class="ob-inner">
      <div class="ob-step">
        <h1 style="margin-bottom:4px">${APP_NAME}</h1>
        <p class="sub">로그인하면 휴대폰과 태블릿이 같은 기록을 씁니다.</p>
        <div class="card card-pad" style="margin-top:16px"><${LoginForm} /></div>
        <button class="btn ghost block" style="margin-top:12px" onClick=${() => setDevice({ localOnly: true })}>로그인 없이 이 기기에서만 쓰기</button>
      </div>
    </div>
  </div>`;
}
