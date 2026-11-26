/**
 * Higher timeframe and other instrument reads, folded onto the chart's bars.
 *
 * A read is an expression evaluated over a **different set of bars** than the
 * chart's, whose value is then folded back onto the chart's. Two halves, and
 * they are in two files: `request-body.ts` runs the expression once per
 * requested bar, and this decides which requested bar each chart bar is allowed
 * to see. The second half is where the off-by-one lives, so it is written as
 * one comparison repeated three times rather than as three rules.
 *
 * **Bars in, buckets out.** Source bars are grouped by the bucket key of their
 * open instant (`timeframe.ts`); a bucket becomes one requested bar. The source
 * is the chart's own bars for a read of the chart's instrument, which is the
 * read `host-interface.md` 5.1 says an engine can satisfy from what it already
 * holds, and the host's answer for a read of another instrument, which it never
 * can. One fold serves both, so the two kinds of read cannot drift apart.
 *
 * **The three modes differ in one thing: how far past the chart bar the fold is
 * allowed to look.** Everything else about them is the same code.
 *
 * | Mode | Source bars it may consume | Value the chart bar takes |
 * |---|---|---|
 * | `"confirmed"` | Those opening at or before this chart bar | The last bucket that closed |
 * | `"developing"` | Those opening at or before this chart bar | The bucket this bar is inside, so far |
 * | `"lookahead"` | Those belonging to this bar's bucket or earlier | The bucket this bar is inside, in full |
 *
 * Read the middle column, because it is the repainting question written out.
 * Confirmed and developing stop at the chart bar and can be computed live;
 * lookahead reads past it, which is why it repaints on history permanently and
 * by design, and why on the newest bucket, where there is nothing past the bar
 * to read, it is the bucket so far and nothing better exists.
 *
 * **A read with a base reads to the end of the chart bar.** Its source is bars
 * at a finer interval than the chart's (`request-plan.ts`), several of them
 * inside each chart bar, so stopping at the chart bar's open would leave every
 * one but the first unread. It consumes the source bars that open before the
 * chart bar ends, which is everything the chart bar itself was built from and
 * nothing after it, so confirmed and developing still never look past the bar.
 * A developing read then takes the bucket the chart bar's last instant is in,
 * which is the bucket still forming when the chart bar closes: on a ten minute
 * chart reading fifteen, the bar from ten past to twenty past shows the bucket
 * that opened at a quarter past.
 *
 * **The boundary.** A bucket has begun on the first chart bar whose key is the
 * new one, because a bar's open instant is what dates it. So a confirmed read
 * steps to the closed bucket's value on the first chart bar of the next bucket,
 * holds it across every bar inside that bucket including the last, and steps
 * again on the first bar of the one after. The bar a bucket closes on still
 * reads the bucket before it: at that bar's open, the bucket it is inside had
 * not closed.
 *
 * **Warmup translates by arithmetic and not by a rule.** The expression runs on
 * requested bars, so its own warmup is counted in requested bars and its absence
 * folds onto the chart like any other value: a twenty period average of daily
 * closes is absent until twenty daily bars exist, which on a five minute chart
 * is about a month in. The `warmup` field of the compiled program is what a host
 * extends the fetch range backwards by, a floor and not a promise, and an engine
 * given less gets a read that is absent for longer rather than a wrong number.
 */
import type { Span } from '../span/index.js';
import type { HostBar } from './bars.js';
import { sourceOf } from './bar-source.js';
import type { BarSource } from './bar-source.js';
import type { Clock, EngineLimits } from './budget.js';
import type { EngineHost } from './host.js';
import type { ResolvedInput } from './inputs.js';
import type { HostFacts, ManifestEntry, PositionFacts } from './library/index.js';
import type { Registers } from './registers.js';
import { RequestBody, bodyProgram } from './request-body.js';
import { askHost, reasonFor, undatable, undatableReason } from './request-plan.js';
import type { RequestPlan } from './request-plan.js';
import { bucketKeyOf } from './timeframe.js';
import type { CompiledProgram, Request } from './types.js';
import { ABSENT } from './values/index.js';
import type { Heap, Value } from './values/index.js';

