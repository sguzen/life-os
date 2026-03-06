// Belgrade Marathon race day tracker

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { daysUntil, RACE_DATE } from '@/lib/marathon/plan'
import { getRaceResult } from '@/lib/supabase/marathon'
import { AICoach } from '@/components/marathon/AICoach'

export const metadata: Metadata = {
  title: 'Belgrade Marathon',
  description: 'April 19, 2026 — Target 3:32:00',
}

const PACING_PLAN = [
  { segment: 'km 0-10', target: '5:05-5:08/km', split: '~51:30', strategy: 'Conservative — resist temptation' },
  { segment: 'km 10-21', target: '5:00/km', split: '~1:45:00', strategy: 'Settle into rhythm, gel at km 10' },
  { segment: 'km 21-30', target: '5:00/km', split: '~2:30:00', strategy: 'Hold steady, gel at km 20 & 28' },
  { segment: 'km 30-38', target: '5:00-5:05/km', split: '~3:10:00', strategy: 'Suffering zone — keep running' },
  { segment: 'km 38-42.2', target: '4:55-5:00/km', split: '3:32:00', strategy: 'Empty the tank' },
]

const FUELING = [
  { km: 10, detail: 'Gel #1 + water (Maurten or SIS ONLY)' },
  { km: 20, detail: 'Gel #2 + water' },
  { km: 28, detail: 'Gel #3 + water' },
  { km: 36, detail: 'Gel #4 + water' },
]

export default async function BelgradePage() {
  const result = await getRaceResult('Belgrade Marathon')
  const daysToRace = daysUntil(RACE_DATE)
  const isRaceWeek = daysToRace <= 7 && daysToRace >= 0
  const isPostRace = daysToRace < 0

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <Link href="/marathon" className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Training hub
      </Link>

      <div className="space-y-1">
        <p className="text-xs text-white/40 uppercase tracking-wider">A-Race · April 19, 2026 · Belgrade</p>
        <h1 className="text-2xl font-bold text-white">Belgrade Marathon</h1>
        <p className="text-lg text-orange-400 font-mono font-semibold">Target: 3:32:00</p>
      </div>

      {/* Countdown */}
      {!isPostRace && (
        <div className="rounded-xl bg-orange-500/10 border border-orange-500/30 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-orange-300 font-medium">5:00/km average</p>
            <p className="text-xs text-white/40 mt-0.5">
              {isRaceWeek ? 'RACE WEEK — stay calm, trust the training' : 'Train. Trust. Execute.'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-mono font-bold text-white">{daysToRace}</p>
            <p className="text-xs text-white/40">days</p>
          </div>
        </div>
      )}

      {/* Result */}
      {isPostRace && result && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider">Final Result</h2>
          <p className="text-5xl font-mono font-bold text-white">{result.finish_time}</p>
          {result.avg_pace && (
            <p className="text-lg text-white/50 font-mono">@ {result.avg_pace}/km</p>
          )}
        </div>
      )}

      {/* Race day pacing */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Race Pacing Plan</h2>
        <div className="space-y-3">
          {PACING_PLAN.map((s) => (
            <div key={s.segment} className="space-y-0.5">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-white/40 font-mono w-20 shrink-0 text-xs">{s.segment}</span>
                <span className="text-orange-400 font-mono font-semibold w-28 shrink-0">{s.target}</span>
                <span className="text-white/30 font-mono text-xs">{s.split}</span>
              </div>
              <p className="text-xs text-white/50 pl-20">{s.strategy}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Fueling */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">Fueling Plan</h2>
        <div className="space-y-2">
          {FUELING.map((f) => (
            <div key={f.km} className="flex items-center gap-3 text-sm">
              <span className="text-white font-mono font-bold w-10 shrink-0">km {f.km}</span>
              <span className="text-white/60">{f.detail}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-red-400 border-t border-white/10 pt-3">
          ONLY Maurten or SIS gels — never pre-workout supplements
        </p>
      </div>

      {/* Race week prep */}
      {(isRaceWeek || daysToRace <= 10) && !isPostRace && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Race Week</h2>
          <ul className="space-y-2 text-sm text-white/70">
            <li>Wed Apr 16: Start carb loading — pasta, rice, quinoa, potatoes</li>
            <li>Thu-Fri Apr 17-18: Continue carb loading · 3L water · sleep 8h+ · NO new foods</li>
            <li>Race morning (2.5-3h before): Oats + banana + nut butter OR toast + jam</li>
            <li>30min before: 10min easy jog · 5min dynamic stretches · 4×100m strides</li>
          </ul>
        </div>
      )}

      {/* AI */}
      <AICoach
        mode={isPostRace ? 'post' : 'chat'}
        sessionData={{ type: 'RACE', race: 'Belgrade Marathon', target: '3:32:00', daysToRace }}
        initialPrompt={isPostRace ? 'Give me a full race debrief.' : 'What should I focus on for race day execution?'}
      />
    </div>
  )
}
