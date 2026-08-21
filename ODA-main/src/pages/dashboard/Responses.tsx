import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { TranslationDocument } from "@/components/oda/DocumentContent";
import { fetchLetterheadImage } from "@/components/oda/LetterheadImage";
import { useConvex, useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, PageHeader } from "@/components/oda/bits";
import { exportFormatForSource, exportResponse, type ExportFormat } from "@/lib/oda/export";
import { getExportLog } from "@/lib/oda/exportLog";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Languages,
  RefreshCw,
  ScrollText,
  Trash2,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

const EXPORT_ITEMS: Array<{ format: ExportFormat; label: string; desc: string }> = [
  { format: "docx", label: "DOCX", desc: "Editable letter" },
  { format: "txt", label: "TXT", desc: "Plain text" },
  { format: "md", label: "Markdown", desc: "Documentation-ready" },
  { format: "html", label: "HTML", desc: "Email body" },
  { format: "json", label: "JSON", desc: "API integration" },
];

function exportMenuItems(kind: string | undefined, sourceFormat: string | undefined) {
  if (kind === "translation" && sourceFormat) {
    const same = exportFormatForSource(sourceFormat);
    return [
      {
        format: same,
        label: `Same as original (${same.toUpperCase()})`,
        desc: `Matches ${sourceFormat.toUpperCase()} source`,
      },
      ...EXPORT_ITEMS,
    ];
  }
  return EXPORT_ITEMS;
}

