// Framework-free service the host app's router calls. Creator OS 0.5 wraps it in Hono routes
// (integration/rehearsal.routes.ts); errors are RehearsalError with an HTTP status.
import { mirofishClient } from './client.js';
import { swarmEngine, swarmLlm } from './swarm/index.js';
import { getRehearsal, startRehearsal, interviewAgent, rehearsalConfig } from './rehearsal.js';

export function rehearsalService({ db, background, client = mirofishClient(), engine = swarmEngine({ llm: swarmLlm() }), config = rehearsalConfig() }) {
  const onMiroFish = config.engine === 'mirofish';
  const enabled = onMiroFish ? config.enabled && Boolean(client) : Boolean(engine);
  const engineName = onMiroFish ? 'mirofish' : engine?.kind;
  return {
    config: () => ({ enabled, engine: engineName, max_rounds: config.max_rounds, before_decision: config.before_decision, interviews: onMiroFish ? enabled : Boolean(engine?.canInterview) }),
    get: (runId) => getRehearsal(db, runId, { ...config, enabled, engine: engineName }),
    start: (runId, body = {}) => startRehearsal(db, runId, { client, engine, background, config, audience: body.audience, max_rounds: body.max_rounds, force: body.force === true }),
    interview: (rehearsalId, body) => interviewAgent(db, rehearsalId, body, { client, engine }),
  };
}
