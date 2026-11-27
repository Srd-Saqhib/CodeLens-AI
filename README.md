# CodeLens AI

AI-powered GitHub repository analyzer: summaries, architecture graph, execution flows, RAG/agent chat and analytics.

## Structure
`backend/` FastAPI app (`app/main.py` is the single entry point) | `frontend/` React + Vite (React Router, Axios, React Flow, Recharts)

## Setup
```
# backend (Python 3.10+)
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # optional: GEMINI_API_KEY from https://aistudio.google.com/apikey
uvicorn app.main:app --reload # http://localhost:8000  (API docs at /docs)

# frontend (Node 18+), second terminal
cd frontend && npm install && npm run dev   # http://localhost:5173 (proxies /api to :8000)
npm run build                                # production build
```
Run tests: `cd backend && pip install pytest && PYTHONPATH=. pytest tests`

## API (see backend/app/main.py)
GET /api/status, GET/POST /api/repos, GET /api/repos/{id}/analysis, GET .../summary?mode=beginner|developer, GET .../architecture, POST .../flow, POST .../index, POST/GET .../chat (engine: rag|agent)

Without a Gemini key or after Gemini quota is exhausted: scanning, architecture, flow, analytics and keyword-search chat work; AI summaries report that Gemini quota is unavailable.

## How it works
1. `scanner.download` fetches the repo zip, extracts only allowed text files (path-traversal, size, count, sensitive-file guards). Nothing is executed.
2. `scanner.analyze` uses Python `ast` (functions, classes, imports) and regexes for JS/TS imports and routes, resolves imports to files -> dependency edges.
3. `scanner.build_architecture` turns verified edges into React Flow nodes. Stats for charts are computed in Python.
4. `agent.run_agent`: Gemini function calling. We send tool declarations; Gemini replies with `function_call` parts; Python runs the matching `Tools` method (arguments validated, only analyzed files readable); results go back as `function_response`; loop max 6 steps; final text answer cites file:line.
5. Without a Gemini key, chat falls back to keyword search.

## What changed in v2
- `rag.py`: line-window chunks keep file + line range; Gemini `gemini-embedding-001` embeddings stored in SQLite, cached by content hash (unchanged chunks are not re-embedded), exact cosine search with numpy (not FAISS), score threshold so weak matches give "not enough evidence".
- `summary.py`: beginner/developer explanations from real analysis data, cached in SQLite.
- `flow.py`: keyword-matched files expanded over verified import edges (static analysis, not runtime tracing).
- `agent.py`: added `get_function_details` and argument validation. Chat has an RAG/Agent switch.
- Architecture: nodes classified frontend/backend/database/other, one column per layer, node search.

## Verification status
Tested offline (3 tests, plain Python): import edges, route detection, layer classification, chunking, embedding cache, cosine retrieval (fake embedder), flow building, tool path restriction; `main.py` compiles.
NOT tested (no network or packages in the build environment): FastAPI startup, GitHub download, any Gemini call (summary, embeddings, function calling, RAG answers), the frontend build and UI. Check the model names `gemini-embedding-001` / `gemini-2.5-flash` against current Google docs.

## Still missing
Tree-sitter, FAISS, external-API nodes in the diagram, live progress bar, the docs/ folder, AI commentary on analytics.
