// 학년별 과목(2022 개정 교육과정)과 출판사별 교과서 단원.
// - 고1은 공통과목(1학기 '…1', 2학기 '…2'). 고2·3은 학교마다 고르는 선택과목이라 목록에서 고른다.
// - 단원 이름은 **확인한 것만** 넣는다 (출처를 src에). 확인 못 한 출판사는 교육과정의 큰 단원(영역) 또는
//   '1단원…'으로 두고, 사용자가 진도 › 교재와 단계 고치기 › 단원 이름에서 고칠 수 있다. 지어내지 않는다.
// - 교과서는 '단원' 칸 교재(unit 'ch')로 들어가고, 나누기는 단원 칸 단위로 한다.

import * as C from './core.js';

export const GRADES = [
  [1, '고1'],
  [2, '고2'],
  [3, '고3'],
];

/** 오늘 날짜로 학기 짐작: 3~7월 1학기, 8월~다음 2월 2학기 */
export const guessSem = (iso) => {
  const m = +iso.slice(5, 7);
  return m >= 3 && m <= 7 ? 1 : 2;
};

// ── 교육과정이 정한 큰 단원(영역) — 출판사가 달라도 같다 ──
// 출처: 나무위키 '2022 개정 교육과정' 과목별 문서(공통수학·통합과학·한국사), 비상교육 비바샘 교과서 목차(통합사회)
const CUR = {
  공통수학: {
    1: ['다항식의 연산', '나머지정리', '인수분해', '복소수', '이차방정식', '이차방정식과 이차함수', '여러 가지 방정식', '여러 가지 부등식', '합의 법칙과 곱의 법칙', '순열과 조합', '행렬과 그 연산'],
    2: ['평면좌표', '직선의 방정식', '원의 방정식', '도형의 이동', '집합', '명제', '함수', '유리함수와 무리함수'],
  },
  통합사회: {
    1: ['Ⅰ 통합적 관점', 'Ⅱ 인간, 사회, 환경과 행복', 'Ⅲ 자연환경과 인간', 'Ⅳ 문화와 다양성', 'Ⅴ 생활공간과 사회'],
    2: ['Ⅰ 인권 보장과 헌법', 'Ⅱ 사회 정의와 불평등', 'Ⅲ 시장경제와 지속가능발전', 'Ⅳ 세계화와 평화', 'Ⅴ 미래와 지속가능한 삶'],
  },
  통합과학: {
    1: ['Ⅰ 과학의 기초', 'Ⅱ 물질과 규칙성', 'Ⅲ 시스템과 상호작용'],
    2: ['Ⅰ 변화와 다양성', 'Ⅱ 환경과 에너지', 'Ⅲ 과학과 미래 사회'],
  },
  한국사: {
    1: ['Ⅰ 근대 이전 한국사의 이해', 'Ⅱ 근대 이전 한국사의 탐구', 'Ⅲ 근대 국가 수립의 노력'],
    2: ['Ⅰ 일제 식민 통치와 민족운동', 'Ⅱ 대한민국의 발전', 'Ⅲ 오늘날의 대한민국'],
  },
};
const nums = (n, word = '단원') => Array.from({ length: n }, (_, i) => `${i + 1}${word}`);
const lessons = (n) => Array.from({ length: n }, (_, i) => `Lesson ${i + 1}`);

/**
 * 고1 공통과목. pubs: [id, 출판사(저자), { 1: 단원[], 2: 단원[] }(확인한 것만), 출처]
 * 출판사 목록 출처: 2024.8.30 교과용도서 검정 합격 (나무위키 과목별 문서·각 출판사 누리집)
 */
