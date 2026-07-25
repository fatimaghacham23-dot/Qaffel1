import "server-only";

type ServerEnvironment = {
  appUrl: string;
  supabaseServiceRoleKey: string;
  stripeSecretKey: string | null;
  stripeWebhookSecret: string | null;
};

function required(name: "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("Server configuration is incomplete.");
  return value;
}

function optional(name: string) {
  return process.env[name]?.trim() || null;
}

function canonicalBaseUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production") throw new Error("Server configuration is incomplete.");
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

export function getServerEnvironment(): ServerEnvironment {
  const configuredUrl = process.env.APP_URL?.trim() || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (!configuredUrl) throw new Error("Server configuration is incomplete.");
  return {
    appUrl: canonicalBaseUrl(configuredUrl),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    stripeSecretKey: optional("STRIPE_SECRET_KEY"),
    stripeWebhookSecret: optional("STRIPE_WEBHOOK_SECRET")
  };
}

export function requireStripeWebhookSecret() {
  const value = getServerEnvironment().stripeWebhookSecret;
  if (!value) throw new Error("Stripe webhook verification is not configured.");
  return value;
}