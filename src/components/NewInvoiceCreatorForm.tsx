"use client";

import { useRef, useState, useTransition, type FormEvent, type InvalidEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createInvoiceAction, createInvoiceFromCreatorAction } from "@/app/actions";
import { InvoiceDepositFields } from "@/components/InvoiceDepositFields";
import { ServicePresetSelector } from "@/components/ServicePresetSelector";
import { validateInvoiceCreatorForm, type InvoiceCreatorField, type InvoiceCreatorFieldErrors } from "@/lib/invoice-creator";
import { invoiceStatuses } from "@/lib/types";

type ClientOption = {
  id: string;
  name: string;
};

type ServicePresetOption = {
  amount_lbp: number | null;
  amount_usd: number | null;
  currency: string;
  default_validity_days: number | null;
  description: string | null;
  id: string;
  name: string;
};

type NewInvoiceCreatorFormProps = {
  clients: ClientOption[];
  prefilledClientId?: string;
  presets: ServicePresetOption[];
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;

  return (
    <p id={id} role="alert" className="mt-2 text-xs font-semibold text-rose-700">
      {message}
    </p>
  );
}

function errorId(field: InvoiceCreatorField) {
  return `${field}-error`;
}

function focusFirstError(form: HTMLFormElement, fieldErrors: InvoiceCreatorFieldErrors) {
  const firstField = Object.keys(fieldErrors)[0];
  if (!firstField) return;

  const control = form.elements.namedItem(firstField);
  if (control instanceof HTMLElement) {
    control.focus();
    control.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

function mergeNativeFieldError(fieldErrors: InvoiceCreatorFieldErrors, target: EventTarget | null) {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
    return fieldErrors;
  }

  if (!target.name || !target.validationMessage) {
    return fieldErrors;
  }

  return {
    ...fieldErrors,
    [target.name]: target.validationMessage
  };
}

export function NewInvoiceCreatorForm({ clients, prefilledClientId, presets }: NewInvoiceCreatorFormProps) {
  const router = useRouter();
  const submitLockRef = useRef(false);
  const invalidToastLockRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<InvoiceCreatorFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isSubmitting = isCreating || isPending;

  const describeField = (field: InvoiceCreatorField) => (fieldErrors[field] ? errorId(field) : undefined);
  const invalidField = (field: InvoiceCreatorField) => (fieldErrors[field] ? true : undefined);

  const clearFieldError = (field: string | null | undefined) => {
    if (!field) return;

    setFieldErrors((current) => {
      if (!current[field as InvoiceCreatorField]) return current;
      const next = { ...current };
      delete next[field as InvoiceCreatorField];
      return next;
    });
  };

  const handleFieldInput = (event: FormEvent<HTMLFormElement>) => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
      clearFieldError(target.name);
      setFormError(null);
    }
  };

  const handleInvalid = (event: InvalidEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const validation = validateInvoiceCreatorForm(new FormData(form));
    const nextErrors = mergeNativeFieldError(validation.ok ? {} : validation.fieldErrors, event.target);
    const message = validation.ok ? "Fix the highlighted fields before creating the document." : validation.message;

    setFieldErrors(nextErrors);
    setFormError(message);
    focusFirstError(form, nextErrors);

    if (!invalidToastLockRef.current) {
      invalidToastLockRef.current = true;
      toast.error(message);
      window.setTimeout(() => {
        invalidToastLockRef.current = false;
      }, 500);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const validation = validateInvoiceCreatorForm(formData);

    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors);
      setFormError(validation.message);
      toast.error(validation.message);
      focusFirstError(form, validation.fieldErrors);
      return;
    }

    if (submitLockRef.current) {
      toast.message("Document creation is already in progress.");
      return;
    }

    submitLockRef.current = true;
    setFieldErrors({});
    setFormError(null);
    setIsCreating(true);

    const toastId = toast.loading("Creating document...");

    startTransition(() => {
      void (async () => {
        try {
          const result = await createInvoiceFromCreatorAction(formData);

          if (!result.ok) {
            setFieldErrors(result.fieldErrors || {});
            setFormError(result.message);
            toast.error(result.message, { id: toastId });
            focusFirstError(form, result.fieldErrors || {});
            return;
          }

          toast.success("Document created", { id: toastId });
          router.push(result.href);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not create document.";
          setFormError(message);
          toast.error(message, { id: toastId });
        } finally {
          submitLockRef.current = false;
          setIsCreating(false);
        }
      })();
    });
  };

  return (
    <form
      action={createInvoiceAction}
      className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"
      onInput={handleFieldInput}
      onInvalid={handleInvalid}
      onSubmit={handleSubmit}
    >
      <div className="space-y-6">
        {formError ? (
          <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            {formError}
          </div>
        ) : null}

        <section className="panel">
          <h2 className="mb-4 text-lg font-bold text-ink">Document basics</h2>
          <div className="grid gap-4">
            <ServicePresetSelector presets={presets} />

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <label className="label font-bold text-ink" htmlFor="client_id">
                Select Client
              </label>
              <select
                aria-describedby={describeField("client_id")}
                aria-invalid={invalidField("client_id")}
                className="field mt-1"
                defaultValue={prefilledClientId || ""}
                id="client_id"
                name="client_id"
              >
                <option value="">No client (not recommended)</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <FieldError id={errorId("client_id")} message={fieldErrors.client_id} />
              <p className="mt-2 text-xs text-slate-600">
                You can create an invoice without a client, but WhatsApp reminders and client tracking will be limited.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label" htmlFor="document_type">
                  Document type
                </label>
                <select
                  aria-describedby={describeField("document_type")}
                  aria-invalid={invalidField("document_type")}
                  className="field"
                  defaultValue="invoice"
                  id="document_type"
                  name="document_type"
                >
                  <option value="invoice">Invoice</option>
                  <option value="quote">Quote</option>
                </select>
                <FieldError id={errorId("document_type")} message={fieldErrors.document_type} />
              </div>
              <div>
                <label className="label" htmlFor="invoice_number">
                  Document number
                </label>
                <input
                  aria-describedby={describeField("invoice_number")}
                  aria-invalid={invalidField("invoice_number")}
                  className="field"
                  id="invoice_number"
                  name="invoice_number"
                  placeholder="Auto-generated if blank"
                />
                <FieldError id={errorId("invoice_number")} message={fieldErrors.invoice_number} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="title">
                Title
              </label>
              <input
                aria-describedby={describeField("title")}
                aria-invalid={invalidField("title")}
                className="field"
                id="title"
                name="title"
                required
              />
              <FieldError id={errorId("title")} message={fieldErrors.title} />
            </div>
            <div>
              <label className="label" htmlFor="description">
                Description
              </label>
              <textarea
                aria-describedby={describeField("description")}
                aria-invalid={invalidField("description")}
                className="field min-h-24"
                id="description"
                name="description"
              />
              <FieldError id={errorId("description")} message={fieldErrors.description} />
            </div>
          </div>
        </section>

        <section className="panel">
          <h2 className="mb-4 text-lg font-bold text-ink">Amounts and payment terms</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="label" htmlFor="amount_usd">
                Amount USD
              </label>
              <input
                aria-describedby={describeField("amount_usd")}
                aria-invalid={invalidField("amount_usd")}
                className="field"
                id="amount_usd"
                min="0"
                name="amount_usd"
                step="0.01"
                type="number"
              />
              <FieldError id={errorId("amount_usd")} message={fieldErrors.amount_usd} />
            </div>
            <div>
              <label className="label" htmlFor="amount_lbp">
                Amount LBP
              </label>
              <input
                aria-describedby={describeField("amount_lbp")}
                aria-invalid={invalidField("amount_lbp")}
                className="field"
                id="amount_lbp"
                min="0"
                name="amount_lbp"
                step="1"
                type="number"
              />
              <FieldError id={errorId("amount_lbp")} message={fieldErrors.amount_lbp} />
            </div>
            <div>
              <label className="label" htmlFor="currency">
                Currency
              </label>
              <select
                aria-describedby={describeField("currency")}
                aria-invalid={invalidField("currency")}
                className="field"
                id="currency"
                name="currency"
              >
                <option value="USD">USD</option>
                <option value="LBP">LBP</option>
              </select>
              <FieldError id={errorId("currency")} message={fieldErrors.currency} />
            </div>
            <div>
              <label className="label" htmlFor="due_date">
                Due date
              </label>
              <input
                aria-describedby={describeField("due_date")}
                aria-invalid={invalidField("due_date")}
                className="field"
                id="due_date"
                name="due_date"
                type="date"
              />
              <FieldError id={errorId("due_date")} message={fieldErrors.due_date} />
            </div>
          </div>
        </section>

        <section className="panel">
          <h2 className="mb-4 text-lg font-bold text-ink">Status and client access</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="status">
                Status
              </label>
              <select
                aria-describedby={describeField("status")}
                aria-invalid={invalidField("status")}
                className="field"
                defaultValue="draft"
                id="status"
                name="status"
              >
                {invoiceStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <FieldError id={errorId("status")} message={fieldErrors.status} />
            </div>
            <div>
              <label className="label" htmlFor="require_approval">
                Require client approval before payment?
              </label>
              <select
                aria-describedby={describeField("require_approval")}
                aria-invalid={invalidField("require_approval")}
                className="field"
                id="require_approval"
                name="require_approval"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
              <FieldError id={errorId("require_approval")} message={fieldErrors.require_approval} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="valid_until">
                Valid until (optional)
              </label>
              <input
                aria-describedby={describeField("valid_until")}
                aria-invalid={invalidField("valid_until")}
                className="field"
                id="valid_until"
                name="valid_until"
                type="datetime-local"
              />
              <FieldError id={errorId("valid_until")} message={fieldErrors.valid_until} />
            </div>
            <div>
              <label className="label" htmlFor="exchange_rate_lbp_per_usd">
                Exchange rate LBP per USD
              </label>
              <input
                aria-describedby={describeField("exchange_rate_lbp_per_usd")}
                aria-invalid={invalidField("exchange_rate_lbp_per_usd")}
                className="field"
                id="exchange_rate_lbp_per_usd"
                min="0"
                name="exchange_rate_lbp_per_usd"
                placeholder="e.g. 89500"
                step="1"
                type="number"
              />
              <FieldError id={errorId("exchange_rate_lbp_per_usd")} message={fieldErrors.exchange_rate_lbp_per_usd} />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="rate_note">
              Rate note (optional)
            </label>
            <textarea
              aria-describedby={describeField("rate_note")}
              aria-invalid={invalidField("rate_note")}
              className="field min-h-20"
              id="rate_note"
              name="rate_note"
              placeholder="LBP amount is based on today's market rate and may change after expiry."
            />
            <FieldError id={errorId("rate_note")} message={fieldErrors.rate_note} />
          </div>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="panel xl:sticky xl:top-6">
          <h2 className="mb-4 text-lg font-bold text-ink">Deposit request</h2>
          <InvoiceDepositFields />
          <FieldError
            id="deposit-request-error"
            message={
              fieldErrors.deposit_type ||
              fieldErrors.deposit_percent ||
              fieldErrors.deposit_amount_usd ||
              fieldErrors.deposit_amount_lbp ||
              fieldErrors.deposit_note
            }
          />
          <div className="mt-5 border-t border-slate-200 pt-4">
            <button className="btn btn-primary w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating..." : "Create document"}
            </button>
          </div>
        </section>
      </aside>
    </form>
  );
}
