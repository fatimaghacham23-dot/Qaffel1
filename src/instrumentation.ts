import type { Instrumentation } from "next";
import { previewRscDiagnostic } from "@/lib/preview-rsc-diagnostics";

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const diagnostic = previewRscDiagnostic({
    environment: process.env.VERCEL_ENV,
    error,
    context: {
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource
    },
    method: request.method
  });
  if (diagnostic) console.error("QAFFEL_PREVIEW_RSC_ERROR", JSON.stringify(diagnostic));
};
