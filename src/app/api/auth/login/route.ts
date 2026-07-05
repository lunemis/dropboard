import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "../../../../lib/session";

const SESSION_TTL_MS = 180 * 24 * 3600 * 1000; // 180 days
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

// in-memory lockout — single-user server, resets on restart (acceptable)
let fails = 0;
let lockedUntil = 0;

export async function POST(req: NextRequest) {
  const pin = process.env.DROPBOARD_PIN;
  const secret = process.env.DROPBOARD_SESSION_SECRET;
  if (!pin || !secret) {
    return NextResponse.json(
      { error: "server missing DROPBOARD_PIN / DROPBOARD_SESSION_SECRET" },
      { status: 500 },
    );
  }

  const now = Date.now();
  if (now < lockedUntil) {
    return NextResponse.json(
      { error: "locked", retry_after_s: Math.ceil((lockedUntil - now) / 1000) },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (String(body.pin ?? "") !== pin) {
    fails++;
    if (fails >= MAX_FAILS) {
      fails = 0;
      lockedUntil = now + LOCK_MS;
      return NextResponse.json(
        { error: "locked", retry_after_s: LOCK_MS / 1000 },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "wrong pin", remaining: MAX_FAILS - fails },
      { status: 401 },
    );
  }

  fails = 0;
  const token = await createSessionToken(secret, SESSION_TTL_MS);
  const isHttps =
    req.headers.get("x-forwarded-proto")?.includes("https") ||
    req.headers.get("cf-visitor")?.includes("https");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
    secure: Boolean(isHttps),
  });
  return res;
}
