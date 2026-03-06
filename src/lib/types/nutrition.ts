// Nutrition Tracking Module — TypeScript Types

export type MealStatus = 'pending' | 'complete' | 'partial' | 'skipped' | 'modified'

export type LunchCarbChoice =
  | 'legumes'
  | 'rice'
  | 'quinoa_buckwheat'
  | 'veg_rice_pilaf'
  | 'potato'
  | 'beetroot'
  | 'gf_pasta'

export type FruitChoice =
  | 'pineapple_mango'
  | 'apple_pear'
  | 'mandarins'
  | 'orange'
  | 'banana'
  | 'pomegranate'

export interface NutritionLog {
  id: string
  user_id: string
  log_date: string // YYYY-MM-DD

  // Meal adherence
  meal_post_run: MealStatus
  meal_breakfast: MealStatus
  meal_lunch: MealStatus
  meal_lunch_carb_choice: LunchCarbChoice | null
  meal_snack1: MealStatus
  meal_snack2: MealStatus
  meal_snack3: MealStatus
  meal_snack4: MealStatus
  meal_snack4_fruit: FruitChoice | null

  // Per-meal notes
  meal_notes: Record<string, string>

  // Water
  water_ml: number

  // Alcohol
  alcohol_consumed: boolean
  alcohol_details: string | null

  // Violations
  had_fried_food: boolean
  had_processed_snacks: boolean
  had_juice_soda: boolean
  had_bread_sugar: boolean

  // Body composition (optional — log when measured)
  weight_kg: number | null
  body_fat_pct: number | null

  // AI coaching
  ai_daily_advice: string | null
  ai_advice_generated_at: string | null

  // Computed adherence
  adherence_score: number | null

  created_at: string
  updated_at: string
}

export type NutritionLogInput = Partial<Omit<NutritionLog, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

export interface SupplementLog {
  id: string
  user_id: string
  log_date: string

  // Daily
  no3_taken: boolean
  zentius_taken: boolean
  zinc_taken: boolean
  folic_acid_taken: boolean
  mg_bisglycinate_taken: boolean
  mg_melatonin_taken: boolean
  se_ace_zinc_taken: boolean

  // Weekly
  vitamin_d3_taken: boolean
  b12_taken: boolean

  // Iron
  iron_taken: boolean

  notes: string | null

  created_at: string
}

export type SupplementLogInput = Partial<Omit<SupplementLog, 'id' | 'user_id' | 'created_at'>>

export interface BodyMeasurement {
  id: string
  user_id: string
  measured_at: string // YYYY-MM-DD
  weight_kg: number | null
  body_fat_pct: number | null
  fat_mass_kg: number | null
  muscle_mass_kg: number | null
  waist_upper_cm: number | null
  waist_mid_cm: number | null
  waist_lower_cm: number | null
  hip_cm: number | null
  notes: string | null
  created_at: string
}

export type BodyMeasurementInput = Omit<BodyMeasurement, 'id' | 'user_id' | 'created_at'>

// Meal plan constants
export const LUNCH_CARB_LABELS: Record<LunchCarbChoice, string> = {
  legumes: '8 tbsp legumes',
  rice: '4 tbsp rice / mujaddara / basmati',
  quinoa_buckwheat: 'Quinoa or buckwheat (40g raw)',
  veg_rice_pilaf: 'Vegetable rice pilaf',
  potato: '200g potato',
  beetroot: '360g beetroot',
  gf_pasta: 'GF pasta (40g raw)',
}

export const FRUIT_LABELS: Record<FruitChoice, string> = {
  pineapple_mango: '120g pineapple or mango',
  apple_pear: '100g apple or pear',
  mandarins: '2 mandarins',
  orange: '1 orange',
  banana: '75g banana',
  pomegranate: '100g pomegranate',
}

export const MEAL_LABELS: Record<string, string> = {
  meal_post_run: 'Post-Run Recovery',
  meal_breakfast: 'Breakfast 07:30',
  meal_lunch: 'Lunch 12:00',
  meal_snack1: 'Snack 1 · 16:30',
  meal_snack2: 'Snack 2 · 18:30',
  meal_snack3: 'Snack 3 · 19:30',
  meal_snack4: 'Snack 4 · 21:30',
}

export const MEAL_ICONS: Record<string, string> = {
  meal_post_run: '🏃',
  meal_breakfast: '🌅',
  meal_lunch: '☀️',
  meal_snack1: '🍎',
  meal_snack2: '🫒',
  meal_snack3: '🥤',
  meal_snack4: '🌙',
}

export const MEAL_DETAILS: Record<string, string> = {
  meal_post_run: '500ml water + 1 scoop BCAA (300ml)',
  meal_breakfast: '50g red lentils + 40g oats + turmeric/BP/onion/OO + 25g soy mince',
  meal_lunch: 'Carb choice + 50g soy mince + 6-8 tbsp veggies/salad',
  meal_snack1: 'Muesli (30g carb) + 25g vegan protein in plant milk',
  meal_snack2: '7 olives + 20g bread + 1 cucumber',
  meal_snack3: 'Shake: 250ml almond/coconut milk + 30g vegan protein',
  meal_snack4: '1 fruit portion + 15g raw nuts',
}

// Adherence score calculation (pure function — no DB dependency)
export function calculateAdherence(log: Partial<NutritionLog> & { had_run_day?: boolean }): number {
  const meals: MealStatus[] = [
    log.meal_post_run ?? 'pending',
    log.meal_breakfast ?? 'pending',
    log.meal_lunch ?? 'pending',
    log.meal_snack1 ?? 'pending',
    log.meal_snack2 ?? 'pending',
    log.meal_snack3 ?? 'pending',
    log.meal_snack4 ?? 'pending',
  ]

  let score = 0

  meals.forEach((m) => {
    if (m === 'complete') score += 10
    else if (m === 'partial' || m === 'modified') score += 6
    else if (m === 'skipped') score += 0
    else score += 5 // pending = neutral
  })

  // Water: up to 15 points
  const waterTarget = log.had_run_day ? 3000 : 2000
  score += Math.min(15, Math.round(((log.water_ml ?? 0) / waterTarget) * 15))

  // Violations: -5 each, max -15
  const violations = [
    log.had_fried_food ?? false,
    log.had_processed_snacks ?? false,
    log.had_juice_soda ?? false,
    log.had_bread_sugar ?? false,
  ].filter(Boolean).length
  score -= Math.min(15, violations * 5)

  // Alcohol: -15
  if (log.alcohol_consumed) score -= 15

  return Math.max(0, Math.min(100, score))
}
