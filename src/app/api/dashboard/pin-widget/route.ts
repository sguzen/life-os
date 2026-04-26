import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const bodySchema = z.object({
  widget_config: z.object({
    chart_type: z.enum(['line', 'bar', 'scatter']),
    metric_keys: z.array(z.string()).min(1),
    title: z.string().optional().nullable(),
  }),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid widget config' }, { status: 400 });
  }

  const { error } = await supabase
    .from('user_dashboards')
    .insert({ user_id: user.id, widget_config: parsed.data.widget_config });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
