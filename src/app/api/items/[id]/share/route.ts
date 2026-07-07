import { NextRequest, NextResponse } from "next/server";
import { signShareUrl } from "../../../../../lib/session";
import { getItem, revokeShares } from "../../../../../lib/store";

type Ctx = { params: Promise<{ id: string }> };

const SHARE_TTL_MS = 24 * 60 * 60 * 1000; // fixed 1-day expiry

/* Reached only with a valid session cookie or bearer token — see proxy.ts. */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const item = await getItem(id);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

  const secret = process.env.DROPBOARD_SESSION_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "sharing requires DROPBOARD_SESSION_SECRET to be configured" },
      { status: 400 },
    );
  }

  const epoch = item.share_epoch ?? 0;
  const exp = Date.now() + SHARE_TTL_MS;
  const sig = await signShareUrl(secret, id, epoch, exp);
  const path = `/s/${id}?e=${exp}&ep=${epoch}&st=${sig}`;
  const publicUrl = process.env.DROPBOARD_PUBLIC_URL?.replace(/\/$/, "");
  const url = publicUrl ? `${publicUrl}${path}` : path;
  return NextResponse.json({ url, expires_at: new Date(exp).toISOString() });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const item = await revokeShares(id);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
