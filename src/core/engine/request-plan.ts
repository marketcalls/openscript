/**
 * What is settled about a read before bar 0, `compiled-program.md` 2.16.
 *
 * **A request's identity is fixed before bar 0.** That is what lets the whole
 * set be known at load, what lets a host fetch in parallel and cache by
 * instrument and timeframe, and what makes a request that changed afterwards
 * OS6013. So the three identity fields are resolved here, once, from the value
 * the script wrote, the setting it named or the chart fact it named, and
 * nothing below bar 0 ever asks again.
 *
 * **Where the requested bars come from is settled here too** (`timeframe.ts`,
 * `foldPlan`): the chart's own bars, or bars at a finer base interval that the
 * host serves, for an intraday request that is not a whole multiple of an
 * intraday chart's interval, finer than it included. The query carries that
 * interval as `interval`, so a host fetches the bars the fold needs.
 *
 * **Three refusals belong at load and four belong to the host.** A timeframe
 * the language does not know (OS6001), one finer than a chart of a day or
 * longer (OS6002), and a read that needs a host's bars on a host that serves
 * none (OS6015 for a coarser one, OS6002 for a finer one) are facts about the
 * program, the chart and the host, all known before a bar runs, so they stop
 * the load and name what was refused. An unknown instrument (OS6007), a range
 * with no bars (OS6008), a source that refused (OS6009) and an interval the feed
 * does not carry (OS6014) are the host's answers: they leave the read absent,
 * put the reason in `req.error(read)` and let the study keep drawing everything
 * else, which is `stdlib.md` 15.5.
 */
import { diagnosticFor } from '../diagnostics/index.js';
import type { Diagnostic } from '../diagnostics/index.js';
import { NO_POSITION, failure } from './errors.js';
import type { EngineHost, RequestAnswer, RequestQuery, RequestRefusal } from './host.js';
import type { ResolvedInput } from './inputs.js';
import type { SessionHours } from './session/index.js';
import type { Request, RequestField } from './types.js';
import { foldPlan, isIntraday, minutesOf, multipleAbove, nominalMinutes, parseTimeframe } from './timeframe.js';
import type { Timeframe } from './timeframe.js';

/** What a read holds once its identity, its timeframe and its source are fixed. */
export interface RequestPlan {
  readonly request: Request;
  readonly query: RequestQuery;
  readonly timeframe: Timeframe;
  /** The zone a calendar bucket is dated in, or nothing when none was stated. */
  readonly zone: string | null;
  /** The session an intraday bucket is counted from, when the host stated one. */
  readonly session: SessionHours | undefined;
  /**
   * The base interval the requested bars are folded from, for a read the
   * chart's own bars cannot be split into, or nothing when they can.
   */
  readonly base: Timeframe | undefined;
  /** One chart bar's length in milliseconds, for a read with a base. */
  readonly chartSpan: number | null;
}

export type PlanResult =
  | { readonly ok: true; readonly plans: readonly RequestPlan[] }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

/**
 * One of the three identity fields, resolved.
 *
 * Three forms and no fourth: the string the script wrote, the value of the
 * setting it named, and one of the three chart facts that identify a chart
 * rather than describe it.
 */
export function identityOf(
  field: RequestField,
  inputs: readonly ResolvedInput[],
  host: EngineHost,
): string | null {
  if (typeof field === 'string') return field;
  if (field === null || typeof field !== 'object' || Array.isArray(field)) return null;

  const named = field as { readonly input?: string; readonly chart?: string };
  if (typeof named.input === 'string') {
    const found = inputs.find((one) => one.key === named.input);
    return typeof found?.value === 'string' ? found.value : null;
  }
  if (named.chart === 'symbol') return host.instrument?.symbol ?? null;
  if (named.chart === 'exchange') return host.instrument?.exchange ?? null;
  if (named.chart === 'interval') return host.instrument?.interval ?? null;
  return null;
}

/**
 * Every read the program makes, with its identity settled.
 *
 * Walks the nested reads as well, because a read written inside another is part
 * of the program and a host handed a list with one missing would fetch less
 * than the file asks for.
 */
