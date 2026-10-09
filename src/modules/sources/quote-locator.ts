/** Finds a model-supplied quote inside a segment. Model offsets are never trusted; only text matches count. */
export function locateQuote(segmentText: string, quote: string): { start: number; end: number } | null {
  const exact = segmentText.indexOf(quote);
  if (exact !== -1) return { start: exact, end: exact + quote.length };
  const words = quote.trim().split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return null;
  const match = new RegExp(words.join('\\s+')).exec(segmentText);
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}
