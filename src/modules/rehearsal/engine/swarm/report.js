// Prediction report and persona interviews. Both are single model calls over the simulation log;
// offline, the report is a plain summary and interviews are unavailable.

export async function writeReport({ llm, handle, draft, summary, world }) {
  if (!llm) return offlineReport(summary);
  const log = world.actions
    .filter((a) => a.agent_id !== 0)
    .map((a) => `r${a.round_num} ${a.agent_name}: ${a.action_type}${a.action_args.content || a.action_args.quote_content ? ` "${a.action_args.content || a.action_args.quote_content}"` : ` post ${a.action_args.post_id}`}`)
    .slice(0, 150)
    .join('\n');
  const out = await llm.json({
    system: 'You analyse a simulated audience reaction for a creator. Be concrete, cite what simulated people said, and keep it short. Reply with JSON only.',
    user: [
      `${handle} is about to post:\n"""${draft}"""`,
      `Simulated activity (${world.agents.length - 1} people, ${summary.rounds} rounds):\n${log || '(nobody reacted)'}`,
      `Counts: ${JSON.stringify(summary.counts)}. Pushback share: ${Math.round(summary.pushback_share * 100)}%.`,
      'Write a markdown report with sections: "## Likely reception", "## Who engages", "## Pushback", "## Before you post". Under 250 words. The last section lists at most 3 concrete edits or checks, tied to specific sentences.',
      'JSON shape: {"markdown":"..."}',
    ].join('\n\n'),
    validate: (o) => { if (typeof o?.markdown !== 'string' || !o.markdown.trim()) throw new Error('expected {markdown}'); return o.markdown; },
    temperature: 0.4,
  });
  return { report_id: null, markdown_content: out };
}

export function offlineReport(s) {
  const hot = s.sentences.filter((x) => x.pushback).sort((a, b) => b.pushback - a.pushback);
  const md = [
    '## Offline estimate',
    'No model key is set, so this comes from simple rules, not simulated people. Set LLM_API_KEY (the free Groq key) for a real rehearsal.',
    '## Likely reception',
    `${s.counts.likes} likes, ${s.counts.reposts} reposts and ${s.counts.replies} replies across ${s.agents} simulated followers over ${s.rounds} rounds.`,
    '## Pushback',
    hot.length ? hot.map((x) => `- "${x.text}" drew ${x.pushback} question${x.pushback === 1 ? '' : 's'}.`).join('\n') : '- No sentence drew questions.',
    '## Before you post',
    hot.length ? '- Make sure the sentences above trace to your source, or soften them.' : '- Nothing flagged.',
  ].join('\n\n');
  return { report_id: null, markdown_content: md };
}

export async function interviewPersona({ llm, handle, draft, persona, history, question }) {
  const out = await llm.json({
    system: `You are ${persona.name}, a person on X. ${persona.bio} Answer in first person, in your own voice, in 1 to 4 sentences. Reply with JSON only.`,
    user: [
      `You saw this post by ${handle}:\n"""${draft}"""`,
      `What you did after seeing it: ${history.length ? history.join('; ') : 'nothing'}.`,
      `Someone asks you: ${question}`,
      'JSON shape: {"answer":"..."}',
    ].join('\n\n'),
    validate: (o) => { if (typeof o?.answer !== 'string' || !o.answer.trim()) throw new Error('expected {answer}'); return o.answer.trim(); },
    temperature: 0.7,
  });
  return out;
}
