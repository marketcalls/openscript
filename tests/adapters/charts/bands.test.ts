/**
 * A band whose colour the script computes per bar, drawn bar by bar.
 *
 * A chart from 2.5.4 on gives a band a per-bar colour callback, and the adapter
 * answers it with the colour the script computed on that bar for the side the
 * band is on. Every test here is written against a way that answer can be wrong
 * while the chart still draws a plausible band: the up colour on a bar where the
 * second plot leads, the colour of the bar before a crossing carried past it, an
 * absent colour painted in the band's default instead of left unpainted, a side
 * the script did not compute overwritten, the band's own opacity lost, and the
 * twelve percent fade that belongs to a band with no colour applied to a band
 * whose colour is computed.
 *
 * The bars cross several times (`support.ts`), and each test asserts that it saw
 * both sides and a crossing, so none of them can pass by looking at one side.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  ChartDescriptor,
  ChartFill,
  ChartSettings,
  ChartValues,
} from '../../../src/adapters/charts/index.js';
import { bars, context, descriptorOfSource } from './support.js';

/** The first chart version whose band takes a colour per bar. */
const DRAWS_BAND_COLOURS = '2.5.4';

const COUNT = 80;

/** A study with two crossing averages and the band between them. */
function banded(fill: string): string {
  return `version 1
study("Band", overlay = true)
a = plot(ema(close, 3), "Fast")
b = plot(ema(close, 8), "Slow")
${fill}
`;
}

interface Drawn {
  readonly descriptor: ChartDescriptor;
  readonly band: ChartFill;
  readonly values: ChartValues;
  readonly settings: ChartSettings;
}

function drawn(fill: string, version: string | undefined = DRAWS_BAND_COLOURS): Drawn {
  const descriptor = descriptorOfSource(
    banded(fill),
    version === undefined ? {} : { chartVersion: version },
  );
  const settings: ChartSettings = {};
  const values = descriptor.calc(bars(COUNT), settings, {}, context(COUNT));
  const band = descriptor.fills?.[0];
  assert.ok(band !== undefined, 'the band is declared');
  return { descriptor, band, values, settings };
}

/** One bar the band is drawn on, with which side leads there. */
interface Painted {
  readonly index: number;
  readonly up: boolean;
  readonly colour: string | undefined;
}

/** The colour the band answers on every bar both of its columns have a value. */
function painted(one: Drawn): readonly Painted[] {
  const [first, second] = one.band.between;
  const a = one.values[first] ?? [];
  const b = one.values[second] ?? [];
  const colorBy = one.band.colorBy;
  assert.equal(typeof colorBy, 'function', 'a band coloured per bar has a colour callback');
  const out: Painted[] = [];
  for (let index = 0; index < COUNT; index += 1) {
    const x = a[index] ?? null;
    const y = b[index] ?? null;
    if (x === null || y === null) continue;
    const colour = colorBy?.call(one.band, {
      index,
      a: x,
      b: y,
      values: one.values,
      settings: one.settings,
    });
    out.push({ index, up: x >= y, colour });
  }
  return out;
}

/** The bars sampled have both sides on them and at least one crossing. */
function assertCrosses(rows: readonly Painted[]): void {
  assert.ok(rows.some((one) => one.up), 'a bar where the first plot leads');
  assert.ok(rows.some((one) => !one.up), 'a bar where the second plot leads');
  const crossings = rows.filter((one, at) => at > 0 && rows[at - 1]?.up !== one.up);
  assert.ok(crossings.length >= 2, `crossings in both directions, found ${crossings.length}`);
}

const UP = 'rgba(0, 0, 255, 1)';
const DOWN = 'rgba(255, 0, 0, 1)';

test('each bar is painted in the colour computed for the side the band is on', () => {
  // Both sides computed per bar and always present, in two colours no other
  // rule would pick, so the side is the only thing that decides the answer.
  const one = drawn('fill(a, b, colorUp = close > 0 ? #0000ff : none, colorDown = close > 0 ? #ff0000 : none)');
  const rows = painted(one);
  assertCrosses(rows);
  for (const row of rows) {
    assert.equal(row.colour, row.up ? UP : DOWN, `bar ${row.index}, ${row.up ? 'up' : 'down'}`);
  }
});

test('the colour follows what the bar computed, on both sides', () => {
  // Each side's colour moves with the bar's own direction, so reading the
  // other side's channel or another bar's value gives a different answer on
  // some bar of the eighty.
  const one = drawn(
    'fill(a, b, colorUp = close > open ? #00ff00 : #008000, colorDown = close > open ? #ff8000 : #800000)',
  );
  const series = bars(COUNT);
  const rows = painted(one);
  assertCrosses(rows);
  const seen = new Set<string>();
  for (const row of rows) {
    const bar = series[row.index];
    assert.ok(bar !== undefined);
    const rising = bar.close > bar.open;
    const wanted = row.up
      ? rising ? 'rgba(0, 255, 0, 1)' : 'rgba(0, 128, 0, 1)'
      : rising ? 'rgba(255, 128, 0, 1)' : 'rgba(128, 0, 0, 1)';
    assert.equal(row.colour, wanted, `bar ${row.index}`);
    seen.add(wanted);
  }
  assert.equal(seen.size, 4, 'every colour the script can compute was drawn somewhere');
});

test('at a crossing the colour is the new side\'s, not the bar before it', () => {
  const one = drawn('fill(a, b, colorUp = close > 0 ? #0000ff : none, colorDown = close > 0 ? #ff0000 : none)');
  const rows = painted(one);
  let crossings = 0;
  for (let at = 1; at < rows.length; at += 1) {
    const before = rows[at - 1];
    const after = rows[at];
    if (before === undefined || after === undefined || before.up === after.up) continue;
    crossings += 1;
    assert.equal(before.colour, before.up ? UP : DOWN, `the bar before the crossing at ${after.index}`);
    assert.equal(after.colour, after.up ? UP : DOWN, `the bar of the crossing at ${after.index}`);
    assert.notEqual(before.colour, after.colour);
  }
  assert.ok(crossings >= 2, `crossings found: ${crossings}`);
});

