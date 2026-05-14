import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const downloads = sqliteTable("downloads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull(),
  title: text("title").notNull(),
  channel: text("channel").notNull(),
  thumbnail: text("thumbnail"),
  format: text("format").notNull(), // "mp3" or "mp4"
  quality: text("quality").notNull(),
  duration: text("duration"),
  fileSize: text("file_size"),
  status: text("status").notNull().default("pending"), // "pending", "downloading", "completed", "error"
  progress: integer("progress").default(0),
  progressStage: text("progress_stage").default("Initializing"),
  error: text("error"),
  errorMessage: text("error_message"),
  filePath: text("file_path"),
  shareToken: text("share_token"),
  embedMetadata: integer("embed_metadata", { mode: 'boolean' }).default(true),
  organizeFiles: integer("organize_files", { mode: 'boolean' }).default(false),
  createdAt: integer("created_at", { mode: 'timestamp' }),
});

export const insertDownloadSchema = createInsertSchema(downloads).pick({
  url: true,
  format: true,
  quality: true,
  status: true,
  progress: true,
  embedMetadata: true,
  organizeFiles: true,
}).transform((data) => ({
  ...data,
  embedMetadata: data.embedMetadata ?? true,
  organizeFiles: data.organizeFiles ?? false,
}));

export const downloadFormSchema = z.object({
  urls: z.string().min(1, "Please enter at least one YouTube URL"),
  format: z.enum(["mp3", "mp4"]),
  quality: z.string(),
  embedMetadata: z.boolean().default(true),
  organizeFiles: z.boolean().default(false),
  // Playlist options
  playlistHandling: z.enum(["auto", "yes", "no"]).default("auto"),
  playlistItems: z.string().optional(),
  maxPlaylistItems: z.number().min(1).max(50).default(10),
});

export type InsertDownload = z.infer<typeof insertDownloadSchema>;
export type Download = typeof downloads.$inferSelect;
export type DownloadForm = z.infer<typeof downloadFormSchema>;

export const stats = sqliteTable("stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  totalDownloads: integer("total_downloads").default(0),
  totalSize: text("total_size").default("0 MB"),
  avgProcessTime: text("avg_process_time").default("0s"),
  averageFileSize: text("average_file_size").default("0 MB"),
});

export type Stats = typeof stats.$inferSelect;

// Preview schema for URL validation
export const previewSchema = z.object({
  url: z.string().min(1, "Please enter a valid URL"),
  format: z.string().optional(),
  quality: z.string().optional(),
});

export const videoPreviewSchema = z.object({
  title: z.string(),
  channel: z.string(),
  thumbnail: z.string(),
  duration: z.string(),
  url: z.string(),
  fileSize: z.string().optional(),
});

export type PreviewForm = z.infer<typeof previewSchema>;
export type VideoPreview = z.infer<typeof videoPreviewSchema>;

export const channelSearchSchema = z.object({
  channelInput: z.string().optional(),
  channelId: z.string().optional(),
  query: z.string().default(""),
  duration: z.enum(["any", "short", "medium", "long"]).default("any"),
  sort: z.enum(["relevance", "date", "viewCount", "rating"]).default("relevance"),
  pageToken: z.string().optional(),
  site: z.string().default("youtube"),
});

export type ChannelSearch = z.infer<typeof channelSearchSchema>;

export const channelResultSchema = z.object({
  channelId: z.string(),
  name: z.string(),
  thumbnail: z.string(),
  description: z.string().optional(),
});

export type ChannelResult = z.infer<typeof channelResultSchema>;

export const videoResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  channel: z.string(),
  channelId: z.string(),
  thumbnail: z.string(),
  duration: z.string(),
  durationSeconds: z.number(),
  views: z.string(),
  publishedAt: z.string(),
  url: z.string(),
});

export type VideoResult = z.infer<typeof videoResultSchema>;

export const searchResultsSchema = z.object({
  videos: z.array(videoResultSchema),
  nextPageToken: z.string().optional(),
  prevPageToken: z.string().optional(),
  totalResults: z.number(),
});

export type SearchResults = z.infer<typeof searchResultsSchema>;

export const userSettings = sqliteTable("user_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  theme: text("theme").notNull().default("dark"), // "light", "dark", "system"
  animations: integer("animations", { mode: 'boolean' }).default(true),
  accentColor: text("accent_color").default("#FFD200"),
  glassIntensity: integer("glass_intensity").default(40),
  pinHash: text("pin_hash"),
  biometricId: text("biometric_id"),
  securityEnabled: integer("security_enabled", { mode: 'boolean' }).default(false),
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).pick({
  theme: true,
  animations: true,
  accentColor: true,
  glassIntensity: true,
  securityEnabled: true,
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
