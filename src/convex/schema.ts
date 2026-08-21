import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

export const documentStatus = v.union(
  v.literal("processing"),
  v.literal("ready"),
  v.literal("error"),
);

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Ingested source documents (any format, any language).
    documents: defineTable({
      userId: v.id("users"),
      name: v.string(),
      mimeType: v.string(),
      size: v.number(),
      storageId: v.optional(v.id("_storage")),
      text: v.optional(v.string()), // extracted text layer
      format: v.string(), // file extension / source format: pdf, docx, txt...
      type: v.optional(v.string()), // classified type: Letter, Memo, Circular...
      language: v.optional(v.string()), // detected language
      script: v.optional(v.string()), // detected script
      formality: v.optional(v.string()), // formal / semi-formal / informal
      domain: v.optional(v.string()), // government / corporate / legal...
      status: documentStatus,
      error: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_user", ["userId", "createdAt"]),

    // Generated responses & translations (dispatch forge output).
    responses: defineTable({
      userId: v.id("users"),
      documentId: v.id("documents"),
      documentName: v.string(),
      content: v.string(),
      language: v.string(),
      formality: v.string(),
      format: v.string(),
      strategy: v.union(v.literal("ai"), v.literal("adaptive")),
      // What this artifact is: a generated reply, or a translation of the
      // source document itself.
      kind: v.optional(v.union(v.literal("response"), v.literal("translation"))),
      // Original document format (pdf, docx, txt…) so exports can match it.
      sourceFormat: v.optional(v.string()),
      // Whether every source line was translated (false = partial translation;
      // the UI surfaces this before export — fidelity PRD §4.3 hard gate).
      complete: v.optional(v.boolean()),
      // Per-letter translator rating (reference / complete / partial) — the
      // intelligent reference-standard decision made per letter, plus the
      // honest note and 0–100 score.
      rating: v.optional(v.string()),
      ratingNote: v.optional(v.string()),
      ratingScore: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId", "createdAt"])
      .index("by_document", ["documentId"]),

    // The public document catalog — the types of documents customers can file.
    catalogItems: defineTable({
      name: v.string(),
      description: v.string(),
      emoji: v.string(),
      category: v.string(),
      starterText: v.string(),
      featured: v.boolean(),
      createdAt: v.number(),
    }).index("by_category", ["category"]),

    // User-grown translation memory — sentence dictionary rows and token-table
    // rows added through the Glossary page. The engine merges these over the
    // seed pack at translation time, so coverage grows without code changes.
    glossaryEntries: defineTable({
      kind: v.union(v.literal("sentence"), v.literal("token")),
      // For token rows: which token table this entry extends (HI_TOKENS,
      // HI_PHRASES, HI_ABBR, REF_TOKENS, NAME_TABLE, TABLE_HEADERS).
      table: v.optional(v.string()),
      // Sentence source template ({1} slots) or token key (word / regex /
      // name / header phrase).
      en: v.string(),
      // Hindi target: sentence template with {1} slots, or the token value.
      hi: v.optional(v.string()),
      // Optional all-language sentence targets beyond Hindi.
      tr: v.optional(v.record(v.string(), v.string())),
      enabled: v.boolean(),
      createdAt: v.number(),
    }).index("by_kind", ["kind"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
