import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Terminal, RefreshCcw } from "lucide-react";
import type { Download } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

export default function RecentFailures() {
  const { data: downloads = [] } = useQuery<Download[]>({
    queryKey: ["/api/downloads"],
    refetchInterval: 5000,
  });

  const failures = downloads
    .filter((d) => d.status === "error")
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);

  if (failures.length === 0) return null;

  return (
    <div className="mt-8 glass shimmer-border rounded-2xl overflow-hidden mb-6">
      <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.15)" }}>
            <AlertCircle size={16} className="text-red-500" />
          </div>
          <h3 className="font-bold text-white text-lg" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            Recent Failures
          </h3>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {failures.map((fail) => (
          <div 
            key={fail.id} 
            className="p-3 rounded-xl flex flex-col gap-2"
            style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.1)" }}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white truncate flex-1">{fail.title || fail.url}</p>
              <span className="text-[10px] whitespace-nowrap" style={{ color: "rgba(255,255,255,0.3)" }}>
                {fail.createdAt ? formatDistanceToNow(new Date(fail.createdAt), { addSuffix: true }) : "Unknown"}
              </span>
            </div>
            
            <div className="flex items-start gap-2 p-2 rounded-lg bg-black/40 border border-white/5">
              <Terminal size={12} className="mt-0.5 text-red-400 flex-shrink-0" />
              <p className="text-[11px] font-mono text-red-300/80 line-clamp-2 leading-relaxed">
                {fail.errorMessage || fail.error || "Unknown extractor error"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
