// Nutrition AI Coach — daily advice based on today's log

import { geminiFlash, geminiPro } from '@/lib/ai/google-model'
import { streamText } from 'ai'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const ATHLETE_PROFILE = `
ATHLETE PROFILE:
- Silviya, 43F, Cyprus (EET)
- Height: 166.2cm | Current weight: ~67kg | Target: 62kg by April 19, 2026
- Body fat: 24.5% → target 19.9% | Excess fat: 3.2kg to lose
- Muscle mass: 48.5kg — MUST NOT decrease
- BMR: 1497 kcal | Goal rate: 500-1000g fat loss per week
- Diet: Vegan (recently reintroduced eggs for protein)
- Training: Marathon training, runs FASTED 04:00-06:30 Cyprus EET
- Race: Belgrade Marathon April 19, 2026
- Working with dietician Emine Ömerağa — follow her plan strictly
- Known struggles: bread/sugar cravings, alcohol consumption, irregular eating under stress
`

const MEAL_PLAN = `
PRESCRIBED MEAL PLAN (Emine Ömerağa, 11.12.2025):
Weekday (run days):
- 05:00-06:30: Run fasted
- Post-run: 500ml water + 1 scoop BCAA (300ml)
- 07:30-08:00 Breakfast: 50g raw red lentils + 40g oats + turmeric/black pepper/onion/olive oil + 25g soy mince
- 12:00-12:30 Lunch: Carb choice + 50g soy mince (16g C / 26g P / 0.4g F) + 6-8 tbsp veggies/salad
- 16:30 Snack 1: Muesli (30g carb equiv) + 25g vegan protein powder in unsweetened plant milk
- 18:30 Snack 2: 7 olives + 20g bread + 1 cucumber
- 19:30 Snack 3: Shake: 250ml unsweetened almond/coconut milk + 30g vegan protein powder
- 21:30 Snack 4: 1 fruit portion + 15g raw nuts

Lunch carb options: 8 tbsp legumes | 4 tbsp rice | 40g raw quinoa/buckwheat | veg rice pilaf | 200g potato | 360g beetroot | 40g raw GF pasta
Fruit options (Snack 4): 120g pineapple/mango | 100g apple/pear | 2 mandarins | 1 orange | 75g banana | 100g pomegranate

RULES:
- No alcohol until first body measurement, then max 2 yeast-free glasses/week
- No fried food, no processed snacks, no juice/soda
- Minimum 2L water (3L on run days)
- NEVER skip meals — muscle catabolism risk
- Legume rule: every 4 tbsp legumes = reduce bread by 30g
`

