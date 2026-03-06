'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface PaceDisciplineAlertProps {
  plannedPace: string
  actualPace: string
  deviationSec: number
  sessionType: string
  onAcknowledge: () => void
}

export function PaceDisciplineAlert({
  plannedPace,
  actualPace,
  deviationSec,
  sessionType,
  onAcknowledge,
}: PaceDisciplineAlertProps) {
  const [acknowledged, setAcknowledged] = useState(false)

  if (acknowledged) return null

  const handleAck = () => {
    setAcknowledged(true)
    onAcknowledge()
  }

  return (
    <div className="rounded-xl bg-red-500/15 border-2 border-red-500/50 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-red-300">YOU DID IT AGAIN</p>
          <p className="text-sm text-white/80">
            Planned: <span className="font-mono font-bold text-white">{plannedPace}/km</span>
            {' '}— Actual: <span className="font-mono font-bold text-red-300">{actualPace}/km</span>
            {' '}({deviationSec} sec/km too fast)
          </p>
        </div>
      </div>
      <p className="text-sm text-white/70 leading-relaxed">
        This is the <strong className="text-white">#1 risk to your Belgrade goal.</strong>{' '}
        {sessionType === 'TEMPO' && 'Tempo runs at the right pace build lactate clearance. Faster = junk miles that don\'t build fitness.'}
        {sessionType === 'EASY' && 'Easy runs must be easy — they are what allow you to perform on hard days. Going too fast now costs you on race day.'}
        {sessionType === 'LONG_RUN' && 'Long runs should be aerobic base building. Going too fast turns recovery into stress.'}
        {!['TEMPO', 'EASY', 'LONG_RUN'].includes(sessionType) && 'Pace discipline is the #1 predictor of a successful marathon block.'}
      </p>
      <button
        onClick={handleAck}
        className="w-full py-2.5 rounded-lg text-sm font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 transition-colors"
      >
        I acknowledge this
      </button>
    </div>
  )
}
