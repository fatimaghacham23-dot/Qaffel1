# Browser acceptance

Qaffel's Playwright suite runs only against a disposable local Supabase stack.
The fixture setup deletes deterministic `*.e2e@qaffel.local` users, so it has
two mandatory safeguards:

- `NEXT_PUBLIC_SUPABASE_URL` must resolve to `localhost`, `127.0.0.1`, or `::1`.
- `E2E_ALLOW_FIXTURE_RESET` must equal `true`.

The setup refuses to run when either condition is absent. Never point the suite
at a hosted Supabase project.

## Local prerequisites

1. Install Docker Desktop and start the Linux container engine.
2. Install the Supabase CLI.
3. Install dependencies and Chromium:

   ```powershell
   npm ci
   npm run e2e:install
   ```

4. Start and reset the disposable database:

   ```powershell
   supabase start
   supabase db reset
   supabase status -o env
   ```

5. Map the local CLI values to `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Set
   `NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000` and
   `E2E_ALLOW_FIXTURE_RESET=true`.
6. Run `npm run e2e`.

Playwright starts the Next.js development server, waits for `/api/health`, and
captures a trace, screenshot, and video when a test fails.

## Covered workflow

- Owner, admin, finance, operations, reviewer, and staff fixtures.
- UI client and invoice creation.
- Mobile public proof upload and invalid-token handling.
- Workspace-authorized signed proof access.
- Partial acceptance and rejection.
- Finance-role manual payment and void.
- Balance reconciliation and public receipt access.
- Limited-role payment-view/action behavior.
- Token-scoped client portal.

## Open browser gate

Arabic content and RTL layout are intentionally marked as a skipped release
blocker because the current public payment route does not implement an Arabic
locale or RTL document direction. Unrestricted production approval requires
implementation plus an enabled passing browser test.
