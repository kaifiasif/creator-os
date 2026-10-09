"""The Claude tool loop, with a fake client: tool calls, rejected submissions, failures, the step limit."""
import copy
import unittest

from creator_agents.runtime import AgentError, LocalToolCaller, SubmitSpec, run_model_agent, summarize
from creator_agents.tools import AgentTool

ECHO = AgentTool("echo", "echo", {"type": "object", "properties": {"x": {"type": "number"}}, "required": ["x"]}, lambda i: {"got": i["x"]})
SUBMIT = SubmitSpec("submit", "submit", {"type": "object", "properties": {"answer": {"type": "string", "minLength": 1}}, "required": ["answer"]})


class FakeClient:
    def __init__(self, replies):
        self.replies = replies
        self.requests = []

    def messages(self, request):
        self.requests.append(copy.deepcopy(request))
        return {"content": self.replies[len(self.requests) - 1], "stop_reason": "tool_use"}


def run(client, tools=(ECHO,), max_steps=8):
    trace = []
    out = run_model_agent(client, model="m", system="s", task="t", tools=list(tools), submit=SUBMIT, trace=trace, max_steps=max_steps)
    return out, trace


class ClaudeLoopTest(unittest.TestCase):
    def test_calls_tools_rejects_an_invalid_submission_then_submits(self):
        client = FakeClient([
            [{"type": "text", "text": "Looking at the draft."}, {"type": "tool_use", "id": "t1", "name": "echo", "input": {"x": 1}}],
            [{"type": "tool_use", "id": "t2", "name": "submit", "input": {"answer": ""}}],
            [{"type": "tool_use", "id": "t3", "name": "submit", "input": {"answer": "done"}}],
        ])
        out, trace = run(client)
        self.assertEqual(out, {"answer": "done"})
        self.assertEqual([t["kind"] for t in trace], ["thought", "tool", "submit_rejected", "submit"])
        self.assertEqual(len(client.requests[0]["tools"]), 2)
        self.assertEqual(client.requests[0]["tools"][1]["input_schema"]["type"], "object")
        self.assertEqual(client.requests[1]["messages"][-1]["content"][0]["content"], '{"got":1}')
        self.assertIn("Invalid submission: answer: too short", str(client.requests[2]["messages"][-1]))

    def test_a_failing_or_unknown_tool_is_reported_to_the_model(self):
        boom = AgentTool("boom", "fails", {"type": "object", "properties": {}}, lambda _: 1 / 0)
        client = FakeClient([
            [{"type": "tool_use", "id": "a", "name": "boom", "input": {}}, {"type": "tool_use", "id": "b", "name": "nope", "input": {}}],
            [{"type": "tool_use", "id": "c", "name": "echo", "input": {"x": "not a number"}}],
            [{"type": "tool_use", "id": "d", "name": "submit", "input": {"answer": "ok"}}],
        ])
        out, trace = run(client, tools=(ECHO, boom))
        self.assertEqual(out, {"answer": "ok"})
        self.assertEqual([t.get("error") for t in trace[:3]], [True, True, True])
        results = client.requests[1]["messages"][-1]["content"]
        self.assertTrue(all(r["is_error"] for r in results))
        self.assertIn("Unknown tool nope", results[1]["content"])

    def test_no_tool_call_gets_a_nudge_and_the_step_limit_ends_the_loop(self):
        client = FakeClient([[{"type": "text", "text": "thinking"}]] * 3)
        with self.assertRaisesRegex(AgentError, "within 3 steps"):
            run(client, max_steps=3)
        self.assertEqual(client.requests[1]["messages"][-1], {"role": "user", "content": "Call submit with your result."})

    def test_schemas_sent_to_the_model_have_no_private_keywords(self):
        from creator_agents.schemas import REVIEW_SUBMISSION
        from creator_agents.runtime import _tool_schema

        self.assertNotIn("x-", str(_tool_schema("s", "d", REVIEW_SUBMISSION)))


class TraceTest(unittest.TestCase):
    def test_long_results_are_cut_not_dropped(self):
        self.assertEqual(summarize({"a": 1}), {"a": 1})
        cut = summarize({"text": "x" * 1000})
        self.assertTrue(cut.endswith("…") and len(cut) == 401)

    def test_local_caller_numbers_steps_and_validates_input(self):
        trace = []
        call = LocalToolCaller([ECHO], trace)
        self.assertEqual(call("echo", {"x": 2}), {"got": 2})
        self.assertEqual(trace, [{"step": 0, "kind": "tool", "tool": "echo", "input": {"x": 2}, "result": {"got": 2}}])
        with self.assertRaises(AgentError):
            call("missing")


if __name__ == "__main__":
    unittest.main()
