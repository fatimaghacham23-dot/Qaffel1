import { Mail, Globe, AtSign, MessageCircle, Clock, MapPin } from "lucide-react";

function cleanIg(h: string | null | undefined) {
  if (!h) return "";
  return h.replace(/^@+/, "").trim();
}

export function BusinessContactStrip({
  supportEmail,
  website,
  instagram,
  whatsappPhone,
  businessHours,
  city
}: {
  supportEmail?: string | null;
  website?: string | null;
  instagram?: string | null;
  whatsappPhone?: string | null;
  businessHours?: string | null;
  city?: string | null;
}) {
  const ig = cleanIg(instagram || "");
  const wa = (whatsappPhone || "").replace(/\D/g, "");
  const web = (website || "").trim();

  const items: { key: string; node: React.ReactNode }[] = [];
  if (web) {
    const href = web.startsWith("http") ? web : `https://${web}`;
    items.push({
      key: "web",
      node: (
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline-offset-2 hover:underline">
          <Globe className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          Website
        </a>
      )
    });
  }
  if (ig) {
    items.push({
      key: "ig",
      node: (
        <a
          href={`https://instagram.com/${encodeURIComponent(ig)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline-offset-2 hover:underline"
        >
          <AtSign className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          @{ig}
        </a>
      )
    });
  }
  if (wa) {
    items.push({
      key: "wa",
      node: (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-900 underline-offset-2 hover:underline"
        >
          <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
          WhatsApp
        </a>
      )
    });
  }
  if (supportEmail?.trim()) {
    items.push({
      key: "mail",
      node: (
        <a href={`mailto:${encodeURIComponent(supportEmail.trim())}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline-offset-2 hover:underline">
          <Mail className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          {supportEmail.trim()}
        </a>
      )
    });
  }
  if (businessHours?.trim()) {
    items.push({
      key: "hours",
      node: (
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
          <Clock className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          {businessHours.trim()}
        </span>
      )
    });
  }
  if (city?.trim()) {
    items.push({
      key: "city",
      node: (
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
          <MapPin className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          {city.trim()}
        </span>
      )
    });
  }

  if (!items.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Business contact</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{items.map((i) => <span key={i.key}>{i.node}</span>)}</div>
    </div>
  );
}
