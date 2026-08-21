# Template assets — authoring procedure

Each `.docx` in this folder is a **verified reference document with its
dynamic text replaced by `{placeholders}`**. The static structure — fonts,
table borders, cell shading, the letterhead image, paragraph alignment — is
byte-identical to the original approved letter. Only text nodes were edited;
nothing was rebuilt.

> **Serving**: the *built* template ships from `public/templates/` (Vite
> serves it in dev and copies it into `dist/` for static hosting, so
> `fetch` resolves it under the GitHub Pages sub-path too). The registry's
> `assetPath` is relative (`templates/cmpf-lc-out-v1.docx`) and the
> precision engine prefixes `import.meta.env.BASE_URL`. Keep the two copies
> in sync — `public/templates/` is the one that renders.

## cmpf-lc-out-v1.docx

Source of truth: `198_Hindi_Tonmoy_Bhattacharjee_Hirok_Sarkar.docx` (verified
CMPFO inter-regional Ledger Card transfer-out letter).

### Top-level placeholders

| Placeholder | Meaning | Example |
|---|---|---|
| `{refCode}` | Outgoing reference code (after "सीपीएफ/") | `118/विविध/एल.सी.-आउट/आरएनजे-21 एवं 14/आर-I/एएसएन/` |
| `{date}` | Letter date | `09-07-2026` |
| `{recipientDesignation}` | Addressee designation (bold in template) | `सहायक आयुक्त` |
| `{recipientOrg}` | Addressee organisation | `कोयला खान भविष्य निधि संगठन` |
| `{recipientLine1}` | Address line 1 | `बी.बी. कॉलेज रोड` |
| `{recipientLine2}` | Address line 2 | `आसनसोल, क्षेत्र-III` |
| `{recipientDistrict}` | District (appended after "जिला. ") | `पश्चिम बर्धमान- 713303` |
| `{recipientState}` | State | `पश्चिम बंगाल` |
| `{subject}` | Subject line text (before the trailing "।", bold in template) | `लेजर कार्ड का अंतर-क्षेत्रीय स्थानांतरण` |
| `{referenceLine}` | Full "संदर्भ:-" line content | `सीपीएफ/59/... दिनांक 07/07/2026` |
| `{procedureOfficeLocation}` | Commissioner's office location | `धनबाद` |
| `{procedureOrderNo}` | Procedure order number | `35` |
| `{procedureOrderDate}` | Procedure order date | `12.02.1975` |
| `{signatoryName}` | Signatory name (bold, in parentheses in template) | `अजय कुमार सिंह` |
| `{signatoryDesignation}` | Signatory designation (bold) | `क्षेत्रीय आयुक्त - I` |

### Row loop — `{#members} ... {/members}`

The table's single templated row repeats once per entry in the `members`
array passed to docxtemplater. Row fields:

| Field | Meaning |
|---|---|
| `slNo` | Serial number |
| `name` | Member name |
| `accountNo` | CMPF account number |
| `prevColliery` | Previous colliery/office history. May contain `\n` for multiple stints — rendered as line breaks within the same cell (`linebreaks: true` in the Docxtemplater constructor). |
| `currColliery` | Current colliery/office |
| `lcNo` | Ledger Card number |

**Implementation note on the loop mechanism:** the `{#members}` tag sits at
the start of the row's first cell (slNo) and `{/members}` at the end of the
row's last cell (lcNo), both within the *same* `<w:tr>`. Docxtemplater
recognises this same-row start/end pattern and clones the entire table row
per array entry — the header row above it is untouched and never repeats.

### Known simplification (documented, not hidden)

`prevColliery` models an arbitrary-length work-history as one pre-joined
multi-line string; the renderer's `linebreaks: true` turns each `\n` into a
`<w:br/>` inside the cell, which was verified to render correctly for both
1-stint and 2-stint members.

