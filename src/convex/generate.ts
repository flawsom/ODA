"use node";

import { v } from "convex/values";
import { action, type ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { adaptiveGenerate } from "../lib/oda/adaptive";
import { reapplyLetterhead, referenceStandardPass, translateAdaptive } from "../lib/oda/refine";
import {
  buildOverlay,
  enforceGlossary,
  glossaryPromptBlock,
  type GlossaryOverlay,
} from "../lib/oda/extraDict";
import { rateTranslation, referenceDecision } from "../lib/oda/rating";
import { ensureComplete, estimateCompleteness, translateDocumentFully } from "../lib/oda/neuralTranslate";
import {
  buildUserPrompt,
  RESPONSE_SYSTEM,
  TRANSLATE_SYSTEM,
} from "../lib/oda/neuralPrompts";
import { sweepLeftoverLines } from "../lib/oda/translate";

/** User-grown translation memory (Glossary page) — fetched once per action
 * so custom sentences/tokens apply to every translation without a deploy. */
async function loadOverlay(ctx: ActionCtx): Promise<GlossaryOverlay> {
  const rows = await ctx.runQuery(api.glossary.engineEntries);
  return buildOverlay(rows);
}
import { vly } from "../lib/vly-integrations";

// ---------------------------------------------------------------------------
// NEURAL FORGE — LLM providers
// ODA runs free forever with zero keys (the adaptive engine below). The
// platform injects VLY_INTEGRATION_KEY, so the built-in Freebuff Cloud AI
// (Tier 0) lights up with zero configuration. Add any key below in the
// project's Keys tab for more headroom.
//
// APIMaster (apimaster.ai) is the strongest tier when its key is configured:
// OpenAI-compatible, GPT-5.x at a deep discount. Default model is
// gpt-5.6-luna — the cheapest of the 5.6 generation ($0.20/$1.20 per 1M
// tokens, ~25x under Sol) with far lower token burn than the reasoning
// models, ideal for always-on formal-document work. Override with the
// APIMASTER_MODEL env var: gpt-5.4, gpt-5.4-mini, gpt-5.5, gpt-5.6-luna,
// gpt-5.6-sol, gpt-5.6-terra.
//
// The first working provider is used; if it fails we cascade to the next,
// then degrade to the adaptive engine.
// ---------------------------------------------------------------------------

interface Provider {
  envVar: string;
  label: string;
  complete(system: string, user: string): Promise<string>;
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
      max_tokens: 8192,
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
      generationConfig: { temperature: 0.6, maxOutputTokens: 8192 },
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

// Order matters only when several keys are configured. APIMaster first
// (strongest model when the user's key is set — absolute best quality); then
// Tier 0 Freebuff Cloud AI (zero configuration — the platform injects
// VLY_INTEGRATION_KEY); then Gemini (strongest free multilingual quota),
// then Fireworks, Groq, OpenAI.
const PROVIDERS: Provider[] = [
  {
    envVar: "APIMASTER_API_KEY",
    label: "GPT-5.6 Luna · APIMaster",
    complete: (system, user) =>
      chatCompletion(
        "APIMaster",
        "https://apimaster.ai/v1",
        process.env.APIMASTER_MODEL ?? "gpt-5.6-luna",
        process.env.APIMASTER_API_KEY!,
        system,
        user,
      ),
  },
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
        maxTokens: 8192,
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
  overlay?: GlossaryOverlay,
): Promise<{ content: string; provider: string } | null> {
  const system = task === "translate" ? TRANSLATE_SYSTEM : RESPONSE_SYSTEM;
  const configured = PROVIDERS.filter((p) => process.env[p.envVar]);
  const failures: string[] = [];
  for (const provider of configured) {
    try {
      const user = buildUserPrompt({ ...input, task });
      // Neural training memory: the user's confidential glossary becomes a
      // constraint block in the prompt (translations only — never sent for
      // response drafting). `enforceGlossary` backstops it deterministically.
      const memory =
        task === "translate" && overlay ? `${user}\n${glossaryPromptBlock(overlay, input.language)}` : user;
      const content = await provider.complete(system, memory);
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

/**
 * The segmented, never-truncated, never-partial translation path. Any
 * document length is split into paragraph-aligned segments (each well under
 * the output budget), translated segment by segment through the provider
 * cascade (the first working provider is remembered for the remaining
 * segments), stitched, then run through the deterministic passes.
 *
 * THE GUARANTEE — failure is not an option: the orchestrator repairs every
 * segment round by round, re-translates the stitched whole, then splices
 * line-only repairs; whatever the model STILL cannot translate is finished
 * by the deterministic floor (phonetic Devanagari) before the final gate, so
 * an English prose line can never ship. `complete` is true exactly when the
 * final gate passes.
 *
 * Returns null only when no provider is configured (or every provider
 * failed) — callers then degrade to the adaptive engine.
 */
async function neuralTranslateFull(
  input: DraftInput,
  overlay: GlossaryOverlay,
  referenceSource: string,
): Promise<{ content: string; complete: boolean; provider: string } | null> {
  const configured = PROVIDERS.filter((p) => process.env[p.envVar]);
  if (configured.length === 0) return null;
  let working: Provider | null = null;
  const callNeural = async (system: string, user: string): Promise<string> => {
    if (working) {
      try {
        return await working.complete(system, user);
      } catch {
        working = null;
      }
    }
    const failures: string[] = [];
    for (const provider of configured) {
      try {
        const content = await provider.complete(system, user);
        working = provider;
        return content;
      } catch (err) {
        failures.push(`${provider.label}: ${err instanceof Error ? err.message : "Unknown AI error"}`);
      }
    }
    throw new Error(failures.join(" | ") || "All AI providers failed");
  };
  try {
    const res = await translateDocumentFully(
      { ...input, task: "translate" },
      callNeural,
      {
        language: input.language,
        chunkSize: 12000,
        maxRetries: 3,
        maxWholeRounds: 3,
        // The deterministic floor — whatever the model could not finish is
        // rendered fully in Devanagari so nothing ships in English.
        sweepLeftovers: (lines) => sweepLeftoverLines(lines, input.language, overlay),
      },
    );
    let content = res.content;
    // Neural training guarantee + reference-standard shaping + letterhead
    // guarantee — the same post-passes every engine runs, applied to the
    // stitched whole (see refine.ts).
    content = enforceGlossary(content, overlay, input.language);
    if (referenceDecision(referenceSource, input.language) !== "none") {
      content = referenceStandardPass(content, overlay);
    }
    content = reapplyLetterhead(content, referenceSource);
    // THE GUARANTEE on the shipped bytes: gate the final artifact; if the
    // post-passes left any genuine prose in the source language, the
    // deterministic floor converts exactly those lines and the deterministic
    // passes re-apply, so an English prose line can never ship. `complete`
    // is true exactly when the final gate passes — never stamped on a
    // truncated or skipped translation.
    const finalPass = ensureComplete(content, input.language, (lines) =>
      sweepLeftoverLines(lines, input.language, overlay),
    );
    if (finalPass.content !== content) {
      content = finalPass.content;
      content = enforceGlossary(content, overlay, input.language);
      if (referenceDecision(referenceSource, input.language) !== "none") {
        content = referenceStandardPass(content, overlay);
      }
      content = reapplyLetterhead(content, referenceSource);
    }
    const gate = estimateCompleteness(content, input.language);
    // `working` is captured by the callNeural closure, so TS narrows it to
    // null here — read through the fallback to keep the label type-safe.
    const providerLabel = (working ?? configured[0]).label;
    return { content, complete: gate.complete, provider: providerLabel };
  } catch (err) {
    console.warn(
      "[ODA] Segmented translation failed — falling back to adaptive:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
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
      // Honest attribution: APIMaster runs on the user's own (cheap) key —
      // only the free tiers claim "free forever".
      const paid = providerLabel.includes("APIMaster");
      content += `\n\n— Drafted by ODA Neural Forge · ${providerLabel}${paid ? "" : " · free forever"}`;
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
  handler: async (ctx, args): Promise<{
    responseId: Doc<"responses">["_id"];
    strategy: "ai" | "adaptive";
    content: string;
    complete: boolean;
    rating: string;
    ratingNote: string;
    ratingScore: number;
  }> => {
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
    // The segmented neural path: any document length is translated in full
    // (chunked + completeness-gated + retried), then stamped with the
    // deterministic passes. Falls back to the adaptive engine only when no
    // provider is configured or every provider failed.
    const draft = await neuralTranslateFull(config, overlay, doc.text!);
    if (draft) {
      content = draft.content;
      strategy = "ai";
      providerLabel = draft.provider;
      // Honest completion grade from the gate — a truncated or partially
      // translated AI output is never stamped complete.
      complete = draft.complete;
    } else {
      // The hard export gate (fidelity PRD §4.3): the record remembers
      // whether the deterministic tier left any line untranslated, so the UI
      // can warn before an incomplete translation ships.
      const res = translateAdaptive(doc, args, overlay);
      content = res.content;
      complete = res.complete;
    }

    // Letter-by-letter translator rating — the same intelligent per-letter
    // decision on the ORIGINAL source (CMPFO family detection) plus the
    // completion grade, now stamped on AI translations too: every letter is
    // translator-rated before it ships, regardless of which engine forged it.
    const rated = rateTranslation({
      sourceText: doc.text ?? "",
      complete,
      language: args.language,
    });

    if (strategy === "ai" && providerLabel) {
      // Honest attribution: APIMaster runs on the user's own (cheap) key —
      // only the free tiers claim "free forever".
      const paid = providerLabel.includes("APIMaster");
      content += `\n\n— Translated by ODA Neural Forge · ${providerLabel}${paid ? "" : " · free forever"}`;
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
      rating: rated.rating,
      ratingNote: rated.note,
      ratingScore: rated.score,
    });

    return { responseId, strategy, content, complete, rating: rated.rating, ratingNote: rated.note, ratingScore: rated.score };
  },
});
