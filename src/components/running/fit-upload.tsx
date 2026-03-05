'use client'

// P4-03: .fit file upload form

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Loader2, AlertCircle } from 'lucide-react'
import { workoutTypeEnum } from '@/lib/validations/running'
import { formatPace } from '@/lib/running/format'

const WORKOUT_TYPES = workoutTypeEnum.options

export function FitUpload() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [workoutType, setWorkoutType] = useState('easy')
  const [prescribedPace, setPrescribedPace] = useState('')  // "M:SS" string
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFile(f: File) {
    if (!f.name.endsWith('.fit')) {
      setError('Only .fit files are supported')
      return
    }
    setFile(f)
    setError(null)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  /** Parse "M:SS" → seconds-per-km, or return null */
  function parsePaceInput(raw: string): number | null {
    const match = raw.trim().match(/^(\d+):(\d{2})$/)
    if (!match) return null
    return parseInt(match[1]) * 60 + parseInt(match[2])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('workout_type', workoutType)
    if (prescribedPace) {
      const paceSeconds = parsePaceInput(prescribedPace)
      if (paceSeconds) formData.append('prescribed_pace_sec_per_km', String(paceSeconds))
    }
    if (notes) formData.append('notes', notes)

    try {
      const res = await fetch('/api/runs/upload', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      router.push(`/running/${json.activity.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const paceSeconds = parsePaceInput(prescribedPace)

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`
          relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed
          px-6 py-10 cursor-pointer transition-colors
          ${dragging ? 'border-indigo-500 bg-indigo-950/30' : 'border-white/20 hover:border-white/40 bg-white/5'}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".fit"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        {file ? (
          <>
            <FileText className="h-8 w-8 text-indigo-400" />
            <p className="text-sm font-medium text-white">{file.name}</p>
            <p className="text-xs text-white/50">{(file.size / 1024).toFixed(1)} KB — click to change</p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-white/40" />
            <p className="text-sm text-white/60">Drop a <span className="font-semibold text-white">.fit file</span> here or click to browse</p>
          </>
        )}
      </div>

      {/* Workout type */}
      <div>
        <label className="block text-xs font-medium text-white/60 mb-1.5">Workout type</label>
        <select
          value={workoutType}
          onChange={(e) => setWorkoutType(e.target.value)}
          className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {WORKOUT_TYPES.map((t) => (
            <option key={t} value={t} className="bg-gray-900">
              {t.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* Prescribed pace */}
      <div>
        <label className="block text-xs font-medium text-white/60 mb-1.5">
          Prescribed pace <span className="text-white/30">(optional, format M:SS)</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="e.g. 5:30"
            value={prescribedPace}
            onChange={(e) => setPrescribedPace(e.target.value)}
            className="flex-1 rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {paceSeconds && (
            <span className="text-xs text-white/50">{formatPace(paceSeconds)}</span>
          )}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-white/60 mb-1.5">Notes <span className="text-white/30">(optional)</span></label>
        <textarea
          rows={2}
          placeholder="How did the run feel?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!file || loading}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Parsing .fit file…</> : <><Upload className="h-4 w-4" /> Upload Activity</>}
      </button>
    </form>
  )
}
