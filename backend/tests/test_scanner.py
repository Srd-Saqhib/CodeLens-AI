import pytest
from app import scanner

def test_url_ok():
    assert scanner.parse_url("https://github.com/a/b") == ("a", "b")

def test_url_bad():
    with pytest.raises(ValueError):
        scanner.parse_url("https://evil.com/a/b")

def test_analyze(tmp_path):
    (tmp_path / "a.py").write_text("import b\ndef f(): pass\n")
    (tmp_path / "b.py").write_text("x = 1\n")
    r = scanner.analyze(str(tmp_path))
    assert r["stats"]["functions"] == 1
    assert {"source": "a.py", "target": "b.py"} in r["edges"]
