"use client";

import { useEffect, useState } from "react";

const TEMPLATES = {
  whish: {
    label: "Whish Money",
    instructions: "Send via Whish to:\nName:\nPhone:\nAfter payment, upload a screenshot here."
  },
  omt: {
    label: "OMT Transfer",
    instructions: "Send via OMT to:\nName:\nPhone:\nPlease upload the receipt screenshot after payment."
  },
  cash: {
    label: "Cash",
    instructions: "Cash payment accepted. Please write a note after paying."
  },
  bank_transfer: {
    label: "Bank transfer",
    instructions: "Transfer to:\nBank:\nAccount name:\nIBAN:\nPlease upload the transfer receipt after payment."
  }
};

export function PaymentMethodTemplates() {
  const applyTemplate = (type: keyof typeof TEMPLATES) => {
    const template = TEMPLATES[type];
    const typeSelect = document.getElementById("type") as HTMLSelectElement;
    const labelInput = document.getElementById("label") as HTMLInputElement;
    const instructionsTextarea = document.getElementById("instructions") as HTMLTextAreaElement;

    if (typeSelect) typeSelect.value = type;
    if (labelInput) labelInput.value = template.label;
    if (instructionsTextarea) instructionsTextarea.value = template.instructions;
  };

  return (
    <div className="mb-4">
      <p className="mb-2 text-sm font-semibold text-slate-700">Quick templates:</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => applyTemplate("whish")}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Whish Money
        </button>
        <button
          type="button"
          onClick={() => applyTemplate("omt")}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          OMT
        </button>
        <button
          type="button"
          onClick={() => applyTemplate("cash")}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Cash
        </button>
        <button
          type="button"
          onClick={() => applyTemplate("bank_transfer")}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Bank transfer
        </button>
      </div>
    </div>
  );
}
