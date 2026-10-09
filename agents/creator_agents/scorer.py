"""Scorer: measurable dimensions come from rules; only hook and clarity are judged (by the model or local rules)."""
from __future__ import annotations

from typing import Any

from .jsnum import clamp, js_round, js_str, mean, split_sentences, opening_pattern, tidy, to_fixed, to_half, to_json, word_count
from .job import AgentJob
from .runtime import LocalToolCaller, SubmitSpec, run_model_agent
from .schemas import SCORER_JUDGMENT
from .tools import build_tools

OPENING = {"question": "a question", "number": "a number", "story": "a story", "claim": "a short claim", "other": "a longer statement"}
SUPPORT_VALUE = {"supported": 1, "partial": 0.5, "unsupported": 0}


def rule_scores(facts: dict[str, Any]) -> dict[str, Any]:
    """facts: one entry per draft sentence (None when it was never checked), the draft's voice score, the repeat threshold."""
    checked = [r for r in facts["sentences"] if r]
    assertions = [r for r in checked if r["type"] == "assertion"]
    share = mean(SUPPORT_VALUE[r["status"]] for r in assertions) if assertions else 1
    threshold = facts["repetition_threshold"]
    max_similarity = max([0, *(r["top_similarity"] or 0 for r in checked)])

    v = facts.get("voice_score")
    scored = v if v and "skipped" in v and not v["skipped"] else None
    zs = [abs(z) for z in scored["z_scores"].values()] if scored else []
    total = len(facts["sentences"])
    flagged_share = sum(1 for r in checked if r["voice_flag"]) / total if total else 0
    voice = clamp(5 - mean(zs) * 1.2 - flagged_share * 2 - (1 if scored["beyond_p90"] else 0)) if zs and scored else 3

    voice_reason = "No archive to compare against."
    if zs:
        voice_reason = f"Average deviation {to_fixed(mean(zs), 1)} SD from your archive"
        voice_reason += f"; {js_round(flagged_share * 100)}% of sentences flagged." if flagged_share else "."
    return {
        "traceability": {"score": to_half(1 + 4 * share), "reason": f"{js_round(share * 100)}% of assertions backed by the source.", "by": "rule"},
        "novelty": {
            "score": to_half(clamp(5 - 4 * min(1, max_similarity / threshold))),
            "reason": f"Closest earlier post has similarity {js_str(max_similarity)} (flag threshold {js_str(threshold)})." if max_similarity else "No similar earlier post.",
            "by": "rule",
        },
        "voice_fit": {"score": to_half(voice), "reason": voice_reason, "by": "rule"},
    }


SYSTEM = (
    "You are the Scorer for one creator's X draft. Traceability, novelty and voice fit are already measured by rules; do not rescore them. "
    "You judge two things only, against this creator's own writing: hook (would the first line make their followers stop, in their style, not generic engagement bait) and clarity (one idea per sentence, no filler). "
    "Use voice_profile and search_archive to compare with how they actually write. Scores 1-5, one-line reasons."
)


def scorer_model(job: AgentJob, rules: dict[str, Any]) -> dict[str, Any]:
    return run_model_agent(
        job.model_client(),
        model=job.model,
        system=SYSTEM,
        task=f"Measured scores: {to_json(rules)}. Score hook and clarity. Start with get_draft.",
        tools=build_tools(job.context, job.bridge),
        submit=SubmitSpec("submit_scores", "Submit hook and clarity scores (1-5) with one-line reasons, plus a short comment for the creator.", SCORER_JUDGMENT),
        trace=job.trace,
    )


def scorer_local(job: AgentJob, rules: dict[str, Any]) -> dict[str, Any]:
    call = LocalToolCaller(build_tools(job.context, job.bridge), job.trace)
    call("get_draft")
    profile = call("voice_profile")
    text = "\n\n".join(job.context["posts"])
    sentences = split_sentences(text)
    first = sentences[0] if sentences else ""
    pattern = opening_pattern(text)
    usual = pattern in (profile.get("top_hook_patterns") or [])
    first_words = word_count(first)
    hook = to_half(clamp(3 + (1 if usual else 0) + (0.5 if pattern in ("number", "question") else 0) + (0.5 if first_words <= 18 else -0.5)))

    lengths = [word_count(s) for s in sentences]
    sd = profile.get("sentence_words_sd")
    deviation = abs(mean(lengths) - (profile.get("mean_sentence_words") or 0)) / sd if sd else 0
    clarity = 4.5 - (2 if deviation > 2 else 1 if deviation > 1 else 0) - (0.5 if any(n > 35 for n in lengths) else 0)
    usual_words = profile.get("mean_sentence_words")
    return {
        "hook": {
            "score": hook,
            "reason": f"Opens with {OPENING[pattern]}{', one of your usual openings' if usual else ', not one of your usual openings'}; first sentence is {first_words} words.",
        },
        "clarity": {
            "score": to_half(clamp(clarity)),
            "reason": f"Sentences average {to_fixed(mean(lengths), 0)} words against your usual {js_str(usual_words) if usual_words is not None else 'unknown'}.",
        },
        "comment": "Opens the way you usually do." if hook >= 4 else "The opening is the weakest part; consider leading with your sharpest claim.",
    }


def combine(rules: dict[str, Any], judged: dict[str, Any]) -> dict[str, Any]:
    """The stored score: rule dimensions as measured, the two judged ones clamped to half points, overall the mean."""
    dimensions = {
        **rules,
        "hook": {**judged["hook"], "score": to_half(clamp(judged["hook"]["score"])), "by": "model"},
        "clarity": {**judged["clarity"], "score": to_half(clamp(judged["clarity"]["score"])), "by": "model"},
    }
    overall = tidy(js_round(mean(d["score"] for d in dimensions.values()) * 10) / 10)
    return {"dimensions": dimensions, "overall": overall, "comment": judged["comment"]}