export interface RequestParts {
  readonly program: CompiledProgram;
  /** Every read in the program, nested ones included, keyed by its own id. */
  readonly plans: ReadonlyMap<number, RequestPlan>;
  readonly host: EngineHost;
  readonly limits: EngineLimits;
  readonly clock: Clock | undefined;
  readonly library: readonly ManifestEntry[];
  readonly inputs: readonly ResolvedInput[];
  /** The facts a body inherits, with its own identity written over three of them. */
  readonly facts: HostFacts;
  /** The strategy's own position, which a body reads as the chart's bars do. */
  readonly position: PositionFacts;
  /**
   * The heap of the machine these reads land in, read when a bar asks for it.
   *
   * A function rather than the heap, because a read written inside another lands
   * in the enclosing body's heap and that body does not exist until its own
   * reads have been built.
   */
  heapOf(): Heap;
  spanAt(line: number, column: number): Span;
}

/** Where the fold of one read stands, and what a re-executed bar restores. */
interface Mark {
  readonly cursor: number;
  readonly openKey: number | undefined;
  readonly openFrom: number;
}

interface Read {
  readonly plan: RequestPlan;
  readonly register: number;
  readonly body: RequestBody;
  /** The host's bars for a `symbol` read, or nothing when the fold is the chart's. */
  readonly source: BarSource | undefined;
  readonly ready: boolean;
  readonly reason: string;
  /** How far into the source the fold has read. */
  cursor: number;
  openKey: number | undefined;
  /** Where in the source the bucket now forming began. */
  openFrom: number;
  open: HostBar | undefined;
  /** The value of the most recently closed bucket, which a confirmed read takes. */
  closedValue: Value;
  /** The highest bucket key ever closed, so a re-executed bar closes none twice. */
  highestClosed: number | undefined;
  mark: Mark;
}

const START: Mark = { cursor: 0, openKey: undefined, openFrom: 0 };

export class RequestSet {
  private readonly reads: Read[] = [];
  private readonly byId = new Map<number, Read>();
  private readonly parts: RequestParts;

  constructor(parts: RequestParts, requests: readonly Request[]) {
    this.parts = parts;
    for (const request of requests) {
      const plan = parts.plans.get(request.id);
      if (plan === undefined) continue;
      const read = build(parts, request, plan);
      this.reads.push(read);
      this.byId.set(request.id, read);
    }
  }

  get empty(): boolean {
    return this.reads.length === 0;
  }

  /**
   * Step 4: each read's value for this bar, written into its `"request"`
   * register.
   *
   * `fresh` says whether this is the first execution of this bar. A bar that is
   * executing again restores the fold to where it stood when the bar began and
   * rebuilds the bucket now forming from the source as it now stands, which is
   * what makes a moving bar idempotent one level down: the newest chart bar may
   * have been revised since the last execution, and the bucket it is inside has
   * to be rebuilt from the revision rather than from the reading it replaced.
   */
  fill(registers: Registers, bars: BarSource, index: number, fresh: boolean): void {
    const heap = this.parts.heapOf();
    for (const read of this.reads) {
      if (fresh) {
        read.mark = { cursor: read.cursor, openKey: read.openKey, openFrom: read.openFrom };
      } else {
        restore(read, bars);
      }
      // The body's value is the body's, in the body's heap. `carry` is what
      // makes it a value of the machine that is about to read it.
      registers.set(read.register, read.body.carry(valueOf(read, bars, index), heap));
    }
  }

  /** `req.isReady(read)`: whether the host has answered this one yet. */
  answered(id: Value): Value {
    return typeof id === 'number' ? this.byId.get(id)?.ready === true : false;
  }

  /** `req.error(read)`: the reason it failed, or the empty string when none has. */
  failure(id: Value): Value {
    return typeof id === 'number' ? this.byId.get(id)?.reason ?? '' : '';
  }
}

