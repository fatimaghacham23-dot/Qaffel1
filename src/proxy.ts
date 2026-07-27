import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/pay/")) {
    return updateSession(request);
  }

  const headers = new Headers(request.headers);
  headers.set("x-qaffel-public-lang", request.nextUrl.searchParams.get("lang") === "ar" ? "ar" : "en");
  return updateSession(new NextRequest(request, { headers }));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};