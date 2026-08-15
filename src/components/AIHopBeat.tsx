import { useEffect, useRef, useState } from 'react';
import { useGame } from '../state/GameContext';
import { textInFrontOfPlayer } from '../state/gameReducer';
import { getCard } from '../data/cards';
import { fallbackFor } from '../engine/fallbacks';
import Icon from './Icon';

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

/** The proxy gives up at 6s; this is the client's own belt and braces. */
const REQUEST_MS = 7000;

/**
 * Ask the proxy for a rewrite. Returns null for every failure there is —
 * no key, rate limited, timeout, unusable output, offline, 404 because
 * nothing is serving /api at all — because the caller does the same thing
 * with all of them.
 */
async function rewrite(text: string, cardId: string | null, signal: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch('/api/ai-hop', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, cardId }),
      signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data?.text === 'string' && data.text.trim() ? data.text.trim() : null;
  } catch {
    return null;
  }
}

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

    const claimId = round.claim.id;
    const cardId = round.dealtCards[index] ?? null;
    const source = textInFrontOfPlayer(state);

    let cancelled = false;
    const controller = new AbortController();
    const abort = window.setTimeout(() => controller.abort(), REQUEST_MS);

    /* The beat and the request run together. Whichever the room sees, they
       see it for the same length of time — a fast model must not make the
       machine's turn visibly shorter than a fallback one, or the Turing Hop
       is answerable from the clock rather than from the writing. */
    const beat = new Promise((resolve) => window.setTimeout(resolve, BEAT_MS));

    Promise.all([rewrite(source, cardId, controller.signal), beat]).then(([live]) => {
      if (cancelled || submitted.current) return;
      submitted.current = true;
      setElapsed(true);

      /* Live rewrite, else the pre-generated one, else the version it was
         handed. The room is never shown anything error-shaped. */
      const text = live ?? fallbackFor(claimId, cardId) ?? source;
      dispatch({ type: 'SET_AI_HOP', hopIndex: index, text });
    });

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(abort);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMachineHop, index, round.claim?.id]);

  if (!isMachineHop) return null;

  /* Covers the hop editor while the machine works. Whoever is holding the
     device is not meant to be writing this one. */
  return (
    <div className="aihop" role="status" aria-live="polite">
      <div className="aihop-panel">
        <div className="neo-head aihop-head">
          <span className="aihop-head-title">
            <Icon name="robot" className="icon-lg" />
            This hop
          </span>
          <span className="neo-dots" aria-hidden="true">
            <span />
            <span />
          </span>
        </div>

        <div className="aihop-body">
          <p className="aihop-name">Auto-summariser</p>
          <p className="aihop-status">
            {elapsed ? 'Passing it on' : 'Processing'}
            <span className="aihop-dots" aria-hidden="true" />
          </p>
          {card && <p className="aihop-card">Under {card.name}</p>}
          <p className="aihop-note">
            It was handed the same version and the same card as everyone else.
          </p>
        </div>
      </div>
    </div>
  );
}
