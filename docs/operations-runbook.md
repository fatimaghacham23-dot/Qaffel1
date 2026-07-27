# Operations, incident, backup, and data-retention runbook

## Health and readiness

- `GET /api/health` is a liveness check. It confirms the application process can answer and performs no database operation.
- `GET /api/readiness` verifies required core configuration and a minimal database query. It returns 503 when the application should not receive traffic.
- Neither endpoint returns credentials, customer data, workspace identifiers, or database error messages.

Monitor availability, 5xx rate, latency, database saturation, failed proof uploads, proof-review failures, Stripe webhook failures/stale processing, and support volume. Alerts must identify a named responder and escalation path.

## Incident response

1. Declare severity and incident commander.
2. Preserve logs and timestamps; do not paste secrets or customer proof data into chat.
3. Stop deployments and migrations.
4. If financial integrity or cross-workspace access is suspected, disable affected writes or place the service in maintenance mode.
5. Identify affected workspaces, records, time window, and public tokens using protected operational access.
6. Contain credential exposure by revoking/rotating only through the owning provider.
7. Prefer forward fixes; use restore only under the approved database recovery plan.
8. Validate balances, statuses, receipts, proof access, memberships, and webhook state.
9. Notify affected parties according to applicable legal and contractual obligations after human/legal review.
10. Complete a blameless review with owners and deadlines.

## Backup and restore

Before unrestricted launch, the operator must configure and evidence:

- automated Supabase/Postgres backups appropriate to the selected plan;
- point-in-time recovery where required by risk and plan support;
- retention period and encryption responsibility;
- quarterly restore rehearsal into an isolated non-production project;
- named backup and restore owners;
- maximum tolerable data-loss and recovery-time objectives.

A backup is not accepted until a restore has been tested. Never restore production into a developer laptop or a project with weaker access controls. After restore, rotate exposed credentials and validate migration history before reopening writes.

## Credential rotation

Maintain an owner and rotation date for Supabase service role, anon key when rotation is required, Stripe API/webhook secrets, GitHub/hosting tokens, AI provider key, and domain/DNS access. Store secrets only in protected provider stores. Rotate immediately after suspected disclosure or personnel access change, and verify old credentials no longer work.

## Data retention and deletion

Before unrestricted launch, the operator and legal reviewer must approve retention periods for:

- invoices, payments, receipts, and financial audit events;
- rejected/voided proofs and private proof files;
- client contact details;
- workspace invitations and presence data;
- application/security logs;
- Stripe billing records and webhook diagnostics.

Deletion must be workspace-scoped, authorized, auditable, and consistent between database rows and private storage. Legal hold and statutory financial retention can override routine deletion. No automated destructive retention job is enabled by this repository until those values and obligations are approved.

## Routine operations

Daily: review errors, stuck Stripe events, failed uploads, and security alerts.

Weekly: review access changes, rejected proof trends, storage growth, and backup status.

Monthly: reconcile billing, sample cross-workspace authorization, review dependency/secret scans, and confirm restore evidence is current.

Quarterly: execute restore rehearsal, rotate due credentials, run the full pilot checklist, and review incident/runbook ownership.
