import type { ReactNode } from "react";

type PremiumEmptyStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  /** Short hint (e.g. example naming or workflow) — optional */
  example?: string;
};

export function PremiumEmptyState({ title, description, icon, action, example }: PremiumEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      {icon ? <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-50 text-slate-400">{icon}</div> : null}
      <p className="mt-4 text-sm font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p>
      {example ? <p className="mx-auto mt-3 max-w-md rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{example}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
