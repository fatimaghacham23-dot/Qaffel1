"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env-public";

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
