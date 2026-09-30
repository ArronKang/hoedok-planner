// 진도 현황: 다가오는 시험마다 과목별 네 숫자
import { html } from '../../lib/html.js';
import { useToday } from '../../data/hooks.js';
import { upcomingExams } from '../../data/model.js';
import { ViewHeader, ViewBody } from '../common.js';
import { ExamFactsCard } from './facts.js';
import { Empty } from '../../ui/kit.js';

export function ProgressView({ nav, panel }) {
  const today = useToday();
  const list = upcomingExams(today);
  return html`<div class="view">
    <${ViewHeader} nav=${nav} panel=${panel} title="진도 현황" sub="판단 없이 사실 수치만 보여줍니다" />
    <${ViewBody}>
      ${list.length
        ? html`<div class="stack">${list.map((e) => html`<${ExamFactsCard} key=${e.id} exam=${e} today=${today} nav=${nav} />`)}</div>`
        : html`<${Empty} icon="target" title="다가오는 시험이 없습니다">시험·회독 화면에서 시험을 등록하면 과목별 진도 숫자가 여기에 나옵니다.<//>`}
    <//>
  </div>`;
}
