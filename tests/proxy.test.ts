import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import proxy from "../src/proxy";
import { createSessionToken, SESSION_COOKIE } from "../src/lib/session";

const originalEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

test("returns 503 instead of opening APIs when auth is unconfigured", async () => {
  process.env.NODE_ENV = "test";
  delete process.env.DROPBOARD_SESSION_SECRET;
  delete process.env.DROPBOARD_UNSAFE_NO_AUTH;
  const response = await proxy(new NextRequest("http://localhost/api/items"));
  assert.equal(response.status, 503);
});

test("keeps the health endpoint public", async () => {
  delete process.env.DROPBOARD_SESSION_SECRET;
  const response = await proxy(
    new NextRequest("http://localhost/api/health"),
  );
  assert.equal(response.status, 200);
});

test("explicit development no-auth mode bypasses the proxy", async () => {
  process.env.NODE_ENV = "development";
  process.env.DROPBOARD_UNSAFE_NO_AUTH = "true";
  delete process.env.DROPBOARD_SESSION_SECRET;
  const response = await proxy(new NextRequest("http://localhost/api/items"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-middleware-next"), "1");
});

test("accepts a valid session and rejects a missing session", async () => {
  const secret = "proxy-test-secret-that-is-long-enough";
  process.env.DROPBOARD_SESSION_SECRET = secret;

  const denied = await proxy(new NextRequest("http://localhost/api/items"));
  assert.equal(denied.status, 401);

  const token = await createSessionToken(secret, 60_000);
  const allowed = await proxy(
    new NextRequest("http://localhost/api/items", {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    }),
  );
  assert.equal(allowed.status, 200);
});
