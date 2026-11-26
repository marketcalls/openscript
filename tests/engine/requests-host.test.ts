/**
 * The half of duty 3 only a host can answer, driven through a host built from
 * the page.
 *
 * `requests.test.ts` is the fold: which requested bar a chart bar is allowed to
 * see, over bars the engine already holds. This file is the hand-over itself.
 * Every host here is `tests/hosts/`, which is `spec/host-interface.md` typed out
 * and nothing else, because a suite that drives the engine with a host written
 * against the engine tests one side of an interface twice and the other side not
 * at all. That is how a request came to carry three fields section 5.2 does not
 * print, and to carry none of three it does.
 *
 * The prices are the bar index, so a value in a column says which bar produced
 * it, which is the same convention the fold suite uses.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { load } from '../../src/core/engine/index.js';
import type { HostBar, Value } from '../../src/core/engine/index.js';
import { asWire, compile } from './support.js';
import { PageHost, engineHostFor, lengthOf, pageInstrument, rangeFor } from '../hosts/index.js';
import type { PageBar, PageRequest, PageSeries } from '../hosts/index.js';

const OPEN = Date.UTC(2025, 0, 6, 10, 0, 0);
const FIVE_MINUTES = 300_000;
const HOUR = 3_600_000;

/** The chart's own bars, duty 1: five minute bars priced by index. */
function fiveMinutes(count: number): readonly PageBar[] {
  const out: PageBar[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push({
      time: OPEN + i * FIVE_MINUTES,
      open: 100 + i,
      high: 100 + i + 0.5,
      low: 100 + i - 0.5,
      close: 100 + i,
      volume: 10,
      oi: 0,
    });
  }
  return out;
}

/** Another instrument's hourly bars, at prices no chart bar could produce. */
function hourly(count: number, from: number): readonly PageBar[] {
  const out: PageBar[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push({
      time: from + i * HOUR,
      open: 200 + i,
      high: 202 + i,
      low: 198 + i,
      close: 200 + i,
      volume: 100,
      oi: 0,
    });
  }
  return out;
}

/** A shelf of another instrument's bars, as the page host holds one. */
function shelf(bars: readonly PageBar[], over: Partial<PageSeries> = {}): PageSeries {
  return {
    instrument: 'BBB',
    exchange: 'SAMPLE_VENUE',
    timeframe: '1h',
    bars,
    ...over,
  };
}

/** A read of another instrument, which only a host can answer. */
const OTHER = `version 1
study("Other", overlay = true)
o = req.symbol("BBB", "1h", close)
plot(o, "O")
plot(req.isReady(o) ? 1 : 0, "Ready")
plot(req.error(o) == "" ? 0 : 1, "Failed")
`;

function clean(source: string): ReturnType<typeof compile> {
  const compiled = compile('request.oscript', source);
  assert.deepEqual(
    compiled.diagnostics.filter((one) => one.severity === 'error').map((one) => one.code),
    [],
    'the test script itself did not compile',
  );
  return compiled;
}

/**
 * Compiles, loads over the host, runs the chart's bars and hands back the
 * columns, with the host so a test can assert on the hand-over as well.
 *
 * The chart's own record is the page's, with the interval the chart is really
 * on: the record is what the fold dates its buckets by and what the two
 * documented defaults are resolved from.
 */
function ran(
  source: string,
  host: PageHost,
  count = 24,
): { readonly columns: readonly Value[][]; readonly host: PageHost } {
  const compiled = clean(source);
  const loaded = load(asWire(compiled.program), {
    source: compiled.file,
    host: engineHostFor(host),
  });
  if (!loaded.ok) throw new Error(`${loaded.diagnostic.code}: ${loaded.diagnostic.message}`);
  const bars = fiveMinutes(count) as readonly HostBar[];
  const result = loaded.engine.run(bars, bars.map(() => ({ isConfirmed: true })));
  assert.equal(result.diagnostic, undefined, result.diagnostic?.message);
  assert.deepEqual(host.problems, [], 'the request did not match the table of section 5.2');
  return {
    columns: loaded.engine.program.channels.map((_, channel) => [...loaded.engine.column(channel)]),
    host,
  };
}

/** A chart of five minute bars on the page's own record. */
function chartHost(options: Partial<ConstructorParameters<typeof PageHost>[0]> = {}): PageHost {
  return new PageHost({
    instrument: pageInstrument({ interval: '5', symbol: 'AAA' }),
    bars: fiveMinutes(24),
    ...options,
  });
}

/**
 * The hand-over itself, field by field against the table of section 5.2.
 *
 * This is the test the reviewer's host would have been. Every field the page
 * prints has to arrive, under the name it prints, and nothing may arrive that
 * the page does not print, because a host cannot act on a fact it was never told
 * about. `readRequest` in the fixture is what checks the shape; this names the
 * values, because a field that arrives holding nothing is a field that did not
 * arrive.
 */
