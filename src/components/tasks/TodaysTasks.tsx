'use client'

// Today's Tasks widget — compact card showing today's tasks.
// Users can complete tasks inline and add new ones via an inline form.
// The AI coach can also create tasks; they surface here automatically.

import { useState, useEffect, useTransition } from 'react'
import { CheckSquare, Circle, CheckCircle2, Plus, X, Loader2, Clock } from 'lucide-react'
import {
  getTodaysTasks,
  completeTask,
  createTask,
} from '@/app/actions/coach-tasks'
import type { CoachTask } from '@/lib/types/coach-task'

// ── Module badge colours ─────────────────────────────────────────────────────

const MODULE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  trading:   { bg: 'bg-blue-500/15',   text: 'text-blue-300',   label: 'trading'   },
  training:  { bg: 'bg-green-500/15',  text: 'text-green-300',  label: 'training'  },
  nutrition: { bg: 'bg-orange-500/15', text: 'text-orange-300', label: 'nutrition' },
  health:    { bg: 'bg-violet-500/15', text: 'text-violet-300', label: 'health'    },
  personal:  { bg: 'bg-pink-500/15',   text: 'text-pink-300',   label: 'personal'  },
  general:   { bg: 'bg-white/10',      text: 'text-white/40',   label: 'general'   },
}

function ModuleBadge({ module }: { module?: string | null }) {
  const s = MODULE_STYLES[module ?? 'general'] ?? MODULE_STYLES.general
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

// ── Inline add form ──────────────────────────────────────────────────────────

type TaskModule = 'general' | 'training' | 'nutrition' | 'trading' | 'health' | 'personal'

function AddTaskForm({ onSave, onCancel }: { onSave: (task: CoachTask) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [module, setModule] = useState<TaskModule>('general')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    if (!title.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        const task = await createTask({
          title: title.trim(),
          due_date: new Date().toISOString().slice(0, 10),
          due_time: dueTime || null,
          module,
          source: 'user',
        })
        onSave(task)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save task')
      }
    })
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/8 space-y-2">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave()
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="Task title…"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25"
      />
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={dueTime}
          onChange={(e) => setDueTime(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 focus:outline-none focus:border-white/25 w-28"
        />
        <select
          value={module}
          onChange={(e) => setModule(e.target.value as TaskModule)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 focus:outline-none focus:border-white/25"
        >
          {Object.keys(MODULE_STYLES).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={!title.trim() || isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30 text-xs text-violet-300 hover:bg-violet-500/30 transition-colors disabled:opacity-40"
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Save
        </button>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

// ── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onComplete,
}: {
  task: CoachTask
  onComplete: (id: string) => void
}) {
  const [completing, setCompleting] = useState(false)
  const isDone = !!task.completed_at

  const handleClick = async () => {
    if (isDone || completing) return
    setCompleting(true)
    await onComplete(task.id)
    setCompleting(false)
  }

  return (
    <div
      className={`flex items-center gap-3 py-2 px-1 rounded-lg transition-colors group ${
        isDone ? 'opacity-40' : 'hover:bg-white/[0.03]'
      }`}
    >
      <button
        onClick={handleClick}
        disabled={isDone || completing}
        className="shrink-0 text-white/30 hover:text-violet-400 transition-colors disabled:cursor-default"
        aria-label={isDone ? 'Completed' : 'Mark complete'}
      >
        {completing ? (
          <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
        ) : isDone ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <span
          className={`text-sm ${
            isDone ? 'line-through text-white/30' : 'text-white/80'
          }`}
        >
          {task.title}
        </span>
        {task.notes && (
          <p className="text-xs text-white/30 truncate mt-0.5">{task.notes}</p>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {task.due_time && (
          <span className="flex items-center gap-0.5 text-[10px] text-white/30">
            <Clock className="h-2.5 w-2.5" />
            {task.due_time.slice(0, 5)}
          </span>
        )}
        <ModuleBadge module={task.module} />
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function TodaysTasks() {
  const [tasks, setTasks] = useState<CoachTask[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    getTodaysTasks()
      .then((data) => setTasks(data))
      .finally(() => setLoading(false))
  }, [])

  const handleComplete = async (id: string) => {
    try {
      await completeTask(id)
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, completed_at: new Date().toISOString() } : t
        )
      )
    } catch {
      // Silently fail — task row remains clickable for retry
    }
  }

  const handleTaskSaved = (task: CoachTask) => {
    setTasks((prev) => [...prev, task])
    setShowAddForm(false)
  }

  // Separate pending from completed so completed sink to bottom
  const pending = tasks.filter((t) => !t.completed_at)
  const completed = tasks.filter((t) => !!t.completed_at)
  const ordered = [...pending, ...completed]

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-emerald-500/5">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">Today&apos;s Tasks</span>
          {!loading && pending.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-medium">
              {pending.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      {/* Task list */}
      <div className="px-4 py-3">
        {loading && (
          <div className="flex items-center gap-2 py-4 justify-center">
            <Loader2 className="h-4 w-4 text-white/20 animate-spin" />
            <span className="text-xs text-white/30">Loading tasks…</span>
          </div>
        )}

        {!loading && ordered.length === 0 && !showAddForm && (
          <p className="text-xs text-white/30 py-4 text-center">
            No tasks today — ask the coach to add one
          </p>
        )}

        {!loading && ordered.map((task) => (
          <TaskRow key={task.id} task={task} onComplete={handleComplete} />
        ))}

        {showAddForm && (
          <AddTaskForm
            onSave={handleTaskSaved}
            onCancel={() => setShowAddForm(false)}
          />
        )}
      </div>
    </div>
  )
}
