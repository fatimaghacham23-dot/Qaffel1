# Production validation log

This log records only commands actually executed on the local workstation. No production, staging, or remote Supabase command has been run.

## 2026-07-25 — local readiness attempt

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

## 2026-07-25 � Docker recovery retest

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

## 2026-07-25 — non-Docker hardening checkpoint

No hosted Supabase, Stripe, storage, or customer-data mutation was performed.

| Command | Exit | Result |
|---|---:|---|
| `npm run typecheck` | 0 | Passed. |
| `npm test` | 0 | 30 files and 118 tests passed. |
| `npm run lint` | 0 | Passed with one existing font-loading warning in `src/app/layout.tsx`. |
| `npm run build` | 0 | Passed; 32 application routes generated. |
| `npm run migrations:check` | 0 | 36 ordered migrations match `MIGRATIONS.md`. |
| `npx playwright test --list` | 0 | Discovered 9 tests only; no browser tests executed. |
| `npm audit --omit=dev` | not run | Not run: this environment requires explicit approval before sending dependency metadata to the external npm advisory service. |

### Hosted test safety

The legacy Playwright global setup is restricted to a disposable localhost Supabase stack. It now rejects a hosted target before any fixture reset or admin action. Hosted execution also requires `E2E_PRODUCTION_SAFE=true`, the exact workspace name `QAFFEL_AUTOMATED_QA`, a QA workspace ID, and dedicated QA owner credentials. No such QA configuration is present locally, so hosted Playwright executed/passed/failed/skipped counts are **0/0/0/9 blocked** (the 9 is the discovered suite, not a skipped Playwright result).

### Arabic public payment

The public payment route accepts only `?lang=en` and `?lang=ar`, preserves existing safe query parameters when switching, sets `lang` and `dir` at the document and page-scope levels, and localizes the proof-upload workflow including validation, file-size/type errors, upload state, review explanation, amount fields, receipt hint, preview label, and note field. Currency values remain formatted through the existing USD/LBP payment path. Browser/mobile visual validation remains pending a dedicated QA public token or safe local stack.
## 2026-07-25 — approved dependency audit and public-hosted test separation

| Command | Exit | Result |
|---|---:|---|
| `npm audit --omit=dev` | 0 | `found 0 vulnerabilities`. |

Public browser tests now run in the `hosted-public` Playwright project and have no global fixture setup, authentication, service-role dependency, or write action. The legacy browser workflow is isolated under `authenticated-qa` and cannot start against a hosted target through its local fixture setup.

The hosted URL and a valid, non-sensitive public payment token are not configured in this workspace, so no hosted Playwright page was opened. The exact public test command is `E2E_TARGET=hosted E2E_BASE_URL=<https-hosted-url> npx playwright test --project=hosted-public --workers=1`. It will execute invalid-token checks without authentication; its valid-page Arabic/mobile test is skipped unless `E2E_PUBLIC_PAYMENT_TOKEN` is provided.
Follow-up: after correcting an over-escaped Playwright `testMatch` pattern, `npx playwright test --project=hosted-public --list` exits `0` and discovers **2** public-safe tests. The earlier no-test discovery result is superseded.
Hosted execution guard verification: `E2E_TARGET=hosted npx playwright test --project=hosted-public --workers=1` exited `1` with `Hosted Playwright requires E2E_BASE_URL; refusing to guess a production domain.` No browser or hosted service was contacted.