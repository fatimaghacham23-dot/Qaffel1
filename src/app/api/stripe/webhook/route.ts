import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, getStripeWebhookSecret, processStripeWebhookEvent, stripeObjectId } from "@/lib/billing-stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimStripeWebhookEvent } from "@/lib/stripe-webhook";

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

  try {
    const claim = await claimStripeWebhookEvent(supabase, {
      eventId: event.id,
      eventType: event.type,
      objectId
    });
    if (!claim.claimed) {
      return NextResponse.json({ received: true, duplicate: true, status: claim.status });
    }
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
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
