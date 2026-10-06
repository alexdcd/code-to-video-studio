# Render QA

Source code validation is not enough for video. `pnpm run qa` analyzes the final MP4 with ffmpeg/ffprobe and flags places worth inspecting.

```bash
pnpm run qa proyectos/my-video/renders/my-video.mp4
pnpm run qa video.mp4 --lufs -14 --max-congelado 0.8
```

It reports:

- unusually static sections
- black frames
- integrated loudness (LUFS)
- loudness range
- true peak
- long silences

These are **diagnostics, not taste**. A static title or intentional silence can be correct. The point is to make the reviewer look at the right seconds instead of assuming a successful render is a good video.

The analyzer requires `ffmpeg` and `ffprobe`.
