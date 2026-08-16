import { useEffect, useRef } from 'react';
import { useGameState } from '../state/GameContext';
import { activeStageIndex, stagesFor } from '../state/stages';
import Icon from './Icon';

/* ============================================================================
   Where the room is in the round.

   Deliberately NOT navigation. Every entry is inert: the game is a linear
   route that several devices walk together, and a rail you could click would
   let one player skip a beat the rest are still on.

   Two orientations, same data — a vertical rail in the desktop sidebar, a
   horizontal strip under the top bar on a phone.
   ========================================================================== */

export interface StageRailProps {
  orientation: 'rail' | 'strip';
}

export default function StageRail({ orientation }: StageRailProps) {
  const state = useGameState();
  const { screen, settings, round } = state;

  const stages = stagesFor(settings.mode);
  const at = activeStageIndex(stages, screen);

  const stripRef = useRef<HTMLOListElement>(null);
  const currentRef = useRef<HTMLLIElement>(null);

  /* The strip is wider than a phone from the third stage on, and its
     scrollbar is hidden, so a room past the halfway point would be looking
     at finished stages with "you are here" somewhere off to the right.
     Centre the current stage whenever it changes. The rail has no such
     problem — it is vertical and always fully visible. */
  useEffect(() => {
    if (orientation !== 'strip') return;
    const strip = stripRef.current;
    const item = currentRef.current;
    if (!strip || !item) return;

    const s = strip.getBoundingClientRect();
    const c = item.getBoundingClientRect();
    const delta = c.left + c.width / 2 - (s.left + s.width / 2);
    if (Math.abs(delta) < 1) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    strip.scrollTo({ left: strip.scrollLeft + delta, behavior: reduce ? 'auto' : 'smooth' });
  }, [at, orientation]);

  if (at < 0) return null;

  return (
    <ol className={`stagerail stagerail-${orientation}`} aria-label="Round progress" ref={stripRef}>
      {stages.map((stage, i) => {
        const done = i < at;
        const current = i === at;

        /* The chain is the only stage long enough that "you are here" is not
           enough — a room needs to know how much of it is left. */
        const detail =
          current && stage.id === 'chain'
            ? `${Math.min(round.currentHop + 1, settings.chainLength)}/${settings.chainLength}`
            : null;

        return (
          <li
            key={stage.id}
            className={`stagerail-item${done ? ' is-done' : ''}${current ? ' is-current' : ''}`}
            aria-current={current ? 'step' : undefined}
            ref={current ? currentRef : undefined}
          >
            <span className="stagerail-marker" aria-hidden="true">
              {done ? <Icon name="check" /> : current ? <Icon name="play" /> : null}
            </span>
            <span className="stagerail-label">{stage.label}</span>
            {detail && <span className="stagerail-detail mono">{detail}</span>}
          </li>
        );
      })}
    </ol>
  );
}
