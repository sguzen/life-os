export interface MorningLogInput {
  log_date?: string
  resting_hr_bpm?: number | null
  sleep_hours?: number | null
  sleep_quality?: number | null
  energy_level?: number | null
  mood?: number | null
  body_readiness?: number | null
  woke_easily?: boolean | null
  had_dreams?: boolean | null
  dream_quality?: 'good' | 'neutral' | 'bad' | 'nightmare' | null
  notes?: string | null
}

export interface MorningLog extends MorningLogInput {
  id: string
  user_id: string
  ai_briefing: string | null
  created_at: string
  updated_at: string
}
