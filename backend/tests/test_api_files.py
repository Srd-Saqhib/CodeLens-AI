import json
import os
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app import main, rag


@pytest.fixture
def repo_client(tmp_path, monkeypatch):
    db = sqlite3.connect(":memory:", check_same_thread=False)
    db.execute("CREATE TABLE repos(id TEXT PRIMARY KEY, url TEXT, root TEXT, analysis TEXT)")
    db.execute("CREATE TABLE summaries(repo_id TEXT, mode TEXT, text TEXT, PRIMARY KEY(repo_id, mode))")
    db.execute("CREATE TABLE chats(repo_id TEXT, role TEXT, text TEXT, ts DEFAULT CURRENT_TIMESTAMP)")
    rag.init(db)

    rid = "test-repo"
    root = tmp_path / rid
    (root / "src").mkdir(parents=True)
    (root / "src" / "app.py").write_text("def greet():\n    return 'hello'\n", encoding="utf-8")
    analysis = {
        "files": {
            "src/app.py": {
                "lang": "Python",
                "lines": 2,
                "functions": [{"name": "greet"}],
                "classes": [],
                "routes": [],
                "imports": [],
            }
        }
    }
    db.execute(
        "INSERT INTO repos VALUES(?,?,?,?)",
        (rid, "https://github.com/test/repo", str(root), json.dumps(analysis)),
    )
    db.execute("INSERT INTO summaries VALUES(?,?,?)", (rid, "beginner", "summary"))
    db.execute("INSERT INTO chats(repo_id,role,text) VALUES(?,?,?)", (rid, "user", "question"))
    db.execute("INSERT INTO chunks VALUES(?,?,?,?,?,?,?)", (rid, "hash", "src/app.py", 1, 2, "text", b"vec"))
    db.commit()
    monkeypatch.setattr(main, "db", db)
    monkeypatch.setattr(main, "DATA", str(tmp_path))

    yield TestClient(main.app), db, rid, root
    db.close()


def test_file_endpoints_list_and_read_analyzed_files(repo_client):
    client, _, rid, _ = repo_client

    files = client.get(f"/api/repos/{rid}/files")
    content = client.get(f"/api/repos/{rid}/file-content", params={"path": "src/app.py"})
    traversal = client.get(f"/api/repos/{rid}/file-content", params={"path": "../../outside.py"})

    assert files.status_code == 200
    assert files.json() == [{
        "path": "src/app.py",
        "lang": "Python",
        "lines": 2,
        "functions": 1,
        "classes": 0,
        "routes": 0,
        "imports": 0,
    }]
    assert content.status_code == 200
    assert content.json()["content"].startswith("def greet")
    assert content.json()["info"]["functions"] == [{"name": "greet"}]
    assert traversal.status_code == 404


def test_remove_repo_deletes_repo_data_and_associated_records(repo_client):
    client, db, rid, root = repo_client

    response = client.delete(f"/api/repos/{rid}")

    assert response.status_code == 200
    assert response.json() == {"removed": rid}
    assert not os.path.exists(root)
    assert db.execute("SELECT 1 FROM repos WHERE id=?", (rid,)).fetchone() is None
    assert db.execute("SELECT 1 FROM summaries WHERE repo_id=?", (rid,)).fetchone() is None
    assert db.execute("SELECT 1 FROM chats WHERE repo_id=?", (rid,)).fetchone() is None
    assert db.execute("SELECT 1 FROM chunks WHERE repo_id=?", (rid,)).fetchone() is None


def test_chat_logs_rag_failure_and_returns_provider_error(repo_client, monkeypatch, caplog):
    client, _, rid, _ = repo_client
    monkeypatch.setattr(main, "has_key", lambda: True)

    def fail_embedder(_):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(main.rag, "gemini_embedder", fail_embedder)
    main._cached_chat_response.cache_clear()

    try:
        response = client.post(
            f"/api/repos/{rid}/chat",
            json={"question": "Where is greet defined?", "engine": "rag"},
        )

        assert response.status_code == 502
        assert response.json()["detail"] == "RAG failed: provider unavailable"
        assert "RAG chat failed for repository test-repo" in caplog.text
    finally:
        main._cached_chat_response.cache_clear()


def test_chat_falls_back_to_local_search_when_gemini_quota_is_exhausted(repo_client, monkeypatch):
    client, _, rid, _ = repo_client
    monkeypatch.setattr(main, "has_key", lambda: True)

    class QuotaError(Exception):
        code = 429

    def fail_embedder(_):
        raise QuotaError("daily quota exceeded")

    monkeypatch.setattr(main.rag, "gemini_embedder", fail_embedder)
    main._cached_chat_response.cache_clear()

    try:
        response = client.post(
            f"/api/repos/{rid}/chat",
            json={"question": "Where is greet defined?", "engine": "rag"},
        )

        assert response.status_code == 200
        assert "Gemini quota exhausted" in response.json()["answer"]
        assert response.json()["sources"][0]["file"] == "src/app.py"
    finally:
        main._cached_chat_response.cache_clear()


def test_summary_reports_gemini_quota_exhaustion(repo_client, monkeypatch):
    client, _, rid, _ = repo_client
    monkeypatch.setattr(main, "has_key", lambda: True)

    class QuotaError(Exception):
        code = 429

    def fail_summary(*_):
        raise QuotaError("daily quota exceeded")

    monkeypatch.setattr(main.summary, "generate", fail_summary)

    response = client.get(f"/api/repos/{rid}/summary", params={"mode": "developer"})

    assert response.status_code == 429
    assert "Gemini quota exhausted" in response.json()["detail"]
