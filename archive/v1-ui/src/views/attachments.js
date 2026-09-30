import { html } from '../lib/html.js';
import { useState, useEffect } from '../lib/ui.js';
import { loadAttachmentUrl, cachedUrl } from '../data/attachments.js';
import { openSheet } from '../ui/overlay.js';
import { Icon } from '../ui/icons.js';

export function AttachmentThumb({ att }) {
  const [url, setUrl] = useState(() => cachedUrl(att.id));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!url)
      loadAttachmentUrl(att).then((u) => {
        if (!alive) return;
        if (u) setUrl(u);
        else setFailed(true);
      });
    return () => (alive = false);
  }, [att.id, att.uploaded]);
  if (url) return html`<img src=${url} alt="첨부 사진" loading="lazy" decoding="async" />`;
  return html`<span class="att-ph">${failed ? '불러올 수 없음' : html`<${Icon} name="image" size=${22} />`}</span>`;
}

function Viewer({ att, close }) {
  const [url, setUrl] = useState(() => cachedUrl(att.id));
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    if (!url) loadAttachmentUrl(att).then((u) => u && setUrl(u));
  }, []);
  return html`<div class="viewer" onClick=${() => close()}>
    <div class=${'viewer-scroll' + (zoom ? ' zoom' : '')} onClick=${(e) => e.stopPropagation()}>
      ${url ? html`<img src=${url} alt="첨부 사진" onDblClick=${() => setZoom(!zoom)} />` : html`<p style="color:#fff">불러오는 중…</p>`}
    </div>
    <div class="viewer-bar" onClick=${(e) => e.stopPropagation()}>
      <button class="btn subtle" onClick=${() => setZoom(!zoom)}>${zoom ? '화면에 맞추기' : '크게 보기'}</button>
      <button class="btn subtle" onClick=${() => close()}><${Icon} name="x" size=${18} />닫기</button>
    </div>
  </div>`;
}

export function openImageViewer(att) {
  return openSheet((close) => html`<${Viewer} att=${att} close=${close} />`, { modal: 'never' });
}
