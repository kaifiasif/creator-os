"""Headers for outbound model API calls.

Groq and some other providers sit behind Cloudflare, which rejects Python's default
urllib User-Agent (403, error code 1010). Node fetch is fine; the agents run in Python.
"""

USER_AGENT = "Creator-OS/agents (compatible OpenAI client)"


def merge_headers(*parts: dict[str, str]) -> dict[str, str]:
    merged: dict[str, str] = {"User-Agent": USER_AGENT}
    for part in parts:
        merged.update(part)
    return merged
