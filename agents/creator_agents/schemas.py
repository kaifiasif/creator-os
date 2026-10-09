"""What agents submit, and what their tools accept. Each schema is shown to the model and enforced."""
from __future__ import annotations

REVIEW_PROBLEMS = ["unsupported", "partial", "repeat", "voice", "clarity", "channel"]
REJECT_REASONS = ["not_me", "wrong_claim", "repeat", "not_worth_posting", "other"]

_TEXT = {"type": "string", "minLength": 1, "x-trim": True}
_EMPTY = {"type": "object", "properties": {}}

REVIEW_SUBMISSION = {
    "type": "object",
    "properties": {
        "summary": {**_TEXT, "description": "One or two sentences for the creator."},
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "sentence_id": {"type": "string", "minLength": 1},
                    "problem": {"type": "string", "enum": REVIEW_PROBLEMS},
                    "action": {"type": "string", "enum": ["replace", "remove", "keep"]},
                    "replacement": _TEXT,
                    "supports": {"type": "array", "items": {"type": "string"}},
                    "note": {"type": "string"},
                },
                "required": ["sentence_id", "problem", "action", "note"],
                "x-require-if": [{"field": "action", "equals": "replace", "require": "replacement", "message": "replace needs replacement text"}],
            },
        },
        "revised_posts": {"type": "array", "items": {"type": "string"}, "description": "The full draft with your fixes applied."},
    },
    "required": ["summary", "issues", "revised_posts"],
}

_SCORED = {
    "type": "object",
    "properties": {"score": {"type": "number", "minimum": 1, "maximum": 5}, "reason": _TEXT},
    "required": ["score", "reason"],
}

SCORER_JUDGMENT = {
    "type": "object",
    "properties": {"hook": _SCORED, "clarity": _SCORED, "comment": _TEXT},
    "required": ["hook", "clarity", "comment"],
}

DECISION_PREDICTION = {
    "type": "object",
    "properties": {
        "recommendation": {"type": "string", "enum": ["accept", "edit", "reject"]},
        "reject_reason": {"type": "string", "enum": REJECT_REASONS},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "rationale": _TEXT,
    },
    "required": ["recommendation", "confidence", "rationale"],
    "x-require-if": [
        {"field": "recommendation", "equals": "reject", "require": "reject_reason", "message": f"reject needs reject_reason: {', '.join(REJECT_REASONS)}"}
    ],
}

# ---------------------------------------------------------------- tool inputs
TOOL_INPUTS = {
    "get_draft": _EMPTY,
    "get_claims": _EMPTY,
    "voice_profile": _EMPTY,
    "get_review": _EMPTY,
    "get_scores": _EMPTY,
    "search_archive": {
        "type": "object",
        "properties": {
            "text": {"type": "string", "minLength": 1},
            "k": {"type": "integer", "minimum": 1, "maximum": 5, "default": 3},
        },
        "required": ["text"],
    },
    "check_sentence": {
        "type": "object",
        "properties": {
            "text": {"type": "string", "minLength": 1},
            "supports": {"type": "array", "items": {"type": "string"}, "default": []},
            "type": {"type": "string", "enum": ["assertion", "connective"], "default": "assertion"},
        },
        "required": ["text"],
    },
    "check_posts": {
        "type": "object",
        "properties": {"posts": {"type": "array", "items": {"type": "string"}}},
        "required": ["posts"],
    },
}
