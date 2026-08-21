import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const SEED: Array<{
  name: string;
  description: string;
  emoji: string;
  category: string;
  starterText: string;
}> = [
  {
    name: "Complaint / Grievance",
    description:
      "Something fell short? Put it on the record — politely, pointedly, or both. ODA drafts a complaint that gets read, and a response that gets results.",
    emoji: "📣",
    category: "Complaints",
    starterText:
      "To,\nThe Concerned Authority\n\nSubject: Complaint regarding [state the issue]\n\nRespected Sir/Madam,\n\nI wish to bring to your notice the following matter: [describe what happened, when, and where].\n\nDespite my best efforts, the issue remains unresolved and has caused considerable inconvenience. I request that the matter be examined at the earliest and appropriate action be taken.\n\nThanking you,\nYours faithfully,\n[Your Name]\n[Contact details]",
  },
  {
    name: "Service Request",
    description:
      "Need a service, a repair, a permit or a civic action? File a formal request and ODA handles the follow-up correspondence for you.",
    emoji: "🏛️",
    category: "Requests",
    starterText:
      "To,\nThe Concerned Department\n\nSubject: Request for [service / action required]\n\nRespected Sir/Madam,\n\nI request that the following service be provided: [describe the service, location, and timeline].\n\nKindly initiate the necessary action and inform me of the expected date of completion.\n\nThanking you,\nYours faithfully,\n[Your Name]",
  },
  {
    name: "Application",
    description:
      "Permission, leave, admission, sanction — whatever you're applying for, start the paperwork right and let ODA craft the formal ask.",
    emoji: "📄",
    category: "Requests",
    starterText:
      "To,\nThe Appropriate Authority\n\nSubject: Application for [purpose]\n\nRespected Sir/Madam,\n\nI am submitting this application for [state the request] for the following reasons: [details].\n\nI have attached the necessary supporting documents and shall be grateful for your approval.\n\nYours faithfully,\n[Your Name]\n[Enclosures: list]",
  },
  {
    name: "Legal Notice",
    description:
      "Serious business — a formal legal notice carries real weight. ODA writes it with the gravity, precision and protocol it deserves.",
    emoji: "⚖️",
    category: "Legal",
    starterText:
      "To,\n[Recipient name and address]\n\nThrough:\n[Advocate name]\n\nSubject: Legal notice for [claim / demand]\n\nDear Sir/Madam,\n\nTake notice that we represent our client, [name], in the matter described below. Our client has suffered [loss / grievance] on account of [facts], particulars of which are as follows: [details].\n\nWe call upon you to [demand / remedy] within [days] days of receipt of this notice, failing which our client shall be constrained to initiate appropriate legal proceedings, at your risk as to costs.\n\nYours faithfully,\n[Advocate]",
  },
  {
    name: "Invoice / Statement",
    description:
      "Money talk, formatted properly. Send a clear, professional invoice or statement and get payment follow-ups that don't feel awkward.",
    emoji: "🧾",
    category: "Finance",
    starterText:
      "Invoice No: [number]\nDate: [date]\n\nTo,\n[Customer name and address]\n\nSubject: Invoice for [goods / services]\n\nSir/Madam,\n\nPlease find below the details of the invoice against the above-mentioned goods/services:\n\n[Item] — [Amount]\nTotal: [Amount]\n\nPayment is requested within [days] days. Bank details for remittance are provided herewith.\n\nFor [Company Name],\n[Signature]\n[Authorized Signatory]",
  },
  {
    name: "Acknowledgement",
    description:
      "Confirm receipt like a pro. A crisp acknowledgement keeps records clean and relationships warm — ODA mirrors the original's tone.",
    emoji: "🤝",
    category: "Communication",
    starterText:
      "Date: [date]\n\nTo,\n[Sender name and address]\n\nSubject: Acknowledgement of your communication dated [date]\n\nRespected Sir/Madam,\n\nWe acknowledge receipt of your communication on the subject noted above. The matter has been taken on record and is receiving our attention.\n\nYou will be apprised of the outcome in due course. Please quote our reference [number] in future correspondence.\n\nYours faithfully,\n[Name]\n[Designation]",
  },
  {
    name: "Transfer / Posting Order",
    description:
      "Moving on up? ODA handles the official paperwork — orders, relief instructions and joining reports, all in proper institutional form.",
    emoji: "🔁",
    category: "HR & Orders",
    starterText:
      "No. [number]\n[Office name and address]\nDate: [date]\n\nTo,\n[Employee name and designation]\n\nSubject: Transfer / Posting Order\n\nSir,\n\nReference your application / the office order cited above, you are hereby placed on transfer from [current station] to [new station] with effect from [date].\n\nYou are directed to hand over charge and report for joining as per the instructions enclosed. TA/DA shall be admissible as per rules.\n\nYours faithfully,\n[Name]\n[Designation]",
  },
  {
    name: "Circular / Notification",
    description:
      "Make an announcement the way institutions do — clear, official and unmissable. ODA structures it so everyone actually reads it.",
    emoji: "📢",
    category: "Communication",
    starterText:
      "OFFICE ORDER / CIRCULAR\nNo. [number] — Dated [date]\n\nSubject: [topic of the circular]\n\nIt is hereby notified for the information of all concerned that [key announcement / instruction].\n\nThe following action is required from all concerned: [list of instructions].\n\nThis issues with the approval of the competent authority.\n\n[Name]\n[Designation]",
  },
  {
    name: "Report / Memo",
    description:
      "Summarize, submit, stand behind it. Whether it's an inspection report or an internal memo, ODA gives it structure and spine.",
    emoji: "📝",
    category: "Communication",
    starterText:
      "MEMORANDUM\nTo: [recipient]\nFrom: [author]\nDate: [date]\n\nSubject: [topic]\n\n1. Background: [context]\n2. Findings: [what was observed]\n3. Recommendation: [suggested action]\n\nSubmitted for your kind consideration and approval.\n\n[Name]\n[Designation]",
  },
  {
    name: "Contract / Agreement",
    description:
      "Terms, parties, clauses — drafted with care. ODA structures agreements so every promise is clear and every party knows where they stand.",
    emoji: "💼",
    category: "Legal",
    starterText:
      "AGREEMENT\n\nThis Agreement is made on [date] between [Party A], [details], and [Party B], [details], hereinafter referred to as the Parties.\n\nWHEREAS the Parties wish to [purpose];\n\nNOW THEREFORE, the Parties agree as follows:\n\n1. [Obligation]\n2. [Obligation]\n3. Term and termination: [details]\n4. Governing law: [jurisdiction]\n\nIN WITNESS WHEREOF, the Parties have executed this Agreement on the date first written above.\n\n[Party A signature]          [Party B signature]",
  },
];

