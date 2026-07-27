# Qaffel production audit

Audit date: 2026-07-25  
Audit branch: `production-hardening`  
Audited base commit: `66b82a0d8707a28e7cd2377fbfd927ed2bca3a1c` (`Migrate middleware to proxy`)

## Scope and safety

This audit covers the local repository, package scripts, migrations, authentication and Supabase clients, server actions, route handlers, storage access, Stripe billing code, tests, smoke tooling, and the working tree.

No production Supabase, Stripe, hosting, DNS, or live-domain settings were changed or inspected. No production credentials were printed. No database migration was applied.

## Repository state at audit start

Current branch before isolation: `main`.

The working tree was already dirty. The audit preserved these changes and created the required `production-hardening` branch without resetting or stashing them.

### Modified files

- `.env.example`
- `next-env.d.ts` (generated dev-path change; restored before hardening work)
- `src/app/actions.ts`
- `src/app/dashboard/loading.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/invoices/new/page.tsx`
- `src/app/invoices/page.tsx`
- `src/app/proofs/page.tsx`
- `src/app/recoveries/page.tsx`
- `src/components/AppShell.tsx`
- `src/components/ServicePresetSelector.tsx`
- `src/components/WhatsAppReminder.tsx`
- `src/lib/env.ts`
- `src/lib/status.ts`

### Untracked paths

- `.artifacts/`
- `docs/CORE_REFACTOR_CHANGELOG.md`
- `docs/INBOX_PARITY_MATRIX.md`
- `docs/PILOT_BROWSER_CHECKLIST.md`
- `docs/RECOVERY_PARITY_MATRIX.md`
- `output/`
- `src/app/demo/`
- `src/app/payments/`
- `src/app/pricing/`
- `src/app/privacy/`
- `src/app/security/`
- `src/app/support/`
- `src/app/terms/`
- `src/components/DashboardHome.tsx`
- `src/components/NewInvoiceCreatorForm.tsx`
- `src/components/PaymentsView.tsx`
- `src/components/PublicInfoPage.tsx`
- `src/lib/collection.test.ts`
- `src/lib/collection.ts`
- `src/lib/dashboard-scope.test.ts`
- `src/lib/dashboard-scope.ts`
- `src/lib/dashboard.test.ts`
- `src/lib/dashboard.ts`
- `src/lib/information-architecture.test.ts`
- `src/lib/information-architecture.ts`
- `src/lib/invoice-creator.test.ts`
- `src/lib/invoice-creator.ts`
- `src/lib/onboarding.test.ts`
- `src/lib/onboarding.ts`
- `src/lib/payment-access.test.ts`
- `src/lib/payment-access.ts`
- `src/lib/payment-history-model.test.ts`
- `src/lib/payment-history-model.ts`
- `src/lib/payment-history.test.ts`
- `src/lib/payment-history.ts`
- `src/lib/payments-view.test.ts`
- `src/lib/payments-view.ts`
- `src/lib/public-site.ts`
- `src/lib/whatsapp.test.ts`
- `src/lib/whatsapp.ts`

The dirty tree is a release blocker until the intended product changes are reviewed, committed in logical units, validated, and tagged.

## Package scripts

At audit start:

| Script | Command |
| --- | --- |
| `dev` | `next dev` |
| `build` | `next build` |
| `lint` | `eslint .` |
| `typecheck` | `tsc --noEmit` |
| `test` | `vitest run` |
| `smoke` | `node scripts/smoke-routes.mjs` |

There was no release check, migration manifest check, integration-test script, Playwright script, clean-database rehearsal script, CI workflow, or deployment workflow.

## Migration inventory

There are 32 SQL migration files. The pre-audit `MIGRATIONS.md` documented only the first 19, ending at `20260514010000_ai_proof_review.sql`.

Ordered manifest:

