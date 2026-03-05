// P4-02: .fit file parser — standard Next.js API route (not Edge)
// Parses Garmin .fit files server-side and persists to Supabase.

import { NextRequest, NextResponse } from 'next/server'
import FitParser from 'fit-file-parser'
import { createClient } from '@/lib/supabase/server'
import { detectRestingHrSpike } from '@/lib/running/hr-spike'

export const runtime = 'nodejs' // explicit — not edge

// ── Types returned by fit-file-parser ───────────────────────

interface FitRecord {
  timestamp?: Date
  distance?: number        // metres
  heart_rate?: number
  speed?: number           // m/s
  cadence?: number         // steps/min (one-foot); double for full SPM
  altitude?: number
  enhanced_altitude?: number
}

interface FitLap {
  timestamp?: Date
  start_time?: Date
  total_distance?: number  // metres
  total_elapsed_time?: number  // seconds
  avg_heart_rate?: number
  max_heart_rate?: number
  avg_speed?: number       // m/s
  avg_cadence?: number
  total_ascent?: number
  message_index?: { value: number }
}

interface FitSession {
  start_time?: Date
  total_distance?: number
  total_elapsed_time?: number
  avg_heart_rate?: number
  max_heart_rate?: number
  total_ascent?: number
  total_descent?: number
  avg_speed?: number
  avg_cadence?: number
  total_calories?: number
  sport?: string
}

interface FitData {
  sessions?: FitSession[]
  laps?: FitLap[]
  records?: FitRecord[]
}

// ── Helpers ──────────────────────────────────────────────────

/** Convert m/s to seconds-per-km. Returns null for zero/undefined speed. */
function speedToSecPerKm(speedMs: number | undefined): number | null {
  if (!speedMs || speedMs <= 0) return null
  return Math.round(1000 / speedMs)
}

/** Parse a .fit file Buffer and return structured FitData. */
function parseFitBuffer(buf: Buffer): Promise<FitData> {
  return new Promise((resolve, reject) => {
    const parser = new FitParser({ force: true, speedUnit: 'm/s', lengthUnit: 'm', temperatureUnit: 'celsius', elapsedRecordField: true, mode: 'list' })
    // fit-file-parser types are loose; cast to bypass TS mismatch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(parser as any).parse(buf, (err: string | undefined, data: FitData) => {
      if (err) reject(new Error(err))
      else resolve(data)
    })
  })
}

// ── Route handler ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse multipart form
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const prescribedPaceInput = formData.get('prescribed_pace_sec_per_km')
  const workoutType = (formData.get('workout_type') as string) || 'easy'
  const notes = (formData.get('notes') as string) || null

  if (!file || !file.name.endsWith('.fit')) {
    return NextResponse.json({ error: 'A .fit file is required' }, { status: 400 })
  }

  // 3. Read file bytes
  const arrayBuffer = await file.arrayBuffer()
  const buf = Buffer.from(arrayBuffer as ArrayBuffer)

  // 4. Parse .fit
  let fitData: FitData
  try {
    fitData = await parseFitBuffer(buf)
  } catch (err) {
    console.error('fit-file-parser error:', err)
    return NextResponse.json({ error: 'Failed to parse .fit file' }, { status: 422 })
  }

  const session: FitSession | undefined = fitData.sessions?.[0]
  if (!session) {
    return NextResponse.json({ error: 'No session data found in .fit file' }, { status: 422 })
  }

  // 5. Extract activity-level metrics
  const distanceMeters = session.total_distance ?? 0
  const durationSeconds = Math.round(session.total_elapsed_time ?? 0)
  const avgPace = speedToSecPerKm(session.avg_speed)
  const prescribedPace = prescribedPaceInput ? Number(prescribedPaceInput) : null
  const startedAt = session.start_time ?? new Date()

  // 6. Extract resting HR from the first record (if within first 5 min, low HR)
  //    Garmin sometimes embeds overnight resting HR in the first record.
  let restingHr: number | null = null
  const firstRecord = fitData.records?.[0]
  if (firstRecord?.heart_rate && firstRecord.heart_rate < 60) {
    restingHr = firstRecord.heart_rate
  }

  // 7. Cadence: Garmin stores one-foot cadence; double for full SPM
  const avgCadence = session.avg_cadence ? session.avg_cadence * 2 : null

  // 8. Insert activity
  const { data: activity, error: actErr } = await supabase
    .from('running_activities')
    .insert({
      user_id: user.id,
      started_at: startedAt.toISOString(),
      name: file.name.replace('.fit', ''),
      workout_type: workoutType,
      distance_meters: distanceMeters,
      duration_seconds: durationSeconds,
      avg_pace_sec_per_km: avgPace,
      prescribed_pace_sec_per_km: prescribedPace,
      avg_hr: session.avg_heart_rate ?? null,
      max_hr: session.max_heart_rate ?? null,
      resting_hr: restingHr,
      elevation_gain_m: session.total_ascent ?? null,
      elevation_loss_m: session.total_descent ?? null,
      avg_cadence: avgCadence,
      calories: session.total_calories ?? null,
      notes,
      fit_filename: file.name,
    })
    .select()
    .single()

  if (actErr || !activity) {
    console.error('Insert activity error:', actErr)
    return NextResponse.json({ error: 'Failed to save activity' }, { status: 500 })
  }

  // 9. Insert laps
  const laps = fitData.laps ?? []
  if (laps.length > 0) {
    const lapRows = laps.map((lap, i) => ({
      user_id: user.id,
      activity_id: activity.id,
      lap_number: i + 1,
      start_time: lap.start_time?.toISOString() ?? null,
      distance_meters: lap.total_distance ?? 0,
      duration_seconds: Math.round(lap.total_elapsed_time ?? 0),
      avg_pace_sec_per_km: speedToSecPerKm(lap.avg_speed),
      avg_hr: lap.avg_heart_rate ?? null,
      max_hr: lap.max_heart_rate ?? null,
      elevation_gain_m: lap.total_ascent ?? null,
      avg_cadence: lap.avg_cadence ? lap.avg_cadence * 2 : null,
    }))

    const { error: lapErr } = await supabase.from('running_laps').insert(lapRows)
    if (lapErr) console.error('Insert laps error:', lapErr)
  }

  // 10. Log resting HR + spike detection
  if (restingHr) {
    const isSpike = await detectRestingHrSpike(supabase, user.id, restingHr)
    const { error: hrErr } = await supabase.from('resting_hr_logs').upsert({
      user_id: user.id,
      logged_date: startedAt.toISOString().split('T')[0],
      resting_hr: restingHr,
      source: 'garmin',
      is_spike: isSpike,
    }, { onConflict: 'user_id,logged_date' })
    if (hrErr) console.error('Insert resting HR error:', hrErr)
  }

  return NextResponse.json({ activity, lapCount: laps.length }, { status: 201 })
}