/** Public — anyone can browse the catalog. */
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("catalogItems").collect();
  },
});

/** Public — a single catalog entry by id. */
export const get = query({
  args: { id: v.id("catalogItems") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<string> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  const me = await ctx.db.get(userId);
  if (!me || me.role !== "admin") throw new Error("Admins only");
  return userId;
}

/**
 * Idempotent seed — only inserts when the catalog is empty. Deliberately
 * public (no auth required): the payload is a hardcoded constant, the guard
 * makes concurrent calls safe, and it lets a fresh deployment's public
 * /catalog page stock its own shelves without any setup.
 */
export const seed = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("catalogItems").collect();
    if (existing.length > 0) return;
    for (const item of SEED) {
      await ctx.db.insert("catalogItems", {
        ...item,
        featured: item.category === "Complaints" || item.category === "Requests",
        createdAt: Date.now(),
      });
    }
  },
});

export const add = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    emoji: v.string(),
    category: v.string(),
    starterText: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.insert("catalogItems", {
      name: args.name,
      description: args.description,
      emoji: args.emoji || "📄",
      category: args.category || "General",
      starterText: args.starterText,
      featured: false,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("catalogItems"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    emoji: v.optional(v.string()),
    category: v.optional(v.string()),
    starterText: v.optional(v.string()),
    featured: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...patch } = args;
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("catalogItems") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});
