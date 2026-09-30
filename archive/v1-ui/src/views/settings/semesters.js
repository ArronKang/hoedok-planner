// 설정 › 학기
import { html } from '../../lib/html.js';
import { useState } from '../../lib/ui.js';
import { Icon } from '../../ui/icons.js';
import { Segmented, Field, NumberInput, IconButton, cx } from '../../ui/kit.js';
import { withUndo, toast } from '../../ui/toast.js';
import { all, remove } from '../../data/db.js';
import { semesters, prefs, semesterLabel, today } from '../../data/model.js';
import { addSemester, setPrefs, defaultSemesterGuess } from '../../data/actions.js';

export function AddSemesterForm({ onDone, compact }) {
  const g = defaultSemesterGuess(today());
  const [year, setYear] = useState(g.year);
  const [grade, setGrade] = useState(1);
  const [term, setTerm] = useState(g.term);
  const exists = semesters().some((s) => s.id === `${year}-${term}`);
  return html`<div class=${cx(!compact && 'card card-pad')}>
    <div class="row3">
      <${Field} label="연도"><${NumberInput} value=${year} integer min=${2000} max=${2100} label="연도" onCommit=${(v) => v && setYear(v)} /><//>
      <${Field} label="학년"><${Segmented} label="학년" value=${grade} onChange=${setGrade} options=${[1, 2, 3].map((n) => ({ value: n, label: String(n) }))} /><//>
      <${Field} label="학기"><${Segmented} label="학기" value=${term} onChange=${setTerm} options=${[1, 2].map((n) => ({ value: n, label: String(n) }))} /><//>
    </div>
    <button class="btn primary block" style="margin-top:12px" disabled=${exists} onClick=${() => {
      const s = addSemester({ year, grade, term });
      setPrefs({ currentSemesterId: s.id });
      onDone && onDone(s);
    }}>${exists ? '이미 있는 학기입니다' : `${year}년 ${grade}학년 ${term}학기 추가`}</button>
  </div>`;
}

export function SemestersPage() {
  const list = semesters();
  const cur = prefs().currentSemesterId;
  const inUse = (id) => all('naesin').some((r) => r.semesterId === id) || all('exams').some((e) => e.semesterId === id);
  return html`<div>
    ${list.length
      ? html`<div class="card list">
          ${list.map(
            (s) => html`<div class="list-row" key=${s.id}>
              <button class="grow hstack" style="min-height:var(--tap)" onClick=${() => setPrefs({ currentSemesterId: s.id })} aria-pressed=${cur === s.id ? 'true' : 'false'}>
                <span class=${cx('radio', cur === s.id && 'on')}></span>
                <span class="grow">${semesterLabel(s)} <span class="muted num">${s.year}</span></span>
                ${cur === s.id ? html`<span class="tag accent">지금 학기</span>` : null}
              </button>
              <${IconButton}
                icon="trash"
                label="학기 삭제"
                onClick=${() => {
                  if (inUse(s.id)) {
                    toast('성적이나 시험이 연결된 학기는 지울 수 없습니다');
                    return;
                  }
                  withUndo('학기를 삭제했습니다', () => remove('semesters', s.id));
                }}
              />
            </div>`,
          )}
        </div>`
      : html`<p class="muted">등록된 학기가 없습니다.</p>`}
    <div class="section-title">학기 추가</div>
    <${AddSemesterForm} />
  </div>`;
}
