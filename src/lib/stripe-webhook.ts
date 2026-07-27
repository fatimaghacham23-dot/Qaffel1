import "server-only";
type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

export type StripeWebhookClaimClient = {
  rpc(
    name: string,
    args: {
      p_event_id: string;
      p_event_type: string;
      p_object_id: string | null;
    }
  ): PromiseLike<RpcResult>;
};

export type StripeWebhookClaim = {
  claimed: boolean;
  status: string;
};

function firstRow(value: unknown): Record<string, unknown> | null {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" ? (row as Record<string, unknown>) : null;
}

export async function claimStripeWebhookEvent(
  client: StripeWebhookClaimClient,
  input: {
    eventId: string;
    eventType: string;
    objectId: string | null;
  }
): Promise<StripeWebhookClaim> {
  const { data, error } = await client.rpc("claim_stripe_webhook_event", {
    p_event_id: input.eventId,
    p_event_type: input.eventType,
    p_object_id: input.objectId
  });

  if (error) throw new Error(error.message);
  const row = firstRow(data);
  if (!row || typeof row.claimed !== "boolean" || typeof row.current_status !== "string") {
    throw new Error("Stripe webhook claim returned an invalid result.");
  }

  return {
    claimed: row.claimed,
    status: row.current_status
  };
}

export function shouldApplyStripeEvent(
  incomingCreatedAt: string | null | undefined,
  persistedCreatedAt: string | null | undefined
) {
  if (!incomingCreatedAt || !persistedCreatedAt) return true;
  const incoming = Date.parse(incomingCreatedAt);
  const persisted = Date.parse(persistedCreatedAt);
  if (!Number.isFinite(incoming) || !Number.isFinite(persisted)) return true;
  return incoming >= persisted;
}
