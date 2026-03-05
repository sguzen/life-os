// Internal endpoint — send a push notification to all subscriptions of the
// authenticated user.  Can also be called via a cron job (with a secret).

import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

function initWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL ?? "mailto:admin@life-os.app";

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(email, publicKey, privateKey);
  return true;
}

export async function POST(request: NextRequest) {
  if (!initWebPush()) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 503 });
  }

  // Allow a cron secret or authenticated user
  const cronSecret = request.headers.get("x-cron-secret");
  const supabase = createClient();

  let userId: string;

  if (cronSecret && cronSecret === process.env.CRON_SECRET) {
    // Cron job: body must include user_id
    const body = (await request.json()) as {
      user_id?: string;
      title?: string;
      body?: string;
      url?: string;
      tag?: string;
    };
    if (!body.user_id) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }
    userId = body.user_id;

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    await sendToSubscriptions(supabase, subs ?? [], {
      title: body.title ?? "Life OS",
      body: body.body ?? "",
      url: body.url ?? "/dashboard",
      tag: body.tag,
    });

    return NextResponse.json({ ok: true, sent: subs?.length ?? 0 });
  }

  // Authenticated user triggering their own notification (test / manual)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    body?: string;
    url?: string;
    tag?: string;
  };

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", user.id);

  await sendToSubscriptions(supabase, subs ?? [], {
    title: body.title ?? "Life OS",
    body: body.body ?? "",
    url: body.url ?? "/dashboard",
    tag: body.tag,
  });

  return NextResponse.json({ ok: true, sent: subs?.length ?? 0 });
}

async function sendToSubscriptions(
  supabase: ReturnType<typeof createClient>,
  subs: Array<{ endpoint: string; p256dh: string; auth: string; user_id: string }>,
  payload: { title: string; body: string; url: string; tag?: string }
) {
  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    )
  );

  // Clean up expired/invalid subscriptions
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      const err = result.reason as { statusCode?: number };
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        // Subscription gone — remove it
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", subs[i].endpoint)
          .eq("user_id", subs[i].user_id);
      }
    }
  }
}
