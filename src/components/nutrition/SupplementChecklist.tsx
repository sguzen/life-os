'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { upsertSupplementLog } from '@/lib/supabase/nutrition'
import type { SupplementLog } from '@/lib/types/nutrition'

interface SupplementChecklistProps {
  date: string
  initialLog: SupplementLog | null
  isBloodDonationRecovery?: boolean
  vitaminD3WeekCount?: number
  b12WeekCount?: number
}

interface SupplementItem {
  key: keyof SupplementLog
  label: string
  dose: string
  note?: string
  highlight?: boolean
}

const DAILY_SUPPLEMENTS: SupplementItem[] = [
  { key: 'no3_taken', label: 'NO 3', dose: '15 tablets', note: 'dissolve in mouth (5-5-5 pattern)' },
  { key: 'zentius_taken', label: 'Zentius Flash', dose: '2 tablets', note: 'dissolve in mouth' },
  { key: 'zinc_taken', label: 'Zinc Bisglycinate 25mg', dose: '1 tablet' },
  { key: 'folic_acid_taken', label: 'Folic Acid 5mg', dose: '1 tablet', note: 'with food' },
  { key: 'mg_bisglycinate_taken', label: 'Mg Bisglycinate', dose: 'per label' },
  {
    key: 'mg_melatonin_taken',
    label: 'Mg Diasporal + Melatonin',
    dose: '1 sachet',
    note: 'every night before bed',
    highlight: true,
  },
  { key: 'se_ace_zinc_taken', label: 'Se ACE Zinc (Health Aid)', dose: '1 tablet', note: 'with food' },
]

const WEEKLY_SUPPLEMENTS: SupplementItem[] = [
  {
    key: 'vitamin_d3_taken',
    label: 'Vitamin D3 50000 IU',
    dose: '1x/week',
    note: 'with food — test at week 13',
  },
  { key: 'b12_taken', label: 'B12 5000mcg Chewable', dose: '2x/week' },
]

function SupplementRow({
  item,
  checked,
  onToggle,
  subNote,
  disabled,
}: {
  item: SupplementItem
  checked: boolean
  onToggle: () => void
  subNote?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-colors text-left disabled:opacity-40 ${
        checked
          ? 'bg-emerald-500/10 border-emerald-500/25 '
          : item.highlight
          ? 'bg-yellow-500/5 border-yellow-500/20 hover:bg-yellow-500/10'
          : 'bg-white/3 border-white/8 hover:bg-white/8'
      }`}
    >
      <span
        className={`shrink-0 h-5 w-5 rounded border flex items-center justify-center text-xs transition-colors ${
          checked
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'border-white/20 text-transparent'
        }`}
      >
        ✓
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${checked ? 'text-emerald-300' : 'text-white/80'}`}>
          {item.label}
          <span className="ml-1.5 text-xs font-normal text-white/35">{item.dose}</span>
          {item.highlight && !checked && (
            <span className="ml-1.5 text-xs text-yellow-400">← before bed</span>
          )}
        </p>
        {item.note && (
          <p className="text-xs text-white/30 mt-0.5">{item.note}</p>
        )}
        {subNote && <p className="text-xs text-white/40 mt-0.5">{subNote}</p>}
      </div>
    </button>
  )
}

export function SupplementChecklist({
  date,
  initialLog,
  isBloodDonationRecovery,
  vitaminD3WeekCount = 0,
  b12WeekCount = 0,
}: SupplementChecklistProps) {
  const [log, setLog] = useState<Partial<SupplementLog>>(
    initialLog ?? {
      no3_taken: false,
      zentius_taken: false,
      zinc_taken: false,
      folic_acid_taken: false,
      mg_bisglycinate_taken: false,
      mg_melatonin_taken: false,
      se_ace_zinc_taken: false,
      iron_taken: false,
      vitamin_d3_taken: false,
      b12_taken: false,
    }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function toggle(key: keyof SupplementLog) {
    const newVal = !log[key]
    const updated = { ...log, [key]: newVal }
    setLog(updated)
    setSaving(true)
    setError('')
    try {
      await upsertSupplementLog(date, { [key]: newVal })
    } catch {
      setError('Failed to save')
      setLog({ ...log })
    } finally {
      setSaving(false)
    }
  }

  const dailyCount = DAILY_SUPPLEMENTS.filter((s) => log[s.key]).length
  const ironItem: SupplementItem = {
    key: 'iron_taken',
    label: 'Iron',
    dose: isBloodDonationRecovery ? 'DAILY (blood donation recovery)' : 'every other day',
    note: isBloodDonationRecovery ? '2-week daily course active' : undefined,
    highlight: isBloodDonationRecovery,
  }

  return (
    <div className="space-y-5">
      {error && <p className="text-xs text-red-400">{error}</p>}
      {saving && (
        <div className="flex items-center gap-1.5 text-xs text-white/30">
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving…
        </div>
      )}

      {/* Daily */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Daily</p>
          <span className="text-xs text-white/30">{dailyCount}/{DAILY_SUPPLEMENTS.length}</span>
        </div>
        <div className="space-y-1.5">
          {DAILY_SUPPLEMENTS.map((item) => (
            <SupplementRow
              key={item.key as string}
              item={item}
              checked={!!log[item.key]}
              onToggle={() => toggle(item.key)}
              disabled={saving}
            />
          ))}

          {/* Iron — special */}
          <SupplementRow
            item={ironItem}
            checked={!!log.iron_taken}
            onToggle={() => toggle('iron_taken')}
            disabled={saving}
          />
        </div>
      </div>

      {/* Weekly */}
      <div>
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Weekly</p>
        <div className="space-y-1.5">
          <SupplementRow
            item={WEEKLY_SUPPLEMENTS[0]}
            checked={!!log.vitamin_d3_taken}
            onToggle={() => toggle('vitamin_d3_taken')}
            subNote={`This week: ${vitaminD3WeekCount > 0 ? 'taken' : 'not yet'}`}
            disabled={saving}
          />
          <SupplementRow
            item={WEEKLY_SUPPLEMENTS[1]}
            checked={!!log.b12_taken}
            onToggle={() => toggle('b12_taken')}
            subNote={`This week: ${b12WeekCount}/2 taken`}
            disabled={saving}
          />
        </div>
      </div>
    </div>
  )
}
