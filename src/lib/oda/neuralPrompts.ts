// ODA NEURAL PROMPTS — the single source of truth for every neural engine.
// The cloud action (src/convex/generate.ts), the on-device forge
// (src/lib/oda/localForge.ts) and the CI batch forge
// (scripts/neural/forge-neural.ts) all speak this identical prompt contract,
// so a Qwen3 model on a GitHub Actions runner and GPT-5.6 on APIMaster
// receive the same instructions and produce the same reference-standard,
// per-letter-rated output.

export interface NeuralPromptInput {
  sourceText: string;
  sourceName: string;
  sourceType?: string;
  sourceLanguage?: string;
  language: string;
  formality: string;
  format: string;
  task: "response" | "translate";
}

export const RESPONSE_SYSTEM =
  "You are ODA — the Omniscient Document Architect. You comprehend any formal document and " +
  "generate a response indistinguishable from expert human correspondence. Mirror the input's " +
  "structure, register and tone. Follow domain protocols (government, corporate, legal, academic) " +
  "and local conventions (honorifics, date formats, reference quoting). Quote the source " +
  "document's subject/reference/date and name the specific people, members, account numbers and " +
  "offices mentioned in it. Output ONLY the response document itself — no preamble, no " +
  "commentary, no markdown fences.";

export const TRANSLATE_SYSTEM =
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

export function buildUserPrompt(input: NeuralPromptInput): string {
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
    input.sourceText.slice(0, 60000),
    "--- SOURCE TEXT END ---",
    "",
    head,
  ].join("\n");
}

/**
 * The prompt for one segment of a long document (segmented translation — the
 * never-truncated path every neural engine runs). Later segments carry no
 * letterhead, so the model is told not to reproduce it; structure and the
 * translation rules stay identical to the whole-document contract.
 */
export function buildSegmentPrompt(input: NeuralPromptInput, index: number, total: number): string {
  return [
    `This is segment ${index} of ${total} of the document. Translate this segment fully into ${input.language} (formal register).`,
    "The letterhead (organization name, office address, contact details, phone/email/website lines) only appears at the very start of the document. If it is not in this segment's text, do not reproduce it.",
    "Preserve the segment's exact structure: paragraphs, headings, table layout and signature block.",
    "Output ONLY the translated segment — no preamble, no commentary, no markdown fences.",
    "",
    buildUserPrompt(input),
  ].join("\n");
}

/**
 * The retry prompt for a translation that left lines in the source language.
 * Lists the exact leftover lines and asks for the FULL corrected output — so
 * a model that missed prose on the first pass gets a second, targeted chance
 * instead of shipping a partial document.
 */
export function buildRetryPrompt(input: NeuralPromptInput, untranslated: string[]): string {
  return [
    "Your previous translation left some lines in the source language. Translate them into " +
      `${input.language} (formal register). Keep names, numbers, file codes, dates and amounts verbatim where they belong, ` +
      "and transliterate personal and place names where natural.",
    "Then output the FULL corrected translation of the document (or segment) with every line below translated — " +
      "do not omit any content, do not add commentary, no markdown fences.",
    "",
    "LINES STILL IN THE SOURCE LANGUAGE:",
    ...untranslated.map((line, i) => `${i + 1}. ${line}`),
    "",
    "FULL SOURCE TEXT:",
    "--- SOURCE TEXT START ---",
    input.sourceText.slice(0, 60000),
    "--- SOURCE TEXT END ---",
  ].join("\n");
}

/**
 * The line-only repair prompt — the escalating round for a translation that
 * STILL left lines in the source language after a full retry. Asks for ONLY
 * the leftover lines, numbered, with no document around them, so the reply is
 * tiny and cannot be truncated even by a weak or token-capped model. The
 * caller parses the numbered answers and splices them back into the draft.
 */
export function buildLineRepairPrompt(input: NeuralPromptInput, untranslated: string[]): string {
  return [
    "Your translation still left the following lines in the source language. Translate ONLY these lines into " +
      `${input.language} (formal register). Keep names, numbers, file codes, dates and amounts verbatim where they belong, ` +
      "and transliterate personal and place names where natural.",
    "Output exactly one translated line per input line, numbered — no commentary, no explanations, no markdown fences:",
    ...untranslated.map((line, i) => `${i + 1}. ${line}`),
  ].join("\n");
}
