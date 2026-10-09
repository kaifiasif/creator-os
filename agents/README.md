# Creator OS agents (Python)

The Reviewer, Scorer and Decision agents, served to the Creator OS web app over a local HTTP API. Python 3.10+, standard library only.

The web app starts this service itself (`npm start`), so you normally never run it by hand. To run it on its own, for example to debug it:

```bash
AGENTS_SERVICE_TOKEN=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))") AGENTS_PORT=8411 python3 -m creator_agents
# then start the web app with CREATOR_OS_AGENTS_URL=http://127.0.0.1:8411 and the same AGENTS_SERVICE_TOKEN
```

| Variable | Meaning | Default |
|---|---|---|
| `AGENTS_SERVICE_TOKEN` | Required. The web app sends it as a bearer token on every agent call. At least 32 characters | |
| `AGENTS_HOST`, `AGENTS_PORT` | Where to listen. `AGENTS_PORT=0` lets the OS pick; the port is printed on stdout as `{"event": "listening", "port": N}` | `127.0.0.1`, `8411` |
| `ANTHROPIC_API_KEY` | Lets the agents run as Claude tool-use loops when the web app asks for that | See `LLM_API_KEY` |
| `LLM_API_KEY`, `LLM_BASE_URL` | Used when there is no Claude key: the same loop over OpenAI-style function calling (Groq's free tier by default, `https://api.groq.com/openai/v1`) | Local rule versions only |
| `RETRY_DELAY_MS` | Scales the retry delays for Claude calls (0 in tests) | 1s, then 4s |
| `AGENTS_LOG` | `0` silences the JSON logs on stderr | on |

## API (internal)

- `GET /healthz`: `{ ok, agents }`, no token.
- `POST /v1/agents/{reviewer|scorer|decision}` with `Authorization: Bearer <token>`. The body carries the draft as the agents see it, the claims, voice statistics, the measured facts for the Scorer, earlier agents' outputs for the Decision agent, and a tool-bridge URL plus a one-time token for the tools that need the creator's data. The answer is `{ ok: true, output, trace }` or `{ ok: false, error, trace }`.

## Layout

| File | What it does |
|---|---|
| `server.py`, `__main__.py`, `config.py` | HTTP server, start-up, environment |
| `agents.py` | Picks the Claude or local version of an agent and runs it |
| `reviewer.py`, `scorer.py`, `decision.py` | The three agents: prompts, local rules, scoring |
| `runtime.py` | The model tool loop and the local tool caller, with traces |
| `tools.py`, `bridge.py` | The tools agents can call; three of them call back to the web app |
| `schemas.py`, `validation.py` | Submission and tool-input schemas, shown to the model and enforced |
| `anthropic.py` | Claude Messages API client, and the retry policy (including rate limits) both clients share |
| `openai_compat.py` | The same requests over any OpenAI-compatible `/chat/completions` (Groq, OpenRouter, Gemini, Mistral) |
| `jsnum.py` | Rounding, number formatting and text rules that match the web app's JavaScript |

Tests: `python3 -m unittest discover -s tests -t .` (or `npm run test:py` from the repo root).
