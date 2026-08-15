import { useEffect, useState } from 'react';
import type { Atom } from '../types/contracts';
import { ATOMS } from '../types/contracts';
import { useGame } from '../state/GameContext';
import { ATOM_ICON, ATOM_SHORT } from '../data/atoms';
import Icon from './Icon';
import StageBar from '../components/StageBar';

/* ============================================================================
   OWNER: T9 (prediction stake).

   Before the chain starts, every player privately picks which atom they think
   dies first. Five seconds, one tap. Stored per player, per round, in
   round.predictions — reported as a room aggregate at the debrief and never
   ranked (see Debrief.tsx and SessionReadout.tsx).

   Pass-and-play has one shared device, so predicting is a queue behind a
   handoff, same pattern as Brief.tsx. A room already gives every player their
   own device, so there's nothing to pass — each one just answers for itself
   and waits for the others, same as Round.tsx's `isMyTurn` gate.
   ========================================================================== */


export default function PredictionPrompt() {
  const { state, dispatch } = useGame();
  const { round, players, room } = state;
  const predictions = round.predictions;

  const remaining = players.filter((p) => predictions[p.name] === undefined);
  const allDone = remaining.length === 0;

  /* Room mode: this device only ever asks about its own player. Pass-and-play:
     one shared device works down the list in order. */
  const current = room.code ? players.find((p) => p.id === room.playerId) ?? null : remaining[0] ?? null;

  const [handedOver, setHandedOver] = useState(false);
  useEffect(() => {
    setHandedOver(false);
  }, [current?.id]);

  if (allDone) {
    return (
      <div className="screen">
        <StageBar label="Before it starts" />
        <h2>Everyone's picked.</h2>
        <p className="lede">
          Whichever one dies first, you'll see how the room called it at the debrief.
        </p>
        <button className="btn btn-primary btn-block" onClick={() => dispatch({ type: 'ADVANCE' })}>
          Start the round
        </button>
      </div>
    );
  }

  /* Room mode, already answered: wait for the rest without naming who's left —
     the point is a private stake, not a queue to watch. */
  if (room.code && (!current || predictions[current.name] !== undefined)) {
    return (
      <div className="screen">
        <StageBar label="Before it starts" />
        <div className="handoff">
          <p className="eyebrow">Predicted</p>
          <h1>Waiting on the room</h1>
          <p className="muted">
            {players.length - remaining.length} of {players.length} have picked.
          </p>
        </div>
      </div>
    );
  }

  if (!current) return null;

  if (!room.code && !handedOver) {
    return (
      <div className="screen">
        <StageBar label="Before it starts" />
        <div className="handoff">
          <span className="handoff-mark" aria-hidden="true">
            <Icon name="send" size={28} />
          </span>
          <p className="eyebrow">Pass the device to</p>
          <h1>{current.name}</h1>
          <p className="muted">Only {current.name} should read the next screen.</p>
          <button className="btn btn-primary btn-lg btn-block" onClick={() => setHandedOver(true)}>
            I'm {current.name}
          </button>
        </div>
      </div>
    );
  }

  const pick = (atom: Atom) => {
    dispatch({ type: 'SET_PREDICTION', player: current.name, atom });
    setHandedOver(false);
  };

  return (
    <div className="screen">
      <StageBar label="Before it starts" />
      <h2>Which one dies first?</h2>
      <p className="lede">
        Five seconds, one tap. Nobody else sees your pick until the debrief.
      </p>
      <div className="atomgrid">
        {ATOMS.map((atom) => (
          <button key={atom} type="button" className="atomcard" onClick={() => pick(atom)}>
            <span className={`atomcard-icon atomcard-${atom.toLowerCase()}`}>
              <Icon name={ATOM_ICON[atom]} size={22} />
            </span>
            <span className="atomcard-name">{atom}</span>
            <span className="atomcard-note">{ATOM_SHORT[atom]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
