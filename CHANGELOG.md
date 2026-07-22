# Changelog

Notable changes to dropboard are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases use
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-07-22

The first public preview of dropboard: a private, self-hosted review board for
AI-generated deliverables.

### Added

- Mobile-first inbox with prominent unread states, search, category filters,
  pinning, temporary items, archive, trash, and undo.
- Sandboxed HTML and Markdown viewer with revocable 24-hour public share links.
- CLI and REST publishing for Claude Code, Codex, and other agents.
- Stable document keys, immutable revisions, conflict detection, version
  history, and restore-as-new-version workflows.
- Editable tags, project and nested-folder organization, archive library
  navigation, suggestions, and transactional bulk organization.
- Customizable category labels, colors, visibility, and stable semantic IDs for
  agent integrations.
- PIN sessions, bearer-token API access, login throttling, filesystem cleanup,
  Docker Compose deployment, and health checks.
- Automated Node.js 20/24 checks plus browser-level tests for organization,
  revision restore, and permanent deletion.

### Security

- Authentication fails closed when required configuration is absent.
- Artifact rendering is isolated with a restrictive CSP and sandboxed iframe.
- Metadata writes are atomic, concurrent updates are serialized, and bulk
  organization validates every target before writing with rollback on failure.
- Public share links are invalidated when a document changes.
- Production dependencies are pinned to patched PostCSS and Sharp releases.

### Fixed

- `DROPBOARD_TRASH_TTL_DAYS=0` consistently disables trash purging.
- Implicit updates cannot resurrect documents from trash.
- Permanent deletion removes the root item and all immutable revisions.
- UI request failures recover without leaving stale optimistic state.

[Unreleased]: https://github.com/lunemis/dropboard/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/lunemis/dropboard/releases/tag/v0.1.0
