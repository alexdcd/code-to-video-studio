# Production intelligence

The production commands help an agent inspect references, review evidence, and derive project progress from files already on disk. They are optional: rendering a project does not require reference analysis or creative review.

## Analyze a video

Run analysis only when the user or project brief asks for it. The command accepts a local video file and does not download references or call a transcription service.

```bash
pnpm run analyze ./path/to/reference.mp4 --mode reference --name sample-reference
pnpm run analyze ./path/to/source.mp4 --mode source --project my-video
pnpm run analyze ./renders/my-video-v01.mp4 --mode render --output-dir ./renders/review-analysis
```

Reference mode copies the selected source into `references/<name>/source.<ext>`, measures cuts and audio, and creates a contact sheet with three-frame strips for sampled shots. The entire `references/` tree stays local by default. The agent should inspect the images, fill in `source.json` provenance, then write `ANALYSIS.md` with observed ingredients, evidence, usage rules, and material to avoid copying. Measurements are clues to verify against frames, not creative conclusions.

Source mode writes its results under the named project's `assets/` folder. Render mode can keep the analysis and generated frames in an explicit review folder. Missing tools are reported; analysis does not install dependencies or models.

## Review a project

```bash
pnpm run review my-video --stage storyboard
pnpm run review my-video
pnpm run review my-video --render v01
```

Storyboard review creates a `REVIEW.md` template with timing, subtitle decisions, and declared reference choices. A render review checks the HyperFrames result, media paths, duration, audio and visual signals, then creates frame-based evidence under that render's `renders/` review directory. The reviewer must inspect the supplied frames and write findings; running the command or passing technical checks does not make a creative decision for the author.

Review is optional. It requires the normal local render tools: the pinned HyperFrames CLI, FFmpeg/FFprobe, and Python 3. It does not add a rendering dependency or change the export settings.

## Derive project status

```bash
pnpm run status my-video
pnpm run status my-video --json
pnpm run status my-video --approve storyboard
pnpm run status my-video --approve render v01
```

Status reads `BRIEF.md`, `SCRIPT.md`, `STORYBOARD.md`, `meta.json`, compositions, checks, renders, and review reports. It reports absent or ambiguous data as `unknown`; it does not invent stages. Approvals are explicit commands stored in `meta.json`, and become stale when the approved storyboard or render changes.

## Evidence and privacy

The analysis tools process only a local path named by the user. They do not fetch a video from a URL. Keep the entire `references/` tree local; do not commit user-supplied reference media, transcripts, notes, or generated evidence.
