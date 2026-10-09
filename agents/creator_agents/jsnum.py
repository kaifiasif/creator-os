"""Number and text helpers that match the web app's JavaScript output exactly.

Scores and notes are compared across the Node and Python sides and shown to the creator, so rounding
and number formatting follow JavaScript rules (Math.round, toFixed, String(number)), not Python's.
"""
from __future__ import annotations

import json
import math
import re
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Iterable


def js_round(x: float) -> int:
    """Math.round: halves go up (towards +infinity), unlike Python's round-half-even."""
    return math.floor(x + 0.5)


def tidy(x: float) -> int | float:
    """A whole float becomes an int, so it prints and serialises as JavaScript would (5, not 5.0)."""
    return int(x) if isinstance(x, float) and x.is_integer() else x


def to_half(x: float) -> int | float:
    return tidy(js_round(x * 2) / 2)


def clamp(x: float, lo: float = 1, hi: float = 5) -> float:
    return max(lo, min(hi, x))


def mean(xs: Iterable[float]) -> float:
    values = list(xs)
    return sum(values) / len(values) if values else 0


def js_str(x: Any) -> str:
    """String(x) for the values agents put in notes: numbers, strings, None as 'undefined'."""
    if x is None:
        return "undefined"
    if isinstance(x, bool):
        return "true" if x else "false"
    if isinstance(x, float):
        return str(tidy(x)) if x.is_integer() else repr(x)
    return str(x)


def to_fixed(x: float, digits: int) -> str:
    """Number.prototype.toFixed: rounds the exact binary value, ties away from zero."""
    quantum = Decimal(1).scaleb(-digits)
    return str(Decimal(x).quantize(quantum, rounding=ROUND_HALF_UP))


def plural(n: int, one: str, many: str | None = None) -> str:
    return f"{n} {one if n == 1 else (many or one + 's')}"


def to_json(value: Any) -> str:
    """JSON.stringify: compact, unicode kept, whole floats written as integers."""
    return json.dumps(_tidy_tree(value), separators=(",", ":"), ensure_ascii=False)


def _tidy_tree(value: Any) -> Any:
    if isinstance(value, float):
        return tidy(value)
    if isinstance(value, dict):
        return {k: _tidy_tree(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_tidy_tree(v) for v in value]
    return value


# ---------------------------------------------------------------- text (mirrors src/domain/text.ts)
_SENTENCE = re.compile(r"[^.!?]+(?:[.!?]+[\"')\]]*|$)")


def split_sentences(text: str) -> list[str]:
    out: list[str] = []
    for para in re.split(r"\n+", text):
        out.extend(p.strip() for p in _SENTENCE.findall(para))
    return [p for p in out if p]


def word_count(text: str) -> int:
    """text.split(/\\s+/).length, including the empty piece a leading space produces."""
    return len(re.split(r"\s+", text))


def opening_pattern(text: str) -> str:
    sentences = split_sentences(text)
    first = sentences[0] if sentences else ""
    if re.search(r"\?\s*$", first):
        return "question"
    if re.match(r"\s*[\d$]", first, re.ASCII) or re.search(r"\b\d+\b", first[:25], re.ASCII):
        return "number"
    if re.match(r"\s*(i|we|my|last|yesterday|today|this week|when i|years? ago)\b", first, re.ASCII | re.IGNORECASE):
        return "story"
    if word_count(first) <= 14:
        return "claim"
    return "other"


def ensure_period(t: str) -> str:
    t = t.strip()
    return t if re.search(r"[.!?\"]$", t) else f"{t}."
