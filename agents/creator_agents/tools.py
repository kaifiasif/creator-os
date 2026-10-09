"""Tools the agents can call. All read-only: agents inspect and verify, they never change a draft or decide.

The draft, claims and voice profile arrive with the request. The three tools that run the real checks or
search the archive call back to the web app, which owns the creator's data.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from .bridge import Bridge
from .schemas import TOOL_INPUTS
from .validation import validate


@dataclass(frozen=True)
class AgentTool:
    name: str
    description: str
    input_schema: dict[str, Any]
    run: Callable[[dict[str, Any]], Any]

    def call(self, raw: dict[str, Any] | None) -> Any:
        return self.run(validate(self.input_schema, raw or {}))


def _tool(name: str, description: str, run: Callable[[dict[str, Any]], Any]) -> AgentTool:
    return AgentTool(name, description, TOOL_INPUTS[name], run)


def build_tools(context: dict[str, Any], bridge: Bridge, extra: list[AgentTool] | None = None) -> list[AgentTool]:
    return [
        _tool(
            "get_draft",
            "The draft under review: posts, sentences with ids, cited claim ids, and the pre-review check results for each sentence.",
            lambda _: context["draft"],
        ),
        _tool(
            "get_claims",
            "Verified claims from the source transcript. Only these may support a sentence. is_creator=false claims must be attributed to their speaker.",
            lambda _: context["claims"],
        ),
        _tool(
            "search_archive",
            "Find the creator's earlier published posts most similar to a text. Use to judge novelty or check a rewrite is not a repeat.",
            lambda i: bridge.call("search_archive", i),
        ),
        _tool(
            "check_sentence",
            "Run the real gate (traceability, repetition, voice) on one candidate sentence citing the given claim ids. Use it to verify every replacement before proposing it.",
            lambda i: bridge.call("check_sentence", i),
        ),
        _tool(
            "check_posts",
            "Run every check on a full candidate version of the draft (array of post texts). Returns how many sentences would still block.",
            lambda i: bridge.call("check_posts", i),
        ),
        _tool(
            "voice_profile",
            "Statistics of the creator's own writing (sentence length, question, hedging, emoji rates, common openings). No archive text.",
            lambda _: context["voice_profile"],
        ),
        *(extra or []),
    ]


def prior_tools(prior: dict[str, Any]) -> list[AgentTool]:
    return [
        _tool("get_review", "The Reviewer's issues, proposed fixes and the server's verification of the revised draft.", lambda _: prior.get("reviewer") or {"unavailable": True}),
        _tool("get_scores", "The Scorer's 1-5 scores per dimension and overall.", lambda _: prior.get("scorer") or {"unavailable": True}),
    ]
