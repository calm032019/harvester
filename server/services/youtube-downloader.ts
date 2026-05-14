import { spawn } from "child_process";
import { promises as fs, existsSync } from "fs";
import path from "path";
import YTDlpWrap from "yt-dlp-wrap";
import { storage } from "../storage";
import { Download } from "../../shared/schema";

interface YouTubeVideoInfo {
  title: string;
  channelTitle: string;
  thumbnails: {
    maxres?: { url: string };
    high?: { url: string };
    medium?: { url: string };
    default?: { url: string };
  };
  duration: string;
  description: string;
}

export class VideoDownloader {
  private downloadsDir: string;
  private ytDlpPath: string;
  private cookiesPath: string | null = null;
  private maxRetries: number = 3;
  // 'default' = let yt-dlp pick its built-in defaults (currently the most
  // reliable in 2026 — yields full DASH ladder incl. 1080p/4K). 'ios' is a
  // safe fallback that returns at least a 360p pre-merged stream.
  private extractorClients = ['default', 'ios'];

  private ytDlpWrap: any;
  private ytDlpReady: Promise<void>;

  constructor() {
    this.downloadsDir = path.join(process.cwd(), "downloads");
    
    // Initialize yt-dlp-wrap
    this.ytDlpWrap = new YTDlpWrap();
    
    // Kick off binary download (async). Errors are logged but will not block construction.
    this.ytDlpReady = this.ytDlpWrap.downloadYtDlp()
      .then(() => {
        console.log("✅ yt-dlp binary ready via yt-dlp-wrap");
        this.ytDlpPath = this.ytDlpWrap.getBinaryPath();
      })
      .catch((err: any) => {
        console.error("⚠ Failed to download yt-dlp binary via yt-dlp-wrap:", err);
        // Fallback: keep path empty – subsequent spawn will fail and be handled.
        this.ytDlpPath = "";
      });
      
    this.ensureDownloadsDir();
    this.setupCookies();
    this.checkApiKeyStatus();
    this.logYtDlpVersion();
  }

  // Ensure yt-dlp binary is downloaded and path set before any operation
  private async ensureBinaryReady(): Promise<void> {
    if (this.ytDlpPath && this.ytDlpPath.length > 0) {
      return;
    }
    await this.ytDlpReady;
  }

  private async ensureDownloadsDir() {
    try {
      await fs.access(this.downloadsDir);
    } catch {
      await fs.mkdir(this.downloadsDir, { recursive: true });
    }
  }

  private async setupCookies() {
    try {
      // Check if cookies are provided via environment secret
      const cookiesContent = process.env.COOKIES_TXT;
      if (cookiesContent) {
        this.cookiesPath = path.join(process.cwd(), "cookies.txt");
        // Write cookies with secure file permissions (0o600) to prevent unauthorized access
        await fs.writeFile(this.cookiesPath, cookiesContent, { mode: 0o600 });
        console.log("Cookies loaded from environment variable");
      } else {
        // Check if cookies.txt file exists
        const cookiesFile = path.join(process.cwd(), "cookies.txt");
        try {
          await fs.access(cookiesFile);
          this.cookiesPath = cookiesFile;
          console.log("Using existing cookies.txt file");
        } catch {
          console.log("No cookies found - downloads may be limited by YouTube bot protection");
        }
      }
    } catch (error) {
      console.error("Error setting up cookies:", error);
    }
  }

  private checkApiKeyStatus(): void {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (apiKey) {
      console.log("✓ YouTube API key configured - enhanced metadata extraction enabled");
    } else {
      console.log("ℹ YouTube API key not configured - using yt-dlp for all metadata extraction");
      console.log("  To enable faster metadata extraction, set up a YouTube API key:");
      console.log("  1. Get an API key from https://console.cloud.google.com/");
      console.log("  2. Set YOUTUBE_API_KEY environment variable");
      console.log("  3. Restart the application");
    }
  }

