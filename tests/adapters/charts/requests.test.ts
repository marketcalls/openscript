/**
 * Higher timeframe and other instrument reads reaching a chart.
 *
 * The engine asks the host about every read once, synchronously, before bar 0.
 * A chart answers with a promise. Everything below is about that gap, and each
 * case is a way of closing it wrongly that still draws something:
 *
 * - A study refused at load because the fetch had not happened yet is a study a
 *   chart never adds. The lifecycle that has the transport runs after the first
 *   calculation, so the first calculation has to be able to say "not yet".
 * - A read of the chart's own instrument at a coarser interval needs no host at
 *   all, and a study that waited for one would wait for ever.
 * - A refusal turned into an empty answer looks exactly like an instrument that
 *   did not trade.
 * - A range recomputed per bar is a fetch per bar, which is invisible on a test
 *   that loads a chart once and expensive on a chart that ticks.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  ChartAttachContext,
  ChartBar,
  ChartBarsRequest,
  ChartCalcContext,
  ChartDataStatus,
  ChartDescriptor,
  ChartSettings,
  ChartStore,
  ChartValues,
} from '../../../src/adapters/charts/index.js';
import { BASE_TIME, descriptorOfSource } from './support.js';

/** A study that reads another instrument's close on the hour. */
const OTHER = `version 1

study("Other", overlay = true)

elsewhere = req.symbol("OTHER", "1h", close)

plot(elsewhere, "Elsewhere")
if bar.isLast
    signal(req.error(elsewhere))
`;

const MINUTE = 60;
const HOUR = 3600;

/** Five minute bars, two hours of them, from an hour boundary. */
function bars(count: number): readonly ChartBar[] {
  const out: ChartBar[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push({ open: 100, high: 101, low: 99, close: 100 + i, time: BASE_TIME + i * 5 * MINUTE });
  }
  return out;
}

/** The other instrument's hourly bars, at prices no chart bar could produce. */
function hourly(count: number): readonly ChartBar[] {
  const out: ChartBar[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push({ open: 500, high: 510, low: 490, close: 500 + i, time: BASE_TIME + i * HOUR });
  }
  return out;
}

function contextOf(count: number): ChartCalcContext {
  return {
    barState: { isNew: true, isConfirmed: true, isRealtime: false, lastIndex: count - 1 },
    interval: '5m',
    symbol: 'HERE',
    timezone: 'Etc/UTC',
    now: () => BASE_TIME + count * 5 * MINUTE,
  };
}

/** A chart's lifecycle, with the transport under the test's own control. */
interface Harness {
  readonly asked: ChartBarsRequest[];
  readonly statuses: ChartDataStatus[];
  recomputes: number;
  retry: (() => void) | null;
  attach(descriptor: ChartDescriptor, store: ChartStore): void;
}

function harness(answer: (request: ChartBarsRequest) => Promise<readonly ChartBar[]>): Harness {
  const held: Harness = {
    asked: [],
    statuses: [],
    recomputes: 0,
    retry: null,
    attach(descriptor: ChartDescriptor, store: ChartStore): void {
      const ctx: ChartAttachContext = {
        store,
        requestBars: (request) => {
          held.asked.push(request);
          return answer(request);
        },
        requestRecompute: () => {
          held.recomputes += 1;
        },
        setDataStatus: (status) => {
          held.statuses.push(status);
        },
        setDataRetry: (retry) => {
          held.retry = retry;
        },
      };
      descriptor.attach?.(ctx);
    },
  };
  return held;
}

