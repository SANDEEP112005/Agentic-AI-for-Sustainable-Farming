"""
llm_config — Shared Groq LLM Client for All AI Agents
========================================================
Centralised configuration and API interface for Groq (Llama 3.3 70B).
All agents use this module to make LLM calls with:
  • OpenAI-compatible Groq REST API
  • Automatic JSON parsing
  • Retry with exponential back-off
  • Rate-limit handling
  • Graceful fallback on failure

Environment variables (optional):
  GROQ_API_KEY  — override the default API key
  GROQ_MODEL    — override the model (default: llama-3.3-70b-versatile)
"""

import json
import os
import re
import time
import requests
from typing import Optional, Dict, Any


# ═══════════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════════

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


# ═══════════════════════════════════════════════════════════════════════════════
# Core API
# ═══════════════════════════════════════════════════════════════════════════════

def call_gemini(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.3,
    max_tokens: int = 2048,
    json_mode: bool = True,
    max_retries: int = 2,
    timeout: int = 30,
) -> Optional[Dict[str, Any]]:
    """Call Groq API (Llama 3.3 70B) with system + user prompts.

    Function name kept as call_gemini for backward compatibility with all agents.

    Args:
        system_prompt: Defines the agent's role and expertise.
        user_prompt:   The specific task / data to analyse.
        temperature:   Creativity (0 = deterministic, 1 = creative).
        max_tokens:    Max response length.
        json_mode:     If True, requests JSON output and parses it.
        max_retries:   Number of retry attempts on transient failures.
        timeout:       HTTP request timeout in seconds.

    Returns:
        Parsed dict on success, None on failure.
    """
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROQ_API_KEY}",
    }

    # Build messages array (OpenAI format)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    body = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    # Groq supports JSON mode for structured output
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    for attempt in range(max_retries + 1):
        try:
            resp = requests.post(
                GROQ_API_URL, headers=headers,
                json=body, timeout=timeout,
            )
            resp.raise_for_status()
            result = resp.json()

            # Extract text from OpenAI-format response
            choices = result.get("choices", [])
            if not choices:
                print(f"[Groq] No choices in response (attempt {attempt + 1})")
                if attempt < max_retries:
                    time.sleep(1)
                    continue
                return None

            text = choices[0]["message"]["content"]

            if json_mode:
                return _parse_json(text)
            else:
                return {"text": text}

        except requests.exceptions.Timeout:
            print(f"[Groq] Timeout (attempt {attempt + 1}/{max_retries + 1})")
        except requests.exceptions.ConnectionError as e:
            print(f"[Groq] Connection error (attempt {attempt + 1}): {e}")
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response else 0
            body_text = ""
            try:
                body_text = e.response.text[:300] if e.response else ""
            except Exception:
                pass
            print(f"[Groq] HTTP {status} (attempt {attempt + 1}): {body_text}")
            if status == 429:          # rate-limited
                wait = min(2 ** (attempt + 1), 10)
                print(f"   ⏳ Rate-limited — waiting {wait}s...")
                time.sleep(wait)
                continue
            if status >= 500:          # server error — retry
                time.sleep(1)
                continue
            # For unexpected status (including 0), retry once
            if attempt < max_retries:
                time.sleep(2)
                continue
            return None
        except Exception as e:
            print(f"[Groq] Error: {e}")

        if attempt < max_retries:
            time.sleep(2)

    return None


def call_gemini_text(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.5,
    timeout: int = 30,
) -> str:
    """Convenience wrapper — returns plain text (empty string on failure)."""
    result = call_gemini(
        system_prompt, user_prompt,
        temperature=temperature, json_mode=False, timeout=timeout,
    )
    return result.get("text", "") if result else ""


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _parse_json(text: str) -> Optional[Dict]:
    """Robustly parse JSON from LLM output."""
    # Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip markdown fences: ```json ... ```
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Last resort: find first { ... } block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    print(f"[Groq] Could not parse JSON from response: {text[:200]}...")
    return None
