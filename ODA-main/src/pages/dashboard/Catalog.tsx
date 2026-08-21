import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/oda/bits";
import { Library, Search, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

export default function Catalog() {
  const items = useQuery(api.catalog.list);
  const seed = useMutation(api.catalog.seed);
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    if (items !== undefined && items.length === 0) void seed();
  }, [items, seed]);

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

  const start = (item: { name: string; starterText: string }) => {
    navigate("/dashboard/ingest", {
      state: {
        compose: {
          title: `${item.name} — my draft`,
          text: item.starterText,
        },
      },
    });
  };

  return (
    <div>
      <PageHeader
        eyebrow="The ODA Catalog"
        title="What would you like to file?"
        description="Every document type the office accepts, ready to start from. Pick one, and ODA opens a composer prefilled with the right structure — you fill in the specifics."
        action={
          <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/8 px-3.5 py-2">
            <Sparkles className="size-4 text-primary" />
            <p className="text-[12px] text-foreground/85">
              <span className="font-semibold text-primary">{items?.length ?? "…"}</span> document types
            </p>
          </div>
        }
      />

      {/* Search + categories */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the catalog — 'complaint', 'leave', 'invoice'…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
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

      {items === undefined && (
        <p className="py-16 text-center text-[13px] text-muted-foreground">Filing the catalog…</p>
      )}
      {items !== undefined && filtered.length === 0 && (
        <EmptyState
          icon={Search}
          title="Nothing on this shelf"
          body="No catalog entries match your search. Try a different term — or check back soon as new document types are added."
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => (
          <div
            key={item._id}
            className="group relative flex flex-col rounded-2xl border border-border/70 bg-card/60 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl hover:shadow-black/30"
          >
            {item.featured && (
              <span className="absolute -top-2 right-4 rounded-full border border-coral/50 bg-card px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-coral shadow-sm">
                ✦ Featured
              </span>
            )}
            <div className="flex items-start justify-between">
              <span className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-2xl transition-transform duration-300 group-hover:scale-110">
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
            <Button
              size="sm"
              variant="outline"
              className="mt-5 w-full gap-1.5 transition-colors group-hover:border-coral/50 group-hover:bg-coral/8 group-hover:text-coral"
              onClick={() => start(item)}
            >
              <Wand2 className="size-3.5" />
              Start from template
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-card/30 px-4 py-4 text-center">
        <Library className="size-4 text-primary/70" />
        <p className="text-[12.5px] text-muted-foreground">
          Don&apos;t see your document type? Compose it freehand in the composer — ODA adapts to
          anything.
        </p>
      </div>
    </div>
  );
}
