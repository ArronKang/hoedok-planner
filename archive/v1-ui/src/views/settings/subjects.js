// 설정 › 과목과 교재
import { html } from '../../lib/html.js';
import { useState } from '../../lib/ui.js';
import { openSheet, Sheet, confirmDialog } from '../../ui/overlay.js';
import { Icon } from '../../ui/icons.js';
import { Field, Segmented, TextInput, NumberInput, SortableList, IconButton, Chip, cx } from '../../ui/kit.js';
import { withUndo, toast } from '../../ui/toast.js';
import { get } from '../../data/db.js';
import { subjects, textbooksOf, SUBJECT_COLORS, subjectVars } from '../../data/model.js';
import { addSubject, saveSubject, deleteSubject, reorderSubjects, addTextbook, saveTextbook, deleteTextbook } from '../../data/actions.js';
import { SUBJECT_GROUPS, TRACK_TEMPLATES, SUBJECT_PRESETS } from '../../core/templates.js';

const catLabel = (c) => (c === 'achievement' ? '성취도만' : '등급 산출');

function Textbooks({ subjectId }) {
  const list = textbooksOf(subjectId);
  const [name, setName] = useState('');
  const [pages, setPages] = useState('');
  const add = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    addTextbook(subjectId, name, pages ? Number(pages) || null : null);
    setName('');
    setPages('');
  };
  return html`<div class="textbooks">
    ${list.map(
      (tb) => html`<div class="tb-row" key=${tb.id}>
        <${TextInput} class="input" value=${tb.name} label="교재 이름" onCommit=${(v) => saveTextbook(tb.id, { name: v.trim() || tb.name })} />
        <div class="tb-pages"><${NumberInput} value=${tb.totalPages} integer min=${1} suffix="쪽" label="총 쪽수" placeholder="쪽수" onCommit=${(v) => saveTextbook(tb.id, { totalPages: v })} /></div>
        <${IconButton} icon="trash" label="교재 삭제" onClick=${() => withUndo('교재를 삭제했습니다', () => deleteTextbook(tb.id))} />
      </div>`,
    )}
    <form class="tb-row add" onSubmit=${add}>
      <input class="input" placeholder="교재 이름 (예: 쎈 공통수학1)" aria-label="새 교재 이름" value=${name} onInput=${(e) => setName(e.target.value)} />
      <div class="tb-pages"><div class="input-affix"><input class="input num" inputmode="numeric" placeholder="쪽수" aria-label="새 교재 총 쪽수" value=${pages} onInput=${(e) => setPages(e.target.value.replace(/[^0-9]/g, ''))} /><span class="affix">쪽</span></div></div>
      <button class="icon-btn" type="submit" aria-label="교재 추가" disabled=${!name.trim()}><${Icon} name="plus" /></button>
    </form>
  </div>`;
}

export function SubjectSheet({ id, close }) {
  const s = get('subjects', id);
  if (!s) return html`<${Sheet} title="과목" onClose=${close}><p class="muted">삭제된 과목입니다.</p><//>`;
  const save = (p) => saveSubject(id, p);
  return html`<${Sheet}
    title="과목 편집"
    onClose=${close}
    full
    footer=${html`<button class="btn danger" onClick=${async () => {
        const ok = await confirmDialog({ title: `'${s.name}' 삭제`, message: '할 일이나 성적 기록이 있으면 목록에서 숨기기만 하고 기록은 남깁니다.', confirm: '삭제', danger: true });
        if (!ok) return;
        const r = withUndo('과목을 정리했습니다', () => deleteSubject(id));
        if (r === 'archived') toast('기록이 있어 숨김 처리했습니다. 설정 › 과목에서 다시 보이게 할 수 있습니다.');
        close();
      }}><${Icon} name="trash" size=${18} />삭제</button>
      <button class="btn primary" onClick=${() => close()}>완료</button>`}
  >
    <${Field} label="과목 이름"><${TextInput} value=${s.name} label="과목 이름" onCommit=${(v) => save({ name: v.trim() || s.name })} /><//>
    <${Field} label="색">
      <div class="swatches" role="radiogroup" aria-label="과목 색">
        ${SUBJECT_COLORS.map(
          (c) => html`<button key=${c.id} role="radio" aria-checked=${s.color === c.hex ? 'true' : 'false'} aria-label=${c.name} class=${cx('swatch', s.color === c.hex && 'on')} style=${{ '--sc': c.hex }} onClick=${() => save({ color: c.hex })}>
            ${s.color === c.hex ? html`<${Icon} name="check" size=${16} stroke=${2.6} />` : null}
          </button>`,
        )}
      </div>
    <//>
    <${Field} label="분류" hint="체육·예술·과학탐구실험처럼 성취도만 나오는 과목은 평균 등급 계산에서 빠집니다">
      <${Segmented} label="분류" value=${s.category || 'grade'} onChange=${(v) => save({ category: v })} options=${[{ value: 'grade', label: '등급 산출' }, { value: 'achievement', label: '성취도만' }]} />
    <//>
    <div class="row2" style="margin-top:14px">
      <${Field} label="학점" hint="성적표 과목명 옆 괄호 숫자"><${NumberInput} value=${s.credits} integer min=${0} max=${20} label="학점" placeholder="예: 4" onCommit=${(v) => save({ credits: v })} /><//>
      <${Field} label="교과(군)">
        <select class="select" value=${s.group || ''} aria-label="교과군" onChange=${(e) => save({ group: e.target.value })}>
          <option value="">선택 안 함</option>
          ${SUBJECT_GROUPS.map((g) => html`<option key=${g} value=${g}>${g}</option>`)}
          ${s.group && !SUBJECT_GROUPS.includes(s.group) ? html`<option value=${s.group}>${s.group}</option>` : null}
        </select>
      <//>
    </div>
    <${Field} label="회독 트랙 기본 템플릿" hint="이 과목의 트랙을 새로 만들 때 자동으로 채울 구성">
      <select class="select" value=${s.template || ''} aria-label="기본 템플릿" onChange=${(e) => save({ template: e.target.value || null })}>
        <option value="">빈 트랙</option>
        ${TRACK_TEMPLATES.map((t) => html`<option key=${t.id} value=${t.id}>${t.name} — ${t.desc}</option>`)}
      </select>
    <//>
    <${Field} label="교재"><${Textbooks} subjectId=${id} /><//>
  <//>`;
}

