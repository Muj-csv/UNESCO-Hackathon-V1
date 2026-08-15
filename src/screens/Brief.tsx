import { useEffect, useState } from 'react';
import type { Atom, GameState } from '../types/contracts';
import { useGame } from '../state/GameContext';
import StageBar from '../components/StageBar';

/* ============================================================================
   The pre-hop brief.

   Thirty seconds, once per session, before anybody writes anything. It exists
   to say one thing: the card is a PRESSURE, not an instruction to distort. A
   learner who misses that reads the whole session backwards — they conclude
   the game asked them to mislead people and that distortion is what the cards
   are for, which is the opposite of the finding the ledger is about to hand
   them. Everything after this screen is gated behind understanding it.

   Not skippable. The only control is the one that starts the round.
   ========================================================================== */

/**
 * One brief, for one audience.
 *
 * T8: BAD FAITH hands one player a different brief, and this is the seam for
 * it. Return one variant per player with `player` set, and the screen deals
 * them out privately with a handoff between each — no restructuring, and the
 * imposter's copy never reaches a shared screen. Their brief names a property
 * to make die. It never says "lie".
 */
export interface BriefVariant {
  /** Who it is for, or null when the whole room reads the same thing. */
  player: string | null;
  lines: string[];
  anchor: string;
  anchorNote: string;
}

const ROOM_BRIEF: BriefVariant = {
  player: null,
  lines: [
    "You'll get a claim, and a card.",
    'Rewrite the claim as accurately as you can under that card.',
    "The next player won't see the original — only your version.",
  ],
  anchor: 'The card is a pressure, not an instruction to distort.',
  anchorNote: 'Nobody in this game is ever asked to mislead anyone. Not once, in any mode.',
};

/**
 * BAD FAITH's variant. It targets a property and never says "lie".
 *
 * The imposter still has to write something plausible under a real card —
 * that is what makes their hop indistinguishable from an honest mistake, and
 * it is the whole reason the mode strengthens the thesis instead of
 * contradicting it. "Do not get caught" is doing real work here: it is what
 * stops them writing something absurd and blowing the round open.
 */
function imposterBrief(player: string, target: Atom): BriefVariant {
  return {
    player,
    lines: [
      'Everyone else is trying to be accurate. You are too — mostly.',
      `Rewrite under your card, and make ${target} disappear.`,
      'Keep it believable. If the room can tell it was you, you were too obvious.',
    ],
    anchor: 'Make it die quietly.',
    anchorNote:
      'Say nothing about this screen. Everyone else was handed the ordinary brief, and they will be asked later who they think you were.',
  };
}

/** The same brief everyone reads, addressed to one person on a passed device. */
function honestBrief(player: string): BriefVariant {
  return { ...ROOM_BRIEF, player };
}

/**
 * Who reads what.
 *
 * In every other mode this is one brief for the room. In BAD FAITH it is one
 * per player, dealt privately with a handoff between each — and crucially
 * EVERY player gets one, every round. Handing the device to a single person
 * would name the imposter to the whole room before the round even starts.
 */
export function briefsFor(state: GameState): BriefVariant[] {
  const { imposter } = state.round;
  if (state.settings.mode !== 'badfaith' || !imposter || !state.players.length) {
    return [ROOM_BRIEF];
  }

  return state.players.map((player) =>
    player.name === imposter.player
      ? imposterBrief(player.name, imposter.targetAtom)
      : honestBrief(player.name),
  );
}

/**
 * Once per session, before the first hop.
 *
 * Derived rather than stored: the first round of a session is the only round
 * that has not started yet, and a session that has played a hop has read this.
 * That also survives T5's rehydration for free — a refresh mid-round comes
 * back to the round, not to the briefing.
 *
 * BAD FAITH is the exception, and has to be. The role rotates every round, so
 * this screen is how the next imposter finds out they are it — skipping it
 * after round one would leave nobody holding the secret brief, and the mode
 * would quietly become an ordinary chain.
 */
export function shouldShowBrief(state: GameState): boolean {
  if (state.round.hops.length > 0) return false;
  if (state.settings.mode === 'badfaith' && state.round.imposter) return true;
  return state.session.roundNumber === 1;
}

export default function Brief() {
  const { state, dispatch } = useGame();
  const briefs = briefsFor(state);
  const show = shouldShowBrief(state);

  const [at, setAt] = useState(0);
  const [handedOver, setHandedOver] = useState(false);

  /* Rounds after the first go straight through. `from` keeps StrictMode's
     second effect run from stepping two screens. */
  useEffect(() => {
    if (!show) dispatch({ type: 'ADVANCE', from: 'brief' });
  }, [show, dispatch]);

  if (!show) return null;

  const current = briefs[at];
  const last = at >= briefs.length - 1;

  /* Everyone is counted through, so nobody can tell from the pacing which
     reading was the odd one out. */
  const stage = briefs.length > 1 ? `Reading ${at + 1} of ${briefs.length}` : 'Before you start';

  /* Only reached once a variant names a player — see BriefVariant. */
  if (current.player && !handedOver) {
    return (
      <div className="screen">
        <StageBar label={stage} />
        <div className="handoff">
          <p className="eyebrow">Pass the device to</p>
          <h1>{current.player}</h1>
          <p className="muted">Only {current.player} should read the next screen.</p>
          <button className="btn btn-primary btn-block" onClick={() => setHandedOver(true)}>
            I'm {current.player}
          </button>
        </div>
      </div>
    );
  }

  const advance = () => {
    if (last) {
      dispatch({ type: 'ADVANCE', from: 'brief' });
      return;
    }
    setAt(at + 1);
    setHandedOver(false);
  };

  return (
    <div className="screen">
      <StageBar label={stage} />
      <h2>Read this once</h2>

      <div className="card">
        <p className="eyebrow">In a moment</p>
        <ul className="brief-lines">
          {current.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      {/* The sentence the entire session depends on. It gets its own block,
          in the display face, with nothing beside it. */}
      <div className="paper brief-anchor">
        <p className="brief-anchor-line">{current.anchor}</p>
        <p className="muted">{current.anchorNote}</p>
      </div>

      <button className="btn btn-primary btn-block" onClick={advance}>
        {last ? 'Start the round' : 'Pass it on'}
      </button>
    </div>
  );
}
