// Creator OS's own audience simulator ("swarm"). Same job as MiroFish for this use case, no MiroFish,
// no Zep, no Python: personas -> feed rounds -> report, all in-process. Written from MiroFish's
// documented workflow, not its code.
import { buildSeed } from '../seed.js';
import { summarize } from '../summarize.js';
import { generatePersonas } from './personas.js';
import { createWorld, simulate, rngFrom } from './simulate.js';
import { writeReport, interviewPersona } from './report.js';

export { swarmLlm, LlmError } from './llm.js';

export function swarmEngine({ llm = null, personaCount = Number(process.env.SWARM_PERSONAS || 12) } = {}) {
  return {
    kind: llm ? 'swarm' : 'swarm-offline',
    canInterview: Boolean(llm),

    // onStage(status, progress) mirrors the rehearsal row's stages.
    async run({ input, settings, onStage = () => {} }) {
      const { draft } = buildSeed({ posts: input.posts, archive: input.archive, audience: settings.audience, handle: settings.handle, format: input.format });
      const rng = rngFrom(`${draft}|${settings.audience || ''}|${settings.seed ?? 0}`);

      onStage('preparing', 5);
      const personas = await generatePersonas({ llm, audience: settings.audience, archive: input.archive || [], handle: settings.handle, count: personaCount, rng });

      onStage('running', 20);
      const world = createWorld({ handle: settings.handle, draft, personas });
      const runStatus = await simulate({ llm, world, rounds: settings.max_rounds, rng, onRound: (r, n) => onStage('running', 20 + Math.round((65 * r) / n)) });

      onStage('reporting', 88);
      const result = summarize({ draft, sentences: input.sentences, posts: world.posts, actions: world.actions, runStatus });
      result.agents = personas.length;
      let reportError = null;
      try { result.report = summarizeReport(await writeReport({ llm, handle: settings.handle, draft, summary: result, world })); }
      catch (e) { reportError = e.message; }
      if (reportError) result.report_error = reportError;

      result.engine = this.kind;
      result.model = llm?.model ?? null;
      result.model_calls = llm?.calls ?? 0;
      result.personas = personas.map(({ id, name, segment, stance, bio }) => ({ id, name, segment, stance, bio }));
      // Kept for interviews: what each persona did, in their own log.
      const state = { draft, handle: settings.handle, personas, memory: Object.fromEntries(world.memory) };
      return { result, state };
    },

    async interview({ state, agentId, question }) {
      const persona = state.personas.find((p) => p.id === agentId);
      if (!persona) throw Object.assign(new Error(`No simulated follower #${agentId}.`), { status: 404 });
      return interviewPersona({ llm, handle: state.handle, draft: state.draft, persona, history: state.memory[agentId] || [], question });
    },
  };
}

const summarizeReport = (r) => ({ id: r.report_id, markdown: r.markdown_content, outline: null });
