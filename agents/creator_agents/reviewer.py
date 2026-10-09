"""Reviewer: finds problems and proposes minimal fixes, verifying each one with the real checks."""
from __future__ import annotations

import re
from typing import Any

from .jsnum import ensure_period, js_str, plural
from .job import AgentJob
from .runtime import LocalToolCaller, SubmitSpec, run_model_agent
from .schemas import REVIEW_SUBMISSION
from .tools import build_tools

SYSTEM = (
    "You are the Reviewer for one creator's X draft. Read the draft and its check results, then find every problem: sentences not backed by the creator's claims, repeats of earlier posts, sentences that drift from the creator's voice, unclear sentences, and channel issues. "
    "For each, propose the smallest fix that keeps the creator's own words: rewrite using only claims from get_claims, attribute other speakers, or remove the sentence. Never add facts, numbers or opinions. "
    "Verify every replacement with check_sentence before you submit it, and check the full revised draft with check_posts. Only submit a replacement whose check passes; otherwise propose removal or keep with a note."
)


def reviewer_model(job: AgentJob) -> dict[str, Any]:
    return run_model_agent(
        job.model_client(),
        model=job.model,
        system=SYSTEM,
        task="Review the draft. Start with get_draft and get_claims.",
        tools=build_tools(job.context, job.bridge),
        submit=SubmitSpec("submit_review", "Submit the review. revised_posts is the full draft with your fixes applied.", REVIEW_SUBMISSION),
        trace=job.trace,
    )


def _candidate(claim: dict[str, Any]) -> str:
    if claim["is_creator"]:
        return ensure_period(claim["text"])
    return f"As {claim['speaker']} put it, \"{re.sub(r'[.!]$', '', claim['text'])}.\""


def reviewer_local(job: AgentJob) -> dict[str, Any]:
    """Fixed plan, same tools: repeats are removed, unsupported sentences rewritten from their cited claim if that passes."""
    call = LocalToolCaller(build_tools(job.context, job.bridge), job.trace)
    draft = call("get_draft")
    claims = {c["id"]: c for c in call("get_claims")}
    sentences = [s for p in draft["posts"] for s in p["sentences"]]
    in_draft = {s["text"] for s in sentences}
    issues: list[dict[str, Any]] = []
    replacements: dict[str, str | None] = {}

    for sentence in sentences:
        c = sentence.get("checks")
        if not c:
            continue
        if c.get("repeat"):
            repeat = c["repeat"]
            what = "Matches an angle you retired" if repeat.get("severity") == "high" else "Close to your post"
            published = repeat.get("published_at")
            issues.append({
                "sentence_id": sentence["id"],
                "problem": "repeat",
                "action": "remove",
                "note": f"{what} from {js_str(published[:10] if published else None)} (similarity {js_str(repeat.get('similarity'))}). Remove it, or keep it as a deliberate callback.",
            })
            replacements[sentence["id"]] = None
        elif c["traceability"] != "supported":
            fix: dict[str, Any] | None = None
            for claim in (claims[i] for i in sentence["supports"] if i in claims):
                candidate = _candidate(claim)
                if candidate in in_draft:
                    continue  # would only repeat another sentence
                if call("check_sentence", {"text": candidate, "supports": [claim["id"]]})["passes"]:
                    fix = {"text": candidate, "supports": [claim["id"]]}
                    break
            issue: dict[str, Any] = {"sentence_id": sentence["id"], "problem": c["traceability"], "action": "replace" if fix else "remove"}
            if fix:
                issue.update(replacement=fix["text"], supports=fix["supports"], note="Rewritten to say only what the cited claim says.")
            else:
                issue["note"] = f"{c['reason']} Nothing you said backs it, so remove it."
            issues.append(issue)
            replacements[sentence["id"]] = fix["text"] if fix else None
        elif c.get("voice"):
            issues.append({"sentence_id": sentence["id"], "problem": "voice", "action": "keep", "note": f"Unusual for you: {', '.join(c['voice'])}. Read it aloud before keeping it."})

    for channel in (x for x in draft["channel"] if not x["ok"]):
        position = channel["position"] - 1
        post = draft["posts"][position] if 0 <= position < len(draft["posts"]) else None
        if post and post["sentences"]:
            issues.append({"sentence_id": post["sentences"][0]["id"], "problem": "channel", "action": "keep", "note": " ".join(channel["issues"])})

    revised_posts = [
        " ".join(t for t in (replacements.get(s["id"]) if s["id"] in replacements else s["text"] for s in p["sentences"]) if t)
        for p in draft["posts"]
    ]
    revised_posts = [p for p in revised_posts if p]
    fixes = sum(1 for i in issues if i["action"] != "keep")
    if fixes:
        call("check_posts", {"posts": revised_posts})
    summary = (
        f"{plural(len(issues), 'issue')} found; {plural(fixes, 'fix', 'fixes')} proposed and checked."
        if issues
        else "Nothing to fix. Every sentence is backed, new, and within your usual range."
    )
    return {"summary": summary, "issues": issues, "revised_posts": revised_posts}
