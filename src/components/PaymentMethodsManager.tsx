"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clipboard, CreditCard, Edit3, Eye, EyeOff, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  createPaymentMethodAction,
  deletePaymentMethodAction,
  setDefaultPaymentMethodAction,
  updatePaymentMethodAction
} from "@/app/actions";
import { PremiumEmptyState } from "@/components/PremiumEmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaymentMethodIcon, getPaymentMethodLabel } from "@/components/PaymentMethodIcon";
import { cn } from "@/lib/utils";

type PaymentMethod = {
  id: string;
  type: string;
  label: string;
  instructions: string;
  is_active: boolean;
  created_at: string;
  receiver_name?: string | null;
  receiver_phone?: string | null;
  account_reference?: string | null;
  qr_image_path?: string | null;
  external_link?: string | null;
};

type MethodType = "whish" | "omt" | "cash" | "bank_transfer" | "other";
type EditorMode = "create" | "edit";

type EditorState = {
  type: MethodType;
  label: string;
  isActive: boolean;
  name: string;
  phone: string;
  account: string;
  branchNote: string;
  bankName: string;
  iban: string;
  qrImagePath: string;
  externalLink: string;
  customInstructions: string;
  useRawInstructions: boolean;
};

const methodTypes: Array<{ value: MethodType; label: string; hint: string }> = [
  { value: "whish", label: "Whish Money", hint: "Name, phone, screenshot note" },
  { value: "omt", label: "OMT", hint: "Receiver, phone, branch note" },
  { value: "cash", label: "Cash", hint: "In person or delivery instructions" },
  { value: "bank_transfer", label: "Bank transfer", hint: "Bank, IBAN, receiver" },
  { value: "other", label: "Other", hint: "Custom client instructions" }
];

const typeDefaults: Record<MethodType, Pick<EditorState, "label" | "customInstructions">> = {
  whish: {
    label: "Whish Money",
    customInstructions: "After payment, upload a screenshot here."
  },
  omt: {
    label: "OMT Transfer",
    customInstructions: "Please upload the receipt screenshot after payment."
  },
  cash: {
    label: "Cash",
    customInstructions: "Cash payment accepted in person or on delivery. Please write a note after paying."
  },
  bank_transfer: {
    label: "Bank transfer",
    customInstructions: "Please upload the transfer receipt after payment."
  },
  other: {
    label: "Payment method",
    customInstructions: ""
  }
};

const emptyEditorState: EditorState = {
  type: "whish",
  label: typeDefaults.whish.label,
  isActive: true,
  name: "",
  phone: "",
  account: "",
  branchNote: "",
  bankName: "",
  iban: "",
  qrImagePath: "",
  externalLink: "",
  customInstructions: typeDefaults.whish.customInstructions,
  useRawInstructions: false
};

function normalizeType(type: string | null | undefined): MethodType {
  const normalized = (type || "other").toLowerCase().replaceAll(" ", "_");
  if (normalized === "whish" || normalized === "omt" || normalized === "cash" || normalized === "bank_transfer") return normalized;
  return "other";
}

function needsDetails(method: PaymentMethod) {
  const text = `${method.label}\n${method.instructions}`.toLowerCase();
  return (
    method.instructions.trim().length < 12 ||
    /(^|\n)\s*(name|phone|bank|iban|account name|receiver name):\s*($|\n)/i.test(method.instructions) ||
    text.includes("todo") ||
    text.includes("replace")
  );
}

