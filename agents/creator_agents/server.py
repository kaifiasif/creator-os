"""Internal HTTP service the web app calls to run an agent. Not for browsers and not for the internet.

  GET  /healthz              liveness, no auth
  POST /v1/agents/<agent>    run reviewer | scorer | decision for one draft (bearer token required)

It binds to 127.0.0.1 by default, every agent request needs the shared token, and bodies are capped.
The response is always the agent's output or its error, with the trace, so the web app can record either.
"""
from __future__ import annotations

import hmac
import json
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from .agents import AGENT_VERSIONS, run_agent
from .anthropic import AnthropicClient
from .bridge import HttpBridge
from .job import AgentJob
from .log import Logger
from .validation import ValidationError, validate

MAX_BODY_BYTES = 2_000_000

_JSON_OBJECT = {"type": "object"}
REQUEST_SCHEMA = {
    "type": "object",
    "properties": {
        "user_id": {"type": "string", "minLength": 1},
        "run_id": {"type": "string", "minLength": 1},
        "use_model": {"type": "boolean", "default": False},
        "model": {"type": "string", "minLength": 1},
        "context": {
            "type": "object",
            "properties": {
                "draft": _JSON_OBJECT,
                "claims": {"type": "array"},
                "posts": {"type": "array", "items": {"type": "string"}},
                "voice_profile": _JSON_OBJECT,
                "rule_facts": {
                    "type": "object",
                    "properties": {
                        "sentences": {"type": "array"},
                        "voice_score": _JSON_OBJECT,
                        "repetition_threshold": {"type": "number", "minimum": 0},
                    },
                    "required": ["sentences", "repetition_threshold"],
                },
            },
            "required": ["draft", "claims", "posts", "voice_profile", "rule_facts"],
        },
        "prior": {
            "type": "object",
            "properties": {"reviewer": _JSON_OBJECT, "scorer": _JSON_OBJECT},
            "default": {},
        },
        "tools": {
            "type": "object",
            "properties": {"url": {"type": "string", "minLength": 1}, "token": {"type": "string", "minLength": 16}},
            "required": ["url", "token"],
        },
    },
    "required": ["user_id", "run_id", "model", "context", "tools"],
}


class AgentServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address: tuple[str, int], *, token: str, client: AnthropicClient | None, log: Logger):
        super().__init__(address, Handler)
        self.token = token
        self.client = client
        self.log = log


class Handler(BaseHTTPRequestHandler):
    server: AgentServer
    server_version = "creator-agents"
    sys_version = ""
    timeout = 30  # seconds to send headers and body; a stalled client cannot hold a thread

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002 - silence the default access log; we log our own events
        return

    def _send(self, status: int, body: dict[str, Any]) -> None:
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _fail(self, status: HTTPStatus, code: str, message: str) -> None:
        self._send(status, {"error": {"code": code, "message": message}})

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/healthz":
            self._send(200, {"ok": True, "agents": AGENT_VERSIONS})
        else:
            self._fail(HTTPStatus.NOT_FOUND, "NOT_FOUND", "Not found.")

    def do_POST(self) -> None:  # noqa: N802
        prefix = "/v1/agents/"
        agent = self.path[len(prefix):] if self.path.startswith(prefix) else ""
        if agent not in AGENT_VERSIONS:
            return self._fail(HTTPStatus.NOT_FOUND, "NOT_FOUND", "Not found.")
        supplied = self.headers.get("authorization", "")
        if not hmac.compare_digest(supplied.encode(), f"Bearer {self.server.token}".encode()):
            return self._fail(HTTPStatus.UNAUTHORIZED, "UNAUTHORIZED", "Missing or wrong service token.")
        try:
            length = int(self.headers.get("content-length") or 0)
        except ValueError:
            length = -1
        if length <= 0 or length > MAX_BODY_BYTES:
            return self._fail(HTTPStatus.REQUEST_ENTITY_TOO_LARGE if length > MAX_BODY_BYTES else HTTPStatus.BAD_REQUEST, "BAD_REQUEST", "Body must be JSON under 2 MB.")
        try:
            body = validate(REQUEST_SCHEMA, json.loads(self.rfile.read(length)))
        except (ValueError, ValidationError) as error:
            return self._fail(HTTPStatus.BAD_REQUEST, "VALIDATION_FAILED", str(error)[:500])

        log = self.server.log.child(user_id=body["user_id"], run_id=body["run_id"], agent=agent)
        job = AgentJob(
            run_id=body["run_id"],
            context=body["context"],
            bridge=HttpBridge(body["tools"]["url"], body["tools"]["token"]),
            model=body["model"],
            client=self.server.client,
            prior=body["prior"],
        )
        started = time.monotonic()
        try:
            output = run_agent(agent, job, body["use_model"])
        except Exception as error:  # noqa: BLE001 - every agent failure is reported to the web app, which stores it on the agent's row
            log.error("agent_failed", error=str(error)[:500], error_name=type(error).__name__, steps=len(job.trace))
            return self._send(200, {"ok": False, "error": str(error), "trace": job.trace})
        log.info("agent_done", ms=round((time.monotonic() - started) * 1000), steps=len(job.trace))
        self._send(200, {"ok": True, "output": output, "trace": job.trace})
