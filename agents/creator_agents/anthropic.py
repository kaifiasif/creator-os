"""Minimal Anthropic Messages API client for the agents' tool loop, and the retry policy all model clients share.

The key is read from this process's environment only; it is never logged or returned. Retries live here
and nowhere else: twice, after 1s then 4s with jitter, and never for a request the API rejected as invalid.
"""
from __future__ import annotations

import json
import random
import time
import urllib.error
import urllib.request
from typing import Any, Callable, Protocol

from .http_headers import merge_headers

API_URL = "https://api.anthropic.com/v1/messages"
REQUEST_TIMEOUT_S = 90
DEFAULT_DELAYS_MS = [1000, 4000]


class AnthropicClient(Protocol):
    def messages(self, request: dict[str, Any]) -> dict[str, Any]: ...


# Groq's free tier often asks for ~60s; honour Retry-After up to a minute before giving up.
MAX_WAIT_S = 60
# Cloudflare in front of Groq (and others) blocks Python's default "Python-urllib/3.x" agent with
# 403 "error code: 1010", so every outbound request names itself.
USER_AGENT = "creator-os-agents/0.8.0"
BASE_HEADERS = {"content-type": "application/json", "accept": "application/json", "user-agent": USER_AGENT}


class ProviderError(RuntimeError):
    def __init__(self, message: str, retryable: bool, wait_s: float | None = None):
        super().__init__(message)
        self.retryable = retryable
        self.wait_s = wait_s


def retry_after(error: urllib.error.HTTPError) -> float | None:
    """The provider's own Retry-After, capped so one agent never waits more than a few seconds per try."""
    try:
        return min(float(error.headers.get("retry-after", "")), MAX_WAIT_S)
    except (TypeError, ValueError):
        return None


def blocked_message(vendor: str, detail: str) -> str | None:
    """A 403 from the provider's edge rather than the API (Cloudflare 1010/1020), in words the creator can act on."""
    if "1010" in detail or "1020" in detail or "cloudflare" in detail.lower():
        code = detail.strip().strip('"')[:40]
        return f"{vendor} blocked the request at its firewall (403, {code}). This is not a key problem: the provider's firewall refused this server. If it keeps happening, run from another network or host."
    return None


def rate_limit_message(vendor: str, status: int) -> str:
    if status == 413:
        return f"{vendor} refused the request as too large for the plan's per-minute token limit (413). Try a shorter draft, or a key with higher limits."
    return (
        f"{vendor} rate limit reached (429). Free plans allow only a few requests a minute: "
        "wait about a minute, then use Run agents again (agents that already finished are skipped)."
    )


def retry_delays(retry_delay_ms: int | None) -> list[float]:
    """RETRY_DELAY_MS scales the schedule the same way the web app does (0 in tests: no waiting)."""
    if retry_delay_ms is None:
        return [d / 1000 for d in DEFAULT_DELAYS_MS]
    return [(d / 1000) * retry_delay_ms / 1000 for d in DEFAULT_DELAYS_MS]


def with_retry(work: Callable[[], Any], delays_s: list[float], sleep: Callable[[float], None] = time.sleep) -> Any:
    for attempt in range(len(delays_s) + 1):
        try:
            return work()
        except ProviderError as error:
            if not error.retryable or attempt == len(delays_s):
                raise
            wait = error.wait_s
        except (urllib.error.URLError, TimeoutError):
            if attempt == len(delays_s):
                raise
            wait = None
        base = delays_s[attempt]
        # honour the provider's Retry-After (already capped); a zero schedule, as in tests, never waits
        jittered = base + random.random() * base * 0.2
        sleep(max(jittered, wait or 0) if base else 0)
    raise AssertionError("unreachable")


class HttpAnthropicClient:
    def __init__(self, api_key: str, delays_s: list[float]):
        self._api_key = api_key
        self._delays_s = delays_s

    def __repr__(self) -> str:  # never show the key
        return "HttpAnthropicClient()"

    def messages(self, request: dict[str, Any]) -> dict[str, Any]:
        body = json.dumps({"max_tokens": 4096, **request}).encode()

        def call() -> dict[str, Any]:
            req = urllib.request.Request(
                API_URL,
                data=body,
                method="POST",
                headers=merge_headers(
                    {
                        "content-type": "application/json",
                        "x-api-key": self._api_key,
                        "anthropic-version": "2023-06-01",
                    },
                ),
            )
            try:
                with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_S) as res:
                    return json.loads(res.read())
            except urllib.error.HTTPError as error:
                detail = error.read()[:300].decode("utf-8", "replace")
                if error.code == 429:
                    raise ProviderError(rate_limit_message("Anthropic", 429), retryable=True, wait_s=retry_after(error)) from error
                if error.code == 403 and (blocked := blocked_message("Anthropic", detail)):
                    raise ProviderError(blocked, retryable=False) from error
                retryable = error.code >= 500 or error.code == 408
                raise ProviderError(f"Anthropic {error.code}: {detail}", retryable) from error

        return with_retry(call, self._delays_s)
