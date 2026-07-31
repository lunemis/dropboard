import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  ITEM_STATUSES,
  ITEM_TYPES,
  type CreateItemInput,
  type CreateRevisionInput,
  type ItemMeta,
  type ItemStatus,
  type ItemType,
  type RevisionMeta,
} from "./types";

const DATA_DIR = process.env.DROPBOARD_DATA_DIR || "./data/items";

const ID_RE = /^\d{8}-\d{6}-[a-z0-9]{4}$/;
const itemLocks = new Map<string, Promise<void>>();
const documentKeyLocks = new Map<string, Promise<void>>();

function storePath(...segments: string[]): string {
  // Store contents are runtime data, not deployment inputs. Without this hint,
  // Turbopack expands dynamic item paths into a trace of the whole project.
  return path.join(/* turbopackIgnore: true */ ...segments);
}

export function isValidId(id: string): boolean {
  return ID_RE.test(id);
}

function itemDir(id: string): string {
  return storePath(DATA_DIR, id);
}

function revisionDir(id: string, revision: number): string {
  return storePath(itemDir(id), "revisions", String(revision).padStart(6, "0"));
}

function now(): string {
  return new Date().toISOString();
}

function revisionMetaFromItem(
  item: ItemMeta,
  revision: number,
  note: string | null = null,
): RevisionMeta {
  return {
    revision,
    title: item.title,
    type: item.type,
    summary: item.summary,
    content_file: item.content_file,
    content_type: item.content_type,
    created_at: revision === 1 ? item.created_at : item.updated_at,
    source: item.source,
    note,
  };
}

function isRevisionMeta(
  value: unknown,
  revision: number,
): value is RevisionMeta {
  if (!value || typeof value !== "object") return false;
  const meta = value as Record<string, unknown>;
  const contentType = meta.content_type;
  return (
    meta.revision === revision &&
    typeof meta.title === "string" &&
    ITEM_TYPES.includes(meta.type as ItemType) &&
    typeof meta.summary === "string" &&
    (contentType === "html" || contentType === "markdown") &&
    meta.content_file ===
      (contentType === "markdown" ? "index.md" : "index.html") &&
    typeof meta.created_at === "string" &&
    typeof meta.source === "string" &&
    (meta.note === null || typeof meta.note === "string")
  );
}

function isItemMeta(value: unknown, expectedId: string): boolean {
  if (!value || typeof value !== "object") return false;
  const meta = value as Record<string, unknown>;
  const contentType = meta.content_type;
  const expectedContentFile =
    contentType === "markdown"
      ? "index.md"
      : contentType === "html"
        ? "index.html"
        : null;
  return (
    meta.id === expectedId &&
    typeof meta.title === "string" &&
    ITEM_TYPES.includes(meta.type as ItemType) &&
    (meta.project === null || typeof meta.project === "string") &&
    (meta.folder === undefined ||
      meta.folder === null ||
      typeof meta.folder === "string") &&
    (meta.document_key === undefined ||
      meta.document_key === null ||
      typeof meta.document_key === "string") &&
    (meta.revision === undefined ||
      (typeof meta.revision === "number" &&
        Number.isInteger(meta.revision) &&
        meta.revision >= 1)) &&
    Array.isArray(meta.tags) &&
    meta.tags.every((tag) => typeof tag === "string") &&
    typeof meta.summary === "string" &&
    meta.content_file === expectedContentFile &&
    ITEM_STATUSES.includes(meta.status as ItemStatus) &&
    typeof meta.pinned === "boolean" &&
    (meta.read_at === null || typeof meta.read_at === "string") &&
    (meta.trashed_at === null || typeof meta.trashed_at === "string") &&
    typeof meta.created_at === "string" &&
    typeof meta.updated_at === "string" &&
    typeof meta.source === "string"
  );
}

async function withItemLock<T>(id: string, task: () => Promise<T>): Promise<T> {
  const previous = itemLocks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  itemLocks.set(id, tail);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (itemLocks.get(id) === tail) itemLocks.delete(id);
  }
}

async function withItemLocks<T>(
  ids: string[],
  task: () => Promise<T>,
  index = 0,
): Promise<T> {
  if (index >= ids.length) return task();
  return withItemLock(ids[index], () => withItemLocks(ids, task, index + 1));
}

