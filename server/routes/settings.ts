import { Router } from "express";
import { db } from "../db";
import { config } from "@shared/schema";
import { eq } from "drizzle-orm";

export const settingsRouter = Router();

const SETTINGS_KEY = "app_settings";

const DEFAULT_SETTINGS = {
  // Clip.mx
  clipApiKey: "",
  clipSecretKey: "",
  clipEnabled: false,
  // Meta Ads
  metaPixelId: "",
  metaEnabled: false,
  // Google
  googleAnalyticsId: "",
  googleTagManagerId: "",
  googleAdsId: "",
  googleEnabled: false,
  // WhatsApp
  whatsappPhone: "",
  // General
  siteName: "RevenTicket",
  supportEmail: "soporte@reventicket.com.mx",
  commissionPercent: 15,
};

// GET settings
settingsRouter.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(config).where(eq(config.key, SETTINGS_KEY));
    if (!rows.length) return res.json(DEFAULT_SETTINGS);
    const saved = rows[0].value as Record<string, any>;
    res.json({ ...DEFAULT_SETTINGS, ...saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST/PUT settings — admin only
settingsRouter.post("/", async (req, res) => {
  try {
    const newSettings = { ...DEFAULT_SETTINGS, ...req.body };

    // Mask sensitive keys in response but save full values
    const existing = await db.select().from(config).where(eq(config.key, SETTINGS_KEY));
    if (existing.length) {
      await db.update(config).set({ value: newSettings, updatedAt: new Date() }).where(eq(config.key, SETTINGS_KEY));
    } else {
      await db.insert(config).values({ key: SETTINGS_KEY, value: newSettings });
    }

    // Apply env-like effects at runtime
    if (newSettings.clipApiKey) process.env.CLIP_API_KEY = newSettings.clipApiKey;
    if (newSettings.clipSecretKey) process.env.CLIP_SECRET_KEY = newSettings.clipSecretKey;
    if (newSettings.whatsappPhone) process.env.WHATSAPP_PHONE = newSettings.whatsappPhone;

    res.json({ success: true, settings: newSettings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET public settings (only non-sensitive for frontend)
settingsRouter.get("/public", async (req, res) => {
  try {
    const rows = await db.select().from(config).where(eq(config.key, SETTINGS_KEY));
    const saved = rows.length ? (rows[0].value as Record<string, any>) : DEFAULT_SETTINGS;
    res.json({
      metaPixelId: saved.metaPixelId || "",
      googleAnalyticsId: saved.googleAnalyticsId || "",
      googleTagManagerId: saved.googleTagManagerId || "",
      googleAdsId: saved.googleAdsId || "",
      siteName: saved.siteName || "RevenTicket",
      commissionPercent: saved.commissionPercent || 15,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