1. `0001_initial_schema.sql`
2. `20260510195100_add_profile_fields.sql`
3. `20260510221400_private_storage.sql`
4. `20260510223000_add_payment_amounts.sql`
5. `20260510224700_add_approval_fields.sql`
6. `20260510225900_fix_public_approval_rpc.sql`
7. `20260510233600_add_validity_and_rates.sql`
8. `20260510234500_create_service_presets.sql`
9. `20260511000200_public_payment_history_rpc.sql`
10. `20260511000300_invoice_events.sql`
11. `20260511000400_void_payments.sql`
12. `20260512000100_client_portal.sql`
13. `20260512000200_receipt_system.sql`
14. `20260512000300_deposit_requests.sql`
15. `20260512000400_quote_mode.sql`
16. `20260513091600_dedupe_receipt_view_events.sql`
17. `20260513092000_cleanup_duplicate_receipt_viewed_events.sql`
18. `20260513093000_add_whish_omt_metadata.sql`
19. `20260513120000_portal_header_business_phone.sql`
20. `20260513140000_invoice_payment_plan.sql`
21. `20260513170000_business_brand_layer.sql`
22. `20260514010000_ai_proof_review.sql`
23. `20260514120000_schema_reconciliation.sql`
24. `20260514183000_shared_reports_connectivity.sql`
25. `20260515140000_workspace_memory.sql`
26. `20260515200000_workspaces_team.sql`
27. `20260515213000_operational_assignments.sql`
28. `20260515223000_operational_attention_indexes.sql`
29. `20260515233000_finance_closing.sql`
30. `20260515234500_operational_presence.sql`
31. `20260518120000_workspace_billing_foundation.sql`
32. `20260518133000_stripe_billing_sync.sql`

No migration was squashed or rewritten. Production migration history was not available and requires manual comparison.

## Environment variable inventory

### Required for the core production runtime

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; billing/webhook administration)

