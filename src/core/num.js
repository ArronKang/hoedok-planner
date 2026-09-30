// 숫자 반올림/표시 도우미

/** 사사오입(반올림). 부동소수 오차(28.889999…)를 흡수한다. */
export function roundHalfUp(x, digits = 0) {
  if (x == null || !isFinite(x)) return x;
  const sign = x < 0 ? -1 : 1;
  const v = Math.abs(x);
  const r = Number(Math.round(Number(v.toPrecision(15) + 'e' + digits)) + 'e-' + digits);
  return sign * r;
}

/** 표시용: 소수 digits자리까지, 뒤의 0은 유지하지 않음 */
export function fmtNum(x, digits = 1) {
  if (x == null || !isFinite(x)) return '–';
  const r = roundHalfUp(x, digits);
  return r.toLocaleString('ko-KR', { maximumFractionDigits: digits });
}

/** 표시용: 소수 digits자리 고정 */
export function fmtFixed(x, digits = 2) {
  if (x == null || !isFinite(x)) return '–';
  return roundHalfUp(x, digits).toFixed(digits);
}

/** 부호 붙은 표시(+1.2 / −0.81 / ±0). fixed=true면 소수 자릿수 고정 */
export function fmtSigned(x, digits = 2, fixed = false) {
  if (x == null || !isFinite(x)) return '–';
  const r = roundHalfUp(x, digits);
  if (r === 0) return '±0';
  const abs = fixed ? Math.abs(r).toFixed(digits) : fmtNum(Math.abs(r), digits);
  return (r > 0 ? '+' : '−') + abs;
}

export function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

/** 문자열 입력 → 숫자 (빈칸은 null) */
export function toNum(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/,/g, '').trim());
  return isFinite(n) ? n : null;
}

export function sum(arr, f = (x) => x) {
  let s = 0;
  for (const x of arr) s += f(x) || 0;
  return s;
}
