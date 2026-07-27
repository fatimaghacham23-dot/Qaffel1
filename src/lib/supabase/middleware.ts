import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env-public";

type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

function isPublicRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/auth") ||
    /^\/(pay|receipt|client|share)(\/|$)/.test(pathname)
  );
}

function isRouteHandlerPath(pathname: string) {
  return pathname.startsWith("/api/") || pathname === "/api" || /^\/reports\/csv(\/|$)/.test(pathname);
}

function shouldRedirectLoggedOutRequest(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method.toUpperCase();
  const accept = request.headers.get("accept") || "";

  return (
    (method === "GET" || method === "HEAD") &&
    accept.includes("text/html") &&
    !isPublicRoute(pathname) &&
    !isRouteHandlerPath(pathname)
  );
}

function authCookieNames(request: NextRequest) {
  return request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter(
      (name) =>
        name.startsWith("sb-") ||
        name.startsWith("supabase-") ||
        name === "supabase-auth-token" ||
        name === "sb-access-token" ||
        name === "sb-refresh-token"
    );
}

function clearAuthCookies(request: NextRequest, response: NextResponse) {
  authCookieNames(request).forEach((name) => {
    request.cookies.delete(name);
    response.cookies.set(name, "", { maxAge: 0, path: "/" });
  });
}

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
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user && shouldRedirectLoggedOutRequest(request)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("session", "required");
      return NextResponse.redirect(url);
    }

    return response;
  } catch {
    const pathname = request.nextUrl.pathname;

    if (isPublicRoute(pathname) || isRouteHandlerPath(pathname)) {
      const nextResponse = NextResponse.next({ request });
      clearAuthCookies(request, nextResponse);
      return nextResponse;
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("session", "required");

    const redirectResponse = NextResponse.redirect(url);
    clearAuthCookies(request, redirectResponse);
    return redirectResponse;
  }
}
