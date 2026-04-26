/**
 * CLI wrapper for the mock data seeder.
 * Usage: USER_ID=<uuid> npx tsx scripts/seed-mock-data.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { createClient } from '@supabase/supabase-js'
// Must come after dotenv so env vars are set before the lib reads them
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { seedMockData } = require('../src/lib/seed/mock-data') as typeof import('../src/lib/seed/mock-data')

async function main() {
  const userId = process.env.USER_ID
  if (!userId) {
    console.error('Usage: USER_ID=<uuid> npx tsx scripts/seed-mock-data.ts')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(url, key, { auth: { persistSession: false } })

  console.log(`Seeding 30 days of mock data for user ${userId}…`)
  const { inserted, errors } = await seedMockData(userId, supabase)

  if (errors.length > 0) {
    console.error('Errors:', errors)
    process.exit(1)
  }

  console.log(`Done. ${inserted} rows upserted.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