test('where the two columns are equal the band is on the up side, as the chart draws it', () => {
  // The chart puts a bar whose columns are equal in the run where the first
  // plot leads, so that is the side whose colour the bar has to answer with,
  // or the colour and the run it is drawn in disagree on every tie.
  const descriptor = descriptorOfSource(
    `version 1
study("Ties", overlay = true)
a = plot(close, "A")
b = plot(close, "B")
fill(a, b, colorUp = close > 0 ? #0000ff : none, colorDown = close > 0 ? #ff0000 : none)
`,
    { chartVersion: DRAWS_BAND_COLOURS },
  );
  const settings: ChartSettings = {};
  const values = descriptor.calc(bars(COUNT), settings, {}, context(COUNT));
  const band = descriptor.fills?.[0];
  const [first, second] = band?.between ?? ['', ''];
  for (let index = 0; index < COUNT; index += 1) {
    const a = values[first]?.[index] ?? null;
    const b = values[second]?.[index] ?? null;
    assert.equal(a, b, `bar ${index} is a tie`);
    assert.equal(band?.colorBy?.({ index, a, b, values, settings }), UP, `bar ${index}`);
  }
});

test('an absent colour leaves the bar unpainted rather than in a default', () => {
  // `docs/visuals/fills.md`: a band switched off by an absent colour is not
  // painted on those bars while both of its lines carry on. Answering nothing
  // here would hand the bar to the chart's own colour for the side, which is a
  // colour the script did not choose.
  const one = drawn('fill(a, b, color = close > open ? #00ff00 : none)');
  const series = bars(COUNT);
  const rows = painted(one);
  assertCrosses(rows);
  let unpainted = 0;
  for (const row of rows) {
    const rising = (series[row.index]?.close ?? 0) > (series[row.index]?.open ?? 0);
    if (rising) {
      assert.equal(row.colour, 'rgba(0, 255, 0, 1)', `bar ${row.index}`);
      continue;
    }
    unpainted += 1;
    assert.ok(row.colour !== undefined, `bar ${row.index} answers rather than deferring to a default`);
    assert.match(row.colour, /^rgba\(\d+, \d+, \d+, 0\)$/, `bar ${row.index} is fully transparent`);
  }
  assert.ok(unpainted > 0, 'a bar whose colour was absent');
});

test('a side the script did not compute keeps the colour it declared', () => {
  const one = drawn('fill(a, b, colorUp = close > open ? #00ff00 : #008000, colorDown = #ff0000)');
  const rows = painted(one);
  assertCrosses(rows);
  for (const row of rows) {
    if (row.up) assert.match(row.colour ?? '', /^rgba\(0, (255|128), 0, 1\)$/, `bar ${row.index}`);
    else assert.equal(row.colour, undefined, `bar ${row.index} leaves the declared colour to the chart`);
  }
  assert.equal(one.band.colorDown, DOWN, 'the declared side is on the band itself');
});

test('opacity dims a computed colour as it dims a constant one, and the no-colour fade stays away', () => {
  const one = drawn('fill(a, b, color = close > open ? fade(#00ff00, 50) : #ff0000, opacity = 0.4)');
  // A band with no colour of its own is faded to twelve percent and follows the
  // first plot; a band whose colour is computed has one, so neither applies.
  assert.equal(one.band.opacity, 0.4);
  assert.equal(one.band.colorUpKey, undefined);
  assert.equal(one.band.colorDownKey, undefined);
  const colours = new Set(painted(one).map((row) => row.colour));
  // The colour keeps the alpha the script gave it, and the dimmer is applied
  // once, by the chart, from the band's own opacity.
  assert.ok(colours.has('rgba(0, 255, 0, 0.5)'), [...colours].join(', '));
  assert.ok(colours.has(DOWN));
});

test('a tail recompute returns the colour columns a full one does', () => {
  // The chart splices a tail onto what it holds and drops a key the tail
  // leaves out, so a colour column missing from the tail would leave every
  // live bar reading no colour.
  const descriptor = descriptorOfSource(
    banded('fill(a, b, colorUp = close > open ? #00ff00 : #008000, colorDown = close > open ? #ff8000 : #800000)'),
    { chartVersion: DRAWS_BAND_COLOURS },
  );
  const settings: ChartSettings = {};
  const store = {};
  const history = bars(COUNT);
  const full = descriptor.calc(history.slice(0, COUNT - 1), settings, store, context(COUNT - 1));
  const tail = descriptor.calcTail?.(history, settings, COUNT - 2, full, store, context(COUNT));
  assert.ok(tail !== null && tail !== undefined, 'the tail was served');
  assert.deepEqual(Object.keys(tail).sort(), Object.keys(full).sort());
  assert.ok(Object.keys(full).length > 2, 'colour columns beside the two plots');
});

test('a band of constant colours has no colour callback on any chart', () => {
  const one = drawn('fill(a, b, colorUp = #00ff00, colorDown = #ff0000)');
  assert.equal(one.band.colorBy, undefined);
  assert.equal(one.band.colorUp, 'rgba(0, 255, 0, 1)');
});

test('with no chart version stated, a band coloured per bar has no callback', () => {
  const descriptor = descriptorOfSource(banded('fill(a, b, color = close > open ? #00ff00 : none)'));
  assert.equal(descriptor.fills?.[0]?.colorBy, undefined);
});
