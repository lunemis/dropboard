import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSessionToken,
  signRawUrl,
  signShareUrl,
  verifyRawSig,
  verifySessionToken,
  verifyShareSig,
} from "../src/lib/session";

const SECRET = "session-test-secret-that-is-long-enough";

test("session tokens reject tampering and expiry", async () => {
  const token = await createSessionToken(SECRET, 60_000);
  assert.equal(await verifySessionToken(token, SECRET), true);
  assert.equal(await verifySessionToken(`${token}0`, SECRET), false);

  const expired = await createSessionToken(SECRET, -1);
  assert.equal(await verifySessionToken(expired, SECRET), false);
});

test("raw signatures are bound to an item and expiry", async () => {
  const exp = Date.now() + 60_000;
  const sig = await signRawUrl(SECRET, "item-a", exp);
  assert.equal(await verifyRawSig(SECRET, "item-a", exp, sig), true);
  assert.equal(await verifyRawSig(SECRET, "item-b", exp, sig), false);
  assert.equal(await verifyRawSig(SECRET, "item-a", Date.now() - 1, sig), false);
});

test("share signatures are bound to the revocation epoch", async () => {
  const exp = Date.now() + 60_000;
  const sig = await signShareUrl(SECRET, "item-a", 2, exp);
  assert.equal(await verifyShareSig(SECRET, "item-a", 2, exp, sig), true);
  assert.equal(await verifyShareSig(SECRET, "item-a", 3, exp, sig), false);
});

