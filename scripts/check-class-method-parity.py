#!/usr/bin/env python3
"""Check upstream core class method parity against local TypeScript classes."""

from __future__ import annotations

import ast
import os
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = Path(
    os.environ.get(
        "UPSTREAM_CREWAI_SRC",
        "/tmp/crewai-upstream-current/lib/crewai/src/crewai",
    )
)

TARGETS = [
    ("Crew", UPSTREAM / "crew.py", ROOT / "src" / "crew.ts"),
    ("Agent", UPSTREAM / "agent" / "core.py", ROOT / "src" / "agent.ts"),
    ("Task", UPSTREAM / "task.py", ROOT / "src" / "task.ts"),
    ("LiteAgent", UPSTREAM / "lite_agent.py", ROOT / "src" / "lite-agent.ts"),
    ("Memory", UPSTREAM / "memory" / "unified_memory.py", ROOT / "src" / "memory.ts"),
]


def python_class_methods(path: Path, class_name: str) -> list[str]:
    tree = ast.parse(path.read_text())
    for node in tree.body:
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            return [
                item.name
                for item in node.body
                if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef))
            ]
    raise SystemExit(f"Class {class_name} not found in {path}")


def typescript_class_members(path: Path) -> set[str]:
    text = path.read_text()
    method_pattern = re.compile(
        r"^  (?:(?:public|private|protected|async|static|override)\s+)*"
        r"([A-Za-z_][A-Za-z0-9_]*)"
        r"(?:<[^>\n]+>)?\(",
        re.MULTILINE,
    )
    getter_pattern = re.compile(r"^  get ([A-Za-z_][A-Za-z0-9_]*)\(", re.MULTILINE)
    property_pattern = re.compile(
        r"^  (?:(?:public|private|protected|readonly|static)\s+)*"
        r"([A-Za-z_][A-Za-z0-9_]*)\??\s*[:=]",
        re.MULTILINE,
    )
    return (
        set(method_pattern.findall(text))
        | set(getter_pattern.findall(text))
        | set(property_pattern.findall(text))
    )


def snake_to_camel(value: str) -> str:
    value = value.lstrip("_")
    return re.sub(r"_([a-zA-Z])", lambda match: match.group(1).upper(), value)


def local_candidates(upstream_name: str) -> set[str]:
    camel = snake_to_camel(upstream_name)
    candidates = {
        upstream_name,
        upstream_name.lstrip("_"),
        camel,
    }
    if upstream_name.startswith("_") and not upstream_name.startswith("__"):
        candidates.add(f"_{camel}")
    if upstream_name == "__repr__":
        candidates.add("toString")
    return candidates


def main() -> int:
    if not UPSTREAM.exists():
        raise SystemExit(f"Upstream source tree not found: {UPSTREAM}")

    total_missing = 0
    for class_name, upstream_path, local_path in TARGETS:
        upstream_methods = python_class_methods(upstream_path, class_name)
        local_members = typescript_class_members(local_path)
        missing = [
            name
            for name in upstream_methods
            if local_candidates(name).isdisjoint(local_members)
        ]
        print(f"{class_name}: upstream_methods={len(upstream_methods)} local_members={len(local_members)} missing={len(missing)}")
        if missing:
            total_missing += len(missing)
            print("  " + ",".join(missing))

    print(f"total_missing={total_missing}")
    return 1 if total_missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