async function withDocumentKeyLock<T>(
  key: string,
  task: () => Promise<T>,
): Promise<T> {
  const previous = documentKeyLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  documentKeyLocks.set(key, tail);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (documentKeyLocks.get(key) === tail) documentKeyLocks.delete(key);
  }
}

async function readMeta(id: string): Promise<ItemMeta | null> {
  try {
    const raw = await fs.readFile(storePath(itemDir(id), "meta.json"), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isItemMeta(parsed, id)) {
      console.warn(`[dropboard] ignoring invalid metadata for item ${id}`);
      return null;
    }
    const legacyMeta = parsed as Omit<
      ItemMeta,
      "folder" | "document_key" | "revision"
    > & {
      folder?: string | null;
      document_key?: string | null;
      revision?: number;
    };
    return {
      ...legacyMeta,
      folder: legacyMeta.folder ?? null,
      document_key: legacyMeta.document_key ?? null,
      revision: legacyMeta.revision ?? 1,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(
        `[dropboard] cannot read metadata for item ${id}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
    return null;
  }
}

async function writeMeta(meta: ItemMeta): Promise<void> {
  const destination = storePath(itemDir(meta.id), "meta.json");
  const temporary = storePath(itemDir(meta.id), `.meta-${randomUUID()}.tmp`);
  const handle = await fs.open(temporary, "wx");
  try {
    try {
      await handle.writeFile(JSON.stringify(meta, null, 2) + "\n", "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temporary, destination);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}

export interface ListFilter {
  status?: ItemStatus;
  type?: ItemType;
  project?: string;
  q?: string;
}

export function isExpired(meta: ItemMeta): boolean {
  return (
    Boolean(meta.expires_at) &&
    new Date(meta.expires_at!).getTime() <= Date.now()
  );
}

export async function listItems(filter: ListFilter): Promise<ItemMeta[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(storePath(DATA_DIR));
  } catch {
    return [];
  }
  const metas = (
    await Promise.all(entries.filter(isValidId).map(readMeta))
  ).filter((m): m is ItemMeta => m !== null && !isExpired(m));

  let out = metas;
  if (filter.status) out = out.filter((m) => m.status === filter.status);
  if (filter.type) out = out.filter((m) => m.type === filter.type);
  if (filter.project) out = out.filter((m) => m.project === filter.project);
  if (filter.q) {
    const q = filter.q.toLowerCase();
    out = out.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.summary.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }
  out.sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      b.updated_at.localeCompare(a.updated_at),
  );
  return out;
}

export async function getItem(id: string): Promise<ItemMeta | null> {
  if (!isValidId(id)) return null;
  const meta = await readMeta(id);
  return meta && !isExpired(meta) ? meta : null;
}

function makeId(date: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const stamp =
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let rand = "";
  for (let i = 0; i < 4; i++)
    rand += chars[Math.floor(Math.random() * chars.length)];
  return `${stamp}-${rand}`;
}

export async function createItem(input: CreateItemInput): Promise<ItemMeta> {
  const contentType = input.content_type ?? "html";
  const contentFile = contentType === "markdown" ? "index.md" : "index.html";

  // retry on the (unlikely) id collision within the same second
  let id = makeId(new Date());
  for (let i = 0; i < 5; i++) {
    try {
      await fs.mkdir(itemDir(id), { recursive: false });
      break;
    } catch {
      await fs.mkdir(DATA_DIR, { recursive: true });
      if (i === 4) throw new Error("failed to allocate item id");
      id = makeId(new Date());
    }
  }

  const ts = now();
  const meta: ItemMeta = {
    id,
    title: input.title,
    type: input.type,
    project: input.project ?? null,
    folder: input.folder ?? null,
    tags: input.tags ?? [],
    document_key: input.document_key ?? null,
    revision: 1,
    summary: input.summary ?? "",
    content_file: contentFile,
    content_type: contentType,
    status: "inbox",
    pinned: false,
    read_at: null,
    trashed_at: null,
    expires_at: input.ttl_minutes
      ? new Date(Date.now() + input.ttl_minutes * 60000).toISOString()
      : null,
    created_at: ts,
    updated_at: ts,
    source: input.source ?? "unknown",
  };

  try {
    await fs.writeFile(
      storePath(itemDir(id), contentFile),
      input.content,
      "utf8",
    );
    await writeMeta(meta);
    return meta;
  } catch (error) {
    await fs.rm(itemDir(id), {
      recursive: true,
      force: true,
    });
    throw error;
  }
}

export interface UpdatePatch {
  status?: ItemStatus;
  pinned?: boolean;
  read?: boolean;
  project?: string | null;
  folder?: string | null;
  tags?: string[];
  /** true → promote a temp item to keep (clears expires_at) */
  keep?: boolean;
  /** set → (re)mark as temp, expiring this many minutes from now */
  ttl_minutes?: number;
}

export async function updateItem(
  id: string,
  patch: UpdatePatch,
): Promise<ItemMeta | null> {
  if (!isValidId(id)) return null;
  return withItemLock(id, async () => {
    const meta = await getItem(id);
    if (!meta) return null;

    if (patch.status && patch.status !== meta.status) {
      meta.status = patch.status;
      meta.trashed_at = patch.status === "trash" ? now() : null;
    }
    if (typeof patch.pinned === "boolean") meta.pinned = patch.pinned;
    if (patch.project !== undefined) meta.project = patch.project;
    if (patch.folder !== undefined) meta.folder = patch.folder;
    if (patch.tags !== undefined) meta.tags = [...patch.tags];
    if (patch.read === true && !meta.read_at) meta.read_at = now();
    if (patch.read === false) meta.read_at = null;
    if (patch.keep === true) meta.expires_at = null;
    if (patch.ttl_minutes) {
      meta.expires_at = new Date(
        Date.now() + patch.ttl_minutes * 60000,
      ).toISOString();
    }

    meta.updated_at = now();
    await writeMeta(meta);
    return meta;
  });
}

export type BulkOrganizationResult =
  | { ok: true; items: ItemMeta[] }
  | {
      ok: false;
      reason: "not_found" | "not_archived";
      itemIds: string[];
    };

export async function organizeItems(
  itemIds: string[],
  organization: { project: string | null; folder: string | null },
): Promise<BulkOrganizationResult> {
  const ids = [...new Set(itemIds)].sort();
  if (ids.length === 0 || ids.some((id) => !isValidId(id))) {
    return { ok: false, reason: "not_found", itemIds: ids };
  }

  return withItemLocks(ids, async () => {
    const originals: ItemMeta[] = [];
    const missing: string[] = [];
    for (const id of ids) {
      const item = await readMeta(id);
      if (!item || isExpired(item)) missing.push(id);
      else originals.push(item);
    }
    if (missing.length > 0) {
      return { ok: false, reason: "not_found", itemIds: missing };
    }

    const notArchived = originals
      .filter((item) => item.status !== "archived")
      .map((item) => item.id);
    if (notArchived.length > 0) {
      return {
        ok: false,
        reason: "not_archived",
        itemIds: notArchived,
      };
    }

    const timestamp = now();
    const updated = originals.map((item) => ({
      ...item,
      project: organization.project,
      folder: organization.folder,
      updated_at: timestamp,
    }));
    const written: ItemMeta[] = [];
    try {
      for (let index = 0; index < updated.length; index++) {
        await writeMeta(updated[index]);
        written.push(originals[index]);
      }
      return { ok: true, items: updated };
    } catch (error) {
      for (const original of written.reverse()) {
        try {
          await writeMeta(original);
        } catch (rollbackError) {
          console.error(
            `[dropboard] failed to roll back bulk organization for ${original.id}:`,
            rollbackError,
          );
        }
      }
      throw error;
    }
  });
}

export class RevisionConflictError extends Error {
  constructor(public readonly currentRevision: number) {
    super(`revision conflict; current revision is ${currentRevision}`);
  }
}

export class TrashedDocumentError extends Error {
  constructor(public readonly itemId: string) {
    super("document is in trash; restore it before updating");
  }
}

async function writeRevisionDirectory(
  id: string,
  meta: RevisionMeta,
  content?: string,
): Promise<void> {
  const revisionsDir = storePath(itemDir(id), "revisions");
  await fs.mkdir(revisionsDir, { recursive: true });
  const destination = revisionDir(id, meta.revision);
  const temporary = storePath(
    revisionsDir,
    `.${String(meta.revision).padStart(6, "0")}-${randomUUID()}.tmp`,
  );
  await fs.mkdir(temporary);
  try {
    await fs.writeFile(
      storePath(temporary, "meta.json"),
      JSON.stringify(meta, null, 2) + "\n",
      "utf8",
    );
    if (content !== undefined) {
      await fs.writeFile(
        storePath(temporary, meta.content_file),
        content,
        "utf8",
      );
    }
    await fs.rename(temporary, destination);
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

async function ensureInitialRevision(item: ItemMeta): Promise<void> {
  try {
    await fs.access(storePath(revisionDir(item.id, 1), "meta.json"));
    return;
  } catch {
    // Legacy and newly created items keep v1 content at the item root. Snapshot
    // only its metadata before the mutable item record advances to v2.
  }
  try {
    await writeRevisionDirectory(item.id, revisionMetaFromItem(item, 1));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}

async function readStoredRevisionMeta(
  id: string,
  revision: number,
): Promise<RevisionMeta | null> {
  try {
    const parsed: unknown = JSON.parse(
      await fs.readFile(
        storePath(revisionDir(id, revision), "meta.json"),
        "utf8",
      ),
    );
    return isRevisionMeta(parsed, revision) ? parsed : null;
  } catch {
    return null;
  }
}

export async function addRevision(
  id: string,
  input: CreateRevisionInput,
): Promise<ItemMeta | null> {
  if (!isValidId(id)) return null;
  return withItemLock(id, async () => {
    const item = await getItem(id);
    if (!item) return null;
    if (item.status === "trash" && input.allow_trashed !== true) {
      throw new TrashedDocumentError(item.id);
    }
    if (
      input.expected_revision !== undefined &&
      input.expected_revision !== item.revision
    ) {
      throw new RevisionConflictError(item.revision);
    }

    await ensureInitialRevision(item);
    const nextRevision = item.revision + 1;
    const contentType = input.content_type;
    const contentFile = contentType === "markdown" ? "index.md" : "index.html";
    const timestamp = now();
    const revisionMeta: RevisionMeta = {
      revision: nextRevision,
      title: input.title ?? item.title,
      type: input.type ?? item.type,
      summary: input.summary ?? item.summary,
      content_file: contentFile,
      content_type: contentType,
      created_at: timestamp,
      source: input.source ?? "unknown",
      note: input.note?.trim() || null,
    };

    await writeRevisionDirectory(id, revisionMeta, input.content);
    const previous = { ...item };
    item.revision = nextRevision;
    item.title = revisionMeta.title;
    item.type = revisionMeta.type;
    item.summary = revisionMeta.summary;
    item.content_file = revisionMeta.content_file;
    item.content_type = revisionMeta.content_type;
    item.source = revisionMeta.source;
    item.status = "inbox";
    item.read_at = null;
    item.trashed_at = null;
    item.expires_at = null;
    item.share_epoch = (item.share_epoch ?? 0) + 1;
    item.updated_at = timestamp;
    if (input.project !== undefined) item.project = input.project;
    if (input.folder !== undefined) item.folder = input.folder;
    if (input.tags !== undefined) item.tags = [...input.tags];

    try {
      await writeMeta(item);
      return item;
    } catch (error) {
      Object.assign(item, previous);
      await fs.rm(revisionDir(id, nextRevision), {
        recursive: true,
        force: true,
      });
      throw error;
    }
  });
}

export async function listRevisions(
  id: string,
): Promise<RevisionMeta[] | null> {
  const item = await getItem(id);
  if (!item) return null;
  const revisions: RevisionMeta[] = [];
  for (let revision = item.revision; revision >= 1; revision--) {
    const stored = await readStoredRevisionMeta(id, revision);
    if (stored) {
      revisions.push(stored);
    } else if (revision === 1) {
      revisions.push(revisionMetaFromItem(item, 1));
    }
  }
  return revisions;
}

export async function readRevisionContent(
  id: string,
  revision: number,
): Promise<{ meta: RevisionMeta; item: ItemMeta; content: string } | null> {
  const item = await getItem(id);
  if (!item || revision < 1 || revision > item.revision) return null;
  const meta =
    (await readStoredRevisionMeta(id, revision)) ??
    (revision === 1 ? revisionMetaFromItem(item, 1) : null);
  if (!meta) return null;
  const contentPath =
    revision === 1
      ? storePath(itemDir(id), meta.content_file)
      : storePath(revisionDir(id, revision), meta.content_file);
  try {
    return {
      meta,
      item,
      content: await fs.readFile(storePath(contentPath), "utf8"),
    };
  } catch {
    return null;
  }
}

export async function restoreRevision(
  id: string,
  revision: number,
  source = "dropboard-ui",
): Promise<ItemMeta | null> {
  const target = await readRevisionContent(id, revision);
  if (!target) return null;
  return addRevision(id, {
    content: target.content,
    content_type: target.meta.content_type,
    title: target.meta.title,
    type: target.meta.type,
    summary: target.meta.summary,
    source,
    note: `Restored from v${revision}`,
    allow_trashed: true,
  });
}

export async function findItemByDocumentKey(
  documentKey: string,
): Promise<ItemMeta | null> {
  const items = await listItems({});
  return items.find((item) => item.document_key === documentKey) ?? null;
}

export async function createOrUpdateItem(
  input: CreateItemInput & { update_type?: ItemType },
): Promise<{ item: ItemMeta; updated: boolean }> {
  if (!input.document_key) {
    return { item: await createItem(input), updated: false };
  }
  return withDocumentKeyLock(input.document_key, async () => {
    const existing = await findItemByDocumentKey(input.document_key!);
    if (!existing) return { item: await createItem(input), updated: false };
    const item = await addRevision(existing.id, {
      title: input.title,
      type: input.update_type,
      content: input.content,
      content_type: input.content_type ?? "html",
      summary: input.summary,
      source: input.source,
      note: input.revision_note,
      expected_revision: input.expected_revision,
      project: input.project,
      folder: input.folder,
      tags: input.tags,
    });
    if (!item) throw new Error("document key target disappeared during update");
    return { item, updated: true };
  });
}

/** Invalidate all previously issued public share links for this item. */
export async function revokeShares(id: string): Promise<ItemMeta | null> {
  if (!isValidId(id)) return null;
  return withItemLock(id, async () => {
    const meta = await getItem(id);
    if (!meta) return null;
    meta.share_epoch = (meta.share_epoch ?? 0) + 1;
    meta.updated_at = now();
    await writeMeta(meta);
    return meta;
  });
}

export async function deleteItem(id: string): Promise<boolean> {
  if (!isValidId(id)) return false;
  return withItemLock(id, async () => {
    const meta = await readMeta(id);
    if (!meta) return false;
    await fs.rm(itemDir(id), {
      recursive: true,
      force: true,
    });
    return true;
  });
}

/**
 * Physically remove expired temp items, plus trashed items older than
 * trashTtlDays (0 skips the trash purge). Used by the built-in sweeper.
 */
export async function sweepStorage(
  trashTtlDays: number,
): Promise<{ removed: number }> {
  const trashCutoff = Date.now() - trashTtlDays * 86400_000;
  let entries: string[] = [];
  try {
    entries = await fs.readdir(storePath(DATA_DIR));
  } catch {
    return { removed: 0 };
  }
  let removed = 0;
  for (const id of entries.filter(isValidId)) {
    const didRemove = await withItemLock(id, async () => {
      const meta = await readMeta(id);
      if (!meta) return false;
      const expiredTemp = isExpired(meta);
      const staleTrash =
        trashTtlDays > 0 &&
        meta.status === "trash" &&
        Boolean(meta.trashed_at) &&
        new Date(meta.trashed_at!).getTime() <= trashCutoff;
      if (!expiredTemp && !staleTrash) return false;
      await fs.rm(itemDir(id), {
        recursive: true,
        force: true,
      });
      return true;
    });
    if (didRemove) removed++;
  }
  return { removed };
}

export async function readContent(
  id: string,
): Promise<{ meta: ItemMeta; content: string } | null> {
  const meta = await getItem(id);
  if (!meta) return null;
  const revision = await readRevisionContent(id, meta.revision);
  return revision ? { meta, content: revision.content } : null;
}
