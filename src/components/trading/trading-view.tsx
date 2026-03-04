"use client";

import { useState } from "react";
import { BarChart2, BookOpen, Building2, List, ScrollText } from "lucide-react";
import { TradesList } from "./trades-list";
import { TradeDetail } from "./trade-detail";
import { TradingAnalytics } from "./trading-analytics";
import { PropAccountsView } from "./prop-accounts-view";
import { StrategiesView } from "./strategies-view";
import { SessionJournal } from "./session-journal";
import { cn } from "@/lib/utils";
import type { Trade, PropAccount, Strategy } from "@/lib/types";

type Tab = "trades" | "analytics" | "journal" | "accounts" | "strategies";

interface Props {
  initialTrades: Trade[];
  initialAccounts: PropAccount[];
  initialStrategies: Strategy[];
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "trades", label: "Trades", icon: List },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "journal", label: "Journal", icon: ScrollText },
  { id: "accounts", label: "Accounts", icon: Building2 },
  { id: "strategies", label: "Strategies", icon: BookOpen },
];

export function TradingView({ initialTrades, initialAccounts, initialStrategies }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("trades");
  const [trades, setTrades] = useState<Trade[]>(initialTrades);
  const [accounts, setAccounts] = useState<PropAccount[]>(initialAccounts);
  const [strategies, setStrategies] = useState<Strategy[]>(initialStrategies);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1 shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === "trades" && (
          <TradesList
            trades={trades}
            propAccounts={accounts}
            strategies={strategies}
            onTradesChange={setTrades}
            onSelectTrade={(t) => setSelectedTrade(t)}
          />
        )}
        {activeTab === "analytics" && (
          <TradingAnalytics trades={trades} />
        )}
        {activeTab === "journal" && (
          <SessionJournal />
        )}
        {activeTab === "accounts" && (
          <PropAccountsView
            accounts={accounts}
            onAccountsChange={setAccounts}
          />
        )}
        {activeTab === "strategies" && (
          <StrategiesView
            strategies={strategies}
            onStrategiesChange={setStrategies}
          />
        )}
      </div>

      {/* Trade detail sheet */}
      {selectedTrade && (
        <TradeDetail
          trade={selectedTrade}
          propAccounts={accounts}
          strategies={strategies}
          onClose={() => setSelectedTrade(null)}
          onUpdated={(updated) => {
            setTrades(trades.map((t) => (t.id === updated.id ? updated : t)));
            setSelectedTrade(updated);
          }}
          onDeleted={(id) => {
            setTrades(trades.filter((t) => t.id !== id));
            setSelectedTrade(null);
          }}
        />
      )}
    </div>
  );
}
