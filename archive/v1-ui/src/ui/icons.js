// 선 아이콘 (24×24, 둥근 끝). 직접 그린 경로.
import { html } from '../lib/html.js';

const c = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

export const ICONS = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  'chev-left': 'M15 5l-7 7 7 7',
  'chev-right': 'M9 5l7 7-7 7',
  'chev-down': 'M6 9l6 6 6-6',
  'chev-up': 'M6 15l6-6 6 6',
  calendar: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4',
  today: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4',
  book: 'M12 6.5C10.3 5 7.8 4.5 4 4.5v13c3.8 0 6.3.5 8 2 1.7-1.5 4.2-2 8-2v-13c-3.8 0-6.3.5-8 2zM12 6.5v13',
  report: 'M9 3.5h6v3H9zM7.5 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1.5M8 16.5l2.5-3 2 2 3.5-4.5',
  chart: 'M5 20V11M12 20V4M19 20v-6M3 20h18',
  sliders: `M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2${c(14, 6, 2)}${c(8, 12, 2)}${c(16, 18, 2)}`,
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  clock: `${c(12, 12, 9)}M12 7v5l3 2`,
  image: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 16l4.5-4.5 4 4 2.5-2.5L20 18' + c(15.5, 8.5, 1.5),
  clip: 'M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L15 6.9',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  repeat: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  'arrow-left': 'M19 12H5M11 6l-6 6 6 6',
  more: `${c(5.5, 12, 1.2)}${c(12, 12, 1.2)}${c(18.5, 12, 1.2)}`,
  grip: `${c(9, 6, 1)}${c(15, 6, 1)}${c(9, 12, 1)}${c(15, 12, 1)}${c(9, 18, 1)}${c(15, 18, 1)}`,
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  copy: 'M8 8h11v11H8zM5 16V5h11',
  layout: 'M4 5h16v14H4zM10 5v14M15 5v14',
  sync: 'M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4',
  cloud: 'M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 9.1 4.5 4.5 0 0 0 7 18z',
  'cloud-off': 'M7 18h10a4 4 0 0 0 1.6-.3M20.4 15A4 4 0 0 0 17.5 10a6 6 0 0 0-8.3-4.6M6.1 9.1A4.5 4.5 0 0 0 7 18M3 3l18 18',
  user: `${c(12, 8, 4)}M4 20a8 8 0 0 1 16 0`,
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 10l5-5 5 5M5 20h14',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  grid: 'M4 4h16v16H4zM4 9.5h16M4 14.5h16M9.5 4v16M14.5 4v16',
  note: 'M5 4h10l4 4v12H5zM15 4v4h4M8 12h8M8 16h5',
  info: `${c(12, 12, 9)}M12 11v5M12 8h.01`,
  inbox: 'M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5',
  sort: 'M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3',
  tag: 'M3 12V4h8l9 9-8 8zM7.5 8h.01',
  target: `${c(12, 12, 8.5)}${c(12, 12, 4.5)}M12 12h.01`,
  split: 'M4 5h16v14H4zM12 5v14',
  eye: `M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z${c(12, 12, 3)}`,
  'eye-off': 'M3 3l18 18M10.6 5.6A10 10 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.9 3.7M6.6 6.6C4 8.3 2.5 12 2.5 12S6 18.5 12 18.5a9.5 9.5 0 0 0 5-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2',
  home: 'M4 11l8-7 8 7M6 9.5V20h12V9.5',
  pen: 'M15.5 4.5l4 4L8 20H4v-4z',
  star: 'M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z',
  layers: 'M12 4l9 5-9 5-9-5zM3 14l9 5 9-5',
  logout: 'M15 4h4v16h-4M10 16l-4-4 4-4M6 12h10',
  bolt: 'M13 3L5 13h6l-1 8 8-10h-6z',
  camera: `M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z${c(12, 13, 3.5)}`,
  hand: 'M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V5a1.5 1.5 0 0 1 3 0v6M14 11V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-.5A5.5 5.5 0 0 1 5.8 17L4 13.6a1.5 1.5 0 0 1 2.6-1.5L8 14',
};

export function Icon({ name, size = 22, stroke = 1.8, class: cls = '', title }) {
  const d = ICONS[name];
  if (!d) return null;
  return html`<svg class=${'ico ' + cls} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden=${title ? undefined : 'true'} role=${title ? 'img' : undefined}>${title ? html`<title>${title}</title>` : null}<path d=${d} /></svg>`;
}
