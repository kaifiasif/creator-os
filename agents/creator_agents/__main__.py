"""Start the agents service: python -m creator_agents

Prints one JSON line on stdout once it is listening, {"event": "listening", "port": N}, so a parent
process that asked for port 0 learns which port it got. Logs go to stderr.
"""
from __future__ import annotations

import json
import signal
import sys

from .anthropic import AnthropicClient, HttpAnthropicClient, retry_delays
from .config import Config, from_env
from .log import Logger
from .openai_compat import OpenAICompatibleClient
from .server import AgentServer


def model_client(config: Config) -> AnthropicClient | None:
    """Claude when its key is set, else any OpenAI-compatible API (Groq's free tier by default), else none."""
    delays = retry_delays(config.retry_delay_ms)
    if config.anthropic_api_key:
        return HttpAnthropicClient(config.anthropic_api_key, delays)
    if config.llm_api_key:
        return OpenAICompatibleClient(config.llm_api_key, config.llm_base_url, delays)
    return None


def main() -> None:
    config = from_env()
    log = Logger({"service": "creator-agents"}, config.logs)
    client = model_client(config)
    server = AgentServer((config.host, config.port), token=config.token, client=client, log=log)
    port = server.server_address[1]
    sys.stdout.write(json.dumps({"event": "listening", "port": port}) + "\n")
    sys.stdout.flush()
    log.info("listening", host=config.host, port=port, model_client=repr(client) if client else None)

    def stop(*_: object) -> None:
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, stop)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
