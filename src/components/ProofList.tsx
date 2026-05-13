"use client";

import { PaymentProofsTable, type PaymentProofTableItem } from "@/components/PaymentProofsTable";

interface ProofListProps {
  initialProofs: PaymentProofTableItem[];
}

export function ProofList({ initialProofs }: ProofListProps) {
  return <PaymentProofsTable initialProofs={initialProofs} />;
}
