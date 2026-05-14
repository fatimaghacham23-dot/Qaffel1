# Qaffel

Qaffel is a Lebanon-focused payment tracking MVP for freelancers and small businesses. It does not hold money or process payments. It tracks invoices, public payment proof uploads, manual payment review, and CSV exports.

## Run locally

1. **Install dependencies**

```bash
npm install
```

2. **Environment** — copy `.env.example` to `.env.local` and set at least:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3000`; use your real HTTPS URL in production)

   Optional AI proof review: `GITHUB_MODELS_API_KEY`, `AI_VERIFICATION_ENABLED` (see `.env.example`).

3. **Database** — apply migrations in order (see **`MIGRATIONS.md`** for the full list and summaries).

4. **Start the app**

```bash
npm run dev
```

Open `http://localhost:3000` (or your `NEXT_PUBLIC_APP_URL`).

## Quality checks

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

## Smoke routes (optional)

With the dev server running:

```bash
npm run smoke
```

Uses `SMOKE_BASE_URL` (default `http://localhost:3000`). Covers `/`, `/login`, workspace URLs (expect redirect to `/login` when logged out), **`/reports/csv?m=…`** (401 when logged out), and invalid public tokens (404). See **`docs/PRODUCTION_SMOKE.md`** for the manual checklist and what the script asserts.

**Auth:** Workspace routes use `requireUser()` → redirect to `/login?session=required` when logged out.

**Public:** Invalid `/pay`, `/client`, or `/receipt` tokens return **404** (no debug output).

## Supabase storage

Payment proof storage is private and secure.

1. Create a bucket named `payment-proofs`.
2. Set it to **Private** (uncheck "Public").
3. Apply the policies in `supabase/migrations/20260510221400_private_storage.sql` (included in the migration order in `MIGRATIONS.md`).

This setup allows clients to upload files anonymously via a valid public invoice token, but restricts viewing access to the authenticated invoice owner using signed URLs.

## Supabase Auth setup

1. In Supabase Dashboard, go to **Authentication**.
2. Enable the **Email** provider.
3. Enable signups (or invite-only, per your policy).
4. For local testing, you can disable email confirmations.
5. For production, enable email confirmations.
6. Ensure user-owned tables use Row Level Security (RLS) policies based on `auth.uid()`.
