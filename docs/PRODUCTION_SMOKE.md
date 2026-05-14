# Production smoke checklist

Use this before a demo or release. **Authenticated** checks need a logged-in browser session or run the automated script while logged in is not possible via `fetch` alone—see script notes.

## Automated route script

With the app running (`npm run dev`):

```bash
set SMOKE_BASE_URL=http://localhost:3000
npm run smoke
```

The script checks HTTP status codes (public 404s, login 200, logged-out redirects to `/login` with optional `?session=required`). It does **not** log you in; protected **pages** return **302/303/307/308** to `/login` when no session cookie is sent. **`/reports/csv`** returns **401** when logged out (API-style, no HTML redirect).

## Manual checklist (logged-in)

- [ ] `/` — redirects to dashboard when already signed in; marketing when signed out
- [ ] `/login` — loads; sign-in works
- [ ] `/dashboard` — loads after login
- [ ] `/invoices` — table or empty state
- [ ] `/invoices/new` — form loads
- [ ] `/clients` — list or empty state
- [ ] `/proofs` — queue or empty state
- [ ] `/settings/payment-methods` — methods UI
- [ ] `/settings/profile` — profile form
- [ ] `/export` — CSV cards + preview
- [ ] `/reports` — monthly table + CSV links
- [ ] `/reports/csv?m=YYYY-MM` — CSV download when logged in (401 when logged out)
- [ ] `/intelligence/deep` — operational lists

## Public routes (no auth)

- [ ] Bad `/pay/<invalid-token>` → **404** (invoice link unavailable)
- [ ] Bad `/client/<invalid-token>` → **404**
- [ ] Bad `/receipt/<invalid-token>` → **404**

## Authenticated redirect (logged out)

- [ ] Open `/dashboard` (or any workspace URL) in a private window → redirected to **`/login`** (typically with **`?session=required`**)
