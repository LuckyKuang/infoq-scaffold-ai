# Security Policy

## Supported Versions

Unless a release states otherwise, security fixes target the latest published
version. Older releases may no longer receive fixes.

Current supported version: **3.0.0**

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
- Keep `VITE_APP_ENCRYPT` / `TARO_APP_ENCRYPT=true` builds supplied with the
  matching RSA key pair

The repository only allows Redisson OSS-compatible APIs. Do not introduce or
keep Redisson PRO-only APIs such as `getLocalCachedMapCache` or rate-limiter
overloads that depend on `keepAliveTime`. Cache, limiter, auth, or login-path
changes must include OSS compatibility verification.

## Operational and Upstream Risk

Exposed deployment credentials, operator misconfiguration, and unsafe default
passwords left unchanged are not automatically product vulnerabilities.
Reports are still welcome when the project can improve defaults, validation,
or documentation.
