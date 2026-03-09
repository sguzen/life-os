export interface CoachTaskInput {
  title: string
  notes?: string | null
  due_date?: string | null       // ISO date string YYYY-MM-DD
  due_time?: string | null       // HH:MM 24h
  recurrence?: 'none' | 'daily' | 'weekly' | 'weekdays'
  module?: 'general' | 'training' | 'nutrition' | 'trading' | 'health' | 'personal'
  source?: 'user' | 'ai_coach'
  coach_context?: string | null
}

export interface CoachTask extends CoachTaskInput {
  id: string
  user_id: string
  completed_at: string | null
  snoozed_until: string | null
  created_at: string
  updated_at: string
}
