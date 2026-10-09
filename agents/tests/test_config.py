"""Which model the agents use, and the environment checks that keep keys and traffic where they belong."""
import unittest

from creator_agents.__main__ import model_client
from creator_agents.config import from_env

TOKEN = {"AGENTS_SERVICE_TOKEN": "t" * 40}


class ConfigTest(unittest.TestCase):
    def test_claude_first_then_the_free_key_then_none(self):
        both = from_env({**TOKEN, "ANTHROPIC_API_KEY": "a", "LLM_API_KEY": "g"})
        self.assertEqual(type(model_client(both)).__name__, "HttpAnthropicClient")
        free = from_env({**TOKEN, "LLM_API_KEY": "g"})
        self.assertEqual(repr(model_client(free)), "OpenAICompatibleClient('api.groq.com')")
        self.assertIsNone(model_client(from_env(TOKEN)))

    def test_keys_stay_out_of_repr_and_traffic_stays_encrypted_or_local(self):
        self.assertNotIn("secret-g", repr(from_env({**TOKEN, "LLM_API_KEY": "secret-g"})))
        with self.assertRaises(SystemExit):
            from_env({**TOKEN, "LLM_API_KEY": "g", "LLM_BASE_URL": "http://example.com/v1"})
        with self.assertRaises(SystemExit):
            from_env({**TOKEN, "AGENTS_HOST": "0.0.0.0"})
        with self.assertRaises(SystemExit):
            from_env({"AGENTS_SERVICE_TOKEN": "short"})


if __name__ == "__main__":
    unittest.main()
