/**
 * Driving the engine from a chart's recompute.
 *
 * The descriptor's two calculation hooks are the engine's two entry points
 * almost exactly. A full recompute is a fresh engine over every bar. A tail
 * change is `update()` on the bar that moved and `append()` for anything after
 * it, which is what the engine's rollback exists for: re-executing a moving bar
 * gives the same numbers as executing it once, so a live chart and a backtest of
 * the same data agree. Nothing here recomputes anything the engine computes.
 *
 * **The tail path is refused rather than trusted.** A held engine is only usable
 * while it was loaded from the same settings and has executed exactly the bars
 * before the tail, so the settings are compared by their own spelling and the
 * first and last bar times are compared against what was run. Anything that does
 * not line up returns nothing and the chart falls back to a full recompute,
 * because splicing a tail onto a history that has changed underneath it draws a
 * wrong study that looks entirely plausible.
 *
 * **The engine never throws and a chart's calculation has to.** A failure the
 * engine returns becomes an error carrying that diagnostic whole, which is the
 * one place in this adapter where the two error models meet.
 */
import type {
  Clock,
  EffectRoute,
  Engine,
  EngineHost,
  EngineLimits,
  Grid,
  RequestProvider,
  Instrument,
  Drawing,
  TimeResolver,
  Value,
} from '../../core/engine/index.js';
import { load, utcTime } from '../../core/engine/index.js';
import type { CompiledProgram } from '../../core/emit/index.js';
import type { SourceFile } from '../../core/index.js';
import { hostBar, hostNow, stateFor } from './bars.js';
import type { ChartBar, ChartCalcContext, ChartSettings, ChartStore } from './contract.js';
import { capabilitiesOf } from './capabilities.js';
import { refused, stopped } from './errors.js';
import { undrawable } from './undrawable.js';
import { stationIn, stationOf } from './requests.js';
import { engineSettings, signatureOf } from './settings.js';
import { answersFor, needsVenue, routeInto, venueFor } from './venue.js';
import type { HeldVenue } from './venue.js';
import { runWhole, walkWith } from './driving.js';
import type { Held } from './driving.js';
import type { Simulator } from '../../core/backtest/index.js';

