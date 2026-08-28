export function parseBarcodeFromText(text: string): string | null {
  const match = text.match(/VTG-\d+/i) || text.match(/\/i\/(VTG-\d+)/i);
  if (!match) return null;
  return (match[1] ?? match[0]).toUpperCase();
}
