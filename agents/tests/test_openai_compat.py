"""The agents on an OpenAI-compatible API (Groq's free tier), against a local stub of /chat/completions."""
import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from creator_agents.anthropic import ProviderError
from creator_agents.openai_compat import OpenAICompatibleClient, from_chat_response, to_chat_request
from creator_agents.runtime import SubmitSpec, run_model_agent
from creator_agents.tools import AgentTool


class Stub(BaseHTTPRequestHandler):
    """Answers each POST with the next scripted (status, body, headers) and records what it was sent."""

    script: list = []
    seen: list = []

    def log_message(self, *args):
        return

    def do_POST(self):  # noqa: N802
        length = int(self.headers["content-length"])
        Stub.seen.append({"path": self.path, "auth": self.headers["authorization"], "agent": self.headers["user-agent"], "accept": self.headers["accept"], "body": json.loads(self.rfile.read(length))})
        status, body, headers = Stub.script.pop(0)
        data = json.dumps(body).encode()
        self.send_response(status)
        for k, v in headers.items():
            self.send_header(k, v)
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def reply(content=None, calls=()):
    message = {"role": "assistant", "content": content}
    if calls:
        message["tool_calls"] = [{"id": i, "type": "function", "function": {"name": n, "arguments": a}} for i, n, a in calls]
    return (200, {"choices": [{"message": message, "finish_reason": "tool_calls" if calls else "stop"}]}, {})


class OpenAICompatibleTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Stub)
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}/openai/v1"
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        Stub.script, Stub.seen = [], []
        self.client = OpenAICompatibleClient("free-key-123", self.base, [0, 0])

    def test_runs_the_tool_loop_with_function_calls(self):
        echo = AgentTool("echo", "echo", {"type": "object", "properties": {"x": {"type": "number"}}, "required": ["x"]}, lambda i: {"got": i["x"]})
        submit = SubmitSpec("submit", "submit", {"type": "object", "properties": {"answer": {"type": "string", "minLength": 1}}, "required": ["answer"]})
        Stub.script = [reply("Checking.", [("c1", "echo", '{"x": 2}')]), reply(None, [("c2", "submit", '{"answer": "done"}')])]
        trace = []
        out = run_model_agent(self.client, model="openai/gpt-oss-120b", system="sys", task="go", tools=[echo], submit=submit, trace=trace)

        self.assertEqual(out, {"answer": "done"})
        self.assertEqual([t["kind"] for t in trace], ["thought", "tool", "submit"])
        first, second = Stub.seen[0], Stub.seen[1]
        self.assertEqual(first["path"], "/openai/v1/chat/completions")
        self.assertEqual(first["auth"], "Bearer free-key-123")
        # Cloudflare in front of Groq answers Python's default agent with 403 "error code: 1010"
        self.assertTrue(first["agent"].startswith("creator-os-agents/"))
        self.assertEqual(first["accept"], "application/json")
        self.assertEqual(first["body"]["messages"][0], {"role": "system", "content": "sys"})
        self.assertEqual([t["function"]["name"] for t in first["body"]["tools"]], ["echo", "submit"])
        # the tool result goes back as a role=tool message tied to the call id
        self.assertEqual(second["body"]["messages"][-1], {"role": "tool", "tool_call_id": "c1", "content": '{"got":2}'})
        self.assertEqual(second["body"]["messages"][-2]["tool_calls"][0]["function"]["name"], "echo")

    def test_rate_limits_are_retried_then_explained(self):
        limited = (429, {"error": {"message": "Rate limit reached"}}, {"retry-after": "0"})
        Stub.script = [limited, reply("ok")]
        self.assertEqual(self.client.messages({"model": "m", "system": "s", "messages": [{"role": "user", "content": "hi"}]})["content"][0]["text"], "ok")

        Stub.script = [limited, limited, limited]
        with self.assertRaises(ProviderError) as caught:
            self.client.messages({"model": "m", "system": "s", "messages": [{"role": "user", "content": "hi"}]})
        self.assertIn("rate limit reached (429)", str(caught.exception))
        self.assertIn("Run agents again", str(caught.exception))
        self.assertNotIn("free-key-123", str(caught.exception))

    def test_a_request_too_large_for_the_plan_is_not_retried(self):
        Stub.script = [(413, {"error": {"message": "Request too large"}}, {})]
        with self.assertRaisesRegex(ProviderError, "too large"):
            self.client.messages({"model": "m", "system": "s", "messages": [{"role": "user", "content": "hi"}]})
        self.assertEqual(len(Stub.seen), 1)

    def test_a_firewall_block_is_explained_and_not_retried(self):
        Stub.script = [(403, "error code: 1010", {})]
        with self.assertRaisesRegex(ProviderError, r"blocked the request at its firewall \(403, error code: 1010\)"):
            self.client.messages({"model": "m", "system": "s", "messages": [{"role": "user", "content": "hi"}]})
        self.assertEqual(len(Stub.seen), 1)

        Stub.script = [(401, {"error": {"message": "Invalid API Key"}}, {})]
        with self.assertRaisesRegex(ProviderError, "refused the key \\(401\\). Check LLM_API_KEY"):
            self.client.messages({"model": "m", "system": "s", "messages": [{"role": "user", "content": "hi"}]})

    def test_bad_arguments_reach_validation_instead_of_crashing(self):
        out = from_chat_response({"choices": [{"message": {"content": None, "tool_calls": [{"id": "a", "function": {"name": "t", "arguments": "{not json"}}]}}]})
        self.assertEqual(out["content"][0]["input"], {"_invalid_json": True})
        self.assertNotIn("tools", to_chat_request({"model": "m", "system": "s", "messages": []}))

    def test_the_key_never_shows_in_its_repr(self):
        self.assertNotIn("free-key-123", repr(self.client))


if __name__ == "__main__":
    unittest.main()
