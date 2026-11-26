/**
 * Another instrument's bars: the one thing a study needs that the chart's own
 * bars cannot answer.
 *
 * Everything else this adapter maps is computed from bars the chart already
 * holds, this included where the read is of the chart's own instrument: the
 * engine folds those itself and this is never asked. A read of **another**
 * instrument is different, and the difference is the whole of this file.
 *
 * **The engine asks once and synchronously; the chart answers later.** A
 * request's identity is fixed before bar 0 (`compiled-program.md` 2.16), so the
 * engine settles the whole set at load and asks the host for each one there and
 * then. A chart's transport is a promise. So the two are joined by a station
 * that lives in the study instance's own store: the engine's question is
 * answered from what the station holds now, which on the first pass is nothing,
 * and the answer for a read nobody has fetched yet is `pending`. The read is
 * absent, `req.isReady` is false, the rest of the study keeps drawing, and that
 * is exactly what `stdlib.md` 15.5 describes.
 *
 * **The lifecycle is what has a transport, and it runs after the first
 * calculation.** A chart computes a study once before it attaches its
 * lifecycle, so a station that waited for a transport before answering would
 * refuse the study at load rather than draw it while the bars arrive. Instead
 * the first calculation records what it was asked for, the lifecycle brings the
 * transport and fetches it, and the recompute it then asks for is the one that
 * has the bars. A study is drawn twice and never refused for a fetch that had
 * not happened yet.
 *
 * **A range is a floor, never a promise.** What the host is asked for is the
 * chart's own span, extended back by the read's `warmup` in requested bars and
 * forward to the end of the bucket the newest chart bar is inside, and then
 * quantised to bucket boundaries. Quantising is what stops a fetch per bar: the
 * range a chart asks for is then the same range for every bar inside one
 * requested bar, and it widens once when a bucket closes. A host that serves
 * less gets a read that is absent for longer, never a wrong number.
 *
 * **What was fetched keeps serving while the next fetch is in flight.** The
 * alternative is a line that breaks every time a bucket closes, which looks like
 * a defect in the study rather than a refresh in the transport. The first fetch
 * has nothing to serve and is the only one that reads as pending.
 *
 * **A failure is the host's own words.** A transport that rejects is OS6009
 * carrying the message it rejected with, which is the one the chart writes when
 * a host registered no provider at all: `req.error(read)` then says so in the
 * script, the data status says so to the user, and the study keeps drawing
 * everything that does not depend on the read.
 */
import type {
  HostBar,
  RequestAnswer,
  RequestProvider,
  RequestQuery,
} from '../../core/engine/index.js';
import { minutesOf, nominalMinutes, parseTimeframe } from '../../core/engine/index.js';
import { hostBar } from './bars.js';
import type { ChartBar, ChartStore } from './contract.js';
import type { ChartAttachContext, ChartDataStatus } from './surfaces.js';

/** The store key. Namespaced, because the store belongs to the host as well. */
const STATION = 'openscript:requests';

const MINUTE = 60;

/** What one read needs fetched, with its range already quantised. */
interface Need {
  readonly symbol: string;
  readonly exchange: string | undefined;
  /** The interval the bars are fetched at: the read's own, or its base. */
  readonly interval: string;
  /** The read's own timeframe, whose buckets the range is quantised to. */
  readonly reach: string;
  readonly from: number;
  readonly to: number;
}

/** What the station holds about one instrument and interval. */
interface Entry {
  /** The range that was asked for, so a narrower need does not refetch. */
  from: number;
  to: number;
  fetching: boolean;
  /** The bars in hand, which keep serving while a wider fetch is in flight. */
  bars: readonly HostBar[] | undefined;
  /** The host's own words, when it refused. */
  reason: string | undefined;
  /** Whether the host answered with no bars at all for the range. */
  empty: boolean;
}

/** The half of the lifecycle the station drives. */
interface Transport {
  request(need: Need): Promise<readonly ChartBar[]>;
  recompute(): void;
  status(status: ChartDataStatus): void;
  retry(retry: (() => void) | null): void;
}

export class Station {
  private readonly entries = new Map<string, Entry>();
  /** What the last calculation asked about, keyed the same way. */
  private readonly wanted = new Map<string, Need>();
  private transport: Transport | undefined;
  private closed = false;
  private unsubscribe: (() => void) | undefined;
  /** One chart bar's length in seconds, from the interval the chart stated. */
  private chartSpan = 0;

