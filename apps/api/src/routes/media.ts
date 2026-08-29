import { Hono } from "hono";
import { prisma } from "../db.js";

export const mediaRoutes = new Hono();

mediaRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const media = await prisma.mediaObject.findUnique({ where: { id } });
  if (!media) return c.json({ error: "not_found" }, 404);

  return new Response(media.data, {
    status: 200,
    headers: {
      "Content-Type": media.mimeType,
      "Content-Length": String(media.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
