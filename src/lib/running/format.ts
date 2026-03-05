// Formatting helpers for running metrics

/** Format seconds-per-km as "M:SS /km" */
export function formatPace(secPerKm: number | null | undefined): string {
  if (!secPerKm) return '—'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')} /km`
}

/** Format total seconds as "H:MM:SS" or "M:SS" */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Format metres as "X.XX km" */
export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(2)} km`
}

/** Compute pace difference in sec/km; positive = slower than prescribed */
export function paceDiff(
  actual: number | null,
  prescribed: number | null,
): number | null {
  if (actual == null || prescribed == null) return null
  return actual - prescribed
}

/** Format pace diff as "+M:SS" or "-M:SS" or "on target" */
export function formatPaceDiff(diffSecPerKm: number | null): string {
  if (diffSecPerKm == null) return '—'
  if (Math.abs(diffSecPerKm) < 3) return 'on target'
  const sign = diffSecPerKm > 0 ? '+' : '-'
  const abs = Math.abs(Math.round(diffSecPerKm))
  const m = Math.floor(abs / 60)
  const s = abs % 60
  return `${sign}${m}:${s.toString().padStart(2, '0')}`
}

/** Days until a future date */
export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}
