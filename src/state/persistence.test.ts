import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameState } from '../types/contracts';
import { STATE_VERSION, initialState } from './gameReducer';
import { STORAGE_KEY, clearState, loadState, saveState } from './persistence';

/* No jsdom in this project's test setup, so sessionStorage is mocked by hand
   rather than pulling in a DOM environment dependency. */
function makeMockStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

describe('persistence', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');

  beforeEach(() => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: makeMockStorage(),
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'sessionStorage', originalDescriptor);
    } else {
      delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    }
  });

  it('round-trips state through save and load', () => {
    const state: GameState = { ...initialState, screen: 'round' };
    saveState(state);
    expect(loadState()).toEqual(state);
  });

  it('returns null when nothing has been saved', () => {
    expect(loadState()).toBeNull();
  });

  it('discards a saved state on version mismatch rather than rehydrating it', () => {
    const state: GameState = { ...initialState, screen: 'round' };
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STATE_VERSION + 1, state }),
    );
    expect(loadState()).toBeNull();
  });

  it('removes the saved state on clearState', () => {
    saveState({ ...initialState, screen: 'round' });
    clearState();
    expect(loadState()).toBeNull();
  });

  it('degrades silently when storage access throws', () => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
        removeItem: () => {
          throw new Error('blocked');
        },
      },
      configurable: true,
      writable: true,
    });

    expect(() => saveState(initialState)).not.toThrow();
    expect(loadState()).toBeNull();
    expect(() => clearState()).not.toThrow();
  });

  it('returns null on malformed JSON instead of throwing', () => {
    sessionStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadState()).toBeNull();
  });
});
