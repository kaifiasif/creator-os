"""Everything one agent needs for one run: the draft data, the tools, the model client and the trace."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .anthropic import AnthropicClient
from .bridge import Bridge
from .runtime import AgentError, Trace


@dataclass
class AgentJob:
    run_id: str
    context: dict[str, Any]
    """draft (as get_draft returns it), claims, posts, voice_profile, and the facts the Scorer's rules need."""
    bridge: Bridge
    model: str
    client: AnthropicClient | None
    prior: dict[str, Any] = field(default_factory=dict)
    trace: Trace = field(default_factory=list)

    def model_client(self) -> AnthropicClient:
        if self.client is None:
            raise AgentError("No model is configured: set ANTHROPIC_API_KEY or LLM_API_KEY.")
        return self.client
