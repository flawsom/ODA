"use node";

import { v } from "convex/values";
import { action, type ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { adaptiveGenerate, kitFor } from "../lib/oda/adaptive";
import { kitName } from "../lib/oda/translate";
import { reapplyLetterhead, referenceStandardPass, translateAdaptive } from "../lib/oda/refine";
import { buildOverlay, type GlossaryOverlay } from "../lib/oda/extraDict";

/** User-grown translation memory (Glossary page) — fetched once per action
 * so custom sentences/tokens apply to every translation without a deploy. */
async function loadOverlay(ctx: ActionCtx): Promise<GlossaryOverlay> {
  const rows = await ctx.runQuery(api.glossary.engineEntries);
  return buildOverlay(rows);
}
import { vly } from "../lib/vly-integrations";

// ---------------------------------------------------------------------------
// NEURAL FORGE — free-tier LLM providers
// ODA runs free forever with zero keys (the adaptive engine below). The
// platform injects VLY_INTEGRATION_KEY, so the built-in Freebuff Cloud AI
// (Tier 0) lights up with zero configuration and translates ANY document in
// full. Add ANY of the free-tier keys below in the project's Keys tab for
// more headroom. The first working provider is used; if it fails we cascade
// to the next, then degrade to the adaptive engine.
// ---------------------------------------------------------------------------

interface Provider {
  envVar: string;
  label: string;
  complete(system: string, user: string): Promise<string>;
}

const RESPONSE_SYSTEM =
  "You are ODA — the Omniscient Document Architect. You comprehend any formal document and " +
  "generate a response indistinguishable from expert human correspondence. Mirror the input's " +
  "structure, register and tone. Follow domain protocols (government, corporate, legal, academic) " +
  "and local conventions (honorifics, date formats, reference quoting). Quote the source " +
  "document's subject/reference/date and name the specific people, members, account numbers and " +
  "offices mentioned in it. Output ONLY the response document itself — no preamble, no " +
  "commentary, no markdown fences.";

const TRANSLATE_SYSTEM =
  "You are ODA — the Omniscient Document Architect. Translate the given formal document into the " +
  "requested language in a formal, professional register. Translate EVERYTHING below the letterhead: " +
  "the reference/date lines, subject and reference lines, salutation, every body paragraph, list " +
  "items, table headers and table cell content, and the closing/signature block. Leave the " +
  "letterhead untouched — organization names, logos/emblem text, office addresses, contact details, " +
  "phone numbers, emails and website lines stay exactly as they appear. Transliterate personal and " +
  "place names into the target script where natural. For official scripts (Hindi, Tamil, Bengali, " +
  "Telugu, etc.), transliterate the alphabetic components of file numbers, reference numbers and " +
  "account codes into that script (CPF/118/Misc./L.C.-Out/R-I/ASN/ → सीपीएफ/118/विविध/एल.सी.-आउट/आर-I/एएसएन/) " +
  "while keeping digits and separators unchanged, and translate table headers fully. Preserve the " +
  "document's exact structure: paragraphs, headings, table layout and signature block. Output ONLY " +
  "the translated document — no preamble, no commentary, no markdown fences.";

function buildUserPrompt(input: {
  sourceText: string;
  sourceName: string;
  sourceType: string | undefined;
  sourceLanguage: string | undefined;
  language: string;
  formality: string;
  format: string;
  task: "response" | "translate";
}): string {
  const head =
    input.task === "translate"
      ? `Translate this document into ${input.language} (formal register). Translate everything except the letterhead block at the top (organization name, office address, contact details, phone/email/website lines) — leave the letterhead exactly as-is. For Hindi, transliterate the alphabetic components of file numbers, reference numbers and account codes into Devanagari (CPF/118/… → सीपीएफ/118/…) keeping digits and separators unchanged, and translate table headers fully. Transliterate personal and place names where natural. Preserve the document's exact structure.`
      : [
          "Generate the response document with these parameters:",
          `- Response language: ${input.language}`,
          `- Formality: ${input.formality} (match the input's register)`,
          `- Target export format: ${input.format}`,
          "- Quote the source document's subject/reference/date where present.",
          "- Name the specific people, members, account numbers and offices mentioned in the source document.",
        ].join("\n");
  return [
    `INPUT DOCUMENT (${input.sourceName}${input.sourceType ? ` · classified: ${input.sourceType}` : ""})`,
    input.sourceLanguage ? `Source language: ${input.sourceLanguage}` : "",
    "",
    "--- SOURCE TEXT START ---",
    input.sourceText.slice(0, 24000),
    "--- SOURCE TEXT END ---",
    "",
    head,
  ].join("\n");
}

/** OpenAI-compatible chat completions (Fireworks, Groq, OpenAI…). */
async function chatCompletion(
  name: string,
  baseUrl: string,
  model: string,
  apiKey: string,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      max_tokens: 2400,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${name} request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error(`${name} returned an empty response`);
  return content;
}

/** Google Gemini free tier — try the strongest free Flash model, then fall
 * back to Flash-Lite (biggest free daily quota, no card). */
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

async function geminiComplete(system: string, user: string): Promise<string> {
  let lastError: unknown = null;
  for (const model of GEMINI_MODELS) {
    try {
      return await geminiGenerate(model, system, user);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini request failed");
}

async function geminiGenerate(model: string, system: string, user: string): Promise<string> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=` +
    process.env.GEMINI_API_KEY;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // Gemini has no system role — fold the persona into the first user turn.
      contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 2400 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!content) throw new Error("Gemini returned an empty response");
  return content;
}

// Order matters only when several keys are configured. Tier 0 is the built-in
// Freebuff Cloud AI (zero configuration — the platform injects
// VLY_INTEGRATION_KEY); then Gemini first (strongest free multilingual quota),
// then Fireworks, Groq, OpenAI.
const PROVIDERS: Provider[] = [
  {
    envVar: "VLY_INTEGRATION_KEY",
    label: "GPT-5 · Freebuff Cloud",
    complete: async (system, user) => {
      const res = await vly.ai.completion({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.6,
        maxTokens: 2400,
      });
      if (!res.success) {
        throw new Error(res.error ?? "Freebuff Cloud request failed");
      }
      const content = res.data?.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error("Freebuff Cloud returned an empty response");
      return content;
    },
  },
  {
    envVar: "GEMINI_API_KEY",
    label: "Gemini 2.5 Flash",
    complete: geminiComplete,
  },
  {
    envVar: "FIREWORKS_API_KEY",
    label: "Llama 3.3 70B · Fireworks",
    complete: (system, user) =>
      chatCompletion(
        "Fireworks",
        "https://api.fireworks.ai/inference/v1",
        "accounts/fireworks/models/llama-v3p3-70b-instruct",
        process.env.FIREWORKS_API_KEY!,
        system,
        user,
      ),
  },
  {
    envVar: "GROQ_API_KEY",
    label: "Llama 3.3 70B · Groq",
    complete: (system, user) =>
      chatCompletion(
        "Groq",
        "https://api.groq.com/openai/v1",
        "llama-3.3-70b-versatile",
        process.env.GROQ_API_KEY!,
        system,
        user,
      ),
  },
  {
    envVar: "OPENAI_API_KEY",
    label: "GPT-4o mini",
    complete: (system, user) =>
      chatCompletion(
        "OpenAI",
        "https://api.openai.com/v1",
        "gpt-4o-mini",
        process.env.OPENAI_API_KEY!,
        system,
        user,
      ),
  },
];

/** Public action so the client knows whether free cloud keys are configured
 * and can prefer the strongest available engine. Never exposes the keys. */
export const getProviders = action({
  handler: async (): Promise<string[]> => {
    return PROVIDERS.filter((p) => process.env[p.envVar]).map((p) => p.label);
  },
});

interface DraftInput {
  sourceText: string;
  sourceName: string;
  sourceType: string | undefined;
  sourceLanguage: string | undefined;
  language: string;
  formality: string;
  format: string;
}

async function draftWithProviders(
  input: DraftInput,
  task: "response" | "translate",
): Promise<{ content: string; provider: string } | null> {
  const system = task === "translate" ? TRANSLATE_SYSTEM : RESPONSE_SYSTEM;
  const configured = PROVIDERS.filter((p) => process.env[p.envVar]);
  const failures: string[] = [];
  for (const provider of configured) {
    try {
      const content = await provider.complete(system, buildUserPrompt({ ...input, task }));
      return { content, provider: provider.label };
    } catch (err) {
      failures.push(`${provider.label}: ${err instanceof Error ? err.message : "Unknown AI error"}`);
    }
  }
  if (failures.length > 0) {
    console.warn(`[ODA] All AI providers failed (${task}):`, failures.join(" | "));
  }
  return null;
}

async function loadDocument(ctx: ActionCtx, documentId: Doc<"documents">["_id"], userId: string) {
  const doc: Doc<"documents"> | null = await ctx.runQuery(api.documents.get, {
    id: documentId,
  });
  if (!doc || doc.userId !== userId) throw new Error("Document not found");
  if (!doc.text || doc.text.trim().length === 0) {
    throw new Error("This document has no extractable text — generation requires a text layer.");
  }
  return doc;
}

// ---------------------------------------------------------------------------
// ACTIONS
// ---------------------------------------------------------------------------

export const generateResponse = action({
  args: {
    documentId: v.id("documents"),
    language: v.string(),
    formality: v.string(),
    format: v.string(),
  },
  handler: async (ctx, args): Promise<{ responseId: Doc<"responses">["_id"]; strategy: "ai" | "adaptive"; content: string }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const doc = await loadDocument(ctx, args.documentId, userId);

    const config: DraftInput = {
      sourceText: doc.text!,
      sourceName: doc.name,
      sourceType: doc.type,
      sourceLanguage: doc.language,
      language: args.language,
      formality: args.formality,
      format: args.format,
    };

    let content: string;
    let strategy: "ai" | "adaptive" = "adaptive";
    let providerLabel: string | null = null;

    const draft = await draftWithProviders(config, "response");
    if (draft) {
      content = draft.content;
      strategy = "ai";
      providerLabel = draft.provider;
    } else {
      content = adaptiveGenerate(doc, args).content;
    }

    if (strategy === "ai" && providerLabel) {
      content += `\n\n— Drafted by ODA Neural Forge · ${providerLabel} · free forever`;
    }

    const responseId = await ctx.runMutation(api.responses.create, {
      documentId: doc._id,
      documentName: doc.name,
      content,
      language: args.language,
      formality: args.formality,
      format: args.format,
      strategy,
      kind: "response",
      sourceFormat: doc.format,
    });

    return { responseId, strategy, content };
  },
});

export const translateDocument = action({
  args: {
    documentId: v.id("documents"),
    language: v.string(),
    formality: v.string(),
    format: v.string(),
  },
  handler: async (ctx, args): Promise<{ responseId: Doc<"responses">["_id"]; strategy: "ai" | "adaptive"; content: string; complete: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const doc = await loadDocument(ctx, args.documentId, userId);

    const config: DraftInput = {
      sourceText: doc.text!,
      sourceName: doc.name,
      sourceType: doc.type,
      sourceLanguage: doc.language,
      language: args.language,
      formality: args.formality,
      format: args.format,
    };

    let content: string;
    let strategy: "ai" | "adaptive" = "adaptive";
    let complete = true;
    let providerLabel: string | null = null;

    const overlay = await loadOverlay(ctx);
    const draft = await draftWithProviders(config, "translate");
    if (draft) {
      content = draft.content;
      strategy = "ai";
      providerLabel = draft.provider;
      // Hindi output gets the reference-standard transliteration pass so file
      // numbers, account codes and member names read in Devanagari even when
      // the model kept them in Latin.
      if (kitName(kitFor(args.language)) === "Hindi") {
        content = referenceStandardPass(content, overlay);
      }
      // Letterhead guarantee: whatever the model emitted above the first
      // structural line is replaced with the exact source letterhead — the
      // header is byte-identical to the input across every output.
      content = reapplyLetterhead(content, doc.text!);
    } else {
      // The hard export gate (fidelity PRD §4.3): the record remembers
      // whether the deterministic tier left any line untranslated, so the UI
      // can warn before an incomplete translation ships.
      const res = translateAdaptive(doc, args, overlay);
      content = res.content;
      complete = res.complete;
    }

    if (strategy === "ai" && providerLabel) {
      content += `\n\n— Translated by ODA Neural Forge · ${providerLabel} · free forever`;
    }

    const responseId = await ctx.runMutation(api.responses.create, {
      documentId: doc._id,
      documentName: doc.name,
      content,
      language: args.language,
      formality: args.formality,
      format: args.format,
      strategy,
      kind: "translation",
      sourceFormat: doc.format,
    });

    return { responseId, strategy, content, complete };
  },
});
