import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Keyboard, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const SHORTCUTS = [
  { keys: ["⌘", "V"], win: ["Ctrl", "V"], label: "Paste & add URL from clipboard" },
  { keys: ["/"], win: ["/"], label: "Focus the URL input" },
  { keys: ["?"], win: ["?"], label: "Show this help modal" },
  { keys: ["Esc"], win: ["Esc"], label: "Close modal / overlay" },
  { keys: ["⌘", "K"], win: ["Ctrl", "K"], label: "Jump to channel search" },
];

interface KeyboardShortcutsProps {
  onAddUrl?: (url: string) => void;
  urlInputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export function KeyboardShortcuts({ onAddUrl, urlInputRef }: KeyboardShortcutsProps) {
  const [showHelp, setShowHelp] = useState(false);
  const [, navigate] = useLocation();
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // ? → help modal (not in input)
      if (e.key === "?" && !inInput) {
        e.preventDefault();
        setShowHelp((v) => !v);
        return;
      }

      // Esc → close modal
      if (e.key === "Escape") {
        setShowHelp(false);
        return;
      }

      // / → focus URL input (not in input)
      if (e.key === "/" && !inInput) {
        e.preventDefault();
        urlInputRef?.current?.focus();
        return;
      }

      // ⌘K / Ctrl+K → go to search
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        navigate("/search");
        return;
      }

      // ⌘V / Ctrl+V from anywhere except inputs — add clipboard URL
      if (e.key === "v" && (e.metaKey || e.ctrlKey) && !inInput && onAddUrl) {
        try {
          const text = (await navigator.clipboard.readText()).trim();
          if (/^https?:\/\//.test(text)) {
            e.preventDefault();
            onAddUrl(text);
          }
        } catch { /* permission denied */ }
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [urlInputRef, onAddUrl, navigate]);

  return (
    <>
      {/* Trigger button in the nav (small, icon-only on mobile) */}
      <button
        id="btn-keyboard-shortcuts"
        onClick={() => setShowHelp(true)}
        title="Keyboard shortcuts (?)"
        className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
        style={{
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: "rgba(255,255,255,0.5)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)";
          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)";
        }}
      >
        <Keyboard size={13} />
      </button>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent
          id="modal-keyboard-shortcuts"
          className="max-w-sm w-full p-0 overflow-hidden"
          style={{
            background: "rgba(10,10,18,0.97)",
            backdropFilter: "blur(40px)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: "20px",
            boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(29,185,84,0.18)" }}
              >
                <Keyboard size={15} style={{ color: "#FFD200" }} />
              </div>
              <span
                className="font-bold text-white text-sm"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Keyboard Shortcuts
              </span>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}
            >
              <X size={13} />
            </button>
          </div>
          <div className="p-5 space-y-2">
            {SHORTCUTS.map((s, i) => {
              const keys = isMac ? s.keys : s.win;
              return (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 py-2"
                  style={{ borderBottom: i < SHORTCUTS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                >
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {s.label}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {keys.map((k, j) => (
                      <kbd
                        key={j}
                        className="px-2 py-0.5 rounded-md text-xs font-mono font-semibold"
                        style={{
                          background: "rgba(255,255,255,0.10)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          color: "rgba(255,255,255,0.85)",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
                        }}
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
