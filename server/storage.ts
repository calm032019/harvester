import { downloads, stats, userSettings, type Download, type InsertDownload, type Stats, type UserSettings, type InsertUserSettings } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getDownload(id: number): Promise<Download | undefined>;
  getAllDownloads(): Promise<Download[]>;
  createDownload(download: InsertDownload): Promise<Download>;
  updateDownload(id: number, updates: Partial<Download>): Promise<Download | undefined>;
  deleteDownload(id: number): Promise<boolean>;
  getStats(): Promise<Stats>;
  updateStats(updates: Partial<Stats>): Promise<Stats>;
  getDownloadByShareToken(token: string): Promise<Download | undefined>;
  getFailureAnalytics(): Promise<{ error: string, count: number }[]>;
  getSettings(): Promise<UserSettings>;
  updateSettings(updates: Partial<UserSettings>): Promise<UserSettings>;
}

export class DatabaseStorage implements IStorage {
  async getDownload(id: number): Promise<Download | undefined> {
    const [download] = await db.select().from(downloads).where(eq(downloads.id, id));
    return download;
  }

  async getAllDownloads(): Promise<Download[]> {
    return db.select().from(downloads).orderBy(desc(downloads.createdAt));
  }

  async createDownload(insertDownload: InsertDownload): Promise<Download> {
    const [download] = await db.insert(downloads).values({
      url: insertDownload.url,
      title: "",
      channel: "",
      thumbnail: null,
      format: insertDownload.format,
      quality: insertDownload.quality,
      duration: null,
      fileSize: null,
      status: insertDownload.status || "pending",
      progress: insertDownload.progress || 0,
      progressStage: "Initializing",
      error: null,
      errorMessage: null,
      filePath: null,
      embedMetadata: insertDownload.embedMetadata ?? true,
      organizeFiles: insertDownload.organizeFiles ?? false,
    }).returning();
    return download;
  }

  async updateDownload(id: number, updates: Partial<Download>): Promise<Download | undefined> {
    const [updated] = await db
      .update(downloads)
      .set(updates)
      .where(eq(downloads.id, id))
      .returning();
    return updated;
  }

  async deleteDownload(id: number): Promise<boolean> {
    const [deleted] = await db
      .delete(downloads)
      .where(eq(downloads.id, id))
      .returning();
    return !!deleted;
  }

  async getStats(): Promise<Stats> {
    const [stat] = await db.select().from(stats).where(eq(stats.id, 1));
    if (!stat) {
      const [newStat] = await db.insert(stats).values({
        totalDownloads: 0,
        totalSize: "0 MB",
        avgProcessTime: "0s",
        averageFileSize: "0 MB",
      }).returning();
      return newStat;
    }
    return stat;
  }

  async updateStats(updates: Partial<Stats>): Promise<Stats> {
    const [updated] = await db
      .update(stats)
      .set(updates)
      .where(eq(stats.id, 1))
      .returning();
    
    if (!updated) {
      // Create if it doesn't exist
      const [newStat] = await db.insert(stats).values({
        totalDownloads: updates.totalDownloads || 0,
        totalSize: updates.totalSize || "0 MB",
        avgProcessTime: updates.avgProcessTime || "0s",
        averageFileSize: updates.averageFileSize || "0 MB",
        ...updates
      }).returning();
      return newStat;
    }
    
    return updated;
  }

  async getDownloadByShareToken(token: string): Promise<Download | undefined> {
    const [download] = await db.select().from(downloads).where(eq(downloads.shareToken, token));
    return download;
  }

  async getFailureAnalytics(): Promise<{ error: string, count: number }[]> {
    const all = await this.getAllDownloads();
    const errors = all.filter(d => d.status === "error" && (d.error || d.errorMessage));
    const counts: Record<string, number> = {};
    errors.forEach(e => {
      const type = (e.errorMessage || e.error || "Unknown");
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).map(([error, count]) => ({ error, count }));
  }

  async getSettings(): Promise<UserSettings> {
    let [settings] = await db.select().from(userSettings).where(eq(userSettings.id, 1));
    if (!settings) {
      [settings] = await db.insert(userSettings).values({
        theme: "dark",
        animations: true,
        accentColor: "#FFD200",
        glassIntensity: 40,
        securityEnabled: false,
      }).returning();
    }
    return settings;
  }

  async updateSettings(updates: Partial<UserSettings>): Promise<UserSettings> {
    const [updated] = await db.update(userSettings)
      .set(updates)
      .where(eq(userSettings.id, 1))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
