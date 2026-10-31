---
name: creative-review
description: Review a HyperFrames storyboard or render against its brief, visual evidence, named style rules, reference fidelity, and technical checks; write concrete findings with frame-based evidence and fixes.
---

# Creative Review

## Purpose

Give a production a useful final review without turning taste into a score. Technical blockers come from the review report. Creative findings are warnings that describe visible evidence and a practical change.

## Inputs

For a storyboard review, read only the project `BRIEF.md`, `STORYBOARD.md`, the relevant reference analysis or style guide, and `renders/storyboard-review/`.

For a render review, use a fresh reviewer when available. Provide only the brief, storyboard, relevant reference analysis or style guide, and the review folder. Do not provide the build conversation or ask the reviewer to inspect source code. Review the supplied contact sheets and scene frames.

## Review sequence

1. Read the declared mode, named style, reference ID, fidelity, and `keep` / `transform` / `ignore` choices. If a field is absent, report `unknown`; do not infer it from old project conventions.
2. Check technical blockers first: HyperFrames check, unresolved assets, duration difference greater than one frame, true peak above −1 dBFS, and missing audio when the brief declares voice or music. Keep each blocker separate from creative warnings.
3. Inspect the storyboard timing or every supplied scene frame. Check the planned reading order, repeated primary subjects, signature-device frequency, text duplication, and whether the work has its own identity.
4. With a style, inspect the style's concrete usage rules. Count only traits that have an explicit rule; cite the scenes and frames where the count comes from.
5. With a reference, compare according to fidelity: `close` compares every ingredient; `essence` enforces `keep` and the agreed `transform` rules; `loose` reports without warning. Always check `Do not copy`.
6. For a render with reference pairs, compare the eight matched relative positions. Use those pairs as evidence, not as a similarity score.
7. For each issue, cite the scene, second, and frame file, then state one concrete fix. After finding a problem, inspect other scenes for the same problem. Stop after two review rounds; unresolved items become `PASS WITH WARNINGS` only if no blocker remains.

## Decision

Choose exactly one: `PASS`, `REVISE`, or `PASS WITH WARNINGS`. Any blocker means `REVISE`. Use `PASS` only when all checks are complete and there are no actionable warnings. `PASS WITH WARNINGS` is for a render with no blocker and remaining, explicitly accepted creative concerns.

Do not finalize a decision from a pre-filled template. The reviewer must inspect the visual evidence and write the findings table. Never use code reading as a substitute for frame review.

## OpenMontage provenance

This skill was written from the Studio plan and fresh research notes after reviewing related critique and reviewer concepts. Concepts inspired by OpenMontage; no code or text reused. Its checks are adapted to HyperFrames' brief, timeline, QA report, and frame evidence, without a scoring rubric or pipeline layer.
