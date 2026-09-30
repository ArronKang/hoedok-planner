// 날짜는 모두 로컬 기준 'YYYY-MM-DD' 문자열(키)로 다룬다. 시간대 변환을 하지 않는다.

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const pad2 = (n) => String(n).padStart(2, '0');

export function toKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

export function fromKey(key) {
  const { y, m, d } = parseKey(key);
  return new Date(y, m - 1, d);
}

export function isKey(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

const utc = (key) => {
  const { y, m, d } = parseKey(key);
  return Date.UTC(y, m - 1, d);
};

export function addDays(key, n) {
  const t = new Date(utc(key) + n * 86400000);
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

/** b - a (일). a, b는 키 */
export function diffDays(a, b) {
  return Math.round((utc(b) - utc(a)) / 86400000);
}

export function weekday(key) {
  return new Date(utc(key)).getUTCDay();
}

/**
 * '논리적 오늘': 하루가 dayStartHour시에 바뀐다고 볼 때의 날짜.
 * 예) 기준 4시, 새벽 1시 → 전날 날짜.
 */
export function logicalToday(dayStartHour = 0, now = new Date()) {
  const shifted = new Date(now.getTime() - dayStartHour * 3600000);
  return toKey(shifted);
}

export function rangeKeys(a, b) {
  const out = [];
  if (!a || !b || a > b) return out;
  for (let k = a; k <= b; k = addDays(k, 1)) out.push(k);
  return out;
}

export function startOfWeek(key, weekStartsOn = 0) {
  const wd = weekday(key);
  return addDays(key, -((wd - weekStartsOn + 7) % 7));
}

export function monthKey(key) {
  return key.slice(0, 7);
}

/** 달력용 주 배열. month: 'YYYY-MM' */
export function monthMatrix(month, weekStartsOn = 0) {
  const first = `${month}-01`;
  const start = startOfWeek(first, weekStartsOn);
  const { y, m } = parseKey(first);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${pad2(m + 1)}-01`;
  const weeks = [];
  let k = start;
  while (k < nextMonth || weeks.length === 0) {
    const w = [];
    for (let i = 0; i < 7; i++) {
      w.push(k);
      k = addDays(k, 1);
    }
    weeks.push(w);
  }
  return weeks;
}

export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${pad2((idx % 12) + 1)}`;
}

export function formatMD(key) {
  const { m, d } = parseKey(key);
  return `${m}월 ${d}일`;
}

export function formatMDW(key) {
  return `${formatMD(key)} (${WEEKDAYS[weekday(key)]})`;
}

export function formatShort(key) {
  const { m, d } = parseKey(key);
  return `${m}/${d}`;
}

export function formatShortW(key) {
  return `${formatShort(key)}(${WEEKDAYS[weekday(key)]})`;
}

export function formatYMD(key) {
  const { y, m, d } = parseKey(key);
  return `${y}. ${m}. ${d}.`;
}

export function formatMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return `${y}년 ${m}월`;
}

/** D-day 라벨. diff = 시험일 - 오늘 */
export function ddayLabel(diff) {
  if (diff === 0) return 'D-DAY';
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

export function minutesLabel(min) {
  if (min == null || isNaN(min)) return '';
  const m = Math.round(min);
  const h = Math.floor(Math.abs(m) / 60);
  const r = Math.abs(m) % 60;
  const sign = m < 0 ? '-' : '';
  if (h === 0) return `${sign}${r}분`;
  if (r === 0) return `${sign}${h}시간`;
  return `${sign}${h}시간 ${r}분`;
}

/** 'HH:MM' → 분 */
export function timeToMin(t) {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minToTime(min) {
  const h = Math.floor(min / 60) % 24;
  return `${pad2(h)}:${pad2(min % 60)}`;
}

export function relativeDayLabel(key, today) {
  const d = diffDays(today, key);
  if (d === 0) return '오늘';
  if (d === 1) return '내일';
  if (d === -1) return '어제';
  if (d === 2) return '모레';
  return null;
}
