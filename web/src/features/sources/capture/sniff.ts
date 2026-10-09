/** A client-side peek at a transcript, so a row can show who is speaking before anything is sent. */
const LINE = /^\s*([\p{L}][\p{L}\d .'-]{0,40}?)\s*(?:\[(\d{1,2}:\d{2}(?::\d{2})?)\])?\s*:\s+(.+)$/u;

export interface Sniff {
  speakers: { name: string; lines: number }[];
  preview: string[];
  words: number;
}

export function sniffTranscript(text: string): Sniff {
  const counts = new Map<string, number>();
  const rows = text.split(/\r?\n/).filter((line) => line.trim());
  for (const row of rows) {
    const match = row.match(LINE);
    const name = match?.[1].trim();
    if (name && name.split(' ').length <= 4) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const speakers = [...counts].map(([name, lines]) => ({ name, lines })).sort((a, b) => b.lines - a.lines);
  return {
    // one "Name:" pattern is probably prose, not a conversation
    speakers: speakers.length >= 2 ? speakers : [],
    preview: rows.slice(0, 3),
    words: text.split(/\s+/).filter(Boolean).length,
  };
}
