// Builds the document MiroFish simulates from. MiroFish turns the entities it finds in this text into
// personas, so the audience section names concrete follower groups rather than "the audience".

export const DEFAULT_AUDIENCE = [
  'Peers: other creators and builders in the same niche who reply with their own experience.',
  'Skeptics: followers who push back on claims that sound too neat or lack a source.',
  'Lurkers: people who like and repost but rarely reply.',
  'Newcomers: people seeing the creator for the first time via a repost.',
].join('\n');

const ARCHIVE_SAMPLE = 25;

// Pure: everything it needs comes in as plain data, so it survives app restructures.
export function buildSeed({ posts, archive = [], audience, handle = 'the creator', format = 'post' }) {
  if (!Array.isArray(posts) || !posts.length || posts.some((p) => !String(p).trim())) {
    throw new Error('buildSeed needs at least one non-empty post.');
  }
  const draft = posts.map((p, i) => (posts.length > 1 ? `${i + 1}/${posts.length} ${p}` : p)).join('\n\n');
  const sample = archive
    .filter((a) => a?.text)
    .sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')))
    .slice(0, ARCHIVE_SAMPLE);

  const seedMarkdown = [
    `# ${handle} on X`,
    '',
    `${handle} is a creator who posts on X. The posts below are what ${handle} has published before; they show the voice and topics followers already know.`,
    '',
    '## Audience',
    '',
    (audience || DEFAULT_AUDIENCE).trim(),
    '',
    '## Past posts',
    '',
    ...(sample.length ? sample.map((a) => `- ${a.text.replace(/\s+/g, ' ').trim()}`) : ['- (no archive yet)']),
    '',
    `## New ${format === 'thread' ? 'thread' : 'post'} about to be published`,
    '',
    draft,
    '',
  ].join('\n');

  const requirement = [
    `Simulate how ${handle}'s followers on X react in the hours after ${handle} publishes the new ${format} below.`,
    `The first initial post must be exactly this text, posted by ${handle}:`,
    `"""${draft}"""`,
    'Predict: who replies and what they say, which specific sentences draw agreement or pushback,',
    'whether people repost or quote it and why, and anything that would make the creator regret posting it.',
  ].join('\n');

  return { seedMarkdown, requirement, draft };
}

// Adapter from the Creator OS SQLite schema (0.4 and 0.5 share these columns) to buildSeed's input. This is the only function
// that reads app tables; if the restructure renames tables, only this changes.
export function loadRunInput(db, runId) {
  const run = db.get('SELECT id, format, user_id FROM runs WHERE id = ?', runId);
  if (!run) return null;
  const draft = db.get('SELECT id FROM drafts WHERE run_id = ?', runId);
  if (!draft) return { run, draft: null, decided: false, posts: [], sentences: [], archive: [] };
  const decision = db.get('SELECT decision, final_posts FROM decisions WHERE draft_id = ? ORDER BY decided_at DESC LIMIT 1', draft.id);
  // 0.5's client returns JSON columns as text; 0.4's wrapper decoded them.
  if (typeof decision?.final_posts === 'string') decision.final_posts = JSON.parse(decision.final_posts);
  const rows = db.all('SELECT id, post_position, text FROM draft_sentences WHERE draft_id = ? ORDER BY post_position, position', draft.id);
  const grouped = [];
  for (const r of rows) (grouped[r.post_position - 1] ||= []).push(r.text);
  const generated = grouped.filter(Boolean).map((s) => s.join(' '));
  let posts = generated;
  let sentences = rows.map((r) => ({ id: r.id, text: r.text }));
  if (decision?.final_posts?.length && decision.final_posts.join('\n\n') !== generated.join('\n\n')) {
    // Edited before accepting: rehearse the final text; sentence ids no longer line up.
    posts = decision.final_posts;
    sentences = posts.flatMap((p) => p.split(/(?<=[.!?])\s+/)).filter(Boolean).map((text) => ({ id: null, text }));
  }
  // only the run owner's own archive: followers are modelled on what this creator has posted
  const archive = db.all('SELECT text, published_at FROM archive_pieces WHERE user_id = ? AND retired = 0 AND is_holdout = 0 ORDER BY published_at DESC LIMIT ?', run.user_id, ARCHIVE_SAMPLE);
  return { run, draft, decided: Boolean(decision), decision: decision?.decision ?? null, posts, sentences, archive, format: run.format };
}
