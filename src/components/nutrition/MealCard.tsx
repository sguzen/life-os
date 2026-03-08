'use client'

import { ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { useState } from 'react'
import type { MealStatus, LunchCarbChoice, FruitChoice } from '@/lib/types/nutrition'
import { LUNCH_CARB_LABELS, FRUIT_LABELS, MEAL_DETAILS } from '@/lib/types/nutrition'
import type { Meal } from '@/lib/supabase/meals'
import { MealEditDialog } from './MealEditDialog'

const STATUS_CYCLE: MealStatus[] = ['pending', 'complete', 'partial', 'skipped', 'modified']

const STATUS_DISPLAY: Record<MealStatus, { label: string; bg: string; text: string }> = {
  pending: { label: '⬜ Pending', bg: 'bg-white/5', text: 'text-white/40' },
  complete: { label: '✅ Complete', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  partial: { label: '🟡 Partial', bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  skipped: { label: '❌ Skipped', bg: 'bg-red-500/15', text: 'text-red-400' },
  modified: { label: '✏️ Modified', bg: 'bg-blue-500/15', text: 'text-blue-400' },
}

interface MealCardProps {
  mealKey: string
  icon: string
  label: string
  description?: string | null  // from DB meals table (overrides MEAL_DETAILS fallback)
  dbMeal?: Meal | null         // full DB row — enables edit dialog
  status: MealStatus
  note: string
  lunchCarbChoice?: LunchCarbChoice | null
  fruitChoice?: FruitChoice | null
  onStatusChange: (status: MealStatus) => void
  onNoteChange: (note: string) => void
  onLunchCarbChange?: (choice: LunchCarbChoice) => void
  onFruitChange?: (choice: FruitChoice) => void
  onMealUpdated?: (updated: Meal) => void
  disabled?: boolean
}

export function MealCard({
  mealKey,
  icon,
  label,
  description,
  dbMeal,
  status,
  note,
  lunchCarbChoice,
  fruitChoice,
  onStatusChange,
  onNoteChange,
  onLunchCarbChange,
  onFruitChange,
  onMealUpdated,
  disabled,
}: MealCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [currentMeal, setCurrentMeal] = useState<Meal | null>(dbMeal ?? null)
  const display = STATUS_DISPLAY[status]
  const showNoteField = status === 'partial' || status === 'skipped' || status === 'modified'
  const isLunch = mealKey === 'meal_lunch'
  const isSnack4 = mealKey === 'meal_snack4'

  // Use DB description if available, fall back to static MEAL_DETAILS
  const mealDescription = currentMeal?.description ?? description ?? MEAL_DETAILS[mealKey]
  // Macro summary line
  const macroLine = currentMeal && (currentMeal.calories || currentMeal.protein)
    ? `${currentMeal.calories ?? '?'} kcal · ${currentMeal.protein ?? '?'}g P · ${currentMeal.carbs ?? '?'}g C · ${currentMeal.fats ?? '?'}g F`
    : null

  function cycleStatus() {
    const idx = STATUS_CYCLE.indexOf(status)
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
    onStatusChange(next)
    if (next === 'complete') setExpanded(false)
    else if (next !== 'pending') setExpanded(true)
  }

  function handleMealSaved(updated: Meal) {
    setCurrentMeal(updated)
    onMealUpdated?.(updated)
  }

  return (
    <>
      {editOpen && currentMeal && (
        <MealEditDialog
          meal={currentMeal}
          onClose={() => setEditOpen(false)}
          onSaved={handleMealSaved}
        />
      )}
    <div className={`rounded-lg border border-white/8 ${display.bg} transition-colors`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="text-base shrink-0">{icon}</span>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left min-w-0"
          disabled={disabled}
        >
          <span className="text-sm font-medium text-white/80 truncate block">
            {currentMeal?.label ?? label}
          </span>
          <span className="text-xs text-white/35 truncate block">{mealDescription}</span>
          {macroLine && (
            <span className="text-xs text-white/25 truncate block">{macroLine}</span>
          )}
        </button>

        {/* Manual edit button */}
        {currentMeal && (
          <button
            onClick={() => setEditOpen(true)}
            disabled={disabled}
            title="Edit meal"
            className="shrink-0 rounded-md p-1.5 text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          onClick={cycleStatus}
          disabled={disabled}
          className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium border border-white/10 transition-colors hover:border-white/25 ${display.text}`}
        >
          {display.label}
        </button>

        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
          disabled={disabled}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/8 pt-2">
          {/* Lunch carb choice */}
          {isLunch && onLunchCarbChange && (
            <div>
              <label className="text-xs text-white/40 block mb-1">Carb choice</label>
              <select
                value={lunchCarbChoice ?? ''}
                onChange={(e) => onLunchCarbChange(e.target.value as LunchCarbChoice)}
                disabled={disabled}
                className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-white/25"
              >
                <option value="">Select carb…</option>
                {Object.entries(LUNCH_CARB_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Snack 4 fruit choice */}
          {isSnack4 && onFruitChange && (
            <div>
              <label className="text-xs text-white/40 block mb-1">Fruit choice</label>
              <select
                value={fruitChoice ?? ''}
                onChange={(e) => onFruitChange(e.target.value as FruitChoice)}
                disabled={disabled}
                className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-white/25"
              >
                <option value="">Select fruit…</option>
                {Object.entries(FRUIT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Note field */}
          {showNoteField && (
            <div>
              <label className="text-xs text-white/40 block mb-1">
                {status === 'skipped' ? 'Why skipped?' : 'What changed?'}
              </label>
              <textarea
                value={note}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder={
                  status === 'skipped'
                    ? 'Reason for skipping…'
                    : 'What was different? (1-2 sentences)'
                }
                rows={2}
                disabled={disabled}
                className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 resize-none"
              />
            </div>
          )}

          {/* Skipped warning */}
          {status === 'skipped' && (
            <p className="text-xs text-orange-400 font-medium">
              ⚠️ Skipping meals causes muscle catabolism. Eat something.
            </p>
          )}
        </div>
      )}
    </div>
    </>
  )
}
