import { describe, expect, it } from 'vitest';
import { SCREENS } from './App';
import { routeFor } from './state/gameReducer';

/* ==========================================================================
   Phase 6 guard.

   Five people fill in their own screen without opening the router. That only
   holds if every screen the route can reach is actually registered — a route
   entry with no component silently self-skips, and the beat disappears with
   no error anywhere. CROWD RECALL lost its whole distribute step that way
   once already.
   ========================================================================== */

describe('screen registry', () => {
  it('has a component for every screen in the chain route', () => {
    for (const screen of routeFor('chain')) {
      expect(SCREENS[screen], `${screen} is not registered`).toBeTruthy();
    }
  });

  it('has a component for every screen in the crowd recall route', () => {
    for (const screen of routeFor('crowd')) {
      expect(SCREENS[screen], `${screen} is not registered`).toBeTruthy();
    }
  });

  it('registers the stub screens each later task fills in', () => {
    for (const screen of [
      'howToPlay', //     T3
      'brief', //         T3
      'thesis', //        T3
      'prediction', //    T9
      'turingHop', //     T6
      'accusation', //    T8
      'packStudio', //    T10
    ] as const) {
      expect(SCREENS[screen], `${screen} stub missing`).toBeTruthy();
    }
  });

  it('keeps the imposter beat out of crowd recall', () => {
    /* Not a routing detail — the mode's entire lesson requires no traitor. */
    expect(routeFor('crowd')).not.toContain('accusation');
  });
});
