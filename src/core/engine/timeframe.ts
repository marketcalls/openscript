/**
 * Timeframe strings, and the buckets a read folds bars into.
 *
 * `stdlib.md` section 15.2 fixes the spelling: a count and a unit, with the
 * unit letters case sensitive so `"1M"` is one month and `"1m"` one minute, and
 * a bare number read as minutes because that is the form an interval input
 * supplies. This file is that grammar and the arithmetic that follows from it,
 * and nothing else.
 *
 * **A bucket is named by a key rather than by a range**, because a key is one
 * integer per bar and a range is two comparisons and an edge case. Two bars
 * belong to the same requested bar exactly when their open instants give the
 * same key, and a bucket has begun on the first bar whose key is new. Every
 * boundary question in `requests.ts` reduces to that one comparison, which is
 * what keeps the off-by-one out of the fold.
 *
 * **The two families are keyed differently, and the specification says why.**
 * An intraday request is folded by counting, from the open of the trading day
 * the bar belongs to: the session's open where the host stated a session,
 * midnight in the instrument's timezone where it stated none, and midnight UTC
 * where it stated no timezone either. Counting from the open is what makes a
 * sixty minute bucket on a market opening at a quarter past the hour begin at a
 * quarter past, as the venue's own candles do, and what keeps a period that does
 * not divide a day from starting at a different time every day. A day, week or
 * month request is folded by the calendar, so its key is a civil date read in
 * the instrument's timezone.
 *
 * **A calendar bucket with no timezone has no key.** A host states the zone or
 * it does not, and an engine that quietly folded days in UTC would put a day
 * boundary in the middle of a session for most of the world and look right. It
 * is the same answer `library/dates.ts` gives for the same question: a host that
 * states no timezone leaves the call absent rather than answered in a zone
 * nobody chose. A read in that position is absent on every bar of the run, so
 * `request-plan.ts` gives it the reason `req.error` reports: an absence with no
 * explanation is the one failure a trader cannot get past on their own.
 */
import { dayNumber, fieldsIn } from '../stdlib/index.js';
import { tradingDayOf } from './session/index.js';
import type { SessionHours } from './session/index.js';

export type TimeframeUnit = 'm' | 'h' | 'D' | 'W' | 'M';

export interface Timeframe {
  readonly count: number;
  readonly unit: TimeframeUnit;
  /** The string as it was written, for a diagnostic that has to name it. */
  readonly text: string;
}

/** The grammar of 15.2. A bare number is minutes, which is the interval form. */
const WRITTEN = /^([0-9]+)(m|h|D|W|M)?$/;

const MINUTE = 60_000;

/** The nominal length of one unit, in minutes, for ordering two timeframes. */
const NOMINAL: Readonly<Record<TimeframeUnit, number>> = {
  m: 1,
  h: 60,
  D: 1440,
  W: 10_080,
  M: 43_200,
};

export function parseTimeframe(text: string): Timeframe | undefined {
  const match = WRITTEN.exec(text.trim());
  if (match === null) return undefined;
  const count = Number(match[1]);
  if (!Number.isInteger(count) || count < 1) return undefined;
  return { count, unit: (match[2] ?? 'm') as TimeframeUnit, text };
}

/** Whether this timeframe is folded by counting rather than by the calendar. */
export function isIntraday(timeframe: Timeframe): boolean {
  return timeframe.unit === 'm' || timeframe.unit === 'h';
}

/** Minutes one bar covers, for an intraday timeframe only. */
export function minutesOf(timeframe: Timeframe): number | undefined {
  return isIntraday(timeframe) ? timeframe.count * NOMINAL[timeframe.unit] : undefined;
}

/**
 * One timeframe's length in minutes, with a month treated as thirty days.
 *
 * Two uses and neither of them folds anything: ordering two timeframes, which
 * is "is the request finer than the chart" and therefore OS6002, and sizing the
 * range of history a host is asked to fetch, which is a floor. A month is not a
 * fixed number of minutes, and where a bucket actually begins is the calendar's
 * job below.
 */
export function nominalMinutes(timeframe: Timeframe): number {
  return timeframe.count * NOMINAL[timeframe.unit];
}

/**
 * Minutes one bar of a chart's own interval covers, or nothing where the host
 * stated no interval this engine can read.
 *
 * A month is counted at its nominal length here, which is the answer the
 * session facts need and not a claim about a calendar: any bar of a day or more
 * spans a whole session whatever the exact figure, so every number past the
 * length of a session gives those facts the same answer.
 */
export function barMinutesOf(interval: string | undefined): number | null {
  if (interval === undefined) return null;
  const timeframe = parseTimeframe(interval);
  return timeframe === undefined ? null : nominalMinutes(timeframe);
}

