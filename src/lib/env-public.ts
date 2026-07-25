const isProductionBuild = process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";

function readPublicEnvironment(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "NEXT_PUBLIC_APP_URL", developmentFallback: string) {
  const value = process.env[name]?.trim();
  if (isProductionBuild && !value) throw new Error(`Missing required public environment variable: ${name}`);
  return value || developmentFallback;
}

export const supabaseUrl = readPublicEnvironment("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
export const supabaseAnonKey = readPublicEnvironment("NEXT_PUBLIC_SUPABASE_ANON_KEY", "placeholder-anon-key");
export const publicAppUrl = readPublicEnvironment("NEXT_PUBLIC_APP_URL", "http://localhost:3000");