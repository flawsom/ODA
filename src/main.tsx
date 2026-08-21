import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const PublicCatalog = lazy(() => import("./pages/Catalog.tsx"));
const PublicCatalogItem = lazy(() => import("./pages/CatalogItem.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Overview = lazy(() => import("./pages/dashboard/Overview.tsx"));
const Catalog = lazy(() => import("./pages/dashboard/Catalog.tsx"));
const Ingest = lazy(() => import("./pages/dashboard/Ingest.tsx"));
const Documents = lazy(() => import("./pages/dashboard/Documents.tsx"));
const DocumentDetail = lazy(() => import("./pages/dashboard/DocumentDetail.tsx"));
const Responses = lazy(() => import("./pages/dashboard/Responses.tsx"));
const Glossary = lazy(() => import("./pages/dashboard/Glossary.tsx"));
const Admin = lazy(() => import("./pages/dashboard/Admin.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Static-host mode (GitHub Pages / any CDN): hash-based routing so deep links
// work without server rewrites, and a baked-in Convex site URL so the build
// needs zero secrets. Dev/preview keeps BrowserRouter + the platform-managed
// VITE_CONVEX_URL.
const STATIC_HOST = import.meta.env.VITE_STATIC === "true";
const CONVEX_URL =
  (import.meta.env.VITE_CONVEX_URL as string | undefined) ??
  "https://canny-viper-269.convex.cloud";
const Router = STATIC_HOST ? HashRouter : BrowserRouter;

const convex = new ConvexReactClient(CONVEX_URL);



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      {
        type: "iframe-route-change",
        path: STATIC_HOST ? location.pathname + location.hash : location.pathname,
      },
      "*",
    );
  }, [location.pathname, location.hash]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <Router>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/catalog" element={<PublicCatalog />} />
              <Route path="/catalog/:catalogId" element={<PublicCatalogItem />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/dashboard" />}
              />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <Dashboard />
                  </RequireAuth>
                }
              >
                <Route index element={<Overview />} />
                <Route path="catalog" element={<Catalog />} />
                <Route path="ingest" element={<Ingest />} />
                <Route path="documents" element={<Documents />} />
                <Route path="documents/:docId" element={<DocumentDetail />} />
                <Route path="responses" element={<Responses />} />
                <Route path="glossary" element={<Glossary />} />
                <Route path="admin" element={<Admin />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Router>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
