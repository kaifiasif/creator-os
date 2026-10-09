"""Environment, parsed once at start. A bad value stops the service with a clear message."""
from __future__ import annotations

import os
from dataclasses import dataclass, field


LOOPBACK = {"127.0.0.1", "::1", "localhost"}


@dataclass(frozen=True)
class Config:
    host: str
    port: int
    token: str = field(repr=False)
    anthropic_api_key: str | None = field(repr=False)
    llm_api_key: str | None = field(repr=False)
    llm_base_url: str
    retry_delay_ms: int | None
    logs: bool


def from_env(env: dict[str, str] | None = None) -> Config:
    env = dict(os.environ if env is None else env)
    token = env.get("AGENTS_SERVICE_TOKEN", "")
    if len(token) < 32:
        raise SystemExit("AGENTS_SERVICE_TOKEN must be set to a random string of at least 32 characters.")
    try:
        port = int(env.get("AGENTS_PORT", "8411"))
        retry = env.get("RETRY_DELAY_MS")
        retry_delay_ms = int(retry) if retry not in (None, "") else None
    except ValueError as error:
        raise SystemExit(f"Invalid environment: {error}") from error
    llm_base_url = env.get("LLM_BASE_URL") or "https://api.groq.com/openai/v1"
    if not llm_base_url.startswith(("https://", "http://127.0.0.1", "http://localhost")):
        raise SystemExit("Invalid environment: LLM_BASE_URL must use https (or http on localhost).")
    host = env.get("AGENTS_HOST", "127.0.0.1")
    if host not in LOOPBACK:
        # the token travels in clear and the web app's tool bridge is loopback-only, so stay on this machine
        raise SystemExit("AGENTS_HOST must be a loopback address (127.0.0.1, ::1 or localhost).")
    if not 0 <= port <= 65535 or (retry_delay_ms is not None and retry_delay_ms < 0):
        raise SystemExit("Invalid environment: AGENTS_PORT must be 0-65535 and RETRY_DELAY_MS at least 0.")
    return Config(
        host=host,
        port=port,
        token=token,
        anthropic_api_key=env.get("ANTHROPIC_API_KEY") or None,
        llm_api_key=env.get("LLM_API_KEY") or None,
        llm_base_url=llm_base_url,
        retry_delay_ms=retry_delay_ms,
        logs=env.get("AGENTS_LOG", "1") != "0",
    )