function build(parts: RequestParts, request: Request, plan: RequestPlan): Read {
  const view = bodyProgram(parts.program, request);
  const answer = askHost(plan, parts.host);
  const refused = answer !== undefined && 'refused' in answer ? answer.refused : undefined;
  let body: RequestBody | undefined;

  // The facts a body reads are the chart's, except the three that identify an
  // instrument: inside a read, those are the instrument and the interval the
  // read asked for. The two request calls answer about the reads written inside
  // this body, which is why the set below is built before the body is.
  let nested: RequestSet | undefined;
  const facts: HostFacts = {
    ...parts.facts,
    symbol: () => plan.query.instrument ?? parts.facts.symbol(),
    exchange: () => plan.query.exchange ?? parts.facts.exchange(),
    interval: () => plan.query.timeframe,
    requestReady: (id: Value) => nested?.answered(id) ?? false,
    requestError: (id: Value) => nested?.failure(id) ?? '',
  };
  nested = new RequestSet(
    // A read inside this one lands in this body's heap, which is built below.
    { ...parts, program: view, facts, heapOf: () => (body as RequestBody).objects },
    request.body.requests,
  );

  body = new RequestBody({
    program: view,
    limits: parts.limits,
    clock: parts.clock,
    host: facts,
    position: parts.position,
    library: parts.library,
    inputs: request.body.inputs.map((one) => ({
      series: one.series,
      value: parts.inputs.find((input) => input.key === one.input)?.value ?? null,
    })),
    nested,
    spanAt: parts.spanAt,
  });

  // A reason is the read saying why it will never answer. A refusal is the
  // host's; a calendar fold with no zone to date a bucket in is the engine's,
  // and it is stated here rather than left as an absence the study cannot
  // explain. The host's own words win where both hold: a source that refused is
  // the fix the user can act on first.
  const reason =
    refused !== undefined
      ? reasonFor(refused, plan.query)
      : undatable(plan)
        ? undatableReason(plan.query)
        : '';

  return {
    plan,
    register: request.series,
    body,
    source: answer !== undefined && 'bars' in answer ? sourceOf(answer.bars) : undefined,
    // A fold of the chart's own bars needs nothing from the host, so it is
    // answered the moment it is planned. A read the host is still fetching is
    // not: the read is absent, `req.isReady` is false, and the study keeps
    // drawing everything that does not depend on it. A read with a reason is
    // never ready: it is not waiting for anything.
    ready:
      reason === '' &&
      (answer === undefined
        ? plan.query.read === 'timeframe' && plan.base === undefined
        : 'bars' in answer),
    reason,
    cursor: 0,
    openKey: undefined,
    openFrom: 0,
    open: undefined,
    closedValue: ABSENT,
    highestClosed: undefined,
    mark: START,
  };
}

/** The read's value for the chart bar at `index`, and the fold that gets there. */
function valueOf(read: Read, bars: BarSource, index: number): Value {
  if (!read.ready) return ABSENT;
  const bar = bars.at(index);
  const at = bar?.time ?? null;
  if (at === null) return ABSENT;
  const key = keyOf(read, at);
  if (key === undefined) return ABSENT;
  if (read.plan.base !== undefined && read.plan.request.mode !== 'lookahead') {
    return throughEnd(read, bars, index, at);
  }

  const source = read.source ?? bars;
  const lookahead = read.plan.request.mode === 'lookahead';
  for (;;) {
    const next = source.at(read.cursor);
    if (next === undefined) break;
    const found = next.time === null ? undefined : keyOf(read, next.time);
    if (found === undefined) {
      // A source bar with no time, or none this calendar can date, belongs to
      // no bucket. It is stepped over rather than folded into whichever bucket
      // happens to be open.
      read.cursor += 1;
      continue;
    }
    // The one line the three modes differ in. A lookahead read may read to the
    // end of the bucket the chart bar is inside; the other two stop at the bar.
    if (lookahead ? found > key : (next.time ?? 0) > at) break;
    read.cursor += 1;
    feed(read, next, found);
  }

  if (read.plan.request.mode === 'confirmed') return read.closedValue;
  if (read.openKey !== key || read.open === undefined) return ABSENT;
  return read.body.peek(read.open);
}

/**
 * A read with a base: the source bars that open before this chart bar ends.
 *
 * The end is the next chart bar's open, or one chart interval past this bar's
 * open where that comes first or there is no next bar yet, so a source that runs
 * ahead of the chart is never read past the bar the chart is on.
 */
