import { validatePublicSupabaseConfig } from "@/lib/env-public-validation";
export type { PublicSupabaseConfig } from "@/lib/env-public-validation";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const browserConfiguration = validatePublicSupabaseConfig(rawSupabaseUrl, rawSupabaseAnonKey);

export const supabaseUrl = browserConfiguration.supabaseUrl;
export const supabaseAnonKey = browserConfiguration.supabaseAnonKey;
export const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
