#!/usr/bin/env python3
"""Check root export name parity against an upstream crewAI source tree."""

from __future__ import annotations

import ast
import json
import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = Path(
    os.environ.get(
        "UPSTREAM_CREWAI_SRC",
        "/tmp/crewai-upstream.lPeuQi/crewAI/lib/crewai/src/crewai",
    )
)


def py_names(path: Path) -> set[str]:
    try:
        tree = ast.parse(path.read_text())
    except Exception:
        return set()

    explicit: set[str] | None = None
    names: set[str] = set()
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and not node.name.startswith("_"):
            names.add(node.name)
        elif isinstance(node, ast.Assign):
            if any(isinstance(target, ast.Name) and target.id == "__all__" for target in node.targets):
                try:
                    value = ast.literal_eval(node.value)
                    if isinstance(value, (list, tuple)):
                        explicit = {item for item in value if isinstance(item, str) and not item.startswith("_")}
                except Exception:
                    pass
            for target in node.targets:
                if isinstance(target, ast.Name) and not target.id.startswith("_"):
                    names.add(target.id)
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and not node.target.id.startswith("_"):
            names.add(node.target.id)
    return explicit if explicit is not None else names


def main() -> int:
    if not UPSTREAM.exists():
        raise SystemExit(f"Upstream source tree not found: {UPSTREAM}")

    package = json.loads((ROOT / "package.json").read_text())
    exports = [
        key[2:]
        for key in package["exports"]
        if key.startswith("./") and key != "./package.json"
    ]
    js_keys = set(
        json.loads(
            subprocess.check_output(
                [
                    "node",
                    "--input-type=module",
                    "-e",
                    "import('./dist/index.js').then(m=>console.log(JSON.stringify(Object.keys(m))))",
                ],
                cwd=ROOT,
                text=True,
            )
        )
    )

    rows: list[tuple[int, str, list[str]]] = []
    total = 0
    for export_path in exports:
        py_path = UPSTREAM / f"{export_path}.py"
        if not py_path.exists():
            init_path = UPSTREAM / export_path / "__init__.py"
            if init_path.exists():
                py_path = init_path
            else:
                continue
        missing = sorted(name for name in py_names(py_path) if name not in js_keys)
        if missing:
            total += len(missing)
            rows.append((len(missing), export_path, missing[:60]))

    print(f"upstream={UPSTREAM}")
    print(f"package_exports={len(exports)}")
    print(f"root_export_keys={len(js_keys)}")
    print(f"total_missing={total}")
    for count, export_path, missing in sorted(rows, reverse=True)[:45]:
        print(f"./{export_path} ({count})")
        print("  " + ",".join(missing))
    return 1 if total else 0


if __name__ == "__main__":
    raise SystemExit(main())
