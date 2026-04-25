import { DynamicLogForm } from '@/components/logs/DynamicLogForm'
import { DomainCoach } from '@/components/ai/DomainCoach'
import { RecentLogs } from '@/components/logs/RecentLogs'

export default function WorkPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Work</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Log deep work sessions and professional goals.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <DynamicLogForm category="work" />
          <RecentLogs category="work" />
        </div>
        <DomainCoach category="work" />
      </div>
    </div>
  )
}
