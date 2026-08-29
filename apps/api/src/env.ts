import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  PUBLIC_URL: z.string().url().default("http://localhost:5173"),
  WEBAPP_URL: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  ADMIN_TELEGRAM_IDS: z.string().default(""),
  CHANNEL_MAIN_ID: z.string().optional(),
  CHANNEL_STOCK_ID: z.string().optional(),
  /** Channel to watch for manual posts → inbox drafts. Defaults to CHANNEL_MAIN_ID. */
  CHANNEL_IMPORT_ID: z.string().optional(),
  PAYMENT_CARD_INFO: z.string().default("Свяжитесь с @vtgceo для оплаты"),
  API_PUBLIC_URL: z.string().url().optional(),
  /** Railway injects this for public HTTP services (without scheme). */
  RAILWAY_PUBLIC_DOMAIN: z.string().optional(),
  PORT: z.coerce.number().default(3001),
});

export const env = envSchema.parse(process.env);

/** Public origin of the API (for media URLs). Never use WEBAPP_URL here. */
export function apiPublicOrigin(): string | null {
  if (env.API_PUBLIC_URL) return env.API_PUBLIC_URL.replace(/\/$/, "");
  if (env.RAILWAY_PUBLIC_DOMAIN) {
    const host = env.RAILWAY_PUBLIC_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }
  return null;
}

export function mediaUrl(id: string): string {
  const base = apiPublicOrigin();
  if (!base) {
    throw new Error("API_PUBLIC_URL (or RAILWAY_PUBLIC_DOMAIN) required for media URLs");
  }
  return `${base}/api/media/${id}`;
}

export function getAdminIds(): Set<string> {
  return new Set(
    env.ADMIN_TELEGRAM_IDS.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isAdmin(telegramUserId: string | number): boolean {
  return getAdminIds().has(String(telegramUserId));
}

export function publicItemUrl(code: string): string {
  return `${env.PUBLIC_URL.replace(/\/$/, "")}/i/${code}`;
}
