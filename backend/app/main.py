import json, logging, os, sqlite3, uuid
from functools import lru_cache
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from . import scanner, agent, rag, flow, summary

logger = logging.getLogger(__name__)

load_dotenv()
DATA = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(DATA, exist_ok=True)
db = sqlite3.connect(os.path.join(DATA, "codelens.db"), check_same_thread=False)
db.execute("CREATE TABLE IF NOT EXISTS repos(id TEXT PRIMARY KEY, url TEXT, root TEXT, analysis TEXT)")
db.execute("CREATE TABLE IF NOT EXISTS summaries(repo_id TEXT, mode TEXT, text TEXT, PRIMARY KEY(repo_id, mode))")
db.execute("CREATE TABLE IF NOT EXISTS chats(repo_id TEXT, role TEXT, text TEXT, ts DEFAULT CURRENT_TIMESTAMP)")
rag.init(db)

app = FastAPI(title="CodeLens AI")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","), allow_methods=["*"], allow_headers=["*"])
has_key = lambda: bool(os.getenv("GEMINI_API_KEY"))


class RepoIn(BaseModel):
    url: str = Field(max_length=200)

class ChatIn(BaseModel):
    question: str = Field(min_length=2, max_length=500)
    mode: str = Field("beginner", pattern="^(beginner|developer)$")
    engine: str = Field("rag", pattern="^(rag|agent)$")

class FlowIn(BaseModel):
    question: str = Field(min_length=2, max_length=300)


@app.exception_handler(Exception)
async def any_error(_, e):                       # consistent error shape: {"detail": ...}
    return JSONResponse({"detail": f"Server error: {e}"}, status_code=500)


def load(rid):
    row = db.execute("SELECT root, analysis, url FROM repos WHERE id=?", (rid,)).fetchone()
    if not row:
        raise HTTPException(404, "Unknown repository id")
    return row[0], json.loads(row[1]), row[2]


class _UncacheableChat(Exception):
    def __init__(self, response):
        self.response = response


@lru_cache(maxsize=128)
def _cached_chat_response(rid, question, mode, engine, model, ai_enabled):
    root, a, _ = load(rid)
    if engine == "agent" or not ai_enabled:
        out = agent.run_agent(a, root, question, mode)
    else:
        try:
            if not db.execute("SELECT 1 FROM chunks WHERE repo_id=? LIMIT 1", (rid,)).fetchone():
                rag.index_repo(db, rid, root, a["files"], rag.gemini_embedder("RETRIEVAL_DOCUMENT"))
            hits = rag.search(db, rid, question, rag.gemini_embedder("RETRIEVAL_QUERY"))
            out = {"answer": rag.answer(question, hits, mode), "steps": [],
                   "sources": [{"file": h["file"], "line": f"{h['start']}-{h['end']}", "text": f"score {h['score']}"} for h in hits]}
        except Exception as e:
            raise HTTPException(502, f"RAG failed: {e}")
    if out["answer"].startswith("AI request failed ("):
        raise _UncacheableChat(out)
    return out


@app.get("/api/status")
def status():
    return {"ai": has_key()}


@app.get("/api/repos")
def list_repos():
    rows = db.execute("SELECT id, url FROM repos ORDER BY rowid DESC LIMIT 10").fetchall()
    return [{"id": i, "name": u.split("github.com/")[-1].removesuffix(".git").strip("/")} for i, u in rows]


@app.post("/api/repos")
def add_repo(body: RepoIn):
    rid, root = uuid.uuid4().hex[:10], None
    root = os.path.join(DATA, rid)
    try:
        owner, repo = scanner.download(body.url, root)
        a = scanner.analyze(root)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"Download/analysis failed: {e}")
    db.execute("INSERT INTO repos VALUES(?,?,?,?)", (rid, body.url, root, json.dumps(a)))
    db.commit()
    return {"id": rid, "name": f"{owner}/{repo}", "stats": a["stats"]}


@app.get("/api/repos/{rid}/analysis")
def analysis(rid: str):
    root, a, url = load(rid)
    return {"url": url, "stats": a["stats"], "dependencies": a["dependencies"],
            "routes": agent.Tools(a, root).find_api_routes()}


@app.get("/api/repos/{rid}/summary")
def get_summary(rid: str, mode: str = "beginner"):
    if mode not in ("beginner", "developer"):
        raise HTTPException(400, "mode must be beginner or developer")
    root, a, _ = load(rid)
    row = db.execute("SELECT text FROM summaries WHERE repo_id=? AND mode=?", (rid, mode)).fetchone()
    if row:
        return {"text": row[0], "cached": True}
    if not has_key():
        raise HTTPException(503, "AI summaries need GEMINI_API_KEY in backend/.env")
    try:
        text = summary.generate(a, root, mode)
    except Exception as e:
        logger.exception("Gemini summary generation failed")
        raise HTTPException(502, f"Gemini request failed: {e}")
    db.execute("INSERT OR REPLACE INTO summaries VALUES(?,?,?)", (rid, mode, text))
    db.commit()
    return {"text": text, "cached": False}


@app.get("/api/repos/{rid}/architecture")
def architecture(rid: str):
    return scanner.build_architecture(load(rid)[1])


@app.post("/api/repos/{rid}/flow")
def get_flow(rid: str, body: FlowIn):
    root, a, _ = load(rid)
    return flow.build_flow(a, root, body.question, scanner.layer)


@app.post("/api/repos/{rid}/index")
def index(rid: str):
    root, a, _ = load(rid)
    if not has_key():
        raise HTTPException(503, "Embeddings need GEMINI_API_KEY")
    try:
        result = rag.index_repo(db, rid, root, a["files"], rag.gemini_embedder("RETRIEVAL_DOCUMENT"))
        _cached_chat_response.cache_clear()
        return result
    except Exception as e:
        raise HTTPException(502, f"Embedding failed (rate limit?): {e}")


@app.post("/api/repos/{rid}/chat")
def chat(rid: str, body: ChatIn):
    load(rid)
    db.execute("INSERT INTO chats(repo_id,role,text) VALUES(?,?,?)", (rid, "user", body.question))
    try:
        out = _cached_chat_response(
            rid, body.question, body.mode, body.engine,
            os.getenv("GEMINI_MODEL", "gemini-3.8-flash"), has_key())
    except _UncacheableChat as e:
        out = e.response
    db.execute("INSERT INTO chats(repo_id,role,text) VALUES(?,?,?)", (rid, "ai", out["answer"]))
    db.commit()
    return out


@app.get("/api/repos/{rid}/chat")
def history(rid: str):
    load(rid)
    return [{"role": r, "text": t} for r, t in db.execute("SELECT role,text FROM chats WHERE repo_id=? ORDER BY ts", (rid,))]
