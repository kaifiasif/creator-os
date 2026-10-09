"""The HTTP service: health, the token, request validation, and agent failures reported with their trace."""
import json
import threading
import unittest
import urllib.error
import urllib.request

from creator_agents.log import Logger
from creator_agents.server import AgentServer

TOKEN = "t" * 40


class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = AgentServer(("127.0.0.1", 0), token=TOKEN, client=None, log=Logger(enabled=False))
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def post(self, path, body, token=TOKEN):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        req = urllib.request.Request(self.base + path, data=data, method="POST", headers={"authorization": f"Bearer {token}", "content-type": "application/json"})
        try:
            with urllib.request.urlopen(req) as res:
                return res.status, json.loads(res.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def request_body(self, use_model=False):
        return {
            "user_id": "u1",
            "run_id": "r1",
            "use_model": use_model,
            "model": "m",
            "context": {
                "draft": {"posts": [], "channel": []},
                "claims": [],
                "posts": [],
                "voice_profile": {},
                "rule_facts": {"sentences": [], "repetition_threshold": 0.8},
            },
            "prior": {"scorer": {"overall": 4, "dimensions": {}}},
            "tools": {"url": "http://127.0.0.1:9/tools", "token": "b" * 32},
        }

    def test_health_needs_no_token(self):
        with urllib.request.urlopen(self.base + "/healthz") as res:
            self.assertEqual(json.loads(res.read())["agents"]["scorer"], "scorer@1")

    def test_agent_calls_need_the_token(self):
        self.assertEqual(self.post("/v1/agents/decision", self.request_body(), token="wrong")[0], 401)
        self.assertEqual(self.post("/v1/agents/unknown", self.request_body())[0], 404)

    def test_bad_requests_are_rejected_before_any_agent_runs(self):
        status, body = self.post("/v1/agents/decision", {"user_id": "u1"})
        self.assertEqual((status, body["error"]["code"]), (400, "VALIDATION_FAILED"))
        self.assertEqual(self.post("/v1/agents/decision", b"not json")[0], 400)

    def test_runs_an_agent_and_returns_its_trace(self):
        status, body = self.post("/v1/agents/decision", self.request_body())
        self.assertEqual(status, 200)
        self.assertTrue(body["ok"])
        self.assertEqual(body["output"]["recommendation"], "accept")
        self.assertEqual([t["tool"] for t in body["trace"]], ["get_review", "get_scores"])

    def test_an_agent_failure_comes_back_as_a_result_not_a_crash(self):
        status, body = self.post("/v1/agents/decision", self.request_body(use_model=True))
        self.assertEqual(status, 200)
        self.assertEqual(body, {"ok": False, "error": "No model is configured: set ANTHROPIC_API_KEY or LLM_API_KEY.", "trace": []})


if __name__ == "__main__":
    unittest.main()
