// Active prop firm: balance + daily P&L vs daily loss limit

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PropAccountData {
  firm: string
  account_label: string
  balance: number | null
  account_size: number
  daily_loss_limit: number | null
  today_pnl: number
}

interface PropAccountCardProps {
  account: PropAccountData | null
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function PropAccountCard({ account }: PropAccountCardProps) {
  if (!account) {
    return (
      <Link href="/trading" className="block">
        <div className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow h-full">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
            Prop Account
          </p>
          <p className="text-sm text-muted-foreground">No active prop account.</p>
        </div>
      </Link>
    )
  }

  const { firm, account_label, balance, account_size, daily_loss_limit, today_pnl } = account

  // Daily loss usage: today_pnl is negative when losing
  const dailyLoss = Math.abs(Math.min(0, today_pnl))
  const limitUsedPct =
    daily_loss_limit && daily_loss_limit > 0 ? (dailyLoss / daily_loss_limit) * 100 : 0
  const isNearLimit = limitUsedPct >= 70
  const isAtLimit = limitUsedPct >= 95

  const balancePct = balance != null && account_size > 0 ? (balance / account_size) * 100 : null

  const barColor = isAtLimit
    ? 'bg-red-500'
    : isNearLimit
    ? 'bg-amber-500'
    : 'bg-indigo-500'

  return (
    <Link href="/trading" className="block">
      <div className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow h-full">
        <div className="flex items-start justify-between mb-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Prop Account
          </p>
          {isNearLimit && (
            <AlertTriangle className={cn('h-4 w-4', isAtLimit ? 'text-red-500' : 'text-amber-500')} />
          )}
        </div>

        <p className="text-sm font-semibold truncate mb-4">
          {firm} — {account_label}
        </p>

        {/* Balance */}
        {balance != null && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Balance</span>
              <span>{balancePct != null ? `${balancePct.toFixed(1)}% of account` : ''}</span>
            </div>
            <p className="text-xl font-bold tabular-nums">${fmt(balance)}</p>
            <p className="text-xs text-muted-foreground">Account size: ${fmt(account_size)}</p>
          </div>
        )}

        {/* Daily limit progress bar */}
        {daily_loss_limit != null && (
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Daily limit used</span>
              <span
                className={cn(
                  'font-medium tabular-nums',
                  isAtLimit ? 'text-red-500' : isNearLimit ? 'text-amber-500' : 'text-muted-foreground'
                )}
              >
                ${fmt(dailyLoss)} / ${fmt(daily_loss_limit)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', barColor)}
                style={{ width: `${Math.min(100, limitUsedPct)}%` }}
              />
            </div>
            {today_pnl > 0 && (
              <p className="mt-1 text-xs text-green-500 font-medium">
                +${fmt(today_pnl)} today
              </p>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