/** What a host tells the adapter that neither the chart nor the program says. */
export interface ChartAdapterOptions {
  /**
   * The registry id, and the name a saved layout stores.
   *
   * It defaults to the program's own source hash, so the same script restores
   * to the same study and an edited script does not silently inherit the
   * settings of the one it replaced.
   */
  readonly id?: string;
  /** The category a picker groups the study under, when `meta.group` is empty. */
  readonly category?: string;
  /**
   * The chart library's own version: the `VERSION` string it exports, which a
   * host that imports the chart already holds, passed on as
   * `descriptorFor(program, { chartVersion: VERSION })`.
   *
   * It says which of the descriptor's hooks the chart this descriptor is
   * registered with will read. Two arrived after the oldest chart the peer
   * range accepts: a band's per-bar colour and the list of grids. From 2.5.4
   * on, a band whose colour the script computes is drawn bar by bar and every
   * declared grid is drawn. Before it, or when nothing is stated, the adapter
   * cannot tell whether the chart will read either hook, and a chart that
   * ignores one draws a band in its own default colours or the first grid
   * alone, with nothing said. So such a program is refused before any bar runs
   * with OS6024, which is what a host that states nothing got before this
   * option existed.
   *
   * The version rather than a switch per hook, because it is one fact the
   * host already holds, it moves with the chart the host actually installed,
   * and a hook the adapter learns to read later needs nothing new from any
   * host. `capabilities.ts` has the rule, prereleases and unreadable strings
   * included.
   */
  readonly chartVersion?: string;
  /**
   * What the host has stored for this study's inputs, for the declared shape.
   *
   * A declaration option may be written as an `input()`, and `docs/inputs.md`
   * teaches that as how a reader changes something the declaration decides:
   * `study("S", precision = input(2, "Places"))` puts the pane's precision on
   * the settings dialog. The engine resolves such a field against the settings
   * it was loaded with. The descriptor's declared shape is fixed before bar 0
   * and is a value rather than a call, so the only settings it can be resolved
   * against are the ones a host states here; built without them, every one of
   * those fields reads the declared default and a stored value reaches none of
   * them.
   *
   * A host that keeps one descriptor per study instance passes that instance's
   * stored settings and builds again when a user changes one. A host that
   * registers one descriptor for a script and runs several instances against it
   * gets the declared shape of whatever it built with, and the parts that are
   * asked for again per call follow each instance: which those are is recorded
   * in `spec/chart-narrowings.json`, and `scripts/check-chart-surface.mjs`
   * measures both halves rather than leaving the sentence to be believed.
   *
   * These are the chart's own settings object, in the chart's own spelling, and
   * the same conversions apply as on the calculation path: a colour arrives as
   * a CSS string and a choice as the text of an option.
   */
  readonly settings?: ChartSettings;
  /**
   * The plate colour a marker takes when the script named none.
   *
   * `signal`'s colour argument defaults to absence, which `stdlib.md` 14.3
   * reads as the host's own default for a marker, and a chart needs a colour
   * for every marker it draws. A host with a marker colour in its theme states
   * it here; without one every unnamed marker is drawn in a neutral grey.
   */
  readonly markerColor?: string;
  /** The source, so a diagnostic can carry an offset as well as a line. */
  readonly source?: SourceFile;
  /**
   * Instrument facts a chart does not hold: the exchange, the lot size, and
   * the trading session.
   *
   * The session is where every per-bar session fact comes from
   * (`host-interface.md` 4.3), so a host that knows its calendar states the
   * hours here and the engine derives the rest. A chart holds an interval and a
   * timezone and no exchange calendar, so a host that states none gets a study
   * whose session never begins, which is the honest answer rather than a
   * guessed one.
   */
  readonly instrument?: Instrument;
  /**
   * Where an applied order goes, and where its frames come back from.
   *
   * Without one the engine declares no `orders` capability and refuses a
   * strategy at load with OS6006, naming it. That is deliberate: a chart that
   * quietly swallowed a strategy's orders while drawing its plots would be a
   * strategy the user believes is running.
   *
   * There is no position option beside it. A strategy's position is folded from
   * the orders it sent and the frames this route's owner reports back
   * (`stdlib.md` 17.1), never handed over by the chart.
   */
  readonly orders?: EffectRoute;
  /**
   * Run a strategy against a simulated destination where the host gives none.
   *
   * **Off by default, because the refusal it replaces is useful.** A strategy
   * with nowhere to send an order is refused at load with OS6006 naming the
   * capability, which is exactly what a host that meant to wire a destination
   * and forgot needs to be told. A chart that quietly filled one in for them
   * would draw a convincing strategy that routed nothing.
   *
   * **On, it is the venue a backtest uses.** A chart drawing a strategy then
   * fills the same orders at the same prices as the report of the same script,
   * so the marks on the price and the trades in the report are one answer
   * rather than two. This is what a host turns on to draw a strategy the way it
   * draws a study: the plots, the legend row and the settings all follow from
   * the program running at all.
   *
   * It does not place an order anywhere. A host that wants that supplies
   * `orders`, which wins over this.
   */
  readonly simulateOrders?: boolean;
  readonly limits?: Partial<EngineLimits>;
  readonly clock?: Clock;
  /**
   * A wall clock string in the chart's zone, as UTC seconds.
   *
   * A `"time"` input is stored as a wall clock string so that a saved layout
   * restores to the same reading in another zone, and turning one into an
   * instant needs the zone's calendar, which the engine does not have. A host
   * passes the chart's own conversion; without one the string is read as UTC.
   */
  readonly resolveTime?: (text: string, timezone: string) => number;
}

/** The engine one chart instance is holding, between recomputes. */
/** The store key. Namespaced, because the store belongs to the host as well. */
const HELD = 'openscript';

/** Every channel's whole column, for the bars that were run. */
export type Columns = readonly (readonly Value[])[];

/**
 * What one run produced beyond the columns.
 *
 * The grids and the drawing objects are here because neither is a column of
 * numbers: a grid is the buffer the last executed bar left behind, and an object
 * is a shape the script created and has been mutating since. They are read off
 * the engine while it is in hand rather than left for a caller to go back for,
 * because after a tail run the engine is the held one and nobody else has it.
 */
export interface RunOutput {
  readonly columns: Columns;
  readonly tables: readonly Grid[];
  readonly drawings: readonly Drawing[];
}