/** Everything queued behind the transport, run. */
async function settled(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function column(values: ChartValues): readonly (number | null)[] {
  return values['p0'] ?? [];
}

// Catches: a study refused at load because its bars had not arrived. The chart
// computes once before it attaches the lifecycle that has the transport, so a
// station that insisted on one would turn every such study into an error.
test('a read of another instrument is absent until the answer arrives, and then it is not',
  async () => {
    const descriptor = descriptorOfSource(OTHER);
    const settings: ChartSettings = {};
    const store: ChartStore = {};
    const data = bars(24);
    const held = harness(() => Promise.resolve(hourly(3)));

    const waiting = descriptor.calc(data, settings, store, contextOf(24));
    assert.equal(
      column(waiting).every((one) => one === null),
      true,
      'nothing has been fetched, so the read is absent and the study still draws',
    );

    held.attach(descriptor, store);
    await settled();
    assert.equal(held.recomputes, 1, 'the answer asks for the calculation that can use it');

    const answered = descriptor.calc(data, settings, store, contextOf(24));
    assert.equal(column(answered)[11], null, 'no hourly bar of the other instrument has closed');
    assert.equal(column(answered)[12], 500, 'the first one has, on the first bar of the next hour');
    assert.equal(
      column(answered)[23],
      500,
      'and it holds across the second hour, which has not closed by the newest bar',
    );
  });

// Catches: a range worked out from the newest bar without quantising it. Every
// new bar then widens the range, and every new bar is another fetch.
test('the range asked for covers the chart and does not move with every bar', async () => {
  const descriptor = descriptorOfSource(OTHER);
  const settings: ChartSettings = {};
  const store: ChartStore = {};
  const held = harness(() => Promise.resolve(hourly(3)));

  descriptor.calc(bars(20), settings, store, contextOf(20));
  held.attach(descriptor, store);
  await settled();

  assert.equal(held.asked.length, 1);
  assert.deepEqual(held.asked[0], {
    symbol: 'OTHER',
    interval: '1h',
    from: BASE_TIME,
    to: BASE_TIME + 2 * HOUR,
  });
  assert.equal('exchange' in (held.asked[0] ?? {}), false, 'the script named none and neither does this');

  // Four more five minute bars, all inside the second hour, are the same range,
  // so nothing is fetched again.
  descriptor.calc(bars(24), settings, store, contextOf(24));
  await settled();
  assert.equal(held.asked.length, 1, 'a bar inside the bucket already fetched asks for nothing');

  // A bar in the third hour is a bucket that was not asked for.
  descriptor.calc(bars(26), settings, store, contextOf(26));
  await settled();
  assert.equal(held.asked.length, 2, 'a bar in the next bucket widens the range once');
  assert.equal(held.asked[1]?.to, BASE_TIME + 3 * HOUR);
});

// Catches: a refusal delivered as an empty answer, which looks exactly like an
// instrument that did not trade, and a refusal that stops the whole study.
test('a host that refuses leaves the read absent, says why, and the study keeps drawing',
  async () => {
    const descriptor = descriptorOfSource(OTHER);
    const settings: ChartSettings = {};
    const store: ChartStore = {};
    const data = bars(24);
    const held = harness(() =>
      Promise.reject(new Error('this chart has no bars provider')));

    descriptor.calc(data, settings, store, contextOf(24));
    held.attach(descriptor, store);
    await settled();

    const values = descriptor.calc(data, settings, store, contextOf(24));
    assert.equal(column(values).every((one) => one === null), true, 'the read is absent');
    const marker = (descriptor.markers?.({ bars: data, values, settings }) ?? [])[0];
    assert.equal(
      marker?.text?.includes('this chart has no bars provider'),
      true,
      'the host\'s own words reach the script, not a paraphrase of them',
    );

    const failed = held.statuses[held.statuses.length - 1];
    assert.equal(failed?.state, 'error');
    assert.notEqual(held.retry, null, 'a refusal a user can act on is offered a retry');
  });

// Catches: a study that waits for a host it does not need. A whole multiple of
// the chart's interval is folded from the chart's own bars, so attaching the
// lifecycle a timeframe read declares fetches nothing and asks for no recompute.
test('a read of this chart\'s own instrument at a whole multiple fetches nothing', async () => {
  const descriptor = descriptorOfSource(`version 1

study("Bias", overlay = true)

hourly = req.timeframe("1h", close)

plot(hourly, "Hourly close")
`);
  const data = bars(24);
  const store: ChartStore = {};
  const values = descriptor.calc(data, {}, store, contextOf(24));
  const held = harness(() => Promise.resolve(hourly(3)));
  held.attach(descriptor, store);
  await settled();
  assert.equal(held.asked.length, 0, 'nothing to fetch: the chart bars are the source');
  assert.equal(held.recomputes, 0);
  assert.equal(column(values)[11], null, 'the first hour has not closed on bar 11');
  assert.equal(column(values)[12], 111, 'and it closes on the first bar of the next');
});

// Catches: a study that reads nothing outside its own bars still being given a
// lifecycle, which costs every host a subscription nothing will use.
test('a study that reads only its own bars declares no lifecycle', () => {
  const descriptor = descriptorOfSource(`version 1

study("Plain")

plot(close, "Close")
`);
  assert.equal(descriptor.attach, undefined);
});

/** A study that reads fifteen minutes of the chart's own instrument. */
const FIFTEEN = `version 1

study("Fifteen", overlay = true)

plot(req.timeframe("15", close), "Fifteen")
`;

/** Ten minute chart bars, priced by index, from the same hour boundary. */
function tenMinutes(count: number): readonly ChartBar[] {
  const out: ChartBar[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push({ open: 100, high: 101, low: 99, close: 100 + i, time: BASE_TIME + i * 10 * MINUTE });
  }
  return out;
}

/** Five minute bars of the same instrument, at prices no chart bar could produce. */
function fiveMinuteBase(count: number): readonly ChartBar[] {
  const out: ChartBar[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push({ open: 1000, high: 1001, low: 999, close: 1000 + i, time: BASE_TIME + i * 5 * MINUTE });
  }
  return out;
}

// Catches: a station that still answers every read of the chart's own
// instrument with "fold it yourself", which leaves a fifteen minute read on a
// ten minute chart absent forever; one that asks for fifteen minute bars rather
// than the five minute base the fold needs; and a range that stops at the
// requested bucket rather than the end of the newest chart bar.
test('a read the chart bars do not fold into is fetched at its base, through the newest chart bar',
  async () => {
    const descriptor = descriptorOfSource(FIFTEEN);
    const settings: ChartSettings = {};
    const store: ChartStore = {};
    const data = tenMinutes(6);
    const ctx: ChartCalcContext = { ...contextOf(6), interval: '10m' };
    const held = harness(() => Promise.resolve(fiveMinuteBase(12)));

    descriptor.calc(data, settings, store, ctx);
    held.attach(descriptor, store);
    await settled();

    assert.deepEqual(held.asked[0], {
      symbol: 'HERE',
      interval: '5m',
      from: BASE_TIME,
      to: BASE_TIME + 60 * MINUTE,
    });
    const answered = descriptor.calc(data, settings, store, ctx);
    // Chart bar 1, from ten past to twenty past, reads the base bar at a quarter
    // past, which closes the first fifteen minute bucket at the base bar before it.
    assert.deepEqual(column(answered).slice(0, 4), [null, 1002, 1002, 1005]);
  });
