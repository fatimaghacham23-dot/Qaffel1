import type { ReactNode } from "react";

type SettingsPageHeaderProps = {
  title: string;
  subtitle: string;
  action?: ReactNode;
};

export function SettingsPageHeader({ title, subtitle, action }: SettingsPageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="page-title">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{subtitle}</p>
      </div>
      {action ? <div className="shrink-0 self-start">{action}</div> : null}
    </div>
  );
}
