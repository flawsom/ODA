import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Languages,
  PenLine,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";

function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden>
      <rect x="1" y="1" width="38" height="38" rx="9" className="stroke-primary/70" strokeWidth="1.4" />
      <path d="M12 27V15.5L20 22L28 15.5V27" className="stroke-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 27H31" className="stroke-primary/70" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const ODA_BEHAVIOR = [
  {
    icon: Wand2,
    text: "Mirrors the document's structure and register — formal stays formal, urgent stays urgent.",
  },
  {
    icon: FileText,
    text: "Quotes the subject, reference numbers and dates so the reply slots straight into the file.",
  },
  {
    icon: Languages,
    text: "Drafts in 24 languages, honouring local honorifics, date formats and address order.",
  },
  {
    icon: Zap,
    text: "Exports as DOCX, HTML, TXT, Markdown or JSON — ready for print, email or record.",
  },
];

export default function CatalogItem() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const item = useQuery(api.catalog.get, { id: id! as Id<"catalogItems"> });
  const all = useQuery(api.catalog.list);

  if (item === undefined || all === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[13px] text-muted-foreground">Opening the filing…</p>
      </div>
    );
  }

  if (item === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-2xl font-medium">No such filing.</p>
        <p className="mt-2 max-w-sm text-[13px] text-muted-foreground">
          This catalog entry doesn&apos;t exist — or it was curated off the shelves.
        </p>
        <button onClick={() => navigate("/catalog")} className="mt-5 text-[13px] font-medium text-primary hover:underline">
          ← Back to the catalog
        </button>
      </div>
    );
  }

  const related = all
    .filter((i) => i.category === item.category && i._id !== item._id)
    .slice(0, 3);

  const start = () => {
    try {
      sessionStorage.setItem(
        "oda-compose",
        JSON.stringify({
          title: `${item.name} — my draft`,
          text: item.starterText,
        }),
      );
    } catch {
      /* storage unavailable — the composer still opens empty */
    }
    if (isAuthenticated) {
      navigate("/dashboard/ingest", {
        state: { compose: { title: `${item.name} — my draft`, text: item.starterText } },
      });
    } else {
      navigate("/auth?returnTo=%2Fdashboard%2Fingest");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link to="/" className="group flex items-center gap-3">
            <BrandMark className="size-9 transition-transform group-hover:scale-105" />
            <div className="leading-tight">
              <p className="font-display text-[15px] font-semibold tracking-wide">ODA</p>
              <p className="oda-label !text-[9px]">Omniscient Document Architect</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link to="/dashboard/catalog">
                <Button size="sm" className="text-[13px]">
                  Your workspace
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
              </Link>
            ) : (
              <Link to="/auth?returnTo=%2Fdashboard">
                <Button size="sm" className="text-[13px]">
                  Start free
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-5 pb-24 pt-28 lg:px-8">
        <div className="oda-grid-bg oda-fade-to-bg absolute inset-0" aria-hidden />

        <div className="relative">
          <Link
            to="/catalog"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to the catalog
          </Link>

          {/* Header */}
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-card/60 text-4xl transition-transform hover:-rotate-6 hover:scale-105">
              {item.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {item.category}
                </span>
                {item.featured && (
                  <span className="rounded border border-coral/50 bg-card px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-coral">
                    ✦ Featured
                  </span>
                )}
              </div>
              <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">
                {item.name}
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">
                {item.description}
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="mt-12 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
            {/* Starter template */}
            <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/50">
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <PenLine className="size-4 text-primary" />
                  <span className="text-[13.5px] font-semibold">The starter template</span>
                </div>
                <span className="oda-label !text-[9px]">fill the [brackets]</span>
              </div>
              <pre className="max-h-[480px] overflow-y-auto whitespace-pre-wrap p-6 font-serif text-[13.5px] leading-7 text-foreground/85">
                {item.starterText}
              </pre>
            </section>

            {/* What ODA does */}
            <div className="space-y-6">
              <section className="rounded-2xl border border-primary/25 bg-card/50 p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h2 className="text-[14px] font-semibold">What ODA does with it</h2>
                </div>
                <ul className="mt-4 space-y-4">
                  {ODA_BEHAVIOR.map((b) => (
                    <li key={b.text} className="flex items-start gap-3">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                        <b.icon className="size-3.5" />
                      </div>
                      <p className="text-[12.5px] leading-5.5 text-foreground/85">{b.text}</p>
                    </li>
                  ))}
                </ul>
                <Button className="mt-6 w-full gap-2" onClick={start}>
                  <Wand2 className="size-4" />
                  {isAuthenticated ? "Start from this template" : "Sign in & start free"}
                </Button>
                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  Free forever — no card, no keys, no meter.
                </p>
              </section>

              <section className="rounded-2xl border border-border/70 bg-card/50 p-5">
                <h2 className="text-[13.5px] font-semibold">Then what?</h2>
                <ol className="mt-4 space-y-3">
                  {[
                    "Sign in and open the composer, pre-filled with this template.",
                    "Swap the [brackets] for your own facts — or paste your actual letter.",
                    "ODA reads it, classifies it, and drafts the perfect reply.",
                    "Export the reply as DOCX, HTML, TXT, Markdown or JSON.",
                  ].map((step, i) => (
                    <li key={step} className="flex items-start gap-3 text-[12.5px] leading-5.5 text-foreground/85">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-mono text-[10px] text-primary">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </div>

          {/* Related */}
          {related.length > 0 && (
            <section className="mt-14">
              <h2 className="font-display text-xl font-medium tracking-tight">
                More from the {item.category} shelf
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {related.map((r) => (
                  <button
                    key={r._id}
                    onClick={() => navigate(`/catalog/${r._id}`)}
                    className="group rounded-2xl border border-border/70 bg-card/50 p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40"
                  >
                    <span className="text-2xl transition-transform duration-300 group-hover:scale-110">{r.emoji}</span>
                    <p className="mt-3 text-[13.5px] font-semibold">{r.name}</p>
                    <p className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                      {r.description}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