test('a request carries the fields section 5.2 prints, with the values it says', () => {
  const host = chartHost({ serves: [shelf(hourly(4, OPEN - HOUR))] });
  ran(OTHER, host, 4);

  assert.equal(host.requests.length, 1, 'a request must not be discovered during a bar');
  assert.deepEqual(host.requests[0], {
    id: 0,
    read: 'symbol',
    instrument: 'BBB',
    exchange: 'SAMPLE_VENUE',
    timeframe: '1h',
    interval: '1h',
    mode: 'confirmed',
    warmup: 0,
  } satisfies PageRequest);
});

/**
 * The documented default that was not arriving.
 *
 * `stdlib.md` 15.1 gives `req.symbol`'s `exchange` the default `chart.exchange`,
 * and the page says the same. A host handed nothing there has no venue to
 * resolve the instrument on, and the instrument it does resolve is the one it
 * would have resolved for any chart, which is a different contract wherever a
 * ticker is listed twice.
 */
test('the exchange a script did not name arrives as the chart exchange', () => {
  const host = chartHost({
    instrument: pageInstrument({ interval: '5', symbol: 'AAA', exchange: 'ONE_VENUE' }),
    serves: [shelf(hourly(4, OPEN - HOUR), { exchange: 'ONE_VENUE' })],
  });
  const { columns } = ran(OTHER, host, 4);
  assert.equal(host.requests[0]?.exchange, 'ONE_VENUE', 'the chart exchange must reach the host');
  assert.equal(columns[1]?.[3], 1, 'and the read the host resolved on it is ready');
});

test('an exchange the script named is carried and not overwritten', () => {
  const source = `version 1
study("Named", overlay = true)
o = req.symbol("BBB", "1h", close, exchange = "OTHER_VENUE")
plot(o, "O")
`;
  const host = chartHost({
    instrument: pageInstrument({ interval: '5', symbol: 'AAA', exchange: 'ONE_VENUE' }),
    serves: [shelf(hourly(4, OPEN - HOUR), { exchange: 'OTHER_VENUE' })],
  });
  ran(source, host, 4);
  assert.equal(host.requests[0]?.exchange, 'OTHER_VENUE');
});

/**
 * A read of the chart's own instrument at a coarser interval.
 *
 * The engine folds it from the bars it already holds, so a host may serve
 * nothing. It is still handed the request, and the identity it is handed is the
 * chart's own: a host that does keep coarser bars for its own instrument has an
 * instrument to look them up by, rather than a blank it would have to fill from
 * a record it supplied.
 */
test('a timeframe read carries the chart own identity and asks nothing of the host', () => {
  const source = `version 1
study("Folded", overlay = true)
plot(req.timeframe("1h", close), "C")
`;
  const host = chartHost({ serves: [] });
  const { columns } = ran(source, host);
  assert.deepEqual(host.requests[0], {
    id: 0,
    read: 'timeframe',
    instrument: 'AAA',
    exchange: 'SAMPLE_VENUE',
    timeframe: '1h',
    interval: '1h',
    mode: 'confirmed',
    warmup: 0,
  } satisfies PageRequest);
  assert.equal(columns[0]?.[12], 111, 'the engine folded it from the chart own bars');
});

test('another instrument is folded onto the chart bars by time', () => {
  const host = chartHost({ serves: [shelf(hourly(3, OPEN - HOUR))] });
  const { columns } = ran(OTHER, host);
  const [values, ready, failed] = columns;
  assert.ok(values && ready && failed);
  // Chart bars 0 to 11 are inside the 10:00 hour, whose last closed predecessor
  // is the 09:00 bar; bars 12 to 23 are inside the 11:00 hour.
  assert.equal(values[0], 200);
  assert.equal(values[11], 200);
  assert.equal(values[12], 201);
  assert.equal(ready[0], 1, 'an answered read is ready');
  assert.equal(failed[0], 0, 'an answered read reports no reason');
});

/**
 * The number a host extends its fetch range backwards by, and the range it
 * turns into.
 *
 * A read whose expression needs thirty bars of the requested timeframe and asks
 * a host for none gets thirty requested bars of nothing, or, on a host that
 * starts the average at the first bar it fetched, thirty bars of a number
 * computed from too little history. The second is the one nobody sees. So the
 * lengths written inside the expression have to reach the query, whether the
 * entry states its warmup exactly or bounds it, and the host has to be able to
 * turn the count into instants, which is the arithmetic section 5.2 leaves it.
 */
