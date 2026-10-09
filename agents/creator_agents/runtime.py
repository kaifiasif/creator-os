"""Agent loop: the model plans, calls tools, sees results, and finishes by calling its submit tool.

Every tool call is recorded in a trace so the creator can see what the agent looked at. Retries live in
the model clients only (anthropic.py, openai_compat.py); this loop never retries a request itself.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .anthropic import AnthropicClient
from .jsnum import to_json
from .tools import AgentTool
from .validation import ValidationError, public_schema, validate

MAX_STEPS = 8
TRACE_RESULT_CHARS = 400

Trace = list[dict[str, Any]]


@dataclass(frozen=True)
class SubmitSpec:
    name: str
    description: str
    schema: dict[str, Any]


class AgentError(RuntimeError):
    """An agent could not produce a result. The message is stored on the agent's row."""


def summarize(value: Any) -> Any:
    """Keeps traces small: long tool results are cut, not dropped."""
    text = to_json(value)
    return f"{text[:TRACE_RESULT_CHARS]}…" if len(text) > TRACE_RESULT_CHARS else value


def _tool_schema(name: str, description: str, schema: dict[str, Any]) -> dict[str, Any]:
    return {"name": name, "description": description, "input_schema": public_schema(schema)}


def run_model_agent(
    client: AnthropicClient,
    *,
    model: str,
    system: str,
    task: str,
    tools: list[AgentTool],
    submit: SubmitSpec,
    trace: Trace,
    max_steps: int = MAX_STEPS,
) -> dict[str, Any]:
    by_name = {t.name: t for t in tools}
    schemas = [_tool_schema(t.name, t.description, t.input_schema) for t in tools] + [_tool_schema(submit.name, submit.description, submit.schema)]
    messages: list[dict[str, Any]] = [{"role": "user", "content": task}]

    for step in range(max_steps):
        response = client.messages({"model": model, "system": system, "tools": schemas, "messages": messages})
        content = response.get("content", [])
        messages.append({"role": "assistant", "content": content})
        thought = " ".join(b["text"] for b in content if b.get("type") == "text").strip()
        if thought:
            trace.append({"step": step, "kind": "thought", "text": thought[:600]})

        calls = [b for b in content if b.get("type") == "tool_use"]
        if not calls:
            messages.append({"role": "user", "content": f"Call {submit.name} with your result."})
            continue

        results: list[dict[str, Any]] = []
        for call in calls:
            if call["name"] == submit.name:
                try:
                    output = validate(submit.schema, call.get("input"))
                except ValidationError as error:
                    problem = str(error)
                    trace.append({"step": step, "kind": "submit_rejected", "tool": call["name"], "error": problem})
                    results.append({"type": "tool_result", "tool_use_id": call["id"], "is_error": True, "content": f"Invalid submission: {problem}"})
                    continue
                trace.append({"step": step, "kind": "submit", "tool": call["name"]})
                return output
            tool = by_name.get(call["name"])
            try:
                if tool is None:
                    raise AgentError(f"Unknown tool {call['name']}")
                result = tool.call(call.get("input"))
                trace.append({"step": step, "kind": "tool", "tool": call["name"], "input": call.get("input"), "result": summarize(result)})
                results.append({"type": "tool_result", "tool_use_id": call["id"], "content": to_json(result)})
            except Exception as error:  # noqa: BLE001 - any tool failure is reported back to the model, which can try something else
                failure = {"error": str(error)}
                trace.append({"step": step, "kind": "tool", "tool": call["name"], "input": call.get("input"), "result": failure, "error": True})
                results.append({"type": "tool_result", "tool_use_id": call["id"], "is_error": True, "content": to_json(failure)})
        messages.append({"role": "user", "content": results})
    raise AgentError(f"Agent did not submit a result within {max_steps} steps.")


class LocalToolCaller:
    """Local agents use the same tools and trace format, with a fixed plan instead of a model."""

    def __init__(self, tools: list[AgentTool], trace: Trace):
        self._by_name = {t.name: t for t in tools}
        self._trace = trace
        self._step = 0

    def __call__(self, name: str, payload: dict[str, Any] | None = None) -> Any:
        tool = self._by_name.get(name)
        if tool is None:
            raise AgentError(f"Unknown tool {name}")
        payload = payload or {}
        output = tool.call(payload)
        self._trace.append({"step": self._step, "kind": "tool", "tool": name, "input": payload, "result": summarize(output)})
        self._step += 1
        return output
