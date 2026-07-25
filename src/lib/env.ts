const production = process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";

function publicValue(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "NEXT_PUBLIC_APP_URL", developmentFallback: string) {
  const value = process.env[name];
  if (production && !value) throw new Error(`${name} is required in production.`);
  return value || developmentFallback;
}

export const supabaseUrl = publicValue("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
export const supabaseAnonKey = publicValue("NEXT_PUBLIC_SUPABASE_ANON_KEY", "placeholder-anon-key");
export const appUrl = publicValue("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

// Server-only. Never import this value from a client component.
export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
