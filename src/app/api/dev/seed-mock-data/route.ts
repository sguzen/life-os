// Dev-only endpoint — seeds 30 days of correlated mock data for the logged-in user.
// Blocked in production.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { seedMockData } from '@/lib/seed/mock-data'

export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse('Not Found', { status: 404 })
  }

  // Use the user-scoped client only to authenticate
  const supabase = createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use the service client (bypasses RLS) for the actual inserts
  const serviceClient = createServiceClient()
  const { inserted, errors } = await seedMockData(user.id, serviceClient)

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 500 })
  }

  return NextResponse.json({ ok: true, inserted })
}
