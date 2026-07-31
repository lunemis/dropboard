import assert from "node:assert/strict";
import test from "node:test";
import { artifactCardState } from "../src/lib/artifactCard";
import type { ItemMeta, ItemStatus } from "../src/lib/types";

function item(overrides: Partial<ItemMeta> = {}): ItemMeta {
  return {
    id: "item-1",
    title: "Document",
    summary: "Summary",
    type: "info",
    status: "inbox",
    pinned: false,
    read_at: null,
    expires_at: null,
    created_at: "2026-07-21T00:00:00.000Z",
    updated_at: "2026-07-21T00:00:00.000Z",
    content_type: "markdown",
    content_file: "item-1.md",
    view_mode: "document",
    project: null,
    folder: null,
    tags: [],
    document_key: null,
    revision: 1,
    trashed_at: null,
    source: "test",
    ...overrides,
  };
}

test("card action mode follows the board status", () => {
  for (const status of ["inbox", "archived", "trash"] as ItemStatus[]) {
    assert.equal(artifactCardState(item(), status).actionMode, status);
  }
});

test("temporary actions take priority over board status", () => {
  const temporary = item({ expires_at: "2026-07-22T00:00:00.000Z" });
  assert.equal(artifactCardState(temporary, "inbox").actionMode, "temporary");
});

test("only unread inbox cards receive unread emphasis", () => {
  assert.equal(artifactCardState(item(), "inbox").unread, true);
  assert.equal(artifactCardState(item(), "archived").unread, false);
  assert.equal(
    artifactCardState(item({ read_at: "2026-07-21T01:00:00.000Z" }), "inbox")
      .unread,
    false,
  );
});
