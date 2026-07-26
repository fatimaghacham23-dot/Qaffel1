type PublicEnvironmentName = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "NEXT_PUBLIC_APP_URL";

const productionLike = () => process.env.NODE_ENV === "production";

export function readPublicEnvironment(
  name: PublicEnvironmentName,
  developmentFallback: string,
  environment: Record<string, string | undefined> = process.env,
  requireConfigured = productionLike()
) {
  const value = environment[name]?.trim();
  const invalidSupabaseUrl = name === "NEXT_PUBLIC_SUPABASE_URL" && value === "https://example.supabase.co";
  const invalidAnonKey = name === "NEXT_PUBLIC_SUPABASE_ANON_KEY" && value === "placeholder-anon-key";
  if (requireConfigured && (!value || invalidSupabaseUrl || invalidAnonKey)) {
    throw new Error(`Missing or invalid required public environment variable: ${name}`);
  }
  return value || developmentFallback;
}

export const supabaseUrl = readPublicEnvironment("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
export const supabaseAnonKey = readPublicEnvironment("NEXT_PUBLIC_SUPABASE_ANON_KEY", "placeholder-anon-key");
export const publicAppUrl = readPublicEnvironment("NEXT_PUBLIC_APP_URL", "http://localhost:3000", process.env, false);
