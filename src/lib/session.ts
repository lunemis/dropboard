/**
 * Session + signed-URL helpers.
 * Web Crypto only — must run in both middleware (edge) and route handlers (node).
 */
const enc = new TextEncoder();

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const SESSION_COOKIE = "dropboard_session";

export async function createSessionToken(
  secret: string,
  ttlMs: number,
): Promise<string> {
  const exp = Date.now() + ttlMs;
  return `v1.${exp}.${await hmacHex(secret, `session.${exp}`)}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<boolean> {
  const [v, expStr, sig] = token.split(".");
  if (v !== "v1" || !expStr || !sig) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return timingEq(sig, await hmacHex(secret, `session.${exp}`));
}

/* Short-lived signed URLs for /raw — the sandboxed viewer iframe has an
 * opaque origin and does not send SameSite cookies, so it can't rely on
 * the session cookie. */
export async function signRawUrl(
  secret: string,
  id: string,
  exp: number,
): Promise<string> {
  return hmacHex(secret, `raw.${id}.${exp}`);
}

export async function verifyRawSig(
  secret: string,
  id: string,
  exp: number,
  sig: string,
): Promise<boolean> {
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return timingEq(sig, await signRawUrl(secret, id, exp));
}
