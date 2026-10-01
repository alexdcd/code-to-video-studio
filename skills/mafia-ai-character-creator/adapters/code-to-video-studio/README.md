# Code to Video Studio target

This target describes the public Studio's HyperFrames kit layout:

- character source: `kit/characters/`
- asset URLs: `assets/kit/characters/`
- runtime global: `MAFIA`
- build command: `node scripts/lib/kit-build.mjs`

Use it with `scripts/generate_hyperframes_character.py character <package> --target code-to-video-studio --project-root <repo>`. Its configuration is `target.json` beside this file.
