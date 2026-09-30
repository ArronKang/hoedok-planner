// 설정 › 화면 (이 기기에만 저장)
import { html } from '../../lib/html.js';
import { useStore } from '../../lib/ui.js';
import { Icon } from '../../ui/icons.js';
import { Segmented, Field, SortableList, Toggle } from '../../ui/kit.js';
import { device, setDevice, PHONE_TABS, resolveCards, VIEW_CARDS } from '../../state/device.js';
import { appState } from '../../state/app.js';

export function DisplayPage({ close, shell }) {
  const d = useStore(device);
  const isTablet = useStore(appState, (s) => s.isTablet);
  const tabs = d.phoneTabs.map((id) => PHONE_TABS.find((t) => t.id === id)).filter(Boolean);
  const cards = resolveCards('today', d.phoneCards);
  const setCards = (order, hidden) => setDevice({ phoneCards: { order, hidden } });
  return html`<div>
    <p class="sub" style="margin:0 0 12px">여기 설정은 이 기기에만 저장되고 다른 기기와 공유되지 않습니다.</p>
    <div class="card card-pad">
      <${Field} label="테마">
        <${Segmented} label="테마" value=${d.theme} onChange=${(v) => setDevice({ theme: v })} options=${[{ value: 'system', label: '기기 설정' }, { value: 'light', label: '라이트' }, { value: 'dark', label: '다크' }]} />
      <//>
      <${Field} label="글자 크기">
        <${Segmented} label="글자 크기" value=${d.fontSize} onChange=${(v) => setDevice({ fontSize: v })} options=${[{ value: 'sm', label: '작게' }, { value: 'md', label: '보통' }, { value: 'lg', label: '크게' }, { value: 'xl', label: '아주 크게' }]} />
      <//>
      <${Field} label="밀도">
        <${Segmented} label="밀도" value=${d.density} onChange=${(v) => setDevice({ density: v })} options=${[{ value: 'comfortable', label: '넓게' }, { value: 'compact', label: '좁게' }]} />
      <//>
      <${Field} label="추가 단추 위치" hint="＋ 단추를 쥐는 손 쪽으로">
        <${Segmented} label="도구 위치" value=${d.toolSide} onChange=${(v) => setDevice({ toolSide: v })} options=${[{ value: 'left', label: '왼쪽' }, { value: 'right', label: '오른쪽' }]} />
      <//>
    </div>

    ${isTablet
      ? html`<div class="section-title">태블릿 화면 배치</div>
          <div class="card card-pad">
            <p class="sub" style="margin:0 0 10px">위쪽 막대의 <b>편집</b> 단추로 패널 나누기, 패널 크기, 패널마다 보여줄 화면과 카드를 바꿀 수 있습니다. 가로·세로 배치는 따로 저장됩니다.</p>
            ${shell && shell.editLayout
              ? html`<button class="btn block" onClick=${() => {
                  close && close();
                  shell.editLayout();
                }}><${Icon} name="layout" size=${18} />화면 배치 편집</button>`
              : null}
          </div>`
      : null}

    <div class="section-title">아래 탭 순서 ${isTablet ? html`<span class="muted" style="font-weight:500">— 휴대폰 크기 화면에서 사용</span>` : null}</div>
    <div class="card list">
      <${SortableList}
        items=${tabs}
        keyOf=${(t) => t.id}
        onReorder=${(ids) => setDevice({ phoneTabs: ids })}
        renderItem=${(t, grip) => html`<div class="list-row">${grip}<${Icon} name=${t.icon} /><span class="label">${t.label}</span></div>`}
      />
    </div>

    <div class="section-title">오늘 화면 카드</div>
    <div class="card list">
      <${SortableList}
        items=${cards}
        keyOf=${(c) => c.id}
        onReorder=${(ids) => setCards(ids, cards.filter((c) => c.hidden).map((c) => c.id))}
        renderItem=${(c, grip) => html`<div class="list-row">
          ${grip}
          <span class="label">${c.label}</span>
          <${Toggle}
            label=${c.label + ' 표시'}
            checked=${!c.hidden}
            onChange=${(on) => setCards(cards.map((x) => x.id), cards.filter((x) => (x.id === c.id ? !on : x.hidden)).map((x) => x.id))}
          />
        </div>`}
      />
    </div>
    <p class="hint" style="margin:8px 4px">${VIEW_CARDS.today.length}개 카드 중 켜 둔 것만 오늘 화면에 보입니다.</p>
  </div>`;
}
