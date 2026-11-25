"""Embeddings RAG: chunk -> embed (cached by content hash) -> cosine search -> grounded answer.
Vectors are stored in SQLite and searched with numpy (exact cosine search; fine at this scale,
and avoids a heavy FAISS install. FAISS would be a drop-in replacement for `search`)."""
import hashlib, os
import numpy as np
from .gemini import call_with_transient_error_retry

EMB_MODEL = "gemini-embedding-001"
CODE_EXT = (".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go", ".html", ".css")
MAX_CHUNKS, MIN_SCORE, MAX_CONTEXT = 1500, 0.35, 12000


def init(db):
    db.execute("CREATE TABLE IF NOT EXISTS chunks(repo_id TEXT, hash TEXT, file TEXT, start INT, end INT, text TEXT, vec BLOB)")
    db.execute("CREATE INDEX IF NOT EXISTS ix_chunks ON chunks(repo_id, hash)")


def chunk_file(path, text, size=40, overlap=8):
    """Fixed line windows with overlap; every chunk keeps file path + line range."""
    lines, out, i = text.splitlines(), [], 0
    while i < len(lines):
        block = lines[i:i + size]
        body = "\n".join(block).strip()
        if body:
            out.append({"file": path, "start": i + 1, "end": i + len(block), "text": body})
        i += size - overlap
    return out


def gemini_embedder(task):
    """Returns embed(list[str]) -> list[vector], with retry/backoff for rate limits."""
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    def embed(texts):
        out = []
        for b in range(0, len(texts), 50):
            r = call_with_transient_error_retry(
                client.models.embed_content, model=EMB_MODEL, contents=texts[b:b + 50],
                config=types.EmbedContentConfig(task_type=task))
            out += [e.values for e in r.embeddings]
        return out
    return embed


def index_repo(db, rid, root, files, embed):
    chunks = []
    for p in files:
        if p.endswith(CODE_EXT):
            chunks += chunk_file(p, open(os.path.join(root, p), encoding="utf-8", errors="ignore").read())
    chunks = chunks[:MAX_CHUNKS]
    for c in chunks:
        c["hash"] = hashlib.sha256((c["file"] + c["text"]).encode()).hexdigest()
    have = {r[0] for r in db.execute("SELECT hash FROM chunks WHERE repo_id=?", (rid,))}
    new = {c["hash"]: c for c in chunks if c["hash"] not in have}.values()   # unchanged chunks are skipped
    new = list(new)
    if new:
        vecs = embed([c["text"][:2000] for c in new])
        db.executemany("INSERT INTO chunks VALUES(?,?,?,?,?,?,?)", [
            (rid, c["hash"], c["file"], c["start"], c["end"], c["text"], np.asarray(v, dtype=np.float32).tobytes())
            for c, v in zip(new, vecs)])
    for h in have - {c["hash"] for c in chunks}:
        db.execute("DELETE FROM chunks WHERE repo_id=? AND hash=?", (rid, h))
    db.commit()
    return {"total": len(chunks), "embedded": len(new)}


def search(db, rid, query, embed, k=6):
    rows = db.execute("SELECT file,start,end,text,vec FROM chunks WHERE repo_id=?", (rid,)).fetchall()
    if not rows:
        return []
    M = np.stack([np.frombuffer(r[4], dtype=np.float32) for r in rows])
    M = M / (np.linalg.norm(M, axis=1, keepdims=True) + 1e-9)
    q = np.asarray(embed([query])[0], dtype=np.float32)
    s = M @ (q / (np.linalg.norm(q) + 1e-9))
    return [{"file": rows[i][0], "start": rows[i][1], "end": rows[i][2], "text": rows[i][3], "score": round(float(s[i]), 3)}
            for i in np.argsort(-s)[:k] if s[i] >= MIN_SCORE]


def answer(question, hits, mode="beginner"):
    if not hits:
        return "I couldn't find code relevant to that question, so I won't guess."
    ctx = ""
    for h in hits:
        block = f"### {h['file']}:{h['start']}-{h['end']}\n{h['text']}\n"
        if len(ctx) + len(block) > MAX_CONTEXT:
            break
        ctx += block
    from google import genai
    prompt = (f"Answer the question about this repository using ONLY the code excerpts below. Cite file:line-range "
              f"for each claim. If they are insufficient, say so. Style: {mode} mode.\n\n{ctx}\nQuestion: {question}")
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    response = call_with_transient_error_retry(
        client.models.generate_content,
        model=os.getenv("GEMINI_MODEL", "gemini-3.8-flash"), contents=prompt)
    return response.text
