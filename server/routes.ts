import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { videoDownloader } from "./services/youtube-downloader";
import { downloadFormSchema, previewSchema, channelSearchSchema, insertUserSettingsSchema } from "@shared/schema";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import crypto from "crypto";

// --- YouTube Data API helpers ---

function parseDurationISO(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "0:00";
  const h = parseInt(match[1] || "0");
  const m = parseInt(match[2] || "0");
  const s = parseInt(match[3] || "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseDurationToSeconds(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || "0") * 3600) + (parseInt(match[2] || "0") * 60) + parseInt(match[3] || "0");
}

function formatViews(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

async function ytApiGet(url: string) {
  const res = await fetch(url);
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data.error?.message || `YouTube API error ${res.status}`);
  return data;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Preview video URL to show thumbnail and title before download
  app.post("/api/preview", async (req, res) => {
    try {
      const validatedData = previewSchema.parse(req.body);
      
      // Validate video URL format
      const videoUrlRegex = /^(https?:\/\/)?([\w.-]+)\.(com|net|org|tv|co|be|io|app)(\/.*)?$/;
      if (!videoUrlRegex.test(validatedData.url)) {
        return res.status(400).json({ 
          message: "Invalid video URL format" 
        });
      }

      const preview = await videoDownloader.previewVideo(validatedData.url, validatedData.format, validatedData.quality);
      res.json(preview);
    } catch (error) {
      console.error("Preview error:", error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Failed to preview video" 
      });
    }
  });

  // Get trending videos
  app.get("/api/trending", async (req, res) => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return res.status(400).json({ message: "YouTube API key not configured" });

    try {
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&chart=mostPopular&maxResults=12&regionCode=US&key=${apiKey}`;
      const data = await ytApiGet(url);

      if (!data.items?.length) {
        return res.json([]);
      }

      const videos = data.items.map((item: any) => {
        const vid = item.id;
        const isoDuration = item.contentDetails?.duration || "PT0S";
        return {
          id: vid,
          title: item.snippet.title,
          channel: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || "",
          duration: parseDurationISO(isoDuration),
          durationSeconds: parseDurationToSeconds(isoDuration),
          views: formatViews(parseInt(item.statistics?.viewCount || "0")),
          publishedAt: new Date(item.snippet.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
          url: `https://www.youtube.com/watch?v=${vid}`,
        };
      });

      res.json(videos);
    } catch (error) {
      console.error("Trending error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch trending videos" });
    }
  });

  // Settings
  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", async (req, res) => {
    try {
      const validated = insertUserSettingsSchema.partial().parse(req.body);
      // Handle PIN hashing if provided
      const updates: any = { ...validated };
      if (req.body.pin) {
        updates.pinHash = crypto.createHash("sha256").update(req.body.pin).digest("hex");
        updates.securityEnabled = true;
      }
      
      const settings = await storage.updateSettings(updates);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ message: "Failed to update settings" });
    }
  });

  app.post("/api/settings/verify-pin", async (req, res) => {
    try {
      const { pin } = req.body;
      if (!pin) return res.status(400).json({ message: "PIN required" });
      
      const settings = await storage.getSettings();
      const hash = crypto.createHash("sha256").update(pin).digest("hex");
      
      if (settings.pinHash === hash) {
        res.json({ success: true });
      } else {
        res.status(401).json({ success: false, message: "Invalid PIN" });
      }
    } catch (error) {
      res.status(500).json({ message: "Verification failed" });
    }
  });

  // Resolve a YouTube channel from URL / handle / name
  app.post("/api/search/channel", async (req, res) => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return res.status(400).json({ message: "YouTube API key not configured" });

    try {
      const { channelInput } = req.body as { channelInput: string };
      if (!channelInput?.trim()) return res.status(400).json({ message: "Channel input required" });

      const input = channelInput.trim();

      // Extract channel ID (UC…) or handle from various URL formats
      const channelIdMatch = input.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]+)/);
      const handleMatch = input.match(/youtube\.com\/@([^\/?\s]+)/);
      const bareHandle = !input.includes("youtube.com") && input.startsWith("@") ? input.slice(1) : null;
      const bareId = !input.includes("youtube.com") && input.match(/^UC[A-Za-z0-9_-]{20,}$/) ? input : null;

      let data: any;

      if (channelIdMatch || bareId) {
        const id = channelIdMatch?.[1] || bareId;
        data = await ytApiGet(`https://www.googleapis.com/youtube/v3/channels?part=id,snippet&id=${id}&key=${apiKey}`);
      } else if (handleMatch || bareHandle) {
        const handle = handleMatch?.[1] || bareHandle;
        data = await ytApiGet(`https://www.googleapis.com/youtube/v3/channels?part=id,snippet&forHandle=${encodeURIComponent(handle!)}&key=${apiKey}`);
      } else {
        // Fall back: search by name
        data = await ytApiGet(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(input)}&type=channel&maxResults=1&key=${apiKey}`);
        if (data.items?.length) {
          const item = data.items[0];
          return res.json({
            channelId: item.snippet.channelId,
            name: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails?.default?.url || "",
            description: item.snippet.description || "",
          });
        }
        return res.status(404).json({ message: "Channel not found" });
      }

      if (!data.items?.length) return res.status(404).json({ message: "Channel not found" });

      const ch = data.items[0];
      res.json({
        channelId: ch.id,
        name: ch.snippet.title,
        thumbnail: ch.snippet.thumbnails?.default?.url || "",
        description: ch.snippet.description || "",
      });
    } catch (error) {
      console.error("Channel resolve error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to resolve channel" });
    }
  });

  // Search videos within a channel or globally
  app.post("/api/search", async (req, res) => {
    try {
      const body = channelSearchSchema.parse(req.body);
      const { query, duration, sort, pageToken, site } = body;
      const channelId = (req.body as any).channelId as string | undefined;

      const apiKey = process.env.YOUTUBE_API_KEY;
      
      // If site is YouTube and API key is configured, use YouTube Data API
      if (site === "youtube" && apiKey) {
        const params = new URLSearchParams({
          part: "id,snippet",
          type: "video",
          maxResults: "20",
          key: apiKey,
          order: sort,
        });
        if (channelId) params.set("channelId", channelId);
        if (query.trim()) params.set("q", query.trim());
        if (duration !== "any") params.set("videoDuration", duration);
        if (pageToken) params.set("pageToken", pageToken);

        const searchData = await ytApiGet(`https://www.googleapis.com/youtube/v3/search?${params}`);

        if (!searchData.items?.length) {
          return res.json({ videos: [], totalResults: 0 });
        }

        const ids = searchData.items.map((i: any) => i.id.videoId).join(",");
        const videoData = await ytApiGet(
          `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${ids}&key=${apiKey}`
        );

        const detailsMap = new Map<string, any>(videoData.items?.map((v: any) => [v.id, v]));

        const videos = searchData.items.map((item: any) => {
          const vid = item.id.videoId;
          const details = detailsMap.get(vid) as any;
          const isoDuration = details?.contentDetails?.duration || "PT0S";
          return {
            id: vid,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            channelId: item.snippet.channelId,
            thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || "",
            duration: parseDurationISO(isoDuration),
            durationSeconds: parseDurationToSeconds(isoDuration),
            views: formatViews(parseInt(details?.statistics?.viewCount || "0")),
            publishedAt: new Date(item.snippet.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
            url: `https://www.youtube.com/watch?v=${vid}`,
          };
        });

        return res.json({
          videos,
          nextPageToken: searchData.nextPageToken || null,
          prevPageToken: searchData.prevPageToken || null,
          totalResults: searchData.pageInfo?.totalResults || 0,
        });
      }
      
      // Fallback to yt-dlp search for other sites or if API key is missing
      const prefixMap: Record<string, string> = {
        "youtube": "ytsearch",
        "soundcloud": "scsearch",
        "yahoo": "yvsearch",
      };
      const prefix = prefixMap[site || "youtube"] || "ytsearch";
      const searchQuery = channelId ? `${channelId} ${query}` : query;
      
      if (!searchQuery.trim()) {
        return res.json({ videos: [], totalResults: 0 });
      }

      const videos = await videoDownloader.searchVideos(searchQuery, prefix);
      
      res.json({
        videos,
        nextPageToken: null, // yt-dlp search doesn't support easy pagination
        prevPageToken: null,
        totalResults: videos.length,
      });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Search failed" });
    }
  });

  // Get all downloads
  app.get("/api/downloads", async (req, res) => {
    try {
      const downloads = await storage.getAllDownloads();
      res.json(downloads);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch downloads" });
    }
  });

  // Create new download(s)
  app.post("/api/downloads", async (req, res) => {
    try {
      const validatedData = downloadFormSchema.parse(req.body);
      
      // Parse URLs - handle multiple URLs separated by newlines
      const urls = validatedData.urls
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      if (urls.length === 0) {
        return res.status(400).json({ message: "No valid URLs provided" });
      }

      // Resource limits to prevent system overload
      const MAX_URLS_PER_REQUEST = 10;
      const MAX_CONCURRENT_DOWNLOADS = 5;

      if (urls.length > MAX_URLS_PER_REQUEST) {
        return res.status(400).json({ 
          message: `Too many URLs. Maximum ${MAX_URLS_PER_REQUEST} URLs allowed per request. You provided ${urls.length} URLs.` 
        });
      }

      // Check concurrent downloads limit
      const activeDownloads = await storage.getAllDownloads();
      const currentlyDownloading = activeDownloads.filter(d => 
        d.status === 'downloading' || d.status === 'pending'
      ).length;

      if (currentlyDownloading >= MAX_CONCURRENT_DOWNLOADS) {
        return res.status(429).json({ 
          message: `Server is busy. Maximum ${MAX_CONCURRENT_DOWNLOADS} concurrent downloads allowed. Currently processing ${currentlyDownloading} downloads. Please wait for some downloads to complete.` 
        });
      }

      const remainingSlots = MAX_CONCURRENT_DOWNLOADS - currentlyDownloading;
      if (urls.length > remainingSlots) {
        return res.status(429).json({ 
          message: `Can only process ${remainingSlots} more downloads right now. Currently ${currentlyDownloading}/${MAX_CONCURRENT_DOWNLOADS} slots are in use.` 
        });
      }

      // Validate video URLs - support for multiple platforms
      const videoUrlRegex = /^(https?:\/\/)?([\w.-]+)\.(com|net|org|tv|co|be|io|app)(\/.*)?$/;
      const invalidUrls = urls.filter(url => !videoUrlRegex.test(url));
      
      if (invalidUrls.length > 0) {
        return res.status(400).json({ 
          message: `Invalid video URLs: ${invalidUrls.join(', ')}` 
        });
      }

      const downloadIds = await videoDownloader.processMultipleUrls(urls, {
        format: validatedData.format,
        quality: validatedData.quality,
        embedMetadata: validatedData.embedMetadata,
        organizeFiles: validatedData.organizeFiles,
        playlistHandling: validatedData.playlistHandling,
        playlistItems: validatedData.playlistItems,
        maxPlaylistItems: validatedData.maxPlaylistItems,
      });

      res.json({ downloadIds, message: `Started ${urls.length} download(s)` });
    } catch (error) {
      console.error("Download creation error:", error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Failed to create download" 
      });
    }
  });

  // Get specific download
  app.get("/api/downloads/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const download = await storage.getDownload(id);
      
      if (!download) {
        return res.status(404).json({ message: "Download not found" });
      }
      
      res.json(download);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch download" });
    }
  });

  // Download file
  app.get("/api/downloads/:id/file", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const download = await storage.getDownload(id);
      
      if (!download || !download.filePath) {
        return res.status(404).json({ message: "File not found" });
      }

      // Check if file exists
      try {
        await fsPromises.access(download.filePath);
      } catch {
        return res.status(404).json({ message: "File no longer exists" });
      }

      // Get file stats for Content-Length
      const stats = await fsPromises.stat(download.filePath);
      const fileName = path.basename(download.filePath);
      
      // Set headers for proper file download
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', download.format === 'mp3' ? 'audio/mpeg' : 'video/mp4');
      res.setHeader('Content-Length', stats.size.toString());
      res.setHeader('Accept-Ranges', 'bytes');
      
      // Stream the file
      const fileStream = fs.createReadStream(download.filePath);
      
      // Handle stream errors
      fileStream.on('error', (error) => {
        console.error('File stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ message: "Failed to stream file" });
        }
      });
      
      fileStream.pipe(res);
    } catch (error) {
      console.error('Download file error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to download file" });
      }
    }
  });

  // Stream file for online watching (with range support for seeking)
  app.get("/api/downloads/:id/stream", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const download = await storage.getDownload(id);

      if (!download || !download.filePath) {
        return res.status(404).json({ message: "File not found" });
      }

      try {
        await fsPromises.access(download.filePath);
      } catch {
        return res.status(404).json({ message: "File no longer exists" });
      }

      const stats = await fsPromises.stat(download.filePath);
      const fileSize = stats.size;
      const contentType = download.format === "mp3" ? "audio/mpeg" : "video/mp4";
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": contentType,
          "Content-Disposition": "inline",
        });

        const fileStream = fs.createReadStream(download.filePath, { start, end });
        fileStream.on("error", (err) => {
          console.error("Stream error:", err);
          if (!res.headersSent) res.status(500).end();
        });
        fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": contentType,
          "Accept-Ranges": "bytes",
          "Content-Disposition": "inline",
        });

        const fileStream = fs.createReadStream(download.filePath);
        fileStream.on("error", (err) => {
          console.error("Stream error:", err);
          if (!res.headersSent) res.status(500).end();
        });
        fileStream.pipe(res);
      }
    } catch (error) {
      console.error("Stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to stream file" });
      }
    }
  });

  // Clear completed downloads (must come before /api/downloads/:id)
  app.delete("/api/downloads/completed", async (req, res) => {
    try {
      const downloads = await storage.getAllDownloads();
      const completed = downloads.filter(d => d.status === "completed");
      
      for (const download of completed) {
        if (download.filePath && fs.existsSync(download.filePath)) {
          fs.unlinkSync(download.filePath);
        }
        await storage.deleteDownload(download.id);
      }
      
      res.json({ message: `Cleared ${completed.length} completed downloads` });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear completed downloads" });
    }
  });

  // Delete download
  app.delete("/api/downloads/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const download = await storage.getDownload(id);
      
      if (download?.filePath && fs.existsSync(download.filePath)) {
        fs.unlinkSync(download.filePath);
      }
      
      const deleted = await storage.deleteDownload(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Download not found" });
      }
      
      res.json({ message: "Download deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete download" });
    }
  });

  // Retry a failed download
  app.post("/api/downloads/:id/retry", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const download = await storage.getDownload(id);
      
      if (!download) {
        return res.status(404).json({ message: "Download not found" });
      }

      if (download.status !== "error") {
        return res.status(400).json({ message: "Only failed downloads can be retried" });
      }

      // Reset status and start download again
      await storage.updateDownload(id, {
        status: "pending",
        error: null,
        progress: 0,
        progressStage: "Retrying...",
      });

      // Start the download process asynchronously
      videoDownloader.downloadVideo(id).catch(err => {
        console.error(`Retry failed for download ${id}:`, err);
      });

      res.json({ message: "Download retry started" });
    } catch (error) {
      res.status(500).json({ message: "Failed to retry download" });
    }
  });

  // Get Podcast RSS Feed
  app.get("/api/podcast/rss", async (req, res) => {
    try {
      const downloads = await storage.getAllDownloads();
      const completed = downloads.filter(d => d.status === "completed");
      
      const host = `${req.protocol}://${req.get('host')}`;
      
      let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>MediaVault Downloads</title>
    <link>${host}</link>
    <description>Your personal media vault podcast feed</description>
    <language>en-us</language>
    <itunes:author>MediaVault</itunes:author>
    <itunes:summary>Your collected media as a podcast feed</itunes:summary>
    <itunes:image href="${host}/icon-512x512.png" />`;

      for (const dl of completed) {
        const fileUrl = `${host}/api/downloads/${dl.id}/file`;
        rss += `
    <item>
      <title>${dl.title.replace(/[&<>"']/g, '')}</title>
      <itunes:author>${dl.channel.replace(/[&<>"']/g, '')}</itunes:author>
      <description>${dl.url}</description>
      <pubDate>${new Date(dl.createdAt || Date.now()).toUTCString()}</pubDate>
      <enclosure url="${fileUrl}" length="0" type="${dl.format === 'mp3' ? 'audio/mpeg' : 'video/mp4'}" />
      <guid>${fileUrl}</guid>
      <itunes:duration>${dl.duration || '00:00'}</itunes:duration>
    </item>`;
      }

      rss += `
  </channel>
</rss>`;

      res.setHeader('Content-Type', 'application/rss+xml');
      res.send(rss);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate RSS feed" });
    }
  });

  // Get stats
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Share a download (generate token)
  app.post("/api/downloads/:id/share", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const download = await storage.getDownload(id);
      
      if (!download) {
        return res.status(404).json({ message: "Download not found" });
      }
      
      if (download.status !== "completed") {
        return res.status(400).json({ message: "Only completed downloads can be shared" });
      }
      
      let token = download.shareToken;
      if (!token) {
        token = crypto.randomBytes(16).toString("hex");
        await storage.updateDownload(id, { shareToken: token });
      }
      
      res.json({ token, shareUrl: `${req.protocol}://${req.get("host")}/share/${token}` });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate share link" });
    }
  });

  // Public share download endpoint
  app.get("/share/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const download = await storage.getDownloadByShareToken(token);
      
      if (!download || !download.filePath) {
        return res.status(404).send("<h1>404 Not Found</h1><p>The share link is invalid or the file has been removed.</p>");
      }

      if (!fs.existsSync(download.filePath)) {
        return res.status(404).send("<h1>File Missing</h1><p>The file is no longer available on the server.</p>");
      }

      const stats = await fsPromises.stat(download.filePath);
      const fileName = path.basename(download.filePath);
      
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', download.format === 'mp3' ? 'audio/mpeg' : 'video/mp4');
      res.setHeader('Content-Length', stats.size.toString());
      
      fs.createReadStream(download.filePath).pipe(res);
    } catch (error) {
      res.status(500).send("<h1>Server Error</h1><p>Failed to process share link.</p>");
    }
  });

  // Failure analytics
  app.get("/api/analytics/failures", async (req, res) => {
    try {
      const analytics = await storage.getFailureAnalytics();
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch failure analytics" });
    }
  });

  // Export library for Cloud Sync
  app.get("/api/sync/export", async (req, res) => {
    try {
      const downloads = await storage.getAllDownloads();
      const stats = await storage.getStats();
      res.json({ downloads, stats, exportedAt: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  // Import library from Cloud Sync
  app.post("/api/sync/import", async (req, res) => {
    try {
      const { downloads: importedDownloads } = req.body;
      if (!Array.isArray(importedDownloads)) {
        return res.status(400).json({ message: "Invalid import data" });
      }

      for (const dl of importedDownloads) {
        // Simple merge logic: check if URL already exists
        const existing = await storage.getAllDownloads();
        if (!existing.find(e => e.url === dl.url)) {
          const newDl = await storage.createDownload({
            url: dl.url,
            format: dl.format,
            quality: dl.quality,
            status: "completed", // Assume synced items are completed
            progress: 100,
            embedMetadata: true,
            organizeFiles: false,
          });
          await storage.updateDownload(newDl.id, {
            title: dl.title,
            channel: dl.channel,
            thumbnail: dl.thumbnail,
            duration: dl.duration,
          });
        }
      }
      res.json({ message: `Successfully imported ${importedDownloads.length} items` });
    } catch (error) {
      res.status(500).json({ message: "Failed to import data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
