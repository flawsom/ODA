# ODA — Omniscient Document Architect

> Every document. Understood. Answered.

ODA is a free-forever, open-source web app that ingests formal documents — complaints,
legal notices, transfer orders, requests, invoices — understands their structure,
language and register, and drafts a response in kind. No API keys, no credit cards,
no usage meter. Documents are understood **on your device**, the archive is yours,
and every byte can be exported.

Built with **React + Vite + TypeScript + Convex + Convex Auth + Tailwind v4 + shadcn/ui + Framer Motion**, and runs with **Bun**.

---

## The three pillars

| Pillar | What it does |
| ------ | ------------ |
| **I · The Omni-Viewer** | Read any ingested document with a paper-style text layer, entity highlighting (dates, references, amounts, names, emails, phones), and a "Teach the system" classifier-correction panel. |
| **II · The Ingestion Portal** | Drag-and-drop batch ingestion with a live processing queue. Text is extracted **in your browser** — TXT/MD/CSV/JSON/HTML/RTF/YAML/XML natively, DOCX via mammoth, PDF via pdf.js (text layer only). Script, language, document type, domain and formality are auto-detected per file. Unreadable formats are flagged with a clear reason and **never silently dropped**; originals are stored in Convex file storage. |
| **III · The Dispatch Forge** | Forge a response that mirrors the input's structure, register and references — with output language (24 options), formality and format controls — then export drafts as **DOCX, TXT, Markdown, HTML or JSON**. Batch generation works from the archive. |

Plus a **public catalog** (`/catalog`): every document type the office accepts, each
with a starter template. Customers browse, pick one, fill in the specifics, and land
in the compose flow with their filing pre-filled — even across the sign-in round-trip.

## The Forge: three tiers, all free

Every draft is produced by one of three engines, and the UI labels which one:

1. **On-device neural forge (no keys, best keyless quality)** — a real LLM,
   **Qwen2.5-1.5B-Instruct**, runs in the browser via [Transformers.js](https://huggingface.co/docs/transformers.js)
   (WebGPU when available, WASM everywhere). The ~1 GB model downloads once
   (~1 GB, q4) with live progress and is cached by the browser. Multilingual,
   fully private: the document never leaves the machine.
2. **Instant deterministic engine (no keys, zero download)** — the adaptive engine
   drafts immediately in 24 languages, mirroring the input's subject, reference
   numbers, dates, salutation and register. Used automatically if the neural model
   can't load (offline, no WebGPU, blocked download). Nothing ever breaks.
3. **Server neural forge (optional free keys)** — batch generation in the archive
   cascades through **Gemini 2.5 Flash → Fireworks (Llama 3.3 70B) → Groq (Llama 3.3 70B) → OpenAI (GPT-4o mini)**, then the adaptive engine. Any single key upgrades large-scale drafting; zero keys still works end to end.

## The GitHub Actions forge

Open-source means the forge also runs on free CI compute, with no API keys:

- **`forge.yml`** — the nightly "Master Forge" (02:00 UTC + manual dispatch). Installs
  Ollama on the free runner, serves the best open-weights model that fits
  (**Qwen2.5 7B q4** default; larger models via `workflow_dispatch` on bigger
  runners), forges every bundled sample, uploads `FORGE_REPORT.md` + JSON artifacts,
  and commits the report back.
- **`forge-on-demand.yml`** — the drop-folder auto-forge: commit any document into
  `inbox/`, and the workflow drafts a reply into `outbox/<name>.response.md`,
  committed back automatically. Already-forged files are skipped; a
  `forge-manifest.json` tracks everything.
- **`pages.yml`** — publishes the browsable report site to GitHub Pages (set Pages
  source to **GitHub Actions** once).
- **`ci.yml`** — forge smoke test on every push/PR (zero keys), plus full
  typecheck + build when a `CONVEX_DEPLOY_KEY` secret is present (Convex's
  generated types are gitignored, so CI regenerates them first).

The harness behind all of this is `scripts/forge-bench.ts`; run it locally with
`bun scripts/forge-bench.ts --dry-run`.

## Environment variables

| Variable | Where | Purpose |
| -------- | ----- | ------- |
| `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL` | client (set automatically) | Convex connection |
| `JWKS`, `JWT_PRIVATE_KEY`, `SITE_URL` | Convex backend (set automatically) | Convex Auth (email OTP + anonymous) |
| `GEMINI_API_KEY` | Convex backend, optional | Enables Gemini in the server forge chain |
| `FIREWORKS_API_KEY` | Convex backend, optional | Enables Fireworks (Llama 3.3 70B) |
| `GROQ_API_KEY` | Convex backend, optional | Enables Groq (Llama 3.3 70B) |
| `OPENAI_API_KEY` | Convex backend, optional | Enables OpenAI (GPT-4o mini) |

None are required. Paste any key into the project's Keys / API keys tab; one is
enough, more adds resilience.

## Getting started

```bash
bun install
bun convex dev --once   # generate Convex types (also pushed to the deployment)
bun tsc -b --noEmit     # typecheck
```

The platform runs the dev server and Convex dev process in managed background
sessions; edits are picked up automatically. Never run `bun run dev` yourself.

The first account on a fresh deployment is auto-promoted to **admin** (server-
guarded, never overwrites an existing admin). Admins see the back-office area:
accounts, documents, responses, catalog entries, user roles, and catalog CRUD.

## Data portability & privacy

- Ingestion and single-document generation run **entirely in the browser** — no
  server sees the text.
- The archive can be exported at any time ("Export my archive" in the Overview):
  a JSON bundle of every document and response, plus your originals.
- Deleting a document removes its response, its storage file and its record —
  cascade deletes on the backend.
- **License: MIT** — fork it, self-host it, and make it yours.

## Repository layout

```
src/
  convex/          backend: schema, users, documents, responses, catalog, admin
  pages/           Landing, Catalog(+item), Auth, Dashboard + nested routes
  components/oda/  shared dashboard bits
  lib/oda/         client intelligence: analyze, extract, engine, localForge, samples, export
scripts/
  forge-bench.ts   headless forge harness (used by GitHub Actions)
  publish-report.mjs   renders the nightly report site for GitHub Pages
.github/workflows/ forge.yml · forge-on-demand.yml · pages.yml · ci.yml
inbox/  outbox/    drop-folder auto-forge folders (document in, response out)
```
