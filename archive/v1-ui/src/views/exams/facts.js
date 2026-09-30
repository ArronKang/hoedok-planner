// 진도 현황 숫자 (예측 아님 — 네 숫자를 나란히 보여주기만 한다)
import { html } from '../../lib/html.js';
import { Icon } from '../../ui/icons.js';
import { Facts, Bar } from '../../ui/kit.js';
import { progressOfTrack, tracksOf, subjectOf, subjectVars, daysUntil } from '../../data/model.js';
import { progressNumbers } from '../../core/calc/track.js';
import { fmtNum } from '../../core/num.js';
import { ddayLabel, formatMDW } from '../../core/date.js';

export function trackFacts(track, exam, today) {
  const p = progressOfTrack(track.id);
  if (!p) return null;
  const remaining = Math.max(0, p.amountTotal - p.amountDone);
  const n = progressNumbers({ remaining, done: p.amountDone, startDate: track.startDate, examDate: exam.date, today });
  return { p, n, unit: p.unit };
}

export function FactsGrid({ facts }) {
  const { n, unit } = facts;
  return html`<${Facts}
    items=${[
      { k: '남은 분량', v: fmtNum(n.remaining, 1), u: unit },
      { k: '남은 일수', v: n.daysLeft, u: '일' },
      { k: '지금까지 일평균', v: n.avgPerDay == null ? null : fmtNum(n.avgPerDay, 1), u: `${unit}/일` },
      { k: '필요 처리량', v: n.requiredPerDay == null ? null : fmtNum(n.requiredPerDay, 1), u: `${unit}/일` },
    ]}
  />`;
}

/** 한 시험의 과목별 진도 현황 */
export function ExamFactsCard({ exam, today, nav, compact }) {
  const tracks = tracksOf(exam.id);
  const d = daysUntil(exam, today);
  return html`<section class="card facts-card">
    <button class="card-head as-link" onClick=${() => nav && nav.push('exam', { id: exam.id })}>
      <span class="num fc-dday">${ddayLabel(d)}</span>
      <h3 class="grow ellipsis" style="color:var(--ink)">${exam.name}</h3>
      <span class="muted" style="font-size:var(--t-xs)">${formatMDW(exam.date)}</span>
      <${Icon} name="chev-right" size=${18} class="muted" />
    </button>
    <div class="card-pad" style="padding-top:4px">
      ${tracks.length === 0
        ? html`<p class="muted" style="margin:0">아직 회독 트랙이 없습니다. 시험을 눌러 과목별 트랙을 만드세요.</p>`
        : tracks.map((tr) => {
            const s = subjectOf(tr.subjectId);
            const f = trackFacts(tr, exam, today);
            if (!f) return null;
            return html`<div class="fc-row" key=${tr.id} style=${subjectVars(s)}>
              <div class="fc-head">
                <span class="dot"></span>
                <span class="grow ellipsis fc-name">${s ? s.name : '과목'}</span>
                <span class="num fc-pct">${Math.round(f.p.pct * 100)}%</span>
              </div>
              ${compact ? null : html`<${Bar} value=${f.p.pct} color=${s && s.color} thin label=${(s ? s.name : '') + ' 진행률'} />`}
              <${FactsGrid} facts=${f} />
              ${f.p.unsized ? html`<p class="hint">쪽 범위가 없는 섹션 ${f.p.unsized}개는 남은 분량에 들어가지 않았습니다.</p>` : null}
            </div>`;
          })}
    </div>
  </section>`;
}
