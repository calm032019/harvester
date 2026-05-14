import { Radio, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function PodcastMode() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  const rssUrl = `${window.location.origin}/api/podcast/rss`;

  const copyRss = () => {
    navigator.clipboard.writeText(rssUrl);
    setCopied(true);
    toast({ title: "RSS Feed Copied", description: "Subscribe in your favorite podcast app!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-8 glass shimmer-border rounded-2xl overflow-hidden mb-6">
      <div className="px-6 py-4 flex items-center justify-between" style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(29,185,84,0.05) 100%)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(168,85,247,0.15)" }}>
            <Radio size={16} className="text-purple-400" />
          </div>
          <h3 className="font-bold text-white text-lg" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            Podcast Mode
          </h3>
        </div>
      </div>

      <div className="p-6">
        <p className="text-sm text-white/60 mb-4 leading-relaxed">
          Transform your downloads into a personal podcast feed. Paste the RSS URL into apps like Overcast, Pocket Casts, or Apple Podcasts.
        </p>
        
        <div className="flex gap-2">
          <div className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white/40 font-mono truncate flex items-center">
            {rssUrl}
          </div>
          <button
            onClick={copyRss}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 btn-harvester"
            style={{ background: copied ? "rgba(255,210,0,0.2)" : "#FFD200", color: copied ? "#FFD200" : "#8B4513" }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied" : "Copy RSS"}
          </button>
        </div>
      </div>
    </div>
  );
}
