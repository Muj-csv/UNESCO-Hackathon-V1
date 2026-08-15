import type { Atom } from '../types/contracts';
import { useGameDispatch } from '../state/GameContext';
import Icon from '../components/Icon';
import type { IconName } from '../components/Icon';

/* ============================================================================
   How to play.

   Reached from the shell's nav on request, never on the way into a round — a
   room that already knows the game should not have to read it again.

   Four beats, under ninety seconds: what happens, the five things worth
   keeping, the one rule, and what the end of a round looks like. The atoms
   are the vocabulary a player takes away from the whole session, so they are
   named here before anyone plays rather than explained afterwards.
   ========================================================================== */

const STEPS = [
  'A true claim goes round the room, one person at a time.',
  'Each person rewrites it under a pressure — short, punchy, fast, certain.',
  'You only ever see the version before yours. Never the original.',
];

/** What each atom holds, and the way it usually goes. */
const ATOM_NOTES: { atom: Atom; icon: IconName; holds: string; dies: string }[] = [
  {
    atom: 'SOURCE',
    icon: 'search',
    holds: 'Who says so.',
    dies: '“studies show”, with nobody named',
  },
  {
    atom: 'NUMBER',
    icon: 'analytics',
    holds: 'The figure, and what it was measured against.',
    dies: 'a percentage with its base dropped',
  },
  {
    atom: 'HEDGE',
    icon: 'alert',
    holds: 'May. Suggests. Preliminary.',
    dies: 'an early finding retold as settled',
  },
  {
    atom: 'SCOPE',
    icon: 'target',
    holds: 'Who, where, and when.',
    dies: 'one campus becomes everywhere',
  },
  {
    atom: 'CAUSE',
    icon: 'link',
    holds: 'Whether one thing actually caused the other.',
    dies: '“linked to” becomes “causes”',
  },
];

export default function HowToPlay() {
  const dispatch = useGameDispatch();

  return (
    <div className="screen">
      {/* No StageBar here: the top bar already badges this screen, and the
          hero below names it again. A third label would be noise. */}
      <header className="lobby-hero">
        <span className="lobby-chip">Read once</span>
        <h1>How to play</h1>
      </header>

      <section className="neo-panel">
        <div className="neo-head">What happens</div>
        <div className="neo-body">
          <ol className="howto-steps">
            {STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </section>

      <section className="neo-panel">
        <div className="neo-head neo-head-amber">
          The five things worth keeping
          <span className="neo-tag">Atoms</span>
        </div>
        <div className="neo-body stack">
          <p className="muted">
            A claim is only true while all five survive. Watch for them — they are the whole game.
          </p>
          <dl className="howto-atoms">
            {ATOM_NOTES.map(({ atom, icon, holds, dies }) => (
              <div className="howto-atom" key={atom}>
                <dt className="howto-atom-name">
                  <Icon name={icon} />
                  {atom}
                </dt>
                <dd className="howto-atom-note">
                  {holds}
                  <span className="howto-atom-dies">Goes when: {dies}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* The one rule gets a panel's worth of space and nothing to compete
          with. Everything else in this game follows from believing it. */}
      <section className="howto-rule-card">
        <p className="eyebrow">The one rule</p>
        <p className="howto-rule">Always try to be accurate.</p>
        <p className="muted">
          No card ever asks you to distort anything. The pressure is real. The instruction to
          mislead does not exist.
        </p>
      </section>

      <section className="neo-panel">
        <div className="neo-head neo-head-plain">
          What you get at the end
          <span className="neo-tag">Decay ledger</span>
        </div>
        <div className="neo-body stack">
          <p className="muted">
            One row per property. Not a score — a record of what was lost, where, and what
            pressure took it.
          </p>

          {/* The real ledger classes, so this is the shape they will actually
              meet. The round it describes never happened. */}
          <div className="ledger howto-sample">
            <div className="ledger-row">
              <p className="ledger-head">CAUSE — LOST AT HOP 4</p>
              <dl className="ledger-diag">
                <dt className="ledger-diag-label">Trigger</dt>
                <dd className="ledger-diag-value ledger-diag-trigger">
                  Sound Certain<span className="ledger-diag-who"> (Mara's turn)</span>
                </dd>
                <dt className="ledger-diag-label">Original</dt>
                <dd className="ledger-diag-value ledger-diag-original">“was linked to”</dd>
                <dt className="ledger-diag-label">Final</dt>
                <dd className="ledger-diag-value ledger-diag-final">“causes”</dd>
              </dl>
            </div>
          </div>

          <p className="muted">
            Nobody in that round was lying. Mara was told to sound certain, and certainty is what
            she wrote.
          </p>
        </div>
      </section>

      <button
        className="btn btn-primary btn-lg btn-block"
        onClick={() => dispatch({ type: 'GO_TO', screen: 'lobby' })}
      >
        <Icon name="arrowBack" /> Back to the deck
      </button>
    </div>
  );
}