  /**
   * The provider the engine is loaded with, bound to the bars on screen.
   *
   * Asking for one is the start of a round: the engine is about to ask about
   * every read this program makes, so what was wanted before this moment is
   * what the previous program wanted. A setting that names a different
   * instrument would otherwise leave the old one being fetched for as long as
   * the study lives, and reported on.
   */
  provider(bars: readonly ChartBar[], interval?: string): RequestProvider {
    this.wanted.clear();
    const chart = interval === undefined ? undefined : parseTimeframe(interval);
    const minutes = chart === undefined ? undefined : minutesOf(chart);
    this.chartSpan = minutes === undefined ? 0 : minutes * MINUTE;
    return (query: RequestQuery): RequestAnswer | undefined => {
      // A read of the chart's own instrument at a whole multiple of its interval
      // is folded from the bars the engine already holds, which is the read
      // `host-interface.md` 5.1 says it can satisfy without a host. One whose
      // bars come from a finer base interval cannot be, and is fetched like
      // another instrument's.
      if (query.read === 'timeframe' && query.interval === query.timeframe) return undefined;
      const need = needFor(query, bars, this.chartSpan);
      if (need === undefined) return undefined;
      const key = keyOf(need);
      this.wanted.set(key, widest(this.wanted.get(key), need));
      return answerOf(this.entries.get(key));
    };
  }

  /**
   * The range each read needs, against the bars as they now stand.
   *
   * A calculation that reused the held engine never asked the provider
   * anything, so nothing would notice that the newest chart bar has moved into
   * the next requested bucket. This is what notices: it widens what is wanted,
   * and the fetch that follows asks for the recompute that reads it. An answer
   * is never spliced into a run that is already past the bars it would have
   * changed, which is `host-interface.md` 5.3.
   */
  extend(bars: readonly ChartBar[]): void {
    const last = bars[bars.length - 1];
    if (last === undefined) return;
    for (const [key, need] of this.wanted) {
      const to = reachOf(need.reach, need.interval, last.time, this.chartSpan);
      if (to !== undefined && to > need.to) this.wanted.set(key, { ...need, to });
    }
  }

  /**
   * After a calculation: start what is missing and say where the study stands.
   *
   * It is the end of the calculation rather than the middle of it because a
   * fetch that resolves asks for a recompute, and asking for one from inside the
   * calculation it would replace is a loop waiting to be written.
   */
  settle(): void {
    this.pump();
    const transport = this.transport;
    if (transport === undefined) return;
    transport.status(this.status());
    transport.retry(this.failed() ? (): void => this.again() : null);
  }

  /** The lifecycle, with the transport the first calculation did not have. */
  open(ctx: ChartAttachContext): void {
    const ask = ctx.requestBars;
    if (ask === undefined) return;
    this.closed = false;
    this.transport = {
      request: (need) =>
        ask({
          symbol: need.symbol,
          ...(need.exchange === undefined ? {} : { exchange: need.exchange }),
          interval: need.interval,
          from: need.from,
          to: need.to,
        }),
      recompute: () => ctx.requestRecompute(),
      status: (status) => ctx.setDataStatus?.(status),
      retry: (retry) => ctx.setDataRetry?.(retry),
    };
    // An identity change makes every key a different one, so the entries under
    // the old identity would sit there for as long as the instance does.
    this.unsubscribe = ctx.subscribeDataChanges?.((change) => {
      if (change === 'context') this.entries.clear();
    });
    this.settle();
  }

  /**
   * The lifecycle is over: nothing in flight may write anything again.
   *
   * What was fetched is kept. A chart runs the lifecycle again after a settings
   * change, and throwing the bars away there would put a network round trip
   * behind moving a slider. A fetch that was in flight is marked as not in
   * flight, so a station that is opened again starts it rather than waiting for
   * an answer whose callback has been told to do nothing.
   */
  close(): void {
    this.closed = true;
    this.transport = undefined;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    for (const entry of this.entries.values()) entry.fetching = false;
  }

  /** Every read the host refused, tried again from the beginning. */
  private again(): void {
    for (const [key, entry] of this.entries) {
      if (entry.reason !== undefined || entry.empty) this.entries.delete(key);
    }
    this.pump();
    this.transport?.recompute();
  }

  private pump(): void {
    const transport = this.transport;
    if (transport === undefined || this.closed) return;
    for (const [key, need] of this.wanted) {
      const entry = this.entries.get(key);
      if (entry !== undefined && entry.fetching) continue;
      if (entry !== undefined && entry.reason !== undefined) continue;
      if (entry !== undefined && need.from >= entry.from && need.to <= entry.to) continue;
      this.fetch(key, need, entry, transport);
    }
  }

  private fetch(key: string, need: Need, held: Entry | undefined, transport: Transport): void {
    const entry: Entry = {
      from: need.from,
      to: need.to,
      fetching: true,
      bars: held?.bars,
      reason: undefined,
      empty: false,
    };
    this.entries.set(key, entry);
    transport.request(need).then(
      (bars) => {
        this.landed(key, entry, bars);
      },
      (error: unknown) => {
        this.refused(key, entry, error);
      },
    );
  }

