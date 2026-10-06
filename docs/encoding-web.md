# Quality-focused web export

Create a web-ready MP4 from a finished master without replacing the master:

```bash
pnpm run web:encode proyectos/<project>/renders/<master>.mp4
```

The output is `<master>-web.mp4`. The command refuses to overwrite an existing output. Its default profile is H.264 (`libx264`), `veryslow`,
CRF 20, `yuv420p` and `faststart`. AAC audio is copied; other audio is encoded as AAC at 192 kb/s.

CRF targets a consistent visual quality and lets the bitrate follow the complexity of the video. CRF 20 is the starting point; values from 18
to 24 are accepted. Lower values preserve more detail and produce larger files. Use a bitrate target or two-pass encoding only when a platform
sets a hard file-size limit.
