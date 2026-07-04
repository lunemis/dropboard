# docketry

**A self-hosted review board for AI-generated deliverables.**

Your coding agent writes a design doc, a comparison table, a research report — and dumps it into the chat, where it's unreadable on your phone and lost in scrollback by tomorrow. docket gives agents one command to publish that deliverable as a real web page, and gives you a mobile-friendly inbox to read, archive, and delete them.

```
You:    "put this on the board"
Agent:  docket publish design-review.html --type review --summary "3 options compared, recommending #2"
You:    open your board on your phone → read → archive. done.
```

[한국어 README](README.ko.md)

## Why docket

- **Agent-agnostic.** Anything that can run a CLI or hit a REST endpoint can publish: Claude Code, Codex, Cursor, aider, your own scripts. Ready-made skill/prompt files are included in [`integrations/`](integrations/).
- **Built for review, not chat.** An inbox with unread markers, type badges (review / decision / report / info / fun), pinning, archive and trash with undo — the lifecycle a deliverable actually has. Chat transcripts and vendor artifact panes have none of this.
- **Self-hosted and private.** Your deliverables never leave your machine. PIN login for the UI, bearer token for the publish API, and every artifact renders inside a sandboxed iframe with a CSP — AI-generated JS can't touch your session.
- **Zero infrastructure.** No database. Each item is a folder: `meta.json` + one HTML/Markdown file. Backup is `cp -r`, search is `grep`, migration is `mv`. The only runtime dependency is a markdown renderer.
- **Full-fidelity artifacts.** Agents can publish quick markdown notes (rendered with a clean document template) or fully interactive HTML pages with inline JS — charts, toggles, simulations all work.

## Quick start

```bash
git clone https://github.com/lunemis/docketry.git && cd docketry
npm install

cat > .env.local <<EOF
DOCKET_TOKEN=$(openssl rand -hex 24)        # publish API auth
DOCKET_PIN=123456                           # 6-digit UI login
DOCKET_SESSION_SECRET=$(openssl rand -hex 32)
EOF

npm run dev        # http://localhost:3000
```

Publish something:

```bash
mkdir -p ~/.config/docket
echo '{"url":"http://localhost:3000","token":"<your DOCKET_TOKEN>"}' > ~/.config/docket/config.json
ln -s "$PWD/bin/docket.mjs" ~/.local/bin/docket   # or: npm link

docket publish notes.md --type info --summary "first item"
```

Open the board, log in with your PIN, review.

## Publishing

```bash
docket publish <file> [--title T] [--type review|decision|report|info|fun]
                      [--project P] [--summary S] [--tags a,b] [--server URL]
docket list [--status inbox|archived|trash]
```

`.md`/`.markdown` files are rendered with the built-in document template; everything else is served as-is. Titles are auto-derived from `<title>`/`<h1>`/first `#` heading.

Or REST, from anything:

```bash
curl -X POST $URL/api/items \
  -H "Authorization: Bearer $DOCKET_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"...","type":"review","summary":"...","content":"<!doctype html>...","content_type":"html"}'
```

## Agent integration

The point of docket is that you say "put it on the board" and it happens. See [`integrations/`](integrations/):

- `claude-code/SKILL.md` — drop into `~/.claude/skills/board/`
- `codex/` — symlink the same skill into `~/.codex/skills/`
- `generic-prompt.md` — paste into any agent's system prompt

Each includes artifact quality rules (self-contained HTML, mobile-first, light/dark, no external CDNs) so agents produce pages that actually read well on a phone.

## Configuration

| Env | Default | Purpose |
|---|---|---|
| `DOCKET_TOKEN` | — (required) | Bearer token for the publish/API access |
| `DOCKET_PIN` | — (required) | 6-digit UI login (5 failures → 15 min lockout) |
| `DOCKET_SESSION_SECRET` | — (required) | HMAC key for session cookies & signed URLs |
| `DOCKET_DATA_DIR` | `./data/items` | Item storage location |
| `DOCKET_TRASH_TTL_DAYS` | `30` | Days before the built-in sweeper purges trash (`0` disables it) |
| `NEXT_PUBLIC_DOCKET_LOCALE` | `en` | UI language: `en` or `ko` (build-time) |

## Operating

- **Production**: `npm run build && npm run start -- -p <port>` under any supervisor (launchd, systemd, pm2, Docker).
- **Trash cleanup**: automatic — a built-in sweeper runs inside the server every 6 hours. Prefer an external schedule? Set `DOCKET_TRASH_TTL_DAYS=0` and cron `npm run cleanup` instead.
- **Remote access**: put it behind your own tunnel/reverse proxy (Cloudflare Tunnel, Tailscale). Session cookies are marked `Secure` automatically when served over HTTPS.

## Security model

Single-user by design. Three access paths: PIN → long-lived signed session cookie (UI); bearer token (API/CLI); short-lived signed URLs (artifact iframe, which sends no cookies due to sandboxing). Artifacts are rendered with `sandbox allow-scripts` and a CSP sandbox header — no cookie, storage, or parent-DOM access.

## License

[MIT](LICENSE)
