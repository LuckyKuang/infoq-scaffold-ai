# Security Policy

## Supported Versions

Unless a release states otherwise, security fixes target the latest published
version. Older releases may no longer receive fixes.

Use the latest published GitHub Release to determine the currently supported version.

## Reporting a Vulnerability

Use the repository's private GitHub vulnerability-reporting feature when it is
available. Do not open a public issue containing credentials, production data,
private endpoints, or exploit details.

If private reporting is unavailable, open a minimal issue requesting a private
contact channel without including sensitive technical details.

Include the affected version, deployment type, impact, reproduction conditions,
and any relevant logs with secrets removed. Maintainers will assess scope and
coordinate disclosure based on severity and available fixes.

## Project Security Baseline

- Do not hardcode secrets, tokens, or production configuration in source
- Validate external input at trust boundaries
- Use parameterized database access (MyBatis-Plus)
- Change default deployment passwords before exposing a stack
- Keep `VITE_APP_ENCRYPT=true` builds supplied with the matching RSA key pair

Production must use controlled, independent database, Redis, token and RSA
credentials. Repository example values are for isolated development only.
Browser bundles expose their keys to users; the bundled RSA private key cannot
serve as a server-side secret or replace HTTPS. Check API documentation exposure,
dependency ports, least-privilege accounts, backup access and log redaction
before exposing a deployment. Build or smoke success does not establish that
these production checks have passed.

Admin passwords are never remembered by the application; the optional login
setting remembers only a username. Access tokens stay in memory. Page reloads
use a scoped HttpOnly browser session protected by Spring CSRF and exact Origin
checks through the same-origin API proxy; ordinary APIs still require Bearer
authentication. Production requires HTTPS and verified cookie Path/Secure/TTL
configuration. See [the authentication contract](docs/specs/auth/spec.md).

The repository only allows Redisson OSS-compatible APIs. Do not introduce or
keep Redisson PRO-only APIs such as `getLocalCachedMapCache` or rate-limiter
overloads that depend on `keepAliveTime`. Cache, limiter, auth, or login-path
changes must include OSS compatibility verification.

## Operational and Upstream Risk

Exposed deployment credentials, operator misconfiguration, and unsafe default
passwords left unchanged are not automatically product vulnerabilities.
Reports are still welcome when the project can improve defaults, validation,
or documentation.
