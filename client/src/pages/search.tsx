import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Youtube, ChevronLeft, ChevronRight,
  Download, Eye, Calendar, Loader2, X, CheckCircle, Telescope, Video, Music
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ChannelResult, VideoResult, SearchResults } from "@shared/schema";

export default function SearchPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [channelInput, setChannelInput] = useState("");
  const [resolvedChannel, setResolvedChannel] = useState<ChannelResult | null>(null);
  const [keyword, setKeyword] = useState("");
  const [duration, setDuration] = useState("any");
  const [sort, setSort] = useState("relevance");
  const [site, setSite] = useState("youtube");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [pageHistory, setPageHistory] = useState<string[]>([]);
  const [currentPageToken, setCurrentPageToken] = useState<string | undefined>(undefined);
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());

  const channelMutation = useMutation({
    mutationFn: async (input: string) => {
      const res = await apiRequest("POST", "/api/search/channel", { channelInput: input });
      return res.json() as Promise<ChannelResult>;
    },
    onSuccess: (data) => {
      setResolvedChannel(data);
      setResults(null);
      setPageHistory([]);
      setCurrentPageToken(undefined);
    },
    onError: (err) => {
      toast({ title: "Channel not found", description: err.message, variant: "destructive" });
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (pageToken?: string) => {
      const res = await apiRequest("POST", "/api/search", {
        channelInput: resolvedChannel?.channelId || channelInput,
        channelId: resolvedChannel?.channelId,
        query: keyword,
        duration,
        sort,
        pageToken,
        site,
      });
      return res.json() as Promise<SearchResults>;
    },
    onSuccess: (data) => setResults(data),
    onError: (err) => {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (video: VideoResult & { format: "mp4" | "mp3" }) => {
      const res = await apiRequest("POST", "/api/downloads", {
        urls: video.url,
        format: video.format,
        quality: "1080p",
        embedMetadata: true,
        organizeFiles: false,
        playlistHandling: "no",
        maxPlaylistItems: 1,
      });
      return res.json();
    },
    onSuccess: (_, video) => {
      setQueuedIds((prev) => new Set(prev).add(video.id));
      queryClient.invalidateQueries({ queryKey: ["/api/downloads"] });
      toast({ title: "Queued for download", description: video.title });
    },
    onError: (err) => {
      toast({ title: "Failed to queue", description: err.message, variant: "destructive" });
    },
  });

  const handleChannelResolve = (e: React.FormEvent) => {
    e.preventDefault();
    if (channelInput.trim()) channelMutation.mutate(channelInput.trim());
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPageHistory([]);
    setCurrentPageToken(undefined);
    searchMutation.mutate(undefined);
  };

  const handleNextPage = () => {
    if (!results?.nextPageToken) return;
    setPageHistory((h) => [...h, currentPageToken || ""]);
    setCurrentPageToken(results.nextPageToken);
    searchMutation.mutate(results.nextPageToken);
  };

  const handlePrevPage = () => {
    if (!pageHistory.length) return;
    const prev = pageHistory[pageHistory.length - 1];
    const token = prev === "" ? undefined : prev;
    setPageHistory((h) => h.slice(0, -1));
    setCurrentPageToken(token);
    searchMutation.mutate(token);
  };

  const currentPage = pageHistory.length + 1;

  const selectStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.85)",
    borderRadius: "10px",
  };

  const selectContentStyle = {
    background: "rgba(15,15,25,0.98)",
    backdropFilter: "blur(24px)",
    borderColor: "rgba(255,255,255,0.12)",
  };

  return (
    <div className="space-y-5">
      {/* ── Channel finder ── */}
      <div className="glass shimmer-border rounded-2xl overflow-hidden">
        <div className="px-6 pt-5 pb-4" style={{ background: "linear-gradient(135deg, rgba(29,185,84,0.10) 0%, rgba(168,85,247,0.07) 100%)" }}>
          <div className="flex items-center gap-3 mb-4">
            <Youtube size={18} style={{ color: "#FFD200" }} />
            <h2 className="font-bold text-white" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
              Channel Search
            </h2>
          </div>

          <form onSubmit={handleChannelResolve} className="flex gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.35)" }} />
              <input
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                placeholder="YouTube channel URL, @handle, or channel name"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.9)",
                  caretColor: "#FFD200",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(29,185,84,0.5)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.10)")}
              />
            </div>
            <button
              type="submit"
              disabled={channelMutation.isPending || !channelInput.trim()}
              className="btn-harvester px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 whitespace-nowrap"
            >
              {channelMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              Find Channel
            </button>
          </form>

          {/* Resolved channel badge */}
          {resolvedChannel && (
            <div className="flex items-center gap-3 mt-3 p-3 rounded-xl" style={{ background: "rgba(29,185,84,0.12)", border: "1px solid rgba(29,185,84,0.25)" }}>
              {resolvedChannel.thumbnail && (
                <img src={resolvedChannel.thumbnail} alt={resolvedChannel.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" style={{ boxShadow: "0 0 0 2px rgba(29,185,84,0.4)" }} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{resolvedChannel.name}</p>
                <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{resolvedChannel.channelId}</p>
              </div>
              <span className="pill" style={{ background: "rgba(29,185,84,0.2)", color: "#FFD200" }}>Linked</span>
              <button
                type="button"
                onClick={() => { setResolvedChannel(null); setResults(null); }}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Search bar + filters */}
        <div className="px-6 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.35)" }} />
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Search keywords (leave empty to browse all)"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.9)",
                    caretColor: "#FFD200",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "rgba(255,210,0,0.5)")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                />
              </div>
              <button
                type="submit"
                disabled={searchMutation.isPending}
                className="btn-harvester px-5 py-2.5 rounded-xl text-sm flex items-center gap-2"
              >
                {searchMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Search
              </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Site:</span>
                <Select value={site} onValueChange={setSite}>
                  <SelectTrigger className="h-8 text-xs w-32 rounded-lg" style={selectStyle}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={selectContentStyle}>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="soundcloud">SoundCloud</SelectItem>
                    <SelectItem value="yahoo">Yahoo Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Duration:</span>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger className="h-8 text-xs w-32 rounded-lg" style={selectStyle}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={selectContentStyle}>
                    <SelectItem value="any">Any length</SelectItem>
                    <SelectItem value="short">Short (&lt;4 min)</SelectItem>
                    <SelectItem value="medium">Medium (4–20 min)</SelectItem>
                    <SelectItem value="long">Long (&gt;20 min)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Sort by:</span>
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger className="h-8 text-xs w-32 rounded-lg" style={selectStyle}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={selectContentStyle}>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="date">Upload date</SelectItem>
                    <SelectItem value="viewCount">View count</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* ── Loading ── */}
      {searchMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={32} className="animate-spin" style={{ color: "#FFD200" }} />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>Searching…</p>
        </div>
      )}

      {/* ── Results ── */}
      {results && !searchMutation.isPending && (
        <>
          {/* Header row */}
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              {results.totalResults > 0
                ? `${results.totalResults.toLocaleString()} results · page ${currentPage}`
                : "No results found"}
            </p>
            <div className="flex items-center gap-2">
              <PaginationBtn onClick={handlePrevPage} disabled={pageHistory.length === 0 || searchMutation.isPending}>
                <ChevronLeft size={15} />
              </PaginationBtn>
              <span className="text-xs px-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                {currentPage}
              </span>
              <PaginationBtn onClick={handleNextPage} disabled={!results.nextPageToken || searchMutation.isPending}>
                <ChevronRight size={15} />
              </PaginationBtn>
            </div>
          </div>

          {/* Video grid */}
          {results.videos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {results.videos.map((video: VideoResult) => {
                const queued = queuedIds.has(video.id);
                return (
                  <VideoCard
                    key={video.id}
                    video={video}
                    queued={queued}
                    showChannel={!resolvedChannel}
                    onDownload={(format) => !queued && downloadMutation.mutate({ ...video, format })}
                    isLoading={downloadMutation.isPending}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Telescope size={36} style={{ color: "rgba(255,255,255,0.15)" }} />
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>No videos found — try different keywords or filters</p>
            </div>
          )}

          {/* Bottom pagination */}
          {results.videos.length > 0 && (
            <div className="flex items-center justify-center gap-3 pt-2 pb-4">
              <PaginationBtn onClick={handlePrevPage} disabled={pageHistory.length === 0 || searchMutation.isPending} label="Previous" />
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Page {currentPage}</span>
              <PaginationBtn onClick={handleNextPage} disabled={!results.nextPageToken || searchMutation.isPending} label="Next" />
            </div>
          )}
        </>
      )}

      {/* ── Empty state ── */}
      {!results && !searchMutation.isPending && (
        <div className="glass rounded-2xl flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(29,185,84,0.10)" }}>
            <Search size={28} style={{ color: "rgba(29,185,84,0.6)" }} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-white mb-1" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
              Find any YouTube channel
            </p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
              Enter a URL, @handle, or channel name above to start
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PaginationBtn({
  onClick,
  disabled,
  children,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  children?: React.ReactNode;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: disabled ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.75)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
      {label && <span>{label}</span>}
    </button>
  );
}

function VideoCard({
  video,
  queued,
  showChannel,
  onDownload,
  isLoading,
}: {
  video: VideoResult;
  queued: boolean;
  showChannel: boolean;
  onDownload: (format: "mp4" | "mp3") => void;
  isLoading: boolean;
}) {
  return (
    <div
      className="glass glass-hover card-glow rounded-2xl overflow-hidden flex flex-col transition-all duration-250"
      style={{ cursor: "default" }}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
        />
        {/* Duration badge */}
        <div
          className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded font-mono text-[11px] font-medium"
          style={{ background: "rgba(0,0,0,0.82)", color: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)" }}
        >
          {video.duration}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1 gap-2">
        <h3
          className="text-sm font-semibold text-white line-clamp-2 leading-snug"
          style={{ fontFamily: "'Space Grotesk',sans-serif" }}
        >
          {video.title}
        </h3>

        <div className="space-y-1">
          {video.views && (
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(255,255,255,0.38)" }}>
              <Eye size={10} />
              <span>{video.views} views</span>
            </div>
          )}
          {video.publishedAt && (
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(255,255,255,0.38)" }}>
              <Calendar size={10} />
              <span>{video.publishedAt}</span>
            </div>
          )}
          {showChannel && video.channel && (
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(255,255,255,0.38)" }}>
              <Youtube size={10} />
              <span className="truncate">{video.channel}</span>
            </div>
          )}
        </div>

        {/* Download buttons */}
        <div className="mt-auto flex gap-2">
          <button
            onClick={() => onDownload("mp4")}
            disabled={queued || isLoading}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold transition-all duration-200"
            style={queued
              ? { background: "rgba(255,210,0,0.1)", color: "#FFD200", border: "1px solid rgba(255,210,0,0.2)", cursor: "default" }
              : { background: "#FFD200", color: "#8B4513", boxShadow: "0 2px 10px rgba(255,210,0,0.3)" }
            }
          >
            {queued ? <CheckCircle size={11} /> : <Video size={11} />}
            {queued ? "Queued" : "Video"}
          </button>
          
          <button
            onClick={() => onDownload("mp3")}
            disabled={queued || isLoading}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold transition-all duration-200"
            style={queued
              ? { background: "rgba(139,69,19,0.1)", color: "#8B4513", border: "1px solid rgba(139,69,19,0.2)", cursor: "default" }
              : { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }
            }
          >
            <Music size={11} />
            MP3
          </button>
        </div>
      </div>
    </div>
  );
}