**Per-stint structured rows — researched, deliberately NOT adopted.** A
nested docxtemplater loop (`{#stints}{stint}{/stints}`) was prototyped and
rejected: with this docxtemplater version, both `paragraphLoop` and the dash
syntax (`{-w:p stints}…{/stints}`) wrap the repeated body paragraphs in a
`<w:p>` nested inside the tag paragraph — schema-invalid OOXML (a paragraph
cannot contain a paragraph) that risks Word repair prompts on the exact
letters we ship. The wrapper also means per-stint paragraphs can't be
verified without a real renderer. Revisit only with a render-and-measure
pipeline in place (see `.github/workflows/render-measure.yml`) and a
re-authored `cmpf-lc-out-v2.docx` validated end-to-end; the extraction
layer already produces the pre-joined string, so the switch stays additive.

## cmpf-extract-out-v1.docx

Second Track B family — the **Extract-out letter** (table-less CMPFO letters
the office actually sends). Verified against the two real extract letters
from the author's `oda-cmpf-FIXED.zip` (`proof-outputs/153_Surendra_Koiri_extract.docx`
and `179_Susanta_Kumar_Nayak_extract.docx`). Authored from `cmpf-lc-out-v1`
(identical letterhead, page setup, fonts, right-aligned sign-off) with the
six L.C.-out address paragraphs collapsed into one `{recipientAddressBlock}`
placeholder (real extract addresses are English "To The Regional
Commissioner / C.M.P.F, Singrauli / …" blocks of varying length, rendered as
`<w:br/>`-joined lines) and the procedure line + member table replaced by a
single `{body1}` (the real letters' body is one sentence naming the member
inline). The static "कृपया…" request line is dropped — extract letters close
straight after the body. Body/address placeholders are declared
`optionalFields`. Built by `scripts/build-cmpf-family-assets.mjs`
(idempotent; both copies in sync).

> **Draft status** (PRD open item): the member sentence is rendered VERBATIM
> from the source (source-faithful), not normalized into a fixed gold
> sentence — worth one manual check against a real approved extract letter
> before treating the exact spacing as permanent.

## cmpf-universal-skeleton.docx

The **single shared CMPFO letterhead carrier**: the same letterhead image,
page setup and fonts as the family templates, with a minimal `{body}`
placeholder. Track A's generic renderer
(`templates/genericRenderer.ts`) pulls the letterhead from here, so every
exported CMPF letter — Track B or Track A — carries the identical header
without duplicating the image bytes. Built by the same script.

### Fix log

