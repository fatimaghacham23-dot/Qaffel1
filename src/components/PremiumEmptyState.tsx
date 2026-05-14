import type { ReactNode } from "react";

type PremiumEmptyStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  /** Short hint, example naming, or workflow context. */
  example?: string;
  /** Compact onboarding steps for empty operational surfaces. */
  guidance?: string[];
};

export function PremiumEmptyState({ title, description, icon, action, example, guidance }: PremiumEmptyStateProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-dashed border-slate-300/80 bg-white/82 px-6 py-10 text-center shadow-card transition-[box-shadow,border-color,transform] duration-q ease-q hover:border-slate-400/70 hover:shadow-card-hover motion-reduce:transition-none sm:px-10 sm:py-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cedar/25 to-transparent opacity-70" aria-hidden="true" />
      {icon ? (
        <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-slate-200/80 bg-slate-50/80 text-slate-500 shadow-sm ring-1 ring-white transition-[transform,box-shadow,color] duration-q ease-q group-hover:-translate-y-0.5 group-hover:text-cedar group-hover:shadow-md motion-reduce:group-hover:translate-y-0">
          <span className="[&>svg]:h-7 [&>svg]:w-7">{icon}</span>
        </div>
      ) : null}
      <p className="relative mt-5 text-base font-semibold tracking-tight text-ink">{title}</p>
      <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">{description}</p>
      {guidance && guidance.length > 0 ? (
        <ul className="relative mx-auto mt-4 grid max-w-md gap-2 text-left text-xs leading-5 text-slate-600">
          {guidance.map((item) => (
            <li key={item} className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-2.5 shadow-sm">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      {example ? (
        <p className="relative mx-auto mt-4 max-w-md rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-2.5 text-left text-xs leading-snug text-slate-600 shadow-sm">
          {example}
        </p>
      ) : null}
      {action ? <div className="relative mt-6 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
