import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { SettingsProvider } from "./hooks/use-settings";
import SettingsPage from "./pages/settings";
import SecurityOverlay from "./components/security-overlay";
import { Download, Search, Settings as SettingsIcon, Zap } from "lucide-react";
import Home from "@/pages/home";
import SearchPage from "@/pages/search";
import NotFound from "@/pages/not-found";
import { useRef, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { DragDropZone } from "@/components/drag-drop-zone";

/* ── Inline SVG: feDisplacementMap filter for true Liquid refraction ── */
function LiquidGlassFilters() {
  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        <filter id="liquid-glass-filter" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.018"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="2" result="softNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softNoise"
            scale="6"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}

function Layout({ children }: { children: React.ReactNode | ((props: { urlInputRef: React.RefObject<HTMLTextAreaElement | null>; onAddUrl: (url: string) => void }) => React.ReactNode) }) {
  const [location] = useLocation();
  const urlInputRef = useRef<HTMLTextAreaElement>(null);

  const navItems = [
    { href: "/", icon: Download, label: "Download" },
    { href: "/search", icon: Search, label: "Search" },
    { href: "/settings", icon: SettingsIcon, label: "Settings" },
  ];

  const handleDragUrls = useCallback((urls: string[]) => {
    if (urlInputRef.current) {
      const current = urlInputRef.current.value;
      const newValue = current ? current + "\n" + urls.join("\n") : urls.join("\n");
      // Use native setter to trigger React's onChange
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      nativeSetter?.call(urlInputRef.current, newValue);
      urlInputRef.current.dispatchEvent(new Event("input", { bubbles: true }));
      urlInputRef.current.focus();
    }
  }, []);

  const handleAddUrl = useCallback((url: string) => {
    handleDragUrls([url]);
  }, [handleDragUrls]);

  return (
    <div className="min-h-dvh flex flex-col">
      <LiquidGlassFilters />
      <DragDropZone onUrlsDetected={handleDragUrls} />

      {/* ── Ambient background orbs ── */}
      <div
        aria-hidden="true"
        style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", overflow: "hidden" }}
      >
        <div style={{
          position: "absolute", width: "60vw", height: "60vw", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,69,19,0.08) 0%, transparent 70%)",
          top: "-15vw", left: "-10vw", filter: "blur(40px)",
        }} />
        <div style={{
          position: "absolute", width: "50vw", height: "50vw", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(79,106,143,0.07) 0%, transparent 70%)",
          bottom: "-10vw", right: "-5vw", filter: "blur(40px)",
        }} />
        <div style={{
          position: "absolute", width: "40vw", height: "40vw", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,210,0,0.05) 0%, transparent 70%)",
          top: "40%", left: "50%", transform: "translate(-50%, -50%)", filter: "blur(60px)",
        }} />
      </div>

      {/* ── Floating glass top dock (desktop / tablet) ── */}
      <header className="hidden md:flex fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(960px,calc(100%-2rem))]">
        <div className="glass-floating w-full px-3 h-14 flex items-center justify-between gap-4">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 select-none pl-2 pr-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #ffe033 0%, #FFD200 60%, #e6bd00 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 14px rgba(255,210,0,0.4)",
              }}
            >
              <Zap size={16} className="text-[#8B4513]" fill="#8B4513" />
            </div>
            <span
              className="font-bold text-base tracking-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--text-primary, white)" }}
            >
              Harvester
            </span>
          </Link>

          {/* Nav pills */}
          <nav className="flex items-center gap-1">
            {navItems.map(({ href, icon: Icon, label }) => {
              const active = location === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
                  style={{
                    transition: "all 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
                    ...(active
                      ? {
                          background: "linear-gradient(180deg, #ffe033, #FFD200)",
                          color: "#8B4513",
                          boxShadow:
                            "inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 14px rgba(255,210,0,0.45)",
                        }
                      : { color: "var(--nav-inactive, rgba(255,255,255,0.62))", background: "transparent" }),
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      const el = e.currentTarget as HTMLElement;
                      el.style.color = "var(--nav-hover, rgba(255,255,255,0.95))";
                      el.style.background = "rgba(255,255,255,0.08)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      const el = e.currentTarget as HTMLElement;
                      el.style.color = "var(--nav-inactive, rgba(255,255,255,0.62))";
                      el.style.background = "transparent";
                    }
                  }}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            <KeyboardShortcuts onAddUrl={handleAddUrl} urlInputRef={urlInputRef} />
            {/* Status pill */}
            <div
              className="flex items-center gap-2 pl-3 pr-3 h-8 rounded-full"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "#FFD200", boxShadow: "0 0 8px rgba(255,210,0,0.7)" }}
              />
              <span className="text-xs font-medium" style={{ color: "var(--text-tertiary, rgba(255,255,255,0.6))" }}>Live</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile floating top brand bar ── */}
      <header className="md:hidden fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)]">
        <div className="glass-floating px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2 select-none">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #ffe033, #FFD200, #e6bd00)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 3px 10px rgba(255,210,0,0.35)",
              }}
            >
              <Zap size={13} className="text-[#8B4513]" fill="#8B4513" />
            </div>
            <span
              className="font-bold text-sm tracking-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--text-primary, white)" }}
            >
              Harvester
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "#FFD200", boxShadow: "0 0 6px rgba(255,210,0,0.7)" }}
              />
              <span className="text-[11px]" style={{ color: "var(--text-tertiary, rgba(255,255,255,0.5))" }}>Live</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Page content (offset for floating headers + bottom dock) ── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-20 md:pt-24 pb-32 md:pb-12">
        {typeof children === "function" ? (children as Function)({ urlInputRef, onAddUrl: handleAddUrl }) : children}
      </main>

      {/* ── Floating mobile bottom dock ── */}
      <nav className="bottom-nav md:hidden">
        <div className="flex items-center gap-1 px-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold"
                style={{
                  transition: "all 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
                  ...(active
                    ? {
                        background: "linear-gradient(180deg, #ffe033, #FFD200)",
                        color: "#8B4513",
                        boxShadow:
                          "inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 14px rgba(255,210,0,0.45)",
                      }
                    : { color: "var(--nav-inactive, rgba(255,255,255,0.6))", background: "transparent" }),
                }}
              >
                <Icon size={17} strokeWidth={active ? 2.4 : 1.9} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Layout>
          {({ urlInputRef, onAddUrl }: { urlInputRef: React.RefObject<HTMLTextAreaElement | null>; onAddUrl: (url: string) => void }) => (
            <Home urlInputRef={urlInputRef} onAddUrl={onAddUrl} />
          )}
        </Layout>
      </Route>
      <Route path="/search">
        <Layout><SearchPage /></Layout>
      </Route>
      <Route path="/settings">
        <Layout><SettingsPage /></Layout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
          <KeyboardShortcuts />
          <SecurityOverlay />
        </TooltipProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}