  private async logYtDlpVersion() {
    // Ensure binary is ready before checking version
    await this.ensureBinaryReady();
    if (!this.ytDlpPath) {
      console.log("⚠ yt-dlp binary not ready yet – version check postponed");
      return;
    }
    try {
      const { spawn } = await import("child_process");
      const process = spawn(this.ytDlpPath, ["--version"]);
      
      let version = "";
      process.stdout.on("data", (data) => {
        version += data.toString();
      });
      
      process.on("close", (code) => {
        if (code === 0 && version) {
          console.log(`yt-dlp version: ${version.trim()}`);
        } else {
          console.log("⚠ Could not determine yt-dlp version - please ensure yt-dlp is installed");
        }
      });
      
      // Timeout after 3 seconds
      setTimeout(() => {
        process.kill();
      }, 3000);
    } catch (error) {
      console.log("⚠ yt-dlp not found - please install yt-dlp");
    }
  }

  async previewVideo(url: string, format?: string, quality?: string): Promise<{
    title: string;
    channel: string;
    thumbnail: string;
    duration: string;
    url: string;
    fileSize?: string;
  }> {
    const videoInfo = await this.getVideoInfoWithAuth(url, format, quality);
    return {
      ...videoInfo,
      url: url
    };
  }

  async downloadVideo(downloadId: number) {
    return this.downloadVideoWithOptions(downloadId);
  }

  async downloadVideoWithOptions(downloadId: number, playlistOptions?: {
    playlistHandling?: string;
    playlistItems?: string;
    maxPlaylistItems?: number;
  }) {
    const download = await storage.getDownload(downloadId);
    if (!download) {
      throw new Error("Download not found");
    }

    try {
      await storage.updateDownload(downloadId, {
        status: "downloading",
        progressStage: "Extracting video info",
        progress: 10,
      });

      // Get video info with authentication bypass
      const videoInfo = await this.getVideoInfoWithAuth(download.url);
      
      await storage.updateDownload(downloadId, {
        title: videoInfo.title,
        channel: videoInfo.channel,
        thumbnail: videoInfo.thumbnail,
        duration: videoInfo.duration,
        progressStage: "Starting download",
        progress: 20,
      });

      // Build download arguments with authentication
      const outputPath = this.getOutputPath(download, videoInfo.title);
      
      // Try download with different extractor clients
      await this.executeDownloadWithRetries(downloadId, download, outputPath, playlistOptions);

      // Get final file size
      const fileSize = await this.getFileSize(outputPath);
      
      await storage.updateDownload(downloadId, {
        status: "completed",
        progress: 100,
        progressStage: "Download complete",
        fileSize,
        filePath: outputPath,
      });

      await this.updateStats();
      
    } catch (error) {
      console.error(`Download failed:`, error);
      await storage.updateDownload(downloadId, {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        progress: 0,
      });
      throw error;
    }
  }

  private async getVideoInfoWithAuth(url: string, format?: string, quality?: string): Promise<{
    title: string;
    channel: string;
    thumbnail: string;
    duration: string;
    fileSize?: string;
  }> {
    // Check if it's a YouTube URL
    if (this.isYouTubeUrl(url)) {
      // YouTube now requires valid cookies for reliable downloads
      if (!this.cookiesPath) {
        throw new Error("YouTube downloads require authentication cookies. Please provide cookies.txt via COOKIES_TXT environment variable or upload a cookies.txt file. Export cookies from a logged-in YouTube session using a browser extension.");
      }

      // For playlist URLs, skip API and go directly to yt-dlp
      if (this.isPlaylistUrl(url)) {
        console.log(`Detected playlist URL: ${url}, using yt-dlp for playlist handling`);
        return this.getVideoInfoWithYtDlp(url, format, quality);
      } else {
        // Regular video URL - try API first
        const videoId = this.extractVideoId(url);
        
        try {
          // First try YouTube Data API for YouTube videos
          const apiInfo = await this.getVideoInfoFromAPI(videoId);
          if (apiInfo) {
            // If format/quality is requested and we need file size, API won't have it.
            // If no filesize requested, return API info.
            if (!format || !quality) {
              return apiInfo;
            }
          }
        } catch (error) {
          console.log("YouTube API extraction failed, trying yt-dlp:", error);
        }
      }
    }

    // For all sites (including YouTube fallback), use yt-dlp
    return this.getVideoInfoWithYtDlp(url, format, quality);
  }

