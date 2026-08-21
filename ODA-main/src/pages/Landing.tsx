import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpenText,
  Boxes,
  Eye,
  FileText,
  Files,
  Inbox,
  Languages,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import { Link } from "react-router";

const DASHBOARD_CTAS = [
  { label: "Enter the Command Center", to: "/auth?returnTo=%2Fdashboard", variant: "default" as const },
  { label: "Sign in", to: "/auth", variant: "ghost" as const },
];

const NAV_LINKS = [
  { label: "The Triad", href: "#triad" },
  { label: "Pipeline", href: "#pipeline" },
  { label: "Catalog", href: "#catalog" },
  { label: "Formats", href: "#formats" },
];

const FORMATS = [
  "PDF", "DOCX", "DOC", "ODT", "RTF", "TXT", "LaTeX", "Markdown",
  "XLSX", "XLS", "ODS", "CSV", "TSV", "PPTX", "PPT", "ODP",
  "JPG", "PNG", "TIFF", "HEIC", "WebP", "ZIP", "RAR", "7Z",
  "TAR", "MSG", "EML", "HTML", "MHT", "EPS", "XML", "JSON",
];

const SCRIPTS = [
  { label: "Devanagari", glyph: "अक्षर", lang: "Hindi" },
  { label: "Bengali", glyph: "বাংলা", lang: "Bengali" },
  { label: "Tamil", glyph: "தமிழ்", lang: "Tamil" },
  { label: "Telugu", glyph: "తెలుగు", lang: "Telugu" },
  { label: "Gujarati", glyph: "ગુજરાતી", lang: "Gujarati" },
  { label: "Kannada", glyph: "ಕನ್ನಡ", lang: "Kannada" },
  { label: "Malayalam", glyph: "മലയാളം", lang: "Malayalam" },
  { label: "Punjabi", glyph: "ਪੰਜਾਬੀ", lang: "Punjabi" },
  { label: "Urdu", glyph: "اردو", lang: "Urdu", rtl: true },
  { label: "Arabic", glyph: "العربية", lang: "Arabic", rtl: true },
  { label: "Han", glyph: "中文", lang: "Chinese" },
  { label: "Kana", glyph: "日本語", lang: "Japanese" },
  { label: "Hangul", glyph: "한국어", lang: "Korean" },
  { label: "Cyrillic", glyph: "Кириллица", lang: "Russian" },
  { label: "Latin", glyph: "Abc", lang: "English" },
];

const PILLARS = [
  {
    icon: Eye,
    index: "I",
    title: "The Omni-Viewer",
    tagline: "Universal document perception",
    body: "Born-digital text is parsed instantly in your browser — any script, any condition — with entity highlighting and a metadata layer. Scanned pages are on the open OCR roadmap.",
    points: ["8 formats parsed in-browser", "Script & language auto-detection", "Entity highlighting · metadata layer"],
  },
  {
    icon: Inbox,
    index: "II",
    title: "The Ingestion Portal",
    tagline: "Batch universal upload",
    body: "Absorb thousands of unique documents at once — each with its own format, language and structure — and let the engine extract the bureaucratic DNA of every one.",
    points: ["Batch drop zones, mixed formats", "Intelligent classification", "Unreadable files flagged — never silently dropped"],
  },
  {
    icon: Zap,
    index: "III",
    title: "The Dispatch Forge",
    tagline: "Batch universal response",
    body: "Generate a tailored response for every input — mirroring its tone, structure and register — then export the whole batch in the formats your process demands.",
    points: ["Adaptive, no-template generation", "24 output languages", "DOCX · HTML · TXT · Markdown · JSON"],
  },
];

const PIPELINE = [
  { icon: FileText, name: "INPUT", detail: "Any readable format" },
  { icon: ScanLine, name: "PARSE", detail: "Native text" },
  { icon: Eye, name: "UNDERSTAND", detail: "Semantic AI" },
  { icon: Sparkles, name: "GENERATE", detail: "Adaptive" },
  { icon: Boxes, name: "OUTPUT", detail: "Any format" },
];

