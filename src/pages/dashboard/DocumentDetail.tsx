import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FormatBadge, PageHeader, TranslationRatingBadge } from "@/components/oda/bits";
import { TranslationDocument } from "@/components/oda/DocumentContent";
import { extractEntities } from "@/lib/oda/analyze";
import { adaptiveGenerate } from "@/lib/oda/engine";
import { humanSize } from "@/lib/oda/extract";
import { draftWithDevice, forgeStatus, MODEL_INFO, type ForgeModel } from "@/lib/oda/localForge";
import { translateAdaptive } from "@/lib/oda/refine";
import { buildOverlay } from "@/lib/oda/extraDict";
import { rateTranslation } from "@/lib/oda/rating";
import {
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  Eye,
  FileText,
  GraduationCap,
  Languages,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

const LANGUAGES = [
  "Auto-detect",
  "English",
  "Hindi",
  "Tamil",
  "Bengali",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Gujarati",
  "Punjabi",
  "Urdu",
  "Marathi",
  "Odia",
  "Sanskrit",
  "Arabic",
  "Persian",
  "Russian",
  "Chinese",
  "Japanese",
  "Korean",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Italian",
];

const FORMALITY = ["Match Input", "Formal", "Semi-formal", "Informal"];
const FORMATS = ["Markdown", "Plain text", "HTML letter", "Structured JSON"];
const TRANSLATE_FORMATS = ["Same as original", "Markdown", "Plain text", "HTML letter", "Structured JSON"];

const TYPES = [
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
];

const ENTITY_COLORS: Record<string, string> = {
  emails: "oklch(0.72 0.15 160)",
  dates: "oklch(0.75 0.15 55)",
  references: "oklch(0.7 0.13 215)",
  amounts: "oklch(0.68 0.15 285)",
  names: "oklch(0.78 0.125 85)",
  phones: "oklch(0.72 0.16 25)",
};

const ENTITY_LABELS: Record<string, string> = {
  emails: "Emails",
  dates: "Dates",
  references: "References",
  amounts: "Amounts",
  names: "Names",
  phones: "Phones",
};

export default function DocumentDetail() {
  const { docId } = useParams();
  const navigate = useNavigate();
  const doc = useQuery(api.documents.get, { id: docId! as Id<"documents"> });
  const remove = useMutation(api.documents.remove);
  const setAnalysis = useMutation(api.documents.setAnalysis);
  const createResponse = useMutation(api.responses.create);
  const generateAction = useAction(api.generate.generateResponse);
  const translateAction = useAction(api.generate.translateDocument);
  const getProviders = useAction(api.generate.getProviders);
  // User-grown translation memory (Glossary page) — merged over the seed pack
  // so custom sentences/tokens apply to on-device translations too.
  const glossaryRows = useQuery(api.glossary.engineEntries);
  const overlay = useMemo(() => buildOverlay(glossaryRows), [glossaryRows]);

  const [highlight, setHighlight] = useState(true);
  const [language, setLanguage] = useState("Auto-detect");
  const [languageTouched, setLanguageTouched] = useState(false);
  const [formality, setFormality] = useState("Match Input");
  const [format, setFormat] = useState("Markdown");
  const [generating, setGenerating] = useState(false);
  const [deviceProgress, setDeviceProgress] = useState<number | null>(null);
  const [engineMode, setEngineMode] = useState<"auto" | "neural" | "instant">("auto");
  const [forgeModel, setForgeModel] = useState<ForgeModel>("best");
  const [result, setResult] = useState<{
    content: string;
    strategy: "ai" | "adaptive";
    engine?: string;
    rating?: string;
    ratingNote?: string;
    ratingScore?: number;
  } | null>(null);

  const [teach, setTeach] = useState<{ type: string; language: string; formality: string } | null>(null);

  // What the forge should produce: the document itself translated (the
  // primary action — a consumer selects a language and gets the full document
  // back in it), or a formal reply to the document.
  const [task, setTask] = useState<"response" | "translate">("translate");
  const [providers, setProviders] = useState<string[]>([]);

  // Free cloud providers (Gemini / Groq / Fireworks / OpenAI) light up
  // automatically when keys are configured — the strongest engine wins.
  useEffect(() => {
    let on = true;
    getProviders()
      .then((p) => {
        if (on) setProviders(p);
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, [getProviders]);

  const switchTask = (t: "response" | "translate") => {
    setTask(t);
    // Formal register is the norm for translations unless the user says otherwise.
    if (t === "translate" && formality === "Match Input") setFormality("Formal");
  };

  // Default the output language to the document's detected language rather
  // than quietly forcing English — unless the user has already chosen one.
  useEffect(() => {
    if (
      !languageTouched &&
      language === "Auto-detect" &&
      doc?.language &&
      doc.language !== "English"
    ) {
      setLanguage(doc.language);
    }
  }, [doc?.language, language, languageTouched]);

  const entities = useMemo(
    () => (doc?.text ? extractEntities(doc.text) : null),
    [doc?.text],
  );

  const highlightedText = useMemo<Array<{ text: string; key?: string }>>(() => {
    const source = doc?.text ?? "";
    if (!entities || !highlight) return [{ text: source }];
    const parts = [
      { key: "emails", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
      { key: "dates", re: /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi },
      { key: "references", re: /(?:no\.?|ref\.?|reg\.?|file no\.?|letter no\.?)\s*[:#]?\s*[A-Za-z0-9][A-Za-z0-9\/\-\._ ]{2,30}/gi },
      { key: "amounts", re: /(?:Rs\.?|₹|INR|USD|\$|€|£)\s?\d[\d,]*(?:\.\d{1,2})?/g },
      { key: "phones", re: /(?:\+?\d{1,3}[\s-]?)?\(?\d{3,5}\)?[\s-]?\d{3}[\s-]?\d{3,4}/g },
      { key: "names", re: /(?:Shri|Smt|Mr|Mrs|Ms|Dr|Er|Prof)\.?\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,2}/g },
    ];
    const combined = new RegExp(
      parts.map((p) => `(${p.re.source})`).join("|"),
      "g",
    );
    const keyByIndex: Record<number, string> = {};
    parts.forEach((p, i) => {
      keyByIndex[i + 1] = p.key;
    });

    const out: Array<{ text: string; key?: string }> = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = combined.exec(source)) !== null) {
      if (m.index > last) out.push({ text: source.slice(last, m.index) });
      const groupKey = keyByIndex[m.slice(1).findIndex((g) => g !== undefined) + 1];
      out.push({ text: m[0], key: groupKey });
      last = m.index + m[0].length;
    }
    if (last < source.length) out.push({ text: source.slice(last) });
    return out;
  }, [doc?.text, entities, highlight]);

  const handleDelete = async () => {
    if (!doc) return;
    await remove({ id: doc._id });
    toast.success("Document removed");
    navigate("/dashboard/documents");
  };

  const handleTeach = async () => {
    if (!doc || !teach) return;
    await setAnalysis({ id: doc._id, ...teach });
    setTeach(null);
    toast.success("Classification updated — the engine has learned");
  };

  const handleGenerate = async () => {
    if (!doc) return;
    setGenerating(true);
    setResult(null);
    // "Auto-detect" resolves to the document's detected language, never to a
    // hardcoded default.
    const outLanguage =
      language === "Auto-detect" ? (doc.language ?? "English") : language;
    const save = async (
      content: string,
      strategy: "ai" | "adaptive",
      rating?: { rating?: string; ratingNote?: string; ratingScore?: number },
    ) => {
      await createResponse({
        documentId: doc._id,
        documentName: doc.name,
        content,
        language: outLanguage,
        formality,
        format,
        strategy,
        kind: "response",
        sourceFormat: doc.format,
        rating: rating?.rating,
        ratingNote: rating?.ratingNote,
        ratingScore: rating?.ratingScore,
      });
      return content;
    };
    try {
      // Neural-first: Auto goes to the cloud forge whenever any AI key is
      // configured (APIMaster GPT-5.6 when set, else the free tiers) — the
      // deterministic engine is the fallback, not the default. The ~1.2 GB
      // on-device model still downloads only when the user explicitly picks
      // "Neural" (or is already loaded this session and reused for free).
      const wantNeural =
        engineMode === "neural" ||
        (engineMode === "auto" && (providers.length > 0 || forgeStatus() === "ready"));
      if (wantNeural) {
        // Tier 0: configured cloud providers (APIMaster GPT-5.6 / Gemini /
        // Groq / Fireworks / OpenAI) — the strongest neural intelligence.
        if (providers.length > 0) {
          try {
            const res = await generateAction({
              documentId: doc._id,
              language: outLanguage,
              formality,
              format,
            });
            setResult({
              content: res.content,
              strategy: "ai",
              engine: `Cloud forge · ${providers[0]}`,
            });
            toast.success(`Forged by the cloud forge (${providers[0]})`);
            return;
          } catch {
            // Provider failed → on-device forge next.
          }
        }
        try {
          // Tier 1: the on-device neural forge — a real LLM in the browser,
          // free forever, no keys, no servers, fully private.
          const content = await draftWithDevice(
            {
              sourceText: doc.text ?? "",
              sourceName: doc.name,
              sourceType: doc.type,
              sourceLanguage: doc.language,
              language: outLanguage,
              formality,
              format,
              task: "response",
            },
            setDeviceProgress,
            forgeModel,
            overlay,
          );
          await save(content, "ai");
          setResult({
            content,
            strategy: "ai",
            engine: `On-device neural forge · ${MODEL_INFO[forgeModel].label}`,
          });
          toast.success(
            "Forged by the on-device neural forge — free forever, no keys, fully private",
          );
          return;
        } catch {
          // Model unavailable → Tier 2: the instant deterministic engine.
        }
      }
      const res = adaptiveGenerate(doc, {
        language: outLanguage,
        formality,
        format,
      });
      await save(res.content, res.strategy);
      setResult({
        content: res.content,
        strategy: res.strategy,
        engine: "On-device engine · free forever",
      });
      toast.success("Response forged on your device — free, private, no keys");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
      setDeviceProgress(null);
    }
  };

  const handleTranslate = async () => {
    if (!doc) return;
    setGenerating(true);
    setResult(null);
    const outLanguage =
      language === "Auto-detect" ? (doc.language ?? "English") : language;
    // `complete` is intentionally NOT sent to responses.create: the deployed
    // Convex validator (pre-fidelity-engine) rejects unknown fields, which
    // broke every translation save. Completeness is still shown in toasts and
    // kept on the local engine result. The per-letter rating (reference /
    // complete / partial) IS part of the current validator, so it is sent and
    // persisted.
    const save = async (
      content: string,
      strategy: "ai" | "adaptive",
      rating?: { rating?: string; ratingNote?: string; ratingScore?: number },
    ) => {
      await createResponse({
        documentId: doc._id,
        documentName: doc.name,
        content,
        language: outLanguage,
        formality,
        format,
        strategy,
        kind: "translation",
        sourceFormat: doc.format,
        rating: rating?.rating,
        ratingNote: rating?.ratingNote,
        ratingScore: rating?.ratingScore,
      });
      return content;
    };
    try {
      // Same neural-first policy as responses: Auto uses the cloud forge when
      // any AI key is configured; "Neural" downloads the model explicitly.
      const wantNeural =
        engineMode === "neural" ||
        (engineMode === "auto" && (providers.length > 0 || forgeStatus() === "ready"));
      if (wantNeural) {
        // Tier 0: configured cloud providers (APIMaster GPT-5.6 / Gemini /
        // Groq / Fireworks / OpenAI).
        if (providers.length > 0) {
          try {
            const res = await translateAction({
              documentId: doc._id,
              language: outLanguage,
              formality,
              format,
            });
            setResult({
              content: res.content,
              strategy: "ai",
              engine: `Cloud forge · ${providers[0]}`,
              rating: res.rating,
              ratingNote: res.ratingNote,
              ratingScore: res.ratingScore,
            });
            toast.success(`Translated by the cloud forge (${providers[0]})`);
            return;
          } catch {
            // Provider failed → on-device forge next.
          }
        }
        try {
          // Tier 1: the on-device neural forge translates the whole document.
          const content = await draftWithDevice(
            {
              sourceText: doc.text ?? "",
              sourceName: doc.name,
              sourceType: doc.type,
              sourceLanguage: doc.language,
              language: outLanguage,
              formality,
              format,
              task: "translate",
            },
            setDeviceProgress,
            forgeModel,
            overlay,
          );
          // Letter-by-letter translator rating applies here too — the same
          // intelligent per-letter decision, computed on-device.
          const rated = rateTranslation({
            sourceText: doc.text ?? "",
            complete: true,
            language: outLanguage,
          });
          await save(content, "ai", {
            rating: rated.rating,
            ratingNote: rated.note,
            ratingScore: rated.score,
          });
          setResult({
            content,
            strategy: "ai",
            engine: `On-device neural forge · ${MODEL_INFO[forgeModel].label}`,
            rating: rated.rating,
            ratingNote: rated.note,
            ratingScore: rated.score,
          });
          toast.success(
            "Translated by the on-device neural forge — free forever, no keys, fully private",
          );
          return;
        } catch {
          // Model unavailable → Tier 2: structure-preserving instant translation.
        }
      }
      const res = translateAdaptive(
        doc,
        {
          language: outLanguage,
          formality,
          format,
        },
        overlay,
      );
      await save(res.content, res.strategy, {
        rating: res.rating,
        ratingNote: res.ratingNote,
        ratingScore: res.ratingScore,
      });
      setResult({
        content: res.content,
        strategy: res.strategy,
        engine: "On-device engine · structure preserved",
        rating: res.rating,
        ratingNote: res.ratingNote,
        ratingScore: res.ratingScore,
      });
      toast.success(
        res.complete
          ? "Translated on your device — reference standard: letterhead preserved, headers translated, names and codes in Devanagari"
          : "Frame translated on-device; enable the neural forge for full prose translation",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setGenerating(false);
      setDeviceProgress(null);
    }
  };

  if (doc === undefined) {
    return (
      <div>
        <PageHeader eyebrow="Omni-Viewer" title="Loading document…" />
        <div className="space-y-3">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (doc === null) {
    return (
      <div className="py-20 text-center">
        <p className="text-[14px] text-muted-foreground">Document not found.</p>
        <Link to="/dashboard/documents" className="mt-3 inline-block text-[13px] text-primary hover:underline">
          ← Back to the archive
        </Link>
      </div>
    );
  }

  const entityEntries = entities
    ? (Object.entries(entities).filter(([, v]) => v.length > 0) as Array<[keyof typeof ENTITY_COLORS, string[]]>)
    : [];

  return (
    <div>
      <Link
        to="/dashboard/documents"
        className="mb-5 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to the archive
      </Link>

      <PageHeader
        eyebrow="Pillar I · The Omni-Viewer"
        title={doc.name}
        description={`${doc.type ?? "Letter"} · ${doc.language ?? "English"} · ${doc.script ?? "Latin"} script · ${doc.formality ?? "Formal"} · ${humanSize(doc.size)}`}
        action={
          <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="mr-1.5 size-3.5" />
            Remove
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        {/* ------------------------------------------------ Viewer */}
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/50">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
              <div className="flex items-center gap-2">
                <Eye className="size-4 text-primary" />
                <span className="text-[13px] font-semibold">Text layer</span>
                <FormatBadge format={doc.format} className="ml-1" />
              </div>
              <button
                onClick={() => setHighlight((h) => !h)}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                  highlight
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                <BrainCircuit className="size-3.5" />
                Entities {highlight ? "on" : "off"}
              </button>
            </div>

            {doc.text ? (
              <div className="max-h-[560px] overflow-y-auto bg-[oklch(0.16_0.014_265)] p-6">
                <pre className="whitespace-pre-wrap font-serif text-[13.5px] leading-7 text-foreground/85">
                  {highlightedText.map((seg, i) =>
                    seg.key ? (
                      <span
                        key={i}
                        className="rounded-sm px-0.5 font-medium"
                        style={{
                          background: `color-mix(in oklab, ${ENTITY_COLORS[seg.key]} 16%, transparent)`,
                          color: ENTITY_COLORS[seg.key],
                          borderBottom: `1px solid color-mix(in oklab, ${ENTITY_COLORS[seg.key]} 50%, transparent)`,
                        }}
                      >
                        {seg.text}
                      </span>
                    ) : (
                      <span key={i}>{seg.text}</span>
                    ),
                  )}
                </pre>
              </div>
            ) : (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <FileText className="size-8 text-muted-foreground/50" />
                <p className="mt-4 max-w-sm text-[13px] leading-6 text-muted-foreground">
                  {doc.error ?? "No text layer was extracted for this format. The original file is preserved in the archive."}
                </p>
              </div>
            )}
          </section>

          {/* Entities */}
          {entityEntries.length > 0 && (
            <section className="rounded-2xl border border-border/70 bg-card/50 p-5">
              <div className="flex items-center gap-2">
                <GraduationCap className="size-4 text-primary" />
                <h3 className="text-[13.5px] font-semibold">Extracted entities</h3>
                <span className="oda-label !text-[9px]">auto-detected</span>
              </div>
              <div className="mt-4 space-y-4">
                {entityEntries.map(([key, values]) => (
                  <div key={key}>
                    <p className="oda-label !text-[9px]">{ENTITY_LABELS[key]}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {values.map((v) => (
                        <span
                          key={v}
                          className="rounded-md border px-2 py-1 font-mono text-[11px]"
                          style={{
                            color: ENTITY_COLORS[key],
                            borderColor: `color-mix(in oklab, ${ENTITY_COLORS[key]} 40%, transparent)`,
                            background: `color-mix(in oklab, ${ENTITY_COLORS[key]} 10%, transparent)`,
                          }}
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ------------------------------------------------ Generate + classify */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-primary/25 bg-card/50 p-5 lg:sticky lg:top-8">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h3 className="text-[14px] font-semibold">Dispatch Forge</h3>
            </div>

            <div className="mt-3 flex gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
              {(["response", "translate"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => switchTask(t)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    task === t
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "response" ? "Generate response" : "Translate document"}
                </button>
              ))}
            </div>

            <p className="mt-2.5 text-[12px] leading-5 text-muted-foreground">
              {task === "translate"
                ? "Translates the entire document into the selected language — every paragraph, heading, table header and closing — in a formal register. Only the letterhead (organization name, address, contact details) stays exactly as-is; every body line and table cell is translated, table headers translate fully, file numbers and account codes are transliterated into the target script (CPF→सीपीएफ), and member names read in Devanagari."
                : "Forge a response that mirrors this document&apos;s structure, register and references."}
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="oda-label mb-1.5 block !text-[9px]">Output language</label>
                <Select
                  value={language}
                  onValueChange={(v) => {
                    setLanguageTouched(true);
                    setLanguage(v);
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="oda-label mb-1.5 block !text-[9px]">Formality</label>
                <Select value={formality} onValueChange={setFormality}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMALITY.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="oda-label mb-1.5 block !text-[9px]">
                  {task === "translate" ? "Export format" : "Format"}
                </label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(task === "translate" ? TRANSLATE_FORMATS : FORMATS).map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {task === "translate" && format === "Same as original" && (
                  <p className="mt-1.5 text-[10.5px] leading-4 text-muted-foreground">
                    Matches the source format ({doc.format.toUpperCase()} → DOCX for layouts that
                    need rebuilding).
                  </p>
                )}
              </div>

              <Button
                className="w-full gap-2"
                onClick={task === "translate" ? handleTranslate : handleGenerate}
                disabled={generating || !doc.text}
              >
                {generating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : task === "translate" ? (
                  <Languages className="size-4" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {generating
                  ? task === "translate"
                    ? "Translating…"
                    : "Forging response…"
                  : task === "translate"
                    ? "Translate document"
                    : "Generate response"}
              </Button>

              {deviceProgress !== null && (
                <p className="text-center text-[11px] text-muted-foreground">
                  Downloading {MODEL_INFO[forgeModel].label} ({MODEL_INFO[forgeModel].size})…
                  first run only — takes a few minutes, then runs fully offline · {deviceProgress}%
                </p>
              )}

              <div className="space-y-3 border-t border-border/60 pt-4">
                <div>
                  <label className="oda-label mb-1.5 block !text-[9px]">Forge engine</label>
                  <div className="flex gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
                    {(["auto", "neural", "instant"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setEngineMode(m)}
                        className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                          engineMode === m
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {m === "auto" ? "Auto" : m === "neural" ? "Neural" : "Instant"}
                      </button>
                    ))}
                  </div>
                  {engineMode === "neural" && (
                    <div className="mt-2">
                      <div className="flex gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
                        {(["fast", "best"] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => setForgeModel(m)}
                            className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                              forgeModel === m
                                ? "bg-card text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {m === "fast" ? `Fast · ${MODEL_INFO.fast.size}` : `Best · ${MODEL_INFO.best.size}`}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[10.5px] leading-4 text-muted-foreground">
                        Fast (0.5B) downloads {MODEL_INFO.fast.size} and drafts in seconds; Best (1.5B)
                        downloads {MODEL_INFO.best.size} and writes richer prose. Downloaded once, then fully offline.
                      </p>
                    </div>
                  )}
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-muted-foreground">
                    <BookOpen className="mt-0.5 size-3 shrink-0" />
                    {providers.length > 0
                      ? `Cloud forge active: ${providers.join(", ")}. Auto uses the strongest engine first, then the on-device model, then the instant engine — it never downloads anything.`
                      : "Free forever, no keys, fully private. Auto uses the instant engine (deterministic, fully localized in 10 languages). Neural lets you pick the on-device model explicitly (see above), then runs offline. Add your APIMaster key (GPT-5.6 Luna) or a free Gemini/Groq/Fireworks key in the Keys tab to light up the cloud forge."}
                  </p>
                  {overlay.sentences.length > 0 && (
                    <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-muted-foreground">
                      <BookOpen className="mt-0.5 size-3 shrink-0" />
                      Every neural engine is trained on your glossary ({overlay.sentences.length} sentence entries) — your custom translations win, in the cloud and on-device.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {result && (
              <div className="mt-5 border-t border-border/60 pt-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10.5px] font-medium text-primary">
                      {result.strategy === "ai" ? <BrainCircuit className="size-3" /> : <RefreshCw className="size-3" />}
                      {result.engine ?? "On-device engine · free forever"}
                    </span>
                    {result.rating && (
                      <TranslationRatingBadge
                        rating={result.rating}
                        note={result.ratingNote}
                        score={result.ratingScore}
                      />
                    )}
                  </div>
                  <Link to="/dashboard/responses" className="text-[12px] font-medium text-primary hover:underline">
                    Open dispatch forge →
                  </Link>
                </div>
                <div className="max-h-96 overflow-y-auto rounded-xl border border-border/60 bg-[oklch(0.16_0.014_265)] p-4">
                  {task === "translate" ? (
                    <TranslationDocument documentId={doc._id} content={result.content} />
                  ) : (
                    <pre className="whitespace-pre-wrap font-serif text-[12.5px] leading-6 text-foreground/85">
                      {result.content}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Teach the system */}
          <section className="rounded-2xl border border-border/70 bg-card/50 p-5">
            <div className="flex items-center gap-2">
              <Languages className="size-4 text-primary" />
              <h3 className="text-[14px] font-semibold">Teach the system</h3>
            </div>
            <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">
              Correct the classification — the engine learns from every correction.
            </p>
            <div className="mt-4 space-y-3">
              <Select
                value={teach?.type ?? doc.type ?? "Letter"}
                onValueChange={(v) => setTeach((t) => ({ ...(t ?? { language: doc.language ?? "English", formality: doc.formality ?? "Formal" }), type: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={teach?.language ?? doc.language ?? "English"}
                onValueChange={(v) => setTeach((t) => ({ ...(t ?? { type: doc.type ?? "Letter", formality: doc.formality ?? "Formal" }), language: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.filter((l) => l !== "Auto-detect").map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={teach?.formality ?? doc.formality ?? "Formal"}
                onValueChange={(v) => setTeach((t) => ({ ...(t ?? { type: doc.type ?? "Letter", language: doc.language ?? "English" }), formality: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Formality" />
                </SelectTrigger>
                <SelectContent>
                  {FORMALITY.filter((f) => f !== "Match Input").map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleTeach}
                disabled={!teach}
              >
                Apply correction
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
