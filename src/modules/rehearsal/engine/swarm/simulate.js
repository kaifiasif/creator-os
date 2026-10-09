// A small X-like feed simulation, written for Creator OS. The creator (agent 0) posts the draft verbatim
// in round 0; each later round, a random subset of personas scrolls a ranked feed and acts. With a model,
// all active personas in a round are decided in ONE call (about rounds + 2 calls per rehearsal, which
// fits free tiers). Offline, a rule policy stands in and the result is labelled as an estimate.
//
// Output uses the same post/action shapes as the MiroFish client so summarize() works for both.
import { words } from '../summarize.js';

const MAX_ACTIVE = 8;
const FEED_SIZE = 4;
const TEXT_MAX = 280;
const ACTION_TYPES = { like: 'LIKE_POST', repost: 'REPOST', reply: 'REPLY', quote: 'QUOTE_POST', post: 'CREATE_POST', nothing: 'DO_NOTHING' };

export function rngFrom(seedText) {
  let h = 2166136261;
  for (const c of String(seedText)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let s = h >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function overlap(a, b) {
  const B = new Set(b);
  return a.filter((w) => B.has(w)).length;
}

export function createWorld({ handle, draft, personas }) {
  const creator = { id: 0, name: handle, segment: 'creator', bio: `The creator. Posted the draft.`, stance: 'supportive', activity: 0, follows_creator: true };
  return {
    agents: [creator, ...personas],
    posts: [],
    actions: [],
    memory: new Map(), // agent id -> short log of own actions
    acted: new Set(), // `${agent}:${type}:${post}`
    round: 0,
    draft,
  };
}

function addPost(world, { user_id, content, original_post_id = null, kind = 'post' }) {
  const post = { post_id: world.posts.length + 1, user_id, original_post_id, kind, content, quote_content: null, round: world.round, num_likes: 0, num_shares: 0, num_dislikes: 0, num_replies: 0, num_quotes: 0 };
  if (kind === 'quote') { post.quote_content = content; post.content = ''; }
  world.posts.push(post);
  return post;
}

function record(world, agent, type, args, note) {
  world.actions.push({ round_num: world.round, agent_id: agent.id, agent_name: agent.name, action_type: type, action_args: args, success: true });
  const log = world.memory.get(agent.id) || [];
  log.push(`round ${world.round}: ${note}`);
  world.memory.set(agent.id, log.slice(-4));
}

export function seedDraft(world) {
  const p = addPost(world, { user_id: 0, content: world.draft });
  record(world, world.agents[0], 'CREATE_POST', { post_id: p.post_id, content: p.content }, 'posted the draft');
  return p;
}

// Followers see the creator; everyone else only sees the draft once it has been reposted or argued about.
export function feedFor(world, agent) {
  const interests = words([agent.bio, ...(agent.interests || [])].join(' '));
  return world.posts
    .filter((p) => p.user_id !== agent.id)
    .filter((p) => p.user_id !== 0 || agent.follows_creator || p.num_shares + p.num_quotes > 0 || p.num_replies > 1)
    .map((p) => {
      const engagement = Math.log1p(p.num_likes + 2 * (p.num_shares + p.num_quotes) + 1.5 * p.num_replies);
      const fresh = -0.35 * (world.round - p.round);
      const fromCreator = p.user_id === 0 && agent.follows_creator ? 1.5 : 0;
      return { p, score: engagement + fresh + fromCreator + 0.3 * overlap(words(p.content || p.quote_content), interests) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, FEED_SIZE)
    .map((x) => x.p);
}

export function apply(world, agent, decision, visible) {
  const action = String(decision.action || '').toLowerCase();
  const type = ACTION_TYPES[action];
  if (!type || type === 'DO_NOTHING') return false;
  const target = decision.post_id == null ? null : visible.find((p) => p.post_id === Number(decision.post_id));
  const text = String(decision.text || '').replace(/\s+/g, ' ').trim().slice(0, TEXT_MAX);
  if (type !== 'CREATE_POST' && !target) return false;
  if (['REPLY', 'QUOTE_POST', 'CREATE_POST'].includes(type) && !text) return false;
  const key = `${agent.id}:${type}:${target?.post_id ?? text}`;
  if (world.acted.has(key)) return false;
  world.acted.add(key);

  if (type === 'LIKE_POST') { target.num_likes++; record(world, agent, type, { post_id: target.post_id }, `liked post ${target.post_id}`); }
  else if (type === 'REPOST') { target.num_shares++; record(world, agent, type, { post_id: target.post_id }, `reposted post ${target.post_id}`); }
  else if (type === 'REPLY' || type === 'QUOTE_POST') {
    const p = addPost(world, { user_id: agent.id, content: text, original_post_id: target.post_id, kind: type === 'REPLY' ? 'reply' : 'quote' });
    if (type === 'REPLY') target.num_replies++; else target.num_quotes++;
    const args = type === 'REPLY' ? { post_id: target.post_id, content: text, new_post_id: p.post_id } : { post_id: target.post_id, quote_content: text, new_post_id: p.post_id };
    record(world, agent, type, args, `${type === 'REPLY' ? 'replied to' : 'quoted'} post ${target.post_id}: "${text.slice(0, 80)}"`);
  } else {
    const p = addPost(world, { user_id: agent.id, content: text });
    record(world, agent, type, { post_id: p.post_id, content: text }, `posted: "${text.slice(0, 80)}"`);
  }
  return true;
}

const author = (world, p) => (p.user_id === 0 ? `@${world.agents[0].name}` : world.agents[p.user_id]?.name || `user ${p.user_id}`);
const show = (world, p) => `[post ${p.post_id}] ${author(world, p)}${p.original_post_id ? ` (${p.kind} to post ${p.original_post_id})` : ''} · ${p.num_likes} likes, ${p.num_shares} reposts, ${p.num_replies} replies\n${p.content || p.quote_content}`;

export async function llmRound(llm, world, active) {
  const blocks = active.map(({ agent, visible }) => [
    `## Person #${agent.id}: ${agent.name} (${agent.segment}, ${agent.stance})`,
    agent.bio + (agent.interests?.length ? ` Interests: ${agent.interests.join(', ')}.` : ''),
    `Their recent activity: ${(world.memory.get(agent.id) || ['nothing yet']).join('; ')}`,
    'Their feed right now:',
    ...visible.map((p) => show(world, p)),
  ].join('\n'));
  const ids = new Set(active.map((a) => a.agent.id));
  return llm.json({
    system: [
      'You simulate how specific people behave on X during one hour. Stay in each person\'s character and voice.',
      'Most people mostly scroll: "nothing" and "like" are the most common actions. Replies are short and specific to the post.',
      'Skeptical people question claims that sound unsupported; supportive people add their own experience. Never invent facts about the author.',
      'Reply with JSON only.',
    ].join(' '),
    user: [
      `Round ${world.round}. For each person below, decide 0 to 2 actions on posts in THEIR feed.`,
      ...blocks,
      'JSON shape: {"actions":[{"agent_id":1,"action":"like|repost|reply|quote|post|nothing","post_id":12,"text":"only for reply, quote, post (max 280 chars)"}]}',
    ].join('\n\n'),
    validate: (o) => {
      if (!o || !Array.isArray(o.actions)) throw new Error('expected {actions: [..]}');
      return o.actions.filter((a) => ids.has(Number(a.agent_id)));
    },
  });
}

const CLAIMY = /\d|%|\b(percent|half|twice|double|triple|ten|twenty|thirty|forty|fifty|hundred|thousand|million|billion|always|never|every|nobody|everyone|all|most|proven|fact)\b/i;
// Shortens on a word boundary so quoted snippets never end mid-word.
const clip = (t, n) => (t.length <= n ? t : `${t.slice(0, n).replace(/\s+\S*$/, '')}…`);
const sentencesOf = (t) => String(t).split(/(?<=[.!?])\s+/).filter(Boolean);

// Rule policy for offline mode. Deterministic given the rng; produces few, plain-worded reactions.
export function offlineRound(world, active, rng) {
  const out = [];
  for (const { agent, visible } of active) {
    const p = visible.find((x) => !world.acted.has(`${agent.id}:LIKE_POST:${x.post_id}`) && !world.acted.has(`${agent.id}:REPLY:${x.post_id}`));
    if (!p) continue;
    const text = p.content || p.quote_content;
    // Each skeptic picks one claim, so several skeptics don't all ask about the same sentence.
    const claims = sentencesOf(text).filter((s) => CLAIMY.test(s));
    const r = rng();
    const claim = claims[Math.floor(r * claims.length)];
    if (agent.stance === 'skeptical' && claim && p.user_id === 0) out.push({ agent_id: agent.id, action: 'reply', post_id: p.post_id, text: `Where does "${clip(claim, 70)}" come from? Is there a source?` });
    else if (agent.stance === 'skeptical') out.push({ agent_id: agent.id, action: r < 0.25 ? 'like' : 'nothing', post_id: p.post_id });
    else if (agent.stance === 'supportive') {
      if (r < 0.15) out.push({ agent_id: agent.id, action: 'reply', post_id: p.post_id, text: `Agree with "${clip(sentencesOf(text)[0] ?? '', 100)}" Matches what I've seen.` });
      else out.push({ agent_id: agent.id, action: r < 0.4 ? 'repost' : 'like', post_id: p.post_id });
    } else out.push({ agent_id: agent.id, action: r < 0.35 ? 'like' : r < 0.43 ? 'repost' : 'nothing', post_id: p.post_id });
  }
  return out;
}

export async function simulate({ llm, world, rounds, rng, onRound }) {
  seedDraft(world);
  for (let r = 1; r <= rounds; r++) {
    world.round = r;
    const active = world.agents
      .filter((a) => a.id !== 0 && rng() < a.activity)
      .slice(0, MAX_ACTIVE)
      .map((agent) => ({ agent, visible: feedFor(world, agent) }))
      .filter((a) => a.visible.length);
    if (active.length) {
      const decisions = llm ? await llmRound(llm, world, active) : offlineRound(world, active, rng);
      const perAgent = new Map();
      for (const d of decisions) {
        const a = active.find((x) => x.agent.id === Number(d.agent_id));
        if (!a || (perAgent.get(a.agent.id) || 0) >= 2) continue;
        if (apply(world, a.agent, d, a.visible)) perAgent.set(a.agent.id, (perAgent.get(a.agent.id) || 0) + 1);
      }
    }
    onRound?.(r, rounds);
  }
  return { current_round: rounds, total_rounds: rounds, runner_status: 'completed' };
}
