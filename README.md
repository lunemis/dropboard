# dropboard

**A self-hosted review board for AI-generated deliverables.**

[![CI](https://github.com/lunemis/dropboard/actions/workflows/ci.yml/badge.svg)](https://github.com/lunemis/dropboard/actions/workflows/ci.yml) ![MIT license](https://img.shields.io/badge/license-MIT-2ea44f) ![Works with any agent](https://img.shields.io/badge/agents-Claude%20Code%20·%20Codex%20·%20any-5b7db1) ![No database](https://img.shields.io/badge/database-none-c2472f)

Your coding agent writes a design doc, a comparison table, a research report — and dumps it into the chat, where it's unreadable on your phone and lost in scrollback by tomorrow. dropboard gives agents one command to publish that deliverable as a real web page, and gives you a mobile-friendly inbox to read, keep, or let expire.

```
You:   "put this on the board"
Agent: dropboard publish out.html
       --type review --summary …
You:   read on phone → archive
```

![Inbox on desktop — stamp-seal type badges, unread dots, and a Temporary group with countdowns](docs/screenshots/desktop-inbox.png)

<p align="center">
  <img src="docs/screenshots/shot-inbox.png" width="230" alt="Inbox on mobile" />
  <img src="docs/screenshots/shot-viewer.png" width="230" alt="Reviewing a deliverable — full-fidelity rendering in a sandboxed viewer" />
  <img src="docs/screenshots/shot-login.png" width="230" alt="PIN login" />
</p>

[한국어 README](README.ko.md)

## How it works

1. **Agents publish.** One CLI call (or a REST POST) turns any HTML or Markdown into a board item with a type seal, one-line summary, and project tag. Ready-made skill files make "put this on the board" just work in Claude Code, Codex, or any agent.
2. **You review.** A mobile-first inbox with unread marks, search, and type filters. Items render full-fidelity — interactive charts and inline JS included — inside a sandboxed viewer.
3. **Nothing piles up.** Archive or trash with undo. And when you just wanted to *see* something, agents publish it as **ephemeral**: it sits in a Temporary group with a countdown and deletes itself in 2 hours — unless you tap Keep.

## Why the name?

Because that's the whole gesture: your agents **drop** deliverables on a **board**, and the board holds them until you've looked. The stamp-seal badges tell you at a glance what kind of look each one needs — a review, a decision, or just a read.

## Why dropboard

- **Agent-agnostic.** Anything that can run a CLI or hit a REST endpoint can publish: Claude Code, Codex, Cursor, aider, your own scripts. Ready-made skill/prompt files are included in [`integrations/`](integrations/).
- **Built for review, not chat.** An inbox with unread markers, type seals (review / decision / report / info / fun), pinning, archive and trash with undo — the lifecycle a deliverable actually has. Chat transcripts and vendor artifact panes have none of this.
- **Ephemeral when you want it.** `--temp` items expire on their own (default 2h) — "just show me this as HTML" stops polluting your inbox, and one tap keeps the ones worth saving.
- **Self-hosted and private.** Your deliverables never leave your machine. PIN login for the UI, bearer token for the publish API, and every artifact renders inside a sandboxed iframe with a CSP — AI-generated JS can't touch your session or make external network requests.
- **Zero infrastructure.** No database. Each item is a folder: `meta.json` + one HTML/Markdown file. Backup is `cp -r`, search is `grep`, migration is `mv`. Beyond the web framework, the only content-processing library is a markdown renderer.
- **Full-fidelity artifacts.** Agents can publish quick markdown notes (rendered with a clean document template) or fully interactive HTML pages with inline JS — charts, toggles, simulations all work.

## Quick start

```bash
git clone https://github.com/lunemis/dropboard.git && cd dropboard
npm install

cat > .env.local <<EOF
DROPBOARD_TOKEN=$(openssl rand -hex 24)        # publish API auth
DROPBOARD_PIN=123456                           # 6-digit UI login
DROPBOARD_SESSION_SECRET=$(openssl rand -hex 32)
EOF

npm run dev        # http://localhost:3000
```

Publish something:

```bash
mkdir -p ~/.config/dropboard
echo '{"url":"http://localhost:3000","token":"<your DROPBOARD_TOKEN>"}' > ~/.config/dropboard/config.json
npm link                                                # puts `dropboard` on your PATH — works everywhere
# Linux/macOS alternative: ln -s "$PWD/bin/dropboard.mjs" ~/.local/bin/dropboard

dropboard publish notes.md --type info --summary "first item"
```

Open the board, log in with your PIN, review.

### Docker Compose

For a production-style local deployment with persistent storage:

```bash
cat > .env <<EOF
DROPBOARD_TOKEN=$(openssl rand -hex 24)
DROPBOARD_PIN=123456
DROPBOARD_SESSION_SECRET=$(openssl rand -hex 32)
NEXT_PUBLIC_DROPBOARD_LOCALE=en
EOF

docker compose up --build -d
```

Open `http://localhost:3000`. Items are stored in the `dropboard-data` Docker
volume and survive container replacement. Change `DROPBOARD_PORT` in `.env` to
publish a different host port. The locale is applied at image build time, so
rebuild after changing it. The unauthenticated `/api/health` endpoint is
available for container and reverse-proxy health checks.

## Publishing

```bash
dropboard publish <file> [--title T] [--type review|decision|report|info|fun]
                      [--project P] [--folder A/B] [--summary S]
                      [--tags a,b] [--server URL]
dropboard list [--status inbox|archived|trash]
```

`.md`/`.markdown` files are rendered with the built-in document template; everything else is served as-is. Titles are auto-derived from `<title>`/`<h1>`/first `#` heading.

**Ephemeral items**: `--temp` publishes a self-destructing item (2h by default, or `--temp 30m` / `--temp 1d`) — perfect for "just show me this as HTML". Temp items sit in a *Temporary* group at the top of the inbox with a countdown; one tap on **Keep** promotes them to a regular item, otherwise they vanish on their own.

Or REST, from anything:

```bash
curl -X POST $URL/api/items \
  -H "Authorization: Bearer $DROPBOARD_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"...","type":"review","summary":"...","content":"<!doctype html>...","content_type":"html"}'
```

`GET /api/items` accepts `status`, `type`, `project`, `q`, `limit` (1–500),
and `offset`. Responses include `items`, `total`, `limit`, `offset`, and
`has_more`.

### Organizing the library

Archiving removes an item from the review queue and places it in the library.
Items without a project or folder appear in **Unfiled**, ready for you to sort
later. Open an item and use the folder-plus button to edit its project, nested
folder path, and tags. The library builds its project/folder navigator from this
metadata; selecting a parent folder includes every descendant.

Organization is logical metadata rather than physical file movement. Item IDs,
bookmarks, and share links therefore remain stable when folders are renamed.
Agents can supply an initial folder with `--folder Research/Agents`, but should
leave it unset when the destination is uncertain.

### Category customization

Open **Categories** from the gear button on the board to change each category's
display name, color, filter order, or filter visibility. The machine IDs
`review`, `decision`, `report`, `info`, and `fun` intentionally stay fixed, so
existing agent skills, CLI commands, and API integrations do not need to sync
with presentation changes. Hiding a category only removes its filter chip;
existing items and new publications using that ID continue to work.

The preferences are stored alongside the item data in
`_settings/categories.json`, so they follow the same backup or Docker volume as
the rest of the board.

## Agent integration

The point of dropboard is that you say "put it on the board" and it happens. See [`integrations/`](integrations/):

- `claude-code/SKILL.md` — drop into `~/.claude/skills/board/`
- `codex/` — symlink the same skill into `~/.codex/skills/`
- `generic-prompt.md` — paste into any agent's system prompt

Each includes artifact quality rules (self-contained HTML, mobile-first, light/dark, no external CDNs) so agents produce pages that actually read well on a phone.

## Configuration

- `DROPBOARD_TOKEN` (required) — bearer token for the publish API
- `DROPBOARD_PIN` (required) — 6-digit UI login; 5 failures → 15 min lockout
- `DROPBOARD_SESSION_SECRET` (required) — HMAC key for session cookies & signed URLs
- `DROPBOARD_UNSAFE_NO_AUTH` (optional, development only) — set to `true` to run
  without authentication under `next dev`; rejected in production
- `DROPBOARD_DATA_DIR` (default `./data/items`) — item storage location
- `DROPBOARD_TRASH_TTL_DAYS` (default `30`) — days before the built-in sweeper purges trash; `0` skips the trash purge (expired temp items are always swept)
- `NEXT_PUBLIC_DROPBOARD_LOCALE` (default `en`) — UI language `en`/`ko` (build-time)
- `DROPBOARD_PUBLIC_URL` (optional) — base URL used to build share links (see below). Without it, share
  links use whatever host the request came in on — usually `localhost`, which is useless to anyone but you.

## Operating

- **Production**: use `docker compose up --build -d`, or run `npm run build && npm run start -- -p <port>` under a supervisor (launchd, systemd, pm2).
- **Trash cleanup**: automatic — a built-in sweeper runs inside the server every 15 minutes. Prefer an external schedule? Run the server with `DROPBOARD_TRASH_TTL_DAYS=0`, then set the desired retention explicitly in cron, for example `DROPBOARD_TRASH_TTL_DAYS=30 npm run cleanup`.
- **Remote access**: put it behind your own tunnel/reverse proxy (Cloudflare Tunnel, Tailscale). Session cookies are marked `Secure` automatically when served over HTTPS.

### systemd (Linux, no root)

Run it as a **user** service:

```ini
# ~/.config/systemd/user/dropboard.service
[Unit]
Description=dropboard
After=network.target

[Service]
WorkingDirectory=/path/to/dropboard
ExecStart=/usr/bin/env npm run start -- -p 3000
Restart=on-failure

[Install]
WantedBy=default.target
```

```bash
systemctl --user enable --now dropboard
loginctl enable-linger "$USER"   # required, or the service won't start until you next log in
```

`enable-linger` is the easy-to-miss part: without it a user service only runs while you have an active login session, so dropboard silently won't come back after a reboot. If Node came from a version manager (nvm, etc.), point `ExecStart` at that Node's absolute path — the unit doesn't source your shell profile.

### Windows

There's no launchd/systemd. Task Scheduler works when you have the rights, but on locked-down/corporate machines `schtasks /create` can fail with `Access is denied` even for a per-user task. A no-admin fallback is a hidden-window launcher in your Startup folder:

```vbscript
' dropboard.vbs
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\path\to\dropboard"
sh.Run "cmd /c npm run start >> ""dropboard.log"" 2>&1", 0, False
```

Drop it into `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`. It launches `next start` silently on every login — no console window, no elevation. For a proper Windows service, [`nssm`](https://nssm.cc/) (`nssm install dropboard`) is the usual tool when you can install it.

## Sharing an item

Open any item and tap the share icon: it mints a signed public link (`/s/<id>?...`) good for 24 hours, copies it to your clipboard, and shows an option to deactivate it immediately. Anyone with the link can view that one item — no PIN required — but they can't browse your inbox, archive, or trash. Deactivating (or re-sharing, which rotates the link) invalidates every link issued before it, even ones that haven't expired yet.

Set `DROPBOARD_PUBLIC_URL` so the copied link is actually reachable by whoever you're sharing with:
- Same LAN only → your machine's LAN IP, e.g. `http://192.168.1.20:3000` (it's a DHCP address, so re-set this if it changes)
- Anyone on the internet → a tunnel/reverse-proxy domain (Cloudflare Tunnel, Tailscale Funnel, ...)

Without it, the link uses whatever host the request came in on, which is `localhost` for local browsing — that link only opens on your own machine.

## Security model

Single-user by design. Access paths: PIN → long-lived signed session cookie (UI); bearer token (API/CLI); short-lived signed URLs (artifact iframe, which sends no cookies due to sandboxing); public share links (see above — epoch-checked so they're revocable, capped at 24h). Artifacts are rendered with `sandbox allow-scripts` and a restrictive CSP — no cookie, storage, parent-DOM, form submission, or external network access. Inline CSS/JS and embedded `data:`/`blob:` media remain available for self-contained interactive artifacts.

## License

[MIT](LICENSE)

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and report
security issues according to [SECURITY.md](SECURITY.md).
