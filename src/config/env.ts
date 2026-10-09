import { resolve } from 'node:path';
import { z } from 'zod';
import type { RateLimit } from '../http/middleware/rate-limit.ts';

/** Environment is parsed once at boot. A bad value stops the server with a clear message instead of failing later. */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4173),
  CREATOR_OS_DB: z.string().min(1).default('data/creator-os.db'),
  CREATOR_OS_UPLOADS: z.string().min(1).default('data/uploads'),
  /** open: anyone who can reach the server can create an account. closed: only the first account. */
  CREATOR_OS_SIGNUP: z.enum(['open', 'closed']).default('open'),
  /** Only this email may take over data from before accounts. Set it before deploying an existing database. */
  CREATOR_OS_OWNER_EMAIL: z.string().trim().toLowerCase().pipe(z.email()).optional(),
  /** Session cookies are Secure (HTTPS only) in production. Set to 0 only to try a production build over plain http on localhost. */
  COOKIE_SECURE: z.enum(['0', '1', 'true', 'false']).optional(),
  CREATOR_OS_CONDITION: z.enum(['gate', 'context_only']).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  ASSEMBLYAI_API_KEY: z.string().min(1).optional(),
  /** Any OpenAI-compatible chat API. Defaults to Groq, whose free tier needs no card. */
  LLM_API_KEY: z.string().min(1).optional(),
  LLM_BASE_URL: z.url().default('https://api.groq.com/openai/v1'),
  CREATOR_OS_MAIN_MODEL: z.string().min(1).optional(),
  CREATOR_OS_JUDGE_MODEL: z.string().min(1).optional(),
  CREATOR_OS_AGENT_MODEL: z.string().min(1).optional(),
  /** Set to 1 behind a proxy that sets X-Forwarded-For (Render, Fly), so rate limits apply per visitor. */
  TRUST_PROXY: z.enum(['0', '1', 'true', 'false']).default('0').transform((v) => v === '1' || v === 'true'),
  RETRY_DELAY_MS: z.coerce.number().int().min(0).optional(),
  /** Python that runs the agents service (agents/). The web app starts it on a private local port. */
  CREATOR_OS_PYTHON: z.string().min(1).default('python3'),
  /** Use an agents service you run yourself on this machine instead (python -m creator_agents). Needs AGENTS_SERVICE_TOKEN. */
  CREATOR_OS_AGENTS_URL: z.url().optional(),
  AGENTS_SERVICE_TOKEN: z.string().min(32).optional(),
}).refine((e) => !e.CREATOR_OS_AGENTS_URL || e.AGENTS_SERVICE_TOKEN, {
  message: 'AGENTS_SERVICE_TOKEN is required with CREATOR_OS_AGENTS_URL',
  path: ['AGENTS_SERVICE_TOKEN'],
});

export type Env = z.infer<typeof EnvSchema>;

/** Model defaults per vendor; CREATOR_OS_MAIN_MODEL and CREATOR_OS_JUDGE_MODEL override either. */
export const CLAUDE_MODELS = { main: 'claude-sonnet-5-5', judge: 'claude-haiku-4-5-20251001' } as const;
export const OPENAI_COMPATIBLE_MODELS = { main: 'openai/gpt-oss-120b', judge: 'openai/gpt-oss-20b' } as const;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${problems}`);
  }
  return parsed.data;
}

/** Runtime settings the services read. Mutable on purpose so tests can force a condition. */
export interface AppConfig {
  uploadDir: string;
  signup: 'open' | 'closed';
  ownerEmail: string | undefined;
  /** Secure cookies only travel over HTTPS; the session cookie also gets the __Host- prefix. */
  secureCookies: boolean;
  forcedCondition: 'gate' | 'context_only' | undefined;
  agentModel: string;
  /** Agents use a model when a Claude or OpenAI-compatible key is present; otherwise their local rule versions. */
  agentsUseModel: boolean;
  /** Where the Python agents service runs: started by the web app (python) or already running (url). */
  agentService: { python: string; url: string | undefined };
  trustProxy: boolean;
  rateLimits: {
    /** every API call */
    api: RateLimit;
    /** calls that spend model tokens or disk: uploads, drafts, agent and rehearsal runs */
    costly: RateLimit;
    /** failed log-ins, counted per visitor and per email */
    authFailures: RateLimit;
    /** new accounts per visitor */
    signups: RateLimit;
  };
}

export const DEFAULT_RATE_LIMITS: AppConfig['rateLimits'] = {
  api: { limit: 600, windowMs: 60_000 },
  costly: { limit: 60, windowMs: 10 * 60_000 },
  authFailures: { limit: 10, windowMs: 15 * 60_000 },
  signups: { limit: 5, windowMs: 60 * 60_000 },
};

export function configFromEnv(env: Env): AppConfig {
  return {
    uploadDir: resolve(env.CREATOR_OS_UPLOADS),
    signup: env.CREATOR_OS_SIGNUP,
    ownerEmail: env.CREATOR_OS_OWNER_EMAIL,
    secureCookies: env.COOKIE_SECURE === undefined ? env.NODE_ENV === 'production' : env.COOKIE_SECURE === '1' || env.COOKIE_SECURE === 'true',
    forcedCondition: env.CREATOR_OS_CONDITION,
    agentModel: env.CREATOR_OS_AGENT_MODEL ?? env.CREATOR_OS_MAIN_MODEL ?? (env.ANTHROPIC_API_KEY ? CLAUDE_MODELS.main : OPENAI_COMPATIBLE_MODELS.main),
    agentsUseModel: Boolean(env.ANTHROPIC_API_KEY || env.LLM_API_KEY),
    agentService: { python: env.CREATOR_OS_PYTHON, url: env.CREATOR_OS_AGENTS_URL },
    trustProxy: env.TRUST_PROXY,
    rateLimits: DEFAULT_RATE_LIMITS,
  };
}
