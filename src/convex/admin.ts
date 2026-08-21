import { v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<string> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  const me = await ctx.db.get(userId);
  if (!me || me.role !== "admin") throw new Error("Admins only");
  return userId;
}

/**
 * First user to join becomes admin — a safe, demo-friendly bootstrap.
 * Only promotes when the deployment has zero admins, so it can never
 * overwrite an existing admin.
 */
export const maybeBecomeAdmin = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;
    const me = await ctx.db.get(userId);
    if (!me || me.role) return;
    const users = await ctx.db.query("users").collect();
    const hasAdmin = users.some((u) => u.role === "admin");
    if (!hasAdmin) {
      await ctx.db.patch(userId, { role: "admin" });
    }
  },
});

export const stats = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [users, documents, responses, catalog] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("documents").collect(),
      ctx.db.query("responses").collect(),
      ctx.db.query("catalogItems").collect(),
    ]);
    const byType: Record<string, number> = {};
    for (const d of documents) {
      const t = d.type ?? "Letter";
      byType[t] = (byType[t] ?? 0) + 1;
    }
    const byLanguage: Record<string, number> = {};
    for (const d of documents) {
      const l = d.language ?? "English";
      byLanguage[l] = (byLanguage[l] ?? 0) + 1;
    }
    return {
      users: users.length,
      documents: documents.length,
      responses: responses.length,
      catalogItems: catalog.length,
      byType,
      byLanguage,
    };
  },
});

/** Deployment-wide oversight: every document across all users. */
export const allDocuments = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("documents").order("desc").collect();
  },
});

export const allResponses = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("responses").order("desc").collect();
  },
});

export const listUsers = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      name: u.name ?? null,
      email: u.email ?? null,
      role: u.role ?? null,
    }));
  },
});

export const adminRemoveDocument = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc) return;
    if (doc.storageId) {
      await ctx.storage.delete(doc.storageId);
    }
    const responses = await ctx.db
      .query("responses")
      .withIndex("by_document", (q) => q.eq("documentId", args.id))
      .collect();
    await Promise.all(responses.map((r) => ctx.db.delete(r._id)));
    await ctx.db.delete(args.id);
  },
});

export const adminRemoveResponse = mutation({
  args: { id: v.id("responses") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});
