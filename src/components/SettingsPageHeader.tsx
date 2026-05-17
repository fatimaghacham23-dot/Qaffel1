import type { ReactNode } from "react";

type SettingsPageHeaderProps = {
  title: string;
  subtitle: string;
  action?: ReactNode;
};

export function SettingsPageHeader({ title, subtitle, action }: SettingsPageHeaderProps) {
  return (
    <div className="q-elevated mb-8 flex flex-wrap items-start justify-between gap-5 bg-white/[0.72] p-6 backdrop-blur-md sm:p-7">
      <div className="min-w-0 flex-1">
        <p className="q-section-label mb-2 text-slate-500">Workspace</p>
        <h1 className="page-title">{title}</h1>
        <p className="q-subtitle mt-2.5 max-w-2xl">{subtitle}</p>
      </div>
      {action ? <div className="shrink-0 self-start">{action}</div> : null}
    </div>
  );
}
