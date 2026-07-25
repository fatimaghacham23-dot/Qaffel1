# Production schema gap report

Status: comparison pending authorised read-only production metadata.

## Repository expectation

The repository manifest records 36 ordered migrations, ending with
`20260725101500_financial_payment_atomicity.sql`. The application expects
token-scoped public payment RPCs, private `payment-proofs` storage, workspace
membership checks, receipt-token handling, and atomic payment review/manual
payment/void RPCs.

## Live observation

No live migration ledger or database catalog was read from this workspace.
The supplied environment has application public keys only; it does not include
authorised read-only database access, a project reference, or a service-role
key. Consequently, no schema parity claim can be made.

## Required comparison before production change approval

| Expected state | Evidence needed | Feature at risk | Proposed response | Approval |
|---|---|---|---|---|
| All 36 manifest migrations appear in the live ledger in order | `schema_migrations` read-only audit | Every database-backed flow | Additive corrective migration only if a verified version is missing | Database owner |
| Public payment RPCs exist with expected signatures and minimal grants | `pg_proc` and routine-grant audit | Token security and receipt/public pages | New corrective migration; no direct production SQL | Security + database owner |
| `payment-proofs` bucket is private with scoped policies | `storage.buckets` and `pg_policies` audit | Proof confidentiality | New storage-policy migration with rollback policy | Security + database owner |
| Workspace RLS policies have ownership and `WITH CHECK` coverage | `pg_policies` audit | Cross-workspace access | Additive RLS corrective migration, reviewed before apply | Security + database owner |
| Atomic payment RPCs use fixed search paths and limited execute grants | function audit | Double counting and unauthorised mutation | Additive function replacement migration, reviewed before apply | Security + database owner |

## Migration safety

No discrepancy has been verified, therefore no corrective migration has been
created and none may be applied. Any future migration must document lock level,
data impact, rollback, verification query, and explicit production approval.

## Current hosted-validation status

A compact SQL-Editor-safe companion script is available at
[`production-supabase-audit-paste-ready.sql`](production-supabase-audit-paste-ready.sql).
It has not been run because this workspace has no authorised database session.
No live discrepancy can yet be asserted; the absence of evidence is not evidence
of parity.