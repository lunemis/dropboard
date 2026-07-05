#!/usr/bin/env node
/**
 * Permanently delete trashed items older than DOCKET_TRASH_TTL_DAYS (default 30).
 * Usage: node scripts/cleanup.mjs [--dry]
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR =
  process.env.DOCKET_DATA_DIR ?? path.join(process.cwd(), "data", "items");
const TTL_DAYS = Number(process.env.DOCKET_TRASH_TTL_DAYS ?? 30);
const dry = process.argv.includes("--dry");
const cutoff = Date.now() - TTL_DAYS * 86400_000;

let entries = [];
try {
  entries = await fs.readdir(DATA_DIR);
} catch {
  console.log("no data dir yet, nothing to do");
  process.exit(0);
}

let removed = 0;
let kept = 0;
for (const id of entries) {
  let meta;
  try {
    meta = JSON.parse(
      await fs.readFile(path.join(DATA_DIR, id, "meta.json"), "utf8"),
    );
  } catch {
    continue;
  }
  const expiredTemp =
    meta.expires_at && new Date(meta.expires_at).getTime() <= Date.now();
  const staleTrash =
    meta.status === "trash" &&
    meta.trashed_at &&
    new Date(meta.trashed_at).getTime() <= cutoff;
  if (!expiredTemp && !staleTrash) {
    if (meta.status === "trash" || meta.expires_at) kept++;
    continue;
  }
  if (!dry) {
    await fs.rm(path.join(DATA_DIR, id), { recursive: true, force: true });
  }
  removed++;
  console.log(`${dry ? "[dry] would delete" : "deleted"}: ${id}  ${meta.title}`);
}
console.log(
  `trash cleanup: ${removed} deleted, ${kept} kept (ttl ${TTL_DAYS}d)`,
);
