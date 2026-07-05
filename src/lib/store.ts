import { promises as fs } from "node:fs";
import path from "node:path";
import type { CreateItemInput, ItemMeta, ItemStatus, ItemType } from "./types";

const DATA_DIR =
  process.env.DROPBOARD_DATA_DIR ?? path.join(process.cwd(), "data", "items");

const ID_RE = /^\d{8}-\d{6}-[a-z0-9]{4}$/;

export function isValidId(id: string): boolean {
  return ID_RE.test(id);
}

function itemDir(id: string): string {
  return path.join(DATA_DIR, id);
}

function now(): string {
  return new Date().toISOString();
}

async function readMeta(id: string): Promise<ItemMeta | null> {
  try {
    const raw = await fs.readFile(path.join(itemDir(id), "meta.json"), "utf8");
    return JSON.parse(raw) as ItemMeta;
  } catch {
    return null;
  }
}

async function writeMeta(meta: ItemMeta): Promise<void> {
  await fs.writeFile(
    path.join(itemDir(meta.id), "meta.json"),
    JSON.stringify(meta, null, 2) + "\n",
    "utf8",
  );
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
    entries = await fs.readdir(DATA_DIR);
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
      b.created_at.localeCompare(a.created_at),
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
    tags: input.tags ?? [],
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

  await fs.writeFile(path.join(itemDir(id), contentFile), input.content, "utf8");
  await writeMeta(meta);
  return meta;
}

export interface UpdatePatch {
  status?: ItemStatus;
  pinned?: boolean;
  read?: boolean;
  /** true → promote a temp item to keep (clears expires_at) */
  keep?: boolean;
  /** set → (re)mark as temp, expiring this many minutes from now */
  ttl_minutes?: number;
}

export async function updateItem(
  id: string,
  patch: UpdatePatch,
): Promise<ItemMeta | null> {
  const meta = await getItem(id);
  if (!meta) return null;

  if (patch.status && patch.status !== meta.status) {
    meta.status = patch.status;
    meta.trashed_at = patch.status === "trash" ? now() : null;
  }
  if (typeof patch.pinned === "boolean") meta.pinned = patch.pinned;
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
}

export async function deleteItem(id: string): Promise<boolean> {
  if (!isValidId(id)) return false;
  const meta = await readMeta(id);
  if (!meta) return false;
  await fs.rm(itemDir(id), { recursive: true, force: true });
  return true;
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
    entries = await fs.readdir(DATA_DIR);
  } catch {
    return { removed: 0 };
  }
  let removed = 0;
  for (const id of entries.filter(isValidId)) {
    const meta = await readMeta(id);
    if (!meta) continue;
    const expiredTemp = isExpired(meta);
    const staleTrash =
      trashTtlDays > 0 &&
      meta.status === "trash" &&
      Boolean(meta.trashed_at) &&
      new Date(meta.trashed_at!).getTime() <= trashCutoff;
    if (!expiredTemp && !staleTrash) continue;
    await fs.rm(itemDir(id), { recursive: true, force: true });
    removed++;
  }
  return { removed };
}

export async function readContent(
  id: string,
): Promise<{ meta: ItemMeta; content: string } | null> {
  const meta = await getItem(id);
  if (!meta) return null;
  try {
    const content = await fs.readFile(
      path.join(itemDir(id), meta.content_file),
      "utf8",
    );
    return { meta, content };
  } catch {
    return null;
  }
}
