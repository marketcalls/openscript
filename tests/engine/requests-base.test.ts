/**
 * Reads whose requested bars are not whole chart bars: counted from the
 * session's open, and folded from a finer base the host serves.
 *
 * `stdlib.md` 15.2 and `compiled-program.md` 2.16.2. Every number below is
 * worked out by hand from the bucket boundaries in the comment above its test,
 * on a market that opens at a quarter past the hour, because that is the case
 * a count from the epoch gets wrong: its sixty and thirty minute buckets begin
 * on the hour and the half hour, and the venue's own candles do not.
 *
 * The wrong implementations these catch: buckets counted from the epoch
 * (the anchoring tests), a base read that stops at the chart bar's open and so
 * folds one base bar per chart bar (the fifteen and three minute tests), and a
 * developing read that keeps showing a bucket the chart bar has already left
 * (the gap test).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { load } from '../../src/core/engine/index.js';
import type { EngineHost, HostBar, RequestAnswer, RequestQuery, Value } from '../../src/core/engine/index.js';
import { asWire, compile } from './support.js';

const MINUTE = 60_000;
/** 09:15 in a zone five and a half hours ahead of UTC, on a Monday. */
const OPEN = Date.UTC(2025, 0, 6, 3, 45, 0);

const SESSION = { start: '09:15', end: '15:30', days: [1, 2, 3, 4, 5] };

/** Bars every `minutes` from the open, priced `base + i` so a value names its bar. */
function every(minutes: number, count: number, base: number, from = OPEN): HostBar[] {
  const out: HostBar[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push({
      open: base + i,
      high: base + i + 0.5,
      low: base + i - 0.5,
      close: base + i,
      volume: 1,
      time: from + i * minutes * MINUTE,
    });
  }
  return out;
}

interface Served {
  readonly host: EngineHost;
  readonly asked: RequestQuery[];
}

/** A ten minute chart on that market, serving `answer` for whatever it is asked. */
function tenMinuteChart(answer: (query: RequestQuery) => RequestAnswer | undefined): Served {
  const asked: RequestQuery[] = [];
  return {
    asked,
    host: {
      instrument: { symbol: 'AAA', exchange: 'XX', interval: '10m', timezone: 'Asia/Kolkata', session: SESSION },
      requestBars: (query) => {
        asked.push(query);
        return answer(query);
      },
    },
  };
}

function compiled(source: string): ReturnType<typeof compile> {
  const out = compile('base.oscript', source);
  assert.deepEqual(
    out.diagnostics.filter((one) => one.severity === 'error').map((one) => one.code),
    [],
    'the test script itself did not compile',
  );
  return out;
}

function ran(source: string, host: EngineHost, bars: readonly HostBar[]): readonly Value[][] {
  const program = compiled(source);
  const loaded = load(asWire(program.program), { source: program.file, host });
  if (!loaded.ok) throw new Error(`${loaded.diagnostic.code}: ${loaded.diagnostic.message}`);
  const result = loaded.engine.run(bars, bars.map(() => ({ isConfirmed: true })));
  assert.equal(result.diagnostic, undefined, result.diagnostic?.message);
  return loaded.engine.program.channels.map((_, channel) => [...loaded.engine.column(channel)]);
}

function refusedAt(source: string, host: EngineHost): string {
  const program = compiled(source);
  const loaded = load(asWire(program.program), { source: program.file, host });
  if (loaded.ok) throw new Error('the program loaded and the test expected a refusal');
  return loaded.diagnostic.code;
}

const READS = (timeframe: string): string => `version 1
study("Reads", overlay = true)
plot(req.timeframe("${timeframe}", close), "Confirmed")
plot(req.timeframe("${timeframe}", close, mode = "developing"), "Developing")
`;

/**
 * Thirty minutes on a ten minute chart is a whole multiple, so the chart's own
 * bars are folded, counted from the 09:15 open: [09:15, 09:45) holds chart bars
 * 0 to 2 and [09:45, 10:15) holds 3 to 5. Counted from the epoch, the first
 * bucket would have been [09:00, 09:30) holding only bars 0 and 1, and bar 2
 * would already have read it as closed at 101.
 */
test('a whole multiple is counted from the session open, as the venue candles are', () => {
  const { host, asked } = tenMinuteChart(() => undefined);
  const [confirmed, developing] = ran(READS('30'), host, every(10, 7, 100));
  assert.deepEqual(confirmed?.slice(0, 7), [null, null, null, 102, 102, 102, 105]);
  assert.deepEqual(developing?.slice(0, 7), [100, 101, 102, 103, 104, 105, 106]);
  assert.equal(asked[0]?.interval, '30', 'a whole multiple asks for its own interval');
});

/**
 * Twenty five minutes on a five minute chart, on a host with a zone and no
 * session: counted from midnight in that zone, so [10:00, 10:25) is bars 0 to 4
 * every day. From the epoch the boundary on this date fell at 09:50 and 10:15.
 */
test('without a session an intraday bucket is counted from midnight in the zone', () => {
  const start = Date.UTC(2025, 0, 6, 10, 0, 0);
  const host: EngineHost = { instrument: { symbol: 'AAA', exchange: 'XX', interval: '5', timezone: 'UTC' } };
  const [confirmed] = ran(READS('25'), host, every(5, 11, 100, start));
  assert.deepEqual(confirmed?.slice(0, 11), [null, null, null, null, null, 104, 104, 104, 104, 104, 109]);
});

