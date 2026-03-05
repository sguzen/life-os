// P4: TypeScript types for running module

export type WorkoutType =
  | 'easy'
  | 'long_run'
  | 'tempo'
  | 'threshold'
  | 'interval'
  | 'recovery'
  | 'race'
  | 'other'

export interface RunningActivity {
  id: string
  user_id: string
  started_at: string          // ISO timestamptz
  name: string | null
  workout_type: WorkoutType
  distance_meters: number
  duration_seconds: number
  avg_pace_sec_per_km: number | null
  prescribed_pace_sec_per_km: number | null
  avg_hr: number | null
  max_hr: number | null
  resting_hr: number | null
  elevation_gain_m: number | null
  elevation_loss_m: number | null
  avg_cadence: number | null
  avg_stride_length_m: number | null
  calories: number | null
  notes: string | null
  fit_filename: string | null
  created_at: string
  updated_at: string
}

export interface RunningLap {
  id: string
  user_id: string
  activity_id: string
  lap_number: number
  start_time: string | null
  distance_meters: number
  duration_seconds: number
  avg_pace_sec_per_km: number | null
  avg_hr: number | null
  max_hr: number | null
  elevation_gain_m: number | null
  avg_cadence: number | null
  created_at: string
}

export interface RestingHrLog {
  id: string
  user_id: string
  logged_date: string         // YYYY-MM-DD
  resting_hr: number
  source: 'garmin' | 'manual'
  is_spike: boolean
  notes: string | null
  created_at: string
}

export interface RaceTarget {
  id: string
  user_id: string
  race_name: string
  location: string | null
  race_date: string           // YYYY-MM-DD
  distance_km: number
  target_time_seconds: number
  target_pace_sec_per_km: number | null  // GENERATED column
  actual_time_seconds: number | null
  activity_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}
