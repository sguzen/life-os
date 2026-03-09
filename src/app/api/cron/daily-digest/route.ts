// GET /api/cron/daily-digest
// Vercel cron job — runs at 02:30 UTC (≈ 05:30 Cyprus time).
// Sends a personalised push notification to every subscribed user.
// Secured by CRON_SECRET env var.

import { NextRequest, NextResponse } from 'next/server'
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const maxDuration = 300

const DIGEST_PROMPT = `You are the Life OS morning digest generator. Write a push notification body (max 120 characters) that gives the user their most important focus for today. Mention the training session if there is one, or flag a task if not. Be direct and specific. No fluff.

Examples:
"Long run 18km today. 3 tasks pending. Check-in when you wake up."
"Rest day. Trading prep + 2 tasks due. Log your morning vitals."
"Tempo 8km at 4:45/km. No alcohol yesterday — good. Stay sharp."`

export async function GET(req: NextRequest) {
  // ── Security ────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // ── VAPID setup ─────────────────────────────────────────────────────────
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_EMAIL) {
    console.error('[daily-digest] VAPID env vars not set — skipping push')
    return NextResponse.json({ error: 'VAPID not configured' }, { status: 500 })
  }

  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )

  const supabase = createServiceClient()
  const todayStr = new Date().toISOString().slice(0, 10)

  // ── Fetch all users with push subscriptions ─────────────────────────────
  const { data: subscriptions, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth_key')

  if (subErr || !subscriptions?.length) {
    return NextResponse.json({ sent: 0, skipped: 0, message: 'No subscriptions found.' })
  }

  // Group subscriptions by user_id
  const byUser = new Map<string, typeof subscriptions>()
  for (const sub of subscriptions) {
    const existing = byUser.get(sub.user_id) ?? []
    existing.push(sub)
    byUser.set(sub.user_id, existing)
  }

  let sent = 0
  let skipped = 0

  for (const [userId, userSubs] of byUser) {
    // Skip if digest already sent today
    const { data: existing } = await supabase
      .from('daily_digest_log')
      .select('id')
      .eq('user_id', userId)
      .eq('digest_date', todayStr)
      .maybeSingle()

    if (existing) {
      skipped++
      continue
    }

    // Build context for this user
    const [sessionRes, tasksRes, morningRes, nutritionRes] = await Promise.allSettled([
      supabase
        .from('training_sessions')
        .select('planned_type, planned_description, planned_km')
        .eq('user_id', userId)
        .eq('session_date', todayStr)
        .maybeSingle(),

      supabase
        .from('coach_tasks')
        .select('title')
        .eq('user_id', userId)
        .eq('due_date', todayStr)
        .is('completed_at', null),

      supabase
        .from('morning_logs')
        .select('energy_level, resting_hr_bpm, sleep_hours')
        .eq('user_id', userId)
        .order('log_date', { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from('nutrition_logs')
        .select('has_alcohol')
        .eq('user_id', userId)
        .eq('log_date', new Date(Date.now() - 86_400_000).toISOString().slice(0, 10))
        .maybeSingle(),
    ])

    const session = sessionRes.status === 'fulfilled' ? sessionRes.value.data : null
    const tasks = tasksRes.status === 'fulfilled' ? (tasksRes.value.data ?? []) : []
    const lastLog = morningRes.status === 'fulfilled' ? morningRes.value.data : null
    const yestNutrition = nutritionRes.status === 'fulfilled' ? nutritionRes.value.data : null

    const context = [
      session
        ? `Today's training: ${session.planned_type}${session.planned_km ? ` ${session.planned_km}km` : ''}${session.planned_description ? ` — ${session.planned_description}` : ''}`
        : `Today's training: rest day or not scheduled`,
      tasks.length ? `${tasks.length} task(s) due today` : `No tasks due today`,
      lastLog
        ? `Last morning log: energy ${lastLog.energy_level ?? '?'}/5, HR ${lastLog.resting_hr_bpm ?? '?'}bpm, sleep ${lastLog.sleep_hours ?? '?'}h`
        : `No recent morning log`,
      yestNutrition?.has_alcohol ? `Alcohol consumed yesterday` : null,
    ].filter(Boolean).join('. ')

    // Generate digest text
    let digestText: string
    try {
      const { text } = await generateText({
        model: google('gemini-2.5-flash'),
        system: DIGEST_PROMPT,
        prompt: context,
        maxTokens: 80,
        temperature: 0.4,
      })
      digestText = text.trim().slice(0, 120)
    } catch (err) {
      console.error(`[daily-digest] Gemini failed for user ${userId}:`, err)
      // Fallback to simple message
      digestText = session
        ? `${session.planned_type} today${session.planned_km ? ` — ${session.planned_km}km` : ''}. Check in when you wake up.`
        : `Morning check-in ready. ${tasks.length} task(s) due today.`
    }

    // Send push to all user's subscriptions
    let userSent = false
    for (const sub of userSubs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          JSON.stringify({ title: 'Life OS', body: digestText, icon: '/icons/icon-192.png' }),
        )
        userSent = true
      } catch (err) {
        console.error(`[daily-digest] Push failed for endpoint ${sub.endpoint.slice(0, 40)}:`, err)
        // Remove expired/invalid subscriptions (410 Gone)
        if ((err as { statusCode?: number }).statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint)
        }
      }
    }

    if (userSent) {
      // Record in daily_digest_log to prevent re-send
      await supabase.from('daily_digest_log').insert({
        user_id: userId,
        digest_date: todayStr,
        digest_text: digestText,
      })
      sent++
    }
  }

  return NextResponse.json({ sent, skipped, total: byUser.size })
}
