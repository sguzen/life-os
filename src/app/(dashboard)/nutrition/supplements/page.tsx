'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, Pill, List, CalendarCheck } from 'lucide-react'
import { getSupplements, getSupplementLogsForDate, seedDefaultSupplements } from '@/lib/supabase/supplements'
import { isBloodDonationRecovery } from '@/lib/supabase/nutrition'
import { DailySupplementChecklist } from '@/components/supplements/DailySupplementChecklist'
import { SupplementList } from '@/components/supplements/SupplementList'
import type { Supplement, SupplementLogEntry } from '@/lib/types/supplements'

type Tab = 'today' | 'manage'

export default function SupplementsPage() {
  const [tab, setTab] = useState<Tab>('today')
  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [logs, setLogs] = useState<SupplementLogEntry[]>([])
  const [bloodDonationRecovery, setBloodDonationRecovery] = useState(false)
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      await seedDefaultSupplements()
      const [sups, dayLogs, recovery] = await Promise.all([
        getSupplements(),
        getSupplementLogsForDate(today),
        isBloodDonationRecovery(),
      ])
      setSupplements(sups)
      setLogs(dayLogs)
      setBloodDonationRecovery(recovery)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => {
    load()
  }, [load])

  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/nutrition"
          className="flex items-center gap-1 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Today
        </Link>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Pill className="h-5 w-5 text-emerald-400" />
          <h1 className="text-xl font-bold text-white">Supplements</h1>
        </div>
        <p className="text-sm text-white/40">{dateLabel}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        <button
          onClick={() => setTab('today')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            tab === 'today'
              ? 'bg-white/10 text-white'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          <CalendarCheck className="h-3.5 w-3.5" />
          Today
        </button>
        <button
          onClick={() => setTab('manage')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            tab === 'manage'
              ? 'bg-white/10 text-white'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          <List className="h-3.5 w-3.5" />
          Manage
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/30">
          Loading supplements…
        </div>
      ) : tab === 'today' ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <DailySupplementChecklist
            supplements={supplements}
            logs={logs}
            date={today}
            bloodDonationRecoveryActive={bloodDonationRecovery}
            onLogUpdated={() => getSupplementLogsForDate(today).then(setLogs)}
          />
        </div>
      ) : (
        <SupplementList
          supplements={supplements}
          bloodDonationRecoveryActive={bloodDonationRecovery}
          onRefresh={load}
        />
      )}
    </div>
  )
}
