import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/onboarding", "/assessments", "/roadmap", "/recommendations", "/analytics", "/profile"];

/**
 * Refreshes the Supabase session cookie on navigation and guards learner pages.
 * Authorization is still enforced by the API (JWT verification) and the database (RLS);
 * this only decides where to send the browser.
 *
 * Next.js strips router headers before the proxy runs, so it can't tell a link prefetch from a
 * navigation. Redirecting signed-in users away from /login here would get cached by the router as
 * that route's content; that redirect lives in the auth form instead.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  if (!signedIn && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
