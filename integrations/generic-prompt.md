# Generic system-prompt snippet

For agents without a skill system, paste this into the system prompt / custom
instructions (fill in the URL):

```
When I ask you to "put this on the board" (or "publish to the board"), publish the
deliverable to my dropboard:

1. Write the deliverable as a single self-contained file:
   - HTML for documents with tables/charts/interactivity (inline CSS/JS, no external
     CDNs). Responsive documents must be mobile-first with a viewport meta tag,
     light/dark color schemes, and overflow wrappers around wide content.
   - Fixed-aspect slide decks may be desktop/tablet-first. Give them visible controls,
     keyboard navigation, viewport fitting, and accessible contrast.
   - Books, manuals, and other long-form references should have a title page,
     chapter hierarchy, table of contents, readable line length, and usable
     in-page navigation. Add search/progress controls when the size warrants it.
   - Markdown for plain notes/checklists/summaries
2. Publish it:
   dropboard publish <file> --type <review|decision|report|info|fun> \
     [--view <document|presentation|reader>] [--to <inbox|library>] \
     --summary "<what it is + what I should do>" [--project <slug>] \
     [--folder <parent/child>] [--tags a,b] [--temp]
   Use --temp (auto-deletes in 2h) when I just asked to *see* something as HTML;
   omit it for documents worth keeping.
   Omit --view for responsive documents. Use --view presentation only for
   fixed-aspect, screen-by-screen artifacts such as slide decks.
   Use --view reader for books, manuals, and long-form reference material.
   Omit --to to publish into the inbox when review or a decision remains. Use
   --to library only for finished material meant to be kept and revisited; draft
   books still go to the inbox. Never combine --temp with --to library.
   Only set --folder when the destination is already clear; otherwise leave it
   unfiled so I can organize it later. I can edit project, folder, and tags in the UI.
   If I am updating a known existing document, use:
   dropboard update <item-id> <file> --note "<what changed>"
   For an explicitly recurring roadmap/spec/report, reuse a stable
   --key <project/slug>; never merge merely similar titles automatically.
   (Without the CLI: POST {URL}/api/items with header "Authorization: Bearer <token>"
   and JSON body {title, type, summary, content, content_type: "html"|"markdown",
   view_mode: "document"|"presentation"|"reader",
   destination: "inbox"|"library"}.
   Read url/token from ~/.config/dropboard/config.json.)
3. Reply with the published URL.
```
