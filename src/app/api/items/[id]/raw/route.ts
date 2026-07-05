import { NextRequest } from "next/server";
import { marked } from "marked";
import {
  SESSION_COOKIE,
  verifyRawSig,
  verifySessionToken,
} from "../../../../../lib/session";
import { readContent } from "../../../../../lib/store";

type Ctx = { params: Promise<{ id: string }> };

/* Bypassed by middleware — authenticates itself: signed URL (viewer iframe),
 * bearer token (CLI/AI), or session cookie (direct top-level open). */
async function isAuthorized(req: NextRequest, id: string): Promise<boolean> {
  const secret = process.env.DROPBOARD_SESSION_SECRET;
  if (!secret) return true; // auth not configured (bare dev)

  const sp = req.nextUrl.searchParams;
  const sig = sp.get("st");
  if (sig && (await verifyRawSig(secret, id, Number(sp.get("e")), sig))) {
    return true;
  }
  const token = process.env.DROPBOARD_TOKEN;
  if (token && req.headers.get("authorization") === `Bearer ${token}`) {
    return true;
  }
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  return Boolean(cookie && (await verifySessionToken(cookie, secret)));
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

/* Self-contained document shell for markdown items — mirrors the board palette. */
function markdownShell(title: string, bodyHtml: string): string {
  const lang = process.env.NEXT_PUBLIC_DROPBOARD_LOCALE === "ko" ? "ko" : "en";
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root {
    --bg: #ffffff; --ink: #1d2530; --muted: #68707c; --line: #e3e4de;
    --accent: #c2472f; --code-bg: #f2f2ef;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #14171c; --ink: #e7e9ec; --muted: #97a0ab; --line: #2b323d;
      --accent: #e06a50; --code-bg: #1c2129;
    }
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo",
      Pretendard, "Segoe UI", "Malgun Gothic", sans-serif;
    background: var(--bg); color: var(--ink);
    max-width: 720px; margin: 0 auto; padding: 28px 20px 64px;
    line-height: 1.75; font-size: 16px; word-break: keep-all;
    -webkit-font-smoothing: antialiased;
  }
  h1 { font-size: 1.5rem; line-height: 1.35; margin: 0.4em 0 0.6em; }
  h2 { font-size: 1.2rem; margin: 2em 0 0.6em; padding-top: 0.8em; border-top: 1px solid var(--line); }
  h3 { font-size: 1.05rem; margin: 1.6em 0 0.5em; }
  p { margin: 0.7em 0; }
  a { color: var(--accent); }
  ul, ol { padding-left: 1.4em; }
  li { margin: 0.25em 0; }
  blockquote {
    margin: 1em 0; padding: 2px 16px; color: var(--muted);
    border-left: 3px solid var(--line);
  }
  code {
    font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.86em;
    background: var(--code-bg); padding: 2px 5px; border-radius: 4px;
  }
  pre { background: var(--code-bg); padding: 14px 16px; border-radius: 10px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; display: block; overflow-x: auto; font-size: 0.92em; }
  th, td { border: 1px solid var(--line); padding: 7px 11px; text-align: left; white-space: nowrap; }
  th { background: var(--code-bg); }
  img { max-width: 100%; height: auto; border-radius: 8px; }
  hr { border: none; border-top: 1px solid var(--line); margin: 2em 0; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!(await isAuthorized(req, id))) {
    return new Response("unauthorized", { status: 401 });
  }
  const result = await readContent(id);
  if (!result) return new Response("not found", { status: 404 });

  const { meta, content } = result;
  const html =
    meta.content_type === "markdown"
      ? markdownShell(
          meta.title,
          marked.parse(content, { gfm: true, async: false }),
        )
      : content;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // defense in depth: sandboxed even when opened outside the viewer iframe
      "Content-Security-Policy": "sandbox allow-scripts",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
