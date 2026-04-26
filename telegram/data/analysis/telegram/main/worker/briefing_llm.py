#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_NIM_BASE_URL = "https://integrate.api.nvidia.com/v1"


@dataclass(frozen=True)
class BackendConfig:
    backend: str
    model: str
    reasoning_effort: str
    api_base: str | None = None
    api_key: str | None = None
    timeout_seconds: int = 90


def _first_env(*names: str) -> str | None:
    for name in names:
        value = os.environ.get(name, "").strip()
        if value:
            return value
    return None


def resolve_backend_config(
    *,
    backend_env: str,
    model_env: str,
    reasoning_env: str,
    default_model: str,
    default_backend: str = "codex",
) -> BackendConfig:
    backend = (
        _first_env(backend_env, "TELEGRAM_LLM_BACKEND")
        or default_backend
    ).strip().lower()
    model = _first_env(model_env) or default_model
    reasoning_effort = _first_env(reasoning_env) or "low"

    if backend in {"nim", "nvidia-nim", "nvidia"}:
        return BackendConfig(
            backend="nim",
            model=model,
            reasoning_effort=reasoning_effort,
            api_base=_first_env("TELEGRAM_NIM_BASE_URL", "NIM_BASE_URL") or DEFAULT_NIM_BASE_URL,
            api_key=_first_env("TELEGRAM_NIM_API_KEY", "NIM_API_KEY", "NVIDIA_API_KEY", "NGC_API_KEY"),
            timeout_seconds=int(_first_env("TELEGRAM_NIM_TIMEOUT_SECONDS") or "90"),
        )

    return BackendConfig(
        backend="codex",
        model=model,
        reasoning_effort=reasoning_effort,
        timeout_seconds=int(_first_env("TELEGRAM_CODEX_TIMEOUT_SECONDS") or "90"),
    )


def run_structured_json(prompt: str, schema: dict, config: BackendConfig) -> dict:
    if config.backend == "nim":
        return _run_nim_json(prompt, schema, config)
    return _run_codex_json(prompt, schema, config)


def _run_codex_json(prompt: str, schema: dict, config: BackendConfig) -> dict:
    with tempfile.TemporaryDirectory(prefix="telegram-llm-") as temp_dir:
        temp_path = Path(temp_dir)
        schema_path = temp_path / "schema.json"
        output_path = temp_path / "output.json"
        schema_path.write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")
        command = [
            "codex",
            "exec",
            "--skip-git-repo-check",
            "--dangerously-bypass-approvals-and-sandbox",
            "--ephemeral",
            "-C",
            temp_dir,
            "-m",
            config.model,
            "-c",
            f'model_reasoning_effort="{config.reasoning_effort}"',
            "--output-schema",
            str(schema_path),
            "--output-last-message",
            str(output_path),
            "-",
        ]
        result = subprocess.run(command, input=prompt, text=True, capture_output=True)
        if result.returncode != 0:
            stderr = result.stderr.strip() or result.stdout.strip()
            raise RuntimeError(f"codex exec failed for model {config.model}: {stderr}")
        if not output_path.exists():
            raise RuntimeError(f"codex exec did not produce output for model {config.model}")
        try:
            return json.loads(output_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"codex exec returned invalid JSON for model {config.model}: {exc}") from exc


def _run_nim_json(prompt: str, schema: dict, config: BackendConfig) -> dict:
    if not config.api_key:
        raise RuntimeError("NIM backend selected but no API key is configured")
    if not config.api_base:
        raise RuntimeError("NIM backend selected but no API base URL is configured")

    endpoint = config.api_base.rstrip("/") + "/chat/completions"
    schema_text = json.dumps(schema, ensure_ascii=False, separators=(",", ":"))
    user_prompt = (
        "Return only valid JSON that matches this schema exactly. "
        "Do not wrap the JSON in markdown fences.\n"
        f"JSON schema: {schema_text}\n\n"
        f"Task prompt:\n{prompt}"
    )
    payload = {
        "model": config.model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a careful JSON generation engine. "
                    "Return a single JSON object only, matching the provided schema."
                ),
            },
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0,
        "top_p": 1,
        "max_tokens": 4096,
        "response_format": {"type": "json_object"},
    }
    request = Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.api_key}",
        },
    )
    try:
        with urlopen(request, timeout=config.timeout_seconds) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace") if hasattr(exc, "read") else str(exc)
        raise RuntimeError(f"NIM request failed with HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"NIM request failed: {exc.reason}") from exc

    try:
        body = json.loads(raw)
        content = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"NIM returned an unexpected response shape: {raw[:500]}") from exc

    if isinstance(content, list):
        content = "".join(part.get("text", "") if isinstance(part, dict) else str(part) for part in content)
    payload_text = str(content).strip()
    if payload_text.startswith("```"):
        payload_text = payload_text.strip("`")
        if payload_text.lower().startswith("json"):
            payload_text = payload_text[4:].lstrip()
    try:
        return json.loads(payload_text)
    except json.JSONDecodeError:
        start = payload_text.find("{")
        end = payload_text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(payload_text[start : end + 1])
            except json.JSONDecodeError as exc:
                raise RuntimeError(f"NIM returned invalid JSON for model {config.model}: {payload_text[:500]}") from exc
        raise RuntimeError(f"NIM returned invalid JSON for model {config.model}: {payload_text[:500]}")
