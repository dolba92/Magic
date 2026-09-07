export function toReadingPercent(ratio: number, reachedEnd = false) {
  if (reachedEnd) return 100;
  const safeRatio = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  return Math.min(99, Math.floor(safeRatio * 100));
}
