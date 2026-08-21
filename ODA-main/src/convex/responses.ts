import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    documentId: v.id("documents"),
    documentName: v.string(),
    content: v.string(),
    language: v.string(),
    formality: v.string(),
    format: v.string(),
    strategy: v.union(v.literal("ai"), v.literal("adaptive")),
    kind: v.optional(v.union(v.literal("response"), v.literal("translation"))),
    sourceFormat: v.optional(v.string()),
    complete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    return await ctx.db.insert("responses", {
      userId,
      documentId: args.documentId,
      documentName: args.documentName,
      content: args.content,
      language: args.language,
      formality: args.formality,
      format: args.format,
      strategy: args.strategy,
      kind: args.kind,
      sourceFormat: args.sourceFormat,
      complete: args.complete,
      createdAt: Date.now(),
    });
  },
});

export const list = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("responses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("responses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const res = await ctx.db.get(args.id);
    if (!res || res.userId !== userId) return null;
    return res;
  },
});

export const remove = mutation({
  args: { id: v.id("responses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const res = await ctx.db.get(args.id);
    if (!res || res.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});