test('the history a read asks for backwards counts the lengths inside it', () => {
  const asked = (source: string): PageRequest => {
    const host = chartHost({ serves: [shelf(hourly(2, OPEN - HOUR))], bars: fiveMinutes(4) });
    ran(source, host, 4);
    const request = host.requests[0];
    assert.notEqual(request, undefined, 'the host was asked nothing');
    return request as PageRequest;
  };
  const inside = (expression: string): string => `version 1
study("Warmup", overlay = true)
o = req.symbol("BBB", "1h", ${expression})
plot(o, "O")
`;
  assert.equal(asked(inside('ema(close, 20)')).warmup, 19, 'an exact length reaches the host');
  assert.equal(asked(inside('hma(close, 20)')).warmup, 18, 'and so does one the entry only bounds');
  assert.equal(asked(inside('macd(close)[1]')).warmup, 33, 'an element asks for what it needs');

  // And the count is one a host can turn into a range: the chart's own span,
  // extended backwards by that many requested bars.
  const request = asked(inside('ema(close, 20)'));
  const range = rangeFor(request, fiveMinutes(4));
  assert.notEqual(range, undefined);
  assert.equal(range?.to, OPEN + HOUR, 'forwards to the end of the bar the newest chart bar is in');
  assert.equal(
    range?.from,
    OPEN - 20 * lengthOf('1h'),
    'backwards by the warmup, and by the one more this host chooses to add',
  );
});

/**
 * A refusal is a state a script observes, and the rest of the study keeps
 * drawing.
 *
 * The host's own words are carried rather than paraphrased, because "the feed is
 * not connected" is actionable and "the request failed" is not.
 */
test('a refused read is absent, reports the host reason, and stops nothing else', () => {
  const source = `version 1
study("Refused", overlay = true)
o = req.symbol("BBB", "1h", close)
plot(o, "O")
plot(req.isReady(o) ? 1 : 0, "Ready")
plot(close, "Close")
plot(str.contains(req.error(o), "not connected") ? 1 : 0, "Carried")
`;
  const host = chartHost({
    refuses: { code: 'OS6009', reason: 'the feed is not connected' },
  });
  const { columns } = ran(source, host, 6);
  assert.equal(columns[0]?.[5], null, 'a refused read has no value');
  assert.equal(columns[1]?.[5], 0, 'a refused read is not ready');
  assert.equal(columns[2]?.[5], 105, 'the rest of the study kept drawing');
  assert.equal(columns[3]?.[5], 1, 'the host own words must reach the script');
});

/**
 * The same refusal, asked about a read written inline rather than named.
 *
 * Section 5.4's first rule is that a refusal is reported and is never an empty
 * answer, and the empty string is what the pair of status calls answers for a
 * read that does not exist. That is what an inline read used to be: the
 * compiler resolved it to an id and emitted no request under it, so the host
 * was never asked about it and the script was told nothing was wrong. A study
 * that draws nothing while its own diagnostics say nothing is wrong is the
 * worst version of a silent failure, because the user has already looked.
 *
 * Catches the resolution going back to an id with no request behind it, which
 * reads as a passing study because the study still compiles, still loads and
 * still draws the rest of itself.
 */
test('a refused read reports the same reason written inline as written as a name', () => {
  const inline = `version 1
study("Inline", overlay = true)
plot(req.symbol("BBB", "1h", close), "O")
plot(str.contains(req.error(req.symbol("BBB", "1h", close)), "not connected") ? 1 : 0, "Carried")
plot(req.isReady(req.symbol("BBB", "1h", close)) ? 1 : 0, "Ready")
plot(close, "Close")
`;
  const host = chartHost({
    refuses: { code: 'OS6009', reason: 'the feed is not connected' },
  });
  const { columns } = ran(inline, host, 6);
  assert.equal(columns[0]?.[5], null, 'a refused read has no value, named or not');
  assert.equal(columns[1]?.[5], 1, 'the host own words must reach a read written inline');
  assert.equal(columns[2]?.[5], 0, 'a read with a reason is never ready');
  assert.equal(columns[3]?.[5], 105, 'the rest of the study kept drawing');
});

/**
 * A read written inline is a read, so the host is asked about it.
 *
 * One request per read written in the source is what 5.2 counts against a
 * host's ceiling, and it is the only answer that can be right here: the two
 * calls are two reads the file wrote, and an engine that answered one of them
 * from the other would be reporting about a request nobody made.
 */
test('a read written inside a status call is asked of the host like any other', () => {
  const source = `version 1
study("Asked", overlay = true)
plot(str.length(req.error(req.symbol("BBB", "1h", close))), "Len")
plot(close, "Close")
`;
  const host = chartHost({ refuses: { code: 'OS6007' } });
  const { columns } = ran(source, host, 4);
  assert.equal(host.requests.length, 1, 'the inline read is the one request in the file');
  assert.equal(host.requests[0]?.instrument, 'BBB');
  assert.ok((columns[0]?.[3] as number) > 0, 'and its refusal has something to say');
});

