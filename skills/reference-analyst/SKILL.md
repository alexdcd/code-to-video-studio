---
name: reference-analyst
description: Analyze a video reference the user or brief names, using measured media data and inspected frames, then document reusable ingredients, evidence, usage rules, and content to avoid copying. Observes and decides what to borrow; it does not build styles.
---

# Reference Analyst

## Purpose

Turn a video reference into an evidence-backed set of creative choices for a HyperFrames project. Measurements support the reading; they do not replace it. Do not analyze a reference unless the user or project brief asks for one.

This skill observes and records; it never builds a style, template, or kit file. If the user requests a reusable style after reviewing the analysis, follow the Studio's public style-creation guide and keep that work separate from reference observation.

## Depth

Pick the lightest depth that answers the request, and say which one you used.

- **Light** (borrow a technique for the current video): identify two or three ingredients, inspect only the frames that show them, and carry the decisions into the project's `BRIEF.md` and storyboard. Stop there.
- **Detailed** (input for a reusable style): cover visual language, rhythm, cuts, motion, and sound across the whole reference.

If an `ANALYSIS.md` for this reference already exists and the source file has not changed, reuse it, except its cut rhythm when its `analysis.json` has `schemaVersion` 1: that version merged cuts under 0.5 s and undercounts fast montages, so re-run `pnpm run analyze` first. Measure or inspect again only what it lacks: missing evidence, a changed source, or moments the new request needs that were never studied.

## Workflow

1. Confirm the reference is named in the brief or requested by the user. Use `pnpm run analyze <video> --mode reference --name <slug>`; for project footage, use `--mode source --project <project-name>`.
2. Open the generated contact sheet and a representative set of three-frame shot strips. Verify scene changes, read visible text, and note where the image changes. Never infer the look from code, a filename, or the measurement table alone. The contact sheet shows one middle frame per detected shot, capped at 60 shots; it is not a frame-by-frame sequence.
3. Write `ANALYSIS.md` in the reference folder. Give every ingredient a stable ID, a description, evidence with times and strip paths, and a use rule that states where and how often it appears. Mark missing ingredients `n/a`.
4. Separate what is visible from interpretation. Label uncertain speech or illegible text as unknown; do not fetch or install transcription models. If a local transcript already exists, check it against the frames.
5. Close the analysis with `Do not copy` and `Suggested choice`. For each ingredient, recommend `keep`, `transform`, or `ignore`; the user makes the choice.
6. Record the chosen ingredients and fidelity in the project's `BRIEF.md`. Translate each kept rule into a concrete storyboard decision about layout, timing, sound, or motion. Change the subject and all reference-specific text, drawings, identity, and marks.

## Evidence standard

- Preserve the output of `pnpm run analyze`; do not hand-edit its measurements.
- For cut rhythm, verify detector events against visible changes and state the threshold. Counts come from FFmpeg's scene score at 0.30, 0.15 (calibrated default) and 0.08; only events on consecutive frames are merged, so shots of two to four frames are kept. The count is an estimate, not a truth: a flash or colour inversion can add an event, and at 0.08 camera motion inside a shot is reported as cuts in animated footage. The contact sheet shows one frame per detected shot, capped at 60.
- To check a suspected fast sequence or a transition, look at consecutive frames around a time `T` instead of generating the whole video as frames. Keep every frame at the source rate: resampling (for example `fps=10`) drops frames and can hide a transition lasting one or two frames. `ffmpeg -ss <T-0.2> -i <video> -vf "scale=320:-2,tile=5x2:padding=4" -frames:v 1 <reference-folder>/window-<T>.jpg` writes the 10 frames from `T-0.2` as one sheet, left to right and top to bottom (0.4 s at 25 fps; for 60 fps use `tile=5x4` and `T-0.1`). Cite the window in `ANALYSIS.md`; it stays local like the other frames.
- Cite local evidence as `strips/shot-NNN.jpg` and include the observed time range. Contact sheets and extracted frames are local-only and must stay out of Git.
- Distinguish a measured result from a visual observation and from an inference.
- Treat technical defects as evidence to avoid, not as style traits.

## OpenMontage provenance

This workflow was written for this Studio after reviewing related reference-analysis concepts. Concepts inspired by OpenMontage; no code or text reused. It uses the Studio's FFmpeg measurements, ignored frame evidence, brief, and storyboard rather than a separate media-review system.
