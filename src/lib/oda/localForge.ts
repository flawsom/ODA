// ---------------------------------------------------------------------------
// ODA ON-DEVICE NEURAL FORGE
// Runs a real LLM in the browser via transformers.js (WASM or WebGPU) — zero
// API keys, zero servers, fully private: the document never leaves the device.
// Two models, both downloaded once and cached by the browser:
//   - "fast": Qwen2.5 0.5B (~400 MB) — quick drafts, lower quality prose
//   - "best": Qwen2.5 1.5B (~1.2 GB) — the strongest free on-device prose
// If anything fails, callers degrade to the server action (adaptive engine).
// ---------------------------------------------------------------------------

import {
  enforceGlossary,
  glossaryPromptBlock,
  type GlossaryOverlay,
} from "./extraDict";
import { reapplyLetterhead, referenceStandardPass } from "./refine";
import { referenceDecision } from "./rating";
import { ensureComplete, translateDocumentFully } from "./neuralTranslate";
import { sweepLeftoverLines } from "./translate";
import {
  buildUserPrompt,
  RESPONSE_SYSTEM,
  TRANSLATE_SYSTEM,
} from "./neuralPrompts";

export type ForgeStatus = "idle" | "loading" | "ready" | "error";
export type ForgeModel = "fast" | "best";

export const MODEL_INFO: Record<ForgeModel, { id: string; label: string; size: string }> = {
  fast: {
    id: "onnx-community/Qwen2.5-0.5B-Instruct",
    label: "Qwen2.5 0.5B",
    size: "~400 MB",
  },
  best: {
    id: "onnx-community/Qwen2.5-1.5B-Instruct",
    label: "Qwen2.5 1.5B",
    size: "~1.2 GB",
  },
};
const DTYPE = "q4";

/** Minimal shape of the transformers.js text-generation pipeline we use. */
type GenFn = (
  prompt: string,
  opts: Record<string, unknown>,
) => Promise<unknown>;

interface ModelState {
  status: ForgeStatus;
  gen: GenFn | null;
  error: string | null;
  loadingPromise: Promise<GenFn> | null;
}

const models: Record<ForgeModel, ModelState> = {
  fast: { status: "idle", gen: null, error: null, loadingPromise: null },
  best: { status: "idle", gen: null, error: null, loadingPromise: null },
};

export function forgeStatus(model: ForgeModel = "best"): ForgeStatus {
  return models[model].status;
}

export function modelSize(model: ForgeModel): string {
  return MODEL_INFO[model].size;
}

function toChatML(system: string, user: string): string {
  return (
    `<|im_start|>system\n${system}<|im_end|>\n` +
    `<|im_start|>user\n${user}<|im_end|>\n` +
    `<|im_start|>assistant\n`
  );
}

function extractText(res: unknown): string {
  if (Array.isArray(res)) {
    const first = res[0] as { generated_text?: unknown } | undefined;
    const t = first?.generated_text;
    if (typeof t === "string") return t;
  }
  const obj = res as { generated_text?: unknown } | undefined;
  if (obj && typeof obj.generated_text === "string") return obj.generated_text;
  throw new Error("The on-device model returned no text");
}

async function loadPipeline(
  model: ForgeModel,
  onProgress?: (pct: number | null) => void,
): Promise<GenFn> {
  const st = models[model];
  if (st.gen) return st.gen;
  if (st.loadingPromise) return st.loadingPromise;

  st.status = "loading";

  // transformers.js reports download progress per file, and for large models
  // the raw `progress` value can overshoot 1.0 (multi-chunk fetches), which
  // the UI was showing as absurd percentages like 3733%. Aggregate per-file
  // byte totals into one honest overall percentage, hard-clamped to 100.
  const fileProgress = new Map<string, { loaded: number; total: number }>();
  const report = (p: Record<string, unknown>) => {
    if (p.status === "progress") {
      const file = typeof p.file === "string" ? p.file : "model";
      const loaded = typeof p.loaded === "number" ? p.loaded : 0;
      const total = typeof p.total === "number" ? p.total : 0;
      let overall: number;
      if (total > 0) {
        fileProgress.set(file, { loaded, total });
        let sumLoaded = 0;
        let sumTotal = 0;
        for (const f of fileProgress.values()) {
          sumLoaded += f.loaded;
          sumTotal += f.total;
        }
        overall = sumTotal > 0 ? (sumLoaded / sumTotal) * 100 : 0;
      } else {
        overall = (typeof p.progress === "number" ? p.progress : 0) * 100;
      }
      onProgress?.(Math.min(100, Math.max(0, Math.round(overall))));
    } else if (p.status === "ready" || p.status === "done") {
      onProgress?.(null);
    }
  };

  st.loadingPromise = (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowLocalModels = false;
    try {
      // Fast path: WebGPU where the browser supports it.
      return (await pipeline("text-generation", MODEL_INFO[model].id, {
        dtype: DTYPE,
        device: "webgpu",
        progress_callback: report,
      })) as unknown as GenFn;
    } catch {
      // Universal fallback: WASM runs anywhere.
      return (await pipeline("text-generation", MODEL_INFO[model].id, {
        dtype: DTYPE,
        device: "wasm",
        progress_callback: report,
      })) as unknown as GenFn;
    }
  })();

  try {
    st.gen = await st.loadingPromise;
    st.status = "ready";
    st.error = null;
    return st.gen;
  } catch (err) {
    st.status = "error";
    st.error = err instanceof Error ? err.message : "Failed to load the on-device model";
    st.loadingPromise = null;
    throw err;
  }
}

