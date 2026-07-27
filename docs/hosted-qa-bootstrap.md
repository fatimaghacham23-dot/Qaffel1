# Hosted QA bootstrap (production-safe)

This procedure prepares browser testing against the existing hosted Qaffel application without direct database writes, service-role credentials, schema changes, or customer-data access.

## Required untracked environment variables

```text
E2E_TARGET=hosted
E2E_BASE_URL=https://<approved-qaffel-host>
E2E_PRODUCTION_SAFE=true
E2E_QA_WORKSPACE_NAME=QAFFEL_AUTOMATED_QA
E2E_QA_WORKSPACE_ID=<verified-existing-qa-workspace-id>
E2E_QA_OWNER_EMAIL=<dedicated-qa-owner-email>
E2E_QA_OWNER_PASSWORD=<dedicated-qa-owner-password>
```

Optional dedicated-role addresses: `E2E_QA_ADMIN_EMAIL`, `E2E_QA_FINANCE_EMAIL`, `E2E_QA_OPERATIONS_EMAIL`, `E2E_QA_REVIEWER_EMAIL`, and `E2E_QA_STAFF_EMAIL`.

For valid public-page checks only, an operator may additionally provide a non-customer QA link token through `E2E_PUBLIC_PAYMENT_TOKEN`. Do not commit it or print it in test output.

## Operator procedure

1. Sign in manually as the dedicated QA owner at `E2E_BASE_URL`.
2. Create or select only the workspace named `QAFFEL_AUTOMATED_QA`; record its identifier from the authorised workspace administration surface. Stop if name or ID differs from the configured values.
3. Invite the dedicated QA role accounts using the normal Team UI. Do not send invitations to customer accounts.
4. Create all test records using the standard UI/server actions. Prefix every generated name, description, note, and title with `QA_`, `E2E_`, or `TEST_`.
5. Create a second, separately prefixed QA workspace only if isolation testing is approved. Never use a customer workspace as the comparison target.
6. Run `npx playwright test --project=hosted-public --workers=1` first. Then run authenticated QA tests only after the owner verifies the workspace identity and all required role accounts exist.
7. Retain redacted failure traces/screenshots. Remove only records whose prefix and creation record prove they came from this QA run; preserve the QA workspace itself.

## Refusal conditions

Do not start hosted QA when the URL, exact workspace name, workspace identifier, owner credentials, or `E2E_PRODUCTION_SAFE=true` are absent. Do not test Stripe production mutations, customer data, billing lifecycle changes, storage cleanup, migration commands, or direct database writes.