"""Download a public GitHub repo safely and statically analyze it (never executes code)."""
import ast, io, os, posixpath, re, zipfile, requests
from collections import Counter

IGNORE = {"node_modules", ".git", "dist", "build", "__pycache__", "venv", ".venv", "env"}
LANG = {".py": "Python", ".js": "JavaScript", ".jsx": "JavaScript", ".ts": "TypeScript",
        ".tsx": "TypeScript", ".java": "Java", ".go": "Go", ".html": "HTML", ".css": "CSS",
        ".json": "JSON", ".md": "Markdown", ".txt": "Text"}
SENSITIVE = (".env", "id_rsa", ".pem", ".key")
MAX_ZIP, MAX_FILES, MAX_FILE = 50 * 2**20, 2000, 200_000
JS_IMPORT = re.compile(r"""(?:from\s*|import\s*|require\()\s*['"]([^'"]+)['"]""")
ROUTE = re.compile(r"""[@.]\s*(?:app|router|\w+)?\.?(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)""")


def parse_url(url: str):
    m = re.match(r"^https://github\.com/([\w.-]+)/([\w.-]+?)(?:\.git)?/?$", url.strip())
    if not m:
        raise ValueError("Not a valid GitHub repository URL")
    return m.group(1), m.group(2)


def download(url: str, dest: str):
    """Download zip from codeload (no token needed) and extract ONLY allowed text files."""
    owner, repo = parse_url(url)
    r = requests.get(f"https://codeload.github.com/{owner}/{repo}/zip/HEAD", stream=True, timeout=60)
    if r.status_code != 200:
        raise ValueError(f"GitHub returned {r.status_code}; is the repo public?")
    data = b""
    for chunk in r.iter_content(1 << 16):
        data += chunk
        if len(data) > MAX_ZIP:
            raise ValueError("Repository archive exceeds 50 MB limit")
    root = os.path.realpath(dest)
    os.makedirs(root, exist_ok=True)
    count = 0
    for info in zipfile.ZipFile(io.BytesIO(data)).infolist():
        parts = info.filename.split("/", 1)
        if info.is_dir() or len(parts) < 2:
            continue
        rel = parts[1]
        name = os.path.basename(rel).lower()
        target = os.path.realpath(os.path.join(root, rel))
        if not target.startswith(root + os.sep):          # path traversal guard
            continue
        if (set(rel.split("/")) & IGNORE or info.file_size > MAX_FILE
                or os.path.splitext(rel)[1] not in LANG or name.startswith(SENSITIVE) or name.endswith(SENSITIVE)):
            continue
        if count >= MAX_FILES:
            break
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "wb") as f:
            f.write(zipfile.ZipFile(io.BytesIO(data)).read(info))
        count += 1
    return owner, repo


def _resolve(spec, src, files):
    """Map an import string to a repo file path, or None (external package)."""
    if spec.startswith("."):                               # JS-style relative import
        base = posixpath.normpath(posixpath.join(posixpath.dirname(src), spec))
        for c in [base] + [base + e for e in (".js", ".jsx", ".ts", ".tsx", ".py")] + \
                 [base + "/index" + e for e in (".js", ".jsx", ".ts", ".tsx")]:
            if c in files:
                return c
        return None
    mod = spec.replace(".", "/")                           # Python-style dotted import
    for c in (mod + ".py", mod + "/__init__.py"):
        for f in files:
            if f == c or f.endswith("/" + c):
                return f
    return None


def layer(path, info):
    """Classify a file as frontend / backend / database / other from path and detected content."""
    low = path.lower()
    if any(k in low for k in ("model", "schema", "database", "/db", "migration")) or low.startswith("db"):
        return "database"
    if path.endswith((".jsx", ".tsx", ".html", ".css")) or low.startswith(("frontend", "client", "src/components")):
        return "frontend"
    if path.endswith((".py", ".go", ".java")) or info["routes"] or low.startswith(("backend", "server", "api")):
        return "backend"
    return "other"


