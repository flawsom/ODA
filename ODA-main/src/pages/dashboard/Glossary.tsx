import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
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
import { EmptyState, PageHeader, StatCard } from "@/components/oda/bits";
import { useAuth } from "@/hooks/use-auth";
import {
  GLOSSARY,
  HI_ABBR,
  HI_PHRASES,
  HI_TOKENS,
  NAME_TABLE,
  REF_TOKENS,
} from "@/lib/oda/glossary";
import { TABLE_HEADERS } from "@/lib/oda/translate";
import { KITS } from "@/lib/oda/adaptive";
import { TOKEN_TABLES, type TokenTableName } from "@/lib/oda/extraDict";
import {
  glossaryRowKey,
  planGlossaryImport,
  previewPhraseTranslation,
  serializeGlossaryExport,
} from "@/lib/oda/glossaryIO";
import {
  clearHits,
  getHitCounts,
  getHitsVersion,
  subscribeHits,
} from "@/lib/oda/hitTracker";
import {
  BookMarked,
  Download,
  Languages,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import {
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Component } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

interface TokenRow {
  key: string;
  value: string;
  isRegex?: boolean;
}

/** Seed token tables, normalized to {key, value} rows for display. */
const SEED_TOKENS: Record<TokenTableName, TokenRow[]> = {
  HI_TOKENS: Object.entries(HI_TOKENS).map(([key, value]) => ({ key, value })),
  HI_PHRASES: HI_PHRASES.map(([re, value]) => ({ key: re.source, value, isRegex: true })),
  HI_ABBR: [...HI_ABBR].map((key) => ({ key, value: "—" })),
  REF_TOKENS: Object.entries(REF_TOKENS).map(([key, value]) => ({ key, value })),
  NAME_TABLE: Object.entries(NAME_TABLE).map(([key, value]) => ({ key, value })),
  TABLE_HEADERS: Object.entries(TABLE_HEADERS).map(([key, langs]) => ({
    key,
    value: langs.Hindi ?? langs.English ?? "—",
  })),
};

const TOKEN_LABELS: Record<TokenTableName, string> = {
  HI_TOKENS: "Words (address blocks, designations, cells)",
  HI_PHRASES: "Regex phrase rules (applied inside word translation)",
  HI_ABBR: "Abbreviations (trailing period becomes a comma)",
  REF_TOKENS: "Reference / code fragments",
  NAME_TABLE: "Person names",
  TABLE_HEADERS: "Table headers",
};

interface SentenceRow {
  id?: string;
  en: string;
  hi: string;
  tr?: Record<string, string>;
  langs: number;
}

/** The target languages a sentence template can carry (the engine's KITS
 * minus English — English is the source). Derived from the engine so the
 * form can never drift from what phrase matching actually resolves. */
const SENTENCE_LANGS = Object.keys(KITS).filter((l) => l !== "English");

const LANG_CODES: Record<string, string> = {
  Hindi: "hi",
  Tamil: "ta",
  Bengali: "bn",
  Telugu: "te",
  Kannada: "kn",
  Gujarati: "gu",
  Marathi: "mr",
  Spanish: "es",
  French: "fr",
  Arabic: "ar",
};

interface TokenFormState {
  id?: string;
  table: TokenTableName;
  key: string;
  value: string;
}

/** The custom-entries query lives behind a boundary so a storage outage (or a
 * backend that hasn't been deployed yet) never blanks the page — the seed
 * browser keeps working and a banner explains the state. */
class GlossaryQueryBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[Glossary] custom-entries query failed:", err.message);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function Glossary() {
  const [storageOk, setStorageOk] = useState(true);
  return (
    // Keyed by state so the boundary remounts (and clears its own failed
    // flag) once the parent decides to run in seed-only mode — otherwise the
    // boundary would keep rendering null forever.
    <GlossaryQueryBoundary key={storageOk ? "live" : "seed"} onError={() => setStorageOk(false)}>
      <GlossaryInner storageOk={storageOk} />
    </GlossaryQueryBoundary>
  );
}