/** Minutes in a day: the longest period counted from a trading day's open. */
const DAY_MINUTES = 1440;

/**
 * The bucket an instant falls in, or nothing when no key can be worked out.
 *
 * Nothing comes back for a calendar unit with no zone, and for an instant that
 * is not a finite number. Both leave the read absent rather than folded into a
 * bucket the engine invented.
 *
 * `session` is the host's stated session (`host-interface.md` 4.3), which is
 * read only where a zone was stated as well, because the session is wall clock.
 */
export function bucketKeyOf(
  instant: number,
  timeframe: Timeframe,
  zone: string | null,
  session?: SessionHours,
): number | undefined {
  if (!Number.isFinite(instant)) return undefined;
  const minutes = minutesOf(timeframe);
  if (minutes !== undefined) return intradayKey(instant, minutes, zone, session);

  if (zone === null) return undefined;
  const civil = fieldsIn(instant, zone);
  if (civil === null) return undefined;

  if (timeframe.unit === 'M') {
    return Math.floor((civil.year * 12 + (civil.month - 1)) / timeframe.count);
  }
  const days = dayNumber(civil.year, civil.month, civil.day);
  if (timeframe.unit === 'D') return Math.floor(days / timeframe.count);
  // 1970-01-01 was a Thursday, so shifting by three puts a Monday at the start
  // of week zero, which is the week start `stdlib.md` 12.2 fixes.
  return Math.floor(Math.floor((days + 3) / 7) / timeframe.count);
}

/**
 * An intraday key: the trading day, and the period within it counted from the
 * day's open.
 *
 * A key is one integer, so the two are packed: each day owns `2 * slots`
 * consecutive keys, wide enough for every period of the day on both sides of
 * the open, which keeps keys in time order across days and never lets the last
 * bucket of one day share a key with a bar before the next day's open. A period
 * of a day or longer has nothing to count within a day and keeps the count from
 * the epoch it always had.
 */
function intradayKey(
  instant: number,
  minutes: number,
  zone: string | null,
  session: SessionHours | undefined,
): number | undefined {
  if (minutes >= DAY_MINUTES) return Math.floor(instant / (minutes * MINUTE));
  const civil = fieldsIn(instant, zone ?? 'UTC');
  if (civil === null) return undefined;
  const place = tradingDayOf(zone === null ? undefined : session, civil);
  const slots = Math.ceil(DAY_MINUTES / minutes) + 1;
  return place.day * 2 * slots + slots + Math.floor(place.elapsed / minutes);
}

/**
 * Where a read's requested bars are folded from, `stdlib.md` 15.2.
 *
 * - `chart`: the chart's own bars. A whole multiple of an intraday chart's
 *   interval, a day, week or month on any chart, and a read whose chart states
 *   no interval: each of those buckets holds whole chart bars.
 * - `base`: bars at `base`, the longest interval that divides both the chart's
 *   and the requested one, which the host serves. An intraday request that is
 *   not a whole multiple of an intraday chart's interval, finer than it
 *   included: a bucket boundary would fall inside a chart bar, so the chart's
 *   own bars cannot be split into it and finer ones are folded instead.
 * - OS6002: a request finer than a chart of a day or longer. Its base would be
 *   minutes across the whole of a daily chart's history, which no read asks for.
 */
export type FoldPlan =
  | { readonly kind: 'chart' }
  | { readonly kind: 'base'; readonly base: Timeframe }
  | { readonly kind: 'refused'; readonly code: 'OS6002' };

export function foldPlan(requested: Timeframe, chart: Timeframe | undefined): FoldPlan {
  if (chart === undefined) return { kind: 'chart' };
  const wanted = minutesOf(requested);
  const have = minutesOf(chart);
  if (wanted !== undefined && have !== undefined) {
    if (wanted % have === 0) return { kind: 'chart' };
    const base = greatestDivisor(wanted, have);
    return { kind: 'base', base: { count: base, unit: 'm', text: `${base}m` } };
  }
  if (nominalMinutes(requested) < nominalMinutes(chart)) return { kind: 'refused', code: 'OS6002' };
  return { kind: 'chart' };
}

/** The whole multiple of the chart's interval at or above the requested one, for OS6015's fix. */
export function multipleAbove(requested: Timeframe, chart: Timeframe): string {
  const wanted = minutesOf(requested) ?? nominalMinutes(requested);
  const have = minutesOf(chart) ?? nominalMinutes(chart);
  return `${Math.max(1, Math.ceil(wanted / have)) * have}`;
}

function greatestDivisor(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y !== 0) {
    const r = x % y;
    x = y;
    y = r;
  }
  return x;
}
