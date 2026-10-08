# Third-party notices

## ClaudeAnimationBase

Portions of the animation methodology and deterministic motion helpers in `kit/lib/cartoon-motion.js`
are adapted from ideas and code patterns in:

- Project: ClaudeAnimationBase
- Author: John Heibel
- Source: https://github.com/JohnHeibel/ClaudeAnimationBase
- Reference reviewed: `0ac8bf2b31942376cb6b8c4074715595d512acd2`
- License: MIT

MIT License

Copyright (c) 2026 John Heibel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## motion-video-kit

Parts of `scripts/lib/qa-video.py` and `tools/sfx/candidates.py`, plus ideas behind
`MAFIA.anim.curva`, `kit/lib/three-desenfoque.js` and `kit/lib/three-anotaciones.js`, are adapted from:

- Project: motion-video-kit
- Author: echris6
- Source: https://github.com/echris6/motion-video-kit
- Reference reviewed: `255562b04b1e5ecaa4ba98e5c9aa191d5ba7f6fa`
- License: MIT

MIT License

Copyright (c) 2026 echris6

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Runtime dependencies

Code to Video Studio installs HyperFrames, GSAP, Three.js, lottie-web, Rough.js (MIT) and Matter.js (MIT) from npm.
Rough.js and Matter.js are vendored with their LICENSE files under `kit/lib/vendor/` by `pnpm run vendor`. They are not relicensed by this repository.
Review the license shipped with each dependency for the terms that apply to it.
