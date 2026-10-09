"""Tool calling over any OpenAI-compatible chat API (Groq's free tier by default).

The agents' loop speaks the Anthropic Messages shape; this client translates each request to
/chat/completions with function tools and translates the reply back, so the loop, the traces and
the validation stay the same whichever model runs.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from .anthropic import BASE_HEADERS, ProviderError, blocked_message, rate_limit_message, retry_after, with_retry

REQUEST_TIMEOUT_S = 90
# reasoning models spend part of the budget thinking before they call a tool
MAX_TOKENS = 8192


def to_chat_request(request: dict[str, Any]) -> dict[str, Any]:
    messages: list[dict[str, Any]] = [{"role": "system", "content": request["system"]}]
    for message in request["messages"]:
        content = message["content"]
        if isinstance(content, str):
            messages.append({"role": message["role"], "content": content})
        elif message["role"] == "assistant":
            text = " ".join(b["text"] for b in content if b.get("type") == "text").strip()
            calls = [
                {"id": b["id"], "type": "function", "function": {"name": b["name"], "arguments": json.dumps(b.get("input") or {})}}
                for b in content
                if b.get("type") == "tool_use"
            ]
            entry: dict[str, Any] = {"role": "assistant", "content": text or None}
            if calls:
                entry["tool_calls"] = calls
            messages.append(entry)
        else:
            for block in content:
                if block.get("type") == "tool_result":
                    messages.append({"role": "tool", "tool_call_id": block["tool_use_id"], "content": block["content"]})
    chat: dict[str, Any] = {"model": request["model"], "max_tokens": request.get("max_tokens", MAX_TOKENS), "messages": messages}
    if request.get("tools"):
        chat["tools"] = [
            {"type": "function", "function": {"name": t["name"], "description": t["description"], "parameters": t["input_schema"]}} for t in request["tools"]
        ]
        chat["tool_choice"] = "auto"
    return chat


def from_chat_response(body: dict[str, Any]) -> dict[str, Any]:
    choices = body.get("choices") or []
    if not choices:
        raise ProviderError("The model returned no answer.", retryable=True)
    message = choices[0].get("message") or {}
    content: list[dict[str, Any]] = []
    if message.get("content"):
        content.append({"type": "text", "text": message["content"]})
    for call in message.get("tool_calls") or []:
        try:
            arguments = json.loads(call["function"].get("arguments") or "{}")
        except ValueError:
            arguments = None  # fails validation, and the model is told so and can try again
        content.append({"type": "tool_use", "id": call["id"], "name": call["function"]["name"], "input": arguments if isinstance(arguments, dict) else {"_invalid_json": True}})
    return {"content": content, "stop_reason": choices[0].get("finish_reason") or "stop"}


class OpenAICompatibleClient:
    def __init__(self, api_key: str, base_url: str, delays_s: list[float]):
        self._api_key = api_key
        self._url = base_url.rstrip("/") + "/chat/completions"
        self._vendor = urllib.parse.urlparse(self._url).hostname or "model"
        self._delays_s = delays_s

    def __repr__(self) -> str:  # never show the key
        return f"OpenAICompatibleClient({self._vendor!r})"

    def messages(self, request: dict[str, Any]) -> dict[str, Any]:
        body = json.dumps(to_chat_request(request)).encode()

        def call() -> dict[str, Any]:
            req = urllib.request.Request(
                self._url,
                data=body,
                method="POST",
                headers={**BASE_HEADERS, "authorization": f"Bearer {self._api_key}"},
            )
            try:
                with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_S) as res:
                    return from_chat_response(json.loads(res.read()))
            except urllib.error.HTTPError as error:
                detail = error.read()[:300].decode("utf-8", "replace")
                if error.code in (413, 429):
                    raise ProviderError(rate_limit_message(self._vendor, error.code), retryable=error.code == 429, wait_s=retry_after(error)) from error
                if error.code == 403 and (blocked := blocked_message(self._vendor, detail)):
                    raise ProviderError(blocked, retryable=False) from error
                if error.code in (401, 403):
                    raise ProviderError(f"{self._vendor} refused the key ({error.code}). Check LLM_API_KEY and LLM_BASE_URL.", retryable=False) from error
                retryable = error.code >= 500 or error.code == 408
                raise ProviderError(f"{self._vendor} {error.code}: {detail}", retryable) from error

        return with_retry(call, self._delays_s)
