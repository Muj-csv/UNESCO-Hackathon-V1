import { useEffect, useState } from 'react';
import type { Atom, GameState } from '../types/contracts';
import { ATOMS } from '../types/contracts';
import { useGame } from '../state/GameContext';
import { ATOM_ICON, ATOM_SHORT } from '../data/atoms';
import Icon from '../components/Icon';
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
  /** Which treatment to render. The imposter's brief gets its own, so that a
      player who has just been handed it cannot mistake it for the ordinary
      one at a glance. */
  kind: 'room' | 'imposter';
  lines: string[];
  anchor: string;
  anchorNote: string;
  /** T8 only — the property this brief asks to make disappear. */
  target?: Atom;
}

const ROOM_BRIEF: BriefVariant = {
  player: null,
  kind: 'room',
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
    kind: 'imposter',
    target,
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
  if (state.settings.mode !== 'badfaith' || !state.players.length) return [ROOM_BRIEF];

  /* T7: in a room every device has its own screen, so this one deals exactly
     one brief — its own. Dealing the whole set here would hand every player
     everybody else's, which is the same leak the handoff exists to prevent.
     The server has already redacted the imposter for everyone but its owner
     (api/_lib/roomStore.ts), so a device that still sees one is holding it. */
  if (state.room.code) {
    const me = state.players.find((p) => p.id === state.room.playerId);
    if (!me) return [ROOM_BRIEF];
    return [
      imposter?.player === me.name
        ? { ...imposterBrief(me.name, imposter.targetAtom), player: null }
        : ROOM_BRIEF,
    ];
  }

  if (!imposter) return [ROOM_BRIEF];

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
  /* Keyed on the round being dealt rather than on the imposter, because in a
     room only one device can see the imposter — and if the others skipped
     this screen while that one stayed on it, they would spend the round
     fighting each other over the synced `screen`. */
  if (state.settings.mode === 'badfaith' && state.round.claim) return true;
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
          <span className="handoff-mark" aria-hidden="true">
            <Icon name="send" size={28} />
          </span>
          <p className="eyebrow">Pass the device to</p>
          <h1>{current.player}</h1>
          <p className="muted">Only {current.player} should read the next screen.</p>
          <button className="btn btn-primary btn-lg btn-block" onClick={() => setHandedOver(true)}>
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

  if (current.kind === 'imposter') {
    return (
      <div className="screen">
        <StageBar label={stage} />

        {/* A different frame entirely, so that a player holding this cannot
            mistake it for the ordinary brief at a glance — and so that the
            handful of seconds they have with it are unambiguous.

            The copy still never says "lie", and the objective is a PROPERTY,
            never the truth. That restraint is the whole design: this player
            is about to discover how small an edit has to be, and how much it
            looks like an ordinary mistake. */}
        <section className="neo-panel classified">
          <div className="neo-head neo-head-red">
            <span className="classified-title">
              <Icon name="alert" className="icon-lg" />
              Different brief
            </span>
            <span className="neo-dots" aria-hidden="true">
              <span />
              <span />
            </span>
          </div>

          <div className="neo-body stack">
            <div className="classified-role">
              <span className="classified-role-eyebrow">Only you are reading this</span>
              <p className="classified-role-name">
                Make <span className="classified-target">{current.target}</span> disappear
              </p>
            </div>

            <div className="classified-grid">
              <div className="classified-cell">
                <p className="classified-cell-head">
                  <Icon name="target" /> Objective
                </p>
                <p className="classified-cell-body">{current.lines[1]}</p>
              </div>
              <div className="classified-cell">
                <p className="classified-cell-head">
                  <Icon name="radar" /> Keep it quiet
                </p>
                <p className="classified-cell-body">{current.lines[2]}</p>
              </div>
            </div>

            <p className="muted">{current.lines[0]}</p>
          </div>
        </section>

        <div className="brief-anchor brief-anchor-red">
          <p className="brief-anchor-line">{current.anchor}</p>
          <p className="muted">{current.anchorNote}</p>
        </div>

        <button className="btn btn-danger btn-lg btn-block" onClick={advance}>
          <Icon name="checkCircle" /> Understood
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <StageBar label={stage} />

      <section className="neo-panel">
        <div className="neo-head">
          In a moment
          <span className="neo-tag">Read once</span>
        </div>
        <div className="neo-body">
          <ul className="brief-lines">
            {current.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* BBB-006. How to Play names the five and is genuinely good, but it is
          opt-in from the sidebar. A room that adds players and presses Initiate
          round used to meet them for the first time on the prediction screen —
          five unfamiliar words to bet on, before anyone had said what they are
          or why they matter. This is the forced path, so they are named here.

          Deliberately the short gloss, not How to Play's fuller "goes when"
          examples: this screen is thirty seconds and has one job, and the
          sentence about the card is the one that must survive it. Same icons
          and same list markup as How to Play, so the property a player learns
          here is recognisable by its mark everywhere it appears later. */}
      <section className="neo-panel">
        <div className="neo-head neo-head-amber">
          Five things a claim carries
          <span className="neo-tag">Atoms</span>
        </div>
        <div className="neo-body stack">
          <dl className="howto-atoms">
            {ATOMS.map((atom) => (
              <div className="howto-atom" key={atom}>
                <dt className="howto-atom-name">
                  <Icon name={ATOM_ICON[atom]} />
                  {atom}
                </dt>
                <dd className="howto-atom-note">{ATOM_SHORT[atom]}</dd>
              </div>
            ))}
          </dl>
          <p className="muted">
            Any of them can go missing without anybody lying. That is what the ledger measures at
            the end.
          </p>
        </div>
      </section>

      {/* The sentence the entire session depends on. It gets its own block,
          in the display face, with nothing beside it. */}
      <div className="brief-anchor">
        <p className="brief-anchor-line">{current.anchor}</p>
        <p className="muted">{current.anchorNote}</p>
      </div>

      <button className="btn btn-primary btn-lg btn-block" onClick={advance}>
        {last ? 'Start the round' : 'Pass it on'}
        <Icon name="arrowForward" />
      </button>
    </div>
  );
}
