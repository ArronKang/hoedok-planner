// 충돌 가능성이 매우 낮은 무작위 ID (보안 컨텍스트가 아니어도 동작)
const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyz';

export function uid(len = 16) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHA[bytes[i] % 36];
  return s;
}
