import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Check, Music, Video, List, Loader2, X, Play, Radio, PictureInPicture2, Link as LinkIcon, Share2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import RecentFailures from "./recent-failures";
import FailureAnalytics from "./failure-analytics";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Download as DownloadType } from "@shared/schema";

export default function DownloadQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [watchingDownload, setWatchingDownload] = useState<DownloadType | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.log("PiP not supported or denied");
    }
  }, []);

  const { data: downloads = [], isLoading } = useQuery<DownloadType[]>({
    queryKey: ["/api/downloads"],
    refetchInterval: 2000,
  });

  // T006: Media Session API Integration
  useEffect(() => {
    if ('mediaSession' in navigator && watchingDownload) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: watchingDownload.title || "Video",
        artist: watchingDownload.channel || "Harvester",
        artwork: watchingDownload.thumbnail ? [{ src: watchingDownload.thumbnail, sizes: '512x512', type: 'image/jpeg' }] : []
      });

      navigator.mediaSession.setActionHandler('play', () => videoRef.current?.play());
      navigator.mediaSession.setActionHandler('pause', () => videoRef.current?.pause());
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        if (videoRef.current) videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
      });
      navigator.mediaSession.setActionHandler('seekforward', () => {
        if (videoRef.current) videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, videoRef.current.duration);
      });
    }
  }, [watchingDownload]);

  const clearCompletedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/downloads/completed");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Cleared", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/downloads"] });
    },
    onError: (err) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const downloadFileMutation = useMutation({
    mutationFn: async (id: number) => {
      const a = document.createElement("a");
      a.href = `/api/downloads/${id}/file`;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return id;
    },
    onSuccess: () => toast({ title: "Saving file…" }),
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const retryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/downloads/${id}/retry`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Retrying", description: "Download has been restarted." });
      queryClient.invalidateQueries({ queryKey: ["/api/downloads"] });
    },
    onError: (err) => {
      toast({ title: "Retry Failed", description: err.message, variant: "destructive" });
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/downloads/${id}/share`);
      return res.json();
    },
    onSuccess: (data) => {
      navigator.clipboard.writeText(data.shareUrl);
      toast({ 
        title: "Link Copied!", 
        description: "Public shareable link has been copied to clipboard." 
      });
    },
    onError: (err) => {
      toast({ title: "Share Failed", description: err.message, variant: "destructive" });
    },
  });

  const processingCount = downloads.filter(d => d.status === "processing" || d.status === "downloading").length;
  const completedCount = downloads.filter(d => d.status === "completed").length;
  const hasErrors = downloads.some(d => d.status === "error" || d.status === "failed");

  return (
    <>
      {/* ── Queue card ── */}
      <div className="glass shimmer-border rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3">
            <Radio size={18} style={{ color: "#FFD200" }} />
            <h3 className="font-bold text-white" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
              Download Queue
            </h3>
            {processingCount > 0 && (
              <span className="pill" style={{ background: "rgba(255,210,0,0.18)", color: "#FFD200" }}>
                {processingCount} active
              </span>
            )}
            {hasErrors && (
              <button 
                onClick={() => setShowAnalytics(true)}
                className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20 text-red-500 animate-pulse hover:bg-red-500/40 transition-colors"
                title="View failures"
              >
                <AlertCircle size={14} />
              </button>
            )}
          </div>
          {completedCount > 0 && (
            <button
              onClick={() => clearCompletedMutation.mutate()}
              disabled={clearCompletedMutation.isPending}
              className="text-xs font-medium transition-all duration-200 px-3 py-1.5 rounded-lg"
              style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Clear completed
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin" style={{ color: "rgba(255,255,255,0.2)" }} />
            </div>
          ) : downloads.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(255,255,255,0.05)" }}>
                <Download size={26} style={{ color: "rgba(255,255,255,0.2)" }} />
              </div>
              <p className="font-semibold text-white mb-1" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Nothing yet</p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>Paste URLs above to start downloading</p>
            </div>
          ) : (
            <div className="space-y-2">
              {downloads.map((dl) => (
                <QueueItem
                  key={dl.id}
                  download={dl}
                  onWatch={() => setWatchingDownload(dl)}
                  onDownload={() => downloadFileMutation.mutate(dl.id)}
                  onRetry={() => retryMutation.mutate(dl.id)}
                  onShare={() => shareMutation.mutate(dl.id)}
                  isDownloading={downloadFileMutation.isPending}
                  isRetrying={retryMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Video Player Modal ── */}
      <Dialog open={!!watchingDownload} onOpenChange={(open) => !open && setWatchingDownload(null)}>
        <DialogContent
          className="max-w-4xl w-full p-0 overflow-hidden"
          style={{
            background: "rgba(8,8,14,0.97)",
            backdropFilter: "blur(40px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "20px",
            boxShadow: "0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,210,0,0.15)",
          }}
        >
          {/* Player header */}
          <div className="flex items-center gap-4 px-5 py-4" style={{ background: "linear-gradient(135deg, rgba(29,185,84,0.10) 0%, rgba(168,85,247,0.07) 100%)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            {watchingDownload?.thumbnail && (
              <img src={watchingDownload.thumbnail} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }} />
            )}
            <div className="flex-1 min-w-0 pr-8">
              <p className="font-bold text-white text-sm leading-snug truncate" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
                {watchingDownload?.title || "Video Player"}
              </p>
              {watchingDownload?.channel && (
                <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.45)" }}>{watchingDownload.channel}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                id="btn-pip-toggle"
                onClick={togglePiP}
                title="Picture-in-Picture"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.15)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
              >
                <PictureInPicture2 size={14} style={{ color: "rgba(255,255,255,0.75)" }} />
              </button>
              <span className="pill" style={{ background: "rgba(29,185,84,0.18)", color: "#FFD200" }}>HD</span>
            </div>
          </div>

          {/* Video */}
          {watchingDownload && (
            <video
              ref={videoRef}
              key={watchingDownload.id}
              controls
              autoPlay
              className="w-full"
              style={{ maxHeight: "68vh", background: "#000", display: "block" }}
              src={`/api/downloads/${watchingDownload.id}/stream`}
            >
              Your browser does not support video.
            </video>
          )}

          {/* Player footer info */}
          {watchingDownload && (
            <div className="px-5 py-3 flex items-center gap-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {watchingDownload.duration && (
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{watchingDownload.duration}</span>
              )}
              {watchingDownload.fileSize && (
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{watchingDownload.fileSize}</span>
              )}
              <span className="text-xs ml-auto" style={{ color: "rgba(255,255,255,0.25)" }}>{watchingDownload.quality?.toUpperCase()}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Failure Analytics Modal ── */}
      <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto glass p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <AlertCircle className="text-red-500" /> Failure Analytics
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-8 mt-4">
            <RecentFailures />
            <FailureAnalytics />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function QueueItem({
  download: dl,
  onWatch,
  onDownload,
  onRetry,
  onShare,
  isDownloading,
  isRetrying,
}: {
  download: DownloadType;
  onWatch: () => void;
  onDownload: () => void;
  onRetry: () => void;
  onShare: () => void;
  isDownloading: boolean;
  isRetrying: boolean;
}) {
  const isActive = dl.status === "downloading" || dl.status === "processing";
  const isCompleted = dl.status === "completed";
  const isFailed = dl.status === "failed" || dl.status === "error";

  return (
    <div
      className="flex items-center gap-4 p-3 rounded-xl glass-hover transition-all duration-200"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Thumbnail */}
      <div className="relative w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        {dl.thumbnail ? (
          <img src={dl.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {dl.format === "mp3" ? <Music size={18} style={{ color: "rgba(255,255,255,0.3)" }} /> : <Video size={18} style={{ color: "rgba(255,255,255,0.3)" }} />}
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }}>
          {dl.format === "mp3" ? (
            <Music size={14} className="text-white opacity-80" />
          ) : (
            <Video size={14} className="text-white opacity-80" />
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate leading-snug" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
          {dl.title || "Processing…"}
        </p>
        <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
          {dl.channel || "Loading…"}
        </p>

        <div className="flex items-center gap-2 mt-1.5">
          <span className="pill text-[9px]" style={{ background: dl.format === "mp3" ? "rgba(168,85,247,0.2)" : "rgba(29,185,84,0.15)", color: dl.format === "mp3" ? "#c084fc" : "#4ade80" }}>
            {dl.format.toUpperCase()}
          </span>
          {dl.fileSize && <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>{dl.fileSize}</span>}
        </div>

        <div className="mt-2">
          {isActive && (
            <>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{dl.progressStage}</span>
                <span className="text-[10px] font-semibold" style={{ color: "#FFD200" }}>{dl.progress}%</span>
              </div>
              <div className="harvester-progress">
                <div className="harvester-progress-fill" style={{ width: `${dl.progress ?? 0}%` }} />
              </div>
            </>
          )}
          {isCompleted && (
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: "#FFD200" }}>
                <Check size={8} className="text-white" />
              </div>
              <span className="text-xs font-medium" style={{ color: "#FFD200" }}>Complete</span>
            </div>
          )}
          {isFailed && (
            <div className="flex items-center gap-1.5">
              <X size={12} style={{ color: "#f87171" }} />
              <span className="text-xs truncate" style={{ color: "#f87171" }}>{dl.errorMessage || dl.error || "Failed"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isActive && (
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
            <Loader2 size={15} className="animate-spin" style={{ color: "#FFD200" }} />
          </div>
        )}
        
        {isCompleted && (
          <>
            {dl.format === "mp4" && (
              <button
                onClick={onWatch}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
                title="Watch"
              >
                <Play size={15} className="text-white" style={{ marginLeft: 1 }} />
              </button>
            )}
            <button
              onClick={onShare}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
              title="Public shareable link"
            >
              <Share2 size={14} className="text-white opacity-80" />
            </button>
            <button
              onClick={onDownload}
              disabled={isDownloading}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 btn-harvester"
              title="Save to device"
            >
              {isDownloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            </button>
          </>
        )}

        {isFailed && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
            title="Retry download"
          >
            {isRetrying ? (
              <Loader2 size={15} className="animate-spin" style={{ color: "#FFD200" }} />
            ) : (
              <Play size={15} className="text-white" style={{ marginLeft: 1 }} />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
