import { NextRequest, NextResponse } from "next/server";
import { readJsonObject } from "../../../../lib/request";
import { isValidId, organizeItems } from "../../../../lib/store";

const MAX_REQUEST_BYTES = 32 * 1024;
const MAX_ITEMS = 500;
const MAX_PROJECT_LENGTH = 100;
const MAX_FOLDER_LENGTH = 240;
const MAX_FOLDER_SEGMENT_LENGTH = 80;
const BODY_KEYS = new Set(["item_ids", "project", "folder"]);

export async function PATCH(req: NextRequest) {
  const parsedBody = await readJsonObject(req, MAX_REQUEST_BYTES);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.error },
      { status: parsedBody.status },
    );
  }
  const body = parsedBody.value;
  const unknownKey = Object.keys(body).find((key) => !BODY_KEYS.has(key));
  if (unknownKey) {
    return NextResponse.json(
      { error: `unknown field: ${unknownKey}` },
      { status: 400 },
    );
  }

  if (
    !Array.isArray(body.item_ids) ||
    body.item_ids.length === 0 ||
    body.item_ids.length > MAX_ITEMS ||
    body.item_ids.some((id) => typeof id !== "string" || !isValidId(id))
  ) {
    return NextResponse.json(
      { error: `item_ids must contain 1-${MAX_ITEMS} valid item IDs` },
      { status: 400 },
    );
  }
  const itemIds = [...new Set(body.item_ids as string[])];

  if (typeof body.project !== "string") {
    return NextResponse.json(
      { error: "project must be a string" },
      { status: 400 },
    );
  }
  const project = body.project.trim();
  if (project.length > MAX_PROJECT_LENGTH) {
    return NextResponse.json(
      { error: `project must be at most ${MAX_PROJECT_LENGTH} chars` },
      { status: 400 },
    );
  }

  if (typeof body.folder !== "string") {
    return NextResponse.json(
      { error: "folder must be a string" },
      { status: 400 },
    );
  }
  const folderParts = body.folder
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
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

  const result = await organizeItems(itemIds, {
    project: project || null,
    folder: folder || null,
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.reason === "not_found"
            ? "one or more items were not found"
            : "all items must still be in the library",
        item_ids: result.itemIds,
      },
      { status: result.reason === "not_found" ? 404 : 409 },
    );
  }
  return NextResponse.json({ items: result.items });
}
