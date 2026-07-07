# Codex CLI integration

Codex reads skills from `~/.codex/skills/` using the same `SKILL.md` format as
Claude Code. Keep one source of truth and symlink it:

```bash
mkdir -p ~/.claude/skills ~/.codex/skills
cp -r integrations/claude-code ~/.claude/skills/board   # if not installed yet
ln -sfn ~/.claude/skills/board ~/.codex/skills/board
```

> **Windows:** creating a symlink needs admin rights or Developer Mode. Without them, `ln -sfn`
> in Git Bash **silently makes an independent copy** instead of a link — no error, and `ls -la`
> shows a plain directory. The two skill dirs then drift: editing `~/.claude/skills/board/SKILL.md`
> later won't reach `~/.codex/skills/board`. Either enable Developer Mode (Settings → Privacy &
> security → For developers) before running the link, or just `cp -r` into **both** locations and
> re-copy whenever you change the skill.

New Codex sessions (including every `codex exec`) pick the skill up automatically;
already-running sessions scan skills at startup, so start a new conversation.
