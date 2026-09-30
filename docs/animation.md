# Deterministic animation

Browsers normally animate forward through time. A video renderer also jumps directly to arbitrary frames.

That difference matters.

## Prefer functions of time

Good:

```js
const pose = MAFIA.anim.jump(t, 1.0, 1.8, 140);
element.style.transform = `translateY(${pose.y}px)`;
```

Risky:

```js
velocity += gravity;
position += velocity;
```

The second version depends on every previous frame having run. Seeking directly to 1.53 seconds can produce a different state.

## Seed randomness

```js
const random = MAFIA.rand(42);
const x = random();
```

Do not use `Math.random()` for visible rendered state.

## Useful primitives

`MAFIA.anim` currently includes:

- clamp / lerp / segment helpers
- keyframe interpolation\n- monotone `curva()` interpolation for measured motion without overshoot
- damped spring
- repeated ringing response
- motion arcs
- on-twos quantization
- beat and pulse functions
- deterministic camera/prop shake
- cartoon jump
- short reaction/take

These primitives return state. They do not own your scene. That keeps compositions flexible and easy for agents to combine.

## Reproducing measured motion

When you are matching the *timing* of a movement from a reference, measure a few key values and use `MAFIA.anim.curva(t, keys)`.
It uses monotone cubic interpolation so the curve passes through the measured keys without introducing a new overshoot.

```js
const angle = MAFIA.anim.curva(t, [
  [0.0, 0],
  [0.18, 8],
  [0.42, 47],
  [0.70, 82],
  [0.95, 90],
]);
```

Treat the measurements as evidence, not as a reason to ship the reference media itself.
