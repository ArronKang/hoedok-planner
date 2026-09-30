// 설정 › 백업 · 데이터
import { html } from '../../lib/html.js';
import { useRef } from '../../lib/ui.js';
import { Icon } from '../../ui/icons.js';
import { confirmDialog } from '../../ui/overlay.js';
import { toast } from '../../ui/toast.js';
import { exportData, importData, wipeLocal, pendingCount } from '../../data/db.js';
import { SECURE_KV_KEYS } from '../../sync/secure-store.js';
import { toKey } from '../../core/date.js';

export function DataPage() {
  const file = useRef(null);
  const doExport = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `회독플래너-백업-${toKey(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
    toast('백업 파일을 만들었습니다 (사진은 포함되지 않습니다)');
  };
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const ok = await confirmDialog({ title: '백업 가져오기', message: '같은 항목은 백업 내용으로 바뀌고, 없는 항목은 추가됩니다. 로그인되어 있으면 서버에도 반영됩니다.', confirm: '가져오기' });
      if (!ok) return;
      const n = importData(data);
      toast(`${n}개 항목을 가져왔습니다`);
    } catch (err) {
      toast('가져오지 못했습니다: ' + (err.message || err));
    }
  };
  return html`<div>
    <div class="card list">
      <button class="list-row" onClick=${doExport}>
        <${Icon} name="download" />
        <span class="label">백업 파일 내려받기<small class="row-sub">모든 기록을 JSON 파일로 저장 (사진 제외)</small></span>
      </button>
      <button class="list-row" onClick=${() => file.current && file.current.click()}>
        <${Icon} name="upload" />
        <span class="label">백업 파일 가져오기</span>
      </button>
      <input type="file" accept="application/json,.json" hidden ref=${file} onChange=${onFile} />
    </div>
    <div class="section-title">이 기기</div>
    <div class="card list">
      <button class="list-row" onClick=${async () => {
        const pend = pendingCount();
        const ok = await confirmDialog({
          title: '이 기기의 데이터 모두 지우기',
          message: `서버에 올라간 데이터는 남습니다.${pend ? ` 아직 올리지 못한 변경 ${pend}건은 사라집니다.` : ''} 이 작업은 되돌릴 수 없습니다.`,
          confirm: '모두 지우기',
          danger: true,
        });
        if (!ok) return;
        await wipeLocal({ keepKv: [...SECURE_KV_KEYS, 'secret:session', 'sync:owner'] });
        toast('이 기기의 데이터를 지웠습니다');
      }}>
        <${Icon} name="trash" />
        <span class="label" style="color:var(--danger)">이 기기의 데이터 모두 지우기</span>
      </button>
    </div>
  </div>`;
}
