# Changelog

Notable changes to dropboard are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases use
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Automated tests and GitHub Actions quality checks.
- Standalone Docker and Docker Compose deployment with persistent storage.
- Health endpoint and paginated item listings.

### Changed

- Authentication now fails closed when required server configuration is absent.
- Artifact CSP blocks external network and form access.
- Filesystem metadata writes are atomic and concurrent item updates are serialized.

### Fixed

- `DROPBOARD_TRASH_TTL_DAYS=0` consistently disables trash purging.
- React purity lint failures and unhandled UI request errors.

## [0.1.0] - 2026-07-15

Initial public release: mobile review inbox, HTML/Markdown artifact viewer, CLI
publishing, ephemeral items, archive/trash lifecycle, and revocable share links.

[Unreleased]: https://github.com/lunemis/dropboard/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/lunemis/dropboard/releases/tag/v0.1.0