export const G1 = [
  {
    name: '공통국어', h: 300, pace: 60,
    fallback: { 1: nums(5), 2: nums(5) },
    pubs: [
      ['bisang-pym', '비상교육 (박영민)', { 1: ['1-1 서정 갈래', '1-2 서사 갈래', '1-3 극 갈래', '1-4 교술 갈래', '2-1 음운의 변동', '2-2 공동체와 의사소통', '3-1 문학으로 소통하기', '3-2 독서, 삶의 길 찾기', '4-1 비판적 읽기와 주체적 수용', '4-2 토론으로 해결 방안 탐색하기', '5-1 언어 실천 양상과 문법 요소', '5-2 사회적 쟁점에 대한 글 쓰기'] }, '비바샘 공통국어1(박영민)'],
      ['bisang-khy', '비상교육 (강호영)'],
      ['chunjae-ksh', '천재교과서 (김수학)'],
      ['chunjae-kjc', '천재교과서 (김종철)'],
      ['donga', '동아출판 (최두호)'],
      ['haenam', '해냄에듀 (임광찬)'],
      ['changbi', '창비 (최원식)'],
      ['jihak', '지학사 (김철회)'],
      ['mirae', '미래엔 (신유식)'],
    ],
  },
  {
    name: '공통수학', h: 226, pace: 60,
    fallback: CUR.공통수학,
    pubs: [
      ['mirae', '미래엔'],
      ['bisang', '비상교육'],
      ['chunjae-hjg', '천재교과서 (홍진곤)'],
      ['chunjae-jit', '천재교과서 (전인태)'],
      ['donga', '동아출판'],
      ['jihak', '지학사'],
      ['ybm', 'YBM'],
      ['mata', '마타에듀'],
    ],
  },
  {
    name: '공통영어', h: 262, pace: 60,
    fallback: { 1: lessons(4), 2: lessons(4) },
    pubs: [
      ['ne-mbc', 'NE능률 (민병천)', { 1: ['L1 Getting to Know Yourself', 'L2 Caring Hearts', 'SL1 The True Treasure', 'L3 How Our Body Works', 'L4 The Future Ahead of Us', 'SL2 Ready to Be Wicked'], 2: ['L1 Bonding with Others', 'L2 What Keeps Us Moving Forward', 'L3 Knowing Ourselves, Knowing Others', 'L4 Toward Sustainability'] }, 'NE능률 교과서 목차 · 공통영어2 본문 자료'],
      ['ne-osy', 'NE능률 (오선영)', { 1: ['L1 A Journey into Yourself', 'L2 Health Matters!', 'L3 Nature & Us', 'L4 The Winds of Change', 'SL Two Thanksgiving Day Gentlemen'], 2: ['L1 Embrace Connections', 'L2 From Problems to Solutions', 'L3 Our Heritage, Our Treasure', 'L4 Good for All of Us'] }, 'NE능률 교과서 목차 · 공통영어2 본문 자료'],
      ['ybm-pje', 'YBM (박준언)', { 1: ['L1 Enrich Your Life', 'L2 Explore Wildlife Wonders', 'L3 Embrace Diversity, Broaden Your Horizons', 'L4 When Art Meets Technology'], 2: ['L1 Be Digitally Smart!', 'L2 Urgent Call From Earth', 'L3 Rise Above Challenges', 'L4 Creative Ideas for a Better World'] }, '클래스카드 · 공통영어2 본문 자료'],
      ['ybm-keh', 'YBM (김은형)', { 1: ['L1 Believe That You Can Do Better', 'L2 Art and the City', 'P1 Digital Devices and Physical Health', 'L3 Living Green', 'L4 Be Smart in the Digital World', 'P2 Cooking and Eating for the Planet'] }, '클래스카드·기출문제집 목차'],
      ['mirae', '미래엔 (김성연)', { 2: ['L1 We Share, We Care', 'L2 Be a Wise Consumer', 'L3 The True Art Lovers', 'L4 Sink or Swim in the Digital Ocean'] }, '공통영어2 본문 자료'],
      ['donga', '동아출판 (이병민)'],
      ['chunjae-ksg', '천재교과서 (강상구)'],
      ['chunjae-csk', '천재교과서 (조수경)'],
      ['bisang', '비상교육'],
      ['jihak', '지학사'],
    ],
  },
  {
    name: '한국사', h: 36, pace: 90,
    fallback: CUR.한국사,
    pubs: [['donga', '동아출판'], ['bisang', '비상교육'], ['jihak', '지학사'], ['liber', '리베르스쿨'], ['haenam', '해냄에듀'], ['chunjae', '천재교과서'], ['cmass', '씨마스'], ['mirae', '미래엔']],
  },
  {
    name: '통합사회', h: 14, pace: 60,
    fallback: CUR.통합사회,
    pubs: [
      ['bisang', '비상교육 (이영호)', {
        1: ['Ⅰ-1 다양한 관점', 'Ⅰ-2 통합적 관점', 'Ⅱ-1 행복의 의미와 기준', 'Ⅱ-2 행복한 삶의 조건', 'Ⅲ-1 자연환경과 인간 생활', 'Ⅲ-2 인간과 자연의 관계', 'Ⅲ-3 환경 문제 해결 노력', 'Ⅳ-1 세계의 다양한 문화권', 'Ⅳ-2 문화 변동과 전통문화', 'Ⅳ-3 문화 상대주의와 보편 윤리', 'Ⅳ-4 다문화 사회', 'Ⅴ-1 산업화와 도시화', 'Ⅴ-2 교통·통신과 과학기술', 'Ⅴ-3 우리 지역의 공간 변화'],
        2: ['Ⅰ-1 인권의 의미와 발전', 'Ⅰ-2 헌법의 역할과 시민 참여', 'Ⅰ-3 인권 문제 해결 노력', 'Ⅱ-1 정의의 의미와 기준', 'Ⅱ-2 다양한 정의관', 'Ⅱ-3 불평등 해결과 정의', 'Ⅲ-1 자본주의와 경제 체제', 'Ⅲ-2 합리적 선택과 경제 주체', 'Ⅲ-3 자산 관리와 금융 생활', 'Ⅲ-4 국제 무역과 지속가능발전', 'Ⅳ-1 세계화의 양상과 문제', 'Ⅳ-2 평화를 위한 국제 사회', 'Ⅳ-3 남북 분단과 동아시아 갈등', 'Ⅴ-1 세계의 인구 문제', 'Ⅴ-2 에너지 자원과 지속가능', 'Ⅴ-3 미래 사회와 세계시민'],
      }, '비바샘 통합사회1·2(이영호) 목차'],
      ['chunjae', '천재교과서 (박윤경)'],
      ['donga', '동아출판 (구정화)'],
      ['mirae', '미래엔 (조지욱)'],
    ],
  },
  {
    name: '통합과학', h: 150, pace: 120,
    fallback: CUR.통합과학,
    pubs: [['mirae', '미래엔'], ['bisang', '비상교육 (심규철)'], ['chunjae', '천재교과서 (신영준)'], ['donga', '동아출판'], ['jihak', '지학사']],
  },
  { name: '과학탐구실험', h: 182, pace: 60, fallback: { 1: nums(4), 2: nums(4) }, pubs: [], optional: true },
];

