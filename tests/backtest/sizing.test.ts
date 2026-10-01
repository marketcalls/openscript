/**
 * The quantity a strategy states, and the units a fill is counted in.
 *
 * **A quantity travels in the declaration's own unit** (`host-interface.md`
 * 7.1) and the destination is the party that converts it. This one did not: it
 * filled the number the script wrote whatever unit it was written in, so a
 * strategy sizing in lots on a lot of sixty five traded one sixty fifth of what
 * it asked for, and every money figure in the record was out by that factor
 * with nothing refused and nothing said.
 *
 * That is the worst shape a defect in this repository can take. Nothing throws,
 * the report is internally consistent, somebody trades on the number, and the
 * record is handed to a second engine as a conformance case that teaches it the
 * wrong quantity.
 *
 * So the rule is two states and no third: a unit this destination can arrive at
 * is converted, and one it cannot is refused before the first bar. What is
 * never allowed is a figure in the wrong unit reported as money.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { backtest, checkSettings, declarationOf, settingsFor } from '../../src/core/backtest/index.js';
import { CONTRACT, inAndOut, rising } from './support.js';

const BARS = rising(8);
/** An instrument that trades in lots of sixty five, which is not one. */
const IN_LOTS = { ...CONTRACT, lotSize: 65 };

function refusalFor(program: ReturnType<typeof inAndOut>, contract = CONTRACT) {
  return checkSettings(settingsFor(contract), declarationOf(program));
}

test('a quantity in lots is filled as the units a lot holds', () => {
  // Two lots of sixty five is a hundred and thirty units. The record used to
  // say two, and every money figure with it was sixty five times too small.
  const program = inAndOut({ qty: 2, qtyType: 'lots' });
  const result = backtest(program, BARS, settingsFor(IN_LOTS));
  assert.ok(result.ok, 'a lot size is stated, so the run is carried out');
  const entry = result.record.fills[0];
  assert.ok(entry);
  assert.equal(entry.units, 130, 'the fill is in units, not in lots');
});

test('and the money is folded over those units', () => {
  // The same strategy stated both ways is the same trade, so the two records
  // have to agree about the money. Asserting the units alone would pass on an
  // engine that converted the fill and went on charging the lot count.
  const inUnits = backtest(inAndOut({ qty: 130 }), BARS, settingsFor(IN_LOTS));
  const inLots = backtest(inAndOut({ qty: 2, qtyType: 'lots' }), BARS, settingsFor(IN_LOTS));
  assert.ok(inUnits.ok && inLots.ok);
  assert.equal(inLots.record.report.summary.netProfit, inUnits.record.report.summary.netProfit);
  assert.equal(inLots.record.report.summary.charges, inUnits.record.report.summary.charges);
});

test('a close of a position held in lots sells the units the position holds', () => {
  // One lot long, closed by close(). The close carries a quantity the engine
  // worked out from the filled position, so it is in units whatever the
  // declaration counts in (`host-interface.md` 7.1). The venue read the
  // declaration's unit instead and multiplied again: the close of sixty five
  // units sold sixty five lots, four thousand two hundred and twenty five
  // units, and left a short of four thousand one hundred and sixty that a
  // long-only strategy never closed.
  const program = inAndOut({ qty: 1, qtyType: 'lots' });
  const result = backtest(program, BARS, settingsFor(IN_LOTS));
  assert.ok(result.ok);
  const [entry, exit] = result.record.fills;
  assert.equal(entry?.units, 65, 'one lot is sixty five units');
  assert.equal(exit?.units, 65, 'the close sells what the position holds');
  assert.equal(exit?.refSizeAfter, 0, 'and the position holds nothing after it');
  const trades = result.record.report.trades;
  assert.equal(trades.length, 1, 'one round trip, and no short opened by the close');
  assert.equal(trades[0]?.isOpen, false);
});

test('a quantity in lots on an instrument that states none is refused', () => {
  // There is nothing to convert a lot into. Filling the lot count instead is
  // the defect this whole file exists for.
  const refusal = refusalFor(inAndOut({ qty: 2, qtyType: 'lots' }), { ...CONTRACT, lotSize: null });
  assert.equal(refusal?.code, 'OS6021');
});

test('a quantity in cash is refused rather than filled as units', () => {
  // 130000 units at 101 is thirteen million of notional, reported as a profit
  // of three hundred and sixty three thousand on a hundred thousand of capital.
  const refusal = refusalFor(inAndOut({ qty: 130000, qtyType: 'cash' }));
  assert.equal(refusal?.code, 'OS6021');
});

test('a quantity in a percentage of equity is refused too', () => {
  // A backtest works out no running equity, so there is nothing to take a
  // percentage of.
  const refusal = refusalFor(inAndOut({ qty: 10, qtyType: 'equityPercent' }));
  assert.equal(refusal?.code, 'OS6021');
});

test('a refused sizing stops the run rather than reporting it', () => {
  // The refusal is worth nothing if the driver does not ask for it.
  const result = backtest(inAndOut({ qty: 100, qtyType: 'cash' }), BARS, settingsFor(CONTRACT));
  assert.equal(result.ok, false);
});

test('units are still filled as they are written', () => {
  const result = backtest(inAndOut({ qty: 2 }), BARS, settingsFor(IN_LOTS));
  assert.ok(result.ok);
  assert.equal(result.record.fills[0]?.units, 2);
});

test('a declared commission below zero is refused, not paid to the strategy', () => {
  // scheduleProblem has had the rule all along, that a charge is money taken
  // and never given. It was asked only about a schedule the host supplied, so
  // on the path almost every run takes it was never asked at all: a commission
  // of -5 was charged as -10 and turned a gross of 6 into a net of 16.
  const refusal = refusalFor(inAndOut({ commission: -5 }));
  assert.equal(refusal?.code, 'OS6021');
});

test('a declared commission the money layer accepts is still carried out', () => {
  // The opposite mistake: a check that refuses the ordinary case as well.
  assert.equal(refusalFor(inAndOut({ commission: 20 })), null);
  assert.equal(refusalFor(inAndOut()), null);
});

test('a declared slippage below zero is refused, not paid to the strategy', () => {
  // It used to improve both sides of every fill: the buy filled below the close
  // and the sell above it, which is a backtest paying a strategy to trade. The
  // money layer has always refused a negative rate and was never asked.
  assert.equal(refusalFor(inAndOut({ slippage: -1 }))?.code, 'OS6021');
  assert.equal(backtest(inAndOut({ slippage: -1 }), BARS, settingsFor(CONTRACT)).ok, false);
});

test('a declared slippage costs the strategy rather than paying it', () => {
  const some = backtest(inAndOut({ slippage: 1 }), BARS, settingsFor(CONTRACT));
  const none = backtest(inAndOut({ slippage: 0 }), BARS, settingsFor(CONTRACT));
  assert.ok(some.ok && none.ok);
  assert.ok(
    some.record.report.summary.netProfit < none.record.report.summary.netProfit,
    'a tick of slippage is a tick worse on the way in and on the way out',
  );
});
