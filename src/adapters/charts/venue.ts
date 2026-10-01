/**
 * The destination a strategy runs against when a chart draws one.
 *
 * **Why a chart needs one at all.** A strategy asks a destination to do things
 * and folds its position from what comes back. Handed no destination it is
 * refused at load with OS6006, and handed one that answers nothing it runs but
 * never learns it is in a position: every `close()` closes nothing, every entry
 * is allowed again on the next signal, and the study draws a strategy that is
 * wrong about itself while looking entirely normal. Measured on a stop and
 * reverse script, that shape produced five buys and no sells.
 *
 * **It is the backtest's own venue, not a second one.** `Simulator` is what
 * `backtest()` runs against, so a chart running a strategy through it fills the
 * same orders at the same prices as the report the trader ran a moment ago. A
 * venue written here to be simpler would be a second answer to "what would this
 * have filled at", and the two would disagree the first time either changed:
 * the chart would draw one set of trades and the report would list another.
 *
 * **What a chart supplies and what it invents.** The bars, the instrument and
 * the declaration are the chart's own and are passed through. Money is not: a
 * chart draws a strategy, it does not report one, so the currency, the point
 * value and the rounding are stated here as the neutral values that make the
 * accounting a no-op. Nothing a chart draws reads them, and a chart that
 * guessed a point value would put a wrong profit in front of somebody.
 *
 * **Nothing here decides when a fill happens.** The declaration does, through
 * `fillOn`, and the venue reads it. A market order priced at the next bar's
 * open is known at that open; one that rested and traded inside a bar is known
 * once the bar is complete. Both are what a venue could have told anybody at
 * the time, and that is the whole reason the frames arrive between bars rather
 * than inside the execution that sent them.
 */

import { DEFAULT_FILL, Simulator, declarationOf } from '../../core/backtest/index.js';
import type { RecordedBar } from '../../core/backtest/index.js';
import type { CompiledProgram } from '../../core/emit/index.js';
import type { Instrument, OrderFrame, ResolvedInput, RoutedEffect } from '../../core/engine/index.js';
import type { ChartBar } from './contract.js';

/**
 * Whether this program needs a destination before it can run at all.
 *
 * Read from the program's own declared capabilities rather than from whether
 * its source said `strategy()`, because `requires` is the same fact the engine
 * tests at load. A strategy that places no orders needs none, and anything that
 * does need one is refused without it.
 */
export function needsVenue(program: CompiledProgram): boolean {
  return program.requires.includes('orders');
}

/** One chart bar as the venue reads it. */
function recorded(bar: ChartBar): RecordedBar {
  return {
    time: bar.time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume ?? null,
    oi: bar.oi ?? null,
  };
}

/**
 * The venue for one chart run, or nothing where the program does not need one.
 *
 * `inputs` are the ones the engine resolved at load, because a declaration
 * field may be written as an `input()`: a script whose `fillOn` comes from a
 * setting would otherwise be filled the way its source happened to be written
 * rather than the way the trader is running it.
 */
export function venueFor(
  program: CompiledProgram,
  bars: readonly ChartBar[],
  inputs: readonly ResolvedInput[],
  instrument: Instrument | undefined,
): Simulator | null {
  if (!needsVenue(program)) return null;

  const declared = declarationOf(program, inputs);

  return new Simulator({
    bars: bars.map(recorded),
    contract: {
      symbol: instrument?.symbol ?? null,
      exchange: instrument?.exchange ?? null,
      // Neutral money. A chart draws a strategy and does not report one, so
      // nothing it puts on screen reads these; stating a point value a host
      // never gave would be inventing the size of somebody's position.
      currency: declared.currency,
      tickSize: instrument?.tickSize ?? null,
      lotSize: null,
      pointValue: 1,
      digits: 2,
    },
    fill: DEFAULT_FILL,
    // The declaration's own, so slippage is applied the way the backtest
    // applies it. Ticks, against the instrument's tick size.
    slippageTicks: declared.slippage,
    fillOn: declared.fillOn,
  });
}

/**
 * A venue that can be asked for frames, held across a chart's recomputes.
 *
 * The bars a `Simulator` prices against are the ones it was built with, so a
 * chart that has grown a bar needs a venue that knows about it. `extend` is how
 * the tail path says so without rebuilding the orders it is already holding.
 */
export interface HeldVenue {
  readonly venue: Simulator;
  /** Frames the venue answered for a bar, waiting to be delivered before the next. */
  pending: readonly OrderFrame[];
}

/** What a venue has to say after one bar, which the next bar's engine reads. */
export function answersFor(held: HeldVenue, barIndex: number): void {
  held.pending = held.venue.framesFor(barIndex);
}

/** The route an engine is loaded with, pointing at a venue built after it. */
export function routeInto(holder: { current: Simulator | null }): (effect: RoutedEffect, bar: number) => void {
  // Late bound on purpose. The route is handed to `load`, and the venue cannot
  // be built until `load` has resolved the inputs the declaration reads. The
  // route is only ever called from inside an execution, which is after both.
  return (effect: RoutedEffect, bar: number) => {
    holder.current?.route(effect, bar);
  };
}
