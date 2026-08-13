export function copyPaste(n: number): number {
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    const a = i + 1;
    const b = a * 2;
    const c = b - 1;
    if (c > 10) {
      total += c + 3;
    } else {
      total += c;
    }
  }
  return total;
}
