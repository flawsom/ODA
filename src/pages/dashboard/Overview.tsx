import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import {
  Download,
  FileText,
  Inbox,
  Languages,
  ScrollText,
  Sparkles,
  Zap,
} from "lucide-react";
import { Link } from "react-router";
import { FormatBadge, PageHeader, StatCard } from "@/components/oda/bits";
import { useAuth } from "@/hooks/use-auth";
import { humanSize } from "@/lib/oda/extract";

export default function Overview() {
  const { user } = useAuth();
  const documents = useQuery(api.documents.list);
  const responses = useQuery(api.responses.list);

  const loading = documents === undefined || responses === undefined;
  const ready = documents?.filter((d) => d.status === "ready") ?? [];
  const formats = new Set(ready.map((d) => d.format));
  const languages = new Set(ready.map((d) => d.language).filter(Boolean));
  const totalSize = (ready ?? []).reduce((acc, d) => acc + d.size, 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const recent = [...(documents ?? [])].slice(0, 6);

  const exportArchive = () => {
    if (!documents || !responses) return;
    const payload = {
      app: "ODA — Omniscient Document Architect",
      exportedAt: new Date().toISOString(),
      documents: documents.map(({ _id, userId, ...rest }) => rest),
      responses: responses.map(({ _id, userId, ...rest }) => rest),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "oda-archive.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Command Center · Status: Optimal"
        title={`${greeting}${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description="Everything you've filed, everything we've answered, and where things stand right now — at a glance."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FileText}
          label="Documents filed"
          value={loading ? "—" : ready.length}
          hint={totalSize > 0 ? `${humanSize(totalSize)} in archive` : "File one or load the samples"}
        />
        <StatCard
          icon={Zap}
          label="Responses generated"
          value={loading ? "—" : responses!.length}
          hint="Ready for dispatch"
          accent="oklch(0.72 0.14 170)"
        />
        <StatCard
          icon={Languages}
          label="Languages handled"
          value={loading ? "—" : languages.size}
          hint={`across ${formats.size} formats`}
          accent="oklch(0.68 0.15 285)"
        />
        <StatCard
          icon={Sparkles}
          label="Pricing"
          value={loading ? "—" : "Free forever"}
          hint="Open source · no keys, no cards"
          accent="oklch(0.75 0.15 55)"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Recent documents */}
        <section className="rounded-2xl border border-border/70 bg-card/50">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
            <h2 className="text-[14px] font-semibold">Recent activity</h2>
            <Link to="/dashboard/documents" className="oda-label !text-[9px] !text-primary hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-border/50">
            {loading && (
              <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">Loading archive…</p>
            )}
            {!loading && recent.length === 0 && (
              <div className="px-5 py-10 text-center">
                <p className="text-[13.5px] text-muted-foreground">
                  No documents yet — the archive is feeling a little lonely.
                </p>
                <Link to="/dashboard/ingest" className="mt-2 inline-block text-[13px] font-medium text-primary hover:underline">
                  File your first document →
                </Link>
              </div>
            )}
            {recent.map((doc) => (
              <Link
                key={doc._id}
                to={`/dashboard/documents/${doc._id}`}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/50 text-muted-foreground">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{doc.name}</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {doc.type ?? "Letter"} · {doc.language ?? "English"} ·{" "}
                    {new Date(doc.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                </div>
                <FormatBadge format={doc.format} />
              </Link>
            ))}
          </div>
        </section>

        {/* Quick actions / system status */}
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border/70 bg-card/50 p-5">
            <h2 className="text-[14px] font-semibold">Quick actions</h2>
            <div className="mt-4 space-y-2.5">
              <Link to="/dashboard/ingest" className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-muted/50">
                <Inbox className="size-4 text-primary" />
                <span className="text-[13px] font-medium">Ingest documents</span>
              </Link>
              <Link to="/dashboard/documents" className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-muted/50">
                <FileText className="size-4 text-primary" />
                <span className="text-[13px] font-medium">Browse &amp; generate responses</span>
              </Link>
              <Link to="/dashboard/responses" className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-muted/50">
                <ScrollText className="size-4 text-primary" />
                <span className="text-[13px] font-medium">Dispatch forge</span>
              </Link>
              <button
                onClick={exportArchive}
                className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/50"
              >
                <Download className="size-4 text-primary" />
                <span className="text-[13px] font-medium">Export my archive</span>
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card/50 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold">System status</h2>
              <span className="flex items-center gap-1.5 text-[11px] text-chart-2">
                <span className="oda-pulse size-1.5 rounded-full bg-chart-2" />
                Optimal
              </span>
            </div>
            <dl className="mt-4 space-y-3">
              {[
                ["Classification", "auto · learnable"],
                ["Generation", "on-device · free forever"],
                ["Languages", "24 supported"],
                ["Formats", "8 parsed"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-[12.5px]">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-mono text-[11.5px] text-foreground/90">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
