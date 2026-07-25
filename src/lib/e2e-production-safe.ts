export type HostedE2EEnvironment = Record<string, string | undefined> & {
  E2E_TARGET?: string;
  E2E_PRODUCTION_SAFE?: string;
  E2E_QA_WORKSPACE_ID?: string;
  E2E_QA_WORKSPACE_NAME?: string;
  E2E_QA_OWNER_EMAIL?: string;
  E2E_QA_OWNER_PASSWORD?: string;
};

export function isHostedE2E(environment: HostedE2EEnvironment = process.env) {
  return environment.E2E_TARGET === "hosted";
}

export function hostedE2ESafetyError(environment: HostedE2EEnvironment = process.env): string | null {
  if (!isHostedE2E(environment)) return null;
  if (environment.E2E_PRODUCTION_SAFE !== "true") return "E2E_PRODUCTION_SAFE=true is required for hosted tests.";
  if (!environment.E2E_QA_WORKSPACE_ID?.trim()) return "E2E_QA_WORKSPACE_ID is required for hosted tests.";
  if (environment.E2E_QA_WORKSPACE_NAME !== "QAFFEL_AUTOMATED_QA") {
    return "Hosted tests refuse to run unless E2E_QA_WORKSPACE_NAME is exactly QAFFEL_AUTOMATED_QA.";
  }
  if (!environment.E2E_QA_OWNER_EMAIL?.trim() || !environment.E2E_QA_OWNER_PASSWORD?.trim()) {
    return "Dedicated QA owner credentials are required for hosted tests.";
  }
  return null;
}