/**
 * Fifteen minutes on a ten minute chart, folded from five minute bars priced
 * 1000 + j. Buckets [09:15, 09:30) is base 0 to 2, [09:30, 09:45) is 3 to 5 and
 * [09:45, 10:00) is 6 to 8; chart bar i holds base 2i and 2i + 1. Bar 1 reads
 * base 3, which closes the first bucket at 1002, and its developing value is
 * the bucket that opened at 09:30, as far as 1003.
 */
test('fifteen on a ten minute chart is folded from five minute bars the host serves', () => {
  const base = every(5, 12, 1000);
  const { host, asked } = tenMinuteChart((query) => (query.interval === '5m' ? { bars: base } : undefined));
  const [confirmed, developing] = ran(READS('15'), host, every(10, 5, 100));
  assert.equal(asked[0]?.timeframe, '15');
  assert.equal(asked[0]?.interval, '5m', 'the host is asked for the base, not the requested interval');
  assert.deepEqual(confirmed?.slice(0, 5), [null, 1002, 1002, 1005, 1008]);
  assert.deepEqual(developing?.slice(0, 5), [1001, 1003, 1005, 1007, 1009]);
});

/**
 * Three minutes on a ten minute chart, folded from one minute bars priced
 * 5000 + k. Three minute buckets begin at 09:15, 09:18, 09:21 and so on, so the
 * chart bar [09:15, 09:25) holds minutes 0 to 9: the last bucket closed inside
 * it is [09:21, 09:24) at 5008, and the one still forming at its close is
 * [09:24, 09:27) at 5009. The next chart bar ends with [09:30, 09:33) closed at
 * 5017 and [09:33, 09:36) forming at 5019.
 */
test('three on a ten minute chart is the last three minute bar closed by the chart bar close', () => {
  const base = every(1, 40, 5000);
  const { host, asked } = tenMinuteChart((query) => (query.interval === '1m' ? { bars: base } : undefined));
  const [confirmed, developing] = ran(READS('3'), host, every(10, 3, 100));
  assert.equal(asked[0]?.interval, '1m');
  assert.deepEqual(confirmed?.slice(0, 3), [5008, 5017, 5026]);
  assert.deepEqual(developing?.slice(0, 3), [5009, 5019, 5029]);
});

/**
 * A base with a hole across a bucket boundary: the host has no five minute bars
 * at 09:45 and 09:50, so chart bar 3 [09:45, 09:55) ends inside the bucket that
 * opened at 09:45 and has received nothing of it. Its developing value is
 * absent rather than the 09:30 bucket chart bar 2 was in, and its confirmed
 * value holds 1002 until a later bar closes the 09:30 bucket: chart bar 4 reads
 * 09:55 and 10:00, closing 09:30 at 1005 and then 09:45 at 1008.
 */
test('a developing read is absent where the chart bar ends in a bucket it holds nothing of', () => {
  const base = every(5, 12, 1000).filter((_, j) => j !== 6 && j !== 7);
  const { host } = tenMinuteChart(() => ({ bars: base }));
  const [confirmed, developing] = ran(READS('15'), host, every(10, 5, 100));
  assert.deepEqual(confirmed?.slice(0, 5), [null, 1002, 1002, 1002, 1008]);
  assert.deepEqual(developing?.slice(0, 5), [1001, 1003, 1005, null, 1009]);
});

const STATUS = `version 1
study("Status", overlay = true)
o = req.timeframe("15", close)
plot(o, "O")
plot(req.isReady(o) ? 1 : 0, "Ready")
plot(req.error(o) == "" ? 0 : 1, "Failed")
`;

test('a host that serves no base bars leaves the read absent and says why', () => {
  const { host } = tenMinuteChart(() => undefined);
  const [value, ready, failed] = ran(STATUS, host, every(10, 4, 100));
  assert.deepEqual(value?.slice(0, 4), [null, null, null, null]);
  assert.equal(ready?.[3], 0);
  assert.equal(failed?.[3], 1);
});

test('a host still fetching base bars leaves the read absent and not ready', () => {
  const { host } = tenMinuteChart(() => ({ pending: true }));
  const [value, ready, failed] = ran(STATUS, host, every(10, 4, 100));
  assert.deepEqual(value?.slice(0, 4), [null, null, null, null]);
  assert.equal(ready?.[3], 0);
  assert.equal(failed?.[3], 0);
});

test('a base read on a host with no provider keeps the refusals it always had', () => {
  const host: EngineHost = {
    instrument: { symbol: 'AAA', exchange: 'XX', interval: '10m', timezone: 'Asia/Kolkata', session: SESSION },
  };
  assert.equal(refusedAt(READS('15'), host), 'OS6015');
  assert.equal(refusedAt(READS('3'), host), 'OS6002');
});

test('a read written inside another keeps the whole multiple rule', () => {
  const { host } = tenMinuteChart(() => undefined);
  const source = `version 1
study("Nested", overlay = true)
plot(req.timeframe("30", req.timeframe("45", close)), "N")
`;
  assert.equal(refusedAt(source, host), 'OS6015');
});

test('a minute read on a daily chart is still refused as finer than the chart', () => {
  const host: EngineHost = {
    instrument: { symbol: 'AAA', exchange: 'XX', interval: '1D', timezone: 'Asia/Kolkata' },
    requestBars: () => undefined,
  };
  assert.equal(refusedAt(READS('15'), host), 'OS6002');
});
