# T10 — Minimal Pack Authoring

Estimated: 4–5 hours. **The feature that makes the theme claim literal.**

Files: `src/screens/PackStudio.tsx`, `src/engine/packCodec.ts`, `src/engine/validateClaim.ts`.

---

## Why this exists

The theme is *Youth **Designing** the Future of MIL*. A submission where young people only play is a submission about youth as an audience. This is what makes them authors of an MIL instrument for their own community.

It is also a genuine learning activity in its own right: writing a claim where all five atoms are present and separable teaches the framework more thoroughly than playing does.

**Keep it minimal.** One claim, authored and shared by link. Not a studio. This is the piece most likely to end up half-built, so scope it down and finish it.

---

## Build

### Authoring form

One claim at a time:

1. **Original text** — one to two sentences
2. **Tag the five atoms** — for each: the phrase that holds it, plus alternative phrasings, plus overreach phrases where relevant
3. **Five degraded variants** — each with exactly one atom degraded, the other four intact

Guide the author inline. Most people have never thought about a claim this way, and the form is where they learn the framework.

For atom tagging, let them **select text from the original** to mark the phrase rather than retyping it. Faster and it prevents typos that would break detection.

### Validation

`validateClaim.ts` with **readable errors**, not stack traces. A student or teacher will hit these:

- all five atoms tagged with a non-empty phrase
- every keyword actually present in the original text
- five degraded variants, each differing from the original
- each variant still contains keywords for the four atoms it is *not* degrading
- no real organisations or named people — flag suspicious capitalised entities for review rather than blocking

That last check matters. The design rule is fabricated entities only, and an author who does not know that will trip it immediately.

### Sharing by URL

`packCodec.ts`:

```ts
export function encodePack(claims: Claim[]): string;   // → URL fragment
export function decodePack(fragment: string): Claim[];
```

- Compress, then base64url encode
- Put it in the URL **fragment** (`#pack=...`), not the query string. Fragments are never sent to the server, so no claim text touches your infrastructure.
- Opening the link loads the pack for that session only
- No account, no server storage, no database

A student sends a pack to another school over Messenger. That is the whole distribution model, and it costs nothing to run.

**Watch the length.** Long packs make long URLs and some messaging apps truncate. Cap at three claims per link and warn beyond that.

### Also

- **Export to JSON file** — doubles as the format documentation
- **Import from file** — for anything too large for a link

---

## Acceptance criteria

- [ ] Author a complete claim with all five atoms and five variants
- [ ] Text selection tags phrases without retyping
- [ ] Validation errors are readable and specific
- [ ] Real-entity check flags for review
- [ ] Encode → URL → decode round-trips exactly
- [ ] Shared link loads and plays on another device
- [ ] Pack text never reaches the server
- [ ] Export and import round-trip
- [ ] Usable at 375px

## Do not

- Add accounts, server storage, or a pack directory
- Put pack data in the query string
- Use AI to generate claims — authoring is the learning
- Scope-creep into a multi-pack management interface
