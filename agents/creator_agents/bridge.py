"""Calls back to the web app for the tools that need the creator's data: the checks and the archive.

Each agent pass gets its own short-lived token from the web app. The token is bound there to one creator
and one run, so nothing sent from here can reach another creator's data.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Protocol

from .anthropic import BASE_HEADERS

BRIDGE_TIMEOUT_S = 60


class ToolError(RuntimeError):
    """A tool refused or failed; the message goes back to the model, which can try something else."""


class Bridge(Protocol):
    def call(self, tool: str, payload: dict[str, Any]) -> Any: ...


class HttpBridge:
    def __init__(self, url: str, token: str):
        self._url = url.rstrip("/")
        self._token = token

    def __repr__(self) -> str:
        return f"HttpBridge({self._url!r})"

    def call(self, tool: str, payload: dict[str, Any]) -> Any:
        req = urllib.request.Request(
            f"{self._url}/{tool}",
            data=json.dumps(payload).encode(),
            method="POST",
            headers={**BASE_HEADERS, "authorization": f"Bearer {self._token}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=BRIDGE_TIMEOUT_S) as res:
                return json.loads(res.read())["result"]
        except urllib.error.HTTPError as error:
            try:
                message = json.loads(error.read()).get("error") or f"HTTP {error.code}"
            except ValueError:
                message = f"HTTP {error.code}"
            raise ToolError(message) from error
