import { describe, expect, it } from 'vitest';
import type { Claim } from '../types/contracts';
import { PackDecodeError, buildShareFragment, decodePack, encodePack, readPackFragment } from './packCodec';

function claim(id: string, overrides: Partial<Claim> = {}): Claim {
  return {
    id,
    topic: 'Weather',
    lang: 'en',
    originalText: `Claim text for ${id}, with enough words to be worth compressing.`,
    atoms: {
      SOURCE: { truth: 't', phrase: 'Claim text', keywords: ['claim text'], overreach: [] },
      NUMBER: { truth: 't', phrase: 'enough words', keywords: ['enough words'], overreach: [] },
      HEDGE: { truth: 't', phrase: 'worth compressing', keywords: ['worth compressing'], overreach: [] },
      SCOPE: { truth: 't', phrase: id, keywords: [id], overreach: [] },
      CAUSE: { truth: 't', phrase: 'with', keywords: ['with'], overreach: [] },
    },
    degraded: { SOURCE: 'a', NUMBER: 'b', HEDGE: 'c', SCOPE: 'd', CAUSE: 'e' },
    ...overrides,
  };
}

describe('encodePack / decodePack', () => {
  it('round-trips a single claim exactly', async () => {
    const claims = [claim('one')];
    const encoded = await encodePack(claims);
    const decoded = await decodePack(encoded);
    expect(decoded).toEqual(claims);
  });

  it('round-trips multiple claims exactly', async () => {
    const claims = [claim('one'), claim('two'), claim('three')];
    const encoded = await encodePack(claims);
    const decoded = await decodePack(encoded);
    expect(decoded).toEqual(claims);
  });

  it('produces a URL-safe string with no +, / or = characters', async () => {
    const encoded = await encodePack([claim('one'), claim('two')]);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('compresses — a repetitive claim set encodes smaller than raw JSON, base64d', async () => {
    const claims = [claim('one'), claim('one-again', { id: 'one-again' })];
    const encoded = await encodePack(claims);
    const rawBase64Length = Math.ceil((JSON.stringify(claims).length * 4) / 3);
    expect(encoded.length).toBeLessThan(rawBase64Length);
  });
});

describe('decodePack — malformed input', () => {
  it('rejects an empty string', async () => {
    await expect(decodePack('')).rejects.toBeInstanceOf(PackDecodeError);
  });

  it('rejects garbage that is not valid base64url', async () => {
    await expect(decodePack('not-a-real-pack-!!!')).rejects.toBeInstanceOf(PackDecodeError);
  });

  it('rejects a truncated link with a readable message, not a stack trace', async () => {
    const encoded = await encodePack([claim('one'), claim('two')]);
    const truncated = encoded.slice(0, Math.floor(encoded.length / 2));
    await expect(decodePack(truncated)).rejects.toThrow(PackDecodeError);
  });
});

describe('readPackFragment', () => {
  it('reads the pack value from a hash with a leading #', () => {
    expect(readPackFragment('#pack=abc123')).toBe('abc123');
  });

  it('reads the pack value from a hash without a leading #', () => {
    expect(readPackFragment('pack=abc123')).toBe('abc123');
  });

  it('returns null when there is no pack param', () => {
    expect(readPackFragment('#join')).toBeNull();
  });
});

describe('buildShareFragment', () => {
  it('round-trips through readPackFragment and decodePack', async () => {
    const claims = [claim('one')];
    const fragment = await buildShareFragment(claims);
    expect(fragment.startsWith('pack=')).toBe(true);

    const packValue = readPackFragment(fragment)!;
    const decoded = await decodePack(packValue);
    expect(decoded).toEqual(claims);
  });
});
