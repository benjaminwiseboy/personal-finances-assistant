import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic redirect on the presence of the session cookie only (no DB hit).
// The real check happens server-side in the (app) layout and in every
// action / data route via getUserId(). There is deliberately no reverse
// redirect away from /login: a stale cookie would bounce between the two.
export function middleware(request: NextRequest) {
  if (
    !getSessionCookie(request) &&
    !request.nextUrl.pathname.startsWith("/login")
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|sw.js|~offline|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