function GlossaryInner({ storageOk }: { storageOk: boolean }) {
  const { user, isLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  // Skipped entirely when the storage query failed, so the page degrades to
  // the seed pack instead of crashing.
  const stored = storageOk ? useQuery(api.glossary.list) : undefined;
  const upsert = useMutation(api.glossary.upsert);
  const remove = useMutation(api.glossary.remove);
  const bulkUpsert = useMutation(api.glossary.bulkUpsert);
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"sentences" | "tokens">("sentences");
  const [search, setSearch] = useState("");
  const [tokenTable, setTokenTable] = useState<TokenTableName>("HI_TOKENS");
  const [sentenceForm, setSentenceForm] = useState<{
    id?: string;
    en: string;
    tr: Record<string, string>;
  } | null>(null);
  const [previewSample, setPreviewSample] = useState("");
  const [tokenForm, setTokenForm] = useState<TokenFormState | null>(null);
  const [saving, setSaving] = useState(false);

  // Live hit counts: which glossary entries actually fired during
  // translations. Re-renders whenever the engine records a hit in this tab.
  const hitsVersion = useSyncExternalStore(subscribeHits, getHitsVersion);
  const hits = useMemo(() => getHitCounts(), [hitsVersion]);
  const totalHits = useMemo(() => Object.values(hits).reduce((a, b) => a + b, 0), [hits]);

  const customSentences = useMemo(
    () => (stored ?? []).filter((r) => r.kind === "sentence"),
    [stored],
  );
  const customTokens = useMemo(
    () => (stored ?? []).filter((r) => r.kind === "token"),
    [stored],
  );

  const seedSentences = useMemo<SentenceRow[]>(
    () =>
      GLOSSARY.filter((e) => e.hi || e.tr).map((e) => ({
        en: e.en,
        hi: (e.hi ?? (e.tr ? (e.tr.Hindi ?? "") : "")).trim(),
        tr: e.tr ?? (e.hi ? { Hindi: e.hi } : undefined),
        langs: e.tr ? Object.keys(e.tr).length : 1,
      })),
    [],
  );

  const allSentences = useMemo<SentenceRow[]>(() => {
    const custom: SentenceRow[] = customSentences.map((r) => ({
      id: r._id,
      en: r.en,
      hi: (r.hi ?? (r.tr ? r.tr.Hindi ?? "" : "")).trim(),
      tr: r.tr ?? (r.hi ? { Hindi: r.hi } : undefined),
      langs: r.tr ? Object.keys(r.tr).length : 1,
    }));
    return [...custom, ...seedSentences];
  }, [customSentences, seedSentences]);

  const customRowsFor = (table: string): Array<{ id: string; key: string; value: string }> =>
    customTokens
      .filter((r) => r.table === table)
      .map((r) => ({ id: r._id, key: r.en, value: r.hi ?? "—" }));

  const tokenRowsFor = (table: TokenTableName): TokenRow[] => {
    const custom = customRowsFor(table).map((r) => ({ key: r.key, value: r.value }));
    return [...custom, ...SEED_TOKENS[table]];
  };

  /** The first stored custom row this new/edited entry would shadow — the
   * overlay merge and the phrase pass can't tell two rows with the same
   * source apart, so the newest would silently win. Excludes the row being
   * edited (its own id), so changing other fields of an entry is always fine. */
  const findShadow = (
    kind: "sentence" | "token",
    table: string | undefined,
    en: string,
    selfId: string | undefined,
  ) =>
    (stored ?? []).find(
      (r) =>
        r.kind === kind &&
        r._id !== selfId &&
        glossaryRowKey(r) === glossaryRowKey({ kind, table, en }),
    );

  const q = search.trim().toLowerCase();
  const filteredSentences = allSentences.filter(
    (s) =>
      !q ||
      s.en.toLowerCase().includes(q) ||
      s.hi.toLowerCase().includes(q) ||
      (s.tr && Object.values(s.tr).some((t) => t.toLowerCase().includes(q))),
  );
  const filteredTokens = tokenRowsFor(tokenTable).filter(
    (t) => !q || t.key.toLowerCase().includes(q) || t.value.toLowerCase().includes(q),
  );
  const tokenOverrides = useMemo(
    () => new Set(customRowsFor(tokenTable).map((r) => r.key.toLowerCase())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customTokens, tokenTable],
  );

  const handleSaveSentence = async () => {
    if (!sentenceForm) return;
    // Keep only the languages the user actually filled in.
    const tr = Object.fromEntries(
      Object.entries(sentenceForm.tr)
        .map(([lang, text]) => [lang, text.trim()] as const)
        .filter(([, text]) => text.length > 0),
    );
    if (!sentenceForm.en.trim() || Object.keys(tr).length === 0) {
      toast.error(
        "Give the sentence an English source and at least one translation (e.g. Hindi).",
      );
      return;
    }
    const shadow = findShadow("sentence", undefined, sentenceForm.en, sentenceForm.id);
    if (shadow) {
      toast.error(
        `A custom sentence with this exact source already exists — saving would shadow it (the overlay can't tell the two apart). Edit the existing entry instead: "${shadow.en.length > 70 ? shadow.en.slice(0, 70) + "…" : shadow.en}"`,
      );
      return;
    }
    setSaving(true);
    setPreviewSample("");
    try {
      await upsert({
        id: sentenceForm.id ? (sentenceForm.id as Id<"glossaryEntries">) : undefined,
        kind: "sentence",
        en: sentenceForm.en.trim(),
        // Back-compat: keep the hi column in sync with tr.Hindi for paths that
        // still read the legacy field (engine prefers the full tr map).
        hi: tr.Hindi ?? undefined,
        tr,
        enabled: true,
      });
      toast.success(
        sentenceForm.id
          ? `Sentence updated (${Object.keys(tr).length} language${Object.keys(tr).length === 1 ? "" : "s"})`
          : "Sentence added to the dictionary",
      );
      setSentenceForm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save sentence");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveToken = async () => {
    if (!tokenForm) return;
    const key = tokenForm.key.trim();
    const needsValue = tokenForm.table !== "HI_ABBR";
    if (!key || (needsValue && !tokenForm.value.trim())) {
      toast.error("Give the token row both a key and a Hindi value.");
      return;
    }
    const existingToken = (stored ?? []).find(
      (r) =>
        r.kind === "token" &&
        r.table === tokenForm.table &&
        r._id !== tokenForm.id &&
        glossaryRowKey(r) ===
          glossaryRowKey({ kind: "token", table: tokenForm.table, en: tokenForm.key }),
    );
    if (existingToken) {
      const isAbbr = tokenForm.table === "HI_ABBR";
      const sameValue = isAbbr
        || (existingToken.hi ?? "") === tokenForm.value.trim();
      if (isAbbr || !sameValue) {
        toast.error(
          `A custom ${tokenForm.table} row with this key already exists` +
            (isAbbr || !sameValue
              ? ` — saving would shadow it (the overlay keeps the last write). Edit the existing row instead: "${existingToken.en.length > 60 ? existingToken.en.slice(0, 60) + "\u2026" : existingToken.en}"`
              : ""),
        );
        return;
      }
    }
    setSaving(true);
    try {
      await upsert({
        id: tokenForm.id ? (tokenForm.id as Id<"glossaryEntries">) : undefined,
        kind: "token",
        table: tokenForm.table,
        en: key,
        hi: needsValue ? tokenForm.value.trim() : undefined,
        enabled: true,
      });
      toast.success(tokenForm.id ? "Token row updated" : "Token row added");
      setTokenForm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save token row");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    try {
      await remove({ id: id as Id<"glossaryEntries"> });
      toast.success(`${label} removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove entry");
    }
  };

  /** Serialize the stored (custom) entries into a portable JSON file so a
   * translation memory can move between deployments. Seed rows ship with the
   * code, so only the user-grown rows are exported. */
  const handleExport = () => {
    if (!storageOk || !stored) {
      toast.error("Nothing to export — custom-entries storage is unreachable.");
      return;
    }
    if (stored.length === 0) {
      toast.info("No custom entries yet — the seed pack already ships with the app.");
      return;
    }
    const payload = serializeGlossaryExport(stored);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oda-glossary-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${stored.length} custom entr${stored.length === 1 ? "y" : "ies"}`);
  };

  /** Import a glossary JSON export: validate the shape, skip rows that are
   * already present (idempotent re-import) or invalid, and upsert the rest
   * in one atomic Convex mutation. */
  const handleImportFile = async (file: File) => {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      toast.error("Not a valid JSON file.");
      return;
    }
    const plan = planGlossaryImport(data, stored ?? []);
    if (!plan.ok) {
      toast.error(plan.error);
      return;
    }
    if (plan.rows.length === 0) {
      toast.info(
        `Nothing new to import — ${plan.skipped} row${plan.skipped === 1 ? "" : "s"} already present or invalid.`,
      );
      return;
    }
    setSaving(true);
    try {
      const n = await bulkUpsert({ rows: plan.rows });
      toast.success(
        `Imported ${n} entr${n === 1 ? "y" : "ies"}` +
          (plan.skipped ? ` · ${plan.skipped} skipped (already present or invalid)` : ""),
      );
    } catch (err) {
      toast.error(err instanceof Error ? `Import failed: ${err.message}` : "Import failed");
    } finally {
      setSaving(false);
    }
  };

  // Live preview: the author types a concrete sample ("Sir," or "On the
  // subject… Shri {name}, CMPF A/C No- {acct}") and sees the Hindi rendering
  // with slots filled, before committing the entry.
  const previewRendered = useMemo(() => {
    if (!sentenceForm || !previewSample.trim()) return null;
    const hindi = sentenceForm.tr.Hindi ?? "";
    return previewPhraseTranslation(sentenceForm.en, hindi, previewSample);
  }, [sentenceForm?.en, sentenceForm?.tr?.Hindi, previewSample]);

  const locked = !isLoading && !isAdmin;

  return (
    <div>
      <PageHeader
        eyebrow="Command Center · Translation Memory"
        title="Glossary"
        description="The living translation memory behind every translation — the sentence dictionary and the token tables. Add or edit an entry and the very next translation uses it; no code changes, no deploy. Custom entries always win over the seed pack."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Languages}
          label="Sentences"
          value={allSentences.length}
          hint={`${customSentences.length} custom · ${seedSentences.length} seed`}
          accent="oklch(0.72 0.14 170)"
        />
        <StatCard
          icon={BookMarked}
          label="Token rows"
          value={Object.values(SEED_TOKENS).reduce((n, t) => n + t.length, 0)}
          hint={`${customTokens.length} custom across 6 tables`}
          accent="oklch(0.7 0.14 300)"
        />
        <StatCard
          icon={BookMarked}
          label="Word tokens"
          value={Object.keys(HI_TOKENS).length}
          hint="address / designation / cell vocabulary"
        />
        <StatCard
          icon={BookMarked}
          label="Name entries"
          value={Object.keys(NAME_TABLE).length}
          hint="curated Devanagari name spellings"
          accent="oklch(0.75 0.15 55)"
        />
      </div>

      {!storageOk && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <Lock className="size-4 shrink-0 text-amber-600" />
          <p className="text-[12px] text-amber-700 dark:text-amber-400">
            Custom-entries storage is unreachable — showing the built-in seed pack. Custom
            sentences and tokens will appear here once the Convex backend is deployed.
          </p>
        </div>
      )}
      {locked && storageOk && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-border/60 bg-card/30 px-4 py-3">
          <Lock className="size-4 shrink-0 text-muted-foreground" />
          <p className="text-[12px] text-muted-foreground">
            Browsing is open to every operator — adding and editing entries is an admin action
            (the first account on a fresh deployment holds the admin keys).
          </p>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as "sentences" | "tokens")}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="sentences" className="gap-1.5">
              <Languages className="size-3.5" />
              Sentence dictionary
            </TabsTrigger>
            <TabsTrigger value="tokens" className="gap-1.5">
              <BookMarked className="size-3.5" />
              Token tables
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            {totalHits > 0 && (
              <div
                className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/40 px-2.5 py-1.5"
                title="How many times each entry was used while translating — counts are kept on this device."
              >
                <Zap className="size-3.5 text-amber-500" />
                <span className="text-[11px] font-medium text-foreground/80">
                  {totalHits} hit{totalHits === 1 ? "" : "s"} recorded
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-primary"
                  title="Reset hit counts (this device only)"
                  onClick={() => {
                    clearHits();
                    toast.success("Hit counts reset");
                  }}
                >
                  <RotateCcw className="size-3" />
                </Button>
              </div>
            )}
            {storageOk && stored && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleExport}
                disabled={saving}
                title="Download every custom sentence and token as a JSON file — the translation memory can be imported into another ODA deployment."
              >
                <Download className="size-3.5" />
                Export JSON
              </Button>
            )}
            {!locked && storageOk && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileRef.current?.click()}
                disabled={saving}
                title="Load an oda-glossary JSON export — rows already present are skipped, everything else is added in one atomic import."
              >
                <Upload className="size-3.5" />
                Import JSON
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImportFile(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {/* ---------------- Sentences ---------------- */}
        <TabsContent value="sentences" className="mt-0">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sentences or any language…"
                className="pl-9"
              />
            </div>
            {!locked && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setSentenceForm({ en: "", tr: {} })}
                disabled={saving}
              >
                <Plus className="size-3.5" />
                Add sentence
              </Button>
            )}
          </div>

          {sentenceForm && (
            <div className="mb-6 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[13.5px] font-semibold">
                  {sentenceForm.id ? "Edit sentence" : "Add a sentence"}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  onClick={() => setSentenceForm(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <Textarea
                value={sentenceForm.en}
                onChange={(e) => setSentenceForm((f) => (f ? { ...f, en: e.target.value } : f))}
                rows={3}
                placeholder='English source — use {1}, {2}… for the varying parts. Example: "The office remains closed on account of the annual stock verification on {1}."'
                className="font-serif text-[13px] leading-6"
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {SENTENCE_LANGS.map((lang) => (
                  <div key={lang}>
                    <label className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px]">
                        {LANG_CODES[lang]}
                      </span>
                      {lang}
                      {lang === "Hindi" && (
                        <span className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] font-normal">
                          primary
                        </span>
                      )}
                    </label>
                    <Textarea
                      value={sentenceForm.tr[lang] ?? ""}
                      onChange={(e) =>
                        setSentenceForm((f) =>
                          f ? { ...f, tr: { ...f.tr, [lang]: e.target.value } } : f,
                        )
                      }
                      rows={2}
                      placeholder={`${lang} translation with the same {1}, {2}… placeholders`}
                      className="font-serif text-[13px] leading-5"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] text-muted-foreground">
                Placeholders capture the values from the source line ({1} could be a date, a name
                or a number) and flow into every language template verbatim. Fill any number of
                languages — the engine uses the exact language of the requested translation and
                falls back to Hindi when a language is missing. Custom sentences match before the
                seed pack, so an identical source overrides the built-in translation.
              </p>
              <div className="mt-4 rounded-xl border border-border/60 bg-card/30 p-4">
                <p className="mb-2 text-[12px] font-medium text-muted-foreground">
                  Preview — type a concrete example to see the Hindi rendering with slots filled
                </p>
                <Input
                  value={previewSample}
                  onChange={(e) => setPreviewSample(e.target.value)}
                  placeholder='e.g. "Sir," or "On the subject… Shri Susanta Kumar Nayak, CMPF A/C No- RNJ/38/3274"'
                  className="mb-2 font-serif text-[13px]"
                />
                {previewSample && previewRendered && (
                  <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                    <p className="text-[13px] leading-5 text-foreground/90">
                      {previewRendered}
                    </p>
                  </div>
                )}
                {previewSample && !previewRendered && (
                  <p className="text-[11.5px] text-muted-foreground/60">
                    Does not match the source pattern — check the number of {"{1}"}, {"{2}"}…
                    placeholders.
                  </p>
                )}
                {!previewSample && sentenceForm.en.includes("{") && (
                  <p className="text-[11.5px] text-muted-foreground/50">
                    Type a concrete example above to see the result before saving.
                  </p>
                )}
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setSentenceForm(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveSentence} disabled={saving} className="gap-1.5">
                  <Plus className="size-3.5" />
                  {saving ? "Saving…" : sentenceForm.id ? "Save changes" : "Add sentence"}
                </Button>
              </div>
            </div>
          )}

          {filteredSentences.length === 0 && (
            <EmptyState
              icon={Languages}
              title="No sentences match"
              body="Try a different search, or add a sentence above to grow the dictionary."
            />
          )}

          <div className="space-y-2.5">
            {filteredSentences.map((s, idx) => {
              const custom = Boolean(s.id);
              return (
                <div
                  key={s.id ?? `seed-${idx}`}
                  className="rounded-xl border border-border/60 bg-card/50 px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium leading-5 text-foreground/90">{s.en}</p>
                      <p className="mt-1.5 text-[13px] leading-5 text-foreground/80">
                        {s.hi || "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={custom ? "default" : "outline"} className="text-[10px]">
                        {custom ? "custom" : "seed"}
                      </Badge>
                      {(hits[`sentence::${s.en}`] ?? 0) > 0 && (
                        <span
                          title={`${hits[`sentence::${s.en}`]} translation hit${hits[`sentence::${s.en}`] === 1 ? "" : "s"} — this entry fired while translating documents`}
                          className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
                        >
                          {hits[`sentence::${s.en}`]}×
                        </span>
                      )}
                      {s.tr && (
                        <span className="flex flex-wrap items-center gap-1">
                          {SENTENCE_LANGS.filter((l) => (s.tr![l] ?? "").trim()).map((l) => (
                            <span
                              key={l}
                              title={`${l} translation`}
                              className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {LANG_CODES[l] ?? l}
                            </span>
                          ))}
                        </span>
                      )}
                      {custom && !locked && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-primary"
                            title="Edit"
                            onClick={() =>
                              setSentenceForm({
                                id: s.id,
                                en: s.en,
                                tr: s.tr ?? { Hindi: s.hi },
                              })
                            }
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            title="Delete"
                            onClick={() => s.id && handleDelete(s.id, "Sentence")}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ---------------- Tokens ---------------- */}
        <TabsContent value="tokens" className="mt-0">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={tokenTable} onValueChange={(v) => setTokenTable(v as TokenTableName)}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOKEN_TABLES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search keys or values…"
                  className="pl-9"
                />
              </div>
            </div>
            {!locked && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setTokenForm({ table: tokenTable, key: "", value: "" })}
                disabled={saving}
              >
                <Plus className="size-3.5" />
                Add row
              </Button>
            )}
          </div>

          <p className="oda-label mb-4 !text-[10px]">{TOKEN_LABELS[tokenTable]}</p>

          {tokenForm && tokenForm.table === tokenTable && (
            <div className="mb-6 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[13.5px] font-semibold">
                  {tokenForm.id ? "Edit token row" : `Add ${tokenTable} row`}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  onClick={() => setTokenForm(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={tokenForm.key}
                  onChange={(e) => setTokenForm((f) => (f ? { ...f, key: e.target.value } : f))}
                  placeholder={tokenForm.table === "HI_PHRASES" ? "Regex pattern" : "Key"}
                />
                {tokenForm.table !== "HI_ABBR" && (
                  <Input
                    value={tokenForm.value}
                    onChange={(e) => setTokenForm((f) => (f ? { ...f, value: e.target.value } : f))}
                    placeholder={tokenForm.table === "HI_PHRASES" ? "Replacement" : "Hindi value"}
                  />
                )}
              </div>
              {tokenForm.table === "HI_ABBR" && (
                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  Abbreviation keys only — the value is implicit: the trailing period becomes a
                  comma ("HQ." → "मुख्यालय,").
                </p>
              )}
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setTokenForm(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveToken} disabled={saving} className="gap-1.5">
                  <Plus className="size-3.5" />
                  {saving ? "Saving…" : tokenForm.id ? "Save changes" : "Add row"}
                </Button>
              </div>
            </div>
          )}

          {filteredTokens.length === 0 && (
            <EmptyState
              icon={BookMarked}
              title="No rows match"
              body="Try a different search, or add a row above to extend this table."
            />
          )}

          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/50">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3.5 font-medium">Key</th>
                    <th className="px-4 py-3.5 font-medium">Value</th>
                    <th className="w-16 px-4 py-3.5 font-medium">Hits</th>
                    <th className="w-36 px-4 py-3.5 font-medium">Origin</th>
                    <th className="w-20 px-4 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredTokens.map((t, idx) => {
                    const custom = customRowsFor(tokenTable).some((r) => r.key === t.key);
                    const overrides = custom && SEED_TOKENS[tokenTable].some((s) => s.key === t.key);
                    const customId = customRowsFor(tokenTable).find((r) => r.key === t.key)?.id;
                    const tokenHits = hits[`${tokenTable}::${t.key.toLowerCase()}`] ?? 0;
                    return (
                      <tr key={`${t.key}-${idx}`} className="transition-colors hover:bg-muted/30">
                        <td className="max-w-[320px] px-4 py-3">
                          <code className="break-all font-mono text-[12px] leading-5">{t.key}</code>
                        </td>
                        <td className="max-w-[260px] px-4 py-3">
                          <span className="break-all text-[13px] leading-5">{t.value}</span>
                        </td>
                        <td className="px-4 py-3">
                          {tokenHits > 0 ? (
                            <span
                              title={`${tokenHits} translation hit${tokenHits === 1 ? "" : "s"} — this row fired while translating documents`}
                              className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
                            >
                              {tokenHits}×
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant={custom ? "default" : "outline"} className="text-[10px]">
                              {custom ? "custom" : "seed"}
                            </Badge>
                            {overrides && (
                              <Badge variant="secondary" className="text-[10px]">
                                overrides seed
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {custom && !locked && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-primary"
                                title="Edit"
                                onClick={() =>
                                  setTokenForm({
                                    id: customId,
                                    table: tokenTable,
                                    key: t.key,
                                    value: t.value === "—" ? "" : t.value,
                                  })
                                }
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                title="Delete"
                                onClick={() => customId && handleDelete(customId, "Token row")}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-8 flex items-center gap-2 rounded-xl border border-border/60 bg-card/30 px-4 py-3">
        <Languages className="size-4 shrink-0 text-chart-2" />
        <p className="text-[12px] text-muted-foreground">
          Custom entries are consulted before the seed pack on every translation path — the
          Convex forge, the on-device instant engine, and the DOCX export — with no code changes.
          Keep entries enabled to use them; deleting a custom entry restores the seed behavior.
          The amber × badges show how many times each entry actually fired while translating on
          this device (reset clears the local counts).
        </p>
      </div>
    </div>
  );
}
