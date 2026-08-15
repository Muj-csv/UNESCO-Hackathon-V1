import { useEffect, useRef, useState } from 'react';
import { useGame } from '../state/GameContext';
import { textInFrontOfPlayer } from '../state/gameReducer';
import { getCard } from '../data/cards';
import { fallbackFor } from '../engine/fallbacks';

/* ============================================================================
   The machine's turn.

   It receives the same previous version and the same card a person would, and
   rewrites under it. Nobody uses it to play better — it is a participant under
   observation, and the ledger audits its hop exactly as it audits everyone's.

   The beat is deliberately not instant. The room has to watch the pressure
   being applied to something true, or the machine's version arrives as a fact
   rather than as a thing that just happened in front of them.

   This phase runs entirely offline, from the pre-generated table. The live
   proxy lands next and slots into `rewrite()` below — every failure path it
   has already ends here, silently, with the same fallback.
   ========================================================================== */

/** Long enough to read the line, short enough that nobody taps to hurry it. */
const BEAT_MS = 1900;

export default function AIHopBeat() {
  const { state, dispatch } = useGame();
  const { round } = state;
  const index = round.currentHop;
  const isMachineHop = round.aiHopIndexes.includes(index);
  const card = getCard(round.dealtCards[index] ?? null);

  const [elapsed, setElapsed] = useState(false);
  const submitted = useRef(false);

  /* New hop, new turn. */
  useEffect(() => {
    submitted.current = false;
    setElapsed(false);
  }, [index]);

  useEffect(() => {
    if (!isMachineHop || !round.claim) return;

    const timer = window.setTimeout(() => {
      if (submitted.current) return;
      submitted.current = true;
      setElapsed(true);

      /* Pass the previous version through unchanged rather than show anything
         error-shaped, if this claim has no authored rewrite (a T10 pack). */
      const text =
        fallbackFor(round.claim!.id, round.dealtCards[index] ?? null) ??
        textInFrontOfPlayer(state);

      dispatch({ type: 'SET_AI_HOP', hopIndex: index, text });
    }, BEAT_MS);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMachineHop, index, round.claim?.id]);

  if (!isMachineHop) return null;

  /* Covers the hop editor while the machine works. Whoever is holding the
     device is not meant to be writing this one. */
  return (
    <div className="aihop" role="status" aria-live="polite">
      <div className="aihop-panel">
        <p className="eyebrow">This hop</p>
        <h2 className="aihop-name">Auto-summariser</h2>
        <p className="aihop-status">
          {elapsed ? 'Passing it on…' : 'Processing…'}
          <span className="aihop-dots" aria-hidden="true" />
        </p>
        {card && (
          <p className="aihop-card">
            Under <strong>{card.name}</strong>
          </p>
        )}
        <p className="aihop-note">
          It was handed the same version and the same card as everyone else.
        </p>
      </div>
    </div>
  );
}
