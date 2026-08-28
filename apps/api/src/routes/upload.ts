import { Hono } from "hono";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isAdmin } from "../env.js";
import { parseInitDataUser } from "../telegram/validate.js";

export const uploadRoutes = new Hono();

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

uploadRoutes.post("/", async (c) => {
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const user = parseInitDataUser(initData);
  if (!user || !isAdmin(user.id)) return c.json({ error: "forbidden" }, 403);

  const body = await c.req.parseBody();
  const file = body.file;
  if (!file || typeof file === "string") {
    return c.json({ error: "no_file" }, 400);
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name) || ".jpg";
  const filename = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  const base = c.req.url.replace(/\/api\/upload.*$/, "");
  return c.json({ url: `${base}/uploads/${filename}` });
});
