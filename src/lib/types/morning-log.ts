export interface MorningLogInput {
  log_date?: string
  sleep_hours?: number | null
  rhr?: number | null
  hrv?: number | null
  mood_score?: number | null
  energy_level?: number | null
  journal_notes?: string | null
}

export interface MorningLog extends MorningLogInput {
  id: string
  user_id: string
  created_at: string
  updated_at: string
}
