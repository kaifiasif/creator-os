"""Runs one agent for one draft and returns its output with the trace of what it looked at.

The web app calls the agents in order (Reviewer, Scorer, Decision), records each result on its own row,
and re-checks the Reviewer's revised draft itself: nothing an agent claims is trusted unverified.
"""
from __future__ import annotations

from typing import Any, Callable

from .decision import decision_model, decision_local
from .job import AgentJob
from .reviewer import reviewer_model, reviewer_local
from .scorer import combine, rule_scores, scorer_model, scorer_local

AGENT_VERSIONS = {"reviewer": "reviewer@1", "scorer": "scorer@1", "decision": "decision@1"}
LOCAL_MODEL = "local-rules@1"


def _score(judge: Callable[[AgentJob, dict[str, Any]], dict[str, Any]]) -> Callable[[AgentJob], dict[str, Any]]:
    def run(job: AgentJob) -> dict[str, Any]:
        rules = rule_scores(job.context["rule_facts"])
        return combine(rules, judge(job, rules))

    return run


IMPLEMENTATIONS: dict[str, dict[str, Callable[[AgentJob], dict[str, Any]]]] = {
    "model": {"reviewer": reviewer_model, "scorer": _score(scorer_model), "decision": decision_model},
    "local": {"reviewer": reviewer_local, "scorer": _score(scorer_local), "decision": decision_local},
}


def run_agent(agent: str, job: AgentJob, use_model: bool) -> dict[str, Any]:
    """use_model: the model version (Claude, or an OpenAI-compatible API such as Groq); otherwise the local rules."""
    return IMPLEMENTATIONS["model" if use_model else "local"][agent](job)
