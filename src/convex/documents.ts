import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Upload step 1: mint a short-lived upload URL for file storage. */
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
    storageId: v.optional(v.id("_storage")),
    text: v.optional(v.string()),
    format: v.string(),
    type: v.optional(v.string()),
    language: v.optional(v.string()),
    script: v.optional(v.string()),
    formality: v.optional(v.string()),
    domain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const docId = await ctx.db.insert("documents", {
      userId,
      name: args.name,
      mimeType: args.mimeType,
      size: args.size,
      storageId: args.storageId,
      text: args.text,
      format: args.format,
      type: args.type,
      language: args.language,
      script: args.script,
      formality: args.formality,
      domain: args.domain,
      status: "ready",
      createdAt: Date.now(),
    });
    return docId;
  },
});

export const list = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("documents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) return null;
    // Resolve the signed storage URL so clients can fetch the original file
    // (e.g. to render the source letterhead above a translation).
    const storageUrl = doc.storageId ? await ctx.storage.getUrl(doc.storageId) : null;
    return { ...doc, storageUrl };
  },
});

/** Allow a user to correct the AI classification — feeds the learning loop. */
export const setAnalysis = mutation({
  args: {
    id: v.id("documents"),
    type: v.optional(v.string()),
    language: v.optional(v.string()),
    formality: v.optional(v.string()),
    domain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(args.id, {
      type: args.type ?? doc.type,
      language: args.language ?? doc.language,
      formality: args.formality ?? doc.formality,
      domain: args.domain ?? doc.domain,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    if (doc.storageId) {
      await ctx.storage.delete(doc.storageId);
    }
    // Remove generated responses attached to this document.
    const responses = await ctx.db
      .query("responses")
      .withIndex("by_document", (q) => q.eq("documentId", args.id))
      .collect();
    await Promise.all(responses.map((r) => ctx.db.delete(r._id)));
    await ctx.db.delete(args.id);
  },
});
