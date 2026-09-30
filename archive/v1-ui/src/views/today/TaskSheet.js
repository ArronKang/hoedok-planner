// 할 일 자세히 보기/편집 (바뀐 값은 바로 저장)
import { html } from '../../lib/html.js';
import { useState, useEffect, useRef } from '../../lib/ui.js';
import { Sheet, openSheet, openMenu, promptDialog } from '../../ui/overlay.js';
import { Icon } from '../../ui/icons.js';
import { Field, Segmented, Stepper, TextInput, Chip, IconButton, pickDate, cx } from '../../ui/kit.js';
import { withUndo, toast } from '../../ui/toast.js';
import { get } from '../../data/db.js';
import { exams, examMap, taskExamId, subjectOf } from '../../data/model.js';
import { saveTask, deleteTask, duplicateTask, moveTask, addAttachment, removeAttachment, undropTask } from '../../data/actions.js';
import { formatMDW, addDays, minutesLabel, formatShort } from '../../core/date.js';
import { EXAM_KINDS } from '../../core/calc/exam.js';
import { SubjectChips } from '../common.js';
import { AttachmentThumb, openImageViewer } from '../attachments.js';
import { useToday } from '../../data/hooks.js';

const MIN_PRESETS = [15, 30, 45, 60, 90, 120];

