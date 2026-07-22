# Contributing to dropboard

Thanks for helping improve dropboard. Small, focused pull requests are easiest
to review.

## Development setup

Requirements: Node.js 20.9 or newer and npm.

```bash
npm ci
cp .env.example .env.local
# Replace the placeholder token, PIN, and session secret.
npm run dev
```

Generate secrets with `openssl rand -hex 24` for `DROPBOARD_TOKEN` and
`openssl rand -hex 32` for `DROPBOARD_SESSION_SECRET`. Authentication may be
disabled only during local development with `DROPBOARD_UNSAFE_NO_AUTH=true`.

Before opening a pull request, run:

```bash
npm run lint
npm test
npx playwright install chromium # first run only
npm run test:e2e
npm run build
npm run audit
```

The browser suite builds and starts an isolated production server on port 3015.
Its fixtures live under `.e2e-data` and never use your normal board data.

When a visible UI change makes the README images stale, regenerate the isolated
demo fixtures and all screenshots with `npm run docs:screenshots`. Review every
generated image before committing it.

The audit command blocks high and critical findings. Moderate advisories must
still be reviewed and should be mentioned in the pull request when relevant.

## Project conventions

- Read the relevant guide under `node_modules/next/dist/docs/` before changing
  Next.js APIs or conventions. This project tracks Next.js 16 behavior.
- Keep artifact rendering isolated. Changes to iframe sandboxing, CSP, signed
  URLs, sessions, or public sharing require regression tests.
- Keep storage filesystem-based and preserve the `meta.json` + content-file
  format unless a migration path is included.
- Add English and Korean UI strings through `src/lib/i18n.ts`.
- Do not commit `.env` files, board data, machine-specific deployment files, or
  generated `.next` output.
- Use concise commits that each leave lint, tests, and build in a working state.

## Pull requests

Explain the problem, the chosen approach, security or compatibility impact,
and how the change was tested. Screenshots are useful for visible UI changes.
Avoid mixing unrelated refactors into a functional change.

The repository is currently distributed as source and as a Docker deployment.
Publishing the root package to npm is not a supported release path.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