def analyze(root: str) -> dict:
    files = {}
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if d not in IGNORE]
        for fn in fns:
            ext = os.path.splitext(fn)[1]
            if ext not in LANG:
                continue
            path = os.path.relpath(os.path.join(dp, fn), root).replace(os.sep, "/")
            text = open(os.path.join(dp, fn), encoding="utf-8", errors="ignore").read()
            files[path] = {"lang": LANG[ext], "lines": text.count("\n") + 1,
                           "functions": [], "classes": [], "imports": [], "routes": []}
            info = files[path]
            if ext == ".py":
                try:                                        # Python AST: exact definitions + imports
                    for n in ast.walk(ast.parse(text)):
                        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
                            info["functions"].append({"name": n.name, "line": n.lineno, "end": n.end_lineno})
                        elif isinstance(n, ast.ClassDef):
                            info["classes"].append({"name": n.name, "line": n.lineno})
                        elif isinstance(n, ast.Import):
                            info["imports"] += [a.name for a in n.names]
                        elif isinstance(n, ast.ImportFrom) and n.module:
                            info["imports"].append(n.module)
                except SyntaxError:
                    pass
            elif ext in (".js", ".jsx", ".ts", ".tsx"):    # regex-based JS/TS analysis
                info["imports"] = JS_IMPORT.findall(text)
                for i, line in enumerate(text.splitlines(), 1):
                    m = re.search(r"function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(.*\)\s*=>", line)
                    if m:
                        info["functions"].append({"name": m.group(1) or m.group(2), "line": i, "end": i + 15})
                    c = re.search(r"class\s+(\w+)", line)
                    if c:
                        info["classes"].append({"name": c.group(1), "line": i})
            if ext in (".py", ".js", ".ts", ".jsx", ".tsx"):
                for i, line in enumerate(text.splitlines(), 1):
                    m = ROUTE.search(line)
                    if m and "/" in m.group(2):
                        info["routes"].append({"method": m.group(1).upper(), "path": m.group(2), "line": i})
    edges = []
    for p, info in files.items():
        for spec in info["imports"]:
            t = _resolve(spec, p, files)
            if t and t != p:
                edges.append({"source": p, "target": t})
    edges = [dict(t) for t in {tuple(e.items()) for e in edges}]
    deps = {}
    for name, parser in (("requirements.txt", lambda t: [re.split(r"[=<>~\[ ]", l)[0] for l in t.splitlines() if l.strip() and not l.startswith("#")]),):
        pass
    for p in files:
        if p.endswith("requirements.txt"):
            txt = open(os.path.join(root, p), errors="ignore").read()
            deps["python"] = [re.split(r"[=<>~\[ ]", l)[0] for l in txt.splitlines() if l.strip() and not l.startswith("#")]
        if p.endswith("package.json"):
            import json
            try:
                pj = json.load(open(os.path.join(root, p)))
                deps.setdefault("javascript", []).extend({**pj.get("dependencies", {}), **pj.get("devDependencies", {})}.keys())
            except ValueError:
                pass
    folders = Counter(p.split("/")[0] if "/" in p else "(root)" for p in files)
    stats = {"files": len(files), "lines": sum(f["lines"] for f in files.values()),
             "languages": dict(Counter(f["lang"] for f in files.values())),
             "folders": dict(folders),
             "functions": sum(len(f["functions"]) for f in files.values()),
             "classes": sum(len(f["classes"]) for f in files.values()),
             "dependencies": sum(len(v) for v in deps.values()), "edges": len(edges)}
    deg = Counter()
    for e in edges:
        deg[e["source"]] += 1; deg[e["target"]] += 1
    stats["most_connected"] = [{"name": k, "value": v} for k, v in deg.most_common(10)]
    stats["layers"] = dict(Counter(layer(p, f) for p, f in files.items()))
    return {"files": files, "edges": edges, "dependencies": deps, "stats": stats}


def build_architecture(a: dict, limit=40) -> dict:
    """Nodes/edges for React Flow, derived only from verified import edges and detected routes."""
    degree = Counter()
    for e in a["edges"]:
        degree[e["source"]] += 1; degree[e["target"]] += 1
    keep = [p for p, _ in degree.most_common(limit)] or list(a["files"])[:limit]
    kind = lambda p: ("database" if layer(p, a["files"][p]) == "database" else "route" if a["files"][p]["routes"] else "component" if p.endswith((".jsx", ".tsx"))
                      else "backend" if p.endswith(".py") else "module")
    nodes = [{"id": p, "kind": kind(p), "layer": layer(p, a["files"][p]), "label": p.split("/")[-1], "path": p,
              "functions": [f["name"] for f in a["files"][p]["functions"]][:15],
              "routes": a["files"][p]["routes"], "lines": a["files"][p]["lines"]} for p in keep]
    return {"nodes": nodes, "edges": [e for e in a["edges"] if e["source"] in keep and e["target"] in keep]}