**2026-08-17 — Verified against the 3 REAL letters (from `oda-cmpf-FIXED.zip`
`proof-outputs/`).** The author's package shipped proof outputs for Khadal
Jena (L.C.-out), Surendra Koiri and Susanta Kumar Nayak (Extract-out); they
are now fixtures in `scripts/fixtures-cmpf.ts` and run through the full
pipeline by `verify-precision.ts`, `smoke-precision.mts` and the
render-and-measure fit-scan. Making them pass required real-letter hardening:
irBuilder now parses English addresses ("To The Regional Commissioner" is
the designation line), `दिनांक` without a colon, English procedure lines
("Procedure Office Order No-35 Dated-12.02.1975 of CMPF Commissioner,
Dhanbad"), embedded "Dist:- X, State:- Y" districts, and 5-column member
tables (no एल.सी. संख्या column — Jena's table; `lcNo` defaults to ""). The
matcher now scores organisation markers without the संगठन suffix and Latin
"C.M.P.F", English "Ledger Card"/"Inter Regional Transfer" (which counts for
L.C.-out only when the letter is not an extract), and extract signals
(वी.वी./statement/CMPF A/C No). All three real letters route to the correct
Track B family and render with no leftover placeholders; all harnesses
green.

**2026-08-17 — Universal CMPF engine (PRD "Universal CMPF Letter Generation
Engine").** Two new assets above plus: `templates/shared/shrinkToFit.ts`
(shrink-to-fit generalized to weight paragraphs/address blocks, not just
table rows — the Extract-out letters have no table at all),
`templates/shared/signatureBlock.ts` (right-aligned closing block shared by
both tracks), `templates/genericRenderer.ts` (real Track A: IR block walk,
shared letterhead, never hard-fails), a scored synonym-tolerant matcher with
a confidence floor in `registry.ts` (an exact-AND phrase pair no longer
gates the L.C.-out family — a variant letter that missed the old matcher now
scores above the floor), and the member table made optional in the engine
(`rowLoopTag` absent ⇒ no table population — Extract-out letters no longer
crash "no table rows"). Routing lives in `export.ts` (`toDocxBlob`): Track B
first, then the generic CMPF renderer for CMPF-signalled translations, then
the plain structural renderer. The zip's `export.routing.snippet.ts` stub is
superseded by that existing routing. Verified by `verify-precision.ts`
(Jena variant + Extract-out + Track A), `smoke-precision.mts` and the
render-and-measure fit-scan, all green.

**2026-08-17 — `cmpf-lc-out-v1` letterhead + Word re-save (asset swap).**
Adopted the updated letterhead from the author's `oda-cmpf-precision-mode-FIXED (1).zip`:
the old 104 KB PNG (6.46″ × 1.80″, inline) is replaced by a 402 KB JPEG
(8.05″ × 2.24″) that Word saved as a FLOATING banner (`wp:anchor`) bleeding
0.76″ into the left margin and 0.9″ above the top margin — that design ships
exactly as authored; the shrink-to-fit tiers never touch it. The re-save also
fragmented literal and placeholder text across runs — docxtemplater resolves
the tags fine, but verify harnesses now assert against concatenated `<w:t>`
text (document order) instead of raw XML, and the DrawingML carries a
legitimate Office GUID (`{28A0092B-...}`) whose braces are not placeholders.
Word also rebalanced the table's `w:tblGrid` column widths (the prevColliery
history column shrank 2700 → 1990 twips, making every multi-stint row
taller); the cells kept their gold `tcW` values, so
`scripts/patch-cmpf-table-grid.mjs` rewrites the grid to match them
(700/1700/1500/2700/1900/900) — that is what restored the verified page-fit
(the letterhead itself measured as a non-factor). Both copies replaced in
sync (`assets/` authoring copy + `public/templates/` shipped copy — this also
adds the previously-missing assets copy to the repo); `registry.ts` field
contract unchanged. Page-fit was re-measured end-to-end by the
render-and-measure fit scan.

**2026-08-17 — `cmpf-lc-out-v1` closing-block alignment (formatting patch).**
The sign-off block (`भवदीय,`, `({signatoryName})`, `{signatoryDesignation}`)
was left-aligned because the Hindi gold file itself was left-aligned — an
inconsistency in the source; the English sibling letter for the same case is
right-aligned, which is the CMPFO convention. All three closing paragraphs
now carry `<w:jc w:val="right"/>` in the template asset. Applied with
`bun scripts/patch-cmpf-closing-align.mjs` (idempotent; re-running is a
no-op). No field contract, table structure, fonts, or letterhead changed,
so no version bump — every caller of `renderPrecisionTemplate()` works
unmodified. The shrink-to-fit font tiers in `precisionEngine.ts`
(`pickFontTier`) intentionally never touch paragraph alignment, so the
right-aligned sign-off survives every render tier.

### Adding a new template family

1. Obtain one verified reference `.docx` for the new letter type.
2. Unzip it, open `word/document.xml`, replace each dynamic text run with a
   `{placeholder}` following the naming pattern above.
3. For any repeating table, pick one data row as the loop template: put
   `{#loopName}` at the start of its first cell and `{/loopName}` at the end
   of its last cell (same row), then delete any other static data rows.
4. Re-zip (`zip -r -X out.docx '[Content_Types].xml' _rels docProps word`)
   and place the result here.
5. Add one `TemplateDefinition` entry to `../registry.ts`.
6. Render a test payload through `precisionEngine.ts` and visually diff
   against the reference (e.g. via `libreoffice --headless --convert-to png`)
   before shipping. **Checklist:** besides field content and table structure,
   explicitly compare the **closing-block alignment** (flush-right sign-off
   is the CMPFO convention) and every paragraph's `w:jc` — a single
   inconsistent gold file must not silently propagate again (see Fix log
   above for the one it already did).
