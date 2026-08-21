import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, FormatBadge, PageHeader } from "@/components/oda/bits";
import { adaptiveGenerate } from "@/lib/oda/engine";
import { translateAdaptive } from "@/lib/oda/refine";
import { buildOverlay } from "@/lib/oda/extraDict";
import {
  CheckSquare,
  FileText,
  Languages,
  Loader2,
  MoreHorizontal,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

export default function Documents() {
  const documents = useQuery(api.documents.list);
  const remove = useMutation(api.documents.remove);
  const createResponse = useMutation(api.responses.create);
  // User-grown translation memory (Glossary page) — merged over the seed pack
  // so custom sentences/tokens apply to on-device translations too.
  const glossaryRows = useQuery(api.glossary.engineEntries);
  const overlay = useMemo(() => buildOverlay(glossaryRows), [glossaryRows]);
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [translateLang, setTranslateLang] = useState("Hindi");

  const docs = documents ?? [];
  const types = useMemo(
    () => [...new Set(docs.map((d) => d.type).filter(Boolean) as string[])],
    [docs],
  );

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      const q = search.trim().toLowerCase();
      const matchQ =
        !q ||
        d.name.toLowerCase().includes(q) ||
        (d.type ?? "").toLowerCase().includes(q) ||
        (d.language ?? "").toLowerCase().includes(q);
      const matchT = typeFilter === "all" || d.type === typeFilter;
      return matchQ && matchT;
    });
  }, [docs, search, typeFilter]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === filtered.length
        ? new Set()
        : new Set(filtered.map((d) => d._id)),
    );
  };

  const handleDelete = async (id: Id<"documents">) => {
    await remove({ id });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast.success("Document removed from the archive");
  };

  const handleGenerateBatch = async () => {
    const targets = docs.filter((d) => selected.has(d._id));
    if (targets.length === 0) return;
    setGenerating(true);
    let ok = 0;
    for (let i = 0; i < targets.length; i++) {
      const doc = targets[i];
      setProgress(`Forging ${i + 1} of ${targets.length} — ${doc.name.slice(0, 44)}…`);
      try {
        // Forged on-device, then archived — no network calls for the thinking.
        const res = adaptiveGenerate(doc, {
          language: doc.language ?? "English",
          formality: "Match Input",
          format: "Markdown",
        });
        await createResponse({
          documentId: doc._id,
          documentName: doc.name,
          content: res.content,
          language: doc.language ?? "English",
          formality: "Match Input",
          format: "Markdown",
          strategy: res.strategy,
          kind: "response",
          sourceFormat: doc.format,
        });
        ok++;
      } catch (err) {
        toast.error(
          `Failed for ${doc.name}: ${err instanceof Error ? err.message : "unknown error"}`,
        );
      }
    }
    setGenerating(false);
    setProgress(null);
    setSelected(new Set());
    if (ok > 0) {
      toast.success(`Forged ${ok} response${ok > 1 ? "s" : ""} — ready for dispatch`);
      navigate("/dashboard/responses");
    }
  };

  const handleTranslateBatch = async () => {
    const targets = docs.filter((d) => selected.has(d._id));
    if (targets.length === 0) return;
    setGenerating(true);
    let ok = 0;
    for (let i = 0; i < targets.length; i++) {
      const doc = targets[i];
      setProgress(`Translating ${i + 1} of ${targets.length} — ${doc.name.slice(0, 44)}…`);
      try {
        // Structure-preserving formal translation, on-device, free forever.
        const res = translateAdaptive(
          doc,
          {
            language: translateLang,
            formality: "Formal",
            format: "Same as original",
          },
          overlay,
        );
        await createResponse({
          documentId: doc._id,
          documentName: doc.name,
          content: res.content,
          language: translateLang,
          formality: "Formal",
          format: "Same as original",
          strategy: res.strategy,
          kind: "translation",
          sourceFormat: doc.format,
        });
        ok++;
      } catch (err) {
        toast.error(
          `Failed for ${doc.name}: ${err instanceof Error ? err.message : "unknown error"}`,
        );
      }
    }
    setGenerating(false);
    setProgress(null);
    setSelected(new Set());
    if (ok > 0) {
      toast.success(`Translated ${ok} document${ok > 1 ? "s" : ""} into ${translateLang}`);
      navigate("/dashboard/responses");
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Pillar I · The Omni-Viewer"
        title="Documents"
        description="Everything you've filed, classified by type, language and register. Open any document to inspect its layers — or forge its reply in one click."
        action={
          <Link to="/dashboard/ingest">
            <Button className="gap-2">
              <FileText className="size-4" />
              File more
            </Button>
          </Link>
        }
      />

      {/* Selection / generation bar */}
      {selected.size > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/8 px-4 py-3">
          <p className="text-[13px]">
            <span className="font-semibold text-primary">{selected.size}</span> document
            {selected.size > 1 ? "s" : ""} selected
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={handleGenerateBatch}
              disabled={generating}
              className="gap-2"
            >
              {generating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {generating ? "Forging…" : `Generate ${selected.size} response${selected.size > 1 ? "s" : ""}`}
            </Button>
            <div className="flex items-center gap-1.5">
              <Select value={translateLang} onValueChange={setTranslateLang}>
                <SelectTrigger className="h-8 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Hindi",
                    "Tamil",
                    "Bengali",
                    "Telugu",
                    "Kannada",
                    "Gujarati",
                    "Marathi",
                    "Spanish",
                    "French",
                    "Arabic",
                    "English",
                  ].map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={handleTranslateBatch}
                disabled={generating}
                className="gap-1.5"
              >
                {generating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Languages className="size-3.5" />
                )}
                {generating
                  ? "Translating…"
                  : `Translate ${selected.size} to ${translateLang}`}
              </Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={generating}>
              Clear
            </Button>
          </div>
        </div>
      )}
      {progress && (
        <p className="mb-4 flex items-center gap-2 font-mono text-[11.5px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin text-primary" />
          {progress}
        </p>
      )}

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, type or language…"
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={toggleAll} title="Select all visible" className="shrink-0">
          <CheckSquare className="size-4" />
        </Button>
      </div>

      {documents === undefined && (
        <p className="py-16 text-center text-[13px] text-muted-foreground">Loading archive…</p>
      )}
      {documents !== undefined && docs.length === 0 && (
        <EmptyState
          icon={FileText}
          title="Your archive is empty"
          body="File a document, compose your own, or load the samples — ODA is ready when you are."
          cta={{ to: "/dashboard/ingest", label: "File a document" }}
        />
      )}
      {docs.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={Search}
          title="Nothing matches"
          body="No documents match your search or filter. Try a different word — or clear the filters and wander."
        />
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onChange={toggleAll}
                      className="accent-[var(--primary)]"
                    />
                  </th>
                  <th className="px-4 py-3.5 font-medium">Document</th>
                  <th className="hidden px-4 py-3.5 font-medium md:table-cell">Type</th>
                  <th className="hidden px-4 py-3.5 font-medium sm:table-cell">Language</th>
                  <th className="px-4 py-3.5 font-medium">Format</th>
                  <th className="hidden px-4 py-3.5 font-medium lg:table-cell">Ingested</th>
                  <th className="w-12 px-4 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((doc) => (
                  <tr
                    key={doc._id}
                    className="group transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(doc._id)}
                        onChange={() => toggle(doc._id)}
                        className="accent-[var(--primary)]"
                      />
                    </td>
                    <td className="max-w-[280px] px-4 py-3">
                      <Link to={`/dashboard/documents/${doc._id}`} className="block">
                        <p className="truncate font-medium group-hover:text-primary">{doc.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {doc.script ?? "Latin"} script · {doc.formality ?? "Formal"}
                        </p>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className="rounded border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-foreground/85">
                        {doc.type ?? "Letter"}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-[12.5px] text-muted-foreground sm:table-cell">
                      {doc.language ?? "English"}
                    </td>
                    <td className="px-4 py-3">
                      <FormatBadge format={doc.format} />
                    </td>
                    <td className="hidden px-4 py-3 text-[12px] text-muted-foreground lg:table-cell">
                      {new Date(doc.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem asChild className="cursor-pointer">
                            <Link to={`/dashboard/documents/${doc._id}`}>View &amp; generate</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer text-destructive focus:text-destructive"
                            onClick={() => handleDelete(doc._id)}
                          >
                            <Trash2 className="mr-2 size-3.5" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
