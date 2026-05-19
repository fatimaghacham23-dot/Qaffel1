import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, getStripeWebhookSecret, processStripeWebhookEvent, stripeObjectId } from "@/lib/billing-stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stripeEventObjectId(eventObject: unknown) {
  return stripeObjectId(eventObject) ?? null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Stripe webhook error.";
}

async function markWebhookEvent(
  supabase: ReturnType<typeof createAdminClient>,
  stripeEventId: string,
  status: "processing" | "succeeded" | "failed" | "skipped",
  error?: string | null
) {
  const { error: updateError } = await supabase
    .from("stripe_webhook_events")
    .update({
      status,
      processed_at: status === "processing" ? null : new Date().toISOString(),
      error_message: error ?? null
    })
    .eq("stripe_event_id", stripeEventId);

  if (updateError) throw new Error(updateError.message);
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  } catch (error) {
    return NextResponse.json({ error: `Stripe webhook verification failed: ${errorMessage(error)}` }, { status: 400 });
  }

  const supabase = createAdminClient();
  const eventObject = event.data.object as unknown;
  const objectId = stripeEventObjectId(eventObject);

  const { error: insertError } = await supabase.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    object_id: objectId,
    status: "processing"
  });

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: existing, error: existingError } = await supabase
        .from("stripe_webhook_events")
        .select("status")
        .eq("stripe_event_id", event.id)
        .maybeSingle();

      if (existingError) {
        return NextResponse.json({ error: existingError.message }, { status: 500 });
      }

      if (existing?.status === "failed") {
        await markWebhookEvent(supabase, event.id, "processing");
      } else {
        return NextResponse.json({ received: true, duplicate: true, status: existing?.status ?? "processing" });
      }
    } else {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  try {
    const result = await processStripeWebhookEvent(supabase, event);
    await markWebhookEvent(supabase, event.id, result.status);
    return NextResponse.json({ received: true, status: result.status, workspaceId: result.workspaceId ?? null });
  } catch (error) {
    const message = errorMessage(error);
    await markWebhookEvent(supabase, event.id, "failed", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
