// 설정 › 앱 정보
import { html } from '../../lib/html.js';
import { APP_NAME, APP_VERSION } from '../../config.js';

export function AboutPage() {
  return html`<div class="about">
    <div class="card card-pad">
      <h3 style="margin:0">${APP_NAME} <span class="muted num" style="font-weight:500">${APP_VERSION}</span></h3>
      <p class="sub">계획을 세우고 → 실행하고 → 결과를 되돌아보는 공부 플래너입니다. 앱은 기록을 숫자와 그림으로 되돌려줄 뿐, 판단은 하지 않습니다.</p>
      <ul class="plain">
        <li>예측·추천 문구를 넣지 않습니다. 진도 현황은 남은 분량·남은 일수·일평균·필요 처리량을 나란히 보여주기만 합니다.</li>
        <li>연속 기록·배지·점수 같은 게임 요소가 없습니다.</li>
        <li>석차등급은 계산하지 않고 학교 확정값을 입력받습니다.</li>
      </ul>
    </div>
    <div class="section-title">열품타 연동</div>
    <div class="card card-pad">
      <p class="sub" style="margin:0">아직 연결하지 않았습니다. 열품타가 공식 API나 내보내기를 제공하는지 확인되면 붙일 예정입니다.</p>
    </div>
    <div class="section-title">저장 위치</div>
    <div class="card card-pad">
      <p class="sub" style="margin:0">기록은 이 기기(브라우저 저장소)에 먼저 저장되고, 로그인하면 서버에 동기화됩니다. 화면 배치·글자 크기 같은 설정은 기기마다 따로 저장됩니다.</p>
    </div>
  </div>`;
}
