'use client'

// P4-06: Race tracker — upcoming and completed races

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flag, Plus, CheckCircle2, Clock, MapPin, X, Pencil, Trash2 } from 'lucide-react'
import { formatPace, formatDuration, daysUntil } from '@/lib/running/format'
import { addRace, editRace, deleteRace } from '@/app/actions/running'
import type { RaceTarget } from '@/lib/types/running'

interface RaceTrackerProps {
  races: RaceTarget[]
}

// ── Helpers ───────────────────────────────────────────────────

function secondsToHMS(s: number | null): string {
  if (!s) return ''
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// ── Race form (shared by add + edit) ─────────────────────────

interface RaceFormProps {
  initial?: RaceTarget
  onClose: () => void
}

function RaceForm({ initial, onClose }: RaceFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const result = initial
      ? await editRace(initial.id, null, fd)
      : await addRace(null, fd)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      onClose()
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-white">{initial ? 'Edit race' : 'New race'}</p>
        <button type="button" onClick={onClose} className="text-white/30 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
      )}

      <input
        name="race_name"
        required
        defaultValue={initial?.race_name}
        placeholder="Race name *"
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500"
      />
      <input
        name="location"
        defaultValue={initial?.location ?? ''}
        placeholder="Location (optional)"
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500"
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-white/40 mb-1 block">Date *</label>
          <input
            type="date"
            name="race_date"
            required
            defaultValue={initial?.race_date}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/40 mb-1 block">Distance (km) *</label>
          <input
            type="number"
            name="distance_km"
            step="0.1"
            required
            defaultValue={initial?.distance_km}
            placeholder="42.2"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-white/40 mb-1 block">Target time (H:MM:SS) *</label>
        <input
          name="target_time"
          required
          defaultValue={secondsToHMS(initial?.target_time_seconds ?? null)}
          placeholder="3:30:00"
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-indigo-500"
        />
      </div>
      {initial && (
        <div>
          <label className="text-[10px] text-white/40 mb-1 block">Actual time (H:MM:SS) — leave blank if not yet run</label>
          <input
            name="actual_time"
            defaultValue={secondsToHMS(initial.actual_time_seconds)}
            placeholder="3:28:12"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}
      {!initial && <input type="hidden" name="actual_time" value="" />}
      <textarea
        name="notes"
        rows={2}
        defaultValue={initial?.notes ?? ''}
        placeholder="Notes (optional)"
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500 resize-none"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold py-2 transition-colors"
      >
        {loading ? 'Saving…' : initial ? 'Save changes' : 'Add race'}
      </button>
    </form>
  )
}

// ── Race card ─────────────────────────────────────────────────

function RaceCard({ race }: { race: RaceTarget }) {
  const router = useRouter()
  const days = daysUntil(race.race_date)
  const isCompleted = race.actual_time_seconds != null
  const isPast = days < 0

  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const targetPace = race.target_pace_sec_per_km
  const actualPace = race.actual_time_seconds
    ? Math.round(race.actual_time_seconds / race.distance_km)
    : null

  const timeDiff = race.actual_time_seconds
    ? race.actual_time_seconds - race.target_time_seconds
    : null

  const raceDateFormatted = new Date(race.race_date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  async function handleDelete() {
    setDeleting(true)
    await deleteRace(race.id)
    router.refresh()
  }

  if (editing) {
    return <RaceForm initial={race} onClose={() => setEditing(false)} />
  }

  return (
    <div className={`
      rounded-xl border p-5 space-y-3 transition-all
      ${isCompleted ? 'border-green-500/30 bg-green-500/5' : isPast ? 'border-white/10 bg-white/5 opacity-60' : 'border-indigo-500/30 bg-indigo-500/5'}
    `}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white text-base truncate">{race.race_name}</h3>
            {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />{raceDateFormatted}
            </span>
            {race.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />{race.location}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2">
          {/* Countdown / result badge */}
          <div className={`
            shrink-0 rounded-lg px-3 py-1.5 text-center min-w-[64px]
            ${isCompleted ? 'bg-green-500/20 text-green-300' : isPast ? 'bg-white/10 text-white/40' : 'bg-indigo-500/20 text-indigo-300'}
          `}>
            {isCompleted ? (
              <span className="text-xs font-semibold">Done</span>
            ) : isPast ? (
              <span className="text-xs">Elapsed</span>
            ) : (
              <>
                <p className="text-xl font-bold leading-none">{days}</p>
                <p className="text-[10px] mt-0.5 opacity-70">days</p>
              </>
            )}
          </div>

          {/* Edit / delete */}
          <div className="flex flex-col gap-1.5 pt-0.5">
            <button
              onClick={() => setEditing(true)}
              className="text-white/20 hover:text-indigo-400 transition-colors"
              title="Edit race"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="text-white/20 hover:text-red-400 transition-colors"
              title="Delete race"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirming && (
        <div className="flex items-center gap-3 pt-1 border-t border-white/10">
          <span className="text-xs text-white/50">Delete this race?</span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Yes, delete'}
          </button>
          <button onClick={() => setConfirming(false)} className="text-xs text-white/40 hover:text-white">
            Cancel
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-white/40 mb-0.5">Distance</p>
          <p className="font-medium text-white">{race.distance_km} km</p>
        </div>
        <div>
          <p className="text-white/40 mb-0.5">Target time</p>
          <p className="font-medium text-white font-mono">{formatDuration(race.target_time_seconds)}</p>
        </div>
        <div>
          <p className="text-white/40 mb-0.5">Target pace</p>
          <p className="font-medium text-white font-mono">{formatPace(targetPace)}</p>
        </div>
      </div>

      {isCompleted && race.actual_time_seconds && (
        <div className="border-t border-white/10 pt-3 grid grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-white/40 mb-0.5">Actual time</p>
            <p className="font-medium text-white font-mono">{formatDuration(race.actual_time_seconds)}</p>
          </div>
          <div>
            <p className="text-white/40 mb-0.5">Actual pace</p>
            <p className="font-medium text-white font-mono">{formatPace(actualPace)}</p>
          </div>
          {timeDiff != null && (
            <div>
              <p className="text-white/40 mb-0.5">vs target</p>
              <p className={`font-semibold font-mono ${timeDiff <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {timeDiff <= 0 ? '-' : '+'}{formatDuration(Math.abs(timeDiff))}
              </p>
            </div>
          )}
        </div>
      )}

      {race.notes && (
        <p className="text-xs text-white/40 italic">{race.notes}</p>
      )}
    </div>
  )
}

// ── Tracker ───────────────────────────────────────────────────

export function RaceTracker({ races }: RaceTrackerProps) {
  const [showForm, setShowForm] = useState(false)
  const upcoming = races.filter((r) => !r.actual_time_seconds && daysUntil(r.race_date) >= 0)
  const completed = races.filter((r) => r.actual_time_seconds || daysUntil(r.race_date) < 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-white">Race Tracker</h2>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add race
          </button>
        )}
      </div>

      {showForm && <RaceForm onClose={() => setShowForm(false)} />}

      {!showForm && races.length === 0 && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-6 text-center">
          <Flag className="h-8 w-8 text-white/20 mx-auto mb-2" />
          <p className="text-sm text-white/40">No races yet</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-white/30 uppercase tracking-wider">Upcoming</p>
          {upcoming.map((r) => <RaceCard key={r.id} race={r} />)}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-white/30 uppercase tracking-wider">Completed</p>
          {completed.map((r) => <RaceCard key={r.id} race={r} />)}
        </div>
      )}
    </div>
  )
}
