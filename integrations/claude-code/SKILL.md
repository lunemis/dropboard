---
name: board
description: Publish AI deliverables (design docs, analyses, reports, fun content) to the user's dropboard review board as web pages. Use when the user says "put this on the board", "publish to the board", "board에 올려줘", or asks to make a long deliverable readable on mobile.
---

# board — publish deliverables to dropboard

dropboard is the user's personal review board. Publish conversation deliverables as
self-contained web pages; the user reviews them on the board (including on mobile)
and archives/deletes them there.

## Pick the mode first

Infer **retention** and **polish level** from the user's phrasing:

| Phrasing | Mode |
|---|---|
| "show me this as HTML", "let me see it in the browser" | **temp**: add `--temp` (auto-deletes in 2h). Minimal styling — just make the content readable |
| "put this on the board", "publish for review" | **keep**: review-optimized page, type review/decision |
| "write this up as a document" | **keep + formal doc**: structured (sections/tables), type report/info |

Temp items appear in a "Temporary" group at the top of the inbox; the user can
press Keep to retain one. When unsure, publish as keep — deleting is easy.

## Procedure

1. **Produce the artifact** as a file in a temp directory:
   - Documents with tables/charts/interactivity → **HTML** (quality rules below)
   - Plain text documents (notes, checklists, summaries) → **Markdown** (the server
     renders it with a clean document template)
2. **Publish**:
   ```bash
   dropboard publish <file> --type <type> --project <project-slug> \
     --summary "<one-line summary>" --tags a,b --source <agent-name> \
     [--temp]   # temp mode only; custom duration: --temp 30m / --temp 1d
   ```
   - If `--title` is omitted it is derived from `<title>`/`<h1>`/first `#` heading —
     make sure one of them exists.
   - Fallback without the CLI: read `~/.config/dropboard/config.json` (url/token) and
     `POST {url}/api/items` with a Bearer token (JSON: title/type/content/content_type/…).
3. **Report** the printed URL back to the user.

## Metadata rules

- `--type` (judge by what the content asks of the user):
  - `review` — needs the user's review/feedback (design docs, drafts, code-review results)
  - `decision` — needs the user to choose; put the decision question in the summary
  - `report` — analysis/research results, read-only
  - `info` — reference info, curiosities the user asked about
  - `fun` — entertainment, toys
- `--summary`: shown as two lines on the list card. What it is + what the user should do.
- `--project`: related project slug; omit for general topics.

## HTML artifact quality rules

- **Self-contained single file**: no external CDN/font/image requests. Inline CSS/JS;
  images as data URIs or inline SVG. 5MB limit.
- **Mobile-first**: 390px base, `<meta name="viewport" content="width=device-width, initial-scale=1">`,
  body max-width ~720px centered.
- **Light/dark**: `:root { color-scheme: light dark }` + `prefers-color-scheme` styles for both.
- **Wide content**: tables/code blocks/diagrams inside `overflow-x: auto` containers;
  the page itself must never scroll horizontally.
- **Dynamic pages allowed**: inline JS works, but the page runs in a sandboxed iframe —
  no cookies/localStorage/parent access; don't fetch external resources.

## Verify

`dropboard list` shows the inbox to confirm the item landed.
