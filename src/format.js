export function formatTime(ms) {
  const total = Math.max(ms, 0) / 1000
  const m = Math.floor(total / 60)
  const s = total - m * 60
  return `${m}:${s.toFixed(2).padStart(5, '0')}`
}
