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
    <div className="group relative overflow-hidden rounded-2xl border border-dashed border-slate-200/60 bg-white/80 px-6 py-12 text-center transition-[box-shadow,border-color,transform] motion-reduce:transition-none sm:px-12 sm:py-14" style={{ boxShadow: 'var(--q-shadow-card)', transitionDuration: 'var(--q-duration-normal)', transitionTimingFunction: 'var(--q-ease)' }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cedar/20 to-transparent opacity-60" aria-hidden="true" />
      {icon ? (
        <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-slate-200/60 bg-slate-50/60 text-slate-400 shadow-xs ring-1 ring-white transition-[transform,box-shadow,color] group-hover:-translate-y-0.5 group-hover:text-cedar group-hover:shadow-md motion-reduce:group-hover:translate-y-0" style={{ transitionDuration: 'var(--q-duration-normal)', transitionTimingFunction: 'var(--q-ease-spring)' }}>
          <span className="[&>svg]:h-7 [&>svg]:w-7">{icon}</span>
        </div>
      ) : null}
      <p className="relative mt-6 text-base font-semibold tracking-tight text-ink">{title}</p>
      <p className="relative mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-slate-600">{description}</p>
      {guidance && guidance.length > 0 ? (
        <ul className="relative mx-auto mt-5 grid max-w-md gap-2.5 text-left text-xs leading-5 text-slate-600">
          {guidance.map((item) => (
            <li key={item} className="rounded-xl border border-slate-200/50 bg-slate-50/50 px-4 py-3 shadow-xs">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      {example ? (
        <p className="relative mx-auto mt-5 max-w-md rounded-xl border border-slate-200/50 bg-slate-50/50 px-4 py-3 text-left text-xs leading-snug text-slate-600 shadow-xs">
          {example}
        </p>
      ) : null}
      {action ? <div className="relative mt-7 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