export function fullRun(
  program: CompiledProgram,
  bars: readonly ChartBar[],
  settings: ChartSettings,
  store: ChartStore,
  ctx: ChartCalcContext | undefined,
  options: ChartAdapterOptions,
): RunOutput {
  const station = stationIn(store);
  const started = start(program, settings, ctx, options, station.provider(bars), bars);
  const engine = started.engine;

  // **A strategy is walked bar by bar and a study is handed the lot.** The
  // difference is the venue: its frames reach the engine between bars, which is
  // the only place they can, so a strategy's position is right on the bar after
  // the one it traded on. `run()` has no gap to put them in.
  //
  // It is also the loop the backtest uses, which is the point: a chart drawing a
  // strategy and a report of the same strategy walk the same bars in the same
  // order against the same venue, so they cannot disagree about what filled.
  const held: Held = started.venue === null
    ? runWhole(engine, bars, ctx, program, settings)
    : walkWith(engine, started.venue, bars, ctx, program, settings);
  store[HELD] = held;
  station.settle();
  return outputOf(program, engine);
}

/**
 * The bars from `from` onwards, or nothing when the held engine cannot serve
 * them.
 *
 * `from` is the previously last bar, which may have been replaced rather than
 * followed, so it is re-executed rather than appended: that is step 1 of the bar
 * cycle and the reason a moving bar draws the same study however many ticks it
 * took.
 */
export function tailRun(
  program: CompiledProgram,
  bars: readonly ChartBar[],
  from: number,
  settings: ChartSettings,
  store: ChartStore,
  ctx: ChartCalcContext | undefined,
  // Held for the shape of the pair: a full recompute reads the host's options
  // and a tail run reads the engine it already built from them.
  _options: ChartAdapterOptions,
): RunOutput | null {
  const held = store[HELD] as Held | undefined;
  if (held === undefined || held.engine.failed) return null;
  if (held.count !== from + 1 || from < 0 || bars.length < held.count) return null;
  if (held.signature !== signatureOf(program, settings)) return null;
  if ((bars[0]?.time ?? 0) !== held.firstTime) return null;
  if ((bars[from]?.time ?? 0) !== held.lastTime) return null;

  for (let index = from; index < bars.length; index += 1) {
    const bar = bars[index];
    if (bar === undefined) return null;
    const state = stateFor(index, bars, ctx);

    // The venue's answers about the bar before this one, delivered before this
    // one runs, exactly as the full walk does. A tail that skipped this would
    // draw the first bars of a strategy correctly and then quietly stop folding
    // its fills the moment the chart went live, which is the half of the run
    // nobody re-checks.
    //
    // Only when the bar is new. Re-executing the bar that moved must not
    // deliver again: a frame is cumulative and folding one twice is harmless,
    // but the bar's own orders have been rolled back and answering them a
    // second time would fill an order the engine no longer knows it sent.
    if (held.venue !== null && index !== from) {
      for (const frame of held.venue.pending) held.engine.deliver(frame);
      held.venue.pending = [];
    }

    const result =
      index === from
        ? held.engine.update(hostBar(bar), state)
        : held.engine.append(hostBar(bar), state);
    if (result.diagnostic !== undefined) throw stopped(result.diagnostic);

    if (held.venue !== null) answersFor(held.venue, index);
  }

  held.count = bars.length;
  held.lastTime = bars[bars.length - 1]?.time ?? held.lastTime;
  // The provider was not asked anything this time, so the station is told where
  // the newest bar now stands rather than working it out from a question.
  const station = stationOf(store);
  station?.extend(bars);
  station?.settle();
  return outputOf(program, held.engine);
}

/**
 * A held engine is dropped when the descriptor's instance goes away.
 *
 * The station goes with it, because a fetch still in flight would otherwise ask
 * a chart that has removed this study to recompute it.
 */
export function release(store: ChartStore): void {
  delete store[HELD];
  stationOf(store)?.close();
}

function outputOf(program: CompiledProgram, engine: Engine): RunOutput {
  const columns: (readonly Value[])[] = [];
  for (let channel = 0; channel < program.channels.length; channel += 1) {
    columns.push(engine.column(channel));
  }
  // The grids and the objects are read once, here. Reading either per bar would
  // cost the length of the history to display the last state of it, which is
  // `tables.ts`'s own first paragraph.
  return { columns, tables: engine.tables(), drawings: engine.drawings() };
}

/** A loaded engine, and the destination its orders go to where it has one. */
interface Started {
  readonly engine: Engine;
  readonly venue: HeldVenue | null;
}

