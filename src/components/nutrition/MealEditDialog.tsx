'use client'

// MealEditDialog — Manual edit overlay for a single meal definition.
// Opens as a modal with fields for description and macros.
// Saves via PATCH /api/nutrition/meals/[id] with changed_by='user'.

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import type { Meal, MealUpdate } from '@/lib/supabase/meals'

interface MealEditDialogProps {
  meal: Meal
  onClose: () => void
  onSaved: (updated: Meal) => void
}

export function MealEditDialog({ meal, onClose, onSaved }: MealEditDialogProps) {
  const [form, setForm] = useState<{
    label: string
    description: string
    calories: string
    protein: string
    carbs: string
    fats: string
  }>({
    label: meal.label,
    description: meal.description ?? '',
    calories: meal.calories != null ? String(meal.calories) : '',
    protein: meal.protein != null ? String(meal.protein) : '',
    carbs: meal.carbs != null ? String(meal.carbs) : '',
    fats: meal.fats != null ? String(meal.fats) : '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function num(val: string): number | null {
    const n = parseFloat(val)
    return isNaN(n) ? null : n
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const updates: MealUpdate = {}
      if (form.label !== meal.label) updates.label = form.label
      if (form.description !== (meal.description ?? '')) updates.description = form.description || null
      const cal = num(form.calories)
      if (cal !== meal.calories) updates.calories = cal ?? undefined
      const prot = num(form.protein)
      if (prot !== meal.protein) updates.protein = prot ?? undefined
      const carb = num(form.carbs)
      if (carb !== meal.carbs) updates.carbs = carb ?? undefined
      const fat = num(form.fats)
      if (fat !== meal.fats) updates.fats = fat ?? undefined

      const res = await fetch(`/api/nutrition/meals/${meal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates, reason: 'Manual edit via nutrition page', changed_by: 'user' }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message ?? 'Save failed')
      onSaved(json.meal as Meal)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-md mx-4 rounded-xl border border-white/10 bg-[#111] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <h2 className="text-sm font-semibold text-white">{meal.icon} {meal.label}</h2>
            <p className="text-xs text-white/40 mt-0.5">Manual edit — logged to audit trail</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Label */}
          <div>
            <label className="text-xs text-white/50 block mb-1">Meal label</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-white/50 block mb-1">Description / contents</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 resize-none"
              placeholder="What does this meal contain?"
            />
          </div>

          {/* Macros */}
          <div>
            <label className="text-xs text-white/50 block mb-2">Macros</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'calories', label: 'kcal', field: 'calories' },
                { key: 'protein', label: 'P (g)', field: 'protein' },
                { key: 'carbs', label: 'C (g)', field: 'carbs' },
                { key: 'fats', label: 'F (g)', field: 'fats' },
              ].map(({ key, label, field }) => (
                <div key={key}>
                  <label className="text-xs text-white/35 block mb-1 text-center">{label}</label>
                  <input
                    type="number"
                    min="0"
                    step={field === 'calories' ? '1' : '0.1'}
                    value={form[field as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-white/30"
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/8">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs text-white/50 hover:text-white/70 hover:border-white/20 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 border border-white/15 px-4 py-2 text-xs text-white hover:bg-white/15 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  )
}
