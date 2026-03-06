'use client'

import { useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { MealCard } from './MealCard'
import { WaterTracker } from './WaterTracker'
import { AlcoholToggle } from './AlcoholToggle'
import { ViolationFlags } from './ViolationFlags'
import { AdherenceScore } from './AdherenceScore'
import { AIAdvice } from './AIAdvice'
import { upsertNutritionLog } from '@/lib/supabase/nutrition'
import { calculateAdherence } from '@/lib/types/nutrition'
import type {
  NutritionLog,
  MealStatus,
  LunchCarbChoice,
  FruitChoice,
} from '@/lib/types/nutrition'
import { MEAL_ICONS, MEAL_LABELS } from '@/lib/types/nutrition'

const MEAL_KEYS = [
  'meal_post_run',
  'meal_breakfast',
  'meal_lunch',
  'meal_snack1',
  'meal_snack2',
  'meal_snack3',
  'meal_snack4',
] as const

interface DailyMealChecklistProps {
  date: string
  dateLabel: string
  initialLog: NutritionLog | null
  isRunDay?: boolean
}

type LogState = {
  meal_post_run: MealStatus
  meal_breakfast: MealStatus
  meal_lunch: MealStatus
  meal_lunch_carb_choice: LunchCarbChoice | null
  meal_snack1: MealStatus
  meal_snack2: MealStatus
  meal_snack3: MealStatus
  meal_snack4: MealStatus
  meal_snack4_fruit: FruitChoice | null
  meal_notes: Record<string, string>
  water_ml: number
  alcohol_consumed: boolean
  alcohol_details: string
  had_fried_food: boolean
  had_processed_snacks: boolean
  had_juice_soda: boolean
  had_bread_sugar: boolean
}

function initState(log: NutritionLog | null): LogState {
  return {
    meal_post_run: (log?.meal_post_run as MealStatus) ?? 'pending',
    meal_breakfast: (log?.meal_breakfast as MealStatus) ?? 'pending',
    meal_lunch: (log?.meal_lunch as MealStatus) ?? 'pending',
    meal_lunch_carb_choice: (log?.meal_lunch_carb_choice as LunchCarbChoice) ?? null,
    meal_snack1: (log?.meal_snack1 as MealStatus) ?? 'pending',
    meal_snack2: (log?.meal_snack2 as MealStatus) ?? 'pending',
    meal_snack3: (log?.meal_snack3 as MealStatus) ?? 'pending',
    meal_snack4: (log?.meal_snack4 as MealStatus) ?? 'pending',
    meal_snack4_fruit: (log?.meal_snack4_fruit as FruitChoice) ?? null,
    meal_notes: (log?.meal_notes as Record<string, string>) ?? {},
    water_ml: log?.water_ml ?? 0,
    alcohol_consumed: log?.alcohol_consumed ?? false,
    alcohol_details: log?.alcohol_details ?? '',
    had_fried_food: log?.had_fried_food ?? false,
    had_processed_snacks: log?.had_processed_snacks ?? false,
    had_juice_soda: log?.had_juice_soda ?? false,
    had_bread_sugar: log?.had_bread_sugar ?? false,
  }
}

export function DailyMealChecklist({
  date,
  dateLabel,
  initialLog,
  isRunDay,
}: DailyMealChecklistProps) {
  const [log, setLog] = useState<LogState>(initState(initialLog))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState<Date | null>(initialLog ? new Date(initialLog.updated_at) : null)

  const score = calculateAdherence({ ...log, had_run_day: isRunDay })

  const save = useCallback(
    async (patch: Partial<LogState>) => {
      setSaving(true)
      setError('')
      try {
        await upsertNutritionLog(date, {
          ...patch,
          meal_notes: patch.meal_notes ?? log.meal_notes,
        } as Parameters<typeof upsertNutritionLog>[1])
        setSavedAt(new Date())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
      } finally {
        setSaving(false)
      }
    },
    [date, log.meal_notes]
  )

  function updateMealStatus(mealKey: (typeof MEAL_KEYS)[number], status: MealStatus) {
    const updated = { ...log, [mealKey]: status }
    setLog(updated)
    save({ [mealKey]: status })
  }

  function updateMealNote(mealKey: string, note: string) {
    const updatedNotes = { ...log.meal_notes, [mealKey]: note }
    setLog({ ...log, meal_notes: updatedNotes })
    save({ meal_notes: updatedNotes })
  }

  function updateLunchCarb(choice: LunchCarbChoice) {
    setLog({ ...log, meal_lunch_carb_choice: choice })
    save({ meal_lunch_carb_choice: choice })
  }

  function updateFruitChoice(choice: FruitChoice) {
    setLog({ ...log, meal_snack4_fruit: choice })
    save({ meal_snack4_fruit: choice })
  }

  function addWater(ml: number) {
    const newVal = Math.max(0, log.water_ml + ml)
    setLog({ ...log, water_ml: newVal })
    save({ water_ml: newVal })
  }

  function toggleAlcohol(consumed: boolean) {
    setLog({ ...log, alcohol_consumed: consumed })
    save({ alcohol_consumed: consumed, alcohol_details: log.alcohol_details })
  }

  function updateAlcoholDetails(details: string) {
    setLog({ ...log, alcohol_details: details })
    // debounce implicitly — save on blur or next interaction
    save({ alcohol_consumed: log.alcohol_consumed, alcohol_details: details })
  }

  function toggleViolation(
    key: 'had_fried_food' | 'had_processed_snacks' | 'had_juice_soda' | 'had_bread_sugar'
  ) {
    const newVal = !log[key]
    setLog({ ...log, [key]: newVal })
    save({ [key]: newVal })
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">{dateLabel}</h1>
          {isRunDay && (
            <p className="text-xs text-blue-400 mt-0.5">🏃 Run day — water target: 3L</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saving && <Loader2 className="h-4 w-4 animate-spin text-white/40" />}
          {savedAt && !saving && (
            <span className="text-xs text-white/25">
              Saved {savedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <AdherenceScore score={score} compact />
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Adherence score bar */}
      <AdherenceScore score={score} />

      {/* Meal cards */}
      <div className="space-y-2">
        {MEAL_KEYS.map((mealKey) => (
          <MealCard
            key={mealKey}
            mealKey={mealKey}
            icon={MEAL_ICONS[mealKey]}
            label={MEAL_LABELS[mealKey]}
            status={log[mealKey] as MealStatus}
            note={log.meal_notes[mealKey] ?? ''}
            lunchCarbChoice={mealKey === 'meal_lunch' ? log.meal_lunch_carb_choice : undefined}
            fruitChoice={mealKey === 'meal_snack4' ? log.meal_snack4_fruit : undefined}
            onStatusChange={(s) => updateMealStatus(mealKey, s)}
            onNoteChange={(n) => updateMealNote(mealKey, n)}
            onLunchCarbChange={mealKey === 'meal_lunch' ? updateLunchCarb : undefined}
            onFruitChange={mealKey === 'meal_snack4' ? updateFruitChoice : undefined}
            disabled={saving}
          />
        ))}
      </div>

      {/* Water tracker */}
      <WaterTracker
        waterMl={log.water_ml}
        isRunDay={isRunDay}
        onAdd={addWater}
        disabled={saving}
      />

      {/* Violation flags */}
      <ViolationFlags
        hadFriedFood={log.had_fried_food}
        hadProcessedSnacks={log.had_processed_snacks}
        hadJuiceSoda={log.had_juice_soda}
        hadBreadSugar={log.had_bread_sugar}
        onToggle={toggleViolation}
        disabled={saving}
      />

      {/* Alcohol toggle */}
      <AlcoholToggle
        consumed={log.alcohol_consumed}
        details={log.alcohol_details}
        onToggle={toggleAlcohol}
        onDetailsChange={updateAlcoholDetails}
        disabled={saving}
      />

      {/* AI advice */}
      <AIAdvice
        logDate={date}
        existingAdvice={initialLog?.ai_daily_advice}
        generatedAt={initialLog?.ai_advice_generated_at}
      />
    </div>
  )
}
