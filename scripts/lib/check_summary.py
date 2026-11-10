#!/usr/bin/env python3
"""Render a readable summary of HyperFrames' machine-readable check report."""

import json
import sys
from pathlib import Path


def _counts(section):
    return (
        f"{section.get('errorCount', 0)} error(s), "
        f"{section.get('warningCount', 0)} warning(s), "
        f"{section.get('infoCount', 0)} info(s)"
    )


def _finding_lines(finding):
    code = finding.get("code", "finding")
    message = finding.get("message", "")
    lines = [f"  {finding.get('severity', 'info')}: {code}: {message}".rstrip()]
    location = " ".join(
        value for value in (
            finding.get("sourceFile"),
            finding.get("selector"),
            f"t={finding['time']}s" if finding.get("time") is not None else None,
        ) if value
    )
    if location:
        lines.append(f"    {location}")
    if finding.get("fixHint"):
        lines.append(f"    Fix: {finding['fixHint']}")
    return lines


def _section(lines, title, section, *, layout=False):
    section = section or {}
    findings = section.get("findings") or []
    lines.extend(("", title))
    if not findings:
        if layout:
            lines.append(f"  ◇ 0 issues across {len(section.get('samples') or [])} sample(s)")
        else:
            lines.append("  ◇ 0 errors, 0 warnings")
    else:
        for finding in findings:
            lines.extend(_finding_lines(finding))
        lines.append(f"  {_counts(section)}")
    if layout and section.get("transitionSamplesDropped", 0) > 0:
        lines.append(f"  ⚠ {section['transitionSamplesDropped']} transition sample(s) omitted")


def format_report(report):
    lines = []
    if report.get("error"):
        lines.extend((f"Check failed: {report['error']}", "", "◇  Check failed"))
        return "\n".join(lines) + "\n"

    _section(lines, "Lint", report.get("lint"))
    _section(lines, "Runtime", report.get("runtime"))
    _section(lines, "Layout", report.get("layout"), layout=True)
    _section(lines, "Motion", report.get("motion"))

    contrast = report.get("contrast") or {}
    lines.extend(("", "Contrast"))
    if not contrast.get("enabled"):
        lines.append("  ◇ skipped")
    elif not contrast.get("findings"):
        lines.append(f"  ◇ {contrast.get('passed', 0)}/{contrast.get('checked', 0)} text checks pass WCAG AA")
    else:
        for finding in contrast["findings"]:
            selector = finding.get("selector", "")
            ratio = finding.get("ratio", "?")
            required = finding.get("requiredRatio", "?")
            time = finding.get("time", "?")
            lines.append(f"  warning: {selector} {ratio}:1 (need {required}:1, t={time}s)")
            if finding.get("suggestedColor") or finding.get("sourceFile"):
                lines.append(f"    Try {finding.get('suggestedColor', 'a higher-contrast color')}; source {finding.get('sourceFile', 'unknown')}")
        lines.append(f"  {_counts(contrast)}")

    snapshots = report.get("snapshots") or {}
    lines.extend(("", "Snapshots"))
    if not snapshots.get("enabled"):
        lines.append("  ◇ disabled")
    else:
        files = snapshots.get("files") or []
        lines.append(f"  ◇ {len(files)} PNG(s) saved")
        lines.extend(f"    {file}" for file in files)
        finding_files = snapshots.get("findingFiles") or []
        if finding_files:
            lines.append(f"  ◇ {len(finding_files)} finding crop(s) saved")
            lines.extend(f"    {file}" for file in finding_files)

    lines.extend(("", f"◇  {'Check passed' if report.get('ok') else 'Check failed'}"))
    return "\n".join(lines) + "\n"


def main():
    report_path = Path(sys.argv[1])
    report = json.loads(report_path.read_text(encoding="utf-8"))
    sys.stdout.write(format_report(report))


if __name__ == "__main__":
    main()
