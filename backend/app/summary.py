"""AI project explanation built from real analysis data; results are cached in SQLite by main.py."""
import os
from .gemini import call_with_transient_error_retry


def build_context(a, root):
    files = a["files"]
    top = [x["name"] for x in a["stats"]["most_connected"]]
    readme = next((p for p in files if p.lower().endswith("readme.md")), None)
    head = open(os.path.join(root, readme), errors="ignore").read()[:2500] if readme else "(none)"
    lines = [f"- {p}: {f['lang']}, {f['lines']} lines, functions: {[x['name'] for x in f['functions']][:8]}"
             for p, f in list(files.items())[:120]]
    routes = [f"{r['method']} {r['path']} ({p})" for p, f in files.items() for r in f["routes"]][:40]
    return (f"STATS: {a['stats']}\nDEPENDENCIES: {a['dependencies']}\nROUTES: {routes}\n"
            f"MOST CONNECTED: {top}\nREADME START:\n{head}\nFILES:\n" + "\n".join(lines))[:30000]


def generate(a, root, mode):
    from google import genai
    style = ("Explain for someone new to programming; avoid jargon." if mode == "beginner"
             else "Give technical detail: modules, APIs, dependencies, data flow.")
    prompt = ("You are explaining a repository. Use ONLY the data below; never invent files or technologies. "
              "Sections (markdown ##): Purpose, Description, Main functionality, Tech stack, Frontend, Backend, Database, "
              "Folders, Important files, How modules communicate, Architectural observations. Write 'Not detected' when "
              f"evidence is missing. {style}\n\n" + build_context(a, root))
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    response = call_with_transient_error_retry(
        client.models.generate_content,
        model=os.getenv("GEMINI_MODEL", "gemini-3.8-flash"), contents=prompt)
    return response.text
