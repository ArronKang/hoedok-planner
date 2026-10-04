// 한글 글꼴: 미리 고른 것 중에서만 (원칙 4: 무엇을 골라도 보기 좋게). 이 기기에만 저장 (prefs.font).
// - 프리텐다드는 index.html이 늘 불러 두고, 나머지는 고를 때 Google Fonts에서 불러온다.
//   한글 글꼴은 글자 묶음별로 잘게 나뉘어 있어서 화면에 나온 글자 묶음만 받는다.
// - 한 번 받은 글꼴 파일은 서비스 워커가 저장해 두어 인터넷 없이도 보인다 (sw.js RUNTIME_HOSTS).
// - 글꼴마다 같은 크기라도 커 보이거나 작아 보여서, 화면에서 비슷한 크기로 보이게 css의 --fz로 맞춘다.
// 글꼴 모양(font-family)은 styles/app.css의 .device[data-font=…]에 있다.

// 고른 기준: 작은 글씨(12~13px)에서도 읽히는가, 굵은 글씨가 있는가, 서로 충분히 다른가.
// 휴대폰에서 직접 비교해 해바라기(작은 글씨에서 흐림)·나눔명조(획이 가늚)·IBM 플렉스(본고딕과 비슷함)는 뺐다.
export const FONTS = [
  { id: 'pretendard', name: '프리텐다드', desc: '또렷하고 깔끔한 기본 글꼴' },
  { id: 'system', name: '기기 글꼴', desc: '이 기기에 설정해 둔 글꼴 그대로' },
  { id: 'noto', name: '본고딕', desc: '어느 기기에서나 똑같이 보이는', g: 'Noto+Sans+KR:wght@300..800' },
  { id: 'nanum', name: '나눔고딕', desc: '눈에 익은 반듯한 글꼴', g: 'Nanum+Gothic:wght@400;700;800' },
  { id: 'gowun', name: '고운돋움', desc: '얌전하고 따뜻한', g: 'Gowun+Dodum' },
  { id: 'hahmlet', name: '함렛', desc: '책처럼 읽히는 또렷한 명조', g: 'Hahmlet:wght@300..800' },
  { id: 'batang', name: '고운바탕', desc: '부드러운 바탕체', g: 'Gowun+Batang:wght@400;700' },
  { id: 'gaegu', name: '개구', desc: '손으로 쓴 듯한', g: 'Gaegu:wght@300;400;700' },
];

const GF = 'https://fonts.googleapis.com/css2?';
const family = (f) => f.g.split(':')[0];

export const fontById = (id) => FONTS.find((f) => f.id === id) || FONTS[0];

/** 고른 글꼴의 글꼴 파일 목록(css)을 한 번만 붙인다 */
export function ensureFont(id) {
  const f = fontById(id);
  if (!f.g || typeof document === 'undefined') return;
  const lid = 'font-' + f.id;
  if (document.getElementById(lid)) return;
  const l = document.createElement('link');
  l.id = lid;
  l.rel = 'stylesheet';
  l.crossOrigin = 'anonymous';
  l.href = `${GF}family=${f.g}&display=swap`;
  document.head.appendChild(l);
}

let previews = null;
/**
 * 글꼴 고르는 목록용: 각 글꼴 이름과 설명을 그 글꼴로 보여 준다.
 * 그 글자만 담은 아주 작은 파일을 'pv-아이디'라는 이름으로 따로 등록 → 실제로 쓰는 글꼴과 섞이지 않는다.
 */
export function loadPreviews() {
  if (previews || typeof document === 'undefined' || typeof FontFace === 'undefined') return previews;
  const fams = FONTS.filter((f) => f.g);
  const text = [...new Set(FONTS.map((f) => f.name + f.desc).join(''))].join('');
  const url = `${GF}${fams.map((f) => 'family=' + family(f)).join('&')}&text=${encodeURIComponent(text)}`;
  previews = fetch(url)
    .then((r) => (r.ok ? r.text() : ''))
    .then((css) => {
      const jobs = [];
      for (const m of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
        const fam = (m[1].match(/font-family:\s*['"]([^'"]+)['"]/) || [])[1];
        const src = (m[1].match(/url\(([^)]+)\)/) || [])[1];
        const f = fams.find((x) => family(x).replace(/\+/g, ' ') === fam);
        if (!f || !src) continue;
        const face = new FontFace('pv-' + f.id, `url(${src.replace(/['"]/g, '')})`);
        document.fonts.add(face);
        jobs.push(face.load().catch(() => null));
      }
      return Promise.all(jobs);
    })
    .catch(() => {
      previews = null; // 인터넷이 없으면 다음에 다시
    });
  return previews;
}

/** 목록에서 그 글꼴로 보이게 할 font-family */
export const previewFamily = (f) => (f.id === 'pretendard' ? "'Pretendard Variable', Pretendard, sans-serif" : f.id === 'system' ? 'system-ui, -apple-system, sans-serif' : `'pv-${f.id}', 'Pretendard Variable', sans-serif`);
