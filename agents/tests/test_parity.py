"""Numbers and text match the web app's JavaScript, so scores and notes read the same as before the port."""
import unittest

from creator_agents.jsnum import ensure_period, js_round, js_str, opening_pattern, split_sentences, to_fixed, to_half, to_json, word_count
from creator_agents.validation import ValidationError, validate
from creator_agents.schemas import DECISION_PREDICTION, REVIEW_SUBMISSION, TOOL_INPUTS


class JsNumberTest(unittest.TestCase):
    def test_rounding_follows_math_round_and_to_fixed(self):
        self.assertEqual([js_round(x) for x in (0.5, 1.5, 2.5, -0.5)], [1, 2, 3, 0])
        self.assertEqual([to_half(x) for x in (4.25, 4.75, 3.0)], [4.5, 5, 3])
        self.assertEqual(to_fixed(0.25, 1), "0.3")
        self.assertEqual(to_fixed(12.5, 0), "13")

    def test_numbers_print_like_javascript(self):
        self.assertEqual([js_str(x) for x in (5.0, 0.912, None, 7)], ["5", "0.912", "undefined", "7"])
        self.assertEqual(to_json({"score": 5.0, "x": [1.5], "t": "é"}), '{"score":5,"x":[1.5],"t":"é"}')


class TextTest(unittest.TestCase):
    def test_sentences_and_openings(self):
        self.assertEqual(split_sentences('One. Two!\n\n"Three?" four'), ["One.", "Two!", '"Three?"', "four"])
        self.assertEqual(opening_pattern("Why ship small? Because."), "question")
        self.assertEqual(opening_pattern("3 things I learned."), "number")
        self.assertEqual(opening_pattern("Last week I broke prod."), "story")
        self.assertEqual(opening_pattern("Small is fast."), "claim")
        self.assertEqual(word_count(" two words"), 3)
        self.assertEqual(ensure_period(" no stop "), "no stop.")


class ValidationTest(unittest.TestCase):
    def test_defaults_trim_and_unknown_keys(self):
        self.assertEqual(validate(TOOL_INPUTS["check_sentence"], {"text": "a", "extra": 1}), {"text": "a", "supports": [], "type": "assertion"})
        with self.assertRaises(ValidationError):
            validate(TOOL_INPUTS["search_archive"], {"text": "a", "k": 9})

    def test_cross_field_rules(self):
        with self.assertRaisesRegex(ValidationError, "reject needs reject_reason"):
            validate(DECISION_PREDICTION, {"recommendation": "reject", "confidence": 0.5, "rationale": "x"})
        issue = {"sentence_id": "s", "problem": "repeat", "action": "replace", "note": ""}
        with self.assertRaisesRegex(ValidationError, "issues.0.replacement: replace needs replacement text"):
            validate(REVIEW_SUBMISSION, {"summary": "s", "issues": [issue], "revised_posts": []})
        out = validate(REVIEW_SUBMISSION, {"summary": "  ok  ", "issues": [], "revised_posts": ["a"]})
        self.assertEqual(out["summary"], "ok")


if __name__ == "__main__":
    unittest.main()
