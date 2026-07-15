import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  isUnsafeNoAuthEnabled,
  validateServerConfig,
} from "../src/lib/config";

const originalEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

test("validates a complete authentication configuration", () => {
  process.env.NODE_ENV = "production";
  process.env.DROPBOARD_TOKEN = "t".repeat(24);
  process.env.DROPBOARD_PIN = "123456";
  process.env.DROPBOARD_SESSION_SECRET = "s".repeat(32);
  assert.doesNotThrow(validateServerConfig);
});

test("fails closed when required authentication values are missing", () => {
  process.env.NODE_ENV = "production";
  delete process.env.DROPBOARD_TOKEN;
  delete process.env.DROPBOARD_PIN;
  delete process.env.DROPBOARD_SESSION_SECRET;
  assert.throws(validateServerConfig, /DROPBOARD_TOKEN/);
});

test("allows explicit no-auth mode only outside production", () => {
  delete process.env.DROPBOARD_TOKEN;
  delete process.env.DROPBOARD_PIN;
  delete process.env.DROPBOARD_SESSION_SECRET;
  process.env.NODE_ENV = "development";
  process.env.DROPBOARD_UNSAFE_NO_AUTH = "true";
  assert.equal(isUnsafeNoAuthEnabled(), true);
  assert.doesNotThrow(validateServerConfig);

  process.env.NODE_ENV = "production";
  assert.equal(isUnsafeNoAuthEnabled(), false);
  assert.throws(validateServerConfig);
});
