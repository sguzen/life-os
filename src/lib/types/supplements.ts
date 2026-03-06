// Supplement Manager — TypeScript Types

export type FrequencyType =
  | 'daily'
  | 'every_other_day'
  | 'weekly'
  | 'twice_weekly'
  | 'three_times_weekly'
  | 'custom'

export type TimingType =
  | 'morning'
  | 'evening'
  | 'with_food'
  | 'before_bed'
  | 'post_workout'
  | 'any'

export type ChangedBy = 'user' | 'ai_coach' | 'adaptation_engine' | 'system'

export interface Supplement {
  id: string
  user_id: string
  name: string
  brand: string | null
  dose_amount: number | null
  dose_unit: string | null
  dose_count: number | null

  frequency: FrequencyType
  frequency_days: number[] | null        // for 'custom': [1,3,5] = Mon/Wed/Fri (0=Sun)
  frequency_times_per_week: number | null

  timing: TimingType | null
  timing_notes: string | null
  take_with_food: boolean

  has_duration: boolean
  start_date: string | null              // YYYY-MM-DD
  end_date: string | null               // YYYY-MM-DD, null = indefinite
  duration_days: number | null
  duration_notes: string | null

  is_active: boolean
  is_paused: boolean
  pause_reason: string | null
  paused_at: string | null
  resume_at: string | null

  prescribed_by: string | null
  prescribed_for: string | null
  notes: string | null

  blood_donation_override: boolean

  created_at: string
  updated_at: string
}

export type SupplementInput = Omit<Supplement, 'id' | 'user_id' | 'created_at' | 'updated_at'>
export type SupplementUpdate = Partial<SupplementInput>

export interface SupplementLogEntry {
  id: string
  user_id: string
  supplement_id: string
  log_date: string                       // YYYY-MM-DD
  taken: boolean
  taken_at: string | null
  skipped_reason: string | null
  notes: string | null
  created_at: string
}

export interface SupplementChange {
  id: string
  supplement_id: string
  user_id: string
  changed_at: string
  change_type: string | null
  previous_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  reason: string | null
  changed_by: ChangedBy
}

// Derived / UI helpers

export const FREQUENCY_LABELS: Record<FrequencyType, string> = {
  daily: 'Daily',
  every_other_day: 'Every other day',
  weekly: 'Weekly',
  twice_weekly: '2× per week',
  three_times_weekly: '3× per week',
  custom: 'Custom days',
}

export const TIMING_LABELS: Record<TimingType, string> = {
  morning: 'Morning',
  evening: 'Evening',
  with_food: 'With food',
  before_bed: 'Before bed',
  post_workout: 'Post-workout',
  any: 'Any time',
}

export const DOSE_UNITS = ['mg', 'mcg', 'IU', 'tablet', 'sachet', 'scoop', 'ml', 'g'] as const

/** Returns true if this supplement should be taken on the given date */
export function shouldTakeToday(
  supplement: Supplement,
  date: Date,
  bloodDonationRecoveryActive: boolean
): boolean {
  // Inactive or paused
  if (!supplement.is_active || supplement.is_paused) return false

  // Expired?
  if (supplement.has_duration && supplement.end_date) {
    if (date > new Date(supplement.end_date)) return false
  }

  // Blood donation override → always daily during recovery
  if (supplement.blood_donation_override && bloodDonationRecoveryActive) return true

  const dow = date.getDay() // 0=Sun … 6=Sat

  switch (supplement.frequency) {
    case 'daily':
      return true

    case 'every_other_day': {
      if (!supplement.start_date) return true
      const start = new Date(supplement.start_date)
      const diffDays = Math.floor((date.getTime() - start.getTime()) / 86400000)
      return diffDays % 2 === 0
    }

    case 'weekly':
      // Default Monday (1) if no preferred day set
      return dow === 1

    case 'twice_weekly':
      return [1, 4].includes(dow)   // Mon + Thu

    case 'three_times_weekly':
      return [1, 3, 5].includes(dow) // Mon + Wed + Fri

    case 'custom':
      return supplement.frequency_days?.includes(dow) ?? false

    default:
      return false
  }
}

/** Returns progress percentage (0-100) for duration-based supplements */
export function getDurationProgress(supplement: Supplement): number | null {
  if (!supplement.has_duration || !supplement.start_date || !supplement.duration_days) return null
  const start = new Date(supplement.start_date)
  const now = new Date()
  const elapsed = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000))
  return Math.min(100, Math.round((elapsed / supplement.duration_days) * 100))
}

/** Returns days remaining in a duration-based supplement */
export function getDaysRemaining(supplement: Supplement): number | null {
  if (!supplement.has_duration || !supplement.end_date) return null
  const end = new Date(supplement.end_date)
  const now = new Date()
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000))
}

/** Format dose for display: "50,000 IU" or "2 tablets" */
export function formatDose(supplement: Supplement): string {
  const parts: string[] = []
  if (supplement.dose_amount) {
    parts.push(supplement.dose_amount.toLocaleString())
  }
  if (supplement.dose_unit) {
    const count = supplement.dose_count ?? 1
    if (supplement.dose_amount) {
      parts.push(supplement.dose_unit)
    } else {
      parts.push(`${count} ${supplement.dose_unit}`)
    }
  }
  return parts.join(' ') || ''
}
