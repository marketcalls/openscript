/**
 * Every declared grid reaches a chart that has the list of grids.
 *
 * A chart from 2.5.4 on reads `tables`, a list of grids each under an id it
 * keeps the grid by, in place of the single `table` hook. The ways this goes
 * wrong without anything failing are the ones tested: a grid missing from the
 * list, two grids' cells swapped, an id that changes between recomputes so the
 * chart tears a grid down and builds it again, an empty or repeated id, which
 * the chart refuses, and the single hook losing the first grid a chart without
 * the list still draws. The refusal where the chart has no list is in
 * `undrawable.test.ts`.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  ChartDescriptor,
  ChartSettings,
  ChartSurfaceContext,
  ChartTableSpec,
} from '../../../src/adapters/charts/index.js';
import { bars, context, descriptorOfSource } from './support.js';

/** The first chart version with the list of grids. */
const DRAWS_GRIDS = '2.5.4';

const COUNT = 12;

const TWO = `version 1
study("Two grids", overlay = true)
summary = table("Summary", 1, 2, position = "topLeft")
detail = table("Detail", 2, 1, position = "bottomRight", borderWidth = 2)
cell(summary, 0, 0, "close")
cell(summary, 0, 1, text(close, 2))
cell(detail, 0, 0, "first")
cell(detail, 1, 0, "second")
plot(close, "C")
`;

const THREE = `version 1
study("Three grids", overlay = true)
one = table("One", 1, 1, position = "topLeft")
two = table("Two", 1, 1, position = "topRight")
three = table("Three", 3, 1, position = "bottomLeft")
cell(one, 0, 0, "one")
cell(two, 0, 0, "two")
cell(three, 2, 0, "three")
plot(close, "C")
`;

/** A run, and the context every surface hook is handed after it. */
function ran(descriptor: ChartDescriptor): ChartSurfaceContext {
  const series = bars(COUNT);
  const settings: ChartSettings = {};
  const values = descriptor.calc(series, settings, {}, context(COUNT));
  return { bars: series, values, settings };
}

function listed(descriptor: ChartDescriptor, surface: ChartSurfaceContext): readonly ChartTableSpec[] {
  assert.equal(typeof descriptor.tables, 'function', 'the list of grids is offered');
  return descriptor.tables?.(surface) ?? [];
}

test('two grids are both drawn, each with its own cells and corner', () => {
  const descriptor = descriptorOfSource(TWO, { chartVersion: DRAWS_GRIDS });
  const grids = listed(descriptor, ran(descriptor));
  assert.equal(grids.length, 2);
  const [summary, detail] = grids;
  assert.equal(summary?.rows.length, 1);
  assert.equal(summary?.rows[0]?.length, 2);
  assert.equal(summary?.rows[0]?.[0]?.text, 'close');
  assert.equal(summary?.options?.position, 'top-left');
  assert.equal(detail?.rows.length, 2);
  assert.equal(detail?.rows[0]?.[0]?.text, 'first');
  assert.equal(detail?.rows[1]?.[0]?.text, 'second');
  assert.equal(detail?.options?.position, 'bottom-right');
  assert.equal(detail?.options?.borderWidth, 2);
});

test('three grids, in the order they are declared', () => {
  const descriptor = descriptorOfSource(THREE, { chartVersion: DRAWS_GRIDS });
  const grids = listed(descriptor, ran(descriptor));
  assert.deepEqual(
    grids.map((one) => one.rows.flat().map((cell) => cell.text).join('|')),
    ['one', 'two', '||three'],
  );
  assert.deepEqual(
    grids.map((one) => one.options?.position),
    ['top-left', 'top-right', 'bottom-left'],
  );
});

test('each grid carries an id that is its own, not empty, and the same on every recompute', () => {
  // The chart reuses a grid whose id it has seen and removes one it has not, so
  // an id that moved between recomputes would rebuild every grid on every tick,
  // and an empty or repeated one is refused by the chart outright.
  const descriptor = descriptorOfSource(THREE, { chartVersion: DRAWS_GRIDS });
  const first = listed(descriptor, ran(descriptor)).map((one) => one.id);
  const second = listed(descriptor, ran(descriptor)).map((one) => one.id);
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, 3);
  for (const id of first) assert.ok(id.trim().length > 0, `id ${JSON.stringify(id)}`);
});

test('the single table hook still carries the first grid, for a chart without the list', () => {
  const descriptor = descriptorOfSource(TWO, { chartVersion: DRAWS_GRIDS });
  const surface = ran(descriptor);
  const single = descriptor.table?.(surface);
  const first = listed(descriptor, surface)[0];
  assert.ok(single !== null && single !== undefined);
  assert.deepEqual(single.rows, first?.rows);
  assert.deepEqual(single.options, first?.options);
});

test('a grid in the list is the grid the single hook gives for one grid', () => {
  const descriptor = descriptorOfSource(
    `version 1
study("One grid", overlay = true)
panel = table("Panel", 1, 1, position = "topLeft")
cell(panel, 0, 0, text(close, 2))
plot(close, "C")
`,
    { chartVersion: DRAWS_GRIDS },
  );
  const surface = ran(descriptor);
  const grids = listed(descriptor, surface);
  assert.equal(grids.length, 1);
  assert.deepEqual(grids[0]?.rows, descriptor.table?.(surface)?.rows);
});

test('with no chart version stated, one grid is offered through the single hook alone', () => {
  const descriptor = descriptorOfSource(`version 1
study("One grid", overlay = true)
panel = table("Panel", 1, 1)
cell(panel, 0, 0, "a")
plot(close, "C")
`);
  const surface = ran(descriptor);
  assert.equal(descriptor.tables, undefined);
  assert.equal(descriptor.table?.(surface)?.rows[0]?.[0]?.text, 'a');
});

test('a study that declares no grid offers neither hook, whatever the chart', () => {
  const descriptor = descriptorOfSource('version 1\nstudy("None")\nplot(close, "C")\n', {
    chartVersion: DRAWS_GRIDS,
  });
  assert.equal(descriptor.tables, undefined);
  assert.equal(descriptor.table, undefined);
});
