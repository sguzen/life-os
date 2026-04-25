import { DynamicLogForm } from '@/components/logs/DynamicLogForm'
import { DomainCoach } from '@/components/ai/DomainCoach'
import { RecentLogs } from '@/components/logs/RecentLogs'

export default function HobbyPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Hobby</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track creative projects and personal pursuits.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <DynamicLogForm category="hobby" />
          <RecentLogs category="hobby" />
        </div>
        <DomainCoach category="hobby" />
      </div>
    </div>
  )
}
