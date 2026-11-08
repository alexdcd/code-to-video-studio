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

Code to Video Studio installs these pinned runtime packages from npm:

| Package | Version | License / terms | Source |
| --- | --- | --- | --- |
| HyperFrames | 0.9.6 | Apache-2.0 | [npm package](https://www.npmjs.com/package/hyperframes) |
| GSAP | 3.15.0 | Standard "no charge" license; review its terms for your use | [license](https://gsap.com/standard-license) |
| Three.js | 0.186.1 | MIT | [npm package](https://www.npmjs.com/package/three) |
| lottie-web | 5.13.0 | MIT | [npm package](https://www.npmjs.com/package/lottie-web) |
| Rough.js | 4.6.6 | MIT | [source](https://github.com/rough-stuff/rough) |
| Matter.js | 0.20.0 | MIT | [source](https://github.com/liabru/matter-js) |

Rough.js and Matter.js are vendored with their LICENSE files under `kit/lib/vendor/` by `pnpm run vendor`. They are not relicensed by this repository.
Review the license shipped with each dependency for the terms that apply to it. GSAP's license is not MIT; check the linked terms before using it in a commercial project.

## Creative style assets

The tracked source `kit/plugins/gsap/MorphSVGPlugin.min.js` is MorphSVGPlugin 3.15.0, copyright GreenSock, under the GSAP Standard License; its upstream license header is retained. Setup copies it to the generated local runtime, and Editorial Motion uses it for SVG path morphs. Inter Latin subsets in `kit/fonts/` are copyright The Inter Project Authors and remain under SIL Open Font License 1.1; the full text is in `kit/fonts/OFL.txt`.
