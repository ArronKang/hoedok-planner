import { html } from '../../lib/html.js';
import { ViewHeader, ViewBody } from '../common.js';

export function ExamDetail({ nav, panel }) {
  return html`<div class="view"><${ViewHeader} nav=${nav} panel=${panel} title="시험" /><${ViewBody}><p class="muted">준비 중</p><//></div>`;
}
