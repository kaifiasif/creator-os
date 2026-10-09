// Follower personas. With a model: one call turns the audience notes and archive into varied people.
// Offline: a fixed mix built from the audience lines, so demos and tests run with no key.
import { DEFAULT_AUDIENCE } from '../seed.js';

export const STANCES = ['supportive', 'skeptical', 'neutral'];

const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

export function validatePersonas(o, n) {
  if (!o || !Array.isArray(o.personas) || o.personas.length < 2) throw new Error('expected {personas: [..]} with at least 2 entries');
  return o.personas.slice(0, n).map((p, i) => {
    if (typeof p.name !== 'string' || !p.name.trim() || typeof p.bio !== 'string') throw new Error(`personas[${i}] needs name and bio`);
    return {
      id: i + 1, // 0 is the creator
      name: p.name.trim().slice(0, 40),
      segment: String(p.segment || 'follower').slice(0, 40),
      bio: p.bio.slice(0, 300),
      interests: Array.isArray(p.interests) ? p.interests.map(String).slice(0, 6) : [],
      stance: STANCES.includes(p.stance) ? p.stance : 'neutral',
      activity: clamp(Number(p.activity) || 0.5, 0.1, 1),
      follows_creator: p.follows_creator !== false,
    };
  });
}

export async function generatePersonas({ llm, audience, archive, handle, count = 12, rng }) {
  if (!llm) return offlinePersonas({ audience, count, rng });
  const sample = archive.slice(0, 15).map((a) => `- ${a.text.replace(/\s+/g, ' ').slice(0, 240)}`).join('\n') || '- (no archive yet)';
  return llm.json({
    system: 'You design realistic, varied social media users for an audience simulation. Reply with JSON only.',
    user: [
      `Create ${count} distinct X users who could plausibly see posts by ${handle}.`,
      `Audience groups (spread the users across them):\n${(audience || DEFAULT_AUDIENCE).trim()}`,
      `What ${handle} has posted before:\n${sample}`,
      'Make them specific people with their own jobs, opinions and posting habits. Include a few who disagree easily, and a few who rarely post.',
      'JSON shape: {"personas":[{"name":"...","segment":"one of the groups","bio":"1-2 sentences","interests":["..."],"stance":"supportive|skeptical|neutral","activity":0.1-1.0,"follows_creator":true|false}]}',
    ].join('\n\n'),
    validate: (o) => validatePersonas(o, count),
    temperature: 0.9,
  });
}

// Keyword-matched archetypes for the offline mode. Only stance and activity matter there.
const ARCHETYPES = [
  { re: /skeptic|critic|push ?back|doubt/i, stance: 'skeptical', activity: 0.7 },
  { re: /lurk|silent|quiet/i, stance: 'neutral', activity: 0.25 },
  { re: /new|first time|stranger/i, stance: 'neutral', activity: 0.45, follows: false },
  { re: /peer|fan|creator|builder|friend/i, stance: 'supportive', activity: 0.65 },
];

export function offlinePersonas({ audience, count = 12, rng = Math.random }) {
  const lines = (audience || DEFAULT_AUDIENCE).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 8);
  const out = [];
  for (let i = 0; i < count; i++) {
    const line = lines[i % lines.length];
    const segment = line.split(':')[0].replace(/^[-*\s]+/, '').slice(0, 40) || 'Follower';
    const a = ARCHETYPES.find((x) => x.re.test(line)) || { stance: 'neutral', activity: 0.5 };
    out.push({
      id: i + 1,
      name: `${segment} ${Math.floor(i / lines.length) + 1}`,
      segment,
      bio: line.slice(0, 300),
      interests: [],
      stance: a.stance,
      activity: clamp(a.activity + (rng() - 0.5) * 0.2, 0.1, 1),
      follows_creator: a.follows !== false,
    });
  }
  return out;
}
