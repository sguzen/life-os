'use client'

import { useState } from 'react'
import { Plus, CheckCircle2, Trash2, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import type { TradingChallenge, TradingChallengeInput } from '@/lib/types/accountability'
import {
  createChallenge,
  updateChallenge,
  deleteChallenge,
  setActiveChallenge,
} from '@/lib/supabase/accountability'

interface ChallengeConfigProps {
  initialChallenges: TradingChallenge[]
}

const EMPTY_FORM: TradingChallengeInput = {
  name: '',
  account_size: 25000,
  daily_loss_limit: 500,
  max_drawdown: 2500,
  profit_target: 2500,
  trailing_drawdown: false,
  is_active: false,
  notes: '',
}

export function ChallengeConfig({ initialChallenges }: ChallengeConfigProps) {
  const [challenges, setChallenges] = useState<TradingChallenge[]>(initialChallenges)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<TradingChallengeInput>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [activating, setActivating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const canSave = form.name.trim().length > 0 && form.account_size > 0 && form.daily_loss_limit > 0

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      const created = await createChallenge(form)
      setChallenges((prev) => [created, ...prev])
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleSetActive(id: string) {
    setActivating(id)
    try {
      await setActiveChallenge(id)
      setChallenges((prev) => prev.map((c) => ({ ...c, is_active: c.id === id })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate')
    } finally {
      setActivating(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this challenge? This cannot be undone.')) return
    setDeleting(id)
    try {
      await deleteChallenge(id)
      setChallenges((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Challenge list */}
      {challenges.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-white/30">No challenges configured yet.</p>
          <p className="text-xs text-white/20 mt-1">Add your prop firm details to get personalised AI coaching.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {challenges.map((c) => (
            <div
              key={c.id}
              className={`rounded-xl border transition-colors ${
                c.is_active
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {c.is_active && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${c.is_active ? 'text-emerald-400' : 'text-white'}`}>
                      {c.name}
                    </p>
                    {c.is_active && (
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">
                    ${c.account_size.toLocaleString()} account · ${c.daily_loss_limit} daily limit · ${c.max_drawdown} max DD
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
                  >
                    {expandedId === c.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {!c.is_active && (
                    <button
                      onClick={() => handleSetActive(c.id)}
                      disabled={activating === c.id}
                      className="text-xs font-medium bg-white/10 hover:bg-white/15 border border-white/10 text-white/70 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                    >
                      {activating === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Set Active'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deleting === c.id}
                    className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                  >
                    {deleting === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {expandedId === c.id && (
                <div className="border-t border-white/5 px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Account Size', value: `$${c.account_size.toLocaleString()}` },
                    { label: 'Daily Loss Limit', value: `$${c.daily_loss_limit}` },
                    { label: 'Max Drawdown', value: `$${c.max_drawdown}` },
                    { label: 'Profit Target', value: `$${c.profit_target}` },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-white/30">{label}</p>
                      <p className="text-sm font-medium text-white/80 mt-0.5">{value}</p>
                    </div>
                  ))}
                  {c.notes && (
                    <div className="col-span-full">
                      <p className="text-xs text-white/30">Notes</p>
                      <p className="text-xs text-white/50 mt-0.5">{c.notes}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-white/30">Trailing DD</p>
                    <p className="text-sm font-medium text-white/80 mt-0.5">{c.trailing_drawdown ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new challenge */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 w-full rounded-xl border border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/25 px-4 py-3 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add new challenge
        </button>
      ) : (
        <form onSubmit={handleCreate} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
          <p className="text-sm font-semibold text-white">New Challenge</p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
              Name <span className="text-red-400 normal-case text-xs font-normal">(required)</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. FundedNext Evaluation $25k"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Account Size ($)', key: 'account_size' as const, step: 1000 },
              { label: 'Daily Loss Limit ($)', key: 'daily_loss_limit' as const, step: 50 },
              { label: 'Max Drawdown ($)', key: 'max_drawdown' as const, step: 100 },
              { label: 'Profit Target ($)', key: 'profit_target' as const, step: 100 },
            ].map(({ label, key, step }) => (
              <div key={key} className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">{label}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/30">$</span>
                  <input
                    type="number"
                    step={step}
                    min="0"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg bg-white/5 border border-white/10 pl-7 pr-3 py-2 text-sm text-white focus:outline-none focus:border-white/25"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, trailing_drawdown: !form.trailing_drawdown })}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border transition-colors ${
                form.trailing_drawdown
                  ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                  : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
              }`}
            >
              <div className={`h-3 w-3 rounded-full border ${form.trailing_drawdown ? 'bg-amber-400 border-amber-400' : 'border-white/30'}`} />
              Trailing drawdown
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Notes (optional)</label>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any special rules for this challenge…"
              rows={2}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
              className="flex-1 rounded-xl py-2.5 text-sm text-white/40 hover:text-white/60 border border-white/10 hover:border-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave || saving}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-white/10 hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed text-white border border-white/10 transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving…' : 'Save Challenge'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
