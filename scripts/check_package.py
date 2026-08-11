#!/usr/bin/env python3
"""Validate package-level invariants without third-party dependencies."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILLS = {
    "ep-setup",
    "ep-audit",
    "ep-fix",
    "ep-review-architecture",
}
VERSION = "0.1.0"
MANIFESTS = (
    ROOT / "plugin.json",
    ROOT / ".claude-plugin/plugin.json",
    ROOT / ".codex-plugin/plugin.json",
    ROOT / "gemini-extension.json",
)


def read_json(path: Path) -> dict[str, object]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"{path.relative_to(ROOT)}: invalid JSON: {error}") from error
    if not isinstance(value, dict):
        raise ValueError(f"{path.relative_to(ROOT)}: expected a JSON object")
    return value


def frontmatter(markdown: str, path: Path) -> str:
    match = re.match(r"\A---\n(.*?)\n---\n", markdown, flags=re.DOTALL)
    if match is None:
        raise ValueError(f"{path.relative_to(ROOT)}: missing YAML frontmatter")
    return match.group(1)


def scalar(frontmatter_text: str, field: str) -> str | None:
    match = re.search(rf"(?m)^{re.escape(field)}:\s*[\"']?([^\"'\n]+)", frontmatter_text)
    return match.group(1).strip() if match else None


def metadata_version(frontmatter_text: str) -> str | None:
    match = re.search(
        r'(?ms)^metadata:\s*\n(?:^[ \t]+.*\n)*?^[ \t]+version:\s*["\']?([^"\'\n]+)',
        frontmatter_text,
    )
    return match.group(1).strip() if match else None


def check_links(path: Path, errors: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", text):
        if target.startswith(("http://", "https://", "mailto:", "#")):
            continue
        target_path = target.split("#", 1)[0]
        if not target_path or any(
            marker in target_path for marker in ("<", ">", "*", "…")
        ):
            continue
        resolved = (path.parent / target_path).resolve()
        if not resolved.exists():
            errors.append(
                f"{path.relative_to(ROOT)}: broken local link {target!r}"
            )


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    discovered = {
        path.parent.name for path in (ROOT / "skills").glob("*/SKILL.md")
    }
    if discovered != SKILLS:
        errors.append(
            f"skills/: expected {sorted(SKILLS)}, found {sorted(discovered)}"
        )

    for manifest_path in MANIFESTS:
        try:
            manifest = read_json(manifest_path)
        except ValueError as error:
            errors.append(str(error))
            continue
        if manifest.get("name") != "engineering-principles":
            errors.append(
                f"{manifest_path.relative_to(ROOT)}: unexpected plugin name"
            )
        if manifest.get("version") != VERSION:
            errors.append(
                f"{manifest_path.relative_to(ROOT)}: version must be {VERSION}"
            )

    for skill in sorted(SKILLS):
        skill_dir = ROOT / "skills" / skill
        skill_path = skill_dir / "SKILL.md"
        text = skill_path.read_text(encoding="utf-8")
        try:
            yaml = frontmatter(text, skill_path)
        except ValueError as error:
            errors.append(str(error))
            continue

        if scalar(yaml, "name") != skill:
            errors.append(f"{skill_path.relative_to(ROOT)}: name must match directory")
        if scalar(yaml, "license") != "MIT":
            errors.append(f"{skill_path.relative_to(ROOT)}: license must be MIT")
        if metadata_version(yaml) != VERSION:
            errors.append(
                f"{skill_path.relative_to(ROOT)}: metadata.version must be {VERSION}"
            )
        eval_path = skill_dir / "evals/evals.json"
        if not eval_path.exists():
            errors.append(f"{skill_dir.relative_to(ROOT)}: missing evals/evals.json")
        else:
            try:
                eval_set = read_json(eval_path)
            except ValueError as error:
                errors.append(str(error))
            else:
                if eval_set.get("skill_name") != skill:
                    errors.append(
                        f"{eval_path.relative_to(ROOT)}: skill_name must be {skill}"
                    )
                evals = eval_set.get("evals")
                if not isinstance(evals, list) or len(evals) < 3:
                    errors.append(
                        f"{eval_path.relative_to(ROOT)}: expected at least 3 evals"
                    )

        line_count = len(text.splitlines())
        if line_count > 500:
            warnings.append(
                f"{skill_path.relative_to(ROOT)}: {line_count} lines; "
                "open-spec guidance recommends fewer than 500"
            )

    setup_text = (ROOT / "skills/ep-setup/SKILL.md").read_text(encoding="utf-8")
    bundled_absolute = re.findall(
        r"\.agents/skills/ep-setup/"
        r"(?:principles|agents-md|skills-readme|claude-md|"
        r"copilot-instructions|fallowrc)\.md",
        setup_text,
    )
    if bundled_absolute:
        errors.append(
            "skills/ep-setup/SKILL.md: bundled resources must use relative paths"
        )

    for markdown_path in ROOT.rglob("*.md"):
        if ".git" not in markdown_path.parts:
            check_links(markdown_path, errors)

    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)

    if errors:
        return 1
    print(f"Package checks passed for {len(SKILLS)} skills at version {VERSION}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
