import { useQuery } from "@tanstack/react-query";
import { Play, TrendingUp, Clock, Eye, Download } from "lucide-react";
import type { VideoResult } from "@shared/schema";
import { Link } from "wouter";

interface TrendingFeedProps {
  onAddUrl?: (url: string) => void;
}

export default function TrendingFeed({ onAddUrl }: TrendingFeedProps) {
  const { data: trendingVideos, isLoading, error } = useQuery<VideoResult[]>({
    queryKey: ["/api/trending"],
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  if (isLoading) {
    return (
      <div className="mt-8 glass shimmer-border rounded-2xl overflow-hidden p-6 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-48 mb-6"></div>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="min-w-[240px] flex-shrink-0 space-y-3">
              <div className="aspect-video bg-white/5 rounded-xl"></div>
              <div className="h-4 bg-white/10 rounded w-3/4"></div>
              <div className="h-3 bg-white/5 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !trendingVideos?.length) {
    return null; // Fail silently or maybe return a small error message if needed
  }

  return (
    <div className="mt-8 glass shimmer-border rounded-2xl overflow-hidden mb-6">
      <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.15)" }}>
            <TrendingUp size={16} className="text-red-500" />
          </div>
          <h3 className="font-bold text-white text-lg" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            Trending Now
          </h3>
        </div>
      </div>

      <div 
        className="px-6 py-5 flex gap-4 overflow-x-auto snap-x snap-mandatory"
        style={{ scrollbarWidth: "none" }}
      >
        {trendingVideos.map((video) => (
          <div 
            key={video.id} 
            className="flex-shrink-0 w-[280px] sm:w-[320px] snap-center group"
          >
            <div className="relative aspect-video rounded-xl overflow-hidden mb-3 bg-black/20 border border-white/5 group-hover:border-white/15 transition-colors">
              <img 
                src={video.thumbnail} 
                alt={video.title} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <button 
                  onClick={() => onAddUrl && onAddUrl(video.url)}
                  className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center hover:bg-white/30 hover:scale-110 transition-all shadow-xl"
                  title="Download Video"
                >
                  <Download size={20} className="text-white" />
                </button>
              </div>
              <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/70 text-white text-[10px] font-medium backdrop-blur-sm">
                {video.duration}
              </div>
            </div>
            
            <div className="pr-2">
              <h4 className="text-sm font-semibold text-white/90 line-clamp-2 leading-snug group-hover:text-white transition-colors" title={video.title}>
                {video.title}
              </h4>
              <p className="text-xs text-white/50 mt-1.5 truncate flex items-center gap-1.5">
                <Link href={`/search?channel=${video.channelId}`} className="hover:text-white/80 transition-colors">
                  {video.channel}
                </Link>
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-white/40">
                <span className="flex items-center gap-1"><Eye size={12} /> {video.views}</span>
                <span className="flex items-center gap-1"><Clock size={12} /> {video.publishedAt}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
