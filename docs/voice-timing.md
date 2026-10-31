# Voice timing tools

These provider-neutral utilities align existing audio and transcripts. They do not generate speech, select a voice, call an API, or edit a project timeline automatically.

## Align canonical phrases

Provide a timestamped transcript and the canonical phrases in reading order:

```json
[
  ["opening", "The first words|an alternative", "The canonical subtitle sentence."],
  ["result", "The next phrase", "The next canonical sentence."]
]
```

```bash
pnpm run voice:phrases -- --audio assets/audio/narration.wav \
  --transcript assets/audio/transcript.json \
  --phrases assets/audio/phrases.json \
  --output assets/audio/voice.js
```

The tool uses local FFmpeg silence detection to place phrase boundaries, keeps transcript word times when the word counts match, and distributes canonical subtitle words across the phrase interval when they do not. Review generated times and listen to the audio before using them. The output defines `window.VOZ` with `duracion` and `lineas` for scene code and `MAFIA.subs`.

## Remap an edit after narration changes

```bash
pnpm run voice:map -- --old-audio assets/audio/old.wav \
  --old-transcript assets/audio/old.json \
  --new-audio assets/audio/new.wav \
  --new-transcript assets/audio/new.json \
  --output assets/audio/time-map.js
```

The map matches transcript words, uses detected silence ends as phrase anchors, and writes `window.MAPA = [[oldSeconds, newSeconds], ...]`. Inspect the printed anchors. Add manual anchors for changed or unmatched passages with `--manual '[[oldSeconds,newSeconds]]'`; use `--exclude '[[oldStart,oldEnd]]'` to discard unreliable automatic anchors and `--end oldSeconds:newSeconds` for the final endpoint.

In a composition, `MAFIA.mapaTiempo(window.MAPA)` maps the new narration clock to the old visual clock. Use `m.envolver(tl, duration)` for a GSAP timeline and seek it by time; canvas or other time-derived drawings should call `aViejo(time)` from their seek handler. Anchor times must increase strictly in both timelines. The helper validates this before use.

## Subtitles

`MAFIA.subs` groups timestamped words and hides only the intervals declared in `STORYBOARD.md` where the image already communicates the same meaning as the narration. Styling and placement remain project decisions. Never treat generated timing as visual approval.

## Requirements

Python 3 standard library and FFmpeg/FFprobe are required for the command-line timing tools. No NumPy, model weights, GPU, or provider SDK is needed. A transcript is an input supplied by the creator; the tools do not generate one.
