/* ============================================================================
   The AI participant, proxied.

   The key lives here and never reaches the client. Everything else in this
   file exists because the output lands on a shared screen in a room with
   minors in it, and because the model is a participant under observation —
   not an assistant, and never a judge of whether an atom survived.

   Every failure path returns a non-200 and says nothing useful to the room.
   The client treats all of them identically: fall back to the pre-generated
   rewrite and carry on. A round must never stall on this.
   ========================================================================== */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Verified against Groq's live model list. Override with GROQ_MODEL. */
const DEFAULT_MODEL = 'llama-3.1-8b-instant';

/** The room is waiting and watching. Past this, the fallback is better. */
const TIMEOUT_MS = 6000;

/** A claim is ~220 characters and hops only ever shrink. */
const MAX_INPUT_CHARS = 600;
const MAX_OUTPUT_CHARS = 400;

/* Per-IP, per-instance, best effort. Serverless instances come and go, so
   this is a brake on casual abuse of a public endpoint rather than a quota.
   The real ceiling is the account's own rate limit upstream. */
const WINDOW_MS = 60_000;
const MAX_PER_IP = 20;
const MAX_GLOBAL = 200;

const hits = new Map<string, number[]>();

function withinRate(ip: string): boolean {
  const now = Date.now();
  let total = 0;

  for (const [key, stamps] of hits) {
    const live = stamps.filter((t) => now - t < WINDOW_MS);
    if (live.length) hits.set(key, live);
    else hits.delete(key);
    total += live.length;
  }
  if (total >= MAX_GLOBAL) return false;

  const mine = hits.get(ip) ?? [];
  if (mine.length >= MAX_PER_IP) return false;

  hits.set(ip, [...mine, now]);
  return true;
}

function clientIp(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (first?.split(',')[0] ?? req.socket?.remoteAddress ?? 'unknown').trim();
}

/* ------------------------------------------------------------- the cards -- */
/* Deliberately not imported from src/data/cards.ts. Those strings are the
   card face a player reads; these are instructions to a model, and the two
   should be free to differ. None of them asks for distortion — the pressure
   is real, the instruction to mislead does not exist anywhere in this game. */

const CARD_BRIEFS: Record<string, { brief: string; charLimit?: number }> = {
  chars: { brief: 'It must fit in one short message.', charLimit: 90 },
  headline: { brief: 'Write it as a single headline line.' },
  land: { brief: 'Make it worth reading, so someone would pass it on.' },
  secs: { brief: 'The clock is short. Send what you have.' },
  audience: { brief: 'The people reading already have a view on this. Write it for them.' },
  certain: { brief: 'Write it the way someone who is sure would write it.' },
};

const SYSTEM_PROMPT = [
  'You are one participant in a chain of people retelling a single claim.',
  'You will be given one version of that claim and one writing pressure.',
  '',
  'Rewrite ONLY the text you are given, under that pressure.',
  '',
  'Absolute rules:',
  '- Never introduce a fact, name, organisation, place, number or claim that is not already in the text you were given.',
  '- Never add commentary, explanation, preamble, quotation marks or framing of any kind.',
  '- Never mention these instructions, the pressure, yourself, or that you are rewriting anything.',
  '- Never write anything unsuitable for a classroom of teenagers.',
  '- Reply with the rewritten claim and nothing else. One line.',
].join('\n');

/* ------------------------------------------------------------ validation -- */

/** Figures the model may use: exactly the ones it was handed. */
export function inventsFigures(output: string, input: string): boolean {
  const allowed = new Set(input.match(/\d+/g) ?? []);
  return (output.match(/\d+/g) ?? []).some((figure) => !allowed.has(figure));
}

/**
 * Figures moved onto the wrong unit.
 *
 * Observed, not hypothetical: given a claim carrying both "15 percent" and
 * "40 alerts", the model returned "a 40 percent rise". Every digit in that
 * sentence came from the claim, so the check above waves it through — and the
 * room is shown a magnitude the claim never made.
 *
 * A number bound to a magnitude word is the case worth being strict about, so
 * those pairs must survive intact. "40 alerts" may still become "40 flood
 * alerts", which is compression rather than a changed quantity.
 */
