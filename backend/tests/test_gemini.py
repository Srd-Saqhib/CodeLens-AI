import sqlite3

import pytest

from app import gemini, main


class APIError(Exception):
    def __init__(self, code, details=None):
        self.code = code
        self.details = details or {}


def test_rate_limit_retry_respects_google_retry_delay(monkeypatch):
    attempts, delays = 0, []

    def request():
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise APIError(429, {"error": {"details": [
                {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "12.5s"}
            ]}})
        return "ok"

    monkeypatch.setattr(gemini.time, "sleep", delays.append)
    assert gemini.call_with_transient_error_retry(request) == "ok"
    assert delays == [12.5]


def test_rate_limit_retry_uses_exponential_backoff(monkeypatch):
    attempts, delays = 0, []

    def request():
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise APIError(429)
        return "ok"

    monkeypatch.setattr(gemini.time, "sleep", delays.append)
    assert gemini.call_with_transient_error_retry(request) == "ok"
    assert delays == [1, 2]


@pytest.mark.parametrize("status", [400, 404])
def test_non_retryable_errors_are_not_retried(monkeypatch, status):
    attempts = 0

    def request():
        nonlocal attempts
        attempts += 1
        raise APIError(status)

    monkeypatch.setattr(gemini.time, "sleep", lambda _: pytest.fail("unexpected retry"))
    with pytest.raises(APIError):
        gemini.call_with_transient_error_retry(request)
    assert attempts == 1


def test_service_unavailable_retries_with_exponential_backoff(monkeypatch):
    attempts, delays = 0, []

    def request():
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise APIError(503)
        return "ok"

    monkeypatch.setattr(gemini.time, "sleep", delays.append)
    assert gemini.call_with_transient_error_retry(request) == "ok"
    assert delays == [1, 2]


def test_long_quota_retry_delay_is_not_waited_out(monkeypatch):
    def request():
        raise APIError(429, {"error": {"details": [
            {"retryDelay": "58182s"}
        ]}})

    monkeypatch.setattr(gemini.time, "sleep", lambda _: pytest.fail("long quota delay should not be retried"))
    with pytest.raises(APIError):
        gemini.call_with_transient_error_retry(request)


def test_chat_reuses_successful_response_for_repeated_request(monkeypatch):
    db = sqlite3.connect(":memory:")
    db.execute("CREATE TABLE chats(repo_id TEXT, role TEXT, text TEXT, ts DEFAULT CURRENT_TIMESTAMP)")
    monkeypatch.setattr(main, "db", db)
    monkeypatch.setattr(main, "load", lambda _: ("repo-root", {}, "repo-url"))
    monkeypatch.setattr(main, "has_key", lambda: True)
    calls = []

    def run_agent(*args):
        calls.append(args)
        return {"answer": "cached answer", "sources": [], "steps": []}

    monkeypatch.setattr(main.agent, "run_agent", run_agent)
    main._cached_chat_response.cache_clear()
    body = main.ChatIn(question="show login behavior", engine="agent")

    try:
        first = main.chat("repo-id", body)
        second = main.chat("repo-id", body)
        assert first == second
        assert len(calls) == 1
        assert db.execute("SELECT COUNT(*) FROM chats").fetchone()[0] == 4
    finally:
        main._cached_chat_response.cache_clear()
        db.close()
