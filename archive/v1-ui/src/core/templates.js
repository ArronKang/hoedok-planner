// 회독 템플릿과 과목 프리셋

export const TRACK_TEMPLATES = [
  {
    id: 'basic',
    name: '기본 회독',
    desc: '개념 → 기본문제 → 개념 → 심화 → 기출 → 최상위',
    form: 'linear',
    sections: ['1회독 · 개념', '2회독 · 기본문제', '3회독 · 개념', '4회독 · 심화문제', '5회독 · 기출', '6회독 · 최상위'],
  },
  {
    id: 'memorize',
    name: '암기형 (사회·과학·역사)',
    desc: '교과서 → 자습서 → 문제집 → 기출 → 요약 점검',
    form: 'linear',
    sections: ['1회독 · 교과서 개념', '2회독 · 자습서', '3회독 · 문제집', '4회독 · 기출', '5회독 · 요약 점검'],
  },
  {
    id: 'korean',
    name: '국어형',
    desc: '본문 분석 → 자습서 → 문제집 → 기출·변형',
    form: 'linear',
    sections: ['1회독 · 본문 분석', '2회독 · 자습서', '3회독 · 문제집', '4회독 · 기출·변형'],
  },
  {
    id: 'english',
    name: '영어형 (격자)',
    desc: '지문 × 회독 — 해석 → 어법·어휘 → 빈칸·순서 → 변형문제',
    form: 'grid',
    rounds: ['1회독 · 해석', '2회독 · 어법·어휘', '3회독 · 빈칸·순서', '4회독 · 변형문제'],
  },
];

export function templateById(id) {
  return TRACK_TEMPLATES.find((t) => t.id === id) || null;
}

// 2022 개정 교육과정 고1 공통과목 기준 (학점은 학교마다 달라서 수정 가능)
export const SUBJECT_PRESETS = [
  { name: '공통국어', group: '국어', credits: 4, category: 'grade', template: 'korean', color: 'red' },
  { name: '공통수학', group: '수학', credits: 4, category: 'grade', template: 'basic', color: 'blue' },
  { name: '공통영어', group: '영어', credits: 4, category: 'grade', template: 'english', color: 'violet' },
  { name: '한국사', group: '사회(역사/도덕 포함)', credits: 3, category: 'grade', template: 'memorize', color: 'brown' },
  { name: '통합사회', group: '사회(역사/도덕 포함)', credits: 4, category: 'grade', template: 'memorize', color: 'orange' },
  { name: '통합과학', group: '과학', credits: 4, category: 'grade', template: 'memorize', color: 'mint' },
  { name: '과학탐구실험', group: '과학', credits: 1, category: 'achievement', template: 'memorize', color: 'green' },
  { name: '정보', group: '기술·가정/정보', credits: 2, category: 'grade', template: 'basic', color: 'sky' },
  { name: '체육', group: '체육', credits: 2, category: 'achievement', template: null, color: 'yellow' },
  { name: '음악', group: '예술', credits: 2, category: 'achievement', template: null, color: 'pink' },
  { name: '미술', group: '예술', credits: 2, category: 'achievement', template: null, color: 'olive' },
];

export const SUBJECT_GROUPS = ['국어', '수학', '영어', '사회(역사/도덕 포함)', '과학', '체육', '예술', '기술·가정/정보', '제2외국어/한문', '교양'];

// 하루 마감에서 한 번 탭으로 남기는 이유 (선택)
export const MOVE_REASONS = ['시간 부족', '계획이 많았음', '집중이 안 됨', '급한 일이 생김', '컨디션', '필요 없어짐'];

// 오답 원인 (5종 고정)
export const WRONG_CAUSES = [
  { id: 'concept', label: '개념' },
  { id: 'mistake', label: '실수' },
  { id: 'time', label: '시간 부족' },
  { id: 'notstudied', label: '안 한 범위' },
  { id: 'new', label: '처음 보는 유형' },
];

export function causeLabel(id) {
  const c = WRONG_CAUSES.find((x) => x.id === id);
  return c ? c.label : id;
}

export const MOCK_ORGANIZERS = ['교육청', '평가원', '사설'];
