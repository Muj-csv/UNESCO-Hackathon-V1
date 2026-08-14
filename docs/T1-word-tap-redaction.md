# T1 — Word-Tap Redaction

Estimated: 3–4 hours. **The single biggest playability fix in the project.**

Files: `src/engine/redact.ts`, `src/components/RedactEditor.tsx`, `src/screens/Round.tsx`.

---

## The problem

The round screen asks a player to retype a paragraph on someone else's phone, under a timer, while everyone watches. That is not play — it is homework with a countdown.

Compare Gartic Phone, which this game borrows from: drawing badly takes ten seconds and is instantly funny. Typing a careful paraphrase takes forty seconds and is work. This is the main reason a group of teenagers would quit before the first Decay Ledger.

## The fix

Under compression constraints, players **tap words out** instead of retyping.

Three things this buys:

1. **Fast and thumb-friendly.** A hop drops from ~40 seconds of typing to ~10 seconds of tapping.
2. **The loss becomes visible.** You watch "preliminary" disappear. In freeform typing the hedge just quietly fails to reappear, and nobody notices until the ledger.
3. **Better pedagogy.** The player performs the deletion rather than performing an omission, so the causal link between pressure and loss is direct.

---

## Which cards use which mode

| Card | Input |
|---|---|
| `chars` 90 CHARACTERS | redaction |
| `headline` HEADLINE ONLY | redaction |
| `secs` 25 SECONDS | redaction |
| `land` MAKE IT LAND | free text |
| `audience` YOUR AUDIENCE BELIEVES… | free text |
| `certain` SOUND CERTAIN | free text |

Compression cards remove; the other three rewrite or add. Forcing redaction on SOUND CERTAIN would make it impossible to actually sound certain.

---

## Build

### `src/engine/redact.ts`

```ts
export interface Token { text: string; index: number; removed: boolean; punctuation: boolean; }
export function tokenize(text: string): Token[];
export function reassemble(tokens: Token[]): string;
export function charCount(tokens: Token[]): number;
```

Reassembly must produce readable text: collapse doubled spaces, drop orphaned punctuation, keep sentence-ending marks, capitalise the first surviving word. A redacted claim that reads as broken English breaks immersion and makes the ledger comparison unfair.

Punctuation tokens are not independently tappable — they attach to the preceding word.

### `src/components/RedactEditor.tsx`

- Tap a word to remove it; tap again to restore
- Removed words stay visible with a strikethrough at reduced opacity, so the player sees what they cut
- Live character counter against the card's limit, turning `--red` when over
- Live preview of the reassembled result below the editor
- Cannot submit while over the limit
- **Minimum tap target 44px.** Words are small; padding is not optional.

### `src/screens/Round.tsx`

Branch on the card. Redaction cards mount `RedactEditor` seeded with the previous hop's text; free-text cards keep the existing textarea.

On submit, store the reassembled string as `hop.text` exactly as before — the ledger engine does not change.

---

## Timer behaviour

Two fixes while you are here:

- **Add a five-second warning state.** The prototype auto-submits mid-word with no signal, which reads as a bug rather than a rule.
- **Apply `card.timerOverride`.** The 25 SECONDS card has always named a time pressure without changing the clock.

---

## Acceptance criteria

- [ ] Compression cards present the redact editor, others present free text
- [ ] Tapping removes and restores words
- [ ] Reassembled text is readable — no doubled spaces, no orphaned commas
- [ ] Character counter accurate, submit blocked over the limit
- [ ] Removed words visible struck through
- [ ] Tap targets ≥44px, comfortable at 375px
- [ ] Five-second warning before auto-submit
- [ ] `secs` card actually sets a 25-second timer
- [ ] `hop.text` shape unchanged, ledger still works
- [ ] Unit tests for `tokenize` / `reassemble` round-tripping

## Do not

- Force redaction on the three free-text cards
- Auto-suggest which words to remove — the choice is the lesson
- Show atom hints in the editor
