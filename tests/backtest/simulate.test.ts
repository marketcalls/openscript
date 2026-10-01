/**
 * The venue: what it fills, when it says so, and what it refuses to invent.
 *
 * **A destination is a host and is held to a host's rules.** Every frame is
 * cumulative from the beginning of its order, every frame carries the venue's
 * own reference, and nothing is handed over during an execution. The wrong
 * implementations this file is written against are the ones that would pass a
 * whole suite of report tests: a market order priced at the bar it was decided
 * on when the declaration says the next open, a resting order tested against
 * the bar that placed it, slippage added on both sides of the trade, and a
 * bracket answered with a fill against an intent no ledger row holds.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_FILL, Simulator } from '../../src/core/backtest/index.js';
import type { SimulatorOptions } from '../../src/core/backtest/index.js';
import type { OrderFrame, OrderIntent, RoutedEffect } from '../../src/core/engine/index.js';
import { CONTRACT, rising } from './support.js';

const BARS = rising(6);

/** One intent, as the engine hands one over. */
function intentOf(one: Partial<OrderIntent> & { readonly intentId: number }): OrderIntent {
  return {
    kind: 'place',
    instrument: { symbol: 'AAA', exchange: 'XX' },
    side: 'buy',
    qty: 1,
    qtyType: 'units',
    type: 'market',
    limit: null,
    trigger: null,
    target: null,
    stop: null,
    profit: null,
    loss: null,
    tag: '',
    product: 'intraday',
    positionRef: 1,
    bar: { index: 0, time: null },
    ...one,
  };
}

/** One applied effect carrying the intents it became. */
function effectOf(intents: readonly OrderIntent[]): RoutedEffect {
  return {
    fn: 0,
    name: 'buy',
    effect: 'order',
    args: [],
    params: [],
    at: { offset: 0, length: 0, line: 1, column: 1 },
    intents,
  };
}

function venueOn(chosen: Partial<SimulatorOptions> = {}): Simulator {
  return new Simulator({
    bars: BARS,
    contract: CONTRACT,
    fill: DEFAULT_FILL,
    slippageTicks: 0,
    fillOn: 'close',
    ...chosen,
  });
}

/** The frames that reported a fill, which is what a fold settles. */
function fills(frames: readonly OrderFrame[]): readonly OrderFrame[] {
  return frames.filter((frame) => frame.filledQty > 0);
}

/**
 * A market order is priced where the declaration says it is priced.
 *
 * Catches an implementation that reads one of the two spellings and ignores the
 * other, which is a whole run of fills at a price the strategy could not have
 * been given. Bar two closes at 102 and bar three opens at 102.5, so the two
 * answers cannot be confused with each other.
 */
test('a market order fills where the declaration prices it', () => {
  const atClose = venueOn({ fillOn: 'close' });
  atClose.route(effectOf([intentOf({ intentId: 1 })]), 2);
  const closed = fills(atClose.framesFor(2));
  assert.equal(closed.length, 1);
  assert.equal(closed[0]?.avgFillPrice, BARS[2]?.close);

  const atOpen = venueOn({ fillOn: 'nextOpen' });
  atOpen.route(effectOf([intentOf({ intentId: 1 })]), 2);
  const opened = fills(atOpen.framesFor(2));
  assert.equal(opened.length, 1);
  assert.equal(opened[0]?.avgFillPrice, BARS[3]?.open);
});

/**
 * A market order priced at the next open on the last bar never fills.
 *
 * Catches an implementation that falls back to the last close, which reports a
 * position taken at a price that had not happened, and one that reads past the
 * end of the bars, where absence reads as zero and the strategy ends the run
 * having bought at nothing.
 */
test('a market order priced at the next open has no next open on the last bar', () => {
  const venue = venueOn({ fillOn: 'nextOpen' });
  const last = BARS.length - 1;
  venue.route(effectOf([intentOf({ intentId: 1 })]), last);
  const frames = venue.framesFor(last);
  assert.equal(fills(frames).length, 0);
  assert.equal(frames.length, 1);
  assert.equal(frames[0]?.status, 'working');
  assert.equal(venue.working, 1);
});

/**
 * Slippage is adverse on both sides of the trade.
 *
 * Catches the implementation that adds the slippage whatever the side, which
 * pays the strategy to sell, and the one that applies it to nothing at all,
 * which is a cost model that quietly charges zero.
 */
