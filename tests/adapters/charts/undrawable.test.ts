/**
 * What this chart cannot draw is refused before a bar runs, with OS6024.
 *
 * Issue 0011: a second declared grid and a band colour computed per bar were
 * both dropped with nothing said, because the chart had one grid hook and one
 * colour per band, and the catalogue had no code for a host that cannot draw
 * something a program declares. A chart from 2.5.4 on has a hook for each, so
 * the refusal now depends on the chart the host states, and the tests below
 * catch it going wrong in both directions: the silent drop coming back on a
 * chart that cannot draw either, and the refusal staying on a chart that can.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import type { ChartAdapterOptions } from '../../../src/adapters/charts/index.js';
import { bars, context, descriptorOfSource, refusalOf } from './support.js';

const TWO_GRIDS = `version 1
study("Two grids", overlay = true)
first = table("Summary", 1, 1)
second = table("Detail", 1, 1)
cell(first, 0, 0, "a")
cell(second, 0, 0, "b")
plot(close, "C")
`;

const BAND = `version 1
study("Band", overlay = true)
a = plot(high, "H")
b = plot(low, "L")
fill(a, b, colorUp = close > open ? lime : red)
`;

/** Versions whose chart has neither hook, or that cannot be read as a version. */
const WITHOUT = ['2.4.0', '2.5.1', '2.5.3', '2.5.4-rc.1', '2.5', 'v2.5.4', 'latest', ''];

/** Versions whose chart has both. */
const WITH = ['2.5.4', '2.5.10', '2.6.0', '3.0.0', '2.5.4+build.7'];

function run(text: string, options: ChartAdapterOptions = {}): void {
  descriptorOfSource(text, options).calc(bars(10), {}, {}, context(10));
}

function refusalFor(text: string, options: ChartAdapterOptions = {}): { code: string; line: number; name: string } {
  return refusalOf(() => {
    run(text, options);
  });
}

test('a second grid is refused at load when the host states no chart version', () => {
  const refusal = refusalFor(TWO_GRIDS);
  assert.equal(refusal.code, 'OS6024');
  assert.equal(refusal.name, 'IndicatorInputError');
});

test('a band whose colour is computed per bar is refused at load when the host states no chart version', () => {
  const refusal = refusalFor(BAND);
  assert.equal(refusal.code, 'OS6024');
  assert.equal(refusal.name, 'IndicatorInputError');
});

test('both are refused on a chart older than 2.5.4, and on a version that cannot be read', () => {
  for (const chartVersion of WITHOUT) {
    assert.equal(refusalFor(TWO_GRIDS, { chartVersion }).code, 'OS6024', `grids on ${JSON.stringify(chartVersion)}`);
    assert.equal(refusalFor(BAND, { chartVersion }).code, 'OS6024', `band on ${JSON.stringify(chartVersion)}`);
  }
});

test('both run on a chart from 2.5.4 on', () => {
  for (const chartVersion of WITH) {
    assert.doesNotThrow(() => {
      run(TWO_GRIDS, { chartVersion });
    }, `grids on ${chartVersion}`);
    assert.doesNotThrow(() => {
      run(BAND, { chartVersion });
    }, `band on ${chartVersion}`);
  }
});

test('one grid and a band of one colour run on any chart, and nothing is refused', () => {
  const text = `version 1
study("Fits", overlay = true)
a = plot(high, "H")
b = plot(low, "L")
fill(a, b, colorUp = lime)
panel = table("Summary", 1, 1)
cell(panel, 0, 0, "a")
`;
  for (const chartVersion of [undefined, ...WITHOUT, ...WITH]) {
    assert.doesNotThrow(() => {
      run(text, chartVersion === undefined ? {} : { chartVersion });
    }, `on ${String(chartVersion)}`);
  }
});
