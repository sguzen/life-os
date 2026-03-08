// Meals — Supabase query functions
// Meals table stores editable meal *definitions* (description, macros).
// Meal *status* (complete/partial/skipped) continues to live in nutrition_logs.

import { createClient } from './client'
import { createClient as createServerClient } from './server'

export interface Meal {
  id: string
  user_id: string
  day_type: 'training' | 'rest'
  meal_name: string   // matches nutrition_logs column: 'meal_breakfast', etc.
  label: string
  icon: string
  description: string | null
  calories: number | null
  protein: number | null
  carbs: number | null
  fats: number | null
  order_index: number
  created_at: string
  updated_at: string
}

export type MealUpdate = Partial<Pick<Meal, 'label' | 'description' | 'calories' | 'protein' | 'carbs' | 'fats' | 'icon'>>

// Hardcoded seed data — mirrors MEAL_DETAILS / MEAL_LABELS from nutrition types
const SEED_MEALS: Omit<Meal, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
  // ── Training days ────────────────────────────────────────────────────────
  {
    day_type: 'training',
    meal_name: 'meal_post_run',
    label: 'Post-Run Recovery',
    icon: '🏃',
    description: '500ml water + 1 scoop BCAA (300ml)',
    calories: 30,
    protein: 7,
    carbs: 2,
    fats: 0,
    order_index: 0,
  },
  {
    day_type: 'training',
    meal_name: 'meal_breakfast',
    label: 'Breakfast 07:30',
    icon: '🌅',
    description: '50g red lentils + 40g oats + turmeric/BP/onion/OO + 25g soy mince',
    calories: 380,
    protein: 28,
    carbs: 52,
    fats: 8,
    order_index: 1,
  },
  {
    day_type: 'training',
    meal_name: 'meal_lunch',
    label: 'Lunch 12:00',
    icon: '☀️',
    description: 'Carb choice + 50g soy mince + 6-8 tbsp veggies/salad',
    calories: 450,
    protein: 30,
    carbs: 55,
    fats: 8,
    order_index: 2,
  },
  {
    day_type: 'training',
    meal_name: 'meal_snack1',
    label: 'Snack 1 · 16:30',
    icon: '🍎',
    description: 'Muesli (30g carb) + 25g vegan protein in plant milk',
    calories: 320,
    protein: 30,
    carbs: 35,
    fats: 6,
    order_index: 3,
  },
  {
    day_type: 'training',
    meal_name: 'meal_snack2',
    label: 'Snack 2 · 18:30',
    icon: '🫒',
    description: '7 olives + 20g bread + 1 cucumber',
    calories: 120,
    protein: 3,
    carbs: 15,
    fats: 7,
    order_index: 4,
  },
  {
    day_type: 'training',
    meal_name: 'meal_snack3',
    label: 'Snack 3 · 19:30',
    icon: '🥤',
    description: 'Shake: 250ml almond/coconut milk + 30g vegan protein',
    calories: 180,
    protein: 30,
    carbs: 5,
    fats: 5,
    order_index: 5,
  },
  {
    day_type: 'training',
    meal_name: 'meal_snack4',
    label: 'Snack 4 · 21:30',
    icon: '🌙',
    description: '1 fruit portion + 15g raw nuts',
    calories: 180,
    protein: 4,
    carbs: 20,
    fats: 9,
    order_index: 6,
  },
  // ── Rest days ────────────────────────────────────────────────────────────
  {
    day_type: 'rest',
    meal_name: 'meal_breakfast',
    label: 'Breakfast 08:00',
    icon: '🌅',
    description: '50g red lentils + 40g oats + turmeric/BP/onion/OO + 25g soy mince',
    calories: 380,
    protein: 28,
    carbs: 52,
    fats: 8,
    order_index: 0,
  },
  {
    day_type: 'rest',
    meal_name: 'meal_lunch',
    label: 'Lunch 13:00',
    icon: '☀️',
    description: 'Smaller carb choice + 50g soy mince + 8-10 tbsp veggies/salad',
    calories: 400,
    protein: 30,
    carbs: 45,
    fats: 8,
    order_index: 1,
  },
  {
    day_type: 'rest',
    meal_name: 'meal_snack1',
    label: 'Snack 1 · 16:00',
    icon: '🍎',
    description: 'Muesli (25g carb) + 25g vegan protein in plant milk',
    calories: 290,
    protein: 30,
    carbs: 28,
    fats: 6,
    order_index: 2,
  },
  {
    day_type: 'rest',
    meal_name: 'meal_snack2',
    label: 'Snack 2 · 18:30',
    icon: '🫒',
    description: '7 olives + 20g bread + 1 cucumber',
    calories: 120,
    protein: 3,
    carbs: 15,
    fats: 7,
    order_index: 3,
  },
  {
    day_type: 'rest',
    meal_name: 'meal_snack3',
    label: 'Snack 3 · 19:30',
    icon: '🥤',
    description: 'Shake: 250ml almond/coconut milk + 25g vegan protein',
    calories: 155,
    protein: 25,
    carbs: 5,
    fats: 5,
    order_index: 4,
  },
  {
    day_type: 'rest',
    meal_name: 'meal_snack4',
    label: 'Snack 4 · 21:00',
    icon: '🌙',
    description: '1 fruit portion + 15g raw nuts',
    calories: 180,
    protein: 4,
    carbs: 20,
    fats: 9,
    order_index: 5,
  },
]