  /** An answer, once the transport has one. */
  private landed(key: string, entry: Entry, bars: readonly ChartBar[]): void {
    if (this.closed || this.entries.get(key) !== entry) return;
    entry.fetching = false;
    entry.empty = bars.length === 0;
    if (bars.length > 0) entry.bars = bars.map(hostBar);
    this.transport?.recompute();
  }

  private refused(key: string, entry: Entry, error: unknown): void {
    if (this.closed || this.entries.get(key) !== entry) return;
    entry.fetching = false;
    entry.reason = reasonOf(error);
    this.transport?.recompute();
  }

  private failed(): boolean {
    for (const entry of this.entries.values()) {
      if (entry.reason !== undefined || entry.empty) return true;
    }
    return false;
  }

  /** Where the study's own data stands, in the four words the chart has. */
  private status(): ChartDataStatus {
    let waiting = false;
    let empty = false;
    for (const key of this.wanted.keys()) {
      const entry = this.entries.get(key);
      if (entry === undefined || entry.fetching) waiting = true;
      if (entry?.reason !== undefined) return { state: 'error', error: new Error(entry.reason) };
      if (entry?.empty === true) empty = true;
    }
    if (waiting) return { state: 'loading' };
    if (empty) return { state: 'empty' };
    return { state: 'ready' };
  }
}

/** The station this instance holds, created by whichever half arrives first. */
export function stationIn(store: ChartStore): Station {
  const held = store[STATION];
  if (held instanceof Station) return held;
  const made = new Station();
  store[STATION] = made;
  return made;
}

/** The station this instance holds, when it has one. */
export function stationOf(store: ChartStore): Station | undefined {
  const held = store[STATION];
  return held instanceof Station ? held : undefined;
}

function keyOf(need: Need): string {
  return `${need.symbol}|${need.exchange ?? ''}|${need.interval}`;
}

/** Two needs for one series: the wider range, so one fetch serves both. */
function widest(held: Need | undefined, need: Need): Need {
  if (held === undefined) return need;
  return {
    ...need,
    from: Math.min(held.from, need.from),
    to: Math.max(held.to, need.to),
  };
}

function answerOf(entry: Entry | undefined): RequestAnswer {
  if (entry === undefined) return { pending: true };
  if (entry.reason !== undefined) {
    return { refused: { code: 'OS6009', reason: entry.reason } };
  }
  if (entry.bars !== undefined) return { bars: entry.bars };
  if (entry.empty) return { refused: { code: 'OS6008' } };
  return { pending: true };
}

/**
 * The range one read is fetched over, quantised to requested bar boundaries.
 *
 * The nominal length of a requested bar is what the arithmetic uses, a month
 * included. It decides how far back and how far forward to ask, not where a
 * bucket begins, which is the calendar's and the engine's; asking for a few
 * hours too many is a floor being generous and asking for exactly the right
 * calendar month would need the instrument's zone to be stated here as well.
 */
function needFor(
  query: RequestQuery,
  bars: readonly ChartBar[],
  chartSpan: number,
): Need | undefined {
  const symbol = query.instrument;
  const first = bars[0];
  const last = bars[bars.length - 1];
  if (symbol === null || first === undefined || last === undefined) return undefined;
  const span = spanOf(query.timeframe);
  const to = reachOf(query.timeframe, query.interval, last.time, chartSpan);
  if (span === undefined || to === undefined) return undefined;
  const warmup = query.warmup ?? 0;
  return {
    symbol,
    exchange: query.exchange ?? undefined,
    interval: query.interval,
    reach: query.timeframe,
    from: Math.floor((first.time - warmup * span) / span) * span,
    to,
  };
}

/** One bar of a timeframe, in seconds, at its nominal length. */
function spanOf(text: string): number | undefined {
  const timeframe = parseTimeframe(text);
  if (timeframe === undefined) return undefined;
  return (minutesOf(timeframe) ?? nominalMinutes(timeframe)) * MINUTE;
}

/**
 * How far forward a read is fetched: to the end of the requested bucket the
 * newest chart bar is in, and, for a read whose bars are a finer base, at least
 * to the end of that chart bar, since a finer bucket can close before the chart
 * bar does and the bars after it are still the chart bar's own.
 */
function reachOf(
  timeframe: string,
  interval: string,
  newest: number,
  chartSpan: number,
): number | undefined {
  const span = spanOf(timeframe);
  if (span === undefined) return undefined;
  const bucketEnd = Math.ceil((newest + 1) / span) * span;
  if (interval === timeframe) return bucketEnd;
  const step = spanOf(interval);
  if (step === undefined) return undefined;
  return Math.max(bucketEnd, Math.ceil((newest + Math.max(chartSpan, step)) / step) * step);
}

/** The host's own words, carried and never paraphrased. */
function reasonOf(error: unknown): string {
  if (error instanceof Error && error.message !== '') return error.message;
  return typeof error === 'string' && error !== '' ? error : 'the host gave no reason';
}
