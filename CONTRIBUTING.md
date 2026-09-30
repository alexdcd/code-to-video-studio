# Contributing

Thanks for helping improve Code to Video Studio.

## Good contributions

The best contributions make many future videos easier to build:

- deterministic motion primitives
- fixes to seeking/rendering behavior
- reusable scene primitives
- better visual QA
- agent workflow improvements
- small, well-documented starter examples
- portability fixes

## Keep the core generic

Do not contribute:

- private API keys or credentials
- copyrighted media you cannot redistribute
- a creator's private brand assets
- one-off project code presented as a general primitive
- generated assets without clear licensing/provenance

## Before opening a PR

```bash
npm install
npm run setup
npm run verify
npm run check -- demo
```

If your change affects visuals, include before/after snapshots or a short render and explain what you inspected.

## Design principle

A reusable abstraction must earn its place. Prefer a small primitive that solves a real production problem over a large framework added “for later”.