// ── Seed (idempotent) ─────────────────────────────────────────────────────────

export async function seedMeals(): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { count } = await supabase
    .from('meals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) > 0) return

  await supabase
    .from('meals')
    .insert(SEED_MEALS.map((m) => ({ ...m, user_id: user.id })))
}

export async function seedMealsServer(): Promise<void> {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { count } = await supabase
    .from('meals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) > 0) return

  await supabase
    .from('meals')
    .insert(SEED_MEALS.map((m) => ({ ...m, user_id: user.id })))
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getMealsForDayType(dayType: 'training' | 'rest'): Promise<Meal[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('day_type', dayType)
    .order('order_index')
  if (error) throw error
  return data ?? []
}

export async function getServerMealsForDayType(
  supabase: ReturnType<typeof createServerClient>,
  dayType: 'training' | 'rest'
): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('day_type', dayType)
    .order('order_index')
  if (error) return []
  return data ?? []
}

export async function getMealById(id: string): Promise<Meal | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

// ── Update (client-side — for manual edit dialog) ─────────────────────────────

export async function updateMealClient(
  mealId: string,
  updates: MealUpdate,
  reason?: string,
  changedBy: 'user' | 'ai_life_coach' = 'user'
): Promise<Meal> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Fetch current for audit
  const { data: current } = await supabase
    .from('meals')
    .select('*')
    .eq('id', mealId)
    .eq('user_id', user.id)
    .single()

  if (!current) throw new Error('Meal not found')

  const { data, error } = await supabase
    .from('meals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', mealId)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) throw error

  // Audit trail
  await supabase.from('meal_changes').insert({
    meal_id: mealId,
    user_id: user.id,
    changed_by: changedBy,
    previous_value: current,
    new_value: data,
    reason: reason ?? null,
  })

  // plan_audit_log entry
  await supabase.from('plan_audit_log').insert({
    user_id: user.id,
    module: 'nutrition',
    entity_type: 'meal',
    entity_description: current.label,
    action: 'update',
    field_changed: Object.keys(updates).join(', '),
    previous_value: JSON.stringify(
      Object.fromEntries(Object.keys(updates).map((k) => [k, (current as Record<string, unknown>)[k]]))
    ),
    new_value: JSON.stringify(updates),
    reason: reason ?? null,
    changed_by: changedBy,
  })

  return data
}
