'use server'

import { createClient } from '@/lib/supabase/server'
import type { CoachTaskInput, CoachTask } from '@/lib/types/coach-task'

export async function createTask(data: CoachTaskInput): Promise<CoachTask> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: row, error } = await supabase
    .from('coach_tasks')
    .insert({
      ...data,
      user_id: user.id,
      recurrence: data.recurrence ?? 'none',
      source: data.source ?? 'user',
    })
    .select('*')
    .single()

  if (error || !row) throw new Error(error?.message ?? 'Failed to create task')
  return row as CoachTask
}

export async function updateTask(
  id: string,
  data: Partial<CoachTaskInput>
): Promise<CoachTask> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: row, error } = await supabase
    .from('coach_tasks')
    .update(data)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error || !row) throw new Error(error?.message ?? 'Failed to update task')
  return row as CoachTask
}

export async function completeTask(id: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('coach_tasks')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
}

export async function deleteTask(id: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('coach_tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
}

export async function getTodaysTasks(): Promise<CoachTask[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayDow = new Date().getDay() // 0=Sun, 1=Mon … 6=Sat
  const isWeekday = todayDow >= 1 && todayDow <= 5

  // Fetch candidates: tasks due today OR recurring tasks not yet filtered
  // We fetch a wider set and filter recurrence logic in JS.
  const { data } = await supabase
    .from('coach_tasks')
    .select('*')
    .eq('user_id', user.id)
    .is('completed_at', null)
    .or(
      [
        `due_date.eq.${todayStr}`,
        `recurrence.eq.daily`,
        `recurrence.eq.weekdays`,
        `recurrence.eq.weekly`,
      ].join(',')
    )
    .order('due_date', { ascending: true, nullsFirst: false })

  const rows = (data ?? []) as CoachTask[]

  return rows.filter((task) => {
    // Explicitly due today
    if (task.due_date === todayStr) return true
    // Daily: always show
    if (task.recurrence === 'daily') return true
    // Weekdays: Mon–Fri only
    if (task.recurrence === 'weekdays') return isWeekday
    // Weekly: show if today matches the weekday of the task's created_at
    if (task.recurrence === 'weekly') {
      const createdDow = new Date(task.created_at).getDay()
      return createdDow === todayDow
    }
    return false
  })
}

export async function getUpcomingTasks(days: number): Promise<CoachTask[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const todayStr = new Date().toISOString().slice(0, 10)
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + days)
  const futureStr = futureDate.toISOString().slice(0, 10)

  const { data } = await supabase
    .from('coach_tasks')
    .select('*')
    .eq('user_id', user.id)
    .is('completed_at', null)
    .gte('due_date', todayStr)
    .lte('due_date', futureStr)
    .order('due_date', { ascending: true })

  return (data ?? []) as CoachTask[]
}
