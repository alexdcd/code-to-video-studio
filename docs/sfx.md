# Sound-effect preparation

The public studio includes two small, generic SFX utilities extracted from the production workflow.

## 1. Rank candidate recordings

This measures active duration, attack, spectral centroid and low/high-frequency energy.

```bash
python3 -m venv .venv-sfx
.venv-sfx/bin/pip install -r tools/sfx/requirements.txt

npm run sfx:candidates -- recordings/*.wav
```

The defaults flag overly boomy, hiss-heavy or long transition effects. They are starting points, not universal aesthetic rules.

## 2. Clean a selected effect

On macOS/Linux:

```bash
npm run sfx:clean -- raw.wav clean.wav
```

The helper applies high-pass / low-pass filtering and short fades to avoid clicks. It requires ffmpeg/ffprobe.

A useful production rule is to attach sound to **visible actions**, not to empty time. Repeated instances of the same gesture should also stay perceptually coherent.

The more advanced music-layer gain solver used by Mafia AI's private production studio is intentionally not part of this public core.
