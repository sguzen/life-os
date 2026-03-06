// Marathon training plan — hardcoded source of truth
// Belgrade Marathon, April 19, 2026 — 9 weeks

export const RACE_DATE = new Date('2026-04-19')
export const LIMASSOL_DATE = new Date('2026-03-22')
export const ATHLETE_NAME = 'Silviya'

export type SessionType = 'EASY' | 'VO2_MAX' | 'TEMPO' | 'HILLS' | 'LONG_RUN' | 'REST' | 'RACE' | 'SHAKEOUT'
export type WeekType = 'normal' | 'limassol' | 'post_limassol' | 'peak' | 'taper'

export interface PlannedSession {
  dayOfWeek: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
  type: SessionType
  description: string
  plannedKm: number | null
  paceMin: string | null  // "6:10"
  paceMax: string | null  // "6:30"
  hasStrength: boolean
  strengthWorkout: 'A' | 'B' | null
}

export interface TrainingWeek {
  weekNumber: number
  label: string
  weekType: WeekType
  plannedKm: number
  dateRange: { start: string; end: string }  // ISO dates
  bloodDonationRecovery: boolean
  sessions: PlannedSession[]
}

export const TRAINING_PLAN: TrainingWeek[] = [
  {
    weekNumber: 1,
    label: 'Week 1 (Feb 16-22)',
    weekType: 'normal',
    plannedKm: 71,
    dateRange: { start: '2026-02-16', end: '2026-02-22' },
    bloodDonationRecovery: false,
    sessions: [
      { dayOfWeek: 'Mon', type: 'REST', description: 'Recovery from testing week (10km easy optional)', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Tue', type: 'VO2_MAX', description: '6×1000m @ 4:40/km (2min jog recovery) — 15min WU + strides, 10min CD', plannedKm: 11, paceMin: '4:40', paceMax: '4:40', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Wed', type: 'REST', description: '', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Thu', type: 'TEMPO', description: '10km @ 4:55/km — 2km WU @ 5:30, 2km CD @ 6:15', plannedKm: 14, paceMin: '4:55', paceMax: '4:55', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Fri', type: 'REST', description: '', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Sat', type: 'EASY', description: '8km @ 6:20/km + Strength Workout A (glutes/hips)', plannedKm: 10, paceMin: '6:10', paceMax: '6:30', hasStrength: true, strengthWorkout: 'A' },
      { dayOfWeek: 'Sun', type: 'LONG_RUN', description: '5km@6:20 + 8km@5:00 + 4km@6:20 + 6km@5:00 + 5km@6:20 = 28km. Practice fueling every 5km.', plannedKm: 28, paceMin: '5:00', paceMax: '6:20', hasStrength: false, strengthWorkout: null },
    ],
  },
  {
    weekNumber: 2,
    label: 'Week 2 (Feb 23-Mar 1)',
    weekType: 'normal',
    plannedKm: 48,
    dateRange: { start: '2026-02-23', end: '2026-03-01' },
    bloodDonationRecovery: true,
    sessions: [
      { dayOfWeek: 'Mon', type: 'EASY', description: '9km @ 6:20/km', plannedKm: 9, paceMin: '6:10', paceMax: '6:30', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Tue', type: 'HILLS', description: '10×2min hard uphill, jog down recovery — 10min WU, 10min CD — Effort: 85-90%', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Wed', type: 'REST', description: '', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Thu', type: 'TEMPO', description: '12km @ 4:52/km — 2km WU @ 5:30, 2km CD', plannedKm: 16, paceMin: '4:52', paceMax: '4:52', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Fri', type: 'REST', description: '', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Sat', type: 'EASY', description: '7km @ 6:20/km + Strength Workout B (core/quads)', plannedKm: 7, paceMin: '6:10', paceMax: '6:30', hasStrength: true, strengthWorkout: 'B' },
      { dayOfWeek: 'Sun', type: 'LONG_RUN', description: '16km @ 6:20/km — Fully easy, HR 130-145 bpm', plannedKm: 16, paceMin: '6:10', paceMax: '6:30', hasStrength: false, strengthWorkout: null },
    ],
  },
  {
    weekNumber: 3,
    label: 'Week 3 (Mar 2-8)',
    weekType: 'normal',
    plannedKm: 61,
    dateRange: { start: '2026-03-02', end: '2026-03-08' },
    bloodDonationRecovery: false,
    sessions: [
      { dayOfWeek: 'Mon', type: 'EASY', description: '9km @ 6:20/km', plannedKm: 9, paceMin: '6:10', paceMax: '6:30', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Tue', type: 'VO2_MAX', description: '5×2km @ 4:45/km (2:30 recovery) — 15min WU + strides, 10min CD', plannedKm: null, paceMin: '4:45', paceMax: '4:45', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Wed', type: 'REST', description: '', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Thu', type: 'TEMPO', description: '13km @ 4:52/km — 2km WU @ 5:30, 2km CD', plannedKm: 17, paceMin: '4:52', paceMax: '4:52', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Fri', type: 'REST', description: '', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Sat', type: 'EASY', description: '8km @ 6:20/km + Strength Workout A', plannedKm: 8, paceMin: '6:10', paceMax: '6:30', hasStrength: true, strengthWorkout: 'A' },
      { dayOfWeek: 'Sun', type: 'LONG_RUN', description: '3km@6:20 + 10km@5:00 + 4km@6:20 + 8km@5:00 + 3km@6:20 = 28km. Second 8km block harder (fatigued).', plannedKm: 28, paceMin: '5:00', paceMax: '6:20', hasStrength: false, strengthWorkout: null },
    ],
  },
  {
    weekNumber: 4,
    label: 'Week 4 (Mar 9-15)',
    weekType: 'normal',
    plannedKm: 69,
    dateRange: { start: '2026-03-09', end: '2026-03-15' },
    bloodDonationRecovery: false,
    sessions: [
      { dayOfWeek: 'Mon', type: 'EASY', description: '9km @ 6:20/km', plannedKm: 9, paceMin: '6:10', paceMax: '6:30', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Tue', type: 'HILLS', description: '12×2min hard uphill, jog down — 10min WU, 10min CD — Effort: 90%', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Wed', type: 'EASY', description: '6km @ 6:20/km if feeling fresh (optional)', plannedKm: 6, paceMin: '6:10', paceMax: '6:30', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Thu', type: 'TEMPO', description: '15km @ 4:50/km (LONGEST TEMPO) — 2km WU @ 5:30, 2km CD', plannedKm: 19, paceMin: '4:50', paceMax: '4:50', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Fri', type: 'REST', description: '', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Sat', type: 'EASY', description: '7km @ 6:20/km + Strength Workout B', plannedKm: 7, paceMin: '6:10', paceMax: '6:30', hasStrength: true, strengthWorkout: 'B' },
      { dayOfWeek: 'Sun', type: 'LONG_RUN', description: '30km @ 6:20/km — full recovery long run', plannedKm: 30, paceMin: '6:10', paceMax: '6:30', hasStrength: false, strengthWorkout: null },
    ],
  },
  {
    weekNumber: 5,
    label: 'Week 5 (Mar 16-22) — LIMASSOL',
    weekType: 'limassol',
    plannedKm: 44,
    dateRange: { start: '2026-03-16', end: '2026-03-22' },
    bloodDonationRecovery: false,
    sessions: [
      { dayOfWeek: 'Mon', type: 'EASY', description: '8km @ 6:20/km', plannedKm: 8, paceMin: '6:10', paceMax: '6:30', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Tue', type: 'VO2_MAX', description: '6×1600m @ 4:35/km (90sec recovery) — 15min WU + strides, 10min CD — Sharpening for Limassol', plannedKm: null, paceMin: '4:35', paceMax: '4:35', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Wed', type: 'REST', description: '', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Thu', type: 'TEMPO', description: '10km @ 4:50/km (reduced volume) — 2km WU, 2km CD', plannedKm: 14, paceMin: '4:50', paceMax: '4:50', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Fri', type: 'REST', description: '', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Sat', type: 'RACE', description: 'LIMASSOL HALF MARATHON — Target: 1:44-1:45 (4:55-5:00/km). Strategy: 5:05 first 5km → 5:00 km 5-15 → 4:55 km 15-21.', plannedKm: 21.1, paceMin: '4:55', paceMax: '5:00', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Sun', type: 'REST', description: 'Post-race recovery', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
    ],
  },
  {
    weekNumber: 6,
    label: 'Week 6 (Mar 23-29) — Recovery',
    weekType: 'post_limassol',
    plannedKm: 35,
    dateRange: { start: '2026-03-23', end: '2026-03-29' },
    bloodDonationRecovery: false,
    sessions: [
      { dayOfWeek: 'Mon', type: 'REST', description: '', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Tue', type: 'EASY', description: '6km @ 6:30/km (very easy recovery)', plannedKm: 6, paceMin: '6:20', paceMax: '6:40', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Wed', type: 'REST', description: '', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Thu', type: 'EASY', description: '8km @ 6:20/km', plannedKm: 8, paceMin: '6:10', paceMax: '6:30', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Fri', type: 'REST', description: '', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Sat', type: 'EASY', description: '7km @ 6:20/km + Strength Workout A (back to training)', plannedKm: 7, paceMin: '6:10', paceMax: '6:30', hasStrength: true, strengthWorkout: 'A' },
      { dayOfWeek: 'Sun', type: 'LONG_RUN', description: '14km @ 6:20/km — recovery long run', plannedKm: 14, paceMin: '6:10', paceMax: '6:30', hasStrength: false, strengthWorkout: null },
    ],
  },
  {
    weekNumber: 7,
    label: 'Week 7 (Mar 30-Apr 5) — PEAK',
    weekType: 'peak',
    plannedKm: 77,
    dateRange: { start: '2026-03-30', end: '2026-04-05' },
    bloodDonationRecovery: false,
    sessions: [
      { dayOfWeek: 'Mon', type: 'EASY', description: '9km @ 6:20/km', plannedKm: 9, paceMin: '6:10', paceMax: '6:30', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Tue', type: 'HILLS', description: '10×2min hard uphill (LAST hard hill session) — 10min WU, 10min CD — Effort: 90%', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Wed', type: 'REST', description: '', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Thu', type: 'TEMPO', description: '17km @ 4:48/km (HARDEST SESSION) — 2km WU @ 5:30, 2km CD', plannedKm: 21, paceMin: '4:48', paceMax: '4:48', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Fri', type: 'REST', description: '', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Sat', type: 'EASY', description: '8km @ 6:20/km + Strength Workout B', plannedKm: 8, paceMin: '6:10', paceMax: '6:30', hasStrength: true, strengthWorkout: 'B' },
      { dayOfWeek: 'Sun', type: 'LONG_RUN', description: '5km easy + 10km@5:00 + 5km easy + 10km@5:00 + 5km easy = 35km (PEAK). Third block hardest. Fuel every 5km.', plannedKm: 35, paceMin: '5:00', paceMax: '6:20', hasStrength: false, strengthWorkout: null },
    ],
  },
  {
    weekNumber: 8,
    label: 'Week 8 (Apr 6-12) — Sharpening',
    weekType: 'normal',
    plannedKm: 62,
    dateRange: { start: '2026-04-06', end: '2026-04-12' },
    bloodDonationRecovery: false,
    sessions: [
      { dayOfWeek: 'Mon', type: 'EASY', description: '9km @ 6:20/km', plannedKm: 9, paceMin: '6:10', paceMax: '6:30', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Tue', type: 'VO2_MAX', description: '4×2km @ 4:40/km (2min recovery) — 15min WU + strides, 10min CD — Sharp but not crushing', plannedKm: null, paceMin: '4:40', paceMax: '4:40', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Wed', type: 'REST', description: '', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Thu', type: 'TEMPO', description: '12km @ 4:48/km — 2km WU @ 5:30, 2km CD', plannedKm: 16, paceMin: '4:48', paceMax: '4:48', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Fri', type: 'REST', description: '', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Sat', type: 'EASY', description: '7km @ 6:20/km + Strength Workout A (2 sets, light)', plannedKm: 7, paceMin: '6:10', paceMax: '6:30', hasStrength: true, strengthWorkout: 'A' },
      { dayOfWeek: 'Sun', type: 'LONG_RUN', description: '10km@5:00 + 4km@6:20 + 8km@5:00 = 22km — Reduced volume, taper begins', plannedKm: 22, paceMin: '5:00', paceMax: '6:20', hasStrength: false, strengthWorkout: null },
    ],
  },
  {
    weekNumber: 9,
    label: 'Week 9 (Apr 13-19) — TAPER + RACE',
    weekType: 'taper',
    plannedKm: 20,
    dateRange: { start: '2026-04-13', end: '2026-04-19' },
    bloodDonationRecovery: false,
    sessions: [
      { dayOfWeek: 'Mon', type: 'EASY', description: '6km @ 6:20/km', plannedKm: 6, paceMin: '6:10', paceMax: '6:30', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Tue', type: 'SHAKEOUT', description: '5km @ 5:00/km + 4×200m @ 4:20/km — 2km WU, full recovery, 1km CD — Maintenance pace, feel rhythm', plannedKm: 9, paceMin: '5:00', paceMax: '5:00', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Wed', type: 'REST', description: '', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Thu', type: 'EASY', description: '4km @ 6:20/km', plannedKm: 4, paceMin: '6:10', paceMax: '6:30', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Fri', type: 'REST', description: '', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Sat', type: 'RACE', description: 'BELGRADE MARATHON — Target: 3:32:00 (5:00/km average). Run the plan.', plannedKm: 42.2, paceMin: '5:00', paceMax: '5:00', hasStrength: false, strengthWorkout: null },
      { dayOfWeek: 'Sun', type: 'REST', description: 'Post-marathon recovery', plannedKm: null, paceMin: null, paceMax: null, hasStrength: false, strengthWorkout: null },
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────

/** Returns the week containing a given ISO date string */
export function getWeekForDate(dateStr: string): TrainingWeek | undefined {
  return TRAINING_PLAN.find(
    (w) => dateStr >= w.dateRange.start && dateStr <= w.dateRange.end,
  )
}

/** Returns the planned session for a given ISO date */
export function getSessionForDate(dateStr: string): (PlannedSession & { weekNumber: number }) | undefined {
  const week = getWeekForDate(dateStr)
  if (!week) return undefined
  const date = new Date(dateStr + 'T12:00:00')
  const dayNames: PlannedSession['dayOfWeek'][] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayOfWeek = dayNames[date.getDay()]
  const session = week.sessions.find((s) => s.dayOfWeek === dayOfWeek)
  if (!session) return undefined
  return { ...session, weekNumber: week.weekNumber }
}

/** Returns current week based on today's date */
export function getCurrentWeek(): TrainingWeek | undefined {
  const today = new Date().toISOString().split('T')[0]
  return getWeekForDate(today)
}

/** Returns days until a target date */
export function daysUntil(target: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const t = new Date(target)
  t.setHours(0, 0, 0, 0)
  return Math.ceil((t.getTime() - today.getTime()) / 86400000)
}

/** Parses "M:SS" pace string to total seconds */
export function parsePaceToSeconds(pace: string): number {
  const [m, s] = pace.split(':').map(Number)
  return m * 60 + (s || 0)
}

/** Formats seconds to "M:SS" pace string */
export function formatPace(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Checks if an actual pace is faster than the planned pace min by more than threshold */
export function checkWentTooFast(actualPace: string, plannedPaceMin: string, thresholdSec = 5): { went: boolean; deviationSec: number } {
  const actualSec = parsePaceToSeconds(actualPace)
  const plannedSec = parsePaceToSeconds(plannedPaceMin)
  const deviation = plannedSec - actualSec  // positive = actual is faster
  return { went: deviation > thresholdSec, deviationSec: deviation }
}

/** Session type label */
export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  EASY: 'Easy Run',
  VO2_MAX: 'VO2 Max',
  TEMPO: 'Tempo',
  HILLS: 'Hills',
  LONG_RUN: 'Long Run',
  REST: 'Rest',
  RACE: 'Race',
  SHAKEOUT: 'Shakeout',
}

/** Session type colors for UI */
export const SESSION_TYPE_COLORS: Record<SessionType, string> = {
  EASY: 'text-emerald-400 bg-emerald-400/10',
  VO2_MAX: 'text-blue-400 bg-blue-400/10',
  TEMPO: 'text-orange-400 bg-orange-400/10',
  HILLS: 'text-purple-400 bg-purple-400/10',
  LONG_RUN: 'text-red-400 bg-red-400/10',
  REST: 'text-white/30 bg-white/5',
  RACE: 'text-yellow-400 bg-yellow-400/10',
  SHAKEOUT: 'text-cyan-400 bg-cyan-400/10',
}
