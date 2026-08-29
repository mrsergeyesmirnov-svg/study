import type { Bot } from "grammy";
import { env, apiPublicOrigin } from "../env.js";
import { prisma } from "../db.js";

/** Download a Telegram file and store bytes in Postgres (survives Railway redeploys). */
export async function downloadTelegramFile(
  bot: Bot,
  fileId: string,
): Promise<string | null> {
  try {
    const file = await bot.api.getFile(fileId);
    if (!file.file_path) return null;

    const url = `https://api.telegram.org/file/bot${env.BOT_TOKEN}/${file.file_path}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.byteLength) return null;

    const mimeType = guessMime(file.file_path) || "image/jpeg";
    const media = await prisma.mediaObject.create({
      data: {
        mimeType,
        data: buffer,
        size: buffer.byteLength,
      },
    });

    const base = apiPublicOrigin() || env.PUBLIC_URL.replace(/\/$/, "");
    return `${base}/api/media/${media.id}`;
  } catch (e) {
    console.warn("downloadTelegramFile failed:", e);
    return null;
  }
}

export function largestPhotoFileId(
  photos: { file_id: string; width: number; height: number }[],
): string | null {
  if (!photos.length) return null;
  const best = photos.reduce((a, b) =>
    a.width * a.height >= b.width * b.height ? a : b,
  );
  return best.file_id;
}

function guessMime(path: string): string | null {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return null;
}
