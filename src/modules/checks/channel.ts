import { X_LIMIT, xLength } from '../../domain/text.ts';
import type { ChannelResult } from '../../domain/types.ts';

/** X's own rules, checked by code: length, mentions, links, markdown, numbering. */
export function checkChannel(posts: string[]): ChannelResult[] {
  return posts.map((text, i) => {
    const issues: string[] = [];
    const length = xLength(text);
    if (!text.trim()) issues.push('Post is empty.');
    if (length > X_LIMIT) issues.push(`Post is ${length} characters; X allows ${X_LIMIT}.`);
    for (const m of text.matchAll(/(^|\s)@(\S*)/g)) if (!/^\w{1,15}[.,!?:;)]*$/.test(m[2])) issues.push(`Broken mention "@${m[2]}".`);
    for (const m of text.matchAll(/https?:\/\/(\S*)/g)) if (!/^[\w-]+(\.[\w-]+)+/.test(m[1])) issues.push(`Broken link "${m[0]}".`);
    if (/\[[^\]]+\]\([^)]+\)/.test(text)) issues.push('Markdown links do not render on X.');
    const numbered = text.match(/^\s*(\d+)\s*\/(\d+)?/);
    if (numbered && Number(numbered[1]) !== i + 1) issues.push(`Numbered ${numbered[1]}/ but is post ${i + 1}.`);
    return { position: i + 1, length, ok: issues.length === 0, issues };
  });
}
