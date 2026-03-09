'use client'

import { useEffect, useState } from 'react'
import { X, ArrowRight } from 'lucide-react'
import type { ProactiveGreetingResponse, ProactiveFlag } from '@/app/api/ai/proactive-greeting/route'

// Cache keys — scoped to today so banner re-appears tomorrow
function todayKey(suffix: string) {
  return `proactive-${new Date().toISOString().slice(0, 10)}-${suffix}`
}

export function ProactiveBanner() {
  const [data, setData] = useState<ProactiveGreetingResponse | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    const cacheKey = todayKey('greeting')
    const cached = sessionStorage.getItem(cacheKey)

    if (cached) {
      try {
        setData(JSON.parse(cached))
      } catch {
        sessionStorage.removeItem(cacheKey)
      }
    } else {
      fetch('/api/ai/proactive-greeting')
        .then((r) => r.json())
        .then((res: ProactiveGreetingResponse) => {
          sessionStorage.setItem(cacheKey, JSON.stringify(res))
          setData(res)
        })
        .catch(() => {/* silent — non-critical */})
    }

    // Restore dismissed state from sessionStorage
    const dismissedKey = todayKey('dismissed')
    const savedDismissed = sessionStorage.getItem(dismissedKey)
    if (savedDismissed) {
      try {
        setDismissed(new Set(JSON.parse(savedDismissed)))
      } catch { /* ignore */ }
    }
  }, [])

  function dismiss(key: string) {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(key)
      sessionStorage.setItem(todayKey('dismissed'), JSON.stringify([...next]))
      return next
    })
  }

  if (!data) return null

  const showMainBanner = (data.type === 'needs_checkin' || data.type === 'complete_briefing') && !dismissed.has('main')

  return (
    <div className="space-y-2 mb-4">
      {/* Main check-in banner */}
      {showMainBanner && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-base shrink-0">🌅</span>
            <p className="text-sm text-amber-200 truncate">
              {data.type === 'needs_checkin' && data.message
                ? data.message
                : 'Your morning check-in is ready — add your briefing.'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/dashboard"
              className="flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors whitespace-nowrap"
            >
              Log Check-In
              <ArrowRight className="h-3 w-3" />
            </a>
            <button
              onClick={() => dismiss('main')}
              className="text-amber-400/60 hover:text-amber-400 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Proactive flags */}
      {data.flags.map((flag) => {
        if (dismissed.has(flag)) return null
        return <FlagBanner key={flag} flag={flag} onDismiss={() => dismiss(flag)} />
      })}
    </div>
  )
}

function FlagBanner({ flag, onDismiss }: { flag: ProactiveFlag; onDismiss: () => void }) {
  const config: Record<ProactiveFlag, { icon: string; text: string; classes: string }> = {
    alcohol_yesterday: {
      icon: '⚠️',
      text: 'Alcohol logged yesterday. Consider reduced position size when trading today.',
      classes: 'border-red-500/30 bg-red-500/10 text-red-200',
    },
    unlogged_training: {
      icon: '🏃',
      text: 'You have a training session due today. Log it when done so the coach can evaluate it.',
      classes: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
    },
    low_energy_pattern: {
      icon: '📉',
      text: 'Energy has been low for 3+ days. Coach recommendation available — ask in the chat.',
      classes: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
    },
  }

  const { icon, text, classes } = config[flag]

  return (
    <div className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 ${classes}`}>
      <div className="flex items-start gap-3 min-w-0">
        <span className="text-base shrink-0 mt-0.5">{icon}</span>
        <p className="text-sm leading-relaxed">{text}</p>
      </div>
      <button
        onClick={onDismiss}
        className="opacity-60 hover:opacity-100 transition-opacity shrink-0 mt-0.5"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
