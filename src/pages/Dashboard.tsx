import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  BookMarked,
  FileText,
  Inbox,
  LayoutDashboard,
  Library,
  LogOut,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";

const NAV = [
  { to: "/dashboard", end: true, icon: LayoutDashboard, label: "Overview" },
  { to: "/dashboard/catalog", end: false, icon: Library, label: "Catalog" },
  { to: "/dashboard/ingest", end: false, icon: Inbox, label: "Ingest" },
  { to: "/dashboard/documents", end: false, icon: FileText, label: "Documents" },
  { to: "/dashboard/responses", end: false, icon: ScrollText, label: "Responses" },
  { to: "/dashboard/glossary", end: false, icon: BookMarked, label: "Glossary" },
  { to: "/dashboard/admin", end: false, icon: ShieldCheck, label: "Admin", adminOnly: true },
];

function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden>
      <rect x="1" y="1" width="38" height="38" rx="9" className="stroke-primary/70" strokeWidth="1.4" />
      <path d="M12 27V15.5L20 22L28 15.5V27" className="stroke-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 27H31" className="stroke-primary/70" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const becomeAdmin = useMutation(api.admin.maybeBecomeAdmin);
  const navigate = useNavigate();

  // First user of a fresh deployment becomes the admin (server-guarded).
  useEffect(() => {
    if (user && !user.role) void becomeAdmin();
  }, [user, becomeAdmin]);

  const visibleNav = NAV.filter((n) => !n.adminOnly || user?.role === "admin");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border/60 bg-sidebar lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <BrandMark className="size-9" />
          <div className="leading-tight">
            <p className="font-display text-[15px] font-semibold tracking-wide">ODA</p>
            <p className="oda-label !text-[9px]">Command Center</p>
          </div>
        </div>
        <div className="oda-rule mx-5" />
        <nav className="flex-1 space-y-1 px-3 py-5">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                  isActive
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                }`
              }
            >
              <item.icon className="size-4.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border px-5 py-4">
          <p className="oda-label mb-3 !text-[8px] !text-sidebar-foreground/60">
            Free forever · Open source · No keys required
          </p>
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-display text-sm font-semibold text-primary">
              {(user?.name ?? user?.email ?? "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-medium">
                {user?.name ?? "Operator"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {user?.email ?? "Signed in"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={handleSignOut}
              title="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-border/60 bg-sidebar px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2.5">
          <BrandMark className="size-8" />
          <div className="leading-tight">
            <p className="font-display text-[14px] font-semibold">ODA</p>
            <p className="oda-label !text-[8px]">Command Center</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={handleSignOut}>
          <LogOut className="size-4" />
        </Button>
      </div>

      {/* Mobile nav */}
      <nav className="fixed inset-x-0 top-[57px] z-40 flex gap-1 overflow-x-auto border-b border-border/60 bg-background/90 px-3 py-2 backdrop-blur lg:hidden">
        {visibleNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                isActive ? "bg-primary/12 text-primary" : "text-muted-foreground"
              }`
            }
          >
            <item.icon className="size-3.5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 px-5 pb-16 pt-[108px] sm:px-8 lg:ml-60 lg:px-10 lg:pt-8">
        <div className="mx-auto w-full max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