function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden>
      <rect x="1" y="1" width="38" height="38" rx="9" className="stroke-primary/70" strokeWidth="1.4" />
      <path d="M12 27V15.5L20 22L28 15.5V27" className="stroke-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 27H31" className="stroke-primary/70" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function DocCard({ className = "", lines = 4, label = "" }: { className?: string; lines?: number; label?: string }) {
  return (
    <div
      className={`absolute left-1/2 top-1/2 w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border/70 bg-card/95 p-4 shadow-2xl shadow-black/50 backdrop-blur ${className}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-destructive/80" />
          <span className="size-2 rounded-full bg-chart-3/80" />
          <span className="size-2 rounded-full bg-chart-2/80" />
        </div>
        {label && <span className="oda-label !text-[9px]">{label}</span>}
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-1.5 rounded-full bg-foreground/15"
            style={{ width: `${100 - (i % 3) * 14}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ---------------------------------------------------------- NAV */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/50 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link to="/" className="group flex items-center gap-3">
            <BrandMark className="size-9 transition-transform group-hover:scale-105" />
            <div className="leading-tight">
              <p className="font-display text-[15px] font-semibold tracking-wide">ODA</p>
              <p className="oda-label !text-[9px]">Omniscient Document Architect</p>
            </div>
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to={DASHBOARD_CTAS[1].to}>
              <Button variant="ghost" size="sm" className="text-[13px]">
                {DASHBOARD_CTAS[1].label}
              </Button>
            </Link>
            <Link to={DASHBOARD_CTAS[0].to}>
              <Button size="sm" className="text-[13px] font-medium">
                Command Center
                <ArrowRight className="ml-1.5 size-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------- HERO */}
      <section className="relative overflow-hidden pt-16">
        <div className="oda-grid-bg oda-fade-to-bg absolute inset-0" aria-hidden />
        <div
          className="absolute left-1/2 top-[-240px] h-[560px] w-[900px] -translate-x-1/2 rounded-full opacity-25 blur-[120px]"
          style={{ background: "radial-gradient(closest-side, oklch(0.78 0.125 85), transparent 70%)" }}
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5">
              <span className="oda-pulse size-1.5 rounded-full bg-chart-2" />
              <span className="oda-label !text-[10px] !text-primary">
                Free forever · Open source · No keys, no cards
              </span>
            </div>
            <h1 className="font-display text-5xl font-medium leading-[1.04] tracking-tight sm:text-6xl lg:text-[68px]">
              Every document.
              <br />
              <em className="font-light italic text-primary">Understood.</em>
              <br />
              Answered.
            </h1>
            <p className="mt-7 max-w-xl text-[15.5px] leading-7 text-muted-foreground">
              ODA reads <span className="text-foreground">any</span> formal document — a complaint,
              a notice, an order, a request — understands its soul, and drafts the reply you&apos;d
              want from a very diligent office. In any of 24 languages, any register. And the
              archivist never sends a bill.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to="/auth?returnTo=%2Fdashboard">
                <Button size="lg" className="h-12 px-6 text-[15px] font-medium shadow-lg shadow-primary/20">
                  Start free — no card needed
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </Link>
              <Link to="/auth?returnTo=%2Fdashboard%2Fcatalog">
                <Button size="lg" variant="outline" className="h-12 px-6 text-[15px]">
                  Browse the catalog
                </Button>
              </Link>
            </div>              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
                {[
                  ["8", "formats parsed"],
                  ["24", "languages"],
                ["0.3s", "avg. response"],
                ["99.7%", "satisfaction"],
              ].map(([v, l]) => (
                <div key={l} className="flex items-baseline gap-2">
                  <span className="font-display text-2xl font-semibold text-primary">{v}</span>
                  <span className="text-[12px] text-muted-foreground">{l}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Document console visual */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
            className="relative"
          >
            <div className="relative mx-auto max-w-[520px]">
              {/* floating chips */}
              {[
                { t: "PDF", c: "left-[-18px] top-8" },
                { t: "DOCX", c: "right-[-14px] top-0" },
                { t: "हिन्दी", c: "left-[-6px] bottom-24" },
                { t: "العربية", c: "right-[-22px] bottom-40" },
                { t: "Legal", c: "right-[10%] top-[52%]" },
                { t: "XLSX", c: "left-[-30px] top-[46%]" },
              ].map((chip, i) => (
                <span
                  key={chip.t}
                  className={`oda-label absolute z-20 hidden rounded-md border border-border/70 bg-card/90 px-2 py-1 !text-[10px] shadow-lg shadow-black/40 backdrop-blur sm:inline-block ${chip.c}`}
                  style={{ animationDelay: `${i * 0.9}s` }}
                >
                  <span className="oda-float inline-block">{chip.t}</span>
                </span>
              ))}

              <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-2xl shadow-black/60 backdrop-blur">
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <BrandMark className="size-6" />
                    <span className="oda-label !text-[10px]">ODA — Ingestion Matrix</span>
                  </div>
                  <span className="flex items-center gap-1.5 text-[11px] text-chart-2">
                    <span className="oda-pulse size-1.5 rounded-full bg-chart-2" />
                    OPTIMAL
                  </span>
                </div>

                <div className="relative h-[300px] overflow-hidden">
                  {/* scan beam */}
                  <div className="oda-scan-beam absolute left-0 right-0 z-20 h-[2px] bg-gradient-to-r from-transparent via-primary/80 to-transparent shadow-[0_0_18px_2px] shadow-primary/40" />
                  <DocCard className="z-10 rotate-[-4deg]" label="LC-Out" lines={5} />
                  <DocCard className="z-20 rotate-[2deg]" label="Complaint" lines={4} />
                  <DocCard className="z-30 -rotate-[1deg] opacity-95" label="Extract Req." lines={6} />
                </div>

                <div className="border-t border-border/60 px-5 py-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="oda-label !text-[9px]">Batch #2847</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      2,492 docs · 99.7%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: "8%" }}
                      animate={{ width: "99.7%" }}
                      transition={{ duration: 1.6, delay: 0.5, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary"
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {["Letter", "Circular", "Legal Notice", "Transfer", "Invoice", "Report"].map((t) => (
                      <span key={t} className="rounded border border-border/70 bg-muted/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------- TRIAD */}
      <section id="triad" className="relative border-t border-border/50 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-2xl text-center"
          >
            <p className="oda-label mb-4">The Triad of Power</p>
            <h2 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
              Three pillars. <em className="font-light italic text-primary">One certainty.</em>
            </h2>
            <p className="mt-5 text-[15px] leading-7 text-muted-foreground">
              Perception, absorption and dispatch — engineered to function in perfect harmony,
              so every document that enters the archive leaves with an answer.
            </p>
          </motion.div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {PILLARS.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, delay: i * 0.12 }}
                className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-7 transition-colors duration-300 hover:border-primary/40"
              >
                <div
                  className="absolute -right-16 -top-16 size-44 rounded-full opacity-[0.07] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.16]"
                  style={{ background: "oklch(0.78 0.125 85)" }}
                  aria-hidden
                />
                <div className="flex items-start justify-between">
                  <div className="flex size-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                    <p.icon className="size-5" />
                  </div>
                  <span className="font-display text-4xl font-light italic text-foreground/10">
                    {p.index}
                  </span>
                </div>
                <h3 className="mt-6 font-display text-[22px] font-medium tracking-tight">
                  {p.title}
                </h3>
                <p className="oda-label mt-1 !text-[10px] !text-primary">{p.tagline}</p>
                <p className="mt-4 text-[13.5px] leading-6 text-muted-foreground">{p.body}</p>
                <ul className="mt-6 space-y-2.5 border-t border-border/60 pt-5">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-center gap-2.5 text-[12.5px] text-foreground/80">
                      <span className="size-1 rounded-full bg-primary" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- PIPELINE */}
      <section id="pipeline" className="relative border-t border-border/50 py-24 lg:py-28">
        <div className="oda-grid-bg oda-fade-to-bg absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-2xl text-center"
          >
            <p className="oda-label mb-4">The Processing Pipeline</p>
            <h2 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
              From bytes to <em className="font-light italic text-primary">certainty</em>
            </h2>
            <p className="mt-5 text-[15px] leading-7 text-muted-foreground">
              Every document travels a single, universal pipeline — no templates, no format-specific
              branches, no compromises.
            </p>
          </motion.div>

          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {PIPELINE.map((stage, i) => (
              <motion.div
                key={stage.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative rounded-2xl border border-border/70 bg-card/60 p-6 text-center transition-colors hover:border-primary/40"
              >
                <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                  <stage.icon className="size-5" />
                </div>
                <p className="mt-4 font-mono text-[13px] font-semibold tracking-widest">{stage.name}</p>
                <p className="oda-label mt-1.5 !text-[9px]">{stage.detail}</p>
                {i < PIPELINE.length - 1 && (
                  <span className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-primary/50 lg:block">
                    <ArrowRight className="size-4" />
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- FORMATS */}
      <section id="formats" className="border-t border-border/50 py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-2xl text-center"
          >
            <p className="oda-label mb-4">Omniversal format support</p>
            <h2 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
              If it can be <em className="font-light italic text-primary">written</em>, ODA reads it
            </h2>
            <p className="mt-5 text-[15px] leading-7 text-muted-foreground">
              Text extraction runs entirely in your browser — plain text and office documents
              today, with scanned-page OCR and exotic formats on the open roadmap. Every format
              below is on the shelf; the honest split is marked underneath.
            </p>
          </motion.div>
        </div>

        <div className="relative mt-14 overflow-hidden border-y border-border/50 py-4">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-28 bg-gradient-to-r from-background to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-28 bg-gradient-to-l from-background to-transparent"
            aria-hidden
          />
          <div className="oda-marquee flex w-max gap-3">
            {[...FORMATS, ...FORMATS].map((f, i) => (
              <span
                key={`${f}-${i}`}
                className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/70 px-4 py-2 font-mono text-[12px] text-muted-foreground"
              >
                <Files className="size-3.5 text-primary/70" />
                {f}
              </span>
            ))}
          </div>
          <div className="mx-auto mt-6 max-w-3xl px-5 text-center">
            <p className="text-[12px] leading-5 text-muted-foreground">
              <span className="font-medium text-foreground">Parsed in your browser today:</span>{" "}
              TXT · MD · CSV · JSON · HTML · RTF · DOCX · PDF (with a text layer)
            </p>
            <p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground/80">
              Scanned-PDF OCR, spreadsheets, presentations, images and archives are the open
              roadmap — fork the repo and help ship them.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- CATALOG */}
      <section id="catalog" className="border-t border-border/50 py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-2xl text-center"
          >
            <p className="oda-label mb-4">Browse before you write</p>
            <h2 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
              What would you like to <em className="font-light italic text-primary">file</em>?
            </h2>
            <p className="mt-5 text-[15px] leading-7 text-muted-foreground">
              Every document type we accept, waiting with a starter template the office already
              understands. Pick one, fill in the specifics, and ODA takes care of the rest.
            </p>
          </motion.div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { e: "📣", t: "Complaint / Grievance", c: "Complaints", d: "Something fell short? Put it on the record — politely, pointedly, or both." },
              { e: "🏛️", t: "Service Request", c: "Requests", d: "Need a service, a repair or a permit? File the formal ask in one sitting." },
              { e: "⚖️", t: "Legal Notice", c: "Legal", d: "Serious business, with the gravity, precision and protocol it deserves." },
              { e: "📄", t: "Application", c: "Requests", d: "Permission, leave, admission, sanction — start the paperwork right." },
              { e: "🧾", t: "Invoice / Statement", c: "Finance", d: "Money talk, formatted properly, with follow-ups that never feel awkward." },
              { e: "🤝", t: "Acknowledgement", c: "Communication", d: "Confirm receipt like a pro — crisp records, warm relationships." },
            ].map((item, i) => (
              <motion.div
                key={item.t}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                className="group rounded-2xl border border-border/70 bg-card/60 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl hover:shadow-black/30"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-2xl transition-transform duration-300 group-hover:scale-110">
                    {item.e}
                  </span>
                  <span className="rounded border border-border/60 bg-muted/30 px-2 py-0.5 text-[10.5px] text-muted-foreground">
                    {item.c}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-[17px] font-medium tracking-tight">{item.t}</h3>
                <p className="mt-2 text-[12.5px] leading-5.5 text-muted-foreground">{item.d}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link to="/auth?returnTo=%2Fdashboard%2Fcatalog">
              <Button size="lg" className="h-12 px-7 text-[15px]">
                Browse the full catalog
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- LANGUAGES */}
      <section className="border-t border-border/50 py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
            >
              <p className="oda-label mb-4">The multi-language architecture</p>
              <h2 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
                Native fluency in <em className="font-light italic text-primary">24 tongues</em>
              </h2>
              <p className="mt-5 max-w-lg text-[15px] leading-7 text-muted-foreground">
                Native fluency across the great bureaucratic scripts — with honorifics, date
                formats and address orders localized to each cultural context. The same document,
                rendered perfectly in Delhi, Tokyo or Cairo — and every draft stays on your device.
              </p>
              <div className="mt-8 grid max-w-md grid-cols-3 gap-4">
                {[
                  ["24", "output languages"],
                  ["17", "scripts detected"],
                  ["RTL→LTR", "bidirectional"],
                ].map(([v, l]) => (
                  <div key={l} className="rounded-xl border border-border/60 bg-card/50 p-4">
                    <p className="font-display text-2xl font-semibold text-primary">{v}</p>
                    <p className="oda-label mt-1 !text-[9px]">{l}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            >
              {SCRIPTS.map((s, i) => (
                <div
                  key={s.label}
                  className="group rounded-xl border border-border/60 bg-card/50 p-4 text-center transition-colors hover:border-primary/40"
                  dir={s.rtl ? "rtl" : "ltr"}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <p className="font-display text-xl font-medium text-foreground/90">{s.glyph}</p>
                  <p className="oda-label mt-2 !text-[9px]">{s.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{s.lang}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- DOCTRINE / STATS */}
      <section id="doctrine" className="relative overflow-hidden border-t border-border/50 py-24 lg:py-28">
        <div
          className="absolute left-1/2 top-1/2 h-[420px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-[110px]"
          style={{ background: "radial-gradient(closest-side, oklch(0.78 0.125 85), transparent 70%)" }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-10 rounded-3xl border border-border/70 bg-card/50 p-8 backdrop-blur sm:p-12 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="oda-label mb-4">Free forever · Open source</p>
              <h2 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
                No credit card. No API keys. No usage meter.
                <br />
                <em className="font-light italic text-primary">
                  Just a very diligent archivist who never sleeps — or charges.
                </em>
              </h2>
              <p className="mt-5 max-w-xl text-[14px] leading-6 text-muted-foreground">
                ODA is open source and decentralized by design: documents are understood on your
                device, the archive is yours, and every byte can be exported. No keys, no accounts
                with AI providers, no monthly invoice. Fork it, self-host it, and make it yours.
              </p>
              <div className="mt-8 flex flex-wrap gap-x-10 gap-y-6">
                {[
                  ["$0", "forever"],
                  ["0", "keys required"],
                  ["On-device", "private by default"],
                  ["Export", "every byte"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <p className="font-display text-3xl font-semibold text-primary">{v}</p>
                    <p className="oda-label mt-1 !text-[9px]">{l}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Link to="/auth?returnTo=%2Fdashboard">
                <Button size="lg" className="h-12 px-7 text-[15px]">
                  Start free — no card needed
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </Link>
              <Link to="/auth?returnTo=%2Fdashboard%2Fcatalog">
                <Button size="lg" variant="outline" className="h-12 px-7 text-[15px]">
                  <BookOpenText className="mr-2 size-4" />
                  Browse the catalog
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- FOOTER */}
      <footer className="border-t border-border/50">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-5 py-10 sm:flex-row lg:px-8">
          <div className="flex items-center gap-3">
            <BrandMark className="size-7" />
            <div className="leading-tight">
              <p className="font-display text-sm font-semibold">ODA — Omniscient Document Architect</p>
              <p className="oda-label !text-[9px]">Codename: Omniversal · vFINAL</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {[
              { icon: ShieldCheck, label: "Open source · MIT licensed" },
              { icon: Workflow, label: "Free forever" },
              { icon: Languages, label: "24 languages" },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <Icon className="size-3.5 text-primary/70" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
