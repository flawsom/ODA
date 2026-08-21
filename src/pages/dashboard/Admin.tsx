import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, FormatBadge, PageHeader, StatCard } from "@/components/oda/bits";
import { useAuth } from "@/hooks/use-auth";
import {
  BookOpen,
  FileText,
  Library,
  Lock,
  Plus,
  ScrollText,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

export default function Admin() {
  const { user, isLoading } = useAuth();
  const allDocuments = useQuery(api.admin.allDocuments);
  const allResponses = useQuery(api.admin.allResponses);
  const users = useQuery(api.admin.listUsers);
  const catalog = useQuery(api.catalog.list);

  const adminRemoveDocument = useMutation(api.admin.adminRemoveDocument);
  const adminRemoveResponse = useMutation(api.admin.adminRemoveResponse);
  const addCatalogItem = useMutation(api.catalog.add);
  const removeCatalogItem = useMutation(api.catalog.remove);

  const [form, setForm] = useState({
    name: "",
    category: "General",
    emoji: "📄",
    description: "",
    starterText: "",
  });
  const [saving, setSaving] = useState(false);

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users ?? []) {
      map.set(u._id, u.name ?? u.email ?? "Unknown user");
    }
    return map;
  }, [users]);

  const loading = allDocuments === undefined || allResponses === undefined || users === undefined;

  if (!isLoading && user && user.role !== "admin") {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-muted-foreground">
          <Lock className="size-5" />
        </div>
        <h2 className="mt-5 font-display text-2xl font-medium">The back office is locked.</h2>
        <p className="mt-2 max-w-sm text-[13px] leading-6 text-muted-foreground">
          This area manages the whole deployment — every customer&apos;s documents, responses and
          the catalog. The first account on a fresh deployment receives the admin keys
          automatically.
        </p>
        <Link to="/dashboard" className="mt-6">
          <Button variant="outline">Back to your workspace</Button>
        </Link>
      </div>
    );
  }

  const handleAddItem = async () => {
    if (!form.name.trim() || !form.starterText.trim()) {
      toast.error("Give the catalog entry a name and a starter template.");
      return;
    }
    setSaving(true);
    try {
      await addCatalogItem({
        name: form.name.trim(),
        category: form.category.trim() || "General",
        emoji: form.emoji.trim() || "📄",
        description: form.description.trim(),
        starterText: form.starterText.trim(),
      });
      setForm({ name: "", category: "General", emoji: "📄", description: "", starterText: "" });
      toast.success("Catalog entry published");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Admin · Deployment oversight"
        title="Admin"
        description="Everything in the deployment, in one place — every customer, every document, every response, every catalog shelf. Manage it all from here."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Accounts"
          value={loading ? "—" : users!.length}
          accent="oklch(0.7 0.14 300)"
        />
        <StatCard
          icon={FileText}
          label="Documents (all users)"
          value={loading ? "—" : allDocuments!.length}
          accent="oklch(0.72 0.14 170)"
        />
        <StatCard
          icon={ScrollText}
          label="Responses (all users)"
          value={loading ? "—" : allResponses!.length}
        />
        <StatCard
          icon={Library}
          label="Catalog entries"
          value={catalog === undefined ? "—" : catalog.length}
          accent="oklch(0.75 0.15 55)"
        />
      </div>

      <Tabs defaultValue="documents">
        <TabsList className="mb-5">
          <TabsTrigger value="documents" className="gap-1.5">
            <FileText className="size-3.5" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="responses" className="gap-1.5">
            <ScrollText className="size-3.5" />
            Responses
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="size-3.5" />
            Users
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-1.5">
            <Library className="size-3.5" />
            Catalog
          </TabsTrigger>
        </TabsList>

        {/* ---------------- Documents ---------------- */}
        <TabsContent value="documents" className="mt-0">
          {loading && (
            <p className="py-12 text-center text-[13px] text-muted-foreground">Loading deployment…</p>
          )}
          {!loading && allDocuments!.length === 0 && (
            <EmptyState
              icon={FileText}
              title="No documents in the deployment"
              body="Once customers start filing, everything they post lands here for review."
            />
          )}
          {!loading && allDocuments!.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/50">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-border/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3.5 font-medium">Document</th>
                      <th className="hidden px-4 py-3.5 font-medium md:table-cell">Owner</th>
                      <th className="hidden px-4 py-3.5 font-medium sm:table-cell">Type</th>
                      <th className="px-4 py-3.5 font-medium">Format</th>
                      <th className="hidden px-4 py-3.5 font-medium lg:table-cell">Filed</th>
                      <th className="w-14 px-4 py-3.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {allDocuments!.map((doc) => (
                      <tr key={doc._id} className="transition-colors hover:bg-muted/30">
                        <td className="max-w-[280px] px-4 py-3">
                          <p className="truncate font-medium">{doc.name}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {doc.language ?? "English"} · {doc.formality ?? "Formal"}
                          </p>
                        </td>
                        <td className="hidden px-4 py-3 text-[12.5px] text-muted-foreground md:table-cell">
                          {userMap.get(doc.userId) ?? "Unknown"}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <span className="rounded border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px]">
                            {doc.type ?? "Letter"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <FormatBadge format={doc.format} />
                        </td>
                        <td className="hidden px-4 py-3 text-[12px] text-muted-foreground lg:table-cell">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              void adminRemoveDocument({ id: doc._id });
                              toast.success("Document removed");
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ---------------- Responses ---------------- */}
        <TabsContent value="responses" className="mt-0">
          {loading && (
            <p className="py-12 text-center text-[13px] text-muted-foreground">Loading deployment…</p>
          )}
          {!loading && allResponses!.length === 0 && (
            <EmptyState
              icon={ScrollText}
              title="No responses forged yet"
              body="Generated responses from every user will appear here, ready for review."
            />
          )}
          {!loading && allResponses!.length > 0 && (
            <div className="space-y-2.5">
              {allResponses!.map((r) => (
                <div
                  key={r._id}
                  className="flex items-center gap-4 rounded-xl border border-border/60 bg-card/50 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{r.documentName}</p>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {userMap.get(r.userId) ?? "Unknown"} · {r.language} ·{" "}
                      <span className={r.strategy === "ai" ? "text-chart-2" : "text-primary"}>
                        {r.strategy} engine
                      </span>{" "}
                      · {new Date(r.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      void adminRemoveResponse({ id: r._id });
                      toast.success("Response removed");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---------------- Users ---------------- */}
        <TabsContent value="users" className="mt-0">
          {loading && (
            <p className="py-12 text-center text-[13px] text-muted-foreground">Loading accounts…</p>
          )}
          {!loading && users!.length === 0 && (
            <EmptyState
              icon={Users}
              title="No accounts yet"
              body="The first account to sign in on a fresh deployment receives the admin keys automatically."
            />
          )}
          {!loading && users!.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/50">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-border/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3.5 font-medium">Account</th>
                      <th className="hidden px-4 py-3.5 font-medium sm:table-cell">Email</th>
                      <th className="px-4 py-3.5 font-medium">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {users!.map((u) => (
                      <tr key={u._id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-display text-[12px] font-semibold text-primary">
                              {(u.name ?? u.email ?? "U").charAt(0).toUpperCase()}
                            </div>
                            <p className="font-medium">{u.name ?? "Anonymous visitor"}</p>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-[12.5px] text-muted-foreground sm:table-cell">
                          {u.email ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {u.role === "admin" ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                              <ShieldCheck className="size-3" />
                              Admin
                            </span>
                          ) : (
                            <span className="rounded border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                              Member
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ---------------- Catalog ---------------- */}
        <TabsContent value="catalog" className="mt-0">
          <div className="mb-6 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Plus className="size-4 text-primary" />
              <p className="text-[13.5px] font-semibold">Publish a new document type</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                value={form.emoji}
                onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                placeholder="Emoji"
                className="sm:w-28"
              />
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Name — e.g. Refund Request"
              />
              <Input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Category"
              />
            </div>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Short, inviting description for the catalog card"
              className="mt-3"
            />
            <Textarea
              value={form.starterText}
              onChange={(e) => setForm((f) => ({ ...f, starterText: e.target.value }))}
              rows={5}
              placeholder="Starter template customers begin from (with [placeholders])"
              className="mt-3 font-serif text-[13px] leading-6"
            />
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={handleAddItem} disabled={saving} className="gap-1.5">
                <Plus className="size-3.5" />
                {saving ? "Publishing…" : "Publish entry"}
              </Button>
            </div>
          </div>

          {catalog !== undefined && catalog.length === 0 && (
            <EmptyState
              icon={BookOpen}
              title="The catalog is empty"
              body="Publish your first document type above — it will appear instantly for every customer."
            />
          )}
          {catalog !== undefined && catalog.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {catalog.map((item) => (
                <div
                  key={item._id}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3.5"
                >
                  <span className="text-2xl">{item.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13.5px] font-medium">{item.name}</p>
                      <span className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {item.category}
                      </span>
                      {item.featured && (
                        <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                          Featured
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      void removeCatalogItem({ id: item._id });
                      toast.success("Catalog entry removed");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="mt-8 flex items-center gap-2 rounded-xl border border-border/60 bg-card/30 px-4 py-3">
        <ShieldCheck className="size-4 shrink-0 text-chart-2" />
        <p className="text-[12px] text-muted-foreground">
          The first account on a fresh deployment holds the admin keys. Catalog mutations are
          admin-gated server-side, and every customer only ever sees their own documents.
        </p>
      </div>
    </div>
  );
}
