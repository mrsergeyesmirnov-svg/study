import { Hono } from "hono";
import { prisma } from "../db.js";
import { env, isAdmin, apiPublicOrigin } from "../env.js";
import { parseInitDataUser } from "../telegram/validate.js";

export const uploadRoutes = new Hono();

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

function requestOrigin(c: {
  req: { url: string; header: (n: string) => string | undefined };
}): string {
  const configured = apiPublicOrigin();
  if (configured) return configured;

  const xfProto = c.req.header("x-forwarded-proto");
  const xfHost = c.req.header("x-forwarded-host") ?? c.req.header("host");
  if (xfHost) {
    const proto = xfProto?.split(",")[0]?.trim() || "https";
    return `${proto}://${xfHost.split(",")[0].trim()}`;
  }

  return new URL(c.req.url).origin;
}

uploadRoutes.post("/", async (c) => {
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const user = parseInitDataUser(initData);
  if (!user || !isAdmin(user.id)) return c.json({ error: "forbidden" }, 403);

  const body = await c.req.parseBody();
  const file = body.file;
  if (!file || typeof file === "string") {
    return c.json({ error: "no_file" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength === 0) return c.json({ error: "empty_file" }, 400);
  if (buffer.byteLength > MAX_BYTES) {
    return c.json({ error: "file_too_large", maxBytes: MAX_BYTES }, 400);
  }

  const mimeType =
    (file.type && file.type.startsWith("image/") ? file.type : null) ||
    guessMime(file.name) ||
    "image/jpeg";

  const media = await prisma.mediaObject.create({
    data: {
      mimeType,
      data: buffer,
      size: buffer.byteLength,
    },
  });

  const base = requestOrigin(c);
  const url = `${base}/api/media/${media.id}`;
  return c.json({ url, id: media.id, size: media.size });
});

function guessMime(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return null;
}
