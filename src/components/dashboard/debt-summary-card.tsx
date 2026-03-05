// Debt remaining + last payout logged

import Link from 'next/link'
import { TrendingDown, Banknote } from 'lucide-react'

export interface DebtSummaryData {
  total_remaining: number
  debt_count: number
  total_original: number
  last_payout: {
    firm_name: string
    amount: number
    payout_date: string
  } | null
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function DebtSummaryCard({ data }: { data: DebtSummaryData }) {
  const paidOff =
    data.total_original > 0
      ? ((data.total_original - data.total_remaining) / data.total_original) * 100
      : 0

  return (
    <Link href="/finance" className="block">
      <div className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow h-full">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
          Debt Payoff
        </p>

        {data.total_remaining > 0 ? (
          <div className="space-y-3">
            <div>
              <p className="text-2xl font-bold tabular-nums">
                ${fmt(data.total_remaining)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                remaining across {data.debt_count} debt{data.debt_count !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Payoff progress */}
            {data.total_original > 0 && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span className="flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" /> Paid off
                  </span>
                  <span>{paidOff.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${paidOff}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm font-medium text-green-500">All debts cleared!</p>
        )}

        {/* Last payout */}
        {data.last_payout && (
          <div className="mt-4 pt-4 border-t flex items-start gap-2">
            <Banknote className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-green-500">
                +${fmt(data.last_payout.amount)}
              </span>{' '}
              payout from {data.last_payout.firm_name} ·{' '}
              {new Date(data.last_payout.payout_date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}
