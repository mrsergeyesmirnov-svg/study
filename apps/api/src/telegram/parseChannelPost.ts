export type ParsedChannelPost = {
  title: string;
  priceRub: number;
  size?: string;
  conditionText?: string;
  measurements?: string;
  brand?: string;
  story?: string;
};

/**
 * Accepts channel post captions that look like a product card.
 *
 * Supported shapes (examples):
 *
 *   Футболка Oakley 00s
 *
 *   > состояние отличное
 *   > размер L
 *   > цена: 6990
 *
 *   Куртка Nike
 *   цена 4500
 *   замеры: плечи 48, длина 72
 *
 *   Название вещи
 *   8990
 *   грудь 56 / длина 68
 */
export function parseChannelPost(raw: string): ParsedChannelPost | null {
  const text = stripHtml(raw).replace(/\r/g, "").trim();
  if (!text) return null;

  // Skip our own auto-posts (already have order link / VTG code).
  if (/\/i\/VTG-\d+/i.test(text) || /VTG-\d{4,}/i.test(text)) {
    return null;
  }
  // Skip sold markers.
  if (/^❌?\s*ПРОДАНО/i.test(text)) {
    return null;
  }

  const lines = text
    .split("\n")
    .map((l) => l.replace(/^>\s*/, "").trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return null;

  const price = extractPrice(text, lines);
  if (price == null) return null;

  const title = extractTitle(lines);
  if (!title || title.length < 2) return null;

  const size = extractLabeled(lines, /^(размер|size)\s*[:\-]?\s*(.+)$/i);
  const conditionText = extractLabeled(
    lines,
    /^(состояние|condition)\s*[:\-]?\s*(.+)$/i,
  );
  const measurements =
    extractLabeled(lines, /^(замеры?|measurements?)\s*[:\-]?\s*(.+)$/i) ??
    extractMeasurementsLoose(lines, price);
  const brand = extractLabeled(lines, /^(бренд|brand)\s*[:\-]?\s*(.+)$/i);

  const skip = new Set(
    [
      title.toLowerCase(),
      size?.toLowerCase(),
      conditionText?.toLowerCase(),
      measurements?.toLowerCase(),
      brand?.toLowerCase(),
    ].filter(Boolean) as string[],
  );

  const storyLines = lines.filter((l) => {
    const lower = l.toLowerCase();
    if (skip.has(lower)) return false;
    if (/^(цена|price)\b/i.test(l)) return false;
    if (/^\d{3,6}\s*(₽|руб\.?)?$/i.test(l)) return false;
    if (/^(размер|состояние|замеры?|бренд|size|condition|brand)\b/i.test(l)) return false;
    if (/оформить заказ|полное наличие/i.test(l)) return false;
    return true;
  });

  return {
    title,
    priceRub: price,
    size: size || undefined,
    conditionText: conditionText || undefined,
    measurements: measurements || undefined,
    brand: brand || undefined,
    story: storyLines.length ? storyLines.join("\n") : undefined,
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function extractPrice(text: string, lines: string[]): number | null {
  const labeled = text.match(/(?:цена|price)\s*[:\-]?\s*(\d[\d\s]{2,})/i);
  if (labeled) {
    const n = parseInt(labeled[1].replace(/\s/g, ""), 10);
    if (n >= 100 && n <= 10_000_000) return n;
  }

  for (const line of lines) {
    const m = line.match(/^(\d{3,7})\s*(₽|руб\.?)?$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 100 && n <= 10_000_000) return n;
    }
  }
  return null;
}

function extractTitle(lines: string[]): string | null {
  for (const line of lines) {
    if (/^(цена|price|размер|состояние|замеры?|бренд)\b/i.test(line)) continue;
    if (/^\d{3,7}\s*(₽|руб\.?)?$/i.test(line)) continue;
    if (/оформить заказ|полное наличие/i.test(line)) continue;
    return line.replace(/\*+/g, "").trim();
  }
  return null;
}

function extractLabeled(lines: string[], re: RegExp): string | undefined {
  for (const line of lines) {
    const m = line.match(re);
    if (m?.[2]) return m[2].trim();
  }
  return undefined;
}

/** Third-line-style: title, price, then free-form measurements. */
function extractMeasurementsLoose(lines: string[], price: number): string | undefined {
  const priceIdx = lines.findIndex(
    (l) =>
      new RegExp(`(?:цена|price).*${price}`, "i").test(l) ||
      new RegExp(`^${price}\\s*(₽|руб\\.?)?$`, "i").test(l),
  );
  if (priceIdx < 0 || priceIdx >= lines.length - 1) return undefined;
  const next = lines[priceIdx + 1];
  if (/^(размер|состояние|бренд|оформить)/i.test(next)) return undefined;
  if (/замер|грудь|плеч|длин|талия|рукав|обхват/i.test(next)) return next;
  // Simple 3-line form: title / price / measurements
  if (lines.length <= 4 && priceIdx === 1) return next;
  return undefined;
}
