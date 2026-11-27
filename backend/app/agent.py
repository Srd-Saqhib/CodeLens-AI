"""Tool-using Gemini agent. Gemini only *requests* tools; this Python code executes them."""
import os
from google import genai
from google.genai import types
from .gemini import call_with_transient_error_retry, is_rate_limited

MAX_STEPS = 6


class Tools:
    def __init__(self, analysis, root):
        self.a, self.root = analysis, root

    def _read(self, path):
        if path not in self.a["files"]:                     # only analyzed files are readable
            raise ValueError(f"Unknown file: {path}")
        return open(os.path.join(self.root, path), encoding="utf-8", errors="ignore").read().splitlines()

    def search_code(self, keyword):
        hits = []
        for p in self.a["files"]:
            for i, line in enumerate(self._read(p), 1):
                if keyword.lower() in line.lower():
                    hits.append({"file": p, "line": i, "text": line.strip()[:160]})
                    if len(hits) >= 25:
                        return hits
        return hits

    def get_file_content(self, file_path):
        return {"file": file_path, "content": "\n".join(f"{i}: {l}" for i, l in enumerate(self._read(file_path)[:300], 1))}

    def find_function(self, function_name):
        out = []
        for p, f in self.a["files"].items():
            for fn in f["functions"]:
                if fn["name"] == function_name:
                    lines = self._read(p)[fn["line"] - 1: min(fn["end"], fn["line"] + 60)]
                    out.append({"file": p, "line": fn["line"], "code": "\n".join(lines)})
        return out or "not found"

    def get_function_details(self, function_name):
        """Definition + callers (files mentioning the name) + the defining file's imports."""
        defs = self.find_function(function_name)
        if defs == "not found":
            return defs
        callers = [h for h in self.search_code(function_name + "(") if not h["text"].startswith(("def ", "function "))][:10]
        return {"definitions": defs, "callers": callers,
                "imports_of_defining_file": self.a["files"][defs[0]["file"]]["imports"]}

    def get_dependencies(self):
        return self.a["dependencies"]

    def find_api_routes(self):
        return [{"file": p, **r} for p, f in self.a["files"].items() for r in f["routes"]]

    def get_related_files(self, file_path):
        return {"imports": [e["target"] for e in self.a["edges"] if e["source"] == file_path],
                "imported_by": [e["source"] for e in self.a["edges"] if e["target"] == file_path]}

    def get_project_structure(self):
        return sorted(self.a["files"])[:300]


def _decl(name, desc, arg=None):
    props = {arg: types.Schema(type="STRING")} if arg else {}
    return types.FunctionDeclaration(name=name, description=desc,
        parameters=types.Schema(type="OBJECT", properties=props, required=[arg] if arg else []) if arg else None)

DECLS = [_decl("search_code", "Search all files for a keyword", "keyword"),
         _decl("get_file_content", "Read a repo file (numbered lines)", "file_path"),
         _decl("find_function", "Find a function's definition and body", "function_name"),
         _decl("get_function_details", "Function body, callers and imports of its file", "function_name"),
         _decl("get_dependencies", "List detected dependencies"),
         _decl("find_api_routes", "List detected API routes"),
         _decl("get_related_files", "Files importing / imported by a file", "file_path"),
         _decl("get_project_structure", "List repository files")]

SYSTEM = ("You answer questions about a code repository using ONLY tool results. Call tools to "
          "gather evidence. Cite file paths and line numbers. If evidence is insufficient, say so. "
          "Describe relationships as statically inferred, not runtime-verified.")


def run_agent(analysis, root, question, mode="beginner"):
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return keyword_search_response(analysis, root, question)
    tools = Tools(analysis, root)
    client = genai.Client(api_key=key)
    contents = [types.Content(role="user", parts=[types.Part(text=f"[{mode} mode] {question}")])]
    cfg = types.GenerateContentConfig(system_instruction=SYSTEM, tools=[types.Tool(function_declarations=DECLS)],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True))
    steps = []
    try:
        for _ in range(MAX_STEPS):                          # bounded loop
            resp = call_with_transient_error_retry(
                client.models.generate_content,
                model=os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
                contents=contents, config=cfg)
            msg = resp.candidates[0].content
            calls = [p.function_call for p in msg.parts if p.function_call]
            if not calls:
                return {"answer": resp.text, "sources": [], "steps": steps}
            contents.append(msg)
            replies = []
            for c in calls:
                args = dict(c.args or {})
                try:
                    if not all(isinstance(v, str) and 0 < len(v) <= 200 for v in args.values()):
                        raise ValueError("arguments must be non-empty strings (max 200 chars)")
                    fn = getattr(tools, c.name) if c.name in {d.name for d in DECLS} else None
                    result = fn(**args) if fn else "unknown tool"
                except Exception as e:                      # errors go back to the model
                    result = f"error: {e}"
                steps.append({"tool": c.name, "args": args})
                replies.append(types.Part.from_function_response(name=c.name, response={"result": result}))
            contents.append(types.Content(role="user", parts=replies))
        return {"answer": "Stopped: tool-call limit reached.", "sources": [], "steps": steps}
    except Exception as e:
        if is_rate_limited(e):
            return keyword_search_response(
                analysis, root, question, "Gemini quota exhausted; using local keyword search.")
        return {"answer": f"AI request failed ({e}). Try again shortly.", "sources": [], "steps": steps}


def keyword_search_response(analysis, root, question, message="Limited mode (no Gemini key)."):
    tools = Tools(analysis, root)
    words = [w for w in question.split() if len(w) > 3][:3]
    hits = [h for w in words for h in tools.search_code(w)][:10]
    return {"answer": f"{message} Keyword matches:", "sources": hits, "steps": []}