/**
 * Load the program, and give a strategy somewhere for its orders to go.
 *
 * **The venue is built after the load and reached through a holder, because
 * neither can come first.** The route has to be handed to `load`, since that is
 * what declares the `orders` capability and a program needing one is otherwise
 * refused. The venue has to be built after it, because the declaration it reads
 * may state its fill rule through an `input()`, and inputs are not resolved
 * until `load` has run. The route is only ever called from inside an execution,
 * which is after both, so the holder is always filled by the time anything
 * reaches it.
 *
 * **A host that supplied its own route keeps it.** Somewhere real to send an
 * order is a better destination than a simulated one, and a host that wired one
 * up meant it.
 *
 * **And simulation is asked for rather than assumed.** Without
 * `simulateOrders` a strategy with nowhere to send an order is still refused at
 * load, which is the answer a host that meant to wire a destination and forgot
 * needs to see. Filling in a venue for them would turn that mistake into a
 * chart that draws convincingly and routes nothing, discovered whenever
 * somebody next looked for the orders.
 */
function start(
  program: CompiledProgram,
  settings: ChartSettings,
  ctx: ChartCalcContext | undefined,
  options: ChartAdapterOptions,
  requests: RequestProvider,
  bars: readonly ChartBar[],
): Started {
  const holder: { current: Simulator | null } = { current: null };
  const simulate = options.simulateOrders === true && options.orders === undefined && needsVenue(program);
  const withRoute: ChartAdapterOptions = simulate
    ? { ...options, orders: routeInto(holder) }
    : options;

  // What this chart has no room for is refused before the engine is asked,
  // because a study drawn without it is a study that looks broken.
  const narrower = undrawable(program, capabilitiesOf(options.chartVersion));
  if (narrower !== undefined) throw refused(narrower);

  const loaded = load(program, {
    settings: engineSettings(program, settings),
    host: hostFor(ctx, withRoute, requests),
    time: timeFor(options, ctx?.timezone ?? ''),
    ...(options.limits === undefined ? {} : { limits: options.limits }),
    ...(options.source === undefined ? {} : { source: options.source }),
    ...(options.clock === undefined ? {} : { clock: options.clock }),
  });
  if (!loaded.ok) throw refused(loaded.diagnostic);

  if (!simulate) return { engine: loaded.engine, venue: null };

  const venue = venueFor(program, bars, loaded.inputs, instrumentFor(ctx, options));
  if (venue === null) return { engine: loaded.engine, venue: null };
  holder.current = venue;
  return { engine: loaded.engine, venue: { venue, pending: [] } };
}

/**
 * The host the engine reads, which always serves requests.
 *
 * A chart offers the transport whether or not its own host registered a
 * provider, and it refuses with its own words when none was registered. So the
 * capability is declared here rather than withheld: a study that reads another
 * instrument then draws everything that does not depend on the read and puts
 * the chart's own sentence in `req.error`, instead of being refused at load
 * with OS6006 naming a capability the chart does have.
 */
/**
 * The instrument record, from what the host stated and what the chart knows.
 *
 * Its own function because two callers need it and they must not each build
 * one: the engine is loaded with this record, and the venue prices fills
 * against the tick size in it. Two spellings of the same record is how a fill
 * gets rounded to a tick the strategy was never told about.
 */
function instrumentFor(
  ctx: ChartCalcContext | undefined,
  options: ChartAdapterOptions,
): Instrument {
  return {
    ...(options.instrument ?? {}),
    ...(ctx?.symbol === undefined ? {} : { symbol: ctx.symbol }),
    ...(ctx?.interval === undefined ? {} : { interval: ctx.interval }),
    ...(ctx?.tickSize === undefined ? {} : { tickSize: ctx.tickSize }),
    // The chart states the zone it labels its own axis in, and every calendar
    // and session call reads in it. Leaving it out left the engine reading the
    // record's zone or nothing, so a session study could be an offset away from
    // the chart it was drawn on.
    ...(ctx === undefined || ctx.timezone === '' ? {} : { timezone: ctx.timezone }),
  };
}

function hostFor(
  ctx: ChartCalcContext | undefined,
  options: ChartAdapterOptions,
  requests: RequestProvider,
): EngineHost {
  const instrument = instrumentFor(ctx, options);
  return {
    instrument,
    requestBars: requests,
    ...(ctx === undefined ? {} : { now: hostNow(ctx.now()) }),
    ...(options.orders === undefined ? {} : { route: options.orders }),
  };
}

function timeFor(options: ChartAdapterOptions, timezone: string): TimeResolver {
  const resolve = options.resolveTime;
  if (resolve === undefined) return utcTime;
  return (text: string): number | null => {
    try {
      const seconds = resolve(text, timezone);
      return Number.isFinite(seconds) ? hostNow(seconds) : null;
    } catch {
      // A host's conversion refuses an unreadable string by throwing. That is a
      // value the input's own validation has to refuse, not a failure of the
      // chart, so it becomes absence and OS6019 names the key and the value.
      return null;
    }
  };
}
