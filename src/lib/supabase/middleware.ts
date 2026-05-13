import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  try {
    await supabase.auth.getUser();
    return response;
  } catch {
    const url = request.nextUrl.clone();
    url.pathname = "/login";

    const redirectResponse = NextResponse.redirect(url);
    const cookiesToClear = request.cookies
      .getAll()
      .map((c) => c.name)
      .filter(
        (name) =>
          name.startsWith("sb-") ||
          name.startsWith("supabase-") ||
          name === "supabase-auth-token" ||
          name === "sb-access-token" ||
          name === "sb-refresh-token"
      );

    cookiesToClear.forEach((name) => {
      redirectResponse.cookies.set(name, "", { maxAge: 0, path: "/" });
    });

    return redirectResponse;
  }
}
