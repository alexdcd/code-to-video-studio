# View systems

Views are project requirements, not a universal five-view tax.

## Public default

Required:

```text
front -> q -> side
```

Optional when the story/camera needs them:

```text
qback -> back
```

Generated art often drifts as the number of required views grows. Do not require rear views merely because a traditional model sheet would contain them.

`requiredViews` in `character.json` is the release gate. `views` is the full implemented set. Profiles may choose another required set.

For procedural characters, a drawn turn should step through canonical key views rather than fake a 3D turn by skewing one flat drawing, unless the character is intentionally built to support that transform.
