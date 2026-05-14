/**
 * HTTP smoke checks for Qaffel (no browser, no login).
 * Start the app: npm run dev
 * Run: SMOKE_BASE_URL=http://localhost:3000 npm run smoke
 */
const BASE = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

/** @type {Array<{ path: string, name: string, expectStatus: number[], followRedirects?: boolean, locationIncludes?: string }>} */
const cases = [
  { path: "/", name: "home logged-out", expectStatus: [200], followRedirects: true },
  { path: "/login", name: "login", expectStatus: [200], followRedirects: true },
  { path: "/dashboard", name: "dashboard logged-out", expectStatus: [302, 303, 307, 308], locationIncludes: "/login" },
  { path: "/invoices", name: "invoices logged-out", expectStatus: [302, 303, 307, 308], locationIncludes: "/login" },
  { path: "/invoices/new", name: "invoices new logged-out", expectStatus: [302, 303, 307, 308], locationIncludes: "/login" },
  { path: "/clients", name: "clients logged-out", expectStatus: [302, 303, 307, 308], locationIncludes: "/login" },
  { path: "/proofs", name: "proofs logged-out", expectStatus: [302, 303, 307, 308], locationIncludes: "/login" },
  { path: "/settings/payment-methods", name: "payment methods logged-out", expectStatus: [302, 303, 307, 308], locationIncludes: "/login" },
  { path: "/settings/profile", name: "profile logged-out", expectStatus: [302, 303, 307, 308], locationIncludes: "/login" },
  { path: "/export", name: "export logged-out", expectStatus: [302, 303, 307, 308], locationIncludes: "/login" },
  { path: "/reports", name: "reports logged-out", expectStatus: [302, 303, 307, 308], locationIncludes: "/login" },
  { path: "/reports/csv?m=2026-01", name: "reports csv logged-out", expectStatus: [401] },
  { path: "/intelligence/deep", name: "intelligence deep logged-out", expectStatus: [302, 303, 307, 308], locationIncludes: "/login" },
  { path: "/invoices", name: "invoices logged-out", expectStatus: [302, 303, 307, 308], locationIncludes: "/login" },
  { path: "/invoices/new", name: "invoices new logged-out", expectStatus: [302, 303, 307, 308], locationIncludes: "/login" },
  { path: "/clients", name: "clients logged-out", expectStatus: [302, 303, 307, 308], locationIncludes: "/login" },
  { path: "/proofs", name: "proofs logged-out", expectStatus: [302, 303, 307, 308], locationIncludes: "/login" },
  { path: "/settings/payment-methods", name: "payment methods logged-out", expectStatus: [302, 303, 307, 308], locationIncludes: "/login" },
  { path: "/settings/profile", name: "profile logged-out", expectStatus: [302, 303, 307, 308], locationIncludes: "/login" },
  { path: "/export", name: "export logged-out", expectStatus: [302, 303, 307, 308], locationIncludes: "/login" },
  { path: "/reports", name: "reports logged-out", expectStatus: [302, 303, 307, 308], locationIncludes: "/login" },
  { path: "/intelligence/deep", name: "intelligence deep logged-out", expectStatus: [302, 303, 307, 308], locationIncludes: "/login" },
  { path: "/pay/invalid-token-not-found-abc123", name: "bad pay token", expectStatus: [404] },
  { path: "/client/invalid-portal-token-xxxxxxxx", name: "bad client token", expectStatus: [404] },
  { path: "/receipt/invalid-receipt-token-xxxxxxxx", name: "bad receipt token", expectStatus: [404] }
];

async function fetchStatus(path, followRedirects) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "text/html" },
    redirect: followRedirects ? "follow" : "manual"
  });
  return { status: res.status, location: res.headers.get("location") || "" };
}

async function main() {
  let failed = 0;
  console.log(`Smoke base: ${BASE}\n`);

  for (const c of cases) {
    try {
      const { status, location } = await fetchStatus(c.path, c.followRedirects === true);
      const ok =
        c.expectStatus.includes(status) &&
        (!c.locationIncludes || location.includes(c.locationIncludes));
      if (!ok) {
        console.error(`FAIL ${c.name}: ${c.path} -> ${status} location=${location || "(none)"} expected=${c.expectStatus.join("|")}${c.locationIncludes ? ` & Location includes ${c.locationIncludes}` : ""}`);
        failed += 1;
      } else {
        console.log(`OK   ${c.name}: ${status}`);
      }
    } catch (e) {
      console.error(`FAIL ${c.name}: ${c.path} -> ${e instanceof Error ? e.message : e}`);
      failed += 1;
    }
  }

  if (failed) {
    console.error(`\n${failed} check(s) failed. Is the dev server running at ${BASE}?`);
    process.exit(1);
  }
  console.log("\nAll smoke checks passed.");
}

main();
