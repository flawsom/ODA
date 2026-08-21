import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Library, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden>
      <rect x="1" y="1" width="38" height="38" rx="9" className="stroke-primary/70" strokeWidth="1.4" />
      <path d="M12 27V15.5L20 22L28 15.5V27" className="stroke-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 27H31" className="stroke-primary/70" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function Catalog() {
  const items = useQuery(api.catalog.list);
  const seedCatalog = useMutation(api.catalog.seed);
  const { isAuthenticated } = useAuth();

  // A fresh deployment starts with an empty shelf — stock it lazily from the
  // public page so visitors never see an empty catalog (seed is idempotent).
  useEffect(() => {
    if (items !== undefined && items.length === 0) void seedCatalog();
  }, [items, seedCatalog]);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const categories = useMemo(
    () => ["All", ...new Set((items ?? []).map((i) => i.category))],
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items ?? []).filter((i) => {
      const matchQ =
        !q ||
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q);
      const matchC = category === "All" || i.category === category;
      return matchQ && matchC;
    });
  }, [items, search, category]);

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
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm" className="text-[13px]">
                    Sign in
                  </Button>
                </Link>
                <Link to="/auth?returnTo=%2Fdashboard">
                  <Button size="sm" className="text-[13px]">
                    Start free
                    <ArrowRight className="ml-1.5 size-3.5" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-5 pb-24 pt-28 lg:px-8">
        <div className="oda-grid-bg oda-fade-to-bg absolute inset-0" aria-hidden />

        <div className="relative">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5">
              <Library className="size-3.5 text-primary" />
              <span className="oda-label !text-[10px] !text-primary">
                The catalog · free to browse
              </span>
            </div>
            <h1 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
              What would you like to <em className="font-light italic text-primary">file</em>?
            </h1>
            <p className="mt-5 text-[15px] leading-7 text-muted-foreground">
              Every document type the office accepts, each with a starter template that already
              speaks the institution&apos;s language. Pick one, fill in the specifics, and ODA
              takes it from there.
            </p>
          </div>

          {/* Search + categories */}
          <div className="mx-auto mt-10 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search the catalog — 'complaint', 'leave', 'invoice'…"
                className="h-12 pl-10 text-[14px]"
              />
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                    category === c
                      ? "border-primary/50 bg-primary/12 text-primary"
                      : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          {items === undefined && (
            <p className="mt-16 text-center text-[13px] text-muted-foreground">
              Dusting off the shelves…
            </p>
          )}
          {items !== undefined && filtered.length === 0 && (
            <div className="mt-16 text-center">
              <p className="text-[15px] font-medium">Nothing on this shelf — yet.</p>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-muted-foreground">
                No catalog entries match your search. Try a different term, or sign in and
                compose your document freehand — ODA adapts to anything.
              </p>
              {!isAuthenticated && (
                <Link to="/auth?returnTo=%2Fdashboard" className="mt-5 inline-block">
                  <Button>
                    Compose freehand
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                </Link>
              )}
            </div>
          )}

          <div className="relative mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => (
              <Link
                key={item._id}
                to={`/catalog/${item._id}`}
                className="group flex flex-col rounded-2xl border border-border/70 bg-card/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-black/30"
              >
                <div className="flex items-start justify-between">
                  <span className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                    {item.emoji}
                  </span>
                  <span className="rounded border border-border/60 bg-muted/30 px-2 py-0.5 text-[10.5px] text-muted-foreground">
                    {item.category}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-[17px] font-medium tracking-tight">
                  {item.name}
                </h3>
                <p className="mt-2 flex-1 text-[12.5px] leading-5.5 text-muted-foreground">
                  {item.description}
                </p>
                <span className="mt-5 flex items-center gap-1.5 text-[12.5px] font-medium text-primary">
                  Open the filing
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>

          {/* Free promise strip */}
          <div className="relative mt-14 flex flex-col items-center justify-between gap-4 rounded-2xl border border-primary/25 bg-primary/8 px-6 py-5 sm:flex-row">
            <div className="flex items-center gap-3">
              <Sparkles className="size-5 shrink-0 text-primary" />
              <p className="text-[13px] leading-5 text-foreground/85">
                <span className="font-semibold text-primary">Free forever.</span> No credit card,
                no API keys, no usage meter — the archivist works for pocket money, and pocket
                money is free.
              </p>
            </div>
            {!isAuthenticated && (
              <Link to="/auth?returnTo=%2Fdashboard" className="shrink-0">
                <Button className="gap-2">
                  Start free — no card needed
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
