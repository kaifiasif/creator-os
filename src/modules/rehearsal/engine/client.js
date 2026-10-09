// Thin HTTP client for an unmodified MiroFish backend (https://github.com/666ghj/MiroFish, AGPL-3.0).
// MiroFish runs as its own service; Creator OS only talks to its public HTTP API, so no MiroFish code
// is copied in here. Every request sends Accept-Language: en, otherwise MiroFish answers in Chinese.

export class MiroFishError extends Error {
  constructor(message, { status, step } = {}) {
    super(message);
    this.status = status;
    this.step = step;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function mirofishClient({
  baseUrl = process.env.MIROFISH_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = Number(process.env.MIROFISH_TIMEOUT_MS || 10 * 60_000),
  pollMs = Number(process.env.MIROFISH_POLL_MS || 3000),
} = {}) {
  if (!baseUrl) return null;
  const root = baseUrl.replace(/\/+$/, '');

  async function call(step, method, path, { json, form, query } = {}) {
    const url = new URL(root + path);
    for (const [k, v] of Object.entries(query || {})) if (v !== undefined) url.searchParams.set(k, String(v));
    const headers = { 'accept-language': 'en', accept: 'application/json' };
    let body;
    if (json) { headers['content-type'] = 'application/json'; body = JSON.stringify(json); }
    if (form) body = form;
    let res;
    try {
      res = await fetchImpl(url, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      throw new MiroFishError(`Could not reach MiroFish at ${root} (${e.name === 'TimeoutError' ? 'timed out' : e.message}).`, { step });
    }
    const out = await res.json().catch(() => null);
    if (!res.ok || !out?.success) {
      // MiroFish also returns a Python traceback on 500s; keep it out of user-facing errors.
      throw new MiroFishError(out?.error || `MiroFish ${method} ${path} failed with HTTP ${res.status}.`, { status: res.status, step });
    }
    return out.data;
  }

  // Polls until done(data) is truthy; fails on failed(data) or after maxWaitMs.
  async function poll(step, fetchState, { done, failed, maxWaitMs, onProgress }) {
    const t0 = Date.now();
    for (;;) {
      const data = await fetchState();
      onProgress?.(data);
      if (failed(data)) throw new MiroFishError(data.error || data.message || `${step} failed in MiroFish.`, { step });
      if (done(data)) return data;
      if (Date.now() - t0 > maxWaitMs) throw new MiroFishError(`${step} did not finish within ${Math.round(maxWaitMs / 60000)} min.`, { step });
      await sleep(pollMs);
    }
  }

  return {
    baseUrl: root,

    // Step 1: upload the seed document; MiroFish extracts an ontology (synchronous LLM call).
    generateOntology({ seedMarkdown, requirement, projectName, additionalContext }) {
      const form = new FormData();
      form.append('files', new Blob([seedMarkdown], { type: 'text/markdown' }), 'creator-os-seed.md');
      form.append('simulation_requirement', requirement);
      form.append('project_name', projectName);
      if (additionalContext) form.append('additional_context', additionalContext);
      return call('ontology', 'POST', '/api/graph/ontology/generate', { form });
    },

    // Step 2: build the Zep knowledge graph (async task).
    async buildGraph(projectId, { maxWaitMs = 20 * 60_000, onProgress } = {}) {
      const { task_id } = await call('graph', 'POST', '/api/graph/build', { json: { project_id: projectId } });
      const task = await poll('graph', () => call('graph', 'GET', `/api/graph/task/${task_id}`), {
        done: (t) => t.status === 'completed', failed: (t) => t.status === 'failed', maxWaitMs, onProgress,
      });
      return task.result;
    },

    // Step 3: create a Twitter-only simulation (Creator OS writes X posts; one platform halves token use).
    createSimulation(projectId, graphId) {
      return call('simulation', 'POST', '/api/simulation/create', {
        json: { project_id: projectId, graph_id: graphId, enable_twitter: true, enable_reddit: false },
      });
    },

    // Step 4: generate personas + simulation config (async task).
    async prepare(simulationId, { parallel = 2, maxWaitMs = 30 * 60_000, onProgress } = {}) {
      const started = await call('prepare', 'POST', '/api/simulation/prepare', {
        json: { simulation_id: simulationId, use_llm_for_profiles: true, parallel_profile_count: parallel },
      });
      if (started.already_prepared || started.status === 'ready') return started;
      const ready = (d) => d.already_prepared || d.status === 'ready' || d.status === 'completed';
      return poll('prepare', () => call('prepare', 'POST', '/api/simulation/prepare/status', { json: { task_id: started.task_id, simulation_id: simulationId } }), {
        done: ready, failed: (d) => d.status === 'failed', maxWaitMs, onProgress,
      });
    },

    // Step 5: run the simulation and wait for it to finish.
    async run(simulationId, { maxRounds = 10, maxWaitMs = 60 * 60_000, onProgress } = {}) {
      await call('run', 'POST', '/api/simulation/start', {
        json: { simulation_id: simulationId, platform: 'twitter', max_rounds: maxRounds, enable_graph_memory_update: false },
      });
      return poll('run', () => call('run', 'GET', `/api/simulation/${simulationId}/run-status`), {
        done: (s) => ['completed', 'stopped'].includes(s.runner_status),
        failed: (s) => s.runner_status === 'failed', maxWaitMs, onProgress,
      });
    },

    posts(simulationId, limit = 200) {
      return call('results', 'GET', `/api/simulation/${simulationId}/posts`, { query: { platform: 'twitter', limit } });
    },
    actions(simulationId, limit = 500) {
      return call('results', 'GET', `/api/simulation/${simulationId}/actions`, { query: { platform: 'twitter', limit } });
    },

    // Step 6: ReportAgent writes the prediction report (async task).
    async report(simulationId, { maxWaitMs = 30 * 60_000, onProgress } = {}) {
      const started = await call('report', 'POST', '/api/report/generate', { json: { simulation_id: simulationId } });
      if (started.status !== 'completed') {
        await poll('report', () => call('report', 'POST', '/api/report/generate/status', { json: { task_id: started.task_id, simulation_id: simulationId } }), {
          done: (d) => d.status === 'completed', failed: (d) => d.status === 'failed', maxWaitMs, onProgress,
        });
      }
      return call('report', 'GET', `/api/report/by-simulation/${simulationId}`);
    },

    // Ask one simulated follower a question. Only works while the simulation env is still up.
    interview(simulationId, agentId, prompt) {
      return call('interview', 'POST', '/api/simulation/interview', {
        json: { simulation_id: simulationId, agent_id: agentId, prompt, platform: 'twitter', timeout: 90 },
      });
    },

    closeEnv(simulationId) {
      return call('close', 'POST', '/api/simulation/close-env', { json: { simulation_id: simulationId } });
    },
  };
}
