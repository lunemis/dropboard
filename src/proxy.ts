import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/session";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];
// /raw self-authenticates (signed URL / bearer / cookie) — see the route
const RAW_RE = /^\/api\/items\/[^/]+\/raw$/;

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.includes(pathname) || RAW_RE.test(pathname)) {
    return NextResponse.next();
  }

  // CLI / AI sessions: bearer token grants full API access
  if (pathname.startsWith("/api/")) {
    const token = process.env.DROPBOARD_TOKEN;
    if (token && req.headers.get("authorization") === `Bearer ${token}`) {
      return NextResponse.next();
    }
  }

  const secret = process.env.DROPBOARD_SESSION_SECRET;
  if (!secret) return NextResponse.next(); // auth not configured (bare dev)

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookie && (await verifySessionToken(cookie, secret))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
