// P4: Zod validation schemas for running module

import { z } from 'zod'

export const workoutTypeEnum = z.enum([
  'easy', 'long_run', 'tempo', 'threshold', 'interval', 'recovery', 'race', 'other',
])

export const uploadRunSchema = z.object({
  workout_type: workoutTypeEnum.default('easy'),
  prescribed_pace_sec_per_km: z.coerce.number().positive().optional(),
  notes: z.string().max(1000).optional(),
})

export const raceTargetSchema = z.object({
  race_name: z.string().min(1).max(100),
  location: z.string().max(100).optional(),
  race_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  distance_km: z.coerce.number().positive(),
  target_time_seconds: z.coerce.number().positive().int(),
  notes: z.string().max(1000).optional(),
})

export const restingHrSchema = z.object({
  logged_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resting_hr: z.coerce.number().int().min(30).max(120),
  notes: z.string().max(500).optional(),
})

export type UploadRunInput = z.infer<typeof uploadRunSchema>
export type RaceTargetInput = z.infer<typeof raceTargetSchema>
export type RestingHrInput = z.infer<typeof restingHrSchema>
