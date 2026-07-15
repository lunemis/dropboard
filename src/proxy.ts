import { NextRequest, NextResponse } from "next/server";
import { isUnsafeNoAuthEnabled } from "./lib/config";
import { SESSION_COOKIE, verifySessionToken } from "./lib/session";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/health"];
// /raw self-authenticates (signed URL / bearer / cookie) — see the route
const RAW_RE = /^\/api\/items\/[^/]+\/raw$/;
// public share page — self-authenticates via its own signed/epoch-checked query params
const SHARE_RE = /^\/s\/[^/]+$/;

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    PUBLIC_PATHS.includes(pathname) ||
    RAW_RE.test(pathname) ||
    SHARE_RE.test(pathname)
  ) {
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
  if (!secret) {
    if (isUnsafeNoAuthEnabled()) return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "server authentication is not configured" },
        { status: 503 },
      );
    }
    return new NextResponse("server authentication is not configured", {
      status: 503,
    });
  }

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
