import { describe, expect, it } from 'vitest';
import type { ScreenId } from '../types/contracts';
import { routeFor } from './gameReducer';
import {
  CHAIN_STAGES,
  CROWD_STAGES,
  activeStageIndex,
  badgeFor,
  isInPlay,
  stagesFor,
} from './stages';

/* The rail is derived from the route, so the thing worth testing is that the
   two never drift apart: a screen added to the route with no stage would
   silently blank the rail mid-round. */

describe('stage coverage', () => {
  it('gives every in-play chain screen a stage', () => {
    const uncovered = routeFor('chain')
      .filter(isInPlay)
      .filter((screen) => activeStageIndex(CHAIN_STAGES, screen) < 0);

    expect(uncovered).toEqual([]);
  });

  it('gives every in-play crowd screen a stage', () => {
    const uncovered = routeFor('crowd')
      .filter(isInPlay)
      .filter((screen) => activeStageIndex(CROWD_STAGES, screen) < 0);

    expect(uncovered).toEqual([]);
  });

  it('claims no screen that is not on its own route', () => {
    const crowdRoute = routeFor('crowd');
    const strays = CROWD_STAGES.flatMap((s) => s.screens).filter((s) => !crowdRoute.includes(s));

    expect(strays).toEqual([]);
  });

  it('keeps stages in route order, so the rail reads top to bottom', () => {
    const route = routeFor('chain');
    const firstScreenPositions = CHAIN_STAGES.map((stage) => route.indexOf(stage.screens[0]));
    const sorted = [...firstScreenPositions].sort((a, b) => a - b);

    expect(firstScreenPositions).toEqual(sorted);
  });

  /* CROWD RECALL's lesson requires the absence of a villain. A rail that
     announced an accusation beat would give it one before anyone played. */
  it('never puts an accusation beat in crowd recall', () => {
    const screens = CROWD_STAGES.flatMap((s) => s.screens);
    expect(screens).not.toContain('accusation');
  });
});

describe('isInPlay', () => {
  it('treats the lobby and its side trips as out of play', () => {
    const out: ScreenId[] = ['lobby', 'joinRoom', 'howToPlay', 'packStudio'];
    expect(out.every((s) => !isInPlay(s))).toBe(true);
  });

  it('treats a dealt round as in play', () => {
    expect(isInPlay('brief')).toBe(true);
    expect(isInPlay('round')).toBe(true);
    expect(isInPlay('sessionReadout')).toBe(true);
  });
});

describe('badgeFor', () => {
  it('leaves the lobby unbadged — the wordmark is enough', () => {
    expect(badgeFor('chain', 'lobby')).toBeNull();
  });

  it('names out-of-play screens directly', () => {
    expect(badgeFor('chain', 'packStudio')).toBe('Pack Studio');
    expect(badgeFor('chain', 'howToPlay')).toBe('How to play');
  });

  it('borrows the stage label in play, so badge and rail agree', () => {
    expect(badgeFor('chain', 'turingHop')).toBe('What happened');
    expect(badgeFor('chain', 'thesis')).toBe('Decay ledger');
  });

  it('follows the mode — crowd recall never shows a chain-only stage', () => {
    expect(badgeFor('crowd', 'splitReconstruct')).toBe('Rebuild it');
    expect(badgeFor('crowd', 'round')).toBeNull();
  });
});

describe('stagesFor', () => {
  it('splits crowd recall off from the chain modes', () => {
    expect(stagesFor('crowd')).toBe(CROWD_STAGES);
    expect(stagesFor('chain')).toBe(CHAIN_STAGES);
    expect(stagesFor('badfaith')).toBe(CHAIN_STAGES);
  });
});