export interface DeviceDraftParams {
  sourceText: string;
  sourceName: string;
  sourceType?: string;
  sourceLanguage?: string;
  language: string;
  formality: string;
  format: string;
  /** What to draft: an acknowledgment response, or a translation of the document. */
  task?: "response" | "translate";
}

/**
 * Draft a response with the on-device model. Throws if the model cannot be
 * loaded or produces no output — callers should fall back to the adaptive
 * engine via the server action.
 */
export async function draftWithDevice(
  params: DeviceDraftParams,
  onProgress?: (pct: number | null) => void,
  model: ForgeModel = "best",
  overlay?: GlossaryOverlay,
): Promise<string> {
  const gen = await loadPipeline(model, onProgress);
  const task = params.task ?? "response";
  const system = task === "translate" ? TRANSLATE_SYSTEM : RESPONSE_SYSTEM;
  // Neural training memory: the user's confidential glossary rides in the
  // prompt (translations only) and stays on this device — the model is
  // trained on it locally, never uploaded anywhere.
  const base = buildUserPrompt({ ...params, task });
  const user = task === "translate" && overlay ? `${base}\n${glossaryPromptBlock(overlay, params.language)}` : base;
  let text: string;
  if (task === "translate") {
    // The never-truncated path on-device too: the document is split into
    // segments that fit the model's output budget, each translated through
    // the same prompt contract, with the completeness gate and retry pass —
    // so a long letter is translated in FULL, never cut at max_new_tokens.
    const res = await translateDocumentFully(
      { ...params, task },
      async (systemPrompt, userPrompt) => {
        const out = await gen(toChatML(systemPrompt, userPrompt), {
          max_new_tokens: 4096,
          temperature: 0.6,
          do_sample: true,
          repetition_penalty: 1.05,
          return_full_text: false,
        });
        const t = extractText(out).trim();
        if (!t) throw new Error("The on-device model returned an empty draft");
        return t;
      },
      {
        language: params.language,
        chunkSize: 8000,
        maxRetries: 3,
        maxWholeRounds: 3,
        // The deterministic floor — whatever the on-device model could not
        // finish is rendered fully in Devanagari so nothing ships in English.
        sweepLeftovers: (lines) => sweepLeftoverLines(lines, params.language, overlay),
      },
    );
    text = res.content;
  } else {
    const out = await gen(toChatML(system, user), {
      max_new_tokens: 4096,
      temperature: 0.6,
      do_sample: true,
      repetition_penalty: 1.05,
      return_full_text: false,
    });
    text = extractText(out).trim();
    if (!text) throw new Error("The on-device model returned an empty draft");
  }
  // Glossary enforcement on-device: custom translations win, locally.
  if (overlay) text = enforceGlossary(text, overlay, params.language);
  // Translations get the same intelligent reference-standard treatment as
  // every other engine: Hindi always receives the Devanagari script-standard
  // pass, CMPFO-family letters the full reference shaping, and the letterhead
  // is re-applied so the header is byte-identical to the source.
  if (task === "translate") {
    if (referenceDecision(params.sourceText, params.language) !== "none") {
      text = referenceStandardPass(text, overlay);
    }
    text = reapplyLetterhead(text, params.sourceText);
    // THE GUARANTEE on the shipped bytes: gate the final artifact and finish
    // any residual prose with the deterministic floor — an English prose
    // line can never leave the device.
    const finalPass = ensureComplete(text, params.language, (lines) =>
      sweepLeftoverLines(lines, params.language, overlay),
    );
    if (finalPass.content !== text) {
      text = finalPass.content;
      if (referenceDecision(params.sourceText, params.language) !== "none") {
        text = referenceStandardPass(text, overlay);
      }
      text = reapplyLetterhead(text, params.sourceText);
    }
  }
  return (
    text +
    `\n\n— Drafted by ODA On-Device Neural Forge · ${MODEL_INFO[model].label} · runs in your browser — free forever, no keys, fully private`
  );
}