export default function Responses() {
  const responses = useQuery(api.responses.list);
  const remove = useMutation(api.responses.remove);
  const convex = useConvex();
  const [preview, setPreview] = useState<{
    id: string;
    documentId: Id<"documents"> | null;
    kind: "response" | "translation" | undefined;
    content: string;
    name: string;
  } | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  // Export debug (fidelity PRD §8.3): which track rendered the last DOCX and
  // why — so a precision-mode miss is visible instead of silent.
  const [exportStamp, setExportStamp] = useState(0);
  const exportLog = useMemo(() => getExportLog().slice(-5).reverse(), [exportStamp]);
  // Shrink-to-fit: the newest precision render is the one the last DOCX came
  // from — when it flagged a likely 2-page overflow, say so instead of
  // silently shipping an overflowing letter.
  const lastPrecision = exportLog.find((d) => d.path === "track-b");

  const handleExport = async (id: string, format: ExportFormat, name: string, content: string) => {
    const item = responses?.find((r) => r._id === id);
    // Hard export gate (fidelity PRD §4.3): an incomplete translation is
    // never exported silently — the user explicitly confirms first. The file
    // itself stays clean either way (the sanitizer strips preview furniture).
    if (item?.kind === "translation" && item.complete === false) {
      const proceed = window.confirm(
        "This translation has some lines still in the source language (the on-device engine covered the rest). Export anyway?",
      );
      if (!proceed) return;
    }
    setExporting(id);
    try {
      // Translations carry the source letterhead into the delivered file — the
      // letterhead exactly as the input, embedded above the translated body.
      let letterhead = null;
      if (item?.kind === "translation" && item.documentId) {
        const doc = await convex.query(api.documents.get, { id: item.documentId });
        if (doc?.storageUrl) {
          letterhead = await fetchLetterheadImage(doc.storageUrl, doc.format);
        }
      }
      await exportResponse(
        {
          documentName: name,
          content,
          language: item?.language ?? "English",
          formality: item?.formality ?? "Formal",
          strategy: item?.strategy ?? "adaptive",
          createdAt: item?.createdAt ?? Date.now(),
          kind: item?.kind,
          sourceFormat: item?.sourceFormat,
          letterhead,
        },
        format,
      );
      if (format === "docx") setExportStamp(Date.now());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const handleDelete = async (id: Id<"responses">) => {
    await remove({ id });
    toast.success("Response removed");
  };

  return (
    <div>
      <PageHeader
        eyebrow="Pillar III · The Dispatch Forge"
        title="Responses"
        description="Every reply we've forged for you, ready for dispatch in any format. Preview, export, or remove — each one carries its own record."
      />

      {responses === undefined && (
        <p className="py-16 text-center text-[13px] text-muted-foreground">Loading forge…</p>
      )}

      {responses !== undefined && responses.length === 0 && (
        <EmptyState
          icon={ScrollText}
          title="The forge is quiet — too quiet"
          body="Open any document in the archive and generate its reply. Forged responses land right here, ready to export and dispatch."
          cta={{ to: "/dashboard/documents", label: "Open the archive" }}
        />
      )}

      {responses !== undefined && responses.length > 0 && (
        <div className="space-y-3">
          {responses.map((r) => (
            <div
              key={r._id}
              className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/50 px-5 py-4 sm:flex-row sm:items-center"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                <FileText className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[13.5px] font-medium">{r.documentName}</p>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      r.kind === "translation"
                        ? "border-chart-2/40 bg-chart-2/10 text-chart-2"
                        : "border-primary/40 bg-primary/10 text-primary"
                    }`}
                  >
                    {r.kind === "translation" ? (
                      <Languages className="size-2.5" />
                    ) : (
                      <RefreshCw className="size-2.5" />
                    )}
                    {r.kind === "translation"
                      ? `Translation · ${r.strategy === "ai" ? "neural" : "structure"}`
                      : `${r.strategy === "ai" ? "Neural" : "Adaptive"} · ${
                          r.strategy === "ai" ? "forge" : "on-device"
                        }`}
                    {r.kind === "translation" && r.complete === false && (
                      <span className="ml-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-amber-500">
                        partial
                      </span>
                    )}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  {r.language} · {r.formality} · {r.format}
                  {r.kind === "translation" && r.sourceFormat
                    ? ` · from ${r.sourceFormat.toUpperCase()}`
                    : ""}{" "}
                  ·{" "}
                  {new Date(r.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPreview({
                      id: r._id,
                      documentId: r.documentId,
                      kind: r.kind,
                      content: r.content,
                      name: r.documentName,
                    })
                  }
                >
                  Preview
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="gap-1.5">
                      {exporting === r._id ? (
                        <RefreshCw className="size-3.5 animate-spin" />
                      ) : (
                        <Download className="size-3.5" />
                      )}
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel className="text-[11px]">Dispatch format</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {exportMenuItems(r.kind, r.sourceFormat).map((item, i) => (
                      <DropdownMenuItem
                        key={`${item.format}-${i}`}
                        className="cursor-pointer"
                        onSelect={() => void handleExport(r._id, item.format, r.documentName, r.content)}
                      >
                        <span className="w-14 font-mono text-[11.5px]">{item.label}</span>
                        <span className="text-[11.5px] text-muted-foreground">{item.desc}</span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer text-destructive focus:text-destructive"
                      onSelect={() => void handleDelete(r._id)}
                    >
                      <Trash2 className="mr-2 size-3.5" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}

          <p className="flex items-center gap-1.5 pt-2 text-[11.5px] text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-chart-2" />
            Every export carries the source document name — ready for print queues and email.
          </p>

          {lastPrecision?.possibleOverflow && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[12px] leading-5 text-amber-500">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                This letter may run to 2 pages — the member table is long enough that even the
                smallest fitting tier (8pt, tighter margins) isn&apos;t guaranteed to hold it.
                Review the exported DOCX before dispatch.
              </span>
            </div>
          )}

          {exportLog.length > 0 && (
            <details className="rounded-xl border border-border/60 bg-card/40 px-4 py-3">
              <summary className="flex cursor-pointer select-none items-center gap-2 text-[11.5px] font-medium text-muted-foreground hover:text-foreground">
                <Wrench className="size-3.5" />
                Export debug — how the last DOCX was rendered
              </summary>
              <ul className="mt-2 space-y-1.5">
                {exportLog.map((d, i) => (
                  <li key={i} className="font-mono text-[10.5px] leading-4 text-muted-foreground">
                    {new Date(d.timestamp ?? 0).toLocaleTimeString()} ·{" "}
                    {d.path === "track-b"
                      ? `Precision template ${d.templateId ?? ""} · ${d.rowCount ?? 0} row(s) · ${d.fontSizePt ?? "?"}pt${d.possibleOverflow ? " · may overflow to 2 pages" : ""}`
                      : d.path === "track-b-failed"
                        ? `Precision template ${d.templateId ?? ""} failed — fell back to generic · ${d.error ?? ""}`
                        : "Generic structural renderer"}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Preview dialog */}
      <Dialog
        open={preview !== null}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">{preview?.name}</DialogTitle>
            <DialogDescription>
              Response preview — ready to export for dispatch.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[52vh] overflow-y-auto rounded-xl border border-border/60 bg-[oklch(0.16_0.014_265)] p-5">
            {preview && preview.kind === "translation" && preview.documentId ? (
              <TranslationDocument documentId={preview.documentId} content={preview.content} />
            ) : (
              <pre className="whitespace-pre-wrap font-serif text-[13px] leading-7 text-foreground/85">
                {preview?.content}
              </pre>
            )}
          </div>
          <div className="flex justify-end gap-2">
            {preview && (
              <>
                <Button variant="outline" size="sm" onClick={() => setPreview(null)}>
                  Close
                </Button>
                <Button size="sm" onClick={() => void handleExport(preview.id, "docx", preview.name, preview.content)}>
                  <Download className="mr-1.5 size-3.5" />
                  Export DOCX
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="mt-8">
        <Link to="/dashboard/documents" className="text-[13px] font-medium text-primary hover:underline">
          ← Back to the archive
        </Link>
      </div>
    </div>
  );
}
