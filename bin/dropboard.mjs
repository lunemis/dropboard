#!/usr/bin/env node
/**
 * dropboard — publish AI deliverables to your dropboard inbox and library.
 *
 * Usage:
 *   dropboard publish <file> [--title T] [--type review|decision|report|info|fun]
 *                         [--view document|presentation|reader]
 *                         [--to inbox|library]
 *                         [--project P] [--folder A/B] [--summary S]
 *                         [--tags a,b] [--source S]
 *                         [--key stable/key] [--note change-summary]
 *                         [--server URL]
 *   dropboard update <item-id> <file> [--title T] [--type T] [--summary S]
 *                         [--view document|presentation|reader]
 *                         [--to inbox|library]
 *                         [--note change-summary] [--expected N]
 *   dropboard list [--status inbox|archived|library|trash]
 *
 * Config: ~/.config/dropboard/config.json  { "url": "...", "token": "..." }
 * Env overrides: DROPBOARD_URL, DROPBOARD_TOKEN
 */
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const CONFIG_PATH = path.join(os.homedir(), ".config", "dropboard", "config.json");
const TYPES = ["review", "decision", "report", "info", "fun"];
const VIEW_MODES = ["document", "presentation", "reader"];
const DESTINATIONS = ["inbox", "library"];
const STATUSES = ["inbox", "archived", "library", "trash"];

