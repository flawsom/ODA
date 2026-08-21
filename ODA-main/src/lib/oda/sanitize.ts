// Export Sanitization Layer (fidelity PRD §4.6) — the P0 hotfix.
//
// Preview furniture must never reach a delivered file: engine badges
// ("· adaptive engine"), UI labels ("ODA Translation · Hindi · Match Input"),
// the partial-translation disclaimer ("(N lines kept in the source
// language)") and the ODA branding footer ("— ओडीए द्वारा …" / "— Drafted by
// ODA Neural Forge …") are Omni-Viewer content only. Exporters run the strip
// pass always (defense in depth), and dev/CI runs the hard assertion so a
// regression is caught at the source, not discovered by a recipient.

export const BANNED_EXPORT_PATTERNS: RegExp[] = [
  // Engine badges / UI meta strips.
  /·\s*(?:adaptive engine|neural forge|deterministic engine)/i,
  /\bODA\s+(?:Translation|Response)\s*·/i,
  /\bODA\s+(?:Translation|Response)\b[^\n]{0,40}?·[^\n]*/i,
  /\bMatch Input\b/i,
  // The partial-translation disclaimer (any language lead, any count).
  /\((?:\d+|\d+[.,]\d+)\s+lines? kept in the source language\)/i,
  /(?:स्रोत भाषा में सुरक्षित|மூல மொழியில்|উৎস ভাষায়|మూల భాషలో|मूळ भाषेत|ભાષામાં સાચવેલ|மூல மொழி)/,
  /(?:पूर्ण अनुवाद के लिए|முழு மொழிபெயர்ப்புக்கு|সম্পূর্ণ অনুবাদের জন্য|पूर्ण भाषांतरासाठी)/,
  // Branding footers.
  /—\s*(?:Drafted|Translated|Forged|Generated)\s+by\s+ODA/i,
  /—\s*ओडीए\s+द्वारा/i,
  /—\s*ODA\s+On-Device\s+Neural\s+Forge/i,
  /·\s*(?:runs? in your browser|free forever, no keys, fully private)/i,
  // The partial-translation note as a whole (any language lead) — never a
  // fragment with the lead text left behind.
  /—\s*.+?\(\d+\s+lines? kept in the source language\)/i,
];

/** Whole-line footer/note shapes that must vanish entirely (not just their
 * matched substring). */
const BANNED_LINE_RE = new RegExp(
  [
    /^—\s*(?:Drafted|Translated|Forged|Generated)\s+by\s+ODA\b/i,
    /^—\s*ओडीए\s+द्वारा/i,
    /^—\s*(?:नीचे का मूल पाठ|கீழே உள்ள|নীচের|ఈ క్రింది|खालील|નીચે)/,
    /^\((?:\d+)\s+lines? kept in the source language\)$/i,
    /^—\s*.+?\(\d+\s+lines? kept in the source language\)\s*$/i,
    /^\s*ODA\s+(?:Translation|Response)\s*·/i,
  ]
    .map((r) => r.source)
    .join("|"),
  "i",
);

/** Where banned content was found — for the dev/CI assertion message. */
export function findExportLeaks(text: string): Array<{ pattern: string; match: string }> {
  const hits: Array<{ pattern: string; match: string }> = [];
  for (const re of BANNED_EXPORT_PATTERNS) {
    const m = text.match(re);
    if (m) hits.push({ pattern: re.source, match: m[0] });
  }
  return hits;
}

/**
 * Strip preview furniture from content before it is exported. Defense in
 * depth — the generation layers should already be clean; this guarantees it.
 */
export function sanitizeForExport(content: string): string {
  let text = content
    .split("\n")
    .filter((line) => !BANNED_LINE_RE.test(line))
    .join("\n");
  for (const re of BANNED_EXPORT_PATTERNS) {
    text = text.replace(re, "");
  }
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Hard gate: throw when the content would leak preview furniture into an
 * export. Runs in dev (exporters) and CI (forge-bench) so the failure is
 * loud and immediate instead of arriving in a government office's inbox.
 */
export function assertCleanForExport(content: string, label: string): void {
  const hits = findExportLeaks(content);
  if (hits.length > 0) {
    throw new Error(
      `Export sanitization failed (${label}): ${hits
        .map((h) => `"${h.match}"`)
        .join(", ")}`,
    );
  }
}
