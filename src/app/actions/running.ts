'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { deleteActivity, createRaceTarget, updateRaceTarget, deleteRaceTarget, upsertRestingHr } from '@/lib/supabase/running'
import { raceTargetSchema } from '@/lib/validations/running'

function parseHMS(value: string): number {
  const parts = value.trim().split(':').map(Number)
  if (parts.some(isNaN)) return 0
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}

export async function deleteRun(id: string): Promise<void> {
  await deleteActivity(id)
  redirect('/running')
}

export async function addRace(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | null> {
  const raw = {
    race_name: formData.get('race_name'),
    location: (formData.get('location') as string) || undefined,
    race_date: formData.get('race_date'),
    distance_km: formData.get('distance_km'),
    target_time_seconds: parseHMS(formData.get('target_time') as string),
    notes: (formData.get('notes') as string) || undefined,
  }
  const parsed = raceTargetSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  try {
    await createRaceTarget({
      ...parsed.data,
      location: parsed.data.location ?? null,
      notes: parsed.data.notes ?? null,
      actual_time_seconds: null,
      activity_id: null,
    })
  } catch {
    return { error: 'Failed to save race' }
  }
  revalidatePath('/running')
  return null
}

export async function editRace(
  id: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | null> {
  const raw = {
    race_name: formData.get('race_name'),
    location: (formData.get('location') as string) || undefined,
    race_date: formData.get('race_date'),
    distance_km: formData.get('distance_km'),
    target_time_seconds: parseHMS(formData.get('target_time') as string),
    notes: (formData.get('notes') as string) || undefined,
  }
  const parsed = raceTargetSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const actualTimeRaw = (formData.get('actual_time') as string).trim()
  const actual_time_seconds = actualTimeRaw ? parseHMS(actualTimeRaw) : null

  try {
    await updateRaceTarget(id, {
      ...parsed.data,
      location: parsed.data.location ?? null,
      notes: parsed.data.notes ?? null,
      actual_time_seconds,
    })
  } catch {
    return { error: 'Failed to update race' }
  }
  revalidatePath('/running')
  return null
}

export async function deleteRace(id: string): Promise<void> {
  await deleteRaceTarget(id)
  revalidatePath('/running')
}

export async function logRestingHr(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | null> {
  const date = formData.get('logged_date') as string
  const hr = parseInt(formData.get('resting_hr') as string)
  const notes = (formData.get('notes') as string) || undefined
  if (!date || isNaN(hr) || hr < 30 || hr > 120) return { error: 'Invalid date or heart rate (30–120 bpm)' }
  try {
    await upsertRestingHr(date, hr, 'manual', notes)
  } catch {
    return { error: 'Failed to save resting HR' }
  }
  revalidatePath('/running')
  return null
}
