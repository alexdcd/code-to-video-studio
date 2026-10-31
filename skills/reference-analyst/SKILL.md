---
name: reference-analyst
description: Analyze a user-selected video reference with measured media data and inspected frames, then document reusable ingredients, evidence, usage rules, and content to avoid copying.
---

# Reference Analyst

## Purpose

Turn a video reference into an evidence-backed set of creative choices for a HyperFrames project. Measurements support the reading; they do not replace it. Do not analyze a reference unless the user or project brief asks for one.

## Workflow

1. Confirm the reference is named in the brief or requested by the user. Use `pnpm run analyze <video> --mode reference --name <slug>`; for project footage, use `--mode source --project <project-name>`.
2. Open the generated contact sheet and a representative set of three-frame shot strips. Verify scene changes, read visible text, and note where the image changes. Never infer the look from code, a filename, or the measurement table alone.
3. Write `ANALYSIS.md` in the reference folder. Give every ingredient a stable ID, a description, evidence with times and strip paths, and a use rule that states where and how often it appears. Mark missing ingredients `n/a`.
4. Separate what is visible from interpretation. Label uncertain speech or illegible text as unknown; do not fetch or install transcription models. If a local transcript already exists, check it against the frames.
5. Close the analysis with `Do not copy` and `Suggested choice`. For each ingredient, recommend `keep`, `transform`, or `ignore`; the user makes the choice.
6. Record the chosen ingredients and fidelity in the project's `BRIEF.md`. Translate each kept rule into a concrete storyboard decision about layout, timing, sound, or motion. Change the subject and all reference-specific text, drawings, identity, and marks.

## Evidence standard

- Preserve the output of `pnpm run analyze`; do not hand-edit its measurements.
- For cut rhythm, inspect the 10 fps contact sheet and verify detector events against visible changes. State the selected threshold and any merge rule.
- Cite local evidence as `strips/shot-NNN.jpg` and include the observed time range. Contact sheets and extracted frames are local-only and must stay out of Git.
- Distinguish a measured result from a visual observation and from an inference.
- Treat technical defects as evidence to avoid, not as style traits.

## OpenMontage provenance

This workflow was written for this Studio after reviewing related reference-analysis concepts. Concepts inspired by OpenMontage; no code or text reused. It uses the Studio's FFmpeg measurements, ignored frame evidence, brief, and storyboard rather than a separate media-review system.