function buildInstructions(state: EditorState) {
  if (state.useRawInstructions) {
    return state.customInstructions;
  }

  if (state.type === "whish") {
    return [
      "Send via Whish Money to:",
      state.name ? `Name: ${state.name}` : "",
      state.phone ? `Phone: ${state.phone}` : "",
      state.customInstructions
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (state.type === "omt") {
    return [
      "Send via OMT to:",
      state.name ? `Receiver name: ${state.name}` : "",
      state.phone ? `Phone: ${state.phone}` : "",
      state.branchNote ? `Branch note: ${state.branchNote}` : "",
      state.customInstructions
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (state.type === "cash") {
    return state.customInstructions;
  }

  if (state.type === "bank_transfer") {
    return [
      "Transfer to:",
      state.bankName ? `Bank: ${state.bankName}` : "",
      state.iban ? `IBAN/account: ${state.iban}` : "",
      state.name ? `Receiver name: ${state.name}` : "",
      state.customInstructions
    ]
      .filter(Boolean)
      .join("\n");
  }

  return state.customInstructions;
}

function editorStateFromMethod(method?: PaymentMethod): EditorState {
  if (!method) return emptyEditorState;

  return {
    ...emptyEditorState,
    type: normalizeType(method.type),
    label: method.label,
    isActive: method.is_active,
    name: method.receiver_name || "",
    phone: method.receiver_phone || "",
    account: method.account_reference || "",
    qrImagePath: method.qr_image_path || "",
    externalLink: method.external_link || "",
    customInstructions: method.instructions,
    useRawInstructions: true
  };
}

function createFormData(method: PaymentMethod | undefined, state: EditorState) {
  const formData = new FormData();
  if (method) formData.append("id", method.id);
  formData.append("type", state.type);
  formData.append("label", state.label);
  formData.append("instructions", buildInstructions(state));
   // Optional Whish / OMT / bank metadata used on public pages
  formData.append("receiver_name", state.name || "");
  formData.append("receiver_phone", state.phone || "");
  formData.append("account_reference", state.account || "");
  formData.append("qr_image_path", state.qrImagePath || "");
  formData.append("external_link", state.externalLink || "");
  if (state.isActive) formData.append("is_active", "on");
  return formData;
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      <p className="mt-1 truncate text-sm text-slate-500">{detail}</p>
    </div>
  );
}

function PaymentMethodEditor({
  method,
  mode,
  onCancel,
  onSaved
}: {
  method?: PaymentMethod;
  mode: EditorMode;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, setState] = useState(() => editorStateFromMethod(method));
  const [isPending, startTransition] = useTransition();
  const preview = buildInstructions(state);

  const updateState = (updates: Partial<EditorState>) => setState((current) => ({ ...current, ...updates }));

  const selectType = (type: MethodType) => {
    const defaults = typeDefaults[type];
    setState((current) => ({
      ...current,
      type,
      useRawInstructions: false,
      label: mode === "create" || current.label === typeDefaults[current.type].label ? defaults.label : current.label,
      customInstructions: mode === "create" || current.customInstructions === typeDefaults[current.type].customInstructions
        ? defaults.customInstructions
        : current.customInstructions
    }));
  };

  const save = () => {
    startTransition(async () => {
      try {
        const formData = createFormData(method, state);
        if (mode === "edit") {
          await updatePaymentMethodAction(formData);
          toast.success("Payment method updated.");
        } else {
          await createPaymentMethodAction(formData);
          toast.success("Payment method added.");
        }
        onSaved();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save payment method.");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft lg:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cedar">{mode === "edit" ? "Edit method" : "New method"}</p>
          <h2 className="mt-1 text-lg font-bold text-ink">{mode === "edit" ? state.label : "Add a payment method"}</h2>
        </div>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-4 w-4" aria-hidden="true" />
          Cancel
        </Button>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Method type</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {methodTypes.map((option) => (
                <button
                  key={option.value}
                  className={cn(
                    "rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-cedar/30 hover:bg-cedar/5",
                    state.type === option.value ? "border-cedar bg-cedar/10 shadow-soft" : "border-slate-200 bg-white"
                  )}
                  onClick={() => selectType(option.value)}
                  type="button"
                >
                  <PaymentMethodIcon type={option.value} size="sm" />
                  <span className="mt-3 block text-sm font-bold text-ink">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{option.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-700">Label</span>
              <Input value={state.label} onChange={(event) => updateState({ label: event.target.value })} placeholder="Whish Money" />
            </label>

            {(state.type === "whish" || state.type === "omt" || state.type === "bank_transfer") && (
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">{state.type === "omt" ? "Receiver name" : "Name"}</span>
                <Input value={state.name} onChange={(event) => updateState({ name: event.target.value, useRawInstructions: false })} placeholder="Name clients should use" />
              </label>
            )}

            {(state.type === "whish" || state.type === "omt") && (
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Phone / wallet number</span>
                <Input
                  value={state.phone}
                  onChange={(event) => updateState({ phone: event.target.value, useRawInstructions: false })}
                  placeholder="+961 ..."
                />
              </label>
            )}

            {state.type === "omt" && (
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Branch note optional</span>
                <Input value={state.branchNote} onChange={(event) => updateState({ branchNote: event.target.value, useRawInstructions: false })} placeholder="Any OMT branch, or preferred branch" />
              </label>
            )}

            {state.type === "bank_transfer" && (
              <>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Bank name</span>
                  <Input value={state.bankName} onChange={(event) => updateState({ bankName: event.target.value, useRawInstructions: false })} placeholder="Bank name" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">IBAN/account</span>
                  <Input value={state.iban} onChange={(event) => updateState({ iban: event.target.value, useRawInstructions: false })} placeholder="IBAN or account number" />
                </label>
              </>
            )}
          </div>

          {(state.type === "whish" || state.type === "omt") && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Account / reference (optional)</span>
                <Input
                  value={state.account}
                  onChange={(event) => updateState({ account: event.target.value })}
                  placeholder="Account or reference clients should use"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">QR image URL (optional)</span>
                <Input
                  value={state.qrImagePath}
                  onChange={(event) => updateState({ qrImagePath: event.target.value })}
                  placeholder="Public URL to a QR image"
                />
              </label>
              {state.type === "omt" && (
                <label className="grid gap-2 md:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">Payment link (optional)</span>
                  <Input
                    value={state.externalLink}
                    onChange={(event) => updateState({ externalLink: event.target.value })}
                    placeholder="Client-facing OMT payment link"
                  />
                </label>
              )}
            </div>
          )}

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-700">Client instructions</span>
            <textarea
              className="field min-h-28"
              value={state.customInstructions}
              onChange={(event) => updateState({ customInstructions: event.target.value })}
              placeholder="Tell clients exactly what to do after paying."
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-sm font-semibold text-slate-700">
            <input checked={state.isActive} onChange={(event) => updateState({ isActive: event.target.checked })} type="checkbox" />
            Active on public invoice pages
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-center gap-3">
            <PaymentMethodIcon type={state.type} />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Client will see this</p>
              <h3 className="truncate text-base font-bold text-ink">{state.label || "Payment method"}</h3>
            </div>
          </div>
          <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
            {preview || "Add instructions to preview the public payment guidance."}
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={save} disabled={isPending || !state.label.trim() || !preview.trim()}>
              {mode === "edit" ? "Save changes" : "Add method"}
            </Button>
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(preview).then(() => toast.success("Instructions copied."))} disabled={!preview.trim()}>
              <Clipboard className="h-4 w-4" aria-hidden="true" />
              Copy instructions
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentMethodCard({
  method,
  isDefault,
  onEdit,
  onChanged
}: {
  method: PaymentMethod;
  isDefault: boolean;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const detailsMissing = needsDetails(method);

  const submit = (action: "toggle" | "delete" | "default") => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("id", method.id);

        if (action === "delete") {
          await deletePaymentMethodAction(formData);
          toast.success("Payment method deleted.");
        }

        if (action === "default") {
          await setDefaultPaymentMethodAction(formData);
          toast.success("Default payment method updated.");
        }

        if (action === "toggle") {
          formData.append("type", method.type);
          formData.append("label", method.label);
          formData.append("instructions", method.instructions);
          if (!method.is_active) formData.append("is_active", "on");
          await updatePaymentMethodAction(formData);
          toast.success(method.is_active ? "Payment method deactivated." : "Payment method activated.");
        }

        onChanged();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update payment method.");
      }
    });
  };

  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-cedar/20 lg:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <PaymentMethodIcon type={method.type} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-bold text-ink">{method.label}</h3>
              <Badge variant="outline" className={method.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}>
                {method.is_active ? "Active" : "Inactive"}
              </Badge>
              {isDefault ? <Badge className="bg-cedar text-white">Default</Badge> : null}
              {detailsMissing ? <Badge variant="outline" className="bg-amber-50 text-amber-700">Needs details</Badge> : null}
            </div>
            <p className="mt-1 text-sm font-medium text-slate-500">{getPaymentMethodLabel(method.type)}</p>
          </div>
        </div>
        <CreditCard className="hidden h-5 w-5 text-slate-300 transition group-hover:text-cedar sm:block" aria-hidden="true" />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Visible instructions</p>
        <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-slate-700">{method.instructions}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Edit3 className="h-4 w-4" aria-hidden="true" />
          Edit
        </Button>
        <Button size="sm" variant="outline" onClick={() => submit("default")} disabled={isPending || isDefault}>
          <Star className="h-4 w-4" aria-hidden="true" />
          Set default
        </Button>
        <Button size="sm" variant="outline" onClick={() => submit("toggle")} disabled={isPending}>
          {method.is_active ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {method.is_active ? "Deactivate" : "Activate"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-red-200 text-red-700 hover:bg-red-50"
          onClick={() => window.confirm("Delete this payment method?") && submit("delete")}
          disabled={isPending}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </Button>
      </div>
    </article>
  );
}

export function PaymentMethodsManager({ methods }: { methods: PaymentMethod[] }) {
  const router = useRouter();
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(methods.length === 0);

  const sortedMethods = useMemo(
    () => [...methods].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [methods]
  );
  const defaultMethod = sortedMethods.find((method) => method.is_active);
  const editingMethod = methods.find((method) => method.id === editingMethodId);
  const activeCount = methods.filter((method) => method.is_active).length;
  const needsDetailsCount = methods.filter(needsDetails).length;

  const refresh = () => {
    setIsCreating(false);
    setEditingMethodId(null);
    router.refresh();
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button onClick={() => { setEditingMethodId(null); setIsCreating(true); }}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New method
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Active methods" value={activeCount.toLocaleString()} detail={`${methods.length.toLocaleString()} total methods`} />
        <StatCard label="Default method" value={defaultMethod?.label || "None"} detail={defaultMethod ? "Shown first on public invoices" : "Activate a method to show payment instructions"} />
        <StatCard label="Needing details" value={needsDetailsCount.toLocaleString()} detail={needsDetailsCount ? "Review placeholders or short instructions" : "All method instructions look ready"} />
      </div>

      {isCreating ? (
        <PaymentMethodEditor mode="create" onCancel={() => setIsCreating(false)} onSaved={refresh} />
      ) : null}

      {editingMethod ? (
        <PaymentMethodEditor method={editingMethod} mode="edit" onCancel={() => setEditingMethodId(null)} onSaved={refresh} />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        {sortedMethods.length === 0 ? (
          <PremiumEmptyState
            title="No payment methods yet"
            description="Add the payment instructions clients will see before uploading proof."
            guidance={[
              "Start with the method your clients already use most often.",
              "Include receiver name, phone, and a short instruction to upload proof after payment.",
              "Qaffel publishes instructions only; it does not collect or approve payments automatically."
            ]}
            example="Example: Whish with your registered name and mobile number, plus upload screenshot after payment."
            icon={<CheckCircle2 className="h-6 w-6" aria-hidden="true" />}
            action={
              <Button type="button" onClick={() => { setEditingMethodId(null); setIsCreating(true); }}>
                Start adding a method
              </Button>
            }
          />
        ) : (
          sortedMethods.map((method) => (
            <PaymentMethodCard
              key={method.id}
              method={method}
              isDefault={defaultMethod?.id === method.id}
              onEdit={() => { setIsCreating(false); setEditingMethodId(method.id); }}
              onChanged={refresh}
            />
          ))
        )}
      </section>
    </div>
  );
}
