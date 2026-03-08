// Plan Configs + Audit Log — TypeScript Types

export type ConfigType = 'number' | 'text' | 'boolean' | 'pace' | 'json'
export type ChangedBy = 'user' | 'ai_coach' | 'ai_life_coach' | 'adaptation_engine' | 'system'

export interface PlanConfig {
  id: string
  user_id: string
  module: string
  config_key: string
  config_label: string
  config_value: string
  config_type: ConfigType
  config_unit: string | null
  description: string | null
  editable_by_user: boolean
  editable_by_ai: boolean
  last_changed_at: string | null
  last_changed_by: string | null
  change_reason: string | null
  created_at: string
}

export type PlanConfigUpdate = Pick<PlanConfig, 'config_value'> & {
  change_reason?: string
  changed_by?: ChangedBy
}

export interface AuditLogEntry {
  id: string
  user_id: string
  changed_at: string
  module: string
  entity_type: string
  entity_description: string | null
  action: string
  field_changed: string | null
  previous_value: string | null
  new_value: string | null
  reason: string | null
  changed_by: ChangedBy
  coach_conversation_id: string | null
}

// Default seed values — inserted on first load if not present
export const DEFAULT_PLAN_CONFIGS: Omit<PlanConfig, 'id' | 'user_id' | 'last_changed_at' | 'last_changed_by' | 'change_reason' | 'created_at'>[] = [
  // Marathon paces
  { module: 'marathon', config_key: 'easy_pace_min',    config_label: 'Easy Pace Min',          config_value: '6:10',    config_type: 'pace',    config_unit: '/km',    description: 'Lower bound of easy/recovery pace zone', editable_by_user: true, editable_by_ai: true },
  { module: 'marathon', config_key: 'easy_pace_max',    config_label: 'Easy Pace Max',          config_value: '6:30',    config_type: 'pace',    config_unit: '/km',    description: 'Upper bound of easy/recovery pace zone', editable_by_user: true, editable_by_ai: true },
  { module: 'marathon', config_key: 'gmp_pace',         config_label: 'Goal Marathon Pace',     config_value: '5:00',    config_type: 'pace',    config_unit: '/km',    description: 'Target race pace for Belgrade', editable_by_user: true, editable_by_ai: true },
  { module: 'marathon', config_key: 'tempo_pace_min',   config_label: 'Tempo Pace Min',         config_value: '4:50',    config_type: 'pace',    config_unit: '/km',    description: null, editable_by_user: true, editable_by_ai: true },
  { module: 'marathon', config_key: 'tempo_pace_max',   config_label: 'Tempo Pace Max',         config_value: '4:55',    config_type: 'pace',    config_unit: '/km',    description: null, editable_by_user: true, editable_by_ai: true },
  { module: 'marathon', config_key: 'vo2_pace_min',     config_label: 'VO2 Max Pace Min',       config_value: '4:30',    config_type: 'pace',    config_unit: '/km',    description: null, editable_by_user: true, editable_by_ai: true },
  { module: 'marathon', config_key: 'vo2_pace_max',     config_label: 'VO2 Max Pace Max',       config_value: '4:40',    config_type: 'pace',    config_unit: '/km',    description: null, editable_by_user: true, editable_by_ai: true },
  { module: 'marathon', config_key: 'race_goal',        config_label: 'Belgrade Race Goal',     config_value: '3:32:00', config_type: 'text',    config_unit: null,     description: 'Target finish time for Belgrade Marathon Apr 19', editable_by_user: true, editable_by_ai: false },
  { module: 'marathon', config_key: 'rhr_baseline_min', config_label: 'RHR Baseline Min',       config_value: '42',      config_type: 'number',  config_unit: 'bpm',    description: 'Minimum normal resting heart rate', editable_by_user: true, editable_by_ai: true },
  { module: 'marathon', config_key: 'rhr_baseline_max', config_label: 'RHR Baseline Max',       config_value: '49',      config_type: 'number',  config_unit: 'bpm',    description: 'Maximum normal resting heart rate', editable_by_user: true, editable_by_ai: true },
  { module: 'marathon', config_key: 'weight_target',    config_label: 'Race Day Weight Target', config_value: '62',      config_type: 'number',  config_unit: 'kg',     description: 'Target weight for race day', editable_by_user: true, editable_by_ai: true },
  // Nutrition
  { module: 'nutrition', config_key: 'water_rest',      config_label: 'Water Target (rest day)',config_value: '2000',    config_type: 'number',  config_unit: 'ml',     description: null, editable_by_user: true, editable_by_ai: true },
  { module: 'nutrition', config_key: 'water_run',       config_label: 'Water Target (run day)', config_value: '3000',   config_type: 'number',  config_unit: 'ml',     description: null, editable_by_user: true, editable_by_ai: true },
  { module: 'nutrition', config_key: 'weight_loss_max', config_label: 'Max Weekly Weight Loss', config_value: '0.5',    config_type: 'number',  config_unit: 'kg',     description: 'Maximum safe weight loss per week', editable_by_user: true, editable_by_ai: true },
  { module: 'nutrition', config_key: 'alcohol_max_week',config_label: 'Max Alcohol Per Week',   config_value: '2',      config_type: 'number',  config_unit: 'glasses',description: null, editable_by_user: true, editable_by_ai: true },
  // Trading gate
  { module: 'trading', config_key: 'gate_min_sleep',    config_label: 'Gate: Min Sleep',        config_value: '6',       config_type: 'number',  config_unit: 'hours',  description: 'Minimum sleep hours to pass trading gate', editable_by_user: true, editable_by_ai: true },
  { module: 'trading', config_key: 'gate_min_physical', config_label: 'Gate: Min Physical',     config_value: '5',       config_type: 'number',  config_unit: null,     description: 'Minimum physical readiness score (0-10)', editable_by_user: true, editable_by_ai: true },
  { module: 'trading', config_key: 'gate_min_emotional',config_label: 'Gate: Min Emotional',    config_value: '5',       config_type: 'number',  config_unit: null,     description: 'Minimum emotional readiness score (0-10)', editable_by_user: true, editable_by_ai: true },
  { module: 'trading', config_key: 'gate_alcohol_block',config_label: 'Alcohol = Hard Block',   config_value: 'true',    config_type: 'boolean', config_unit: null,     description: 'Block trading next day if alcohol consumed', editable_by_user: true, editable_by_ai: false },
  { module: 'trading', config_key: 'max_trades_day',    config_label: 'Max Trade Plans/Day',    config_value: '2',       config_type: 'number',  config_unit: null,     description: null, editable_by_user: true, editable_by_ai: true },
  { module: 'trading', config_key: 'revenge_lock_at',   config_label: 'Revenge Lock Threshold', config_value: '2',       config_type: 'number',  config_unit: 'losses', description: 'Lock trading after N consecutive losses', editable_by_user: true, editable_by_ai: true },
]

/** Parse a config value to its typed representation */
export function parseConfigValue(config: PlanConfig): string | number | boolean | unknown {
  switch (config.config_type) {
    case 'number':
      return parseFloat(config.config_value)
    case 'boolean':
      return config.config_value === 'true'
    case 'json':
      try { return JSON.parse(config.config_value) } catch { return config.config_value }
    default:
      return config.config_value
  }
}

/** Format a config value for display */
export function formatConfigDisplay(config: PlanConfig): string {
  if (config.config_type === 'boolean') {
    return config.config_value === 'true' ? 'ON' : 'OFF'
  }
  if (config.config_unit) {
    return `${config.config_value} ${config.config_unit}`
  }
  return config.config_value
}
