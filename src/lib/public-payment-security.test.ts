import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = readFileSync(
  resolve(root, "supabase/migrations/20260725090000_public_payment_security_hardening.sql"),
  "utf8"
);
const publicPage = readFileSync(resolve(root, "src/app/pay/[token]/page.tsx"), "utf8");
const actions = readFileSync(resolve(root, "src/app/actions.ts"), "utf8");

describe("public payment security boundary", () => {
  it("uses a token-scoped RPC instead of anonymous payment-page table reads", () => {
    expect(publicPage).toContain('rpc("get_public_payment_page"');
    expect(publicPage).not.toContain('.from("invoices")');
    expect(publicPage).not.toContain('.from("payment_proofs")');
    expect(publicPage).not.toContain('.from("profiles")');
  });

  it("closes broad anonymous table and storage policies", () => {
    expect(migration).toContain(
      'drop policy if exists "public invoice pages can read invoices by token"'
    );
    expect(migration).toContain(
      'drop policy if exists "public can upload payment proof files"'
    );
    expect(migration).toContain(
      'drop policy if exists "public can upload invoice proofs"'
    );
    expect(migration).toContain("set public = false");
  });

  it("limits proof updates to established reviewer roles", () => {
    expect(migration).toContain(
      "wm.role in ('owner', 'admin', 'finance', 'operations', 'reviewer')"
    );
    expect(migration).toContain("wm.user_id = auth.uid()");
    expect(migration).toContain("wm.status = 'active'");
  });

  it("performs public proof persistence through the server-only client", () => {
    const uploadStart = actions.indexOf("export async function uploadProofAction");
    const uploadEnd = actions.indexOf("export async function voidPaymentAction", uploadStart);
    const uploadAction = actions.slice(uploadStart, uploadEnd);

    expect(uploadAction).toContain("const supabase = createAdminClient()");
    expect(uploadAction).toContain('.eq("public_token", publicToken)');
    expect(uploadAction).toContain('storage.from("payment-proofs").upload');
    expect(uploadAction).toContain('.from("invoice_events").insert');
  });
});
