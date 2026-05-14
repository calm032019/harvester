import { useState, useEffect, useCallback } from "react";
import { Clipboard, X, Plus } from "lucide-react";

const URL_RE = /^(https?:\/\/)[\w.-]+\.(com|net|org|tv|co|be|io|app)(\/\S*)?$/i;
const DISMISSED_KEY = "mv-clip-dismissed";

interface ClipboardBannerProps {
  onAdd: (url: string) => void;
}

export function ClipboardBanner({ onAdd }: ClipboardBannerProps) {
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const check = useCallback(async () => {
    try {
      if (!navigator.clipboard?.readText) return;
      const text = (await navigator.clipboard.readText()).trim();
      if (!URL_RE.test(text)) return;
      const dismissed = sessionStorage.getItem(DISMISSED_KEY);
      if (dismissed === text) return;
      setDetectedUrl(text);
      setVisible(true);
    } catch {
      // Permission denied — silent
    }
  }, []);

  useEffect(() => {
    check();
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [check]);

  if (!visible || !detectedUrl) return null;

  const domain = (() => {
    try { return new URL(detectedUrl).hostname.replace("www.", ""); }
    catch { return detectedUrl; }
  })();

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, detectedUrl);
    setVisible(false);
  };

  const add = () => {
    onAdd(detectedUrl);
    dismiss();
  };

  return (
    <div
      id="clipboard-banner"
      className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl animate-in slide-in-from-bottom-4 fade-in duration-300"
      style={{
        background: "rgba(20,20,32,0.92)",
        backdropFilter: "blur(28px) saturate(200%)",
        border: "1px solid rgba(29,185,84,0.35)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(29,185,84,0.15)",
        maxWidth: "calc(100vw - 2rem)",
      }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(29,185,84,0.18)" }}
      >
        <Clipboard size={14} style={{ color: "#FFD200" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white">Clipboard URL detected</p>
        <p className="text-xs truncate mt-0.5" style={{ color: "rgba(255,255,255,0.5)", maxWidth: 240 }}>
          {domain}
        </p>
      </div>
      <button
        id="btn-clipboard-add"
        onClick={add}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
        style={{
          background: "linear-gradient(180deg,#ffe033,#FFD200)",
          color: "white",
          boxShadow: "0 2px 10px rgba(29,185,84,0.35)",
        }}
      >
        <Plus size={12} />
        Add
      </button>
      <button
        id="btn-clipboard-dismiss"
        onClick={dismiss}
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
        style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
