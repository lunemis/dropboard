import { NextRequest, NextResponse } from "next/server";
import { isWriteAuthorized } from "../../../lib/auth";
import { normalizeDocumentKey } from "../../../lib/document-key";
import { readJsonObject } from "../../../lib/request";
import {
  createOrUpdateItem,
  listItems,
  RevisionConflictError,
  TrashedDocumentError,
} from "../../../lib/store";
import {
  ITEM_DESTINATIONS,
  ITEM_STATUSES,
  ITEM_TYPES,
  ITEM_VIEW_MODES,
  type ItemDestination,
  type ItemStatus,
  type ItemType,
  type ItemViewMode,
} from "../../../lib/types";

const MAX_CONTENT_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const MAX_PROJECT_LENGTH = 100;
const MAX_FOLDER_LENGTH = 240;
const MAX_FOLDER_SEGMENT_LENGTH = 80;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;
const MAX_SOURCE_LENGTH = 100;
const MAX_SUMMARY_LENGTH = 500;
const MAX_REVISION_NOTE_LENGTH = 300;
const MAX_QUERY_LENGTH = 200;
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

function parseInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number | null {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= min && parsed <= max ? parsed : null;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? undefined;
  const type = sp.get("type") ?? undefined;
  const project = sp.get("project") ?? undefined;
  const q = sp.get("q") ?? undefined;
  const limit = parseInteger(sp.get("limit"), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const offset = parseInteger(sp.get("offset"), 0, 0, 1_000_000);

  if (status && !ITEM_STATUSES.includes(status as ItemStatus)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  if (type && !ITEM_TYPES.includes(type as ItemType)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }
  if (project && project.length > MAX_PROJECT_LENGTH) {
    return NextResponse.json({ error: "project is too long" }, { status: 400 });
  }
  if (q && q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "query is too long" }, { status: 400 });
  }
  if (limit === null || offset === null) {
    return NextResponse.json(
      { error: `limit must be 1-${MAX_PAGE_SIZE}; offset must be non-negative` },
      { status: 400 },
    );
  }

  const allItems = await listItems({
    status: status as ItemStatus | undefined,
    type: type as ItemType | undefined,
    project,
    q,
  });
  const items = allItems.slice(offset, offset + limit);
  return NextResponse.json({
    items,
    total: allItems.length,
    limit,
    offset,
    has_more: offset + items.length < allItems.length,
  });
}

