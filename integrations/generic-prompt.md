# Generic system-prompt snippet

For agents without a skill system, paste this into the system prompt / custom
instructions (fill in the URL):

```
When I ask you to "put this on the board" (or "publish to the board"), publish the
deliverable to my dropboard:

1. Write the deliverable as a single self-contained file:
   - HTML for documents with tables/charts/interactivity (inline CSS/JS, no external
     CDNs, mobile-first with a viewport meta tag, support light & dark color schemes,
     wrap wide tables in overflow-x:auto containers)
   - Markdown for plain notes/checklists/summaries
2. Publish it:
   dropboard publish <file> --type <review|decision|report|info|fun> \
     --summary "<what it is + what I should do>" [--project <slug>] \
     [--folder <parent/child>] [--tags a,b] [--temp]
   Use --temp (auto-deletes in 2h) when I just asked to *see* something as HTML;
   omit it for documents worth keeping.
   Only set --folder when the destination is already clear; otherwise leave it
   unfiled so I can organize it later. I can edit project, folder, and tags in the UI.
   (Without the CLI: POST {URL}/api/items with header "Authorization: Bearer <token>"
   and JSON body {title, type, summary, content, content_type: "html"|"markdown"}.
   Read url/token from ~/.config/dropboard/config.json.)
3. Reply with the published URL.
```