/** 고2·3 선택과목 (2022 개정 일반선택). 학교마다 다르니 고른다. 단원은 '1단원…'(교재 넣을 때 고침) */
export const ELECTIVES = [
  ['국어', ['화법과 언어', '독서와 작문', '문학']],
  ['수학', ['대수', '미적분Ⅰ', '확률과 통계']],
  ['영어', ['영어Ⅰ', '영어Ⅱ', '영어 독해와 작문']],
  ['사회', ['세계시민과 지리', '세계사', '사회와 문화', '현대사회와 윤리']],
  ['과학', ['물리학', '화학', '생명과학', '지구과학']],
];
const EL_HUE = { 국어: 300, 수학: 226, 영어: 262, 사회: 14, 과학: 150 };

/** 학년·학기에 맞는 과목 추천: [{ name, h, book, optional }] */
export function recommend(grade, sem) {
  if (grade === 1) return G1.map((s) => ({ name: s.name, h: s.h, book: `${s.name}${sem}`, optional: !!s.optional }));
  return ELECTIVES.flatMap(([area, list]) => list.map((n) => ({ name: n, h: EL_HUE[area], book: n, optional: true, area })));
}

/** 과목의 출판사 목록 ([id, 이름]). 마지막에 '모름·다른 교과서' */
export function publishers(subName) {
  const s = G1.find((x) => x.name === subName);
  return [...(s ? s.pubs.map((p) => [p[0], p[1]]) : []), ['other', '모름 · 다른 교과서']];
}

/**
 * 교과서 단원 목록. 돌려줌: { labels, verified(확인한 목차인가), src, pace(단원당 분) }
 * 확인한 출판사 목차 → 교육과정 큰 단원 → '1단원…' 순서로.
 */
export function units(subName, sem, pubId) {
  const s = G1.find((x) => x.name === subName);
  if (!s) return { labels: nums(5), verified: false, src: '', pace: 60 };
  const p = s.pubs.find((x) => x[0] === pubId);
  if (p && p[2] && p[2][sem]) return { labels: p[2][sem], verified: true, src: p[3] || '', pace: s.pace };
  const fb = s.fallback[sem] || nums(5);
  return { labels: fb, verified: CUR[subName] ? 'curriculum' : false, src: CUR[subName] ? '교육과정 큰 단원' : '', pace: CUR[subName] && fb.length <= 5 ? s.pace * 2 : s.pace };
}

/**
 * 시험 범위 짐작: 중간고사는 앞 절반, 기말고사는 뒤 절반, 모의고사·기간은 전부. 돌려줌: [from, to] (1부터)
 * 짐작일 뿐이라 처음 설정에서 바로 고칠 수 있다.
 */
export function scopeGuess(n, kind) {
  if (n <= 1) return [1, Math.max(1, n)];
  const half = Math.ceil(n / 2);
  if (kind === 'mid') return [1, half];
  if (kind === 'final') return [half + 1 > n ? 1 : half + 1, n];
  return [1, n];
}

/** 과목 한 줄을 실제 과목·교과서로 */
export function makeSubject(row, sem) {
  const u = units(row.name, sem, row.pub || 'other');
  const s = C.newSubject(row.name, row.h);
  const n = u.labels.length;
  const pubName = (publishers(row.name).find((p) => p[0] === row.pub) || [])[1];
  const b = { id: C.uid(), name: '교과서', kind: '개념', unit: 'ch', from: Math.max(1, Math.min(row.from || 1, n)), to: Math.max(1, Math.min(row.to || n, n)), labels: [...u.labels], pace: u.pace };
  if (b.from > b.to) b.from = b.to;
  if (pubName && row.pub !== 'other') b.pub = pubName;
  s.books = [b];
  s.stages = C.stagesFor(s, 'mine');
  return s;
}
