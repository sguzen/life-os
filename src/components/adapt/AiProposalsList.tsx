'use client'

import { useState } from 'react'
import { AiProposalCard } from './AiProposalCard'

interface ProposalItem {
  module: string
  change_type: string
  description: string
  params?: Record<string, unknown>
}

interface AdaptEvent {
  id: string
  event_type: string
  payload: Record<string, unknown>
  proposal: ProposalItem[]
  proposal_at: string
  created_at: string
}

export function AiProposalsList({ initialEvents }: { initialEvents: AdaptEvent[] }) {
  const [events, setEvents] = useState(initialEvents)

  function handleResolved(eventId: string) {
    setEvents((prev) => prev.filter((e) => e.id !== eventId))
  }

  if (events.length === 0) return null

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <AiProposalCard key={event.id} event={event} onResolved={handleResolved} />
      ))}
    </div>
  )
}