export async function POST(req: Request) {
  const { logDate } = await req.json()

  const supabase = createClient()
  const today = logDate ?? new Date().toISOString().slice(0, 10)

  // Fetch today's nutrition log and supplement log
  const [nutritionRes, supplementRes, trainingRes] = await Promise.allSettled([
    supabase.from('nutrition_logs').select('*').eq('log_date', today).maybeSingle(),
    supabase.from('supplement_logs').select('*').eq('log_date', today).maybeSingle(),
    supabase
      .from('running_activities')
      .select('workout_type, distance_meters, started_at')
      .order('started_at', { ascending: false })
      .limit(3),
  ])

  const nutritionLog =
    nutritionRes.status === 'fulfilled' ? nutritionRes.value.data : null
  const supplementLog =
    supplementRes.status === 'fulfilled' ? supplementRes.value.data : null
  const recentRuns =
    trainingRes.status === 'fulfilled' ? trainingRes.value.data ?? [] : []

  // Build tomorrow's date for training context
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  const tomorrowRun = recentRuns.find((r) => r.started_at?.startsWith(tomorrowStr))

  function mealStatus(status: string | null) {
    return status ?? 'pending'
  }

  const nutritionContext = nutritionLog
    ? `
TODAY'S NUTRITION LOG (${today}):
Meals:
- Post-run recovery: ${mealStatus(nutritionLog.meal_post_run)}
- Breakfast: ${mealStatus(nutritionLog.meal_breakfast)}
- Lunch: ${mealStatus(nutritionLog.meal_lunch)}${nutritionLog.meal_lunch_carb_choice ? ` (carb: ${nutritionLog.meal_lunch_carb_choice})` : ''}
- Snack 1: ${mealStatus(nutritionLog.meal_snack1)}
- Snack 2: ${mealStatus(nutritionLog.meal_snack2)}
- Snack 3: ${mealStatus(nutritionLog.meal_snack3)}
- Snack 4: ${mealStatus(nutritionLog.meal_snack4)}${nutritionLog.meal_snack4_fruit ? ` (fruit: ${nutritionLog.meal_snack4_fruit})` : ''}

Water: ${nutritionLog.water_ml ?? 0}ml
Alcohol: ${nutritionLog.alcohol_consumed ? `YES — ${nutritionLog.alcohol_details ?? 'no details'}` : 'No'}

Violations flagged:
- Fried food: ${nutritionLog.had_fried_food ? 'YES' : 'No'}
- Processed snacks: ${nutritionLog.had_processed_snacks ? 'YES' : 'No'}
- Juice/soda: ${nutritionLog.had_juice_soda ? 'YES' : 'No'}
- Bread/sugar: ${nutritionLog.had_bread_sugar ? 'YES (known struggle)' : 'No'}

Adherence score: ${nutritionLog.adherence_score ?? 'not computed'}%

Meal notes: ${JSON.stringify(nutritionLog.meal_notes ?? {})}
`
    : `TODAY'S NUTRITION LOG (${today}): No log found — user has not yet logged today.`

  const supplementContext = supplementLog
    ? `
TODAY'S SUPPLEMENTS:
- NO 3 (15 tablets): ${supplementLog.no3_taken ? '✓' : '✗'}
- Zentius Flash (2 tablets): ${supplementLog.zentius_taken ? '✓' : '✗'}
- Zinc Bisglycinate: ${supplementLog.zinc_taken ? '✓' : '✗'}
- Folic Acid: ${supplementLog.folic_acid_taken ? '✓' : '✗'}
- Mg Bisglycinate: ${supplementLog.mg_bisglycinate_taken ? '✓' : '✗'}
- Mg Diasporal + Melatonin: ${supplementLog.mg_melatonin_taken ? '✓' : '✗'}
- Se ACE Zinc: ${supplementLog.se_ace_zinc_taken ? '✓' : '✗'}
- Iron: ${supplementLog.iron_taken ? '✓' : '✗'}
- Vitamin D3 (weekly): ${supplementLog.vitamin_d3_taken ? '✓' : 'not today'}
- B12 (2x/week): ${supplementLog.b12_taken ? '✓' : 'not today'}
`
    : 'SUPPLEMENTS: Not logged today.'

  const trainingContext =
    recentRuns.length > 0
      ? `Recent training: ${recentRuns.map((r) => `${r.workout_type} ${((r.distance_meters ?? 0) / 1000).toFixed(1)}km on ${r.started_at?.slice(0, 10)}`).join(', ')}`
      : 'Training: No recent runs logged.'

  const tomorrowContext = tomorrowRun
    ? `Tomorrow (${tomorrowStr}): ${tomorrowRun.workout_type} scheduled`
    : `Tomorrow (${tomorrowStr}): training session not logged yet`

  const systemPrompt = `You are a sports nutrition coach for a vegan marathon runner.
${ATHLETE_PROFILE}
${MEAL_PLAN}

Give concise, direct coaching. Max 150 words. No fluff. Be specific, not generic.

Always give exactly these 4 sections:
1. ADHERENCE: Score + what was good
2. ONE FIX: The single most impactful thing to correct (specific)
3. TOMORROW PREP: Based on tomorrow's training, specific nutrition advice
4. SUPPLEMENT REMINDER: Any supplement missed today (or "All taken ✓")`

  const userMessage = `${nutritionContext}
${supplementContext}
${trainingContext}
${tomorrowContext}

Give me my daily nutrition coaching.`

  const result = streamText({
    model: geminiPro(),
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    maxOutputTokens: 400,
    temperature: 0.6,
  })

  return result.toTextStreamResponse()
}
