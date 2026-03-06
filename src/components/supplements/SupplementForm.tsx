'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createSupplement, updateSupplement } from '@/lib/supabase/supplements'
import type { Supplement, SupplementUpdate, FrequencyType, TimingType } from '@/lib/types/supplements'
import { FREQUENCY_LABELS, TIMING_LABELS, DOSE_UNITS } from '@/lib/types/supplements'

interface SupplementFormProps {
  supplement?: Supplement | null
  onSave: () => void
  onCancel: () => void
}

const EMPTY: SupplementUpdate = {
  name: '',
  brand: null,
  dose_amount: null,
  dose_unit: 'tablet',
  dose_count: 1,
  frequency: 'daily',
  frequency_days: null,
  timing: null,
  timing_notes: null,
  take_with_food: false,
  has_duration: false,
  start_date: null,
  end_date: null,
  duration_days: null,
  duration_notes: null,
  is_active: true,
  is_paused: false,
  pause_reason: null,
  paused_at: null,
  resume_at: null,
  prescribed_by: null,
  prescribed_for: null,
  notes: null,
  blood_donation_override: false,
}

export function SupplementForm({ supplement, onSave, onCancel }: SupplementFormProps) {
  const [form, setForm] = useState<SupplementUpdate>(
    supplement
      ? {
          name: supplement.name,
          brand: supplement.brand,
          dose_amount: supplement.dose_amount,
          dose_unit: supplement.dose_unit,
          dose_count: supplement.dose_count,
          frequency: supplement.frequency,
          frequency_days: supplement.frequency_days,
          timing: supplement.timing,
          timing_notes: supplement.timing_notes,
          take_with_food: supplement.take_with_food,
          has_duration: supplement.has_duration,
          start_date: supplement.start_date,
          end_date: supplement.end_date,
          duration_days: supplement.duration_days,
          duration_notes: supplement.duration_notes,
          is_active: supplement.is_active,
          is_paused: supplement.is_paused,
          pause_reason: supplement.pause_reason,
          paused_at: supplement.paused_at,
          resume_at: supplement.resume_at,
          prescribed_by: supplement.prescribed_by,
          prescribed_for: supplement.prescribed_for,
          notes: supplement.notes,
          blood_donation_override: supplement.blood_donation_override,
        }
      : EMPTY
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof SupplementUpdate>(key: K, value: SupplementUpdate[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name?.trim()) {
      setError('Name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (supplement) {
        await updateSupplement(supplement.id, form, 'User edited supplement')
      } else {
        // Auto-compute end_date from duration_days + start_date
        const startDate = form.start_date ?? new Date().toISOString().slice(0, 10)
        const endDate =
          form.has_duration && form.duration_days
            ? new Date(new Date(startDate).getTime() + form.duration_days * 86400000)
                .toISOString()
                .slice(0, 10)
            : null
        await createSupplement({ ...form, start_date: startDate, end_date: endDate })
      }
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25'
  const labelClass = 'text-xs font-medium text-white/40 uppercase tracking-wider'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white">
          {supplement ? 'Edit Supplement' : 'Add Supplement'}
        </h3>
        <button type="button" onClick={onCancel} className="text-white/30 hover:text-white/60">
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Name + Brand */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Name *</label>
          <input
            className={`${inputClass} mt-1`}
            value={form.name ?? ''}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Supplement name"
            required
          />
        </div>
        <div>
          <label className={labelClass}>Brand</label>
          <input
            className={`${inputClass} mt-1`}
            value={form.brand ?? ''}
            onChange={(e) => set('brand', e.target.value || null)}
            placeholder="Optional"
          />
        </div>
      </div>

      {/* Dose */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Dose amount</label>
          <input
            className={`${inputClass} mt-1`}
            type="number"
            step="any"
            value={form.dose_amount ?? ''}
            onChange={(e) => set('dose_amount', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="e.g. 50000"
          />
        </div>
        <div>
          <label className={labelClass}>Unit</label>
          <select
            className={`${inputClass} mt-1`}
            value={form.dose_unit ?? ''}
            onChange={(e) => set('dose_unit', e.target.value || null)}
          >
            <option value="">—</option>
            {DOSE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Count</label>
          <input
            className={`${inputClass} mt-1`}
            type="number"
            step="0.5"
            min="0.5"
            value={form.dose_count ?? ''}
            onChange={(e) => set('dose_count', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="1"
          />
        </div>
      </div>

      {/* Frequency */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Frequency</label>
          <select
            className={`${inputClass} mt-1`}
            value={form.frequency}
            onChange={(e) => set('frequency', e.target.value as FrequencyType)}
          >
            {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Timing</label>
          <select
            className={`${inputClass} mt-1`}
            value={form.timing ?? ''}
            onChange={(e) => set('timing', (e.target.value as TimingType) || null)}
          >
            <option value="">— Any time</option>
            {Object.entries(TIMING_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Timing notes */}
      <div>
        <label className={labelClass}>Timing notes</label>
        <input
          className={`${inputClass} mt-1`}
          value={form.timing_notes ?? ''}
          onChange={(e) => set('timing_notes', e.target.value || null)}
          placeholder="e.g. dissolve in mouth, take with food…"
        />
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.has_duration}
            onChange={(e) => set('has_duration', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-white/60">Fixed duration course</span>
        </label>

        {form.has_duration && (
          <div className="pl-5 grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Duration (days)</label>
              <input
                className={`${inputClass} mt-1`}
                type="number"
                min="1"
                value={form.duration_days ?? ''}
                onChange={(e) => set('duration_days', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="90"
              />
            </div>
            <div>
              <label className={labelClass}>Start date</label>
              <input
                className={`${inputClass} mt-1`}
                type="date"
                value={form.start_date ?? new Date().toISOString().slice(0, 10)}
                onChange={(e) => set('start_date', e.target.value || null)}
              />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Duration notes</label>
              <input
                className={`${inputClass} mt-1`}
                value={form.duration_notes ?? ''}
                onChange={(e) => set('duration_notes', e.target.value || null)}
                placeholder="e.g. 3-month course, test at week 13"
              />
            </div>
          </div>
        )}
      </div>

      {/* Prescribed */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Prescribed by</label>
          <input
            className={`${inputClass} mt-1`}
            value={form.prescribed_by ?? ''}
            onChange={(e) => set('prescribed_by', e.target.value || null)}
            placeholder="e.g. Emine Ömerağa"
          />
        </div>
        <div>
          <label className={labelClass}>Prescribed for</label>
          <input
            className={`${inputClass} mt-1`}
            value={form.prescribed_for ?? ''}
            onChange={(e) => set('prescribed_for', e.target.value || null)}
            placeholder="Condition / reason"
          />
        </div>
      </div>

      {/* Blood donation override */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.blood_donation_override}
          onChange={(e) => set('blood_donation_override', e.target.checked)}
          className="rounded"
        />
        <span className="text-sm text-white/60">Override to daily during blood donation recovery</span>
      </label>

      {/* Notes */}
      <div>
        <label className={labelClass}>Notes</label>
        <textarea
          className={`${inputClass} mt-1 resize-none`}
          rows={2}
          value={form.notes ?? ''}
          onChange={(e) => set('notes', e.target.value || null)}
          placeholder="Any extra notes…"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {supplement ? 'Save Changes' : 'Add Supplement'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
