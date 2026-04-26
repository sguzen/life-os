'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function MockDataButton() {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleClick() {
    setState('loading')
    setMessage('')
    try {
      const res = await fetch('/api/dev/seed-mock-data', { method: 'POST' })
      const text = await res.text()
      console.log('[seed]', res.status, text)

      if (!res.ok) {
        setState('error')
        setMessage(`${res.status}: ${text.slice(0, 120)}`)
        return
      }

      const json = JSON.parse(text)
      setState('done')
      setMessage(`${json.inserted} rows seeded`)
      router.refresh()
    } catch (err) {
      setState('error')
      setMessage(String(err))
    }
  }

  const label =
    state === 'loading'
      ? 'Generating…'
      : state === 'done'
        ? `Done — ${message}`
        : state === 'error'
          ? `Error: ${message}`
          : 'Generate 30 Days of Mock Data'

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      title="Dev only — seeds correlated mock data for the Correlation Engine"
      className={[
        'fixed bottom-4 left-4 z-50 px-3 py-1.5 rounded-md text-xs font-mono border',
        'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        state === 'error'
          ? 'bg-red-950 border-red-700 text-red-300'
          : state === 'done'
            ? 'bg-green-950 border-green-700 text-green-300'
            : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200',
      ].join(' ')}
    >
      🌱 {label}
    </button>
  )
}
