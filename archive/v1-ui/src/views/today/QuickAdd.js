// 빠른 추가: 과목(마지막으로 쓴 과목이 기본) + 이름만 입력하고 바로 추가
import { html } from '../../lib/html.js';
import { useState, useRef, useEffect } from '../../lib/ui.js';
import { Sheet, openSheet } from '../../ui/overlay.js';
import { Icon } from '../../ui/icons.js';
import { activeSubjects, subjectOf, subjectVars } from '../../data/model.js';
import { addTask } from '../../data/actions.js';
import { device, setDevice } from '../../state/device.js';
import { formatMDW } from '../../core/date.js';
import { SubjectChips } from '../common.js';

function QuickAdd({ date, subjectId, close }) {
  const subs = activeSubjects();
  const last = device.get().lastSubjectId;
  const [sid, setSid] = useState(subjectId || (subs.find((s) => s.id === last) ? last : subs[0] && subs[0].id));
  const [added, setAdded] = useState([]);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) setTimeout(() => el.focus(), 60);
  }, []);
  const submit = (e) => {
    e.preventDefault();
    const el = ref.current;
    const title = (el ? el.value : '').trim();
    if (!title || !sid) return;
    const t = addTask({ title, subjectId: sid, date });
    setDevice({ lastSubjectId: sid });
    setAdded((a) => [...a, { id: t.id, title, sid }]);
    if (el) {
      el.value = '';
      el.focus();
    }
  };
  return html`<${Sheet} title=${formatMDW(date) + '에 추가'} onClose=${() => close()}>
    <div class="quick-add">
      ${subs.length ? html`<${SubjectChips} value=${sid} onChange=${setSid} subjects=${subs} />` : html`<p class="muted">먼저 설정에서 과목을 추가하세요.</p>`}
      <form class="qa-row" onSubmit=${submit}>
        <input ref=${ref} class="input" placeholder="할 일 이름 (예: 쎈 p.12–25)" aria-label="할 일 이름" enterkeyhint="enter" autocomplete="off" />
        <button class="btn primary" type="submit" disabled=${!sid}>추가</button>
      </form>
      ${added.length
        ? html`<ul class="qa-added">
            ${added
              .slice()
              .reverse()
              .map((a) => {
                const s = subjectOf(a.sid);
                return html`<li key=${a.id} style=${subjectVars(s)}><span class="dot"></span><span class="grow ellipsis">${a.title}</span><${Icon} name="check" size=${16} /></li>`;
              })}
          </ul>`
        : html`<p class="hint">이름만 적어도 됩니다. 시간·마감·사진은 추가한 뒤 항목을 눌러 채우세요.</p>`}
    </div>
  <//>`;
}

export function openQuickAdd(date, subjectId) {
  return openSheet((close) => html`<${QuickAdd} date=${date} subjectId=${subjectId} close=${close} />`);
}