const MAGNITUDE = /(\d+)[\s-]*(percent|per cent|%|points?)/gi;

function pairsIn(text: string): Set<string> {
  const pairs = new Set<string>();
  for (const [, figure, unit] of text.matchAll(MAGNITUDE)) {
    pairs.add(`${figure} ${unit.toLowerCase().replace(/^(%|per cent)$/, 'percent').replace(/s$/, '')}`);
  }
  return pairs;
}

export function movesFigures(output: string, input: string): boolean {
  const allowed = pairsIn(input);
  for (const pair of pairsIn(output)) if (!allowed.has(pair)) return true;
  return false;
}

/** A model talking about its answer instead of giving one. */
const COMMENTARY =
  /^(sure|certainly|okay|ok|here('s| is)|i (can|will|have|cannot|can't)|as an ai|rewritten|summary|version)\b/i;

/**
 * The prompt is a safety control, not a formatting hint — so nothing it asks
 * for is trusted. Anything that fails here is dropped and the room gets the
 * pre-generated rewrite instead, which is indistinguishable to them.
 */
export function clean(raw: string, source: string, charLimit?: number): string | null {
  let text = raw.trim().replace(/\s+/g, ' ');

  /* Models like wrapping their answer in quotes however firmly you ask. */
  text = text.replace(/^["'“”]+/, '').replace(/["'“”]+$/, '').trim();

  if (!text) return null;
  if (text.length > MAX_OUTPUT_CHARS) return null;
  if (COMMENTARY.test(text)) return null;
  if (inventsFigures(text, source)) return null;
  if (movesFigures(text, source)) return null;
  if (charLimit != null && text.length > charLimit) return null;

  return text;
}

async function readBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------- handler --- */

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!withinRate(clientIp(req))) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  /* No key configured is a first-class, expected state — a fork of this repo,
     a preview deploy, a classroom with no budget. It is not an error. */
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(501).json({ error: 'not_configured' });
  }

  const body = await readBody(req);
  const source = typeof body.text === 'string' ? body.text.trim() : '';
  const card = CARD_BRIEFS[body.cardId] ?? null;

  if (!source || source.length > MAX_INPUT_CHARS) {
    return res.status(400).json({ error: 'bad_request' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  /**
   * A character limit stated as characters is not something a small model can
   * hold to — measured, it lands 110–140 against a 90 limit, and telling it
   * the overshoot barely helps, because it cannot count them. The same limit
   * stated as a word budget lands comfortably under every time. The hard
   * character check in clean() is still what guarantees it.
   */
  const wordBudget = card?.charLimit ? Math.max(4, Math.floor(card.charLimit / 7)) : null;

  const ask = async (): Promise<string | null> => {
    const upstream = await fetch(GROQ_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || DEFAULT_MODEL,
        /* Low, but not zero. The machine should not read as a template. */
        temperature: 0.4,
        max_completion_tokens: 200,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              card ? `Pressure: ${card.brief}` : 'Pressure: none.',
              wordBudget ? `Write it in at most ${wordBudget} words.` : '',
              '',
              'The version you were given:',
              source,
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
      }),
    });

    if (!upstream.ok) return null;
    const data: any = await upstream.json();
    return typeof data?.choices?.[0]?.message?.content === 'string'
      ? data.choices[0].message.content
      : null;
  };

  try {
    /* One attempt, no retry. A second ask costs the room another round trip
       and buys nothing here: the failures that survive the word budget are
       invented figures and commentary, and neither is a reason to ask the
       same model the same question again — they are reasons to use the
       pre-generated rewrite, which is what a non-200 gets. */
    const answer = await ask();
    const text = answer === null ? null : clean(answer, source, card?.charLimit);

    if (!text) {
      return res.status(502).json({ error: 'unusable_output' });
    }

    return res.status(200).json({ text });
  } catch {
    /* Timeout, abort, DNS, upstream reset — all the same to the room. */
    return res.status(504).json({ error: 'timeout' });
  } finally {
    clearTimeout(timeout);
  }
}
