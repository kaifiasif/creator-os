/**
 * Tool bridge: how the Python agents reach the checks and the archive without ever touching the database.
 *
 * A small HTTP server on 127.0.0.1 (port picked by the OS) answers POST /tools/<name>. Each agent pass
 * opens a session with a random token bound to one creator's context and one draft; the agents service
 * sends that token back with every tool call. The token is the only thing that selects data, so the
 * service cannot ask for another creator's archive, and it stops working when the pass ends.
 */
import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';
import type { AppContext } from '../../context.ts';
import { errorFields } from '../../core/logger.ts';
import type { AgentContext } from './agent.types.ts';
import { BridgeInputs, runBridgeTool, type BridgeTool } from './tools.ts';

const MAX_BODY_BYTES = 256 * 1024;
/** A pass that outlives this is abandoned; its token stops working even if close() was never reached. */
const SESSION_TTL_MS = 30 * 60_000;

export interface BridgeSession {
  url: string;
  token: string;
  close(): void;
}

export interface ToolBridge {
  open(ctx: AppContext, agent: AgentContext): Promise<BridgeSession>;
}

interface Session {
  ctx: AppContext;
  agent: AgentContext;
  expires: number;
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const isTool = (name: string): name is BridgeTool => Object.hasOwn(BridgeInputs, name);

function send(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) });
  res.end(data);
}

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        resolve(null);
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function createToolBridge(): ToolBridge {
  const sessions = new Map<string, Session>();
  let listening: Promise<string> | null = null;

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const name = /^\/tools\/([a-z_]+)$/.exec(req.url ?? '')?.[1];
    if (req.method !== 'POST' || !name || !isTool(name)) return send(res, 404, { error: 'Unknown tool.' });
    const token = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '')?.[1];
    const session = token ? sessions.get(hash(token)) : undefined;
    if (!session || session.expires < Date.now()) return send(res, 401, { error: 'This agent pass has ended.' });

    const raw = await readBody(req);
    if (raw === null) return send(res, 413, { error: 'Tool input is too large.' });
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      return send(res, 400, { error: 'Tool input must be JSON.' });
    }
    try {
      send(res, 200, { result: await runBridgeTool(session.ctx, session.agent, name, input) });
    } catch (error) {
      // reported back to the model as a failed tool call; it can try something else. Only input problems
      // are described: other failures stay in the log, since the message ends up in a trace the creator sees.
      if (error instanceof z.ZodError) return send(res, 422, { error: error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ') });
      session.ctx.log.warn('agent_tool_failed', { tool: name, run_id: session.agent.run.id, ...errorFields(error) });
      send(res, 422, { error: 'The tool failed. Try a different input or carry on without it.' });
    }
  }

  function listen(): Promise<string> {
    listening ??= new Promise((resolve, reject) => {
      const server: Server = createServer((req, res) => {
        handle(req, res).catch(() => send(res, 500, { error: 'Tool failed.' }));
      });
      server.once('error', (error) => {
        listening = null;
        reject(error);
      });
      server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}/tools`));
      server.unref(); // never keeps the process alive on its own
    });
    return listening;
  }

  return {
    async open(ctx, agent) {
      const url = await listen();
      const now = Date.now();
      for (const [key, s] of sessions) if (s.expires < now) sessions.delete(key);
      const token = randomBytes(32).toString('base64url');
      const key = hash(token);
      sessions.set(key, { ctx, agent, expires: now + SESSION_TTL_MS });
      return { url, token, close: () => sessions.delete(key) };
    },
  };
}
