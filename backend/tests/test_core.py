import hashlib, os, sqlite3, tempfile
import numpy as np
from app import scanner, rag, flow, agent

def fake_embed(texts):                       # deterministic bag-of-words hashing embedder (no network)
    out = []
    for t in texts:
        v = np.zeros(64)
        for w in __import__("re").findall(r"[a-z_]+", t.lower()):
            v[int(hashlib.md5(w.encode()).hexdigest(), 16) % 64] += 1
        out.append(v.tolist())
    return out

def make_repo():
    d = tempfile.mkdtemp()
    open(d + "/auth.py", "w").write("import db\ndef login(user, password):\n    return check_password(user, password)\n")
    open(d + "/db.py", "w").write("import sqlite3\ndef connect():\n    return sqlite3.connect('x.db')\n")
    open(d + "/api.py", "w").write("import auth\n@app.post('/login')\ndef route():\n    return auth.login(1, 2)\n")
    return d

def test_analyze_layers_routes():
    d = make_repo(); a = scanner.analyze(d)
    assert {"source": "auth.py", "target": "db.py"} in a["edges"]
    assert a["files"]["api.py"]["routes"][0]["path"] == "/login"
    assert scanner.layer("db.py", a["files"]["db.py"]) == "database"

def test_rag_index_cache_and_search():
    d = make_repo(); a = scanner.analyze(d)
    db = sqlite3.connect(":memory:"); rag.init(db)
    assert rag.index_repo(db, "r1", d, a["files"], fake_embed)["embedded"] == 3
    assert rag.index_repo(db, "r1", d, a["files"], fake_embed)["embedded"] == 0   # nothing re-embedded
    hits = rag.search(db, "r1", "login password", fake_embed)
    assert hits and hits[0]["file"] == "auth.py" and hits[0]["start"] == 1

def test_flow_and_tools():
    d = make_repo(); a = scanner.analyze(d)
    f = flow.build_flow(a, d, "how does login work", scanner.layer)
    assert "auth.py" in [n["id"] for n in f["nodes"]] and f["edges"]
    t = agent.Tools(a, d)
    assert t.get_function_details("login")["callers"]
    try:
        t.get_file_content("../../etc/passwd"); assert False
    except ValueError:
        pass
