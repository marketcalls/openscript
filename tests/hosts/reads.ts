/**
 * Duty 3: bars for another instrument or timeframe, `host-interface.md` 5.
 *
 * Optional, and declared at load rather than discovered during a bar: a host
 * that serves no read offers no provider at all, and a program that needs one
 * is refused at load with OS6006 naming the tag.
 *
 * A request is read field by field against the table of 5.2, in both
 * directions, so a field that stops arriving fails a test rather than waiting
 * for a reviewer, and a field that arrives without being printed is a defect in
 * the page rather than a bonus. A host cannot act on a fact it was never told
 * about.
 */
import type { PageBar } from './feed.js';

/** A request, `host-interface.md` 5.2. These eight fields, under these names. */
export interface PageRequest {
  readonly id: number;
  readonly read: 'symbol' | 'timeframe';
  readonly instrument: string | null;
  readonly exchange: string | null;
  readonly timeframe: string;
  readonly interval: string;
  readonly mode: 'confirmed' | 'developing' | 'lookahead';
  readonly warmup: number | null;
}

/** A refusal, 5.4. The code is the catalogue's and the words are the host's. */
export interface PageRefusal {
  readonly code: 'OS6007' | 'OS6008' | 'OS6009' | 'OS6014' | 'OS6015';
  readonly reason?: string;
  readonly available?: string;
}

/** What one read is served with, 5.3 and 5.4. */
export type PageAnswer =
  | { readonly bars: readonly PageBar[] }
  | { readonly refused: PageRefusal }
  | { readonly waiting: true };

/** The fields 5.2 prints, in the order it prints them. */
export const REQUEST_FIELDS: readonly string[] = [
  'id',
  'read',
  'instrument',
  'exchange',
  'timeframe',
  'interval',
  'mode',
  'warmup',
];

const MODES: readonly string[] = ['confirmed', 'developing', 'lookahead'];

/**
 * One request, read against the table of 5.2.
 *
 * Returns what the page says arrives and a list of everything about the request
 * the page does not account for: a field it prints that did not come, a field
 * that came under another name, a type that is not the one printed.
 */
export function readRequest(query: unknown): { request: PageRequest; problems: readonly string[] } {
  const problems: string[] = [];
  const raw = (query ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!REQUEST_FIELDS.includes(key)) {
      problems.push(`the request carries ${key}, which section 5.2 does not print`);
    }
  }
  for (const key of REQUEST_FIELDS) {
    if (!(key in raw)) problems.push(`section 5.2 prints ${key} and the request does not carry it`);
  }
  if (typeof raw['id'] !== 'number') problems.push('id is not a number');
  if (raw['read'] !== 'symbol' && raw['read'] !== 'timeframe') {
    problems.push('read is not one of the two');
  }
  if (raw['instrument'] !== null && typeof raw['instrument'] !== 'string') {
    problems.push('instrument is neither an identity nor absent');
  }
  if (raw['exchange'] !== null && typeof raw['exchange'] !== 'string') {
    problems.push('exchange is neither a string nor absent');
  }
  if (typeof raw['timeframe'] !== 'string') problems.push('timeframe is not a string');
  if (typeof raw['interval'] !== 'string') problems.push('interval is not a string');
  if (!MODES.includes(String(raw['mode']))) problems.push('mode is not one of the three');
  if (raw['warmup'] !== null && typeof raw['warmup'] !== 'number') {
    problems.push('warmup is neither a number nor absent');
  }
  return { request: raw as unknown as PageRequest, problems };
}

const MINUTE = 60_000;

/**
 * How long one requested bar is, from its timeframe string.
 *
 * `stdlib.md` 15.2 fixes the spelling and a bare number is minutes. This is the
 * part of the range arithmetic a host cannot avoid owning, because the request
 * states the warmup in requested bars and a fetch takes instants.
 */
export function lengthOf(timeframe: string): number {
  const written = /^(\d+)([smhDWM]?)$/.exec(timeframe);
  if (written === null) return 0;
  const count = Number(written[1]);
  switch (written[2]) {
    case 's':
      return count * 1000;
    case 'h':
      return count * 60 * MINUTE;
    case 'D':
      return count * 24 * 60 * MINUTE;
    case 'W':
      return count * 7 * 24 * 60 * MINUTE;
    case 'M':
      return count * 30 * 24 * 60 * MINUTE;
    default:
      return count * MINUTE;
  }
}

/** The instant range one request is answered over, which the host works out. */
export interface PageRange {
  readonly from: number;
  readonly to: number;
}

/**
 * The range 5.2 leaves to the host, worked out here from its own bars.
 *
 * The page's floor is the chart's own span extended backwards by `warmup`
 * requested bars. This host extends by one more, deliberately: a confirmed read
 * takes the last requested bar that closed, so a host serving exactly the floor
 * has nothing to show on the left edge until the first requested bar closes.
 * Extending further is a host's to decide and serving less is not, which is what
 * makes the number a floor.
 */
export function rangeFor(request: PageRequest, bars: readonly PageBar[]): PageRange | undefined {
  const first = bars[0];
  const last = bars[bars.length - 1];
  const span = lengthOf(request.timeframe);
  if (first === undefined || last === undefined || span === 0) return undefined;
  const warmup = request.warmup ?? 0;
  return {
    from: Math.floor(first.time / span) * span - (warmup + 1) * span,
    to: Math.floor(last.time / span) * span + span,
  };
}

/** What this host holds for one instrument, one exchange and one timeframe. */
export interface PageSeries {
  readonly instrument: string;
  readonly exchange: string;
  readonly timeframe: string;
  readonly bars: readonly PageBar[];
}
