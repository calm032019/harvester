import { useEffect } from "react";
import DownloadForm from "@/components/download-form";
import DownloadQueue from "@/components/download-queue";
import StatsCards from "@/components/stats-cards";
import TrendingFeed from "@/components/trending-feed";
import RecentFailures from "@/components/recent-failures";
import FailureAnalytics from "@/components/failure-analytics";
import PodcastMode from "@/components/podcast-mode";
import CloudSync from "@/components/cloud-sync";
import { ClipboardBanner } from "@/components/clipboard-banner";

interface HomeProps {
  urlInputRef?: React.RefObject<HTMLTextAreaElement | null>;
  onAddUrl?: (url: string) => void;
}

export default function Home({ urlInputRef, onAddUrl }: HomeProps) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get("url");
    const sharedText = params.get("text");
    const sharedTitle = params.get("title");

    const possibleUrl = sharedUrl || sharedText || sharedTitle;
    if (possibleUrl) {
      // Basic URL extraction regex
      const urlMatch = possibleUrl.match(/https?:\/\/[^\s]+/);
      if (urlMatch && onAddUrl) {
        onAddUrl(urlMatch[0]);
        // Remove query params without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [onAddUrl]);

  const handleClipboardAdd = (url: string) => {
    if (onAddUrl) onAddUrl(url);
  };

  return (
    <div className="space-y-6">
      {/* Primary Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Harvest Your Media (Wide) */}
        <div className="lg:col-span-2">
          <DownloadForm urlInputRef={urlInputRef} />
        </div>

        {/* Download Queue (Tall) */}
        <div className="lg:row-span-2">
          <DownloadQueue />
        </div>

        {/* Secondary Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:col-span-2">
          <CloudSync />
          <PodcastMode />
        </div>
      </div>

      {/* Trending Section */}
      <div className="pt-4">
        <TrendingFeed onAddUrl={onAddUrl} />
      </div>

      {/* Stats (Bottom Row) */}
      <div className="pt-2">
        <StatsCards />
      </div>

      <ClipboardBanner onAdd={handleClipboardAdd} />
    </div>
  );
}
