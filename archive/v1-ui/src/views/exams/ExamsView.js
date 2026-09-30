// (임시) 시험 목록 — 2단계에서 완성
import { html } from '../../lib/html.js';
import { ViewHeader, ViewBody } from '../common.js';

export function ExamsView({ nav, panel }) {
  return html`<div class="view"><${ViewHeader} nav=${nav} panel=${panel} title="시험 · 회독" /><${ViewBody}><p class="muted">준비 중</p><//></div>`;
}