function throughEnd(read: Read, bars: BarSource, index: number, at: number): Value {
  const span = read.plan.chartSpan ?? 0;
  const next = bars.at(index + 1)?.time ?? null;
  const end = next === null ? at + span : Math.min(next, at + span);
  const source = read.source;
  if (source === undefined) return ABSENT;
  for (;;) {
    const bar = source.at(read.cursor);
    if (bar === undefined) break;
    if (bar.time !== null && bar.time >= end) break;
    read.cursor += 1;
    const found = bar.time === null ? undefined : keyOf(read, bar.time);
    if (found !== undefined) feed(read, bar, found);
  }
  if (read.plan.request.mode === 'confirmed') return read.closedValue;
  const last = keyOf(read, end - 1);
  if (last === undefined || read.openKey !== last || read.open === undefined) return ABSENT;
  return read.body.peek(read.open);
}

function keyOf(read: Read, instant: number): number | undefined {
  return bucketKeyOf(instant, read.plan.timeframe, read.plan.zone, read.plan.session);
}

/**
 * One source bar folded in.
 *
 * A bar whose key is the open bucket's extends it. A bar whose key is new
 * closes the open bucket, which is the only place a requested bar ever settles:
 * a bucket is closed by something later, never by the clock. The guard on
 * `highestClosed` is what makes that idempotent, because a chart bar that
 * closed a bucket on its first execution must not close it again on its second.
 */
function feed(read: Read, bar: HostBar, key: number): void {
  if (read.openKey === key && read.open !== undefined) {
    read.open = extend(read.open, bar);
    return;
  }
  if (read.openKey !== undefined && read.open !== undefined) {
    if (read.highestClosed === undefined || read.openKey > read.highestClosed) {
      read.closedValue = read.body.settle(read.open);
      read.highestClosed = read.openKey;
    }
  }
  read.openKey = key;
  read.openFrom = read.cursor - 1;
  read.open = start(bar);
}

/** A re-executed bar: the fold as it stood when the bar began. */
function restore(read: Read, bars: BarSource): void {
  read.cursor = read.mark.cursor;
  read.openKey = read.mark.openKey;
  read.openFrom = read.mark.openFrom;
  read.open = undefined;
  if (read.openKey === undefined) return;
  const source = read.source ?? bars;
  for (let at = read.openFrom; at < read.cursor; at += 1) {
    const bar = source.at(at);
    if (bar === undefined || bar.time === null) continue;
    if (keyOf(read, bar.time) !== read.openKey) continue;
    read.open = read.open === undefined ? start(bar) : extend(read.open, bar);
  }
}

/**
 * The first source bar of a bucket, as a bar of its own.
 *
 * The bucket's `time` is this bar's open instant rather than the instant the
 * bucket's key names. The two differ whenever trading begins after the boundary,
 * which is every session on a daily fold, and the first bar's instant is a
 * reading from the data while the boundary is a number the engine chose.
 */
function start(bar: HostBar): HostBar {
  return {
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume ?? null,
    time: bar.time,
    oi: bar.oi ?? null,
  };
}

/**
 * One more source bar in the same bucket.
 *
 * **Absence propagates through every field**, which is `host-interface.md` 3.1:
 * an absent price is a hole and what it feeds turns absent. So a bucket whose
 * high is missing from one of its bars has no high, rather than the highest of
 * the bars that did report one, which would be a number with no name. Open is
 * the first bar's, close is the last bar's, and open interest is a level rather
 * than a flow so the coarser bar takes the last and never the sum.
 */
function extend(into: HostBar, bar: HostBar): HostBar {
  return {
    open: into.open,
    high: higher(into.high, bar.high),
    low: lower(into.low, bar.low),
    close: bar.close ?? null,
    volume: both(into.volume ?? null, bar.volume ?? null),
    time: into.time,
    oi: bar.oi ?? null,
  };
}

function higher(a: number | null, b: number | null | undefined): number | null {
  if (a === null || typeof b !== 'number') return null;
  return b > a ? b : a;
}

function lower(a: number | null, b: number | null | undefined): number | null {
  if (a === null || typeof b !== 'number') return null;
  return b < a ? b : a;
}

function both(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a + b;
}

