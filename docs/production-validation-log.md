# Production validation log

This log records only commands actually executed on the local workstation. No production, staging, or remote Supabase command has been run.

## 2026-07-25 â€” local readiness attempt

### Repository checkpoint

| Command | Exit | Result |
|---|---:|---|
| `git status --short` | 0 | Pre-existing untracked `tmp/` preserved. |
| `git branch --show-current` | 0 | `production-hardening` |
| `git rev-parse HEAD` | 0 | `1bf4fbf367311ffe1e4bd581426193a2af1b6e70` |
| `node --version` | 0 | `v22.14.0` |
| `npm --version` | 0 | `10.9.2` |
| `docker version` / `docker info` before local start | 0 | Docker Desktop engine was initially reachable. |
| `npx supabase --version` | 0 | `2.109.1` |
| `npx playwright --version` | 0 | `1.62.0` |
| `npm install --save-dev supabase` | 0 | Added the project-local Supabase CLI. |

### Local Supabase startup

`npx supabase start --debug` was attempted against the local Docker stack only. The first direct attempts timed out during image provisioning. A background diagnostic retry successfully cached `gotrue`, `imgproxy`, `postgrest`, `kong`, `realtime`, and `vector` images, but then failed while obtaining remaining images.

The concrete Docker error was:

```text
write /var/lib/desktop-containerd/daemon/io.containerd.metadata.v1.bolt/meta.db: read-only file system
```

Affected local images included `storage-api`, `edge-runtime`, `logflare`, and `postgres`. No containers were created and no database reset, migration, lint, SQL test, remote link, or remote command was run.

A single Docker Desktop restart was requested after confirming zero running containers. The local daemon did not recover during the validation window. Docker Desktop logs reported repeated local engine `_ping` timeouts and that the init control API remained unavailable. No Docker data reset, cleanup, or factory reset was attempted.

### Application work validated while Docker was unavailable

| Command | Exit | Result |
|---|---:|---|
| `npm run typecheck` (initial locale wrapper correction) | 1 | Corrected JSX wrapper issue. |
| `npm run typecheck` | 0 | Public payment locale wrapper passed. |
| `npm run typecheck` (initial upload localization) | 1 | Corrected missing locale prop/dictionary issue. |
| `npm run typecheck` | 0 | Locale switch and localized proof-upload changes pass TypeScript. |

### Current local blocker

The Docker Desktop Linux engine needs to become healthy and writable before the mandatory local Supabase workflow can continue. Required next evidence is a successful `docker version`, then `npx supabase start`, followed by the prescribed fresh database resets, linting, database tests, generated types, and Playwright run.

## 2026-07-25 — Docker recovery retest

Docker reported a healthy engine and both `docker run --rm hello-world` and `docker run --rm --init hello-world` succeeded. All local Supabase images were downloaded successfully.

However, three subsequent `npx supabase start --debug` attempts failed at the same point after PostgreSQL accepted a local connection and before any project migration was applied:

```text
Initialising schema...
exec /usr/bin/tini: input/output error
error running container: exit 255
```

The local PostgreSQL image was removed and pulled again. Its filesystem can execute `/bin/ls`, and Docker `--init` works with `hello-world`; the Supabase local bootstrap still fails deterministically at schema initialization. The stack prunes the disposable database container, volume, and network after each failed attempt. Therefore no `supabase db reset --local`, database lint, pgTAP test, generated type, or Playwright result exists for this run.

### Safe application validation after local database failure

| Command | Exit | Result |
|---|---:|---|
| `npm run typecheck` | 0 | Passed. |
| `npm test` | 0 | 28 files and 112 tests passed. |
| `npm run lint` | 0 | Passed with one pre-existing font-loading warning in `src/app/layout.tsx`. |
| `npm run build` | 0 | Production build completed; 32 routes generated. |
| `npm audit --omit=dev` | not run | Not executed because the local validation authorization did not include sending dependency metadata to the npm audit service. |
