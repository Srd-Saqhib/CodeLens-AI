"""Static execution-flow inference. Edges are verified import relationships; the narrative is optional AI text."""
import os, re
from collections import Counter

STOP = {"does", "how", "what", "where", "work", "works", "the", "this", "that", "with", "from", "when", "which", "user", "explain"}
ORDER = {"frontend": 0, "backend": 1, "database": 2, "other": 3}


def build_flow(a, root, question, layer_fn):
    words = [w for w in re.findall(r"[a-z]{4,}", question.lower()) if w not in STOP]
    score, refs = Counter(), {}
    for p in a["files"]:
        for w in words:
            if w in p.lower():
                score[p] += 3
        try:
            lines = open(os.path.join(root, p), encoding="utf-8", errors="ignore").read().splitlines()
        except OSError:
            continue
        for i, line in enumerate(lines, 1):
            if any(w in line.lower() for w in words):
                score[p] += 1
                refs.setdefault(p, []).append({"line": i, "text": line.strip()[:120]})
    seeds = [p for p, _ in score.most_common(3)]
    if not seeds:
        return {"nodes": [], "edges": [], "steps": [], "note": "No files matched this feature."}
    keep = set(seeds)
    for e in a["edges"]:                                    # 1-hop expansion over verified imports
        if e["source"] in seeds or e["target"] in seeds:
            keep |= {e["source"], e["target"]}
    keep = sorted(keep, key=lambda p: (ORDER[layer_fn(p, a["files"][p])], -score[p]))[:15]
    nodes = [{"id": p, "layer": layer_fn(p, a["files"][p]), "seed": p in seeds, "refs": refs.get(p, [])[:5]} for p in keep]
    edges = [{**e, "verified": True} for e in a["edges"] if e["source"] in keep and e["target"] in keep]
    steps = [{"file": n["id"], "layer": n["layer"], "refs": n["refs"],
              "why": "matches your question" if n["seed"] else "directly imports / is imported by a matching file"} for n in nodes]
    return {"nodes": nodes, "edges": edges, "steps": steps,
            "note": "Static analysis: files matched by keywords, edges are import relationships. Not runtime tracing."}
