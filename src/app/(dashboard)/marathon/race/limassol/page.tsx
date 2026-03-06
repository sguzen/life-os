// Limassol Half Marathon page — pre-race briefing + post-race result entry

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getRaceResult } from '@/lib/supabase/marathon'
import { daysUntil, LIMASSOL_DATE } from '@/lib/marathon/plan'
import { LimassolResultForm } from '@/components/marathon/LimassolResultForm'
import { AICoach } from '@/components/marathon/AICoach'

export const metadata: Metadata = {
  title: 'Limassol Half Marathon',
  description: 'March 22 checkpoint race — target 1:44-1:45',
}

function parseTimeToSeconds(time: string): number {
  const parts = time.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return parts[0] * 60 + (parts[1] ?? 0)
}

function getBelgradeAdjustment(finishTimeSec: number): { label: string; target: string; color: string } {
  const target144 = parseTimeToSeconds('1:44:59')
  const target148 = parseTimeToSeconds('1:48:00')

  if (finishTimeSec <= target144) {
    return { label: 'Belgrade 3:32 CONFIRMED', target: '3:32:00', color: 'text-emerald-400' }
  }
  if (finishTimeSec < target148) {
    return { label: 'Belgrade target marginal', target: '3:33-3:34', color: 'text-yellow-400' }
  }
  return { label: 'Belgrade target ADJUSTED', target: '3:35:00', color: 'text-amber-400' }
}

export default async function LimassolPage() {
  const result = await getRaceResult('Limassol Half Marathon')
  const daysToRace = daysUntil(LIMASSOL_DATE)
  const isPostRace = daysToRace < 0 || result !== null

  const belgradeAdj = result?.finish_time_seconds
    ? getBelgradeAdjustment(result.finish_time_seconds)
    : null

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <Link href="/marathon" className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Training hub
      </Link>

      <div className="space-y-1">
        <p className="text-xs text-white/40 uppercase tracking-wider">Checkpoint Race · March 22, 2026</p>
        <h1 className="text-2xl font-bold text-white">Limassol Half Marathon</h1>
      </div>

      {/* Pre-race or result */}
      {!isPostRace && (
        <div className="space-y-6">
          {/* Countdown */}
          <div className="rounded-xl bg-yellow-400/10 border border-yellow-400/20 p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-300">Target: 1:44-1:45</p>
              <p className="text-xs text-white/40 mt-0.5">4:55-5:00/km average</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-mono font-bold text-yellow-400">{daysToRace}</p>
              <p className="text-xs text-white/40">days</p>
            </div>
          </div>

          {/* Race strategy */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Race Strategy</h2>
            <div className="space-y-2">
              {[
                { segment: 'km 0-5', pace: '5:05/km', note: 'Conservative start — resist the crowd' },
                { segment: 'km 5-15', pace: '5:00/km', note: 'Settle in, find rhythm' },
                { segment: 'km 15-21', pace: '4:55/km', note: 'Negative split finish — empty the tank' },
              ].map((s) => (
                <div key={s.segment} className="flex items-center gap-4 text-sm">
                  <span className="text-white/40 font-mono w-16 shrink-0">{s.segment}</span>
                  <span className="text-orange-400 font-mono font-bold w-16 shrink-0">{s.pace}</span>
                  <span className="text-white/60">{s.note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Outcome logic */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white">What the result means</h2>
            {[
              { result: '≤ 1:44:59', label: 'Belgrade 3:32 CONFIRMED', color: 'text-emerald-400' },
              { result: '1:45-1:47:59', label: 'Belgrade 3:33-3:34 (marginal)', color: 'text-yellow-400' },
              { result: '≥ 1:48:00', label: 'Belgrade adjusted to 3:35', color: 'text-amber-400' },
            ].map((o) => (
              <div key={o.result} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-white/50 w-24 shrink-0">{o.result}</span>
                <span className={`font-medium ${o.color}`}>{o.label}</span>
              </div>
            ))}
          </div>

          {/* Gel rule */}
          <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white/60">
            Gels: <span className="text-white font-medium">Maurten or SIS ONLY</span> — never pre-workout supplements
          </div>

          {/* AI pre-race */}
          <AICoach
            mode="pre"
            sessionData={{ type: 'RACE', race: 'Limassol Half Marathon', target: '1:44-1:45', date: '2026-03-22' }}
            initialPrompt="Give me a pre-race briefing for Limassol Half Marathon."
          />
        </div>
      )}

      {/* Post-race */}
      {isPostRace && (
        <div className="space-y-6">
          {result ? (
            <>
              {/* Result */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-6 space-y-4">
                <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider">Official Result</h2>
                <div className="flex items-end gap-4">
                  <p className="text-4xl font-mono font-bold text-white">{result.finish_time}</p>
                  {result.avg_pace && (
                    <p className="text-lg text-white/50 font-mono mb-1">@ {result.avg_pace}/km</p>
                  )}
                </div>
                {belgradeAdj && (
                  <div className={`rounded-lg px-4 py-3 text-sm font-semibold ${belgradeAdj.color} bg-white/5 border border-white/10`}>
                    {belgradeAdj.label} → {belgradeAdj.target}
                  </div>
                )}
              </div>

              {/* AI debrief */}
              {result.ai_debrief && (
                <div className="rounded-xl bg-orange-400/10 border border-orange-400/20 p-5 space-y-2">
                  <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Coach Debrief</p>
                  <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{result.ai_debrief}</p>
                </div>
              )}

              <AICoach
                mode="post"
                sessionData={{ type: 'RACE', race: 'Limassol Half Marathon', result: result.finish_time, target: '1:44-1:45' }}
                initialPrompt="Give me a full debrief of the Limassol race and what it means for Belgrade."
              />
            </>
          ) : (
            <LimassolResultForm />
          )}
        </div>
      )}
    </div>
  )
}
