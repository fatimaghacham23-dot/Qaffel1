import type { ReactNode } from "react";

type SettingsPageHeaderProps = {
  title: string;
  subtitle: string;
  action?: ReactNode;
};

export function SettingsPageHeader({ title, subtitle, action }: SettingsPageHeaderProps) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-5 rounded-3xl border border-slate-200/65 bg-white/[0.72] p-6 shadow-card backdrop-blur-md sm:p-7">
      <div className="min-w-0 flex-1">
        <p className="q-section-label mb-1.5 text-slate-500">Workspace</p>
        <h1 className="page-title">{title}</h1>
        <p className="q-subtitle mt-2 max-w-2xl">{subtitle}</p>
      </div>
      {action ? <div className="shrink-0 self-start">{action}</div> : null}
    </div>
  );
}
