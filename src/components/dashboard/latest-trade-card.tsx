// Latest trade summary — P&L + rule compliance

import Link from 'next/link'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface LatestTradeData {
  instrument: string
  direction: 'long' | 'short'
  net_pnl: number | null
  outcome: string
  followed_rules: boolean | null
  entry_time: string
  prop_account_label: string | null
}

interface LatestTradeCardProps {
  trade: LatestTradeData | null
}

export function LatestTradeCard({ trade }: LatestTradeCardProps) {
  if (!trade) {
    return (
      <Link href="/dashboard" className="block">
        <div className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow h-full">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
            Latest Trade
          </p>
          <p className="text-sm text-muted-foreground">No trades logged yet.</p>
        </div>
      </Link>
    )
  }

  const pnl = trade.net_pnl ?? 0
  const isProfit = pnl >= 0
  const isOpen = trade.outcome === 'open'

  const outcomeColors: Record<string, string> = {
    win: 'text-green-500 bg-green-500/10',
    loss: 'text-red-500 bg-red-500/10',
    break_even: 'text-amber-500 bg-amber-500/10',
    open: 'text-blue-500 bg-blue-500/10',
  }

  const dateStr = new Date(trade.entry_time).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Link href="/dashboard" className="block">
      <div className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow h-full">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
          Latest Trade
        </p>

        <div className="space-y-3">
          {/* Instrument + direction + outcome badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold">{trade.instrument}</span>
            <span className="text-sm text-muted-foreground capitalize">{trade.direction}</span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                outcomeColors[trade.outcome] ?? 'text-muted-foreground bg-muted'
              )}
            >
              {isOpen ? 'Open' : trade.outcome.replace('_', ' ')}
            </span>
          </div>

          {/* P&L */}
          <div className="flex items-baseline gap-1">
            <span
              className={cn(
                'text-2xl font-bold tabular-nums',
                isOpen ? 'text-muted-foreground' : isProfit ? 'text-green-500' : 'text-red-500'
              )}
            >
              {isOpen ? (
                <span className="flex items-center gap-1 text-base">
                  <Clock className="h-4 w-4" /> In progress
                </span>
              ) : (
                `${isProfit ? '+' : ''}$${pnl.toFixed(2)}`
              )}
            </span>
          </div>

          {/* Rules + date */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {trade.followed_rules !== null ? (
              <span className="flex items-center gap-1">
                {trade.followed_rules ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    Rules followed
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                    Rules broken
                  </>
                )}
              </span>
            ) : (
              <span />
            )}
            <span>{dateStr}</span>
          </div>

          {trade.prop_account_label && (
            <p className="text-xs text-muted-foreground truncate">
              {trade.prop_account_label}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
