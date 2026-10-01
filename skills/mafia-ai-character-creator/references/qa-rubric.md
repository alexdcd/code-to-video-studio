# Character QA rubric

Do not mark a character `ready` until the applicable release gates pass.

## Identity

- Same silhouette language and proportions across views/actions.
- Same face construction, palette, materials, markings, accessories, and prop design.
- No accidental new objects, text, logos, limbs, facial features, or costume changes.

## Views

- Default canonical views exist unless the manifest explicitly declares a different view system.
- `front -> q -> side -> qback -> back` reads as a coherent turn.
- No conspicuous baseline jump, scale pop, crop, or identity change.

## Acting

- `idle` is alive but not distracting.
- Each declared action is visibly distinct and semantically correct.
- Fast actions have readable anticipation/impact; important reactions have enough hold time to read.
- Props physically contact hands/body where intended.

## Technical

- Same input time/state/seed is deterministic.
- Renderer is seek-safe.
- No uncontrolled time/randomness APIs.
- Required entrypoint and declared API symbols exist.
- Reference and QA files are portable relative paths.

## Visual review artifacts

Release QA should include:

- view sheet;
- contact sheet covering core expressions/actions;
- at least one motion preview or strip;
- `view-continuity.json`;
- `determinism.json`;
- package validation report.

## Independent review

When the host supports subagents/review workers, the final visual reviewer should not be the same worker that authored the last repair. If independent review is unavailable, ask the user for explicit visual approval of the final QA sheet.

## Repair policy

Repair the smallest coherent scope that can be safely replaced: a view, an action implementation, a complete generated pose set, or a renderer component. Do not patch a single generated raster frame into an otherwise coherent generated sequence if doing so causes style or motion discontinuity.
