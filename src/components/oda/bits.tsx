import { Button } from "@/components/ui/button";
import { ratingMeta } from "@/lib/oda/rating";
import { ArrowRight, BadgeCheck, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

const FORMAT_COLORS: Record<string, string> = {
  pdf: "oklch(0.72 0.16 25)",
  docx: "oklch(0.7 0.13 240)",
  doc: "oklch(0.7 0.13 240)",
  odt: "oklch(0.7 0.13 240)",
  rtf: "oklch(0.7 0.13 240)",
  txt: "oklch(0.68 0.02 250)",
  md: "oklch(0.68 0.02 250)",
  csv: "oklch(0.72 0.15 160)",
  tsv: "oklch(0.72 0.15 160)",
  xlsx: "oklch(0.72 0.15 160)",
  xls: "oklch(0.72 0.15 160)",
  pptx: "oklch(0.75 0.15 55)",
  ppt: "oklch(0.75 0.15 55)",
  png: "oklch(0.7 0.14 300)",
  jpg: "oklch(0.7 0.14 300)",
  jpeg: "oklch(0.7 0.14 300)",
  tiff: "oklch(0.7 0.14 300)",
  webp: "oklch(0.7 0.14 300)",
  zip: "oklch(0.72 0.14 85)",
  rar: "oklch(0.72 0.14 85)",
  "7z": "oklch(0.72 0.14 85)",
  tar: "oklch(0.72 0.14 85)",
  eml: "oklch(0.68 0.12 200)",
  msg: "oklch(0.68 0.12 200)",
  html: "oklch(0.7 0.13 215)",
  htm: "oklch(0.7 0.13 215)",
  json: "oklch(0.68 0.02 250)",
  xml: "oklch(0.68 0.02 250)",
  latex: "oklch(0.68 0.02 250)",
  sample: "oklch(0.78 0.125 85)",
};

/**
 * Per-letter translation rating badge (reference / complete / partial) — the
 * intelligent reference-standard decision made per letter. The tooltip carries
 * the score and the honest note from the rater.
 */
export function TranslationRatingBadge({
  rating,
  note,
  score,
}: {
  rating: string;
  note?: string;
  score?: number;
}) {
  const meta = ratingMeta(rating);
  return (
    <span
      title={`${meta.label}${typeof score === "number" ? ` · ${score}/100` : ""}${note ? ` — ${note}` : ""}`}
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] font-medium"
      style={{
        color: meta.color,
        borderColor: `color-mix(in oklab, ${meta.color} 45%, transparent)`,
        background: `color-mix(in oklab, ${meta.color} 12%, transparent)`,
      }}
    >
      <BadgeCheck className="size-3" />
      {meta.label}
    </span>
  );
}

export function FormatBadge({ format, className = "" }: { format: string; className?: string }) {
  const color = FORMAT_COLORS[format] ?? "oklch(0.68 0.02 250)";
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide ${className}`}
      style={{ color, borderColor: `color-mix(in oklab, ${color} 40%, transparent)`, background: `color-mix(in oklab, ${color} 12%, transparent)` }}
    >
      {format}
    </span>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "oklch(0.78 0.125 85)",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 p-5">
      <div className="flex items-center justify-between">
        <p className="oda-label !text-[10px]">{label}</p>
        <div
          className="flex size-8 items-center justify-center rounded-lg"
          style={{ background: `color-mix(in oklab, ${accent} 14%, transparent)`, color: accent }}
        >
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="oda-label mb-1.5">{eyebrow}</p>
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-[34px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[13.5px] leading-6 text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  cta,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  cta?: { to: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border/70 bg-card/30 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-5 font-display text-xl font-medium">{title}</h3>
      <p className="mt-2 max-w-sm text-[13.5px] leading-6 text-muted-foreground">{body}</p>
      {cta && (
        <Link to={cta.to} className="mt-6">
          <Button className="gap-2">
            {cta.label}
            <ArrowRight className="size-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}