export function planRequests(
  requests: readonly Request[],
  inputs: readonly ResolvedInput[],
  host: EngineHost,
): PlanResult {
  const chart = chartTimeframe(host);
  const plans: RequestPlan[] = [];
  const problem = collect(requests, inputs, host, chart, plans, true);
  if (problem !== undefined) return { ok: false, diagnostic: problem };
  return { ok: true, plans };
}

function collect(
  requests: readonly Request[],
  inputs: readonly ResolvedInput[],
  host: EngineHost,
  chart: Timeframe | undefined,
  into: RequestPlan[],
  outermost: boolean,
): Diagnostic | undefined {
  for (const request of requests) {
    const written = identityOf(request.timeframe, inputs, host);
    const timeframe = written === null ? undefined : parseTimeframe(written);
    if (timeframe === undefined) {
      return failure('OS6001', NO_POSITION, { value: written ?? 'nothing' });
    }
    // The chart's interval is a host fact and a host may state none. Without it
    // there is nothing to compare a request against, so the chart's own bars
    // are folded as they come rather than judged against a value nobody
    // supplied.
    const plan = foldPlan(timeframe, chart);
    if (plan.kind === 'refused' && chart !== undefined) {
      return failure('OS6002', NO_POSITION, { chart: chart.text, requested: timeframe.text });
    }
    const base = plan.kind === 'base' ? plan.base : undefined;
    // A base is bars the host serves, so a host that serves none cannot give
    // one; neither can a read written inside another, whose bars are the outer
    // read's buckets rather than a series a host holds. Both keep the refusal
    // a request that does not fold into its chart always had.
    if (base !== undefined && chart !== undefined && (host.requestBars === undefined || !outermost)) {
      if (nominalMinutes(timeframe) < nominalMinutes(chart)) {
        return failure('OS6002', NO_POSITION, { chart: chart.text, requested: timeframe.text });
      }
      return failure('OS6015', NO_POSITION, {
        requested: timeframe.text,
        chart: chart.text,
        suggestion: multipleAbove(timeframe, chart),
      });
    }

    const chartMinutes = chart === undefined ? undefined : minutesOf(chart);
    into.push({
      request,
      timeframe,
      zone: host.instrument?.timezone ?? null,
      session: host.instrument?.session,
      base,
      chartSpan: base === undefined || chartMinutes === undefined ? null : chartMinutes * 60_000,
      query: {
        id: request.id,
        read: request.read,
        instrument: instrumentOf(request, inputs, host),
        exchange: exchangeOf(request, inputs, host),
        timeframe: timeframe.text,
        interval: base?.text ?? timeframe.text,
        mode: request.mode,
        warmup: request.warmup,
      },
    });
    const nested = collect(request.body.requests, inputs, host, timeframe, into, false);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

/**
 * The instrument a read asks about, with the format's own default applied.
 *
 * 2.16 spells a read of the chart's own instrument as a `null` `symbol`, so
 * resolving it here is applying the format's rule rather than inventing one:
 * the host is handed the identity it gave for the chart, which is what
 * `host-interface.md` 5.2 says a request carries.
 *
 * **The default belongs to a `"timeframe"` read and to nothing else.** A
 * `"symbol"` read whose identity did not resolve, because the setting behind it
 * holds something that is not an instrument, stays absent. Falling back there
 * would turn a read of another instrument into a second read of this one, and
 * the study would draw a line nobody asked for with nothing to say it had
 * substituted anything.
 */
function instrumentOf(
  request: Request,
  inputs: readonly ResolvedInput[],
  host: EngineHost,
): string | null {
  const named = identityOf(request.symbol, inputs, host);
  if (named !== null) return named;
  return request.read === 'timeframe' ? host.instrument?.symbol ?? null : null;
}

/**
 * Where a read's instrument trades, with `stdlib.md` 15.1's default applied.
 *
 * `req.symbol`'s signature defaults `exchange` to `chart.exchange`, and 2.16
 * spells the omission as `null`, "means the chart's exchange". A host handed
 * that `null` would have to apply the rule against the record it supplied, and
 * a host that applied it differently, or not at all, would resolve an
 * instrument on a venue the script never named. So it is applied once, here.
 */
function exchangeOf(
  request: Request,
  inputs: readonly ResolvedInput[],
  host: EngineHost,
): string | null {
  return identityOf(request.exchange, inputs, host) ?? host.instrument?.exchange ?? null;
}

/** The chart's own interval as a timeframe, when the host stated a usable one. */
function chartTimeframe(host: EngineHost): Timeframe | undefined {
  const interval = host.instrument?.interval;
  return interval === undefined ? undefined : parseTimeframe(interval);
}

/**
 * What the host says about one read.
 *
 * A host with no provider is not asked. A read of the chart's own instrument is
 * then folded from the bars the engine already holds, and a read of another
 * instrument cannot be: the engine holds none of that instrument's bars, so
 * nothing to serve is the same answer as an instrument the host does not know.
 */
export function askHost(plan: RequestPlan, host: EngineHost): RequestAnswer | undefined {
  const answer = host.requestBars?.(plan.query);
  if (answer !== undefined) return answer;
  // A base has no chart bars to fall back on: nothing served is a feed that
  // does not carry that interval for this instrument.
  if (plan.base !== undefined) return { refused: { code: 'OS6014' } };
  if (plan.query.read === 'timeframe') return undefined;
  return { refused: { code: 'OS6007' } };
}

/**
 * Whether this read can date a bucket at all.
 *
 * A day, week or month request is folded by the calendar, and a calendar
 * boundary is a civil date read in a zone (`timeframe.ts`). A host that stated
 * no timezone leaves the fold with no key for any bar, so the read is absent on
 * every bar of the run and will be on every future one: nothing that arrives
 * later supplies a fact the instrument record does not hold.
 *
 * That is a dead read, and a dead read a study cannot explain is the worst of
 * the three: the trader has already looked at the blank pane. So it is answered
 * here rather than left as absence, and `req.isReady` and `req.error` say it.
 */
export function undatable(plan: RequestPlan): boolean {
  return !isIntraday(plan.timeframe) && plan.zone === null;
}

/**
 * What `req.error(read)` says about a read with no zone to date its buckets.
 *
 * OS6012's own message, because the zone is an instrument fact the host did not
 * supply and that is exactly what this read needs and cannot default. Nothing
 * is raised: a fact the host did not state leaves the read absent, as
 * `host-interface.md` 4.5 settles it, and this is the sentence that explains
 * the absence rather than a second answer to it.
 */
export function undatableReason(query: RequestQuery): string {
  return diagnosticFor('OS6012', NO_POSITION, { fact: 'a timezone', symbol: named(query) }).message;
}

/** The instrument a reason names: the one the read asked for, or the chart's. */
function named(query: RequestQuery): string {
  return query.instrument ?? 'the chart\'s instrument';
}

/**
 * The reason a refusal reads as through `req.error(read)`.
 *
 * The catalogue's own message, filled with the identity the read asked for and
 * with the host's own words where it gave them. The host's words are carried
 * and not paraphrased, because "the account's data subscription does not cover
 * this instrument" is actionable and "the request failed" is not.
 */
export function reasonFor(refusal: RequestRefusal, query: RequestQuery): string {
  const symbol = named(query);
  const exchange = query.exchange ?? 'the chart\'s exchange';
  const reason = refusal.reason ?? 'the host gave no reason';
  switch (refusal.code) {
    case 'OS6007':
      return diagnosticFor('OS6007', NO_POSITION, { symbol, exchange }).message;
    case 'OS6008':
      return diagnosticFor('OS6008', NO_POSITION, { symbol, timeframe: query.interval }).message;
    case 'OS6014':
      return diagnosticFor('OS6014', NO_POSITION, {
        timeframe: query.interval,
        symbol,
        available: refusal.available ?? 'nothing it named',
      }).message;
    case 'OS6015':
      return diagnosticFor('OS6015', NO_POSITION, {
        requested: query.timeframe,
        chart: 'the chart\'s interval',
        suggestion: refusal.available ?? 'a whole multiple of it',
      }).message;
    default:
      return diagnosticFor('OS6009', NO_POSITION, {
        symbol,
        timeframe: query.interval,
        reason,
      }).message;
  }
}