### Required when Stripe workspace billing is enabled

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_BUSINESS`
- `STRIPE_PRICE_TEAM`
- `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` (optional when Stripe default portal configuration is used)

### Optional integrations and public operator configuration

- `GITHUB_MODELS_API_KEY`
- `AI_VERIFICATION_ENABLED`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `NEXT_PUBLIC_SUPPORT_WHATSAPP`

### Build/test control variables

- `NODE_ENV`
- `NEXT_PHASE`
- `SMOKE_BASE_URL`

No server-only secret may use a `NEXT_PUBLIC_` prefix. Secret values were not inspected or printed.

## Supabase client inventory

| File | Client | Purpose |
| --- | --- | --- |
| `src/lib/supabase/browser.ts` | Browser client using public URL and anon key | Client components |
| `src/lib/supabase/server.ts` | Cookie-aware server client using anon key | Server components/actions and authenticated user resolution |
| `src/lib/supabase/middleware.ts` | Request/response cookie client using anon key | Session refresh and logged-out redirects |
| `src/lib/supabase/admin.ts` | Service-role client with no persisted session | Server-only Stripe/billing synchronization |

`SUPABASE_SERVICE_ROLE_KEY` is read only by server code. Production bundling still requires a release check to prevent future `NEXT_PUBLIC_` secret regressions.

## Middleware and authentication

- `proxy.ts` delegates to `updateSession`.
- Public routes are `/`, `/login`, `/auth/*`, `/pay/*`, `/receipt/*`, `/client/*`, and `/share/*`.
- Authenticated HTML requests are redirected to `/login?session=required` when no user is available.
- Route handlers are excluded from HTML redirects and must enforce their own authentication.
- `requireUser()` authenticates through `supabase.auth.getUser()`.
- `getWorkspaceContext()` resolves the first active membership, with a legacy owner fallback when no membership exists.

The legacy owner fallback and first-membership selection require explicit production confirmation, especially if users can belong to multiple workspaces.

## Role and permission matrix

| Permission area | Owner | Admin | Finance | Operations | Reviewer | Staff |
| --- | --- | --- | --- | --- | --- | --- |
| Create/edit/send invoices | Yes | Yes | View only | Yes | View only | View only |
| Delete invoices | Yes | Yes | No | No | No | No |
| Review proofs | Yes | Yes | Yes | Yes | Yes | View only |
| Void payments | Yes | Yes | Yes | No | No | No |
| Create/edit clients | Yes | Yes | View only | Yes | View only | View only |
| Manage settings | Yes | Yes | No | No | No | No |
| Manage team | Yes | Yes | No | No | No | No |
| Reports | Yes | Yes | Yes | Yes | Yes | No |
| Finance exports | Yes | Yes | Yes | No | No | No |
| Manage recoveries | Yes | Yes | View only | Yes | No | No |
| Resolve approvals | Yes | Yes | Yes | No | No | No |
| Manage assignments | Yes | Yes | Yes | Yes | Work only | View only |
| Manage billing | Yes | No | No | No | No | No |

The code-level matrix is defined in `src/lib/permissions.ts`. Server actions must use this matrix rather than infer access from navigation visibility.

## Server action inventory

### Core actions (`src/app/actions.ts`)

- Profile/brand: `updateProfileAction`, `uploadBusinessLogoAction`, `removeBusinessLogoAction`
- Clients: `createClientAction`, `regenerateClientPortalTokenAction`, `updateClientAction`, `deleteClientAction`
- Payment methods: `createPaymentMethodAction`, `updatePaymentMethodAction`, `setDefaultPaymentMethodAction`, `deletePaymentMethodAction`
- Invoices/quotes: `createInvoiceAction`, `createInvoiceFromCreatorAction`, `updateInvoiceAction`, `deleteInvoiceAction`, `convertQuoteToInvoiceAction`, `setInvoiceStatusAction`, `duplicateInvoiceAction`
- Proof/payment review: `reviewProofAction`, `runAiProofVerificationAction`, `saveReviewerDecisionNoteAction`, `createManualPaymentAction`, `uploadProofAction`, `voidPaymentAction`
- Public quote decisions: `approveInvoiceByTokenAction`, `rejectInvoiceByTokenAction`
- Presets: `createServicePresetAction`, `updateServicePresetAction`, `deleteServicePresetAction`
- Collection operations: `recordReminderEventAction`, `extendInvoiceValidityAction`, `regenerateInvoicePublicTokenAction`
- Payment plans: `saveInvoicePaymentPlanAction`, `clearInvoicePaymentPlanAction`, `setPaymentPlanMilestoneSatisfiedAction`
- Reports/connectivity: `createSharedReportAction`, `revokeSharedReportAction`, `importConnectivityCsvAction`

### Team and operations

- Assignments: `assignOperationalWorkAction`, `updateAssignmentStatusAction`, `addAssignmentNoteAction`
- Team: `inviteTeammateAction`, `changeTeamMemberRoleAction`, `removeTeamMemberAction`, `cancelInvitationAction`, `requestApprovalAction`, `resolveApprovalAction`
- Presence: `recordOperationalPresenceAction`
- Workspace memory: client/invoice note add/update/delete/pin actions and message-template save/delete/favorite/use actions

### Finance and billing

- Finance close: `updateFinanceCloseTaskAction`, `updateFinanceCloseStatusAction`, `recordFinanceExportRunAction`
- Billing: `transferBillingOwnerAction`, `grantBillingAdminAction`, `removeBillingAdminAction`, `updateSubscriptionStateAction`, `createStripeCheckoutSessionAction`, `createStripePortalSessionAction`

The action-by-action authorization review identified inconsistent patterns. Some actions use workspace permissions; others still filter by `user_id` or rely primarily on RLS. Manual payment creation is a confirmed mismatch and is a production blocker.

## Route handler inventory

| Route handler | Method | Purpose | Required protection |
| --- | --- | --- | --- |
| `src/app/auth/callback/route.ts` | GET | Supabase auth code exchange | Redirect validation |
| `src/app/api/stripe/webhook/route.ts` | POST | Stripe workspace-billing webhook | Signature validation, idempotency, server-only admin client |
| `src/app/reports/csv/route.ts` | GET | Authenticated CSV export | User, workspace, export permission |
| `src/app/api/command/search/route.ts` | GET | Authenticated workspace search | User, workspace, row scoping |

## Referenced tables

- `profiles`
- `clients`
- `payment_methods`
- `service_presets`
- `invoices`
- `payment_proofs`
- `invoice_events`
- `workspaces`
- `workspace_members`
- `workspace_invitations`
- `workspace_approvals`
- `operational_assignments`
- `assignment_notes`
- `operational_presence_sessions`
- `client_workspace_notes`
- `invoice_workspace_notes`
- `workspace_message_templates`
- `shared_reports`
- `finance_close_periods`
- `finance_close_tasks`
- `finance_export_runs`
- `workspace_subscriptions`
- `workspace_billing_admins`
- `workspace_billing_invoices`
- `workspace_billing_audit_events`
- `stripe_webhook_events`

An RLS and policy inventory must be generated from all migrations and verified against a fresh local database and the live project manually.

## Storage buckets and access patterns

- `payment-proofs`: proof upload files. The intended production state is private with anonymous upload constrained by a valid invoice token and authenticated workspace review through signed URLs.
- `business-brand`: business logo assets, read through signed URLs.

The current review flow issues one-hour signed proof URLs. The production bucket state, object path convention, policy alignment, MIME limits, size limits, and listing restrictions require local database/storage tests and live-dashboard confirmation.

## Stripe billing audit

- Stripe is used for Qaffel workspace subscription billing, not end-customer invoice settlement.
- The webhook validates `stripe-signature`.
- Webhook event IDs are inserted into `stripe_webhook_events` and duplicate events are detected.
- Subscription and invoice synchronization is workspace-linked through metadata and stored IDs.
- Billing actions have a dedicated billing-owner/admin model.

Missing evidence includes test-mode configuration, webhook replay, out-of-order events, failed renewals, cancellation, portal access, unknown IDs, missing metadata, alerting, and production dashboard settings.

## Tests and smoke tooling at audit start

- 21 Vitest files, 94 tests.
- `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build` passed on 2026-07-24.
- The smoke script covers 17 logged-out/public-invalid-token checks.
- The controlled-pilot browser checklist is present but explicitly unexecuted.
- `@playwright/test` was not installed.
- Supabase CLI was not installed.
- Docker CLI was present but the Docker Desktop Linux daemon was not running.

## Production blockers found

1. Dirty, unreproducible working tree on the production base branch.
2. Migration documentation drift: 32 files versus 19 documented.
3. No release check or release manifest.
4. No CI or protected deployment workflow.
5. No local Supabase reset evidence; required tooling is currently unavailable.
6. No authenticated end-to-end browser evidence across owner/admin/finance/operations/reviewer/staff.
7. Confirmed manual-payment authorization mismatch (`user_id` owner scope versus workspace payment permissions).
8. Inconsistent server-action authorization patterns.
9. RLS, SECURITY DEFINER functions, views, and storage policies are not fully inventoried or tested.
10. Production `payment-proofs` bucket privacy and policy state are unverified.
11. No concurrent financial-update integration tests or proven atomic review/void workflow.
12. No automated Stripe webhook replay/out-of-order test.
13. No structured production logging, health/readiness endpoint, error tracking configuration, backup verification, restore drill, alerting, or incident runbook.
14. Legal/operator/support/retention content still requires human and legal approval.
15. No LICENSE or source/IP transfer package is present.
16. Public marketing contains claims that require evidence and controlled-pilot qualification.

## Manual confirmations required

- Exact live domain, hosting project, environment ownership, deployment source, and rollback capability.
- Current production commit and whether it includes the local uncommitted refactor.
- Complete remote Supabase migration history compared with all 32 local files.
- RLS enabled state, policies, functions, views, indexes, bucket privacy, and storage object path behavior in the live Supabase project.
- Supabase Auth redirect URLs, email confirmation, signup/invite policy, recovery, MFA availability, session duration, and rate limits.
- Stripe mode, product/price IDs, webhook endpoint, signing secret, portal configuration, event history, and alerting.
- Backup schedule, point-in-time recovery, restore-test evidence, regional placement, utilization alerts, and incident contacts.
- Operator legal identity, privacy controller/processor responsibilities, retention/deletion policy, customer terms, support contacts, regulated-activity review, and data-processing agreements.
- Ownership of source, domain, trademarks, design assets, customer data, third-party dependencies, and contributor IP assignments.
- Current production customers, data volume, multi-workspace behavior, support history, outages, and known security incidents.

## Audit conclusion

Qaffel has substantial product and domain implementation, but unrestricted production readiness is not yet demonstrated. Hardening should stabilize and prove the existing product, not redesign it or add unrelated features.