function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function die(msg) {
  console.error(`dropboard: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      flags[key] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "";
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

function deriveTitle(content, isMarkdown, file) {
  if (isMarkdown) {
    const h = content.match(/^#\s+(.+)$/m);
    if (h) return h[1].trim();
  } else {
    const t = content.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (t) return t[1].trim();
    const h1 = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1) return h1[1].trim();
  }
  return path.basename(file).replace(/\.(html?|md|markdown)$/i, "");
}

function serverUrl(flags, cfg) {
  return (
    flags.server ||
    process.env.DROPBOARD_URL ||
    cfg.url ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

async function publish(argv) {
  const { flags, positional } = parseArgs(argv);
  const file = positional[0];
  if (!file) die("usage: dropboard publish <file> [--title ...] [--type ...]");

  let content;
  try {
    content = await readFile(file, "utf8");
  } catch {
    die(`cannot read file: ${file}`);
  }

  const isMarkdown = /\.(md|markdown)$/i.test(file);
  const type = flags.type || "info";
  if (!TYPES.includes(type)) die(`type must be one of: ${TYPES.join(", ")}`);
  if (flags.view && !VIEW_MODES.includes(flags.view)) {
    die(`view must be one of: ${VIEW_MODES.join(", ")}`);
  }
  if (flags.to && !DESTINATIONS.includes(flags.to)) {
    die(`to must be one of: ${DESTINATIONS.join(", ")}`);
  }
  if (flags.to === "library" && "temp" in flags) {
    die("--to library cannot be combined with --temp");
  }

  const cfg = loadConfig();
  const url = serverUrl(flags, cfg);
  const token = process.env.DROPBOARD_TOKEN || cfg.token;
  if (!token)
    die(
      `no token. Set DROPBOARD_TOKEN or add "token" to ${CONFIG_PATH}\n` +
        `(same value as DROPBOARD_TOKEN in your dropboard server's .env.local)`,
    );

  const body = {
    title: flags.title || deriveTitle(content, isMarkdown, file),
    content,
    content_type: isMarkdown ? "markdown" : "html",
    source: flags.source || "dropboard-cli",
  };
  if (flags.type || !flags.key) body.type = type;
  if (flags.view) body.view_mode = flags.view;
  if (flags.to) body.destination = flags.to;
  if (flags.project) body.project = flags.project;
  if (flags.folder) body.folder = flags.folder;
  if (flags.key) body.document_key = flags.key;
  if (flags.note) body.revision_note = flags.note;
  if (flags.expected) {
    if (!/^\d+$/.test(flags.expected)) die("--expected must be a positive revision number");
    body.expected_revision = Number(flags.expected);
  }
  if (flags.summary) body.summary = flags.summary;
  if (flags.tags) body.tags = flags.tags.split(",").map((t) => t.trim()).filter(Boolean);
  if ("temp" in flags) {
    if (!flags.temp) {
      body.ttl_minutes = 120; // default: 2h
    } else {
      const m = flags.temp.match(/^(\d+)([mhd])$/);
      if (!m) die("--temp expects a duration like 30m, 2h, 1d");
      const mult = { m: 1, h: 60, d: 1440 }[m[2]];
      body.ttl_minutes = Number(m[1]) * mult;
    }
  }

  let res;
  try {
    res = await fetch(`${url}/api/items`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    die(`server unreachable at ${url} (is your dropboard server running?)`);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) die(`publish failed (${res.status}): ${data.error ?? "unknown"}`);

  console.log(`${data.updated ? "updated" : "published"}: ${body.title}`);
  console.log(`${url}${data.url}`);
}

async function update(argv) {
  const { flags, positional } = parseArgs(argv);
  const [id, file] = positional;
  if (!id || !file) {
    die("usage: dropboard update <item-id> <file> [--note ...]");
  }
  if (flags.type && !TYPES.includes(flags.type)) {
    die(`type must be one of: ${TYPES.join(", ")}`);
  }
  if (flags.view && !VIEW_MODES.includes(flags.view)) {
    die(`view must be one of: ${VIEW_MODES.join(", ")}`);
  }
  if (flags.to && !DESTINATIONS.includes(flags.to)) {
    die(`to must be one of: ${DESTINATIONS.join(", ")}`);
  }
  let content;
  try {
    content = await readFile(file, "utf8");
  } catch {
    die(`cannot read file: ${file}`);
  }
  const isMarkdown = /\.(md|markdown)$/i.test(file);
  const body = {
    content,
    content_type: isMarkdown ? "markdown" : "html",
    source: flags.source || "dropboard-cli",
  };
  if (flags.title) body.title = flags.title;
  if (flags.type) body.type = flags.type;
  if (flags.view) body.view_mode = flags.view;
  if (flags.to) body.destination = flags.to;
  if (flags.summary) body.summary = flags.summary;
  if (flags.note) body.revision_note = flags.note;
  if (flags.expected) {
    if (!/^\d+$/.test(flags.expected)) die("--expected must be a positive revision number");
    body.expected_revision = Number(flags.expected);
  }

  const cfg = loadConfig();
  const url = serverUrl(flags, cfg);
  const token = process.env.DROPBOARD_TOKEN || cfg.token;
  if (!token) die(`no token. Set DROPBOARD_TOKEN or add "token" to ${CONFIG_PATH}`);
  let res;
  try {
    res = await fetch(`${url}/api/items/${id}/revisions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    die(`server unreachable at ${url} (is your dropboard server running?)`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) die(`update failed (${res.status}): ${data.error ?? "unknown"}`);
  console.log(`updated: ${data.item.title} (v${data.item.revision})`);
  console.log(`${url}${data.url}`);
}

async function list(argv) {
  const { flags } = parseArgs(argv);
  const cfg = loadConfig();
  const url = serverUrl(flags, cfg);
  const token = process.env.DROPBOARD_TOKEN || cfg.token;
  const status = flags.status || "inbox";
  if (!STATUSES.includes(status)) {
    die(`status must be one of: ${STATUSES.join(", ")}`);
  }

  let res;
  try {
    res = await fetch(`${url}/api/items?status=${status}&limit=500`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    die(`server unreachable at ${url}`);
  }
  if (!res.ok) die(`list failed (${res.status})`);
  const { items, has_more: hasMore } = await res.json();
  if (!items.length) {
    console.log(`(${status} is empty)`);
    return;
  }
  for (const it of items) {
    const read = it.read_at ? " " : "●";
    const version = (it.revision ?? 1) > 1 ? ` v${it.revision}` : "";
    console.log(`${read} [${it.type}] ${it.id}${version}  ${it.title}`);
  }
  if (hasMore) console.log("(more items available; narrow the list with --status)");
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "publish") await publish(rest);
else if (cmd === "update") await update(rest);
else if (cmd === "list") await list(rest);
else {
  console.log(`dropboard — publish AI deliverables to your inbox and library

commands:
  dropboard publish <file> [--title T] [--type ${TYPES.join("|")}]
                        [--view ${VIEW_MODES.join("|")}]
                        [--to ${DESTINATIONS.join("|")}]
                        [--temp [30m|2h|1d]]   # ephemeral: auto-deletes (default 2h)
                        [--project P] [--folder A/B] [--summary S]
                        [--tags a,b] [--server URL]
                        [--key stable/key] [--note change-summary]
  dropboard update <item-id> <file> [--title T] [--type T] [--summary S]
                        [--view ${VIEW_MODES.join("|")}]
                        [--to ${DESTINATIONS.join("|")}]
                        [--note change-summary] [--expected N]
  dropboard list [--status ${STATUSES.join("|")}]

.md/.markdown files are published as markdown, everything else as html.
config: ${CONFIG_PATH}  { "url": "http://localhost:3000", "token": "..." }`);
  process.exit(cmd ? 1 : 0);
}