  private async getVideoInfoFromAPI(videoId: string): Promise<{
    title: string;
    channel: string;
    thumbnail: string;
    duration: string;
  } | null> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.log("YouTube API key not configured - using yt-dlp fallback method");
      return null; // Fall back to yt-dlp instead of throwing error
    }

    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,contentDetails`;
    
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${data.error?.message || 'Unknown error'}`);
      }
      
      if (!data.items || data.items.length === 0) {
        throw new Error("Video not found");
      }
      
      const video = data.items[0];
      const snippet = video.snippet;
      const contentDetails = video.contentDetails;
      
      const thumbnail = snippet.thumbnails.maxres?.url || 
                       snippet.thumbnails.high?.url || 
                       snippet.thumbnails.medium?.url || 
                       snippet.thumbnails.default?.url || "";
      
      return {
        title: snippet.title,
        channel: snippet.channelTitle,
        thumbnail,
        duration: this.parseISO8601Duration(contentDetails.duration)
      };
    } catch (error) {
      console.error("YouTube API request failed:", error);
      return null;
    }
  }

  private async getPlaylistInfoFromAPI(playlistId: string): Promise<{
    title: string;
    channel: string;
    thumbnail: string;
    duration: string;
  } | null> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.log("YouTube API key not configured - using yt-dlp fallback method");
      return null;
    }

    const apiUrl = `https://www.googleapis.com/youtube/v3/playlists?id=${playlistId}&key=${apiKey}&part=snippet`;
    console.log(`Making YouTube Playlist API request to: ${apiUrl.replace(apiKey, 'API_KEY_HIDDEN')}`);
    
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      console.log(`YouTube Playlist API response status: ${response.status}`);
      console.log(`YouTube Playlist API response data:`, JSON.stringify(data, null, 2));
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${data.error?.message || 'Unknown error'}`);
      }
      
      if (!data.items || data.items.length === 0) {
        throw new Error("Playlist not found");
      }
      
      const playlist = data.items[0];
      const snippet = playlist.snippet;
      
      const thumbnail = snippet.thumbnails.maxres?.url || 
                       snippet.thumbnails.high?.url || 
                       snippet.thumbnails.medium?.url || 
                       snippet.thumbnails.default?.url || "";
      
      return {
        title: snippet.title,
        channel: snippet.channelTitle,
        thumbnail,
        duration: "Playlist" // Playlists don't have a duration, so use a placeholder
      };
    } catch (error) {
      console.error("YouTube Playlist API request failed:", error);
      return null;
    }
  }

  private parseISO8601Duration(duration: string): string {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return "Unknown";
    
    const hours = parseInt(match[1] || "0");
    const minutes = parseInt(match[2] || "0");
    const seconds = parseInt(match[3] || "0");
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  private isYouTubeUrl(url: string): boolean {
    return /(?:youtube\.com|youtu\.be|music\.youtube\.com)/i.test(url);
  }

  private extractVideoId(url: string): string {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|music\.youtube\.com\/watch\?v=)([^&\n?#]+)/);
    return match ? match[1] : '';
  }

  private isPlaylistUrl(url: string): boolean {
    return url.includes('playlist?list=') || url.includes('list=');
  }

  private extractPlaylistId(url: string): string {
    const match = url.match(/[?&]list=([^&\n?#]+)/);
    return match ? match[1] : '';
  }

  private extractSiteInfo(url: string): { site: string; id: string } {
    // YouTube
    if (this.isYouTubeUrl(url)) {
      return { site: 'youtube', id: this.extractVideoId(url) };
    }
    
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return { site: 'vimeo', id: vimeoMatch[1] };
    }
    
    // TikTok
    const tiktokMatch = url.match(/tiktok\.com\/.*\/video\/(\d+)/);
    if (tiktokMatch) {
      return { site: 'tiktok', id: tiktokMatch[1] };
    }
    
    // Generic fallback
    return { site: 'generic', id: '' };
  }

  private async getVideoInfoWithYtDlp(url: string, format?: string, quality?: string): Promise<{
    title: string;
    channel: string;
    thumbnail: string;
    duration: string;
    fileSize?: string;
  }> {
    // Try different extractor clients with retries
    for (let clientIndex = 0; clientIndex < this.extractorClients.length; clientIndex++) {
      const client = this.extractorClients[clientIndex];
      
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const isYouTube = this.isYouTubeUrl(url);
          console.log(`Trying ${isYouTube ? 'YouTube ' + client : client} client (attempt ${attempt}/${this.maxRetries})`);
          const result = await this.tryGetVideoInfo(url, client, format, quality);
          if (result) {
            return result;
          }
        } catch (error) {
          console.log(`${client} client attempt ${attempt} failed:`, error instanceof Error ? error.message : String(error));
          if (attempt < this.maxRetries) {
            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.pow(2, attempt - 1) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    }
    
    throw new Error("All YouTube extractor clients failed. Video may be private, age-restricted, or require authentication cookies.");
  }

  private async tryGetVideoInfo(url: string, client: string, format?: string, quality?: string): Promise<{
    title: string;
    channel: string;
    thumbnail: string;
    duration: string;
    fileSize?: string;
  } | null> {
    // Ensure binary is ready before spawning yt-dlp
    await this.ensureBinaryReady();
    return new Promise((resolve, reject) => {
      const args = [
        "--print-json",
        "--no-warnings",
        "--skip-download",
        // T001: Prevent 416 errors on sites that don't support range requests
        "--no-continue",
        // Authentication
        ...(this.cookiesPath ? ["--cookies", this.cookiesPath] : []),
        // Extractor client rotation
        "--extractor-args", `youtube:player_client=${client}`,
        // Enhanced headers for all sites
        "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "--add-header", "Accept-Language:en-US,en;q=0.9",
        "--add-header", "Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "--referer", this.getRefererForUrl(url),
        "--extractor-retries", "2",
        "--fragment-retries", "2",
        "--socket-timeout", "15",
      ];
      
      if (format && quality) {
        if (format === "mp3") {
          args.push("-f", "bestaudio");
        } else {
          args.push("-f", this.getVideoFormat(quality));
        }
      }
      
      args.push(url);

      const process = spawn(this.ytDlpPath, args);
      let stdout = "";
      let stderr = "";

      process.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      process.on("close", (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(stdout);
            
            let fileSizeStr: string | undefined;
            const bytes = info.filesize || info.filesize_approx;
            if (bytes) {
              fileSizeStr = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
            }
            
            resolve({
              title: info.title || "Unknown Title",
              channel: info.uploader || info.channel || "Unknown Channel",
              thumbnail: info.thumbnail || "",
              duration: this.formatDuration(info.duration) || "Unknown",
              fileSize: fileSizeStr
            });
          } catch (parseError) {
            console.error(`Failed to parse video info for ${url}. Output was not JSON:`, stdout.substring(0, 500));
            if (stdout.includes("<!DOCTYPE html>")) {
              reject(new Error("The site returned a blocking page (404/Bot detection) instead of video data. Try again later."));
            } else {
              reject(new Error(`Failed to parse video info: ${parseError}`));
            }
          }
        } else {
          resolve(null); // Return null for failed attempts to trigger retry
        }
      });
      
      // Timeout after 15 seconds
      setTimeout(() => {
        process.kill();
        resolve(null);
      }, 15000);
    });
  }

  async searchVideos(query: string, sitePrefix: string = "ytsearch"): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // For cross-site search, we use prefix:query
      // e.g. "scsearch20:my song"
      const maxResults = 20;
      const searchQuery = `${sitePrefix}${maxResults}:${query}`;
      
      const args = [
        "--dump-json",
        "--no-warnings",
        "--flat-playlist",
        // Enhanced headers
        "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        searchQuery
      ];

      const process = spawn(this.ytDlpPath, args);
      let stdout = "";
      let stderr = "";

      process.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      process.on("close", (code) => {
        if (code === 0 && stdout.trim()) {
          try {
            // yt-dlp returns one JSON object per line
            const lines = stdout.trim().split("\n");
            const videos = lines.map(line => {
              const info = JSON.parse(line);
              return {
                id: info.id || String(Math.random()),
                title: info.title || "Unknown Title",
                channel: info.uploader || info.channel || "Unknown Channel",
                channelId: info.channel_id || "",
                thumbnail: info.thumbnail || "",
                duration: this.formatDuration(info.duration) || "Unknown",
                durationSeconds: info.duration || 0,
                views: info.view_count ? this.formatViews(info.view_count) : "0",
                publishedAt: info.upload_date ? this.formatUploadDate(info.upload_date) : "Unknown",
                url: info.url || info.webpage_url || `https://www.youtube.com/watch?v=${info.id}`,
              };
            });
            resolve(videos);
          } catch (parseError) {
            reject(new Error(`Failed to parse search results: ${parseError}`));
          }
        } else {
          console.error("Search failed with stderr:", stderr);
          resolve([]); // Return empty list on failure
        }
      });
      
      // Timeout after 30 seconds for search
      setTimeout(() => {
        process.kill();
        resolve([]);
      }, 30000);
    });
  }

  private formatViews(n: number): string {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  private formatUploadDate(dateStr: string): string {
    if (!dateStr || dateStr.length !== 8) return "Unknown";
    // YYYYMMDD to formatted string
    const year = dateStr.substring(0, 4);
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = dateStr.substring(6, 8);
    const date = new Date(parseInt(year), month, parseInt(day));
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }



  private buildAuthenticatedArgs(download: Download, outputPath: string, client: string = 'android', playlistOptions?: {
    handling: string;
    items?: string;
    maxItems: number;
  }): string[] {
    const isYouTube = this.isYouTubeUrl(download.url);
    
    const args = [
      "--no-warnings",
      "--progress",
      "--newline",
      // T001: Prevent 416 errors on sites that don't support range requests
      "--no-continue",
      // Authentication - only use cookies for YouTube (they're YouTube-specific cookies)
      ...(isYouTube && this.cookiesPath ? ["--cookies", this.cookiesPath] : []),
      // YouTube-specific extractor client rotation (only for YouTube URLs).
      // When client is 'default', omit the flag so yt-dlp uses its built-in
      // client selection (most reliable in 2026).
      ...(isYouTube && client !== 'default'
        ? ["--extractor-args", `youtube:player_client=${client}`]
        : []),
      // Enhanced headers
      "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      "--add-header", "Accept-Language: en-US,en;q=0.9",
      // YouTube-specific referer (only for YouTube URLs)
      ...(isYouTube ? ["--add-header", "Referer: https://www.youtube.com/"] : []),
      // Reduced retry attempts for faster failure detection
      "--extractor-retries", "2",
      "--fragment-retries", "5",
      "--socket-timeout", "20",
      // ── Speed boosters ──────────────────────────────────────────
      // Download up to 16 video fragments in parallel (huge speedup for HLS/DASH streams)
      "--concurrent-fragments", "16",
      // Larger HTTP chunk size — fewer round trips
      "--http-chunk-size", "10M",
      // Bigger network buffer
      "--buffer-size", "16K",
      // Don't reserve disk space (tiny but helps perceived start time)
      "--no-part",
      // Skip writing extra metadata files
      "--no-write-info-json",
      "--no-write-description",
      "--no-write-comments",
    ];

    // Playlist handling options
    if (playlistOptions) {
      if (playlistOptions.handling === "yes") {
        args.push("--yes-playlist");
      } else if (playlistOptions.handling === "no") {
        args.push("--no-playlist");
      }
      // auto = let yt-dlp decide based on URL
      
      // Specific playlist items
      if (playlistOptions.items && playlistOptions.items.trim()) {
        args.push("--playlist-items", playlistOptions.items);
      } else if (playlistOptions.maxItems && playlistOptions.maxItems > 0) {
        // Download first N items if no specific items specified
        args.push("--playlist-items", `1-${playlistOptions.maxItems}`);
      }
      
      // Skip after errors to prevent one bad video from stopping entire playlist
      args.push("--skip-playlist-after-errors", "3");
    }

    // Output options
    args.push("-o", outputPath);
    args.push("--embed-metadata");
    args.push("--add-metadata");
    args.push("--embed-thumbnail");

    // Format-specific options
    if (download.format === "mp3") {
      args.push("-x", "--audio-format", "mp3");
      args.push("--audio-quality", this.getAudioQuality(download.quality));
      args.push("--embed-thumbnail");
    } else {
      args.push("-f", this.getVideoFormat(download.quality));
    }

    args.push(download.url);
    return args;
  }

  private getAudioQuality(quality: string): string {
    switch (quality) {
      case "320kbps": return "320K";
      case "192kbps": return "192K";
      case "128kbps": return "128K";
      default: return "192K";
    }
  }

  private getVideoFormat(quality: string): string {
    // Permissive selectors with multiple fallbacks so we never hit
    // "Requested format is not available". Order: best mp4 video+audio,
    // then any video+audio, then any pre-merged best, then absolute best.
    const cap = (h: number) =>
      `bestvideo[height<=${h}][ext=mp4]+bestaudio[ext=m4a]/` +
      `bestvideo[height<=${h}]+bestaudio/` +
      `best[height<=${h}][ext=mp4]/` +
      `best[height<=${h}]/best`;
    switch (quality) {
      case "4K":   return cap(2160);
      case "1080p": return cap(1080);
      case "720p": return cap(720);
      case "480p": return cap(480);
      default: return "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best";
    }
  }

  private getOutputPath(download: Download, title: string): string {
    const sanitizedTitle = title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
    const extension = download.format === "mp3" ? "mp3" : "mp4";
    return path.join(this.downloadsDir, `${sanitizedTitle}.${extension}`);
  }

  private async executeDownloadWithRetries(downloadId: number, download: Download, outputPath: string, playlistOptions?: {
    playlistHandling?: string;
    playlistItems?: string;
    maxPlaylistItems?: number;
  }): Promise<void> {
    const isYouTube = this.isYouTubeUrl(download.url);
    
    // For YouTube with cookies, prioritize 'web' client (it's the only one that uses cookies properly for age-restricted content)
    // For non-YouTube, just try once with default settings (client rotation is YouTube-specific)
    // In 2026 the most reliable approach is to let yt-dlp use its built-in
    // default client list (which currently combines tv_simply + ios + others).
    // 'ios' is kept as a guaranteed fallback (always returns at least 360p).
    const clients = isYouTube ? this.extractorClients : ['default'];
    
    let lastError = "";
    
    // Try different extractor clients for the actual download
    for (let clientIndex = 0; clientIndex < clients.length; clientIndex++) {
      const client = clients[clientIndex];
      
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          console.log(`Attempting download with ${client} client (attempt ${attempt}/${this.maxRetries})`);
          
          await storage.updateDownload(downloadId, {
            progressStage: `Downloading with ${client} client (attempt ${attempt})`,
            progress: 25 + (clientIndex * 15) + (attempt * 5),
          });
          
          // Convert playlist options to the format expected by buildAuthenticatedArgs
          const playlistArgs = playlistOptions ? {
            handling: playlistOptions.playlistHandling || "auto",
            items: playlistOptions.playlistItems,
            maxItems: playlistOptions.maxPlaylistItems || 0,
          } : undefined;
          
          const args = this.buildAuthenticatedArgs(download, outputPath, client, playlistArgs);
          await this.executeDownloadWithAuth(downloadId, download.url, args);
          
          // If we get here, download succeeded
          console.log(`Download successful with ${client} client`);
          return;
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          lastError = errorMessage;
          console.log(`Download with ${client} client attempt ${attempt} failed:`, errorMessage);
          
          // Check if it's a file size error - don't retry, fail immediately with specific message
          if (errorMessage.includes("File is larger than max-filesize") || 
              errorMessage.includes("exceeds maximum allowed size")) {
            throw new Error("Download failed: File size exceeds 200MB limit. Try a lower quality or different format.");
          }
          
          // Check if it's an authentication error
          if (errorMessage.includes("Sign in to confirm") || errorMessage.includes("not a bot")) {
            if (attempt < this.maxRetries) {
              // Short delay for authentication errors before retry
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } else {
            // For other errors, move to next client immediately
            break;
          }
        }
      }
    }
    
    // If all clients and retries failed, provide specific error or helpful message
    if (lastError.includes("Sign in to confirm") || lastError.includes("not a bot") || lastError.includes("Private video")) {
      if (this.cookiesPath) {
        throw new Error("Download failed: Authentication required. Your cookies may be expired or missing required data (SAPISID, __Secure-3PAPISID). Please re-export your cookies using a browser extension that includes HTTPOnly cookies.");
      } else {
        throw new Error("Download failed: YouTube bot protection detected. Please provide authentication cookies via COOKIES_TXT secret.");
      }
    } else if (lastError) {
      // Surface the actual error message instead of a generic one
      throw new Error(`Download failed: ${lastError}`);
    } else {
      throw new Error("Download failed with all extraction methods. Please try again or use a different URL.");
    }
  }

  private async executeDownloadWithAuth(downloadId: number, url: string, args: string[]): Promise<void> {
    // Ensure binary is ready before spawning yt-dlp for download
    await this.ensureBinaryReady();
    return new Promise((resolve, reject) => {
      console.log("Starting download with args:", args.join(" "));
      const process = spawn(this.ytDlpPath, args);
      
      let hasError = false;
      let errorMessage = "";
      
      process.stdout.on("data", (data) => {
        const output = data.toString();
        console.log("yt-dlp output:", output);
        
        // Check for silent abort messages (yt-dlp exits 0 but didn't download)
        if (output.includes("File is larger than max-filesize") || output.includes("Aborting")) {
          hasError = true;
          errorMessage += output;
          return;
        }
        
        // Parse progress from yt-dlp output
        const progressMatch = output.match(/(\d+\.?\d*)%/);
        if (progressMatch) {
          const progress = Math.min(99, Math.max(20, parseFloat(progressMatch[1])));
          storage.updateDownload(downloadId, {
            progress,
            progressStage: "Downloading",
          });
        }
        
        // Check for download completion indicators
        if (output.includes("100%") || output.includes("has already been downloaded")) {
          storage.updateDownload(downloadId, {
            progress: 95,
            progressStage: "Finalizing",
          });
        }
      });

      process.stderr.on("data", (data) => {
        const error = data.toString();
        console.error("yt-dlp error:", error);
        errorMessage += error;
        
        // Check for specific errors
        if (error.includes("Sign in to confirm") || 
            error.includes("Please sign in") ||
            error.includes("not a bot") ||
            error.includes("Private video")) {
          hasError = true;
          storage.updateDownload(downloadId, {
            progressStage: "Authentication required",
          });
        } else if (error.includes("File is larger than max-filesize") || 
                   error.includes("exceeds maximum allowed size")) {
          hasError = true;
          storage.updateDownload(downloadId, {
            progressStage: "File too large",
          });
        }
      });

      process.on("close", (code) => {
        if (code === 0 && !hasError) {
          resolve();
        } else if (hasError) {
          reject(new Error(`Download process failed: ${errorMessage}`));
        } else {
          reject(new Error(`Download process failed with code ${code}: ${errorMessage}`));
        }
      });
    });
  }






  private formatDuration(seconds: number): string {
    if (!seconds) return "Unknown";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private async getFileSize(filePath: string): Promise<string> {
    try {
      const stats = await fs.stat(filePath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(1);
      return `${sizeInMB} MB`;
    } catch {
      return "Unknown";
    }
  }

  private getRefererForUrl(url: string): string {
    if (this.isYouTubeUrl(url)) {
      return "https://www.youtube.com/";
    } else if (url.includes('vimeo.com')) {
      return "https://vimeo.com/";
    } else if (url.includes('tiktok.com')) {
      return "https://www.tiktok.com/";
    } else if (url.includes('dailymotion.com')) {
      return "https://www.dailymotion.com/";
    }
    // Generic referer for other sites
    return "https://www.google.com/";
  }

  private async updateStats(): Promise<void> {
    const downloads = await storage.getAllDownloads();
    const completedDownloads = downloads.filter(d => d.status === "completed");
    
    await storage.updateStats({
      totalDownloads: completedDownloads.length,
      totalSize: this.calculateTotalSize(completedDownloads),
      averageFileSize: completedDownloads.length > 0 ? 
        this.calculateTotalSize(completedDownloads) : "0 MB"
    });
  }

  private calculateTotalSize(downloads: Download[]): string {
    let totalBytes = 0;
    downloads.forEach(download => {
      if (download.fileSize) {
        const match = download.fileSize.match(/(\d+\.?\d*)\s*MB/);
        if (match) {
          totalBytes += parseFloat(match[1]) * 1024 * 1024;
        }
      }
    });
    
    const totalMB = totalBytes / (1024 * 1024);
    return totalMB > 1024 ? 
      `${(totalMB / 1024).toFixed(1)} GB` : 
      `${totalMB.toFixed(1)} MB`;
  }

  async processMultipleUrls(urls: string[], options: any): Promise<number[]> {
    const downloadIds: number[] = [];
    
    for (const url of urls) {
      const download = await storage.createDownload({
        url: url.trim(),
        format: options.format,
        quality: options.quality,
        status: "pending",
        progress: 0,
        embedMetadata: options.embedMetadata ?? true,
        organizeFiles: options.organizeFiles ?? false,
      });
      
      downloadIds.push(download.id);
      
      // Start download in background with playlist options
      this.downloadVideoWithOptions(download.id, {
        playlistHandling: options.playlistHandling,
        playlistItems: options.playlistItems,
        maxPlaylistItems: options.maxPlaylistItems,
      }).catch(console.error);
    }
    
    return downloadIds;
  }
}

export const videoDownloader = new VideoDownloader();