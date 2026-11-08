---
name: creative-review
description: Review a HyperFrames storyboard or render against its brief, inspected visual evidence, named style rules, reference fidelity, and technical checks; make bounded scene-local repairs and document the recheck.
---

# Creative Review

## Purpose

Review what the viewer can actually see. Do not turn taste into a score. Technical blockers and visual findings must point to evidence; a capture command or source-code review is never proof that a frame was inspected.

## Pre-animation storyboard review

### When to run it

It is optional. The user decides when the request says so: «revisa el storyboard antes de animar» makes it mandatory; «directo», «sin revisión previa» or similar skips it. Otherwise decide yourself and say which you chose in one line.

- **Run it** when scenes are hand-built or complex (characters, acting, props, dense layouts), there are many scenes, or the style is unfamiliar: a wrong composition would be animated and re-rendered.
- **Skip it** when scenes are generated from data or a tested template, the video is short and simple, or a render costs less than the review. Capturing poses is still free; just do not claim a review.

A test (same 15 s video in two styles, with and without this step) showed it catches static defects early (size, contrast, overlaps) but not motion defects or a final fade, and it paid off only when it prevented a render-and-sheet cycle.

When you run it, the default is light: capture round `00`, open the contact sheet (and full-size frames only where something looks wrong), repair, and verify the repair in the next round. Fill the full `REVIEW.md` and run `--validate` only when the user asks for a formal `PASS`; never write `PASS` without having opened the images.

Procedure:

1. Read the project `BRIEF.md` and `STORYBOARD.md`. Read the selected style's `GUIA.md` and `FRAME.md` when they exist, plus any explicitly selected treatment guide. Do not infer a style from old projects. Use the project's named rules, not another style's look or pacing.
2. Capture the first key poses and preserve them in a numbered round:

   ```bash
   pnpm run poses <project> --round 00
   pnpm run review <project> --stage storyboard --round 00
   pnpm run poses <project> --verify-round 00
   ```

   `poses` records the scene, sample time, frame path, input hashes, and evidence hashes. `review` writes a `NOT_REVIEWED` report template; it does not inspect images or approve the storyboard.
3. Open `hoja.jpg` and inspect every linked scene frame in `renders/storyboard-review/round-00/`. Open the full-size PNGs when the contact sheet is too small to establish crop, text, expression, or hand/object contact. If the environment cannot display a frame, write `NOT_REVIEWED` or `UNKNOWN` and name the limitation. Never infer a visual pass from HTML, CSS, JavaScript, a successful snapshot, or an uninspected contact sheet.
4. Compare each image with the event and ordered readings in the storyboard. The first key pose is a layout check; it cannot prove an action or transition that is not shown. For an internal cut or acting moment, capture only an explicit storyboard time with `--at`. Do not invent a timestamp. `--scene id1,id2` can limit a round to selected timeline scene IDs; record the report's `selected` coverage, and do not use partial coverage to approve the whole storyboard.
5. Repair only the responsible composition or project-owned asset. Preserve approved wording, facts, brand decisions, and timings. If a repair would change one of those decisions, stop and record the decision needed.
6. Capture the repaired state in the next unused repair round (`01`, then `02`) and inspect the new frames. The tool creates same-scene, same-time before/after sheets using the latest matching sample from any prior round. Open those comparisons and the new full-size frame; record whether each finding is resolved. Check related scenes for regressions. Never overwrite a round or its report.
7. Permit at most two repair rounds. If a finding remains after round `02`, stop. Partial captures are useful for repair but cannot support a global decision. A `PASS` or `PASS WITH WARNINGS` needs a fresh complete capture with both baseline samples for every current timeline scene. If round `02` was partial, use `pnpm run poses <project> --round 03` for that final full capture; round `03` rejects `--scene`. After visually completing the report, run `pnpm run review <project> --stage storyboard --round NN --validate`. The read-only validator requires fresh complete evidence, every review prompt checked, a reviewer, and findings resolved or explicitly accepted with current-round recheck links; it does not inspect images or write approval. Any blocker means `REVISE`; there is no automatic rendering or approval path.

If `--verify-round` returns `STALE`, the captured project inputs changed after those frames were made. Keep them only as before-state evidence and capture the edited state into the next round. A `STALE` round cannot be recaptured under its own number (existing rounds are never overwritten): use the next free round (`00`–`03`); if all four exist, move the old `round-NN` folder out of `renders/storyboard-review/` (for example to `renders/storyboard-review-archive/`) before reusing its number, so the before-state evidence is kept. `UNKNOWN`, a missing image, or an image that cannot be opened cannot support `PASS`.

For a resolved finding, link the observed frame in its `Evidence path` cell and link the current-round recheck frame in `After repair`. Use `RESOLVED` for fixes and `ACCEPTED` only for a documented warning under `PASS WITH WARNINGS`. When no actionable issue remains, replace the findings placeholder with `No actionable findings.` The validator checks these links against round manifests; older, hash-valid images may document the original finding even when their project digest is stale.

## What to inspect

For every scene in scope, check:

### Composition and clarity

- Can a viewer identify the main subject and understand the event in about one second?
- Is there a clear reading order and focal point at phone size?
- Are important subjects, text, limbs, props, or diagrams hidden or cropped?
- Do contrast, separation from the background, aspect ratio, and safe margins fit the selected style and delivery format?
- Does the first visible frame contain the intended content, or an accidental empty start?

### Narrative and information

- Does the image show the storyboard's event and communicate its ordered readings?
- Does it contradict a fact, relationship, or scale in the brief or script?
- Does it reveal a conclusion before the intended moment, or omit a visual needed to understand the explanation?
- Do captions duplicate the meaning already communicated by the image or on-screen text?

### Continuity and acting

- Check continuity only when the brief calls for it or a subject recurs. Compare its silhouette, scale, position, materials, clothing, and accessories across the relevant scenes.
- If a character is present, reuse `mafia-ai-character-creator` and its QA rubric. Check pose meaning, anticipation, readable action and result, reaction, hand/object contact, and accidental deformation. Do not run character generation or demand a full character sheet just to review a scene.
- If poses do not show a required action, capture the exact action times stated in the storyboard. Separate anticipation, action, and reaction when the storyboard gives those moments. A deliberate hold is not a defect.

### Style and reference

- Apply only the style, treatment, and reference fidelity explicitly selected for this project. Respect their `GUIA.md`, `FRAME.md`, `keep`, and `transform` rules when present.
- Do not require characters, monochrome, perspective, lighting, a minimum object count, a cut rate, or visual density unless the selected brief or style says so.
- Keep the work original. Do not copy reference-specific text, drawings, marks, identity, or logos.

## Findings and decisions

Record findings in the round's `REVIEW.md`; keep IDs stable across rounds (`SV-001`, `SV-002`, …). Every finding includes:

- scene ID and exact second (or explicit storyboard interval);
- relative path to the frame that shows the issue;
- severity `BLOCKER` or `WARNING`;
- the visible fact and why it affects comprehension or quality;
- one bounded correction;
- after-repair state `RESOLVED`, `OPEN`, `NOT_REVIEWED`, or `UNKNOWN`, with the new evidence path.

Use `BLOCKER` only for a major, unambiguous defect or an invalidating technical problem. A subjective preference is a `WARNING`, not a blocker. Do not assign numerical taste scores.

Choose exactly one decision:

- `NOT_REVIEWED`: no actual image inspection, evidence missing/stale, or inspection unavailable.
- `REVISE`: at least one blocker remains, or required coverage/evidence is incomplete.
- `PASS`: all required checks and full coverage are complete, the evidence is fresh, and no actionable finding remains.
- `PASS WITH WARNINGS`: no blocker remains; each remaining creative warning has evidence and explicit acceptance. Do not use this to conceal uncertainty.

The review skill never writes approval to `meta.json`. Only use the project's existing explicit storyboard approval command after the user authorizes approval.

## Render review

For a render review, use the existing `pnpm run review <project>` output. Use a fresh reviewer when available and provide only the brief, storyboard, relevant reference analysis or style guide, and review folder. Inspect the supplied scene frames and contact sheets. Technical measurements identify where to look; they do not decide creative quality.

1. Check technical blockers first: HyperFrames check, unresolved assets, duration mismatch beyond one frame, true peak above −1 dBFS, and missing declared audio. Keep blockers separate from creative warnings.
2. Check scene frames, reference pairs, and transition strips. Confirm that a storyboard finding did not return after full animation.
3. Record scene, second, evidence path, visible fact, impact, and one concrete fix. Inspect related scenes after finding a repeated issue.
4. Stop after two repair rounds. Persistent blockers remain `REVISE`; only explicitly accepted warnings may receive `PASS WITH WARNINGS`.

## Audio and rhythm boundaries

The visual review does not certify audio intelligibility. Existing loudness, peak, silence, music, and ducking checks remain in their current tools. Do not infer word intelligibility from an overall LUFS or dB threshold. Existing rhythm analysis supports the review; do not add a new general rhythm score or global cut-rate rule.
