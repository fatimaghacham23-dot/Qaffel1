"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type DepositType = "percent" | "fixed";
type Currency = "USD" | "LBP";

interface InvoiceDepositFieldsProps {
  defaultCurrency?: string | null;
  defaultDocumentType?: string | null;
  defaultEnabled?: boolean;
  defaultFixedAmountLbp?: number | string | null;
  defaultFixedAmountUsd?: number | string | null;
  defaultInvoiceAmountLbp?: number | string | null;
  defaultInvoiceAmountUsd?: number | string | null;
  defaultNote?: string | null;
  defaultPercent?: number | string | null;
  defaultType?: string | null;
  idPrefix?: string;
}

function fieldValue(value: number | string | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function parsePositiveNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeCurrency(value: string | null | undefined): Currency {
  return value?.toUpperCase() === "LBP" ? "LBP" : "USD";
}

function roundCurrencyAmount(amount: number, currency: Currency) {
  return currency === "LBP" ? Math.round(amount) : Math.round(amount * 100) / 100;
}

function formatMoney(amount: number, currency: Currency) {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      currency: "USD",
      maximumFractionDigits: 2,
      style: "currency"
    }).format(amount);
  }

  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)} LBP`;
}

export function InvoiceDepositFields({
  defaultCurrency = "USD",
  defaultDocumentType = "invoice",
  defaultEnabled = false,
  defaultFixedAmountLbp,
  defaultFixedAmountUsd,
  defaultInvoiceAmountLbp,
  defaultInvoiceAmountUsd,
  defaultNote,
  defaultPercent,
  defaultType,
  idPrefix = "deposit"
}: InvoiceDepositFieldsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const percentInputRef = useRef<HTMLInputElement>(null);
  const fixedUsdInputRef = useRef<HTMLInputElement>(null);
  const fixedLbpInputRef = useRef<HTMLInputElement>(null);

  const [enabled, setEnabled] = useState(defaultEnabled);
  const [depositType, setDepositType] = useState<DepositType>(defaultType === "fixed" ? "fixed" : "percent");
  const [percent, setPercent] = useState(fieldValue(defaultPercent));
  const [fixedUsd, setFixedUsd] = useState(fieldValue(defaultFixedAmountUsd));
  const [fixedLbp, setFixedLbp] = useState(fieldValue(defaultFixedAmountLbp));
  const [note, setNote] = useState(defaultNote || "");
  const [currency, setCurrency] = useState<Currency>(normalizeCurrency(defaultCurrency));
  const [documentType, setDocumentType] = useState(defaultDocumentType === "quote" ? "quote" : "invoice");
  const [invoiceAmountUsd, setInvoiceAmountUsd] = useState<number | null>(parsePositiveNumber(defaultInvoiceAmountUsd));
  const [invoiceAmountLbp, setInvoiceAmountLbp] = useState<number | null>(parsePositiveNumber(defaultInvoiceAmountLbp));

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;

    const amountUsdInput = form.querySelector<HTMLInputElement>('[name="amount_usd"]');
    const amountLbpInput = form.querySelector<HTMLInputElement>('[name="amount_lbp"]');
    const currencyInput = form.querySelector<HTMLSelectElement>('[name="currency"]');
    const documentTypeInput = form.querySelector<HTMLSelectElement>('[name="document_type"]');

    const syncInvoiceFields = () => {
      setInvoiceAmountUsd(parsePositiveNumber(amountUsdInput?.value));
      setInvoiceAmountLbp(parsePositiveNumber(amountLbpInput?.value));
      setCurrency(normalizeCurrency(currencyInput?.value));
      setDocumentType(documentTypeInput?.value === "quote" ? "quote" : "invoice");
    };

    syncInvoiceFields();

    amountUsdInput?.addEventListener("input", syncInvoiceFields);
    amountUsdInput?.addEventListener("change", syncInvoiceFields);
    amountLbpInput?.addEventListener("input", syncInvoiceFields);
    amountLbpInput?.addEventListener("change", syncInvoiceFields);
    currencyInput?.addEventListener("change", syncInvoiceFields);
    documentTypeInput?.addEventListener("change", syncInvoiceFields);

    return () => {
      amountUsdInput?.removeEventListener("input", syncInvoiceFields);
      amountUsdInput?.removeEventListener("change", syncInvoiceFields);
      amountLbpInput?.removeEventListener("input", syncInvoiceFields);
      amountLbpInput?.removeEventListener("change", syncInvoiceFields);
      currencyInput?.removeEventListener("change", syncInvoiceFields);
      documentTypeInput?.removeEventListener("change", syncInvoiceFields);
    };
  }, []);

  const primaryInvoiceAmount = currency === "USD" ? invoiceAmountUsd : invoiceAmountLbp;
  const primaryFixedAmount = currency === "USD" ? parsePositiveNumber(fixedUsd) : parsePositiveNumber(fixedLbp);

  const percentHelper = useMemo(() => {
    const percentAmount = parsePositiveNumber(percent);
    if (!percentAmount) return "Enter a deposit percent greater than 0 and no more than 100.";
    if (percentAmount > 100) return "Deposit percent must be no more than 100.";

    if (primaryInvoiceAmount) {
      const dueNow = roundCurrencyAmount((primaryInvoiceAmount * percentAmount) / 100, currency);
      const remaining = roundCurrencyAmount(primaryInvoiceAmount - dueNow, currency);
      return `Client will pay ${percentAmount}% upfront (${formatMoney(dueNow, currency)} now and ${formatMoney(remaining, currency)} later).`;
    }

    return `Client will pay ${percentAmount}% upfront.`;
  }, [currency, percent, primaryInvoiceAmount]);

  const fixedHelper = useMemo(() => {
    if (!primaryInvoiceAmount) {
      return `Enter the invoice amount in ${currency} before setting a fixed deposit.`;
    }

    if (!primaryFixedAmount) {
      return `Enter a fixed deposit amount greater than 0 in ${currency}.`;
    }

    if (primaryFixedAmount > primaryInvoiceAmount) {
      return `Fixed deposit cannot exceed the invoice total of ${formatMoney(primaryInvoiceAmount, currency)}.`;
    }

    const dueNow = roundCurrencyAmount(primaryFixedAmount, currency);
    const remaining = roundCurrencyAmount(primaryInvoiceAmount - dueNow, currency);
    return `Client will pay ${formatMoney(dueNow, currency)} now and the remaining ${formatMoney(remaining, currency)} later.`;
  }, [currency, primaryFixedAmount, primaryInvoiceAmount]);

  useEffect(() => {
    const percentInput = percentInputRef.current;
    if (!percentInput) return;

    const percentAmount = parsePositiveNumber(percent);
    if (percent && (!percentAmount || percentAmount > 100)) {
      percentInput.setCustomValidity("Deposit percent must be greater than 0 and no more than 100.");
    } else {
      percentInput.setCustomValidity("");
    }
  }, [percent]);

  useEffect(() => {
    const fixedInput = currency === "USD" ? fixedUsdInputRef.current : fixedLbpInputRef.current;
    if (!fixedInput) return;

    const fixedAmount = currency === "USD" ? parsePositiveNumber(fixedUsd) : parsePositiveNumber(fixedLbp);
    if (!primaryInvoiceAmount) {
      fixedInput.setCustomValidity(`Enter the invoice amount in ${currency} before setting a fixed deposit.`);
    } else if (fixedAmount && fixedAmount > primaryInvoiceAmount) {
      fixedInput.setCustomValidity(`Fixed deposit cannot exceed the invoice total in ${currency}.`);
    } else {
      fixedInput.setCustomValidity("");
    }
  }, [currency, fixedLbp, fixedUsd, primaryInvoiceAmount]);

  const enabledId = `${idPrefix}_enabled`;
  const typeId = `${idPrefix}_type`;
  const percentId = `${idPrefix}_percent`;
  const amountUsdId = `${idPrefix}_amount_usd`;
  const amountLbpId = `${idPrefix}_amount_lbp`;
  const noteId = `${idPrefix}_note`;
  const percentHelperId = `${percentId}_helper`;
  const fixedUsdHelperId = `${amountUsdId}_helper`;
  const fixedLbpHelperId = `${amountLbpId}_helper`;

  if (documentType === "quote") {
    return (
      <div ref={rootRef} className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
        <input name="deposit_enabled" type="hidden" value="false" />
        <span className="inline-flex rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-700">
          Client approval first
        </span>
        <p className="mt-3 text-sm font-bold text-ink">Quote deposit requests are disabled</p>
        <p className="mt-1 text-xs text-violet-700">
          Convert this quote to an invoice before collecting deposits or payment proof.
        </p>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`rounded-2xl border p-4 ${enabled ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex items-start gap-3">
        <input name="deposit_enabled" type="hidden" value="false" />
        <input
          checked={enabled}
          className="mt-1 h-4 w-4"
          id={enabledId}
          name="deposit_enabled"
          onChange={(event) => setEnabled(event.target.checked)}
          type="checkbox"
          value="true"
        />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-bold text-ink" htmlFor={enabledId}>
              Request an upfront deposit
            </label>
            {enabled ? (
              <span className="inline-flex rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700">
                Deposit requested
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Deposit requests use the invoice primary currency for validation and client-facing payment guidance.
          </p>
        </div>
      </div>

      {enabled && (
        <div className="mt-4 grid gap-4">
          <div>
            <label className="label" htmlFor={typeId}>
              Deposit type
            </label>
            <select
              className="field"
              id={typeId}
              name="deposit_type"
              onChange={(event) => setDepositType(event.target.value === "fixed" ? "fixed" : "percent")}
              value={depositType}
            >
              <option value="percent">Percent</option>
              <option value="fixed">Fixed</option>
            </select>
          </div>

          {depositType === "percent" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label" htmlFor={percentId}>
                  Deposit percent
                </label>
                <input
                  ref={percentInputRef}
                  aria-describedby={percentHelperId}
                  className="field"
                  id={percentId}
                  max="100"
                  min="0.01"
                  name="deposit_percent"
                  onChange={(event) => setPercent(event.target.value)}
                  placeholder="30"
                  required
                  step="0.01"
                  type="number"
                  value={percent}
                />
                <p id={percentHelperId} className="mt-2 text-xs text-slate-600">
                  {percentHelper}
                </p>
              </div>
              <div>
                <label className="label" htmlFor={noteId}>
                  Deposit note (optional)
                </label>
                <input
                  className="field"
                  id={noteId}
                  name="deposit_note"
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Example: project kickoff deposit"
                  value={note}
                />
              </div>
            </div>
          )}

          {depositType === "fixed" && (
            <div className="grid gap-4 md:grid-cols-2">
              {currency === "USD" ? (
                <div>
                  <label className="label" htmlFor={amountUsdId}>
                    Fixed deposit USD
                  </label>
                  <input
                    ref={fixedUsdInputRef}
                    aria-describedby={fixedUsdHelperId}
                    className="field"
                    id={amountUsdId}
                    max={invoiceAmountUsd ? String(invoiceAmountUsd) : undefined}
                    min="0.01"
                    name="deposit_amount_usd"
                    onChange={(event) => setFixedUsd(event.target.value)}
                    placeholder="500"
                    required
                    step="0.01"
                    type="number"
                    value={fixedUsd}
                  />
                  <p id={fixedUsdHelperId} className="mt-2 text-xs text-slate-600">
                    {fixedHelper}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="label" htmlFor={amountLbpId}>
                    Fixed deposit LBP
                  </label>
                  <input
                    ref={fixedLbpInputRef}
                    aria-describedby={fixedLbpHelperId}
                    className="field"
                    id={amountLbpId}
                    max={invoiceAmountLbp ? String(invoiceAmountLbp) : undefined}
                    min="1"
                    name="deposit_amount_lbp"
                    onChange={(event) => setFixedLbp(event.target.value)}
                    placeholder="45000000"
                    required
                    step="1"
                    type="number"
                    value={fixedLbp}
                  />
                  <p id={fixedLbpHelperId} className="mt-2 text-xs text-slate-600">
                    {fixedHelper}
                  </p>
                </div>
              )}
              <div>
                <label className="label" htmlFor={noteId}>
                  Deposit note (optional)
                </label>
                <input
                  className="field"
                  id={noteId}
                  name="deposit_note"
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Example: project kickoff deposit"
                  value={note}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
