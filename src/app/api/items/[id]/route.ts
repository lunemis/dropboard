import { NextRequest, NextResponse } from "next/server";
import { signRawUrl } from "../../../../lib/session";
import { deleteItem, getItem, updateItem } from "../../../../lib/store";
import { ITEM_STATUSES, type ItemStatus } from "../../../../lib/types";

type Ctx = { params: Promise<{ id: string }> };

const RAW_URL_TTL_MS = 60 * 60 * 1000;

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const item = await getItem(id);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

  // signed raw URL for the sandboxed viewer iframe (sends no cookies)
  let raw_url = `/api/items/${id}/raw`;
  const secret = process.env.DOCKET_SESSION_SECRET;
  if (secret) {
    const exp = Date.now() + RAW_URL_TTL_MS;
    raw_url += `?e=${exp}&st=${await signRawUrl(secret, id, exp)}`;
  }
  return NextResponse.json({ item, raw_url });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (
    body.status !== undefined &&
    !ITEM_STATUSES.includes(body.status as ItemStatus)
  ) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const item = await updateItem(id, {
    status: body.status as ItemStatus | undefined,
    pinned: typeof body.pinned === "boolean" ? body.pinned : undefined,
    read: typeof body.read === "boolean" ? body.read : undefined,
    keep: body.keep === true ? true : undefined,
  });
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const ok = await deleteItem(id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