export function MinutesPicker({ value, onChange, label }) {
  const custom = value != null && !MIN_PRESETS.includes(value);
  return html`<div class="chips" role="group" aria-label=${label}>
    <${Chip} on=${value == null} onClick=${() => onChange(null)}>없음<//>
    ${MIN_PRESETS.map((m) => html`<${Chip} key=${m} on=${value === m} onClick=${() => onChange(m)}>${minutesLabel(m)}<//>`)}
    <${Chip}
      on=${custom}
      onClick=${async () => {
        const v = await promptDialog({ title: label || '소요시간', label: '분 단위로 입력', value: value != null ? String(value) : '', inputMode: 'numeric', placeholder: '예: 50' });
        if (v == null) return;
        const n = Math.round(Number(v));
        if (isFinite(n) && n >= 0) onChange(n || null);
      }}
      >${custom ? minutesLabel(value) : '직접 입력'}<//>
  </div>`;
}

function examLabel(e) {
  if (!e) return '해당 없음';
  return `${e.name} (${formatShort(e.date)})`;
}

function ExamSelect({ task }) {
  const ref = useRef(null);
  const resolved = taskExamId(task);
  const exam = resolved ? examMap().get(resolved) : null;
  const label = task.examId === 'none' ? '시험과 무관' : task.examId ? examLabel(exam) : `자동 · ${examLabel(exam)}`;
  const choose = () =>
    openMenu({
      anchor: ref.current,
      title: '어느 시험을 위한 할 일인가요?',
      items: [
        { label: '자동 (날짜 이후 가장 가까운 시험)', on: !task.examId, onSelect: () => saveTask(task.id, { examId: undefined }) },
        { label: '시험과 무관', on: task.examId === 'none', onSelect: () => saveTask(task.id, { examId: 'none' }) },
        'sep',
        ...exams().map((e) => ({
          label: `${e.name} · ${formatShort(e.date)}`,
          sub: EXAM_KINDS[e.kind] ? EXAM_KINDS[e.kind].label : '',
          on: task.examId === e.id,
          onSelect: () => saveTask(task.id, { examId: e.id }),
        })),
      ],
    });
  return html`<button class="input as-btn" ref=${ref} onClick=${choose}><span class="ellipsis grow">${label}</span><${Icon} name="chev-down" size=${18} /></button>`;
}

function Attachments({ task }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const ids = task.attachmentIds || [];
  const onFiles = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    try {
      for (const f of files) await addAttachment(task.id, f);
    } catch (err) {
      toast('사진을 저장하지 못했습니다: ' + (err && err.message ? err.message : err));
    } finally {
      setBusy(false);
    }
  };
  return html`<div class="att-grid">
    ${ids.map((aid) => {
      const att = get('attachments', aid);
      if (!att) return null;
      return html`<div class="att" key=${aid}>
        <button class="att-img" onClick=${() => openImageViewer(att)} aria-label="사진 크게 보기"><${AttachmentThumb} att=${att} /></button>
        <button class="att-del" aria-label="사진 삭제" onClick=${() => withUndo('사진을 삭제했습니다', () => removeAttachment(task.id, aid))}><${Icon} name="x" size=${16} /></button>
      </div>`;
    })}
    <button class="att add" onClick=${() => input.current && input.current.click()} disabled=${busy}>
      <${Icon} name=${busy ? 'sync' : 'camera'} size=${22} />
      <span>${busy ? '저장 중' : '사진 추가'}</span>
    </button>
    <input ref=${input} type="file" accept="image/*" multiple hidden onChange=${onFiles} />
  </div>`;
}

export function TaskSheet({ id, close }) {
  const t = get('tasks', id);
  const today = useToday();
  useEffect(() => {
    if (!t) close();
  }, [!t]);
  if (!t) return html`<${Sheet} title="할 일" onClose=${close}><p class="muted">삭제된 할 일입니다.</p><//>`;
  const save = (patch) => saveTask(id, patch);
  const subj = subjectOf(t.subjectId);
  const section = t.trackId && t.sectionId ? sectionInfo(t) : null;

  const pickTaskDate = async () => {
    const d = await pickDate({
      title: '날짜 옮기기',
      value: t.date,
      today,
      quick: [
        { label: '오늘', date: today },
        { label: '내일', date: addDays(today, 1) },
        { label: '모레', date: addDays(today, 2) },
      ],
    });
    if (d) withUndo(`${formatMDW(d)}(으)로 옮겼습니다`, () => moveTask(id, d));
  };
  const pickDue = async () => {
    const d = await pickDate({ title: '마감일', value: t.dueDate || t.date, today, allowClear: true });
    if (d !== undefined) save({ dueDate: d });
  };
  const setRepeat = (n) => {
    const total = n > 1 ? n : null;
    const done = t.status === 'done';
    save({ repeatTotal: total, repeatDone: total ? (done ? total : Math.min(t.repeatDone || 0, total - 1)) : 0 });
  };
  const footer = html`
    <button class="btn danger" onClick=${() => {
      withUndo('할 일을 삭제했습니다', () => deleteTask(id));
      close();
    }}><${Icon} name="trash" size=${18} />삭제</button>
    <button class="btn" onClick=${async () => {
      const d = await pickDate({ title: '복제할 날짜', value: addDays(t.date, 1), today });
      if (d) {
        withUndo(`${formatMDW(d)}에 복제했습니다`, () => duplicateTask(id, [d]));
      }
    }}><${Icon} name="copy" size=${18} />복제</button>
    ${t.status === 'dropped'
      ? html`<button class="btn primary" onClick=${() => undropTask(id)}>다시 살리기</button>`
      : html`<button class="btn primary" onClick=${() => {
          const to = addDays(t.date > today ? t.date : today, 1);
          withUndo(`${formatMDW(to)}(으)로 옮겼습니다`, () => moveTask(id, to));
          close();
        }}><${Icon} name="arrow-right" size=${18} />내일로</button>`}
  `;

  return html`<${Sheet} title=${subj ? subj.name : '할 일'} onClose=${close} full footer=${footer}>
    <div class="task-sheet">
      <${TextInput} class="input title" value=${t.title} placeholder="할 일 이름" label="할 일 이름" onCommit=${(v) => save({ title: v.trim() || t.title })} />
      ${t.status === 'dropped' ? html`<p class="tag outline" style="margin-top:10px">버린 할 일${t.dropReason ? ' · ' + t.dropReason : ''}</p>` : null}

      <${Field} label="과목"><${SubjectChips} value=${t.subjectId} onChange=${(sid) => save({ subjectId: sid })} /><//>

      <div class="row2" style="margin-top:14px">
        <${Field} label="날짜">
          <button class="input as-btn" onClick=${pickTaskDate}><span class="grow">${formatMDW(t.date)}</span><${Icon} name="calendar" size=${18} /></button>
        <//>
        <${Field} label="시작 시각 (선택)">
          <input type="time" class="input" value=${t.startTime || ''} aria-label="시작 시각" onChange=${(e) => save({ startTime: e.target.value || null })} />
        <//>
      </div>

      <${Field} label="중요도">
        <${Segmented}
          label="중요도"
          value=${t.importance || 0}
          onChange=${(v) => save({ importance: v })}
          options=${[
            { value: 0, label: '없음' },
            { value: 1, label: '!' },
            { value: 2, label: '!!' },
            { value: 3, label: '!!!' },
          ]}
        />
      <//>

      <div class="row2" style="margin-top:14px">
        <${Field} label="반복 횟수" hint=${t.repeatTotal > 1 ? `체크할 때마다 한 칸씩 · 지금 ${t.repeatDone || 0}/${t.repeatTotal}` : '예: 3회독이면 3'}>
          <${Stepper} label="반복 횟수" value=${t.repeatTotal || 1} min=${1} max=${20} onChange=${setRepeat} format=${(v) => (v === 1 ? '없음' : `${v}회`)} />
        <//>
        <${Field} label="마감일 (선택)">
          <button class="input as-btn" onClick=${pickDue}><span class="grow">${t.dueDate ? formatMDW(t.dueDate) : '없음'}</span><${Icon} name="flag" size=${18} /></button>
        <//>
      </div>

      <${Field} label="예상 소요시간"><${MinutesPicker} label="예상 소요시간" value=${t.estMinutes ?? null} onChange=${(v) => save({ estMinutes: v })} /><//>
      <${Field} label="실제 걸린 시간 (선택)" hint="예상과 비교하는 통계에 쓰입니다">
        <${MinutesPicker} label="실제 걸린 시간" value=${t.actualMinutes ?? null} onChange=${(v) => save({ actualMinutes: v })} />
      <//>

      <${Field} label="어느 시험을 위한 할 일"><${ExamSelect} task=${t} /><//>

      ${section
        ? html`<${Field} label="회독 트랙 연결">
            <div class="linked-sec">
              <${Icon} name="book" size=${18} />
              <span class="grow">${section}</span>
            </div>
          <//>`
        : null}

      <${Field} label="메모"><${TextInput} multiline class="textarea" value=${t.memo || ''} placeholder="예: 수행평가 준비물, 범위" label="메모" onCommit=${(v) => save({ memo: v })} /><//>

      <${Field} label="사진"><${Attachments} task=${t} /><//>

      ${(t.moves || []).length
        ? html`<div class="field">
            <span class="field-label">미룬 기록</span>
            <ul class="moves">
              ${t.moves.map(
                (m, i) => html`<li key=${i}><span class="num">${formatShort(m.from)} → ${formatShort(m.to)}</span>${m.reason ? html`<span class="tag">${m.reason}</span>` : null}</li>`,
              )}
            </ul>
          </div>`
        : null}
    </div>
  <//>`;
}

function sectionInfo(t) {
  const tr = get('tracks', t.trackId);
  if (!tr) return null;
  if (tr.form === 'grid') {
    const r = (tr.grid && tr.grid.rounds.find((x) => x.id === t.sectionId)) || null;
    return `${r ? r.name : '회독'} · ${(t.cells || []).length}지문`;
  }
  const s = (tr.sections || []).find((x) => x.id === t.sectionId);
  if (!s) return null;
  return `${s.name}${t.pageFrom != null ? ` · p.${t.pageFrom}–${t.pageTo}` : ''}`;
}

export function openTask(id) {
  return openSheet((close) => html`<${TaskSheet} id=${id} close=${close} />`);
}
