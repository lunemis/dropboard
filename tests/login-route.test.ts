import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { SESSION_COOKIE } from "../src/lib/session";
import { POST } from "../src/app/api/auth/login/route";

const originalEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

function loginRequest(pin: string, https = false): NextRequest {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(https ? { "x-forwarded-proto": "https" } : {}),
    },
    body: JSON.stringify({ pin }),
  });
}

test("sets a secure session cookie after a successful PIN login", async () => {
  process.env.DROPBOARD_PIN = "123456";
  process.env.DROPBOARD_SESSION_SECRET = "login-test-secret-that-is-long-enough";
  const response = await POST(loginRequest("123456", true));
  assert.equal(response.status, 200);
  const cookie = response.cookies.get(SESSION_COOKIE);
  assert.ok(cookie?.value);
  assert.match(response.headers.get("set-cookie") ?? "", /Secure/);
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
});

test("rejects an incorrect PIN", async () => {
  process.env.DROPBOARD_PIN = "123456";
  process.env.DROPBOARD_SESSION_SECRET = "login-test-secret-that-is-long-enough";
  const response = await POST(loginRequest("654321"));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).remaining, 4);
});

