'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { insertBodyMeasurement } from '@/lib/supabase/nutrition'

export function MeasurementForm() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState({
    measured_at: new Date().toISOString().slice(0, 10),
    weight_kg: '',
    body_fat_pct: '',
    fat_mass_kg: '',
    muscle_mass_kg: '',
    waist_upper_cm: '',
    waist_mid_cm: '',
    waist_lower_cm: '',
    hip_cm: '',
    notes: '',
  })

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm({ ...form, [key]: e.target.value }),
    }
  }

  // Auto-calculate fat/muscle mass from weight + BF%
  function handleWeightOrBF(
    key: 'weight_kg' | 'body_fat_pct',
    val: string
  ) {
    const updated = { ...form, [key]: val }
    const weight = parseFloat(key === 'weight_kg' ? val : form.weight_kg)
    const bf = parseFloat(key === 'body_fat_pct' ? val : form.body_fat_pct)
    if (!isNaN(weight) && !isNaN(bf)) {
      updated.fat_mass_kg = ((weight * bf) / 100).toFixed(1)
      updated.muscle_mass_kg = (weight - (weight * bf) / 100).toFixed(1)
    }
    setForm(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await insertBodyMeasurement({
        measured_at: form.measured_at,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
        body_fat_pct: form.body_fat_pct ? parseFloat(form.body_fat_pct) : null,
        fat_mass_kg: form.fat_mass_kg ? parseFloat(form.fat_mass_kg) : null,
        muscle_mass_kg: form.muscle_mass_kg ? parseFloat(form.muscle_mass_kg) : null,
        waist_upper_cm: form.waist_upper_cm ? parseFloat(form.waist_upper_cm) : null,
        waist_mid_cm: form.waist_mid_cm ? parseFloat(form.waist_mid_cm) : null,
        waist_lower_cm: form.waist_lower_cm ? parseFloat(form.waist_lower_cm) : null,
        hip_cm: form.hip_cm ? parseFloat(form.hip_cm) : null,
        notes: form.notes || null,
      })
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="text-center py-4 space-y-3">
        <p className="text-emerald-400 font-medium">✓ Measurement logged</p>
        <button
          onClick={() => {
            setSaved(false)
            setForm({
              measured_at: new Date().toISOString().slice(0, 10),
              weight_kg: '',
              body_fat_pct: '',
              fat_mass_kg: '',
              muscle_mass_kg: '',
              waist_upper_cm: '',
              waist_mid_cm: '',
              waist_lower_cm: '',
              hip_cm: '',
              notes: '',
            })
          }}
          className="text-xs text-white/40 hover:text-white/60 transition-colors"
        >
          Log another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Date */}
      <div>
        <label className="text-xs text-white/40 block mb-1">Date</label>
        <input
          type="date"
          {...field('measured_at')}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/25"
          required
        />
      </div>

      {/* Weight + BF */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/40 block mb-1">Weight (kg)</label>
          <input
            type="number"
            step="0.1"
            min="40"
            max="120"
            value={form.weight_kg}
            onChange={(e) => handleWeightOrBF('weight_kg', e.target.value)}
            placeholder="67.0"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 block mb-1">Body fat %</label>
          <input
            type="number"
            step="0.1"
            min="5"
            max="50"
            value={form.body_fat_pct}
            onChange={(e) => handleWeightOrBF('body_fat_pct', e.target.value)}
            placeholder="24.5"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25"
          />
        </div>
      </div>

      {/* Auto-calculated */}
      {(form.fat_mass_kg || form.muscle_mass_kg) && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/40 block mb-1">Fat mass (kg) — auto</label>
            <input
              type="number"
              step="0.1"
              value={form.fat_mass_kg}
              onChange={(e) => setForm({ ...form, fat_mass_kg: e.target.value })}
              className="w-full rounded-lg bg-white/5 border border-white/8 px-3 py-2 text-sm text-white/60 focus:outline-none focus:border-white/25"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1">
              Muscle (kg) — auto
              {form.muscle_mass_kg && parseFloat(form.muscle_mass_kg) < 48.0 && (
                <span className="ml-1 text-red-400">⚠️ LOW</span>
              )}
            </label>
            <input
              type="number"
              step="0.1"
              value={form.muscle_mass_kg}
              onChange={(e) => setForm({ ...form, muscle_mass_kg: e.target.value })}
              className={`w-full rounded-lg bg-white/5 border px-3 py-2 text-sm focus:outline-none focus:border-white/25 ${
                form.muscle_mass_kg && parseFloat(form.muscle_mass_kg) < 48.0
                  ? 'border-red-500/40 text-red-300'
                  : 'border-white/8 text-white/60'
              }`}
            />
          </div>
        </div>
      )}

      {/* Circumferences */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/40 block mb-1">Waist upper (cm)</label>
          <input
            type="number"
            step="0.5"
            {...field('waist_upper_cm')}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 block mb-1">Waist mid (cm)</label>
          <input
            type="number"
            step="0.5"
            {...field('waist_mid_cm')}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 block mb-1">Waist lower (cm)</label>
          <input
            type="number"
            step="0.5"
            {...field('waist_lower_cm')}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 block mb-1">Hip (cm)</label>
          <input
            type="number"
            step="0.5"
            {...field('hip_cm')}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs text-white/40 block mb-1">Notes (optional)</label>
        <textarea
          {...field('notes')}
          rows={2}
          placeholder="Morning, fasted. Period week. After rest day."
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl py-2.5 text-sm font-semibold bg-white/10 hover:bg-white/15 disabled:opacity-40 border border-white/10 text-white transition-colors flex items-center justify-center gap-2"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? 'Saving…' : 'Log Measurement'}
      </button>
    </form>
  )
}
