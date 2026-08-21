import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { TOKEN_TABLES } from "../lib/oda/extraDict";

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<string> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  const me = await ctx.db.get(userId);
  if (!me || me.role !== "admin") throw new Error("Admins only");
  return userId;
}

/** Every stored entry (incl. disabled) — powers the Glossary page. */
export const list = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    return await ctx.db.query("glossaryEntries").order("desc").collect();
  },
});

/** Engine-shape rows for the translation engine (server action + the
 * on-device instant path). Only enabled entries ship, and the Convex-only
 * fields (_id, createdAt, enabled) are dropped so the client can build the
 * overlay with zero schema coupling. */
export const engineEntries = query({
  handler: async (ctx) => {
    const rows = await ctx.db.query("glossaryEntries").collect();
    return rows
      .filter((r) => r.enabled)
      .map((r) => ({
        kind: r.kind,
        table: r.table ?? undefined,
        en: r.en,
        hi: r.hi ?? undefined,
        tr: r.tr ?? undefined,
      }));
  },
});

export const upsert = mutation({
  args: {
    id: v.optional(v.id("glossaryEntries")),
    kind: v.union(v.literal("sentence"), v.literal("token")),
    table: v.optional(v.string()),
    en: v.string(),
    hi: v.optional(v.string()),
    tr: v.optional(v.record(v.string(), v.string())),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const fields = {
      kind: args.kind,
      table: args.kind === "token" ? (args.table ?? "HI_TOKENS") : undefined,
      en: args.en.trim(),
      hi: args.hi?.trim() || undefined,
      tr: args.tr && Object.keys(args.tr).length > 0 ? args.tr : undefined,
      enabled: args.enabled ?? true,
    };
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("Glossary entry not found");
      await ctx.db.patch(args.id, fields);
      return args.id;
    }
    return await ctx.db.insert("glossaryEntries", { ...fields, createdAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("glossaryEntries") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

/** Import a whole translation memory in one atomic round trip (single
 * transaction). Rows mirror the upsert shape minus the optional id — a
 * glossary JSON export imports as-is into a fresh deployment. */
export const bulkUpsert = mutation({
  args: {
    rows: v.array(
      v.object({
        kind: v.union(v.literal("sentence"), v.literal("token")),
        table: v.optional(v.string()),
        en: v.string(),
        hi: v.optional(v.string()),
        tr: v.optional(v.record(v.string(), v.string())),
        enabled: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();
    let inserted = 0;
    for (const row of args.rows) {
      const en = row.en.trim();
      if (!en) continue;
      const hasTarget =
        Boolean(row.hi?.trim()) ||
        (row.tr !== undefined && Object.values(row.tr).some((t) => t.trim().length > 0));
      if (!hasTarget) continue;
      await ctx.db.insert("glossaryEntries", {
        kind: row.kind,
        table: row.kind === "token" ? (row.table ?? "HI_TOKENS") : undefined,
        en,
        hi: row.hi?.trim() || undefined,
        tr:
          row.tr && Object.keys(row.tr).length > 0
            ? Object.fromEntries(
                Object.entries(row.tr)
                  .map(([k, v]) => [k, v.trim()] as const)
                  .filter(([, v]) => v.length > 0),
              )
            : undefined,
        enabled: row.enabled ?? true,
        createdAt: now,
      });
      inserted++;
    }
    return inserted;
  },
});
