import type { Claim } from '../types/contracts';

/* ============================================================================
   OWNER: T10 (pack authoring).

   Turns a list of claims into a URL-fragment-safe string and back, so a
   student can send a pack to another school as a link with nothing touching
   a server. Put the result after `#pack=`, in the FRAGMENT — fragments never
   leave the browser, so claim text never reaches any infrastructure.

   Compressed with the browser's native CompressionStream (gzip) so this adds
   no dependency. Where that API is unavailable, the payload is carried
   uncompressed instead — the encoding still round-trips, the link is just
   longer. A one-byte format flag records which happened, so decode never has
   to guess.

   The docs describe `encodePack`/`decodePack` as synchronous; compression
   inherently isn't (CompressionStream is a stream), so both are async here.
   Everything reachable from those two functions is otherwise pure — no
   fetch, no storage, no globals mutated.
   ========================================================================== */

/** `docs/T10-pack-authoring.md`: "cap at three claims per link and warn
    beyond that." The codec itself has no limit; PackStudio reads this to
    decide when to warn. */
export const MAX_LINK_CLAIMS = 3;

const FORMAT_RAW = 0;
const FORMAT_GZIP = 1;

export class PackDecodeError extends Error {}

function supportsCompression(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

/** TS's DOM lib types `BlobPart` as requiring a plain `ArrayBuffer`, which a
    `Uint8Array` view doesn't structurally satisfy — copy out the exact
    bytes as one. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toArrayBuffer(bytes)]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toArrayBuffer(bytes)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Bytes → URL-safe base64, no padding. */
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new PackDecodeError('This link is broken — it may have been cut off when it was shared.');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Compress (when the browser supports it), then base64url-encode. */
export async function encodePack(claims: Claim[]): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(claims));
  const compress = supportsCompression();
  const payload = compress ? await gzip(raw) : raw;

  const framed = new Uint8Array(payload.length + 1);
  framed[0] = compress ? FORMAT_GZIP : FORMAT_RAW;
  framed.set(payload, 1);
  return bytesToBase64Url(framed);
}

/** Reverse of `encodePack`. Throws `PackDecodeError` with a readable message
    on anything malformed — a truncated link is the expected failure mode. */
export async function decodePack(fragment: string): Promise<Claim[]> {
  const framed = base64UrlToBytes(fragment);
  if (!framed.length) throw new PackDecodeError('This link has no pack in it.');

  const format = framed[0];
  const payload = framed.slice(1);

  let raw: Uint8Array;
  if (format === FORMAT_GZIP) {
    if (!supportsCompression()) {
      throw new PackDecodeError("This browser can't unpack this link. Try a more recent browser.");
    }
    try {
      raw = await gunzip(payload);
    } catch {
      throw new PackDecodeError('This link is broken — it may have been cut off when it was shared.');
    }
  } else if (format === FORMAT_RAW) {
    raw = payload;
  } else {
    throw new PackDecodeError('This link is broken — it may have been cut off when it was shared.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new PackDecodeError('This link is broken — it may have been cut off when it was shared.');
  }

  return assertClaims(parsed);
}

/** Parses an imported pack JSON file's text. Same shape check as decodePack,
    same readable-error contract, for the "too large for a link" path. */
export function parsePackJson(json: string): Claim[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new PackDecodeError("That file isn't valid JSON.");
  }
  return assertClaims(parsed);
}

/** `#pack=<encoded>` — the whole fragment, ready to append to a URL. */
export async function buildShareFragment(claims: Claim[]): Promise<string> {
  return `pack=${await encodePack(claims)}`;
}

/** Reads a `pack=` value out of a `location.hash`-shaped string (with or
    without the leading `#`). Null when there is nothing to read. */
export function readPackFragment(hash: string): string | null {
  const clean = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(clean);
  return params.get('pack');
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/** Sanity-checks the decoded JSON has the shape a `Claim[]` needs before any
    screen trusts it — a hand-edited or corrupted pack should fail here with
    a readable reason, not deep inside the round. */
function assertClaims(value: unknown): Claim[] {
  if (!Array.isArray(value) || !value.length) {
    throw new PackDecodeError('This pack has no claims in it.');
  }
  for (const c of value) {
    if (
      !c ||
      typeof c !== 'object' ||
      !isNonEmptyString((c as Claim).id) ||
      !isNonEmptyString((c as Claim).originalText) ||
      !(c as Claim).atoms ||
      !(c as Claim).degraded
    ) {
      throw new PackDecodeError("This pack is missing pieces a claim needs — it can't be played.");
    }
  }
  return value as Claim[];
}