/**
 * A refusal names the instrument and the venue the host was asked about.
 *
 * Both come from the request, so the sentence a user reads is only as good as
 * the two fields this page reconciled: a refusal that named no exchange would
 * send somebody to check a subscription on a venue nobody identified.
 */
test('an unresolved instrument is refused with the identity the host was handed', () => {
  const source = `version 1
study("Unknown", overlay = true)
o = req.symbol("BBB", "1h", close)
plot(o, "O")
plot(str.contains(req.error(o), "BBB") ? 1 : 0, "Named")
plot(str.contains(req.error(o), "ONE_VENUE") ? 1 : 0, "Venue")
`;
  const host = chartHost({
    instrument: pageInstrument({ interval: '5', symbol: 'AAA', exchange: 'ONE_VENUE' }),
    serves: [],
  });
  const { columns } = ran(source, host, 4);
  assert.equal(columns[1]?.[3], 1, 'the reason names the instrument that was asked for');
  assert.equal(columns[2]?.[3], 1, 'and the venue it was asked for on');
});

test('a host still fetching leaves the read absent and not ready', () => {
  const { columns } = ran(OTHER, chartHost({ waiting: true }), 6);
  const [values, ready, failed] = columns;
  assert.ok(values && ready && failed);
  assert.equal(values[5], null);
  assert.equal(ready[5], 0);
  assert.equal(failed[5], 0, 'waiting is not failing, so there is no reason to report');
});

test('a host that serves the duty and knows the instrument not refuses rather than answers empty', () => {
  const { columns } = ran(OTHER, chartHost({ serves: [] }), 4);
  const [values, ready, failed] = columns;
  assert.ok(values && ready && failed);
  assert.equal(values[3], null);
  assert.equal(ready[3], 0);
  assert.equal(failed[3], 1, 'an empty answer would look like an instrument that did not trade');
});

/**
 * The duty is optional, and a host declares that at load.
 *
 * A host that implements none of duty 3 offers no provider, so the engine
 * declares no `req.symbol` capability and the program is refused at load with
 * OS6006 naming the tag, which is section 2's rule rather than a study drawing
 * a silently empty line.
 */
test('a host that does not serve requests refuses the program at load, naming the tag', () => {
  const compiled = clean(OTHER);
  const host = new PageHost({
    instrument: pageInstrument({ interval: '5', symbol: 'AAA' }),
    bars: fiveMinutes(4),
  });
  const loaded = load(asWire(compiled.program), {
    source: compiled.file,
    host: engineHostFor(host),
  });
  assert.equal(loaded.ok, false);
  if (loaded.ok) return;
  assert.equal(loaded.diagnostic.code, 'OS6006');
  assert.equal(loaded.diagnostic.values['tag'], 'req.symbol');
});

/**
 * The record checked against itself, section 4.3.
 *
 * A session is wall clock, so a host that states one and no zone to read it in
 * has stated nothing, and answering that with the same absence an honest record
 * gives is how a host loses every session study and is told nothing. It is a
 * load refusal naming the fact instead.
 */
test('a session with no timezone is refused at load, naming what is missing', () => {
  const compiled = clean(`version 1
study("Session", overlay = true)
plot(vwap(), "V")
`);
  const record = { ...pageInstrument({ interval: '5' }) } as unknown as Record<string, unknown>;
  delete record['timezone'];
  const loaded = load(asWire(compiled.program), {
    source: compiled.file,
    host: { instrument: record as never },
  });
  assert.equal(loaded.ok, false);
  if (loaded.ok) return;
  assert.equal(loaded.diagnostic.code, 'OS6012');
  assert.equal(
    String(loaded.diagnostic.values['fact']).includes('timezone'),
    true,
    'the refusal must name the fact the host did not supply',
  );
});

test('a session spelled in a form the record does not take is refused at load', () => {
  const compiled = clean(`version 1
study("Session", overlay = true)
plot(vwap(), "V")
`);
  for (const session of [{ start: '9:00', end: '17:30' }, { start: '09:00', end: '17:30', days: [0] }]) {
    const loaded = load(asWire(compiled.program), {
      source: compiled.file,
      host: { instrument: pageInstrument({ interval: '5', session }) },
    });
    assert.equal(loaded.ok, false, `${session.start} to ${session.end} should be refused`);
    if (loaded.ok) return;
    assert.equal(loaded.diagnostic.code, 'OS6012');
  }
});

test('a timezone no calendar can read is refused at load rather than dating nothing', () => {
  const compiled = clean(`version 1
study("Zone", overlay = true)
plot(vwap(), "V")
`);
  const loaded = load(asWire(compiled.program), {
    source: compiled.file,
    host: { instrument: pageInstrument({ interval: '5', timezone: 'UTC+05:30' }) },
  });
  assert.equal(loaded.ok, false);
  if (loaded.ok) return;
  assert.equal(loaded.diagnostic.code, 'OS6012');
});
