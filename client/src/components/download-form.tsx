import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Music, Video, Download, ChevronDown, ChevronUp, Info,
  Eye, X, AlertCircle, List, Hash, Loader2, Sparkles,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { downloadFormSchema, type DownloadForm, type VideoPreview } from "@shared/schema";

interface DownloadFormProps {
  urlInputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export default function DownloadForm({ urlInputRef }: DownloadFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previews, setPreviews] = useState<VideoPreview[]>([]);
  const [previewErrors, setPreviewErrors] = useState<{ url: string; error: string }[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<DownloadForm>({
    resolver: zodResolver(downloadFormSchema),
    defaultValues: {
      urls: "",
      format: "mp4",
      quality: "1080p",
      embedMetadata: true,
      organizeFiles: false,
      playlistHandling: "auto",
      playlistItems: "",
      maxPlaylistItems: 10,
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (data: DownloadForm) => {
      const response = await apiRequest("POST", "/api/downloads", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Downloads Started", description: data.message });
      form.reset();
      setPreviews([]);
      setPreviewErrors([]);
      queryClient.invalidateQueries({ queryKey: ["/api/downloads"] });
    },
    onError: (error) => {
      toast({ title: "Download Failed", description: error.message, variant: "destructive" });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async ({ url, format, quality }: { url: string; format: string; quality: string }) => {
      const response = await apiRequest("POST", "/api/preview", { url, format, quality });
      return response.json();
    },
  });

  const onSubmit = (data: DownloadForm) => downloadMutation.mutate(data);

  const urlsValue = form.watch("urls");
  const formatValue = form.watch("format");
  const qualityValue = form.watch("quality");

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!urlsValue?.trim()) { setPreviews([]); setPreviewErrors([]); return; }
      const urls = urlsValue.split("\n").map(u => u.trim()).filter(Boolean);
      if (urls.length === 0) { setPreviews([]); setPreviewErrors([]); return; }
      if (urls.length > 3) {
        setPreviews([]);
        setPreviewErrors([{ url: "multiple", error: "Too many URLs for preview (max 3)." }]);
        return;
      }
      setPreviews([]); setPreviewErrors([]);
      const results = await Promise.all(
        urls.map(async (url) => {
          try {
            const data = await previewMutation.mutateAsync({ url, format: formatValue, quality: qualityValue });
            return { success: true, data: data as VideoPreview };
          } catch (e) {
            return { success: false, url, error: e instanceof Error ? e.message : "Failed" };
          }
        })
      );
      setPreviews(results.filter(r => r.success).map(r => r.data!));
      setPreviewErrors(results.filter(r => !r.success).map(r => ({ url: r.url!, error: r.error! })));
    }, 1000);
    return () => clearTimeout(t);
  }, [urlsValue, formatValue, qualityValue]);

  const qualityOptions =
    formatValue === "mp3"
      ? [
          { value: "high", label: "High — 320 kbps MP3" },
          { value: "medium", label: "Medium — 192 kbps MP3" },
          { value: "low", label: "Standard — 128 kbps MP3" },
        ]
      : [
          { value: "4k", label: "4K — 2160p MP4" },
          { value: "1080p", label: "Full HD — 1080p MP4" },
          { value: "720p", label: "HD — 720p MP4" },
          { value: "480p", label: "SD — 480p MP4" },
        ];

  return (
    <div className="glass shimmer-border rounded-2xl overflow-hidden mb-6">
      {/* Header band */}
      <div className="px-6 pt-6 pb-4" style={{ background: "linear-gradient(135deg, rgba(255,210,0,0.12) 0%, rgba(139,69,19,0.08) 100%)" }}>
        <div className="flex items-center gap-3">
          <Sparkles size={20} style={{ color: "#FFD200" }} />
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Harvest Your Media
            </h2>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
              Extract from YouTube, Vimeo, TikTok, Twitter &amp; 1,000+ more
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
                data-testid="button-info-supported-sites"
              >
                <Info size={13} style={{ color: "rgba(255,255,255,0.6)" }} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-80 rounded-xl border p-4 text-sm"
              style={{ background: "rgba(15,15,25,0.98)", backdropFilter: "blur(24px)", borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}
              data-testid="popup-supported-sites"
            >
              <p className="font-semibold mb-3" style={{ fontFamily: "'Space Grotesk',sans-serif", color: "white" }}>Supported Sites</p>
              <div className="space-y-3 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                <div>
                  <p className="font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.85)" }}>Popular</p>
                  <div className="grid grid-cols-2 gap-y-1">
                    {["YouTube","YouTube Music","Vimeo","Dailymotion","Twitch","TikTok","Instagram","Twitter/X","Facebook","Reddit","SoundCloud","Bandcamp"].map(s => (
                      <span key={s} style={{ color: "rgba(255,255,255,0.55)" }}>• {s}</span>
                    ))}
                  </div>
                </div>
                <p style={{ color: "rgba(255,255,255,0.35)" }}>…and 1,000+ more sites supported via yt-dlp</p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="px-6 pb-6 pt-2">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* URL textarea */}
            <FormField
              control={form.control}
              name="urls"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Video URLs
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      ref={(el) => {
                        field.ref(el);
                        if (urlInputRef && 'current' in urlInputRef) {
                          (urlInputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                        }
                      }}
                      rows={4}
                      className="resize-none rounded-xl text-sm"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        color: "rgba(255,255,255,0.9)",
                        caretColor: "#FFD200",
                      }}
                      placeholder={"https://www.youtube.com/watch?v=...\nhttps://vimeo.com/...\nhttps://www.tiktok.com/@user/video/...\nOne URL per line — playlists supported"}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Previews */}
            {(previews.length > 0 || previewErrors.length > 0) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Eye size={13} style={{ color: "#FFD200" }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Preview
                  </span>
                  {previewMutation.isPending && (
                    <Loader2 size={12} className="animate-spin" style={{ color: "rgba(255,255,255,0.4)" }} />
                  )}
                </div>

                {previewErrors.map((e, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.20)" }}>
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0" style={{ color: "#f87171" }} />
                    <p className="text-xs" style={{ color: "#fca5a5" }}>{e.error}</p>
                  </div>
                ))}

                {previews.map((preview, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-xl" style={{ background: "rgba(29,185,84,0.08)", border: "1px solid rgba(29,185,84,0.18)" }}>
                    {preview.thumbnail ? (
                      <img src={preview.thumbnail} alt={preview.title} className="w-20 h-12 object-cover rounded-lg flex-shrink-0" data-testid={`img-preview-thumbnail-${i}`} />
                    ) : (
                      <div className="w-20 h-12 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <Video size={18} style={{ color: "rgba(255,255,255,0.3)" }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white leading-snug line-clamp-1" data-testid={`text-preview-title-${i}`}>{preview.title}</p>
                      <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }} data-testid={`text-preview-channel-${i}`}>{preview.channel}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {preview.duration && <span>{preview.duration}</span>}
                        {preview.fileSize && <span className="font-semibold text-white/50">{preview.fileSize} (est.)</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Format + Quality */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Format
                    </FormLabel>
                    <FormControl>
                      <div className="format-btn-wrap">
                        <button
                          type="button"
                          className={`format-button ${field.value === "mp4" ? "active" : "inactive"}`}
                          onClick={() => { field.onChange("mp4"); form.setValue("quality", "1080p"); }}
                        >
                          <Video size={15} />
                          MP4 Video
                        </button>
                        <button
                          type="button"
                          className={`format-button ${field.value === "mp3" ? "active" : "inactive"}`}
                          onClick={() => { field.onChange("mp3"); form.setValue("quality", "high"); }}
                        >
                          <Music size={15} />
                          MP3 Audio
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Quality
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.85)" }}>
                          <SelectValue placeholder="Select quality" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent style={{ background: "rgba(15,15,25,0.98)", backdropFilter: "blur(24px)", borderColor: "rgba(255,255,255,0.12)" }}>
                        {qualityOptions.map(o => (
                          <SelectItem key={o.value} value={o.value} style={{ color: "rgba(255,255,255,0.8)" }}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Advanced toggle */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} className="pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-medium transition-all duration-200"
                style={{ color: showAdvanced ? "#FFD200" : "rgba(255,255,255,0.4)" }}
              >
                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                Advanced Options
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="embedMetadata"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="mt-0.5"
                              style={{ borderColor: "rgba(255,255,255,0.2)" }}
                            />
                          </FormControl>
                          <FormLabel className="text-sm cursor-pointer" style={{ color: "rgba(255,255,255,0.65)" }}>
                            Embed metadata (artist, title, artwork)
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="organizeFiles"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="mt-0.5"
                              style={{ borderColor: "rgba(255,255,255,0.2)" }}
                            />
                          </FormControl>
                          <FormLabel className="text-sm cursor-pointer" style={{ color: "rgba(255,255,255,0.65)" }}>
                            Organize files by artist / album
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Playlist */}
                  <div className="rounded-xl p-4 space-y-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="flex items-center gap-2">
                      <List size={14} style={{ color: "#FFD200" }} />
                      <span className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif", color: "rgba(255,255,255,0.75)" }}>Playlist Options</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="playlistHandling"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Playlist Handling</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="rounded-lg" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.85)" }}>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent style={{ background: "rgba(15,15,25,0.98)", backdropFilter: "blur(24px)", borderColor: "rgba(255,255,255,0.12)" }}>
                                <SelectItem value="auto">Auto-detect (Recommended)</SelectItem>
                                <SelectItem value="yes">Always as playlist</SelectItem>
                                <SelectItem value="no">Single video only</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="maxPlaylistItems"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Max Items</FormLabel>
                            <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString()}>
                              <FormControl>
                                <SelectTrigger className="rounded-lg" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.85)" }}>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent style={{ background: "rgba(15,15,25,0.98)", backdropFilter: "blur(24px)", borderColor: "rgba(255,255,255,0.12)" }}>
                                <SelectItem value="5">5 items</SelectItem>
                                <SelectItem value="10">10 items</SelectItem>
                                <SelectItem value="20">20 items</SelectItem>
                                <SelectItem value="50">50 items</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="playlistItems"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                            <Hash size={12} />
                            Specific Items (optional)
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="e.g. 1,3,5-10"
                              className="rounded-lg text-sm"
                              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.85)" }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={downloadMutation.isPending}
              className="w-full btn-harvester rounded-xl py-4 flex items-center justify-center gap-2.5 text-base"
            >
              {downloadMutation.isPending ? (
                <><Loader2 size={18} className="animate-spin" /> Starting Downloads…</>
              ) : (
                <><Download size={18} /> Start Downloads</>
              )}
            </button>
          </form>
        </Form>
      </div>
    </div>
  );
}
