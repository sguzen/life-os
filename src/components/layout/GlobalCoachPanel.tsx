'use client'

// GlobalCoachPanel — persistent floating Life Coach accessible from any page.
// A floating button (bottom-right) opens a collapsible side panel containing
// the full LifeCoach component with module focus + proposal cards.

import { useState, useEffect } from 'react'
import { Brain, X, ChevronRight } from 'lucide-react'
import { LifeCoach } from '@/components/ai/life-coach'

export function GlobalCoachPanel() {
  const [open, setOpen] = useState(false)

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Life Coach"
        className={`
          fixed bottom-6 right-6 z-40
          flex items-center gap-2
          rounded-full border border-violet-500/30 bg-[#0a0a0a] px-4 py-3
          text-sm font-medium text-violet-300
          shadow-lg shadow-violet-900/20
          transition-all duration-200
          hover:bg-violet-500/10 hover:border-violet-500/50 hover:shadow-violet-900/40
          ${open ? 'opacity-0 pointer-events-none' : 'opacity-100'}
        `}
      >
        <Brain className="h-4 w-4 text-violet-400" />
        <span className="hidden sm:inline">Life Coach</span>
      </button>

      {/* Backdrop (mobile only) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Side panel */}
      <div
        className={`
          fixed top-0 right-0 z-50 h-screen w-full sm:w-[480px]
          flex flex-col
          border-l border-white/8 bg-[#0a0a0a]
          shadow-2xl
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Panel header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">Global Life Coach</span>
            <span className="text-xs text-white/30">· all modules</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-white/30 hover:text-white/70 transition-colors"
            aria-label="Close coach panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Panel body — scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          {open && <LifeCoach />}
        </div>

        {/* Collapse handle */}
        <button
          onClick={() => setOpen(false)}
          className="shrink-0 flex items-center justify-center gap-1.5 border-t border-white/8 py-3 text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5" />
          Close panel
        </button>
      </div>
    </>
  )
}
