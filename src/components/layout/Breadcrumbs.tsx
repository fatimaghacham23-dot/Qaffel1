import Link from "next/link";

type Breadcrumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Breadcrumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex items-center gap-x-2">
          {index > 0 ? <span aria-hidden="true" className="text-slate-300">/</span> : null}
          {item.href ? <Link className="rounded-md font-medium text-cedar hover:text-cedar/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cedar focus-visible:ring-offset-2" href={item.href}>{item.label}</Link> : <span aria-current={index === items.length - 1 ? "page" : undefined} className="font-medium text-slate-600">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}