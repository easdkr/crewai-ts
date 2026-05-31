#!/usr/bin/env python3
"""Check package subpath exports against upstream CrewAI Python modules."""

from __future__ import annotations

import json
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = Path(
    os.environ.get(
        "UPSTREAM_CREWAI_SRC",
        "/tmp/crewai-upstream-current/lib/crewai/src/crewai",
    )
)


def upstream_module_path(path: Path) -> str:
    if path.name == "__init__.py":
        value = str(path.parent.relative_to(UPSTREAM))
        return "" if value == "." else value
    return str(path.with_suffix("").relative_to(UPSTREAM))


def main() -> int:
    if not UPSTREAM.exists():
        raise SystemExit(f"Upstream source tree not found: {UPSTREAM}")

    package = json.loads((ROOT / "package.json").read_text())
    exports = {
        key[2:]
        for key in package["exports"]
        if key.startswith("./") and key != "./package.json"
    }
    upstream_modules = {
        value
        for value in (upstream_module_path(path) for path in UPSTREAM.rglob("*.py"))
        if value
    }
    missing = sorted(upstream_modules - exports)

    print(f"upstream={UPSTREAM}")
    print(f"package_exports={len(exports)}")
    print(f"upstream_modules={len(upstream_modules)}")
    print(f"total_missing={len(missing)}")
    for path in missing[:120]:
        print(path)
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
