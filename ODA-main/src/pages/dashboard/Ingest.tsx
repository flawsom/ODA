import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, FormatBadge, PageHeader } from "@/components/oda/bits";
import { classifyDocument, detectFormality, detectScript } from "@/lib/oda/analyze";
import { extOf, extractText, humanSize } from "@/lib/oda/extract";
import { SAMPLES } from "@/lib/oda/samples";
import {
  CheckCircle2,
  CircleDashed,
  CloudUpload,
  FilePlus2,
  FileText,
  Loader2,
  PenLine,
  ScanLine,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { toast } from "sonner";

type QueueStatus =
  | "queued"
  | "extracting"
  | "analyzed"
  | "uploading"
  | "done"
  | "error";

interface QueueItem {
  id: string;
  name: string;
  size: number;
  format: string;
  file?: File;
  status: QueueStatus;
  text?: string;
  note?: string;
  type?: string;
  language?: string;
  script?: string;
  formality?: string;
  domain?: string;
  error?: string;
}

const COMPOSE_TYPES = [
  "Letter",
  "Complaint",
  "Legal Notice",
  "Invoice / Statement",
  "Transfer / Order",
  "Circular / Notification",
  "Memo",
  "Request / Application",
  "Report",
  "Contract / Agreement",
  "Acknowledgement",
];

let seq = 0;
const nextId = () => `q-${Date.now()}-${seq++}`;

const STATUS_META: Record<QueueStatus, { label: string; icon: typeof CircleDashed }> = {
  queued: { label: "Queued", icon: CircleDashed },
  extracting: { label: "Extracting", icon: ScanLine },
  analyzed: { label: "Analyzed", icon: CheckCircle2 },
  uploading: { label: "Archiving", icon: UploadCloud },
  done: { label: "Ingested", icon: CheckCircle2 },
  error: { label: "Error", icon: XCircle },
};

export default function Ingest() {
  const location = useLocation();
  const locationPrefill = (
    location.state as { compose?: { title?: string; text?: string } } | null
  )?.compose;
  // Public catalog pages stash a prefill in session storage so a signed-out
  // visitor who signs in mid-flow still lands with their template ready.
  const [storedPrefill] = useState<{ title?: string; text?: string } | null>(() => {
    try {
      const raw = sessionStorage.getItem("oda-compose");
      if (raw) {
        sessionStorage.removeItem("oda-compose");
        return JSON.parse(raw) as { title?: string; text?: string };
      }
    } catch {
      /* storage unavailable */
    }
    return null;
  });
  const composePrefill = locationPrefill ?? storedPrefill;

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [committed, setCommitted] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [composeTitle, setComposeTitle] = useState(composePrefill?.title ?? "");
  const [composeText, setComposeText] = useState(composePrefill?.text ?? "");
  const [composeType, setComposeType] = useState("Letter");
  const [composing, setComposing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const createDocument = useMutation(api.documents.create);

  const patchItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const enqueue = useCallback(
    async (files: File[]) => {
      const items: QueueItem[] = files.map((file) => ({
        id: nextId(),
        name: file.name,
        size: file.size,
        format: extOf(file.name) || "bin",
        file,
        status: "queued",
      }));
      setQueue((prev) => [...prev, ...items]);

      for (const item of items) {
        patchItem(item.id, { status: "extracting" });
        const extraction = await extractText(item.file!, item.name, (label) =>
          patchItem(item.id, { note: label }),
        );
        if (!extraction.supported || !extraction.text.trim()) {
          patchItem(item.id, {
            status: "error",
            note: extraction.note,
            error: extraction.note ?? "No extractable text layer.",
            format: extraction.format,
          });
          continue;
        }
        const script = detectScript(extraction.text);
        const analysis = classifyDocument(extraction.text, item.name);
        patchItem(item.id, {
          status: "analyzed",
          text: extraction.text,
          format: extraction.format,
          language: script.language,
          script: script.script,
          type: analysis.type,
          domain: analysis.domain,
          formality: detectFormality(extraction.text),
          note: extraction.note,
        });
      }
    },
    [patchItem],
  );

  const onFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      void enqueue(Array.from(list));
    },
    [enqueue],
  );

  const commitBatch = useCallback(async () => {
    const ready = queue.filter((it) => it.status === "analyzed" && it.text);
    if (ready.length === 0) return;

    setQueue((prev) => prev.map((it) => (ready.some((r) => r.id === it.id) ? { ...it, status: "uploading" } : it)));

    let ok = 0;
    for (const item of ready) {
      try {
        let storageId: Id<"_storage"> | undefined;
        if (item.file) {
          const uploadUrl = await generateUploadUrl();
          const res = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": item.file.type },
            body: item.file,
          });
          if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
          const { storageId: sid } = (await res.json()) as { storageId: string };
          storageId = sid as Id<"_storage">;
        }
        await createDocument({
          name: item.name,
          mimeType: item.file?.type ?? "text/plain",
          size: item.size,
          storageId,
          text: item.text,
          format: item.format,
          type: item.type,
          language: item.language,
          script: item.script,
          formality: item.formality,
          domain: item.domain,
        });
        patchItem(item.id, { status: "done" });
        ok++;
      } catch (err) {
        patchItem(item.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Commit failed",
        });
      }
    }
    setCommitted((c) => c + ok);
    if (ok > 0) toast.success(`Ingested ${ok} document${ok > 1 ? "s" : ""} into the archive`);
  }, [queue, generateUploadUrl, createDocument, patchItem]);

  const loadSamples = useCallback(async () => {
    for (const sample of SAMPLES) {
      const id = nextId();
      const script = detectScript(sample.text);
      const analysis = classifyDocument(sample.text, sample.name);
      setQueue((prev) => [
        ...prev,
        {
          id,
          name: sample.name,
          size: sample.text.length,
          format: "sample",
          status: "analyzed",
          text: sample.text,
          language: script.language,
          script: script.script,
          type: analysis.type,
          domain: analysis.domain,
          formality: detectFormality(sample.text),
        },
      ]);
    }
    toast.info("Sample correspondence loaded — review and commit to the archive");
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setCommitted(0);
  }, []);

  const handleCompose = async () => {
    const title = composeTitle.trim();
    const content = composeText.trim();
    if (!title || !content) {
      toast.error("Give your document a title and some content first.");
      return;
    }
    setComposing(true);
    try {
      const script = detectScript(content);
      const analysis = classifyDocument(content, title);
      await createDocument({
        name: title.endsWith(".txt") ? title : `${title}.txt`,
        mimeType: "text/plain",
        size: content.length,
        text: content,
        format: "txt",
        type: composeType,
        language: script.language,
        script: script.script,
        domain: analysis.domain,
        formality: detectFormality(content),
      });
      setComposeTitle("");
      setComposeText("");
      toast.success("Document posted to your archive");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post the document");
    } finally {
      setComposing(false);
    }
  };

  const counts = {
    total: queue.length,
    analyzed: queue.filter((q) => q.status === "analyzed").length,
    done: queue.filter((q) => q.status === "done").length,
    error: queue.filter((q) => q.status === "error").length,
  };

  return (
    <div>
      <PageHeader
        eyebrow="Pillar II · The Ingestion Portal"
        title="Ingest"
        description="Drop files in a supported format — or compose your own document — and ODA extracts the text layer, reads the bureaucratic DNA, and stages everything for the archive. Files ODA can't read yet are flagged honestly, never silently dropped."
        action={
          queue.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearQueue} className="text-muted-foreground">
              Clear batch ({queue.length})
            </Button>
          ) : undefined
        }
      />

      <Tabs defaultValue="upload">
        <TabsList className="mb-4">
          <TabsTrigger value="upload" className="gap-1.5">
            <CloudUpload className="size-3.5" />
            Upload files
          </TabsTrigger>
          <TabsTrigger value="compose" className="gap-1.5">
            <PenLine className="size-3.5" />
            Compose a document
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-0">
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              onFiles(e.dataTransfer.files);
            }}
            className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
              dragging
                ? "border-primary/70 bg-primary/8"
                : "border-border/70 bg-card/40 hover:border-primary/40 hover:bg-card/60"
            }`}
          >
            <div className="flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary transition-transform group-hover:scale-105">
              <CloudUpload className="size-6" />
            </div>
            <p className="mt-5 text-[15px] font-semibold">
              Drag &amp; drop files here — or click to browse
            </p>
            <p className="oda-label mt-2 !text-[9px]">
              Parsed in your browser: PDF · DOCX · TXT · MD · CSV · JSON · HTML · RTF · images (PNG/JPG/WebP/BMP/TIFF) — scanned PDFs and images get a free on-device OCR text layer
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          </div>

          {/* Sample loader */}
          <div className="mt-4 flex items-center justify-between rounded-xl border border-border/60 bg-card/40 px-4 py-3">
            <p className="text-[12.5px] text-muted-foreground">
              No files handy? Let the archivist practise on the <span className="text-foreground">sample correspondence</span> — a transfer order and a pension complaint — and watch the full loop run.
            </p>
            <Button variant="outline" size="sm" onClick={loadSamples} className="shrink-0 gap-1.5">
              <FilePlus2 className="size-3.5" />
              Load samples
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="compose" className="mt-0">
          <div className="rounded-2xl border-2 border-dashed border-border/70 bg-card/40 p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <PenLine className="size-4" />
              </div>
              <div>
                <p className="text-[14px] font-semibold">Write it here — ODA structures it</p>
                <p className="text-[11.5px] text-muted-foreground">
                  Post your own document. Script, language and formality are detected automatically.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
              <Input
                value={composeTitle}
                onChange={(e) => setComposeTitle(e.target.value)}
                placeholder="Document title — e.g. Leave application, June 2026"
              />
              <Select value={composeType} onValueChange={setComposeType}>
                <SelectTrigger>
                  <SelectValue placeholder="Document type" />
                </SelectTrigger>
                <SelectContent>
                  {COMPOSE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              rows={11}
              placeholder={`Paste or write your document here…\n\nTo,\nThe Concerned Authority\n\nSubject: …`}
              className="mt-3 font-serif text-[13.5px] leading-6"
            />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11.5px] text-muted-foreground">
                {composeText.trim().length > 0
                  ? `${composeText.trim().length.toLocaleString()} characters — ready to analyze`
                  : "A title and some content is all it takes."}
              </p>
              <Button onClick={handleCompose} disabled={composing} className="gap-2">
                {composing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <PenLine className="size-4" />
                )}
                {composing ? "Analyzing…" : "Post to archive"}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Batch queue */}
      {queue.length > 0 && (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold">
              Processing batch{" "}
              <span className="font-mono text-[12px] text-muted-foreground">
                ({counts.done + counts.error}/{counts.total} committed · {counts.analyzed} ready)
              </span>
            </h2>
            {counts.analyzed > 0 && (
              <Button onClick={commitBatch} disabled={counts.analyzed === 0} className="gap-2">
                <UploadCloud className="size-4" />
                Commit {counts.analyzed} to archive
              </Button>
            )}
          </div>

          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500"
              style={{ width: counts.total > 0 ? `${((counts.done + counts.error) / counts.total) * 100}%` : "0%" }}
            />
          </div>

          <div className="space-y-2.5">
            {queue.map((item) => {
              const meta = STATUS_META[item.status];
              const Icon = meta.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-xl border border-border/60 bg-card/50 px-4 py-3.5"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/50 text-muted-foreground">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[13.5px] font-medium">{item.name}</p>
                      {item.format !== "sample" && <FormatBadge format={item.format} />}
                      {item.format === "sample" && <FormatBadge format="sample" />}
                    </div>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">
                      {item.status === "analyzed" || item.status === "done" || item.status === "uploading"
                        ? `${item.type ?? "Letter"} · ${item.language ?? "English"} (${item.script ?? "Latin"}) · ${item.formality ?? "Formal"} · ${humanSize(item.size)}`
                        : item.error ?? item.note ?? `${humanSize(item.size)} · awaiting analysis`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                      {item.status === "extracting" || item.status === "uploading" ? (
                        <Loader2 className="size-3.5 animate-spin text-primary" />
                      ) : (
                        <Icon
                          className={`size-3.5 ${
                            item.status === "error"
                              ? "text-destructive"
                              : item.status === "done"
                                ? "text-chart-2"
                                : "text-muted-foreground"
                          }`}
                        />
                      )}
                      {meta.label}
                    </span>
                    <button
                      onClick={() =>
                        setQueue((prev) => prev.filter((it) => it.id !== item.id))
                      }
                      aria-label={`Remove ${item.name} from the batch`}
                      title="Remove from batch"
                      className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {queue.length === 0 && committed === 0 && (
        <div className="mt-8">
          <EmptyState
            icon={FileText}
            title="The archive awaits its first filing"
            body="Drop a letter or a whole batch of files — every readable one lands here, classified and ready for response generation. Formats ODA can't read yet are flagged with a clear reason, never silently dropped. Free forever, no keys required."
            cta={{ to: "/dashboard/catalog", label: "Browse the catalog" }}
          />
        </div>
      )}

      {committed > 0 && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-chart-2/30 bg-chart-2/8 px-4 py-3">
          <p className="text-[13px] text-foreground/90">
            <span className="font-semibold text-chart-2">{committed} documents</span> committed to the archive.
          </p>
          <Link to="/dashboard/documents" className="text-[13px] font-medium text-primary hover:underline">
            Open the archive →
          </Link>
        </div>
      )}
    </div>
  );
}
