# Agent workflow

Code to Video Studio is designed around a human + coding-agent loop.

The agent is good at producing and refactoring animation code. The human is still the final judge of pacing, hierarchy, taste and whether a movement actually reads correctly.

## Recommended loop

1. Give the agent a concrete outcome in `BRIEF.md`.
2. Ask it to write the viewing logic before implementation.
3. Approve or edit `SCRIPT.md` and `STORYBOARD.md`.
4. Let it implement one scene at a time.
5. Take a snapshot after every meaningful motion change.
6. Run `check`.
7. Render only when individual scenes are readable.
8. Review the contact sheet and final motion.
9. Feed concrete visual problems back to the agent.

## Prompt pattern

A useful prompt is specific about the outcome but leaves implementation choices to the agent:

> Read AGENTS.md and this project's BRIEF.md. Build the storyboard first. Keep one primary reading on screen at a time. Reuse the kit where it helps, but do not force a reusable primitive into a scene that needs custom work. After implementation, run check, inspect snapshots at every scene boundary and fix visible problems before rendering.

Avoid asking an agent to “make it cinematic” without defining what the viewer must understand. Visual adjectives are not a substitute for direction.
