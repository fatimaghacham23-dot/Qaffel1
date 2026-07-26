import { describe, expect, it } from "vitest";
import { deriveDashboardOnboardingState } from "@/lib/dashboard";
import { createOnboardingEvidenceFixture } from "@/test/onboarding-fixtures";
const state=(overrides={})=>deriveDashboardOnboardingState({ onboardingEvidence:createOnboardingEvidenceFixture(overrides),role:"owner" });
describe("dashboard onboarding presentation",()=>{
 it("uses evidence only, keeps logo optional, and is deterministic",()=>{const input={hasVisualBranding:false};expect(state(input)).toEqual(state(input));expect(state(input).setupItems).toEqual([]);});
 it("creates precise and bounded setup actions",()=>{const s=state({hasCompleteBusinessIdentity:false,hasClient:false,hasInvoice:false,hasActivePaymentMethod:false,hasSharedPaymentRequest:false,requiresTeamSetup:true,requiresBillingSetup:true,missingBusinessIdentityFields:["business_name"]});expect(s.primaryAction.title).toBe("Complete your business profile");expect(s.setupItems).toHaveLength(4);expect(new Set(s.setupItems.map(x=>x.id)).size).toBe(s.setupItems.length);});
 it("only offers sharing after an invoice and hides it when shared",()=>{expect(state({hasInvoice:true,hasSharedPaymentRequest:false}).primaryAction.id).toBe("setup:share-payment-request");expect(state({hasSharedPaymentRequest:true}).setupItems.some(x=>x.id==="setup:share-payment-request")).toBe(false);});
 it("does not expose unauthorised setup actions and identifies established workspaces",()=>{const s=deriveDashboardOnboardingState({onboardingEvidence:createOnboardingEvidenceFixture({hasClient:false,hasInvoice:false}),role:"reviewer"});expect(s.setupItems).toEqual([]);expect(s.showNewWorkspaceState).toBe(true);expect(state().showNewWorkspaceState).toBe(false);});
});