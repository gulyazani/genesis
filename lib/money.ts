export function usdtToRaw(amount: number) {
  return Math.round(amount * 1e6);
}

export function rawToUsdt(raw: number) {
  return raw / 1e6;
}

export function addUsdt(a: number, b: number) {
  return rawToUsdt(usdtToRaw(a) + usdtToRaw(b));
}

export function subUsdt(a: number, b: number) {
  return rawToUsdt(usdtToRaw(a) - usdtToRaw(b));
}

export function gteUsdt(a: number, b: number) {
  return usdtToRaw(a) >= usdtToRaw(b);
}
