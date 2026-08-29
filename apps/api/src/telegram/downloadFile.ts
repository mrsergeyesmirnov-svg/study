import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Bot } from "grammy";
import { env } from "../env.js";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

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

    await mkdir(UPLOAD_DIR, { recursive: true });
    const ext = path.extname(file.file_path) || ".jpg";
    const filename = `${randomUUID()}${ext}`;
    const buffer = Buffer.from(await res.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, filename), buffer);

    const base = (env.API_PUBLIC_URL || env.PUBLIC_URL).replace(/\/$/, "");
    // Prefer API host for uploads when set; else PUBLIC_URL may be web — still works if proxied.
    const uploadHost = env.API_PUBLIC_URL
      ? env.API_PUBLIC_URL.replace(/\/$/, "")
      : base;
    return `${uploadHost}/uploads/${filename}`;
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
