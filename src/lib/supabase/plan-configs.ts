// Plan Configs + Audit Log — Supabase query functions

import { createClient } from './client'
import type { PlanConfig, AuditLogEntry, ChangedBy } from '@/lib/types/plan-configs'
import { DEFAULT_PLAN_CONFIGS } from '@/lib/types/plan-configs'

// ── Plan Configs ──────────────────────────────────────────────

export async function getPlanConfigs(module?: string): Promise<PlanConfig[]> {
  const supabase = createClient()
  let query = supabase.from('plan_configs').select('*')
  if (module) query = query.eq('module', module)
  query = query.order('module').order('config_key')
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getPlanConfig(module: string, key: string): Promise<PlanConfig | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('plan_configs')
    .select('*')
    .eq('module', module)
    .eq('config_key', key)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function updatePlanConfig(
  module: string,
  key: string,
  newValue: string,
  reason?: string,
  changedBy: ChangedBy = 'user'
): Promise<PlanConfig> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get current for audit
  const { data: current } = await supabase
    .from('plan_configs')
    .select('*')
    .eq('user_id', user.id)
    .eq('module', module)
    .eq('config_key', key)
    .maybeSingle()

  const { data, error } = await supabase
    .from('plan_configs')
    .update({
      config_value: newValue,
      last_changed_at: new Date().toISOString(),
      last_changed_by: changedBy,
      change_reason: reason ?? null,
    })
    .eq('user_id', user.id)
    .eq('module', module)
    .eq('config_key', key)
    .select()
    .single()
  if (error) throw error

  // Audit
  await supabase.from('plan_audit_log').insert({
    user_id: user.id,
    module,
    entity_type: 'plan_config',
    entity_description: current?.config_label ?? key,
    action: 'update',
    field_changed: key,
    previous_value: current?.config_value ?? null,
    new_value: newValue,
    reason: reason ?? null,
    changed_by: changedBy,
  })

  return data
}

export async function seedDefaultPlanConfigs(): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { count } = await supabase
    .from('plan_configs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) > 0) return

  await supabase.from('plan_configs').insert(
    DEFAULT_PLAN_CONFIGS.map((c) => ({ ...c, user_id: user.id }))
  )
}

// ── Audit Log ─────────────────────────────────────────────────

export async function getAuditLog(
  limit = 50,
  module?: string
): Promise<AuditLogEntry[]> {
  const supabase = createClient()
  let query = supabase
    .from('plan_audit_log')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(limit)
  if (module) query = query.eq('module', module)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function writeAuditLog(entry: Omit<AuditLogEntry, 'id' | 'user_id' | 'changed_at'>): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('plan_audit_log').insert({ ...entry, user_id: user.id })
}
