/** Parsing of archive imports (X export, CSV, pasted posts). Pure: no database, no providers. */
import { badRequest } from '../../core/errors.ts';
import { sha256 } from '../../domain/text.ts';

export type ImportFormat = 'paste' | 'csv' | 'x_export';

export interface ImportItem {
  external_id: string;
  text: string;
  published_at: string;
  url?: string | null;
  in_reply_to?: string | null;
  is_retweet?: boolean;
}

export interface ImportPiece extends ImportItem {
  parts: string[];
}

type LooseItem = Partial<ImportItem> & { text?: unknown };

export function parseCsv(text: string): LooseItem[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  if (!header) return [];
  const columns = header.map((x) => x.trim().toLowerCase());
  const textIndex = columns.indexOf('text');
  if (textIndex < 0) throw badRequest('CSV needs a "text" column (plus optional published_at, url, external_id).');
  const col = (r: string[], name: string) => (columns.includes(name) ? r[columns.indexOf(name)]?.trim() : undefined);
  return body.map((r) => ({ text: r[textIndex], published_at: col(r, 'published_at'), url: col(r, 'url'), external_id: col(r, 'external_id') }));
}

interface XTweet {
  id_str?: string;
  id?: string | number;
  full_text?: string;
  text?: string;
  created_at?: string;
  in_reply_to_status_id_str?: string | null;
  retweeted_status?: unknown;
}

/** Reads `tweets.js` from the X data export ("window.YTD.tweets.part0 = [...]"). */
export function parseXExport(raw: string): LooseItem[] {
  let entries: unknown;
  try {
    entries = JSON.parse(raw.slice(raw.indexOf('[')));
  } catch (error) {
    throw badRequest('Could not read tweets.js. Upload the file from your X data export unchanged.', { cause: String(error) });
  }
  if (!Array.isArray(entries)) throw badRequest('tweets.js should contain a list of tweets.');
  return entries
    .map((e) => ((e as { tweet?: XTweet }).tweet ?? e) as XTweet)
    .filter((t) => t && (t.id_str || t.id))
    .map((t) => {
      const id = String(t.id_str ?? t.id);
      const text = t.full_text ?? t.text ?? '';
      return {
        external_id: id,
        text,
        published_at: t.created_at ? new Date(t.created_at).toISOString() : undefined,
        url: `https://x.com/i/status/${id}`,
        in_reply_to: t.in_reply_to_status_id_str ?? null,
        is_retweet: Boolean(t.retweeted_status) || /^RT @/.test(text),
      };
    });
}

/** Posts separated by a line with "---", or by blank lines when there is none. */
export function parsePaste(raw: string): LooseItem[] {
  const blocks = /^\s*---\s*$/m.test(raw) ? raw.split(/^\s*---\s*$/m) : raw.split(/\n\s*\n/);
  return blocks.map((b) => b.trim()).filter(Boolean).map((text) => ({ text }));
}

/** Groups self-replies into threads; drops retweets and (by default) replies to other people. */
export function groupThreads(items: ImportItem[], includeReplies = false): { pieces: ImportPiece[]; excluded: number; threadsGrouped: number } {
  const byId = new Map(items.map((i) => [i.external_id, i]));
  const childOf = new Map<string, ImportItem>();
  const roots: ImportItem[] = [];
  let excluded = 0;
  for (const item of items) {
    if (item.is_retweet) excluded++;
    else if (item.in_reply_to && byId.has(item.in_reply_to)) childOf.set(item.in_reply_to, item);
    else if (item.in_reply_to && !includeReplies) excluded++;
    else roots.push(item);
  }
  let threadsGrouped = 0;
  const pieces = roots.map((root) => {
    const parts = [root];
    for (let cur = childOf.get(root.external_id); cur; cur = childOf.get(cur.external_id)) parts.push(cur);
    if (parts.length > 1) threadsGrouped++;
    const texts = parts.map((p) => p.text);
    return { ...root, parts: texts, text: texts.join('\n\n') };
  });
  return { pieces, excluded, threadsGrouped };
}

export interface ParsedImport {
  items: ImportItem[];
  pieces: ImportPiece[];
  excluded: number;
  threadsGrouped: number;
}

const DAY_MS = 86_400_000;

/** Normalises any accepted input into items with ids and dates, then groups threads. */
export function parseImport(input: { format: ImportFormat; raw?: string; items?: LooseItem[]; include_replies: boolean }, now = Date.now()): ParsedImport {
  let loose: LooseItem[];
  if (input.items) loose = input.items;
  else if (input.raw?.trim()) loose = input.format === 'x_export' ? parseXExport(input.raw) : input.format === 'csv' ? parseCsv(input.raw) : parsePaste(input.raw);
  else throw badRequest('Send "items" or "raw" with the archive content.');
  if (!loose.length) throw badRequest('No items found in the import.');

  const items: ImportItem[] = loose
    .filter((i): i is LooseItem & { text: string } => typeof i.text === 'string' && i.text.trim().length > 0)
    .map((i, n) => {
      const text = i.text.trim();
      const published = i.published_at && !Number.isNaN(Date.parse(i.published_at)) ? new Date(i.published_at) : new Date(now - n * DAY_MS);
      return {
        ...i,
        text,
        external_id: i.external_id ? String(i.external_id) : `paste:${sha256(text).slice(0, 16)}`,
        published_at: published.toISOString(),
      };
    });
  return { items, ...groupThreads(items, input.include_replies) };
}
