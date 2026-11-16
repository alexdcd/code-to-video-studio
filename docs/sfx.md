# Sound-effect preparation

The public Studio provides optional tools to organize, find and prepare sound-effect recordings. They do not generate music or change the audio in an existing video.

## Setup

Install Python 3, FFmpeg and FFprobe, then create the SFX environment:

```bash
pnpm run sfx:setup
```

The optional environment installs NumPy and SoundFile for analysis and decoding; it does not install a music generator or model weights. On Windows, Python and FFmpeg must be available on `PATH`. The SFX commands also work with these Python packages installed in the active Python environment.

## Catalog recordings

The initially empty bundled catalog is `kit/sfx/catalogo.json`. Your own files and their metadata stay under `~/.code-to-video-studio/sfx/`, outside the Git checkout. Register only recordings you have the right to use, and retain any required attribution or license reference. The catalog does not grant redistribution rights.

```bash
pnpm run sfx:catalog add ./click.wav --id click-soft --name "Soft click" \
  --family click --gesture button --energy low --styles all --tags ui \
  --license own --source "My recording" --description "Short, quiet button click"
pnpm run sfx:catalog list --family click --gesture button --json
pnpm run sfx:catalog check
pnpm run sfx:catalog stage --project ./proyectos/my-video click-soft
```

IDs and families are lowercase slugs; energy is `low`, `medium` or `high`. Filters include `--style`, `--gesture`, `--energy` and `--tag`. Supported formats are WAV, OGG, FLAC and MP3, up to 120 seconds, mono or stereo. `add`, `check` and `stage` verify decoding with SoundFile; the catalog records a SHA-256 hash, and `stage` refuses to replace different files. The resulting JSON groups staged paths by family under `pools`; use those files with your own timeline or editor. A `cc-by` recording needs `--credit`; `pixabay` and `licensed` need `--license-ref` and remain personal-only. `stage` preserves and appends required CC BY attribution in the project's `assets/sfx/CREDITS.md`.

The catalog does not automatically mix audio or remove any sound already baked into a track. Listen to the selected files and check their rights and placement before publishing a video.

## Rank candidates

```bash
pnpm run sfx:candidates recordings/*.wav
```

This measures active duration, attack, spectral centroid and low/high-frequency energy. Its thresholds are starting points, not universal aesthetic rules.

## Clean a selected effect

```bash
pnpm run sfx:clean raw.wav clean.wav
```

The helper applies high-pass / low-pass filtering and short fades to avoid clicks. A useful production rule is to attach sound to visible actions, not to empty time. Repeated instances of the same gesture should also stay perceptually coherent.
