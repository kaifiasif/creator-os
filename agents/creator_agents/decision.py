"""Decision: predicts accept / edit / reject. It never decides; the creator does, and agreement is measured."""
from __future__ import annotations

from typing import Any

from .jsnum import js_round, js_str, plural, tidy
from .job import AgentJob
from .runtime import LocalToolCaller, SubmitSpec, run_model_agent
from .schemas import DECISION_PREDICTION
from .tools import build_tools, prior_tools

SYSTEM = (
    "You predict what this creator will do with a draft: accept it as is, edit then accept, or reject it. You never decide; the creator does, and your prediction is compared with their choice. "
    "Accept means it already sounds like them, says only what they said, and is new. Edit means fixable in under two minutes. Reject means it is not them, wrong, a repeat, or not worth posting. Be calibrated."
)

REJECT_REASON_FOR = {"voice_fit": "not_me", "novelty": "repeat", "traceability": "wrong_claim"}


def _tools(job: AgentJob):
    return build_tools(job.context, job.bridge, prior_tools(job.prior))


def decision_model(job: AgentJob) -> dict[str, Any]:
    return run_model_agent(
        job.model_client(),
        model=job.model,
        system=SYSTEM,
        task="Predict the decision. Use get_review, get_scores and get_draft.",
        tools=_tools(job),
        submit=SubmitSpec("submit_recommendation", "Submit your prediction of what the creator will do with this draft.", DECISION_PREDICTION),
        trace=job.trace,
    )


def decision_local(job: AgentJob) -> dict[str, Any]:
    call = LocalToolCaller(_tools(job), job.trace)
    call("get_review")
    call("get_scores")
    review = job.prior.get("reviewer")
    scores = job.prior.get("scorer")
    overall = scores["overall"] if scores else 3

    if overall < 2.5:
        dims = sorted((scores or {}).get("dimensions", {}).items(), key=lambda kv: kv[1]["score"])
        worst = dims[0][0] if dims else None
        return {
            "recommendation": "reject",
            "reject_reason": REJECT_REASON_FOR.get(worst or "", "not_worth_posting"),
            "confidence": 0.6,
            "rationale": f"Overall {js_str(overall)}/5; weakest on {worst.replace('_', ' ', 1) if worst else 'every dimension'}.",
        }

    facts = job.context["rule_facts"]["sentences"]
    blocking = sum(1 for r in facts if r and (r["status"] != "supported" or r["repeat_flag"]))
    verification = (review or {}).get("verification")
    fixable = bool(verification and not verification.get("gate_failed") and not verification.get("empty") and verification.get("blocking") == 0)
    if blocking > 0:
        return {
            "recommendation": "edit",
            "confidence": 0.7 if fixable else 0.5,
            "rationale": f"{plural(blocking, 'flagged sentence')}; {'the Reviewer has a checked fix' if fixable else 'no checked fix yet'}.",
        }
    voice_issues = sum(1 for i in review["issues"] if i["problem"] == "voice") if review else 0
    if voice_issues >= 2:
        return {"recommendation": "edit", "confidence": 0.55, "rationale": f"{voice_issues} sentences read unlike you."}
    return {"recommendation": "accept", "confidence": tidy(js_round(min(0.9, overall / 5) * 100) / 100), "rationale": f"Clean checks and overall {js_str(overall)}/5."}
