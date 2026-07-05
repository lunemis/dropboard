#!/usr/bin/env node
/**
 * docket — publish AI deliverables to the Docket review board.
 *
 * Usage:
 *   docket publish <file> [--title T] [--type review|decision|report|info|fun]
 *                         [--project P] [--summary S] [--tags a,b] [--source S]
 *                         [--server URL]
 *   docket list [--status inbox|archived|trash]
 *
 * Config: ~/.config/docket/config.json  { "url": "...", "token": "..." }
 * Env overrides: DOCKET_URL, DOCKET_TOKEN
 */
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const CONFIG_PATH = path.join(os.homedir(), ".config", "docket", "config.json");
const TYPES = ["review", "decision", "report", "info", "fun"];

function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function die(msg) {
  console.error(`docket: ${msg}`);
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
    process.env.DOCKET_URL ||
    cfg.url ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

async function publish(argv) {
  const { flags, positional } = parseArgs(argv);
  const file = positional[0];
  if (!file) die("usage: docket publish <file> [--title ...] [--type ...]");

  let content;
  try {
    content = await readFile(file, "utf8");
  } catch {
    die(`cannot read file: ${file}`);
  }

  const isMarkdown = /\.(md|markdown)$/i.test(file);
  const type = flags.type || "info";
  if (!TYPES.includes(type)) die(`type must be one of: ${TYPES.join(", ")}`);

  const cfg = loadConfig();
  const url = serverUrl(flags, cfg);
  const token = process.env.DOCKET_TOKEN || cfg.token;
  if (!token)
    die(
      `no token. Set DOCKET_TOKEN or add "token" to ${CONFIG_PATH}\n` +
        `(same value as DOCKET_TOKEN in your docket server's .env.local)`,
    );

  const body = {
    title: flags.title || deriveTitle(content, isMarkdown, file),
    type,
    content,
    content_type: isMarkdown ? "markdown" : "html",
    source: flags.source || "docket-cli",
  };
  if (flags.project) body.project = flags.project;
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
    die(`server unreachable at ${url} (is your docket server running?)`);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) die(`publish failed (${res.status}): ${data.error ?? "unknown"}`);

  console.log(`published: ${body.title}`);
  console.log(`${url}${data.url}`);
}

async function list(argv) {
  const { flags } = parseArgs(argv);
  const cfg = loadConfig();
  const url = serverUrl(flags, cfg);
  const token = process.env.DOCKET_TOKEN || cfg.token;
  const status = flags.status || "inbox";

  let res;
  try {
    res = await fetch(`${url}/api/items?status=${status}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    die(`server unreachable at ${url}`);
  }
  if (!res.ok) die(`list failed (${res.status})`);
  const { items } = await res.json();
  if (!items.length) {
    console.log(`(${status} is empty)`);
    return;
  }
  for (const it of items) {
    const read = it.read_at ? " " : "●";
    console.log(`${read} [${it.type}] ${it.id}  ${it.title}`);
  }
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "publish") await publish(rest);
else if (cmd === "list") await list(rest);
else {
  console.log(`docket — publish AI deliverables to your review board

commands:
  docket publish <file> [--title T] [--type ${TYPES.join("|")}]
                        [--temp [30m|2h|1d]]   # ephemeral: auto-deletes (default 2h)
                        [--project P] [--summary S] [--tags a,b] [--server URL]
  docket list [--status inbox|archived|trash]

.md/.markdown files are published as markdown, everything else as html.
config: ${CONFIG_PATH}  { "url": "http://localhost:3000", "token": "..." }`);
  process.exit(cmd ? 1 : 0);
}