test('slippage worsens a buy and worsens a sell', () => {
  const venue = venueOn({ slippageTicks: 2 });
  venue.route(
    effectOf([
      intentOf({ intentId: 1, side: 'buy' }),
      intentOf({ intentId: 2, side: 'sell', positionRef: 2 }),
    ]),
    2,
  );
  const settled = fills(venue.framesFor(2));
  const close = BARS[2]?.close ?? 0;
  const tick = CONTRACT.tickSize ?? 0;
  assert.equal(settled[0]?.avgFillPrice, close + 2 * tick);
  assert.equal(settled[1]?.avgFillPrice, close - 2 * tick);
});

/**
 * A resting order is not decided against the bar that sent it.
 *
 * The order was decided at that bar's close, so the bar has already happened.
 * Catches the implementation that tests every resting order against the bar it
 * arrived on, which fills a limit out of the range of a bar the strategy had
 * already seen: the single most flattering defect available to a backtest.
 */
test('a resting order waits for the bar after the one that sent it', () => {
  const venue = venueOn();
  // Bar two trades between 101 and 103 and bar three between 102 and 104, so a
  // limit at 102.2 is inside both: an implementation that decided it against
  // the bar that sent it would fill it here, at bar two's open.
  venue.route(effectOf([intentOf({ intentId: 1, type: 'limit', limit: 102.2 })]), 2);
  assert.equal(fills(venue.framesFor(2)).length, 0);

  const later = fills(venue.framesFor(3));
  assert.equal(later.length, 1);
  assert.equal(later[0]?.avgFillPrice, 102.2);
});

/**
 * A cancellation is answered, and so is every order it withdrew.
 *
 * Catches an implementation that answers the cancellation alone: the order it
 * named stays working for the life of the run, goes on claiming the position it
 * was reducing, and the strategy cannot close again. The cancellation itself has
 * a row too, and a row nothing ever answers stays at `placed` for ever.
 */
test('a cancellation withdraws the order its tag names and both are answered', () => {
  const venue = venueOn();
  venue.route(effectOf([intentOf({ intentId: 1, type: 'limit', limit: 90, tag: 'rest' })]), 1);
  venue.framesFor(1);
  assert.equal(venue.working, 1);

  venue.route(effectOf([intentOf({ intentId: 2, kind: 'cancel', tag: 'rest', qty: null })]), 2);
  const frames = venue.framesFor(2);
  assert.equal(venue.working, 0);
  assert.deepEqual(
    frames.map((frame) => [frame.intentId, frame.status]),
    [
      [1, 'cancelled'],
      [2, 'cancelled'],
    ],
  );
});

/**
 * A bracket is answered with nothing at all.
 *
 * The engine appends no row for one, so a fill reported against it names an
 * intent no row holds and the fold refuses it. Catches an implementation that
 * answers a bracket like an order, which produces a refused frame on every
 * protected entry and a ledger that disagrees with the venue for the rest of
 * the run. This is the assertion that has to change the day a bracket appends a
 * row of its own, decision 55.
 */
test('a bracket is taken and answered with no frame', () => {
  const venue = venueOn();
  venue.route(
    effectOf([intentOf({ intentId: 1, kind: 'bracket', qty: null, type: null, stop: 95 })]),
    1,
  );
  assert.deepEqual(venue.framesFor(1), []);
  assert.equal(venue.brackets.length, 1);
  assert.equal(venue.working, 0);
});

/**
 * Every frame carries the venue's own reference and its own place in the queue.
 *
 * Catches an implementation that answers without a reference, which leaves the
 * ledger with nothing to show a host reconciling afterwards, and one that
 * reuses a reference across orders, where two orders become one in every record
 * of the run.
 */
test('each order is answered under a reference of its own', () => {
  const venue = venueOn();
  venue.route(
    effectOf([intentOf({ intentId: 1 }), intentOf({ intentId: 2, positionRef: 2 })]),
    1,
  );
  const frames = venue.framesFor(1);
  const refs = new Set(frames.map((frame) => frame.orderRef));
  assert.equal(refs.size, 2);
  assert.deepEqual(
    frames.map((frame) => frame.seq),
    [1, 2, 3, 4],
  );
  for (const frame of frames) assert.equal(frame.time, BARS[1]?.time);
});
