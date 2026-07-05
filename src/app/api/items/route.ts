import { NextRequest, NextResponse } from "next/server";
import { isWriteAuthorized } from "../../../lib/auth";
import { createItem, listItems } from "../../../lib/store";
import {
  ITEM_STATUSES,
  ITEM_TYPES,
  type ItemStatus,
  type ItemType,
} from "../../../lib/types";

const MAX_CONTENT_BYTES = 5 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? undefined;
  const type = sp.get("type") ?? undefined;

  if (status && !ITEM_STATUSES.includes(status as ItemStatus)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  if (type && !ITEM_TYPES.includes(type as ItemType)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }

  const items = await listItems({
    status: status as ItemStatus | undefined,
    type: type as ItemType | undefined,
    project: sp.get("project") ?? undefined,
    q: sp.get("q") ?? undefined,
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  if (!isWriteAuthorized(req)) {
    return NextResponse.json(
      { error: "unauthorized (Bearer DROPBOARD_TOKEN required)" },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content : "";
  const type = (body.type ?? "info") as ItemType;
  const contentType = (body.content_type ?? "html") as "html" | "markdown";

  if (!title || title.length > 200) {
    return NextResponse.json(
      { error: "title is required (max 200 chars)" },
      { status: 400 },
    );
  }
  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (Buffer.byteLength(content, "utf8") > MAX_CONTENT_BYTES) {
    return NextResponse.json(
      { error: "content exceeds 5MB limit" },
      { status: 413 },
    );
  }
  if (!ITEM_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${ITEM_TYPES.join(", ")}` },
      { status: 400 },
    );
  }
  if (contentType !== "html" && contentType !== "markdown") {
    return NextResponse.json(
      { error: "content_type must be html or markdown" },
      { status: 400 },
    );
  }
  const ttl = body.ttl_minutes;
  if (
    ttl !== undefined &&
    (typeof ttl !== "number" || !Number.isFinite(ttl) || ttl < 1 || ttl > 10080)
  ) {
    return NextResponse.json(
      { error: "ttl_minutes must be a number between 1 and 10080 (7 days)" },
      { status: 400 },
    );
  }

  const item = await createItem({
    title,
    type,
    content,
    content_type: contentType,
    project:
      typeof body.project === "string" && body.project.trim()
        ? body.project.trim()
        : undefined,
    tags: Array.isArray(body.tags)
      ? body.tags.filter((t): t is string => typeof t === "string").slice(0, 20)
      : undefined,
    summary:
      typeof body.summary === "string" ? body.summary.slice(0, 500) : undefined,
    source: typeof body.source === "string" ? body.source : undefined,
    ttl_minutes: ttl as number | undefined,
  });

  return NextResponse.json({ item, url: `/i/${item.id}` }, { status: 201 });
}