export async function POST(req: NextRequest) {
  if (!isWriteAuthorized(req)) {
    return NextResponse.json(
      { error: "unauthorized (Bearer DROPBOARD_TOKEN required)" },
      { status: 401 },
    );
  }

  const parsedBody = await readJsonObject(req, MAX_REQUEST_BYTES);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.error },
      { status: parsedBody.status },
    );
  }
  const body = parsedBody.value;

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content : "";
  const type = (body.type ?? "info") as ItemType;
  const contentType = (body.content_type ?? "html") as "html" | "markdown";
  const viewMode = (body.view_mode ?? "document") as ItemViewMode;
  const destination = body.destination as ItemDestination | undefined;

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
  if (!ITEM_VIEW_MODES.includes(viewMode)) {
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
  if (destination === "library" && ttl !== undefined) {
    return NextResponse.json(
      { error: "destination library cannot be combined with ttl_minutes" },
      { status: 400 },
    );
  }
  if (
    body.document_key !== undefined &&
    typeof body.document_key !== "string"
  ) {
    return NextResponse.json(
      { error: "document_key must be a string" },
      { status: 400 },
    );
  }
  const documentKey =
    typeof body.document_key === "string"
      ? normalizeDocumentKey(body.document_key)
      : undefined;
  if (body.document_key !== undefined && !documentKey) {
    return NextResponse.json(
      { error: "document_key must be a stable slug (max 120 chars)" },
      { status: 400 },
    );
  }
  if (documentKey && ttl !== undefined) {
    return NextResponse.json(
      { error: "document_key cannot be combined with ttl_minutes" },
      { status: 400 },
    );
  }
  if (
    body.revision_note !== undefined &&
    (typeof body.revision_note !== "string" ||
      body.revision_note.length > MAX_REVISION_NOTE_LENGTH)
  ) {
    return NextResponse.json(
      { error: `revision_note must be at most ${MAX_REVISION_NOTE_LENGTH} chars` },
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

  if (body.project !== undefined && typeof body.project !== "string") {
    return NextResponse.json(
      { error: "project must be a string" },
      { status: 400 },
    );
  }
  if (body.folder !== undefined && typeof body.folder !== "string") {
    return NextResponse.json(
      { error: "folder must be a string" },
      { status: 400 },
    );
  }
  const project = typeof body.project === "string" ? body.project.trim() : "";
  if (project.length > MAX_PROJECT_LENGTH) {
    return NextResponse.json(
      { error: `project must be at most ${MAX_PROJECT_LENGTH} chars` },
      { status: 400 },
    );
  }
  const folderParts =
    typeof body.folder === "string"
      ? body.folder.split("/").map((part) => part.trim()).filter(Boolean)
      : [];
  const folder = folderParts.join("/");
  if (
    folder.length > MAX_FOLDER_LENGTH ||
    folderParts.some(
      (part) =>
        part === "." ||
        part === ".." ||
        part.length > MAX_FOLDER_SEGMENT_LENGTH,
    )
  ) {
    return NextResponse.json(
      { error: "folder contains an invalid path" },
      { status: 400 },
    );
  }
  if (body.tags !== undefined && !Array.isArray(body.tags)) {
    return NextResponse.json({ error: "tags must be an array" }, { status: 400 });
  }
  const tags = (body.tags ?? []) as unknown[];
  if (
    tags.length > MAX_TAGS ||
    tags.some(
      (tag) => typeof tag !== "string" || tag.length > MAX_TAG_LENGTH,
    )
  ) {
    return NextResponse.json(
      { error: `tags must contain at most ${MAX_TAGS} strings of ${MAX_TAG_LENGTH} chars` },
      { status: 400 },
    );
  }
  if (
    body.summary !== undefined &&
    (typeof body.summary !== "string" || body.summary.length > MAX_SUMMARY_LENGTH)
  ) {
    return NextResponse.json(
      { error: `summary must be at most ${MAX_SUMMARY_LENGTH} chars` },
      { status: 400 },
    );
  }
  if (
    body.source !== undefined &&
    (typeof body.source !== "string" || body.source.length > MAX_SOURCE_LENGTH)
  ) {
    return NextResponse.json(
      { error: `source must be at most ${MAX_SOURCE_LENGTH} chars` },
      { status: 400 },
    );
  }

  try {
    const result = await createOrUpdateItem({
      title,
      type,
      update_type: body.type !== undefined ? type : undefined,
      content,
      content_type: contentType,
      view_mode: body.view_mode !== undefined ? viewMode : undefined,
      destination,
      project: project || undefined,
      folder: folder || undefined,
      tags:
        body.tags !== undefined
          ? tags
              .map((tag) => (tag as string).trim())
              .filter((tag, index, all) => tag && all.indexOf(tag) === index)
          : undefined,
      summary: typeof body.summary === "string" ? body.summary : undefined,
      source: typeof body.source === "string" ? body.source : undefined,
      ttl_minutes: ttl as number | undefined,
      document_key: documentKey ?? undefined,
      revision_note:
        typeof body.revision_note === "string" ? body.revision_note : undefined,
      expected_revision:
        typeof body.expected_revision === "number"
          ? body.expected_revision
          : undefined,
    });
    return NextResponse.json(
      { item: result.item, url: `/i/${result.item.id}`, updated: result.updated },
      { status: result.updated ? 200 : 201 },
    );
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
