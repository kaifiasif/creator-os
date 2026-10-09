"""The local-rule agents and the Scorer's measured dimensions, with a fake tool bridge."""
import unittest

from creator_agents.decision import decision_local
from creator_agents.job import AgentJob
from creator_agents.reviewer import reviewer_local
from creator_agents.runtime import AgentError
from creator_agents.scorer import combine, rule_scores


def checks(traceability="supported", repeat=None, voice=(), reason=""):
    return {"traceability": traceability, "reason": reason, "repeat": repeat, "voice": list(voice), "blocking": traceability != "supported" or bool(repeat)}


def fact(status="supported", similarity=None, repeat=False, voice=False):
    return {"type": "assertion", "status": status, "top_similarity": similarity, "repeat_flag": repeat, "voice_flag": voice}


class FakeBridge:
    def __init__(self, passes=True):
        self.calls = []
        self.passes = passes

    def call(self, tool, payload):
        self.calls.append((tool, payload))
        return {"passes": self.passes} if tool == "check_sentence" else {"blocking": 0}


def job(sentences, claims=(), facts=None, prior=None, bridge=None):
    draft = {"gate_status": "flagged", "voice": None, "channel": [], "posts": [{"position": 1, "sentences": sentences}]}
    context = {
        "draft": draft,
        "claims": list(claims),
        "posts": [" ".join(s["text"] for s in sentences)],
        "voice_profile": {"note": "no archive"},
        "rule_facts": {"sentences": facts or [], "voice_score": None, "repetition_threshold": 0.8},
    }
    return AgentJob(run_id="r", context=context, bridge=bridge or FakeBridge(), model="m", client=None, prior=prior or {})


class ReviewerTest(unittest.TestCase):
    def test_repeats_are_removed_and_unsupported_sentences_rewritten_from_their_claim(self):
        bridge = FakeBridge()
        claim = {"id": "c1", "text": "Small PRs get reviewed", "speaker": "Ana", "is_creator": False, "quote": ""}
        out = reviewer_local(job([
            {"id": "a", "text": "Old take.", "supports": [], "checks": checks(repeat={"severity": "normal", "similarity": 0.91, "published_at": "2025-01-02T00:00:00Z"})},
            {"id": "b", "text": "It saved 90 hours.", "supports": ["c1"], "checks": checks("unsupported", reason="No claim has 90.")},
            {"id": "c", "text": "Fine.", "supports": [], "checks": checks()},
        ], claims=[claim], bridge=bridge))
        self.assertEqual([i["action"] for i in out["issues"]], ["remove", "replace"])
        self.assertIn("Close to your post from 2025-01-02 (similarity 0.91)", out["issues"][0]["note"])
        self.assertEqual(out["issues"][1]["replacement"], 'As Ana put it, "Small PRs get reviewed."')
        self.assertEqual(out["revised_posts"], ['As Ana put it, "Small PRs get reviewed." Fine.'])
        self.assertEqual([c[0] for c in bridge.calls], ["check_sentence", "check_posts"])
        self.assertEqual(out["summary"], "2 issues found; 2 fixes proposed and checked.")

    def test_a_rewrite_that_fails_its_check_becomes_a_removal(self):
        claim = {"id": "c1", "text": "Small PRs ship", "speaker": "me", "is_creator": True, "quote": ""}
        out = reviewer_local(job([{"id": "b", "text": "Big claim.", "supports": ["c1"], "checks": checks("partial", reason="Half backed.")}], claims=[claim], bridge=FakeBridge(passes=False)))
        self.assertEqual(out["issues"][0]["action"], "remove")
        self.assertEqual(out["issues"][0]["note"], "Half backed. Nothing you said backs it, so remove it.")
        self.assertEqual(out["revised_posts"], [])


class ScorerTest(unittest.TestCase):
    def test_rule_dimensions(self):
        rules = rule_scores({"sentences": [fact(), fact("partial", similarity=0.4), None], "voice_score": None, "repetition_threshold": 0.8})
        self.assertEqual(rules["traceability"], {"score": 4, "reason": "75% of assertions backed by the source.", "by": "rule"})
        self.assertEqual(rules["novelty"]["score"], 3)
        self.assertEqual(rules["novelty"]["reason"], "Closest earlier post has similarity 0.4 (flag threshold 0.8).")
        self.assertEqual(rules["voice_fit"], {"score": 3, "reason": "No archive to compare against.", "by": "rule"})

    def test_combined_score_clamps_judged_dimensions_and_averages(self):
        rules = rule_scores({"sentences": [fact()], "voice_score": None, "repetition_threshold": 0.8})
        out = combine(rules, {"hook": {"score": 7, "reason": "r"}, "clarity": {"score": 2.2, "reason": "r"}, "comment": "c"})
        self.assertEqual((out["dimensions"]["hook"]["score"], out["dimensions"]["clarity"]["score"], out["overall"]), (5, 2, 4))
        self.assertEqual(out["dimensions"]["hook"]["by"], "model")


class DecisionTest(unittest.TestCase):
    def scores(self, overall, worst="novelty"):
        return {"overall": overall, "dimensions": {"traceability": {"score": 4}, worst: {"score": 1}}}

    def test_low_overall_is_a_reject_with_the_weakest_dimension(self):
        out = decision_local(job([], prior={"scorer": self.scores(2.2, "voice_fit")}))
        self.assertEqual((out["recommendation"], out["reject_reason"]), ("reject", "not_me"))
        self.assertEqual(out["rationale"], "Overall 2.2/5; weakest on voice fit.")

    def test_flagged_sentences_predict_an_edit(self):
        review = {"issues": [], "verification": {"blocking": 0}}
        out = decision_local(job([], facts=[fact("unsupported")], prior={"scorer": self.scores(3.5), "reviewer": review}))
        self.assertEqual(out, {"recommendation": "edit", "confidence": 0.7, "rationale": "1 flagged sentence; the Reviewer has a checked fix."})

    def test_clean_draft_is_an_accept(self):
        out = decision_local(job([], facts=[fact()], prior={"scorer": self.scores(4.4)}))
        self.assertEqual(out, {"recommendation": "accept", "confidence": 0.88, "rationale": "Clean checks and overall 4.4/5."})

    def test_model_versions_need_a_key(self):
        from creator_agents.decision import decision_model

        with self.assertRaisesRegex(AgentError, "No model is configured"):
            decision_model(job([]))


if __name__ == "__main__":
    unittest.main()
