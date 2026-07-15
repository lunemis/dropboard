# Security policy

dropboard is a single-user, self-hosted application. It is not designed for
multi-tenant authorization or direct exposure to an untrusted network without
a maintained reverse proxy or private tunnel in front of it.

## Supported versions

Security fixes are applied to the latest release and the `main` branch. Older
releases may not receive patches.

## Reporting a vulnerability

Please use GitHub's private **Report a vulnerability** flow in the Security tab
of this repository. Include affected versions, reproduction steps, impact, and
any suggested mitigation.

If private vulnerability reporting is unavailable, open a minimal public issue
asking for a private contact channel. Do not include exploit details, secrets,
private artifacts, or personal data in that issue.

Please allow maintainers reasonable time to reproduce and address a report
before public disclosure. Good-faith research that avoids privacy violations,
data destruction, service disruption, and access beyond your own installation
is welcome.

## Deployment expectations

- Configure strong, unique values for `DROPBOARD_TOKEN` and
  `DROPBOARD_SESSION_SECRET`, and a non-default six-digit PIN.
- Use HTTPS when accessing dropboard beyond localhost.
- Put internet-facing deployments behind a reverse proxy that provides request
  limits and network-level rate limiting.
- Treat public share URLs as bearer secrets until they expire or are revoked.
- Keep the Docker image, Node.js, and npm dependencies updated.

