// Turns raw MiroFish output (OASIS twitter posts + agent actions + report) into what the review screen
// needs. Pure functions; no I/O.

const STOP = new Set('a an the and or but if then so of to in on at for with by from as is are was were be been it its this that these those i you we they he she my your our their me us them not no do does did have has had just very really can will would should could about into than too also more most'.split(' '));

export function words(text) {
  return String(text || '').toLowerCase().match(/[\p{L}\p{N}']+/gu)?.filter((w) => w.length > 2 && !STOP.has(w)) ?? [];
}

function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / (A.size + B.size - n);
}

// Lexical cue only; the UI labels it as such. The report is where nuance lives.
const PUSHBACK = /\b(disagree|wrong|not true|source\??|citation|evidence|doubt|overstat\w*|misleading|actually|nope|hard to believe|cherry.?pick\w*|oversimplif\w*|depends)\b|\?\s*$/i;
export const stanceOf = (text) => (PUSHBACK.test(String(text)) ? 'pushback' : 'other');

const postText = (p) => [p.content, p.quote_content].filter(Boolean).join(' ');
const MATCH = 0.5;

// Finds the simulated post that is the creator's draft. MiroFish's config LLM writes the initial posts,
// so the draft is not guaranteed to appear verbatim; callers must surface draft_seeded=false.
export function findDraftPost(posts, draft) {
  const target = words(draft);
  let best = null, bestScore = 0;
  for (const p of posts) {
    if (p.original_post_id) continue;
    const s = jaccard(words(p.content), target);
    if (s > bestScore) { best = p; bestScore = s; }
  }
  return bestScore >= MATCH ? { post: best, similarity: bestScore } : { post: null, similarity: bestScore };
}

export function summarize({ draft, sentences, posts = [], actions = [], report = null, runStatus = null }) {
  const { post: draftPost, similarity } = findDraftPost(posts, draft);
  const id = draftPost?.post_id;
  const onDraft = (a) => id != null && Number(a.action_args?.post_id ?? a.action_args?.original_post_id) === Number(id);

  const counts = { likes: 0, reposts: 0, quotes: 0, replies: 0, dislikes: 0 };
  const replies = [];
  for (const a of actions) {
    if (!onDraft(a)) continue;
    if (a.action_type === 'LIKE_POST') counts.likes++;
    else if (a.action_type === 'DISLIKE_POST') counts.dislikes++;
    else if (a.action_type === 'REPOST') counts.reposts++;
    else if (a.action_type === 'QUOTE_POST' || a.action_type === 'REPLY') {
      counts[a.action_type === 'REPLY' ? 'replies' : 'quotes']++;
      const text = a.action_args?.quote_content || a.action_args?.content || '';
      if (text) replies.push({ agent_id: a.agent_id, agent_name: a.agent_name || `agent ${a.agent_id}`, round: a.round_num, kind: a.action_type === 'REPLY' ? 'reply' : 'quote', text, stance: stanceOf(text) });
    }
  }
  // Fall back to post-table quotes when actions were truncated by the API limit.
  if (!replies.length && id != null) {
    for (const p of posts) {
      if (Number(p.original_post_id) !== Number(id) || !p.quote_content) continue;
      replies.push({ agent_id: p.user_id, agent_name: `agent ${p.user_id}`, round: null, text: p.quote_content, stance: stanceOf(p.quote_content) });
    }
  }
  if (draftPost) {
    counts.likes = Math.max(counts.likes, draftPost.num_likes ?? 0);
    counts.reposts = Math.max(counts.reposts, draftPost.num_shares ?? 0);
    counts.dislikes = Math.max(counts.dislikes, draftPost.num_dislikes ?? 0);
  }

  // Conversation the draft sparked elsewhere in the feed (original posts by others, on-topic).
  const draftWords = words(draft);
  const related = posts
    .filter((p) => p !== draftPost && !p.original_post_id && jaccard(words(p.content), draftWords) >= 0.12)
    .map((p) => ({ agent_id: p.user_id, text: p.content, stance: stanceOf(p.content) }))
    .slice(0, 20);

  // Which draft sentences the reactions are about: content-word overlap, best match wins.
  const reactions = [...replies, ...related];
  const perSentence = (sentences?.length ? sentences : [{ id: null, text: draft }]).map((s) => ({ id: s.id ?? null, text: s.text, mentions: 0, pushback: 0, examples: [] }));
  for (const r of reactions) {
    const rw = words(r.text);
    let best = null, bestScore = 0;
    for (const s of perSentence) {
      const sc = jaccard(rw, words(s.text));
      if (sc > bestScore) { best = s; bestScore = sc; }
    }
    if (!best || bestScore < 0.08) continue;
    best.mentions++;
    if (r.stance === 'pushback') best.pushback++;
    if (best.examples.length < 3) best.examples.push(r.text);
  }

  const agents = new Set(actions.map((a) => a.agent_id)).size;
  return {
    draft_seeded: Boolean(draftPost),
    draft_match: Number(similarity.toFixed(2)),
    agents,
    rounds: runStatus?.current_round ?? null,
    total_actions: actions.length,
    counts,
    replies,
    related,
    sentences: perSentence,
    pushback_share: reactions.length ? Number((reactions.filter((r) => r.stance === 'pushback').length / reactions.length).toFixed(2)) : 0,
    report: report ? { id: report.report_id, markdown: report.markdown_content || '', outline: report.outline ?? null } : null,
  };
}
