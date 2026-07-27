import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env-public";
import { getServerEnvironment } from "@/lib/env-server";

export function createAdminClient() {
  const { supabaseServiceRoleKey } = getServerEnvironment();

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

