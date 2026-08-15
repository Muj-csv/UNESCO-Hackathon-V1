import { useGame } from '../state/GameContext';

/* ============================================================================
   OWNER: T9 (live reactions).

   Four taps, no more, no counting. `round.reactions` is a short rolling
   window the reducer trims (see ADD_REACTION in gameReducer.ts) — it exists
   to make the tap visible on every screen watching the same poll, in room
   mode, and to whoever is holding the shared device in pass-and-play. It is
   never read anywhere else: no count, no "most reacted hop" superlative.
   ========================================================================== */

const REACTIONS: { emoji: string; label: string }[] = [
  { emoji: '😬', label: "that's worse" },
  { emoji: '👀', label: 'wait, what' },
  { emoji: '😂', label: 'funny' },
  { emoji: '🎯', label: 'nailed it' },
];

export default function ReactionBar() {
  const { state, dispatch } = useGame();
  const { round } = state;
  const step = round.revealStep;

  /* Nothing on screen yet to react to. */
  if (step <= 0) return null;

  const hopIndex = step - 1;
  const recent = round.reactions.slice(-8);

  return (
    <div className="reactionbar">
      {recent.length > 0 && (
        <div className="reactionbar-feed" aria-hidden="true">
          {recent.map((r, i) => (
            <span key={i} className="reactionbar-pop">
              {r.emoji}
            </span>
          ))}
        </div>
      )}
      <div className="row reactionbar-row">
        {REACTIONS.map(({ emoji, label }) => (
          <button
            key={emoji}
            type="button"
            className="reactionbar-btn"
            aria-label={label}
            onClick={() => dispatch({ type: 'ADD_REACTION', hopIndex, reaction: emoji })}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
