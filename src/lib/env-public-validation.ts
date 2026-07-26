export type PublicSupabaseConfig = { supabaseUrl: string; supabaseAnonKey: string };

function isValidSupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co") && url.hostname !== "example.supabase.co";
  } catch {
    return false;
  }
}

export function validatePublicSupabaseConfig(rawUrl: string | undefined, rawAnonKey: string | undefined): PublicSupabaseConfig {
  const supabaseUrl = rawUrl?.trim() || "";
  const supabaseAnonKey = rawAnonKey?.trim() || "";
  if (!isValidSupabaseUrl(supabaseUrl)) throw new Error("Missing or invalid required public environment variable: NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey || supabaseAnonKey === "placeholder-anon-key") throw new Error("Missing or invalid required public environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return { supabaseUrl, supabaseAnonKey };
}