export function openSubject(id) {
  return openSheet((close) => html`<${SubjectSheet} id=${id} close=${close} />`);
}

function PresetPicker({ close }) {
  const existing = new Set(subjects().map((s) => s.name));
  const [picked, setPicked] = useState(new Set());
  const toggle = (n) => {
    const x = new Set(picked);
    if (x.has(n)) x.delete(n);
    else x.add(n);
    setPicked(x);
  };
  return html`<${Sheet}
    title="자주 쓰는 과목에서 고르기"
    onClose=${() => close()}
    footer=${html`<button class="btn primary block" disabled=${!picked.size} onClick=${() => {
      for (const p of SUBJECT_PRESETS) if (picked.has(p.name)) addSubject({ ...p, color: (SUBJECT_COLORS.find((c) => c.id === p.color) || {}).hex });
      close(true);
    }}>${picked.size ? `${picked.size}개 추가` : '과목을 고르세요'}</button>`}
  >
    <div class="chips">
      ${SUBJECT_PRESETS.filter((p) => !existing.has(p.name)).map(
        (p) => html`<${Chip} key=${p.name} on=${picked.has(p.name)} onClick=${() => toggle(p.name)}>${p.name}<span class="muted" style="font-size:var(--t-xs)">${p.credits}학점 · ${catLabel(p.category)}</span><//>`,
      )}
    </div>
  <//>`;
}

export function SubjectsPage() {
  const list = subjects();
  const active = list.filter((s) => !s.archived);
  const archived = list.filter((s) => s.archived);
  const addNew = () => {
    const s = addSubject({ name: '새 과목' });
    openSubject(s.id);
  };
  return html`<div>
    <div class="hstack wrap" style="margin-bottom:12px">
      <button class="btn primary" onClick=${addNew}><${Icon} name="plus" size=${18} />새 과목</button>
      <button class="btn" onClick=${() => openSheet((close) => html`<${PresetPicker} close=${close} />`)}>자주 쓰는 과목에서 고르기</button>
    </div>
    ${active.length
      ? html`<div class="card list">
          <${SortableList}
            items=${active}
            keyOf=${(s) => s.id}
            onReorder=${(ids) => reorderSubjects([...ids, ...archived.map((a) => a.id)])}
            renderItem=${(s, grip) => html`<div class="list-row sub-row" style=${subjectVars(s)}>
              ${grip}
              <button class="grow sub-open" onClick=${() => openSubject(s.id)}>
                <span class="dot"></span>
                <span class="grow ellipsis">${s.name}</span>
                <span class="tag">${catLabel(s.category)}</span>
                ${s.credits ? html`<span class="tag num">${s.credits}학점</span>` : null}
                <span class="muted num" style="font-size:var(--t-xs)">${textbooksOf(s.id).length ? `교재 ${textbooksOf(s.id).length}` : ''}</span>
              </button>
              <${Icon} name="chev-right" size=${18} class="chev" />
            </div>`}
          />
        </div>
        <p class="hint" style="margin:8px 4px">손잡이를 끌어 순서를 바꾸면 하루 화면의 과목 순서도 바뀝니다.</p>`
      : html`<div class="empty"><h4>과목이 없습니다</h4><p>위의 단추로 과목을 추가하세요.</p></div>`}
    ${archived.length
      ? html`<div class="section-title">숨긴 과목</div>
          <div class="card list">
            ${archived.map(
              (s) => html`<div class="list-row" key=${s.id} style=${subjectVars(s)}>
                <span class="dot"></span><span class="label ellipsis">${s.name}</span>
                <button class="btn sm" onClick=${() => saveSubject(s.id, { archived: false })}>다시 보이기</button>
              </div>`,
            )}
          </div>`
      : null}
  </div>`;
}
