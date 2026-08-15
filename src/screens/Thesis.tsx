import type { GameState } from '../types/contracts';
import { useGame } from '../state/GameContext';
import { finalText } from '../state/gameReducer';
import Icon from '../components/Icon';
import StageBar from '../components/StageBar';

/* ============================================================================
   The thesis.

   The one moment the whole design exists to produce. What entered play, what
   came out, and the line that says nobody had to lie for the distance between
   them to open up.

   Deliberately nearly empty. No stats, no recap, no atom counts — the ledger
   does all of that on the very next screen, and anything extra here spends the
   silence that makes the comparison land. It has to hold for two seconds with
   nobody saying anything and still work, because that is how it will be read
   in a classroom and how it will be shot for the pitch.
   ========================================================================== */

/**
 * The line, for the mode that produced it.
 *
 * T8: BAD FAITH's variant is already wired below — populate `round.imposter`
 * and it appears. The claim it makes is the mode's whole point, so it belongs
 * next to the other two rather than in a branch of its own.
 */
export function thesisLineFor(state: GameState): string {
  if (state.round.imposter) {
    /* T8. One saboteur, and the ledger is about to show the accidents did
       more damage. */
    return "One player was told to distort. Here's how little difference it made.";
  }

  if (state.settings.mode === 'crowd') {
    /* CROWD RECALL has no chain and no retelling. Nobody withheld anything —
       the room simply never held all of it between them. */
    return 'Nobody was hiding anything. Nobody had all of it.';
  }

  return 'Every player was told to be accurate. Nobody lied.';
}

export default function Thesis() {
  const { state, dispatch } = useGame();
  const claim = state.round.claim;

  if (!claim) return null;

  const isCrowd = state.settings.mode === 'crowd';

  return (
    <div className="screen thesis">
      <StageBar label="Before the ledger" />

      <div className="paper paper-original">
        <p className="eyebrow">What entered play</p>
        <p className="paper-text">{claim.originalText}</p>
      </div>

      {/* The distance between the two, made into an object you can see. */}
      <div className="thesis-gap" aria-hidden="true">
        <span className="thesis-gap-line" />
        <span className="thesis-gap-mark">
          <Icon name="arrowForward" />
        </span>
        <span className="thesis-gap-line" />
      </div>

      <div className="paper paper-final">
        <p className="eyebrow">{isCrowd ? 'What the room rebuilt' : 'What came out'}</p>
        <p className="paper-text">{finalText(state)}</p>
      </div>

      <p className="thesis-line">{thesisLineFor(state)}</p>

      <button
        className="btn btn-primary btn-lg btn-block"
        onClick={() => dispatch({ type: 'ADVANCE' })}
      >
        See what it cost <Icon name="arrowForward" />
      </button>
    </div>
  );
}
