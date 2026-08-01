import { NextResponse } from "next/server";
import { readJsonObject } from "../../../../../lib/request";
import { signRawUrl } from "../../../../../lib/session";
import {
  addRevision,
  listRevisions,
  RevisionConflictError,
  TrashedDocumentError,
} from "../../../../../lib/store";
import {
  ITEM_DESTINATIONS,
  ITEM_TYPES,
  ITEM_VIEW_MODES,
  type ContentType,
  type ItemDestination,
  type ItemType,
  type ItemViewMode,
} from "../../../../../lib/types";

type Ctx = { params: Promise<{ id: string }> };

const MAX_CONTENT_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const RAW_URL_TTL_MS = 60 * 60 * 1000;

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const revisions = await listRevisions(id);
  if (!revisions) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const secret = process.env.DROPBOARD_SESSION_SECRET;
  const result = await Promise.all(
    revisions.map(async (revision) => {
      let rawUrl = `/api/items/${id}/raw?v=${revision.revision}`;
      if (secret) {
        const exp = Date.now() + RAW_URL_TTL_MS;
        const signature = await signRawUrl(
          secret,
          id,
          exp,
          revision.revision,
        );
        rawUrl += `&e=${exp}&st=${signature}`;
      }
      return { ...revision, raw_url: rawUrl };
    }),
  );
  return NextResponse.json({ revisions: result });
}

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = await readJsonObject(request, MAX_REQUEST_BYTES);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status },
    );
  }
  const body = parsed.value;
  const content = typeof body.content === "string" ? body.content : "";
  const contentType = body.content_type as ContentType;
  const viewMode = body.view_mode as ItemViewMode | undefined;
  const destination = body.destination as ItemDestination | undefined;
  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (Buffer.byteLength(content, "utf8") > MAX_CONTENT_BYTES) {
    return NextResponse.json(
      { error: "content exceeds 5MB limit" },
      { status: 413 },
    );
  }
  if (contentType !== "html" && contentType !== "markdown") {
    return NextResponse.json(
      { error: "content_type must be html or markdown" },
      { status: 400 },
    );
  }
  if (viewMode !== undefined && !ITEM_VIEW_MODES.includes(viewMode)) {
    return NextResponse.json(
      { error: `view_mode must be one of: ${ITEM_VIEW_MODES.join(", ")}` },
      { status: 400 },
    );
  }
  if (
    destination !== undefined &&
    !ITEM_DESTINATIONS.includes(destination)
  ) {
    return NextResponse.json(
      { error: `destination must be one of: ${ITEM_DESTINATIONS.join(", ")}` },
      { status: 400 },
    );
  }
  if (
    body.title !== undefined &&
    (typeof body.title !== "string" ||
      !body.title.trim() ||
      body.title.length > 200)
  ) {
    return NextResponse.json(
      { error: "title must be 1-200 chars" },
      { status: 400 },
    );
  }
  if (
    body.type !== undefined &&
    !ITEM_TYPES.includes(body.type as ItemType)
  ) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }
  if (
    body.summary !== undefined &&
    (typeof body.summary !== "string" || body.summary.length > 500)
  ) {
    return NextResponse.json(
      { error: "summary must be at most 500 chars" },
      { status: 400 },
    );
  }
  if (
    body.source !== undefined &&
    (typeof body.source !== "string" || body.source.length > 100)
  ) {
    return NextResponse.json(
      { error: "source must be at most 100 chars" },
      { status: 400 },
    );
  }
  if (
    body.revision_note !== undefined &&
    (typeof body.revision_note !== "string" || body.revision_note.length > 300)
  ) {
    return NextResponse.json(
      { error: "revision_note must be at most 300 chars" },
      { status: 400 },
    );
  }
  if (
    body.expected_revision !== undefined &&
    (typeof body.expected_revision !== "number" ||
      !Number.isInteger(body.expected_revision) ||
      body.expected_revision < 1)
  ) {
    return NextResponse.json(
      { error: "expected_revision must be a positive integer" },
      { status: 400 },
    );
  }

  try {
    const item = await addRevision(id, {
      content,
      content_type: contentType,
      view_mode: viewMode,
      destination,
      title: typeof body.title === "string" ? body.title.trim() : undefined,
      type: body.type as ItemType | undefined,
      summary: typeof body.summary === "string" ? body.summary : undefined,
      source: typeof body.source === "string" ? body.source : undefined,
      note:
        typeof body.revision_note === "string"
          ? body.revision_note
          : undefined,
      expected_revision:
        typeof body.expected_revision === "number"
          ? body.expected_revision
          : undefined,
    });
    if (!item) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ item, url: `/i/${item.id}`, updated: true });
  } catch (error) {
    if (error instanceof RevisionConflictError) {
      return NextResponse.json(
        { error: error.message, current_revision: error.currentRevision },
        { status: 409 },
      );
    }
    if (error instanceof TrashedDocumentError) {
      return NextResponse.json(
        { error: error.message, item_id: error.itemId },
        { status: 409 },
      );
    }
    throw error;
  }
}
