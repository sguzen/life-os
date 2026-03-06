'use client'

import { AlertOctagon } from 'lucide-react'

interface ViolationFlagsProps {
  hadFriedFood: boolean
  hadProcessedSnacks: boolean
  hadJuiceSoda: boolean
  hadBreadSugar: boolean
  onToggle: (
    key: 'had_fried_food' | 'had_processed_snacks' | 'had_juice_soda' | 'had_bread_sugar'
  ) => void
  disabled?: boolean
}

const FLAGS = [
  { key: 'had_fried_food' as const, label: 'Fried food', icon: '🍟' },
  { key: 'had_processed_snacks' as const, label: 'Processed snacks', icon: '🍪' },
  { key: 'had_juice_soda' as const, label: 'Juice / soda', icon: '🥤' },
  { key: 'had_bread_sugar' as const, label: 'Bread / sugar', icon: '🍞', highlight: true },
]

export function ViolationFlags({
  hadFriedFood,
  hadProcessedSnacks,
  hadJuiceSoda,
  hadBreadSugar,
  onToggle,
  disabled,
}: ViolationFlagsProps) {
  const values = {
    had_fried_food: hadFriedFood,
    had_processed_snacks: hadProcessedSnacks,
    had_juice_soda: hadJuiceSoda,
    had_bread_sugar: hadBreadSugar,
  }

  const anyFlagged = Object.values(values).some(Boolean)

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertOctagon className={`h-4 w-4 ${anyFlagged ? 'text-orange-400' : 'text-white/30'}`} />
        <span className="text-sm font-medium text-white/80">Violations</span>
        {anyFlagged && (
          <span className="ml-auto text-xs text-orange-400">
            {Object.values(values).filter(Boolean).length} flagged
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {FLAGS.map(({ key, label, icon, highlight }) => {
          const active = values[key]
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(key)}
              disabled={disabled}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border transition-colors disabled:opacity-40 ${
                active
                  ? highlight
                    ? 'bg-red-500/25 border-red-500/50 text-red-300'
                    : 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                  : 'bg-white/5 border-white/10 text-white/40 hover:border-white/25 hover:text-white/60'
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
              {highlight && (
                <span className="ml-auto text-xs opacity-60" title="Current known struggle">
                  ⚑
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
