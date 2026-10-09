"""Structured JSON logs on stderr, one object per line. Secrets are redacted by key name."""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from typing import Any

_SECRET_KEY = re.compile(r"authorization|cookie|api[_-]?key|token|secret|password", re.IGNORECASE)


def _redact(value: Any, depth: int = 0) -> Any:
    if depth > 3:
        return value
    if isinstance(value, dict):
        return {k: "[redacted]" if _SECRET_KEY.search(k) else _redact(v, depth + 1) for k, v in value.items()}
    if isinstance(value, list):
        return [_redact(v, depth + 1) for v in value]
    return value


class Logger:
    def __init__(self, base: dict[str, Any] | None = None, enabled: bool = True):
        self.base = base or {}
        self.enabled = enabled

    def _write(self, level: str, event: str, fields: dict[str, Any]) -> None:
        if not self.enabled:
            return
        line = {"t": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"), "level": level, "event": event}
        line.update(_redact({**self.base, **fields}))
        sys.stderr.write(json.dumps(line, default=str) + "\n")
        sys.stderr.flush()

    def info(self, event: str, **fields: Any) -> None:
        self._write("info", event, fields)

    def warn(self, event: str, **fields: Any) -> None:
        self._write("warn", event, fields)

    def error(self, event: str, **fields: Any) -> None:
        self._write("error", event, fields)

    def child(self, **fields: Any) -> "Logger":
        return Logger({**self.base, **fields}, self.enabled)
