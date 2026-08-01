---
name: board
description: Publish AI deliverables (documents, analyses, reports, presentations, fun content) to the user's dropboard inbox and library as web pages. Use when the user says "put this on the board", "publish to the board", "board에 올려줘", or asks to make a deliverable easy to review outside chat.
---

# board — publish deliverables to dropboard

dropboard is the user's personal inbox and library for AI deliverables. Publish
conversation deliverables as self-contained web pages; the user reviews them in
the inbox, archives completed work as history, and keeps durable reference
material in the library.

## Pick the mode first

Infer **retention** and **polish level** from the user's phrasing:

| Phrasing | Mode |
|---|---|
| "show me this as HTML", "let me see it in the browser" | **temp**: add `--temp` (auto-deletes in 2h). Minimal styling — just make the content readable |
| "put this on the board", "publish for review" | **keep**: review-optimized page, type review/decision |
| "write this up as a document" | **keep + formal doc**: structured (sections/tables), type report/info |
| "make a book/manual/reference I can keep" | **library + reader**: add `--to library --view reader` when no review remains; otherwise publish the draft to the inbox |

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
     [--view <document|presentation|reader>] [--to <inbox|library>] \
     [--folder <parent/child>] \
     --summary "<one-line summary>" --tags a,b --source <agent-name> \
     [--temp]   # temp mode only; custom duration: --temp 30m / --temp 1d
   ```
   - If `--title` is omitted it is derived from `<title>`/`<h1>`/first `#` heading —
     make sure one of them exists.
   - Fallback without the CLI: read `~/.config/dropboard/config.json` (url/token) and
     `POST {url}/api/items` with a Bearer token (JSON: title/type/content/content_type/…).
   - For a known existing document, update it instead of creating a duplicate:
     `dropboard update <item-id> <file> --note "<what changed>"`.
   - For an intentionally recurring living document, use the same explicit
     `--key <project/stable-slug>` on every publish. The first call creates it;
     later calls add immutable revisions to the same item.
3. **Report** the printed URL back to the user.

## Metadata rules

- `--type` (judge by what the content asks of the user):
  - `review` — needs the user's review/feedback (design docs, drafts, code-review results)
  - `decision` — needs the user to choose; put the decision question in the summary
  - `report` — analysis/research results, read-only
  - `info` — reference info, curiosities the user asked about
  - `fun` — entertainment, toys
- `--summary`: shown as two lines on the list card. What it is + what the user should do.
- `--view`: omit it for responsive documents (the default). Use `presentation`
  only for fixed-aspect, screen-by-screen artifacts such as slide decks. Use
  `reader` for books, manuals, and other long-form references organized for
  sustained reading rather than quick review.
- `--to`: omit it to send work to the inbox for review. Use `library` only when
  the artifact is already a finished, durable reference. Draft books still go
  to the inbox. `--temp` cannot be combined with `--to library`.
- `--project`: related project slug; omit for general topics.
- `--folder`: optional path inside the project. Use it only when the destination is
  already clear from context; otherwise leave the item for the user's Unfiled queue.
- `--tags`: useful search terms. The user can edit project, folder, and tags later.
- `--key`: only for clearly recurring documents such as a roadmap, spec, or weekly
  report. Never infer a key from a vaguely similar title; when unsure, publish a new item.
- `--note`: short description of what changed in this revision.
- If an update returns `409` because the document is in Trash, do not recreate or
  restore it automatically. Report the conflict and let the user choose.

## HTML artifact quality rules

- **Self-contained single file**: no external CDN/font/image requests. Inline CSS/JS;
  images as data URIs or inline SVG. 5MB limit.

### Document view (default)

- **Mobile-first, but not mobile-only**: design against a 390px base with
  `<meta name="viewport" content="width=device-width, initial-scale=1">`, but never hardcode
  a single flat `max-width` (e.g. `720px`) on the whole page — on a wide monitor that leaves
  huge dead margins. Use a fluid wrapper instead, and keep long-form text readable inside it:
  ```css
  .page { max-width: min(94vw, 1100px); margin: 0 auto; padding: 24px clamp(16px, 4vw, 32px) 64px; }
  p, li, blockquote { max-width: 72ch; }              /* prose stays readable even in a wide wrapper */
  table, pre, .grid, .cards, img, svg { max-width: none; }  /* let wide elements use the full wrapper */
  ```
  Result: ~366px effective width on a 390px phone (same as before), but up to 1100px on desktop
  instead of a narrow centered column — tables/dashboards/card grids get the extra room while
  paragraphs don't stretch into unreadably long lines.
- **Light/dark**: `:root { color-scheme: light dark }` + `prefers-color-scheme` styles for both.
- **Wide content**: tables/code blocks/diagrams inside `overflow-x: auto` containers;
  the page itself must never scroll horizontally.

### Presentation view

- Pass `--view presentation`.
- Fixed aspect ratios such as 16:9 and desktop/tablet-first layouts are allowed.
- Provide visible previous/next controls as well as keyboard navigation. Touch swipe
  is recommended.
- Fit the stage to the available viewport and target a useful layout at 1024px or
  wider. The board warns smaller screens before opening.
- A single dark or light presentation theme is allowed when it is a deliberate part
  of the deck design; maintain accessible contrast.
- Fullscreen via `requestFullscreen()` is supported after a user gesture. Also make
  the deck usable in a standalone tab with its own hash routing.

### Reader view

- Pass `--view reader`; use `--to library` only if the material is already final.
- Give long material a clear title page, chapter hierarchy, and table of contents.
- Keep prose at a readable line length while letting figures, code, and tables use
  the available width. Preserve the document-view mobile and overflow rules.
- For very large artifacts, provide in-page search or filtering and visible reading
  position/progress when practical. Keep all navigation functional inside the file.

### Sandbox contract

- Inline JS works, but the page runs in a sandboxed iframe: no cookies,
  localStorage, parent access, forms, popups, or external network requests.
- Fullscreen is delegated, but do not require any other browser permission.

## Verify

Use `dropboard list` for inbox destinations and `dropboard list --status library`
for direct library destinations to confirm the item landed.
