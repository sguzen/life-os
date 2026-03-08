// Life OS — Master Coach page
// Full-system AI coach with cross-module context and tool-calling

import { MasterCoach } from '@/components/ai/master-coach'
import { Bot, Pill, Settings, TrendingUp, Activity, BarChart2 } from 'lucide-react'

const CAPABILITIES = [
  { icon: Activity, label: 'Running', desc: 'Pace analysis, HR trends, race prep' },
  { icon: Pill, label: 'Supplements', desc: 'Pause, resume, timing guidance' },
  { icon: TrendingUp, label: 'Marathon', desc: 'Training sessions, week reviews' },
  { icon: Settings, label: 'Plan Configs', desc: 'Adjust paces, targets, thresholds' },
  { icon: BarChart2, label: 'Nutrition', desc: 'Adherence scores, hydration, violations' },
  { icon: Bot, label: 'Habits', desc: 'Streak tracking, completion rates' },
]

export default function CoachPage() {
  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bot className="h-5 w-5 text-violet-400" />
          <h1 className="text-xl font-semibold text-white">Life OS Coach</h1>
        </div>
        <p className="text-sm text-white/40">
          Full-system AI coach with visibility across all modules.
          Ask questions or request changes — it can pause supplements, update plan configs, and more.
        </p>
      </div>

      {/* Capabilities grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {CAPABILITIES.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="flex flex-col gap-1.5 px-3 py-3 rounded-lg bg-white/5 border border-white/10"
          >
            <Icon className="h-4 w-4 text-violet-400/70" />
            <p className="text-xs font-medium text-white/70">{label}</p>
            <p className="text-[11px] text-white/30 leading-snug">{desc}</p>
          </div>
        ))}
      </div>

      {/* Coach chat — full width */}
      <MasterCoach />
    </div>
  )
}
