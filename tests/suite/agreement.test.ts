/**
 * The two engines, compared with each other: `conformance.md` section 10, run.
 *
 * Phase 6's gate is that the two engines agree on every conformance case, and
 * this is the file that makes the sentence mechanical. The first mode compares
 * each engine with the expected files; this drives the second, which compares
 * what the two engines computed, channel by channel, at tolerance zero whatever
 * the case declares.
 *
 * **Why the second mode is not the first mode twice.** Two engines can both pass
 * against an expected file while sitting on opposite sides of a declared
 * tolerance, and a case result carries an outcome rather than the values, so two
 * adapters reporting `pass` prove only that both matched a file. The test below
 * that moves an expected value by one bit shows the difference directly: the
 * first mode then fails for both engines and the second still passes, because
 * neither engine reads that file in `--actual`.
 *
 * Every test here starts the real Python engine through its own adapter, so a
 * failure names which engine and which channel, and a machine with no
 * interpreter fails with the sentence `engine/adapter.mjs` prints rather than
 * with a comparison nobody made.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { OWN_ADAPTER, fake, oneBitUp, runSuite, temporarySuite } from './support.js';
import type { SuiteDocument } from './support.js';

/** The second engine's adapter, which starts the Python package and relays it. */
const OTHER_ADAPTER = fileURLToPath(new URL('../../../engine/adapter.mjs', import.meta.url));

const BUY = 'order/buy';

/** Every harvested case, which both engines have to answer. */
const HARVESTED = [BUY, 'order/sell'];

/** The one field the mutation below moves by one bit. */
const PRICE = 'avgFillPrice';

function held(document: SuiteDocument | null, stderr: string): SuiteDocument {
  assert.notEqual(document, null, `the runner wrote no document: ${stderr}`);
  if (document === null) throw new Error('unreachable');
  return document;
}

test('the second engine passes every harvested case against the expected files', () => {
  // The first mode, on the engine the second mode compares against. Catches an
  // engine wired in as an adapter that answers nothing: every case would be
  // reported unsupported, and the comparison below would have nothing in it.
  //
  // It is not asked about every case, and that is section 8 rather than a
  // shortfall: this engine reports `engineOnly`, so the categories section 7
  // marks as needing a compiler are skipped. What must hold is that every case
  // it WAS asked about passed, and that it was asked about something.
  const run = runSuite(['--adapter', OTHER_ADAPTER]);
  const document = held(run.document, run.stderr);
  assert.equal(run.status, 0, run.stderr);
  assert.notEqual(document.summary['pass'], 0, 'the engine was asked about nothing');
  assert.equal(
    document.summary['pass'],
    document.cases.length - (document.summary['skipped'] ?? 0),
    'a case it was asked about did not pass',
  );
  for (const id of HARVESTED) {
    assert.equal(document.cases.find((row) => row.id === id)?.outcome, 'pass', id);
  }
  assert.equal(document.engine.profile, 'strategy');
});

test('the two engines agree on every case, exactly, and the document names both', () => {
  // Phase 6's gate. Catches the disagreement section 10 calls a release blocker,
  // and catches a runner that reported agreement without asking either engine:
  // the pass count is held to the number of cases rather than to zero.
  const run = runSuite(['--adapter', OWN_ADAPTER, '--against', OTHER_ADAPTER]);
  const document = held(run.document, run.stderr);
  assert.equal(run.status, 0, run.stderr);
  // The compiler-diagnostic cases are skipped, because one of the two engines
  // has no compiler and section 8 says so. Every case both were asked about
  // has to agree, and they have to have been asked about something: the count
  // is held to the cases that were run rather than to zero.
  assert.notEqual(document.summary['pass'], 0, 'neither engine was asked about anything');
  assert.equal(
    document.summary['pass'],
    document.cases.length - (document.summary['skipped'] ?? 0),
    'a case both engines were asked about did not agree',
  );
  assert.notEqual(document.cases.length, 0);
  assert.equal(document.engine.name, 'openalgo-script');
  assert.equal(document.against?.name, 'openscript');
  for (const id of HARVESTED) {
    assert.equal(document.cases.find((row) => row.id === id)?.outcome, 'pass', id);
  }
});

test('the second mode compares the engines and not the file either of them read', () => {
  // One bit on one price, in the case's own expectation. Both engines then fail
  // the first mode and still agree in the second, which is the whole reason
  // section 10 has a second mode. Catches a second mode implemented by running
  // the first one twice, which would report a disagreement that is in the case.
  const suite = temporarySuite([BUY]);
  try {
    suite.rewrite(BUY, 'expected.json', (expected) => {
      const orders = expected['orders'] as Array<Record<string, number>>;
      const first = orders[0] as Record<string, number>;
      first[PRICE] = oneBitUp(first[PRICE] as number);
    });
    for (const adapter of [OWN_ADAPTER, OTHER_ADAPTER]) {
      const alone = runSuite(['--adapter', adapter, '--cases', suite.root]);
      assert.equal(alone.status, 1, alone.stderr);
      assert.equal(held(alone.document, alone.stderr).cases[0]?.outcome, 'fail');
    }
    const both = runSuite(['--adapter', OWN_ADAPTER, '--against', OTHER_ADAPTER, '--cases', suite.root]);
    assert.equal(both.status, 0, both.stderr);
    assert.equal(held(both.document, both.stderr).summary['pass'], 1);
  } finally {
    suite.remove();
  }
});

test('a case one engine cannot run is unsupported, and a run holding one fails', () => {
  // Section 8: an implementation with an unsupported case inside the profile it
  // claims does not pass that profile. A tick file is a case the second engine
  // says it cannot replay, by name. Catches a comparison that treats a case
  // neither engine answered as agreement, which is two engines agreeing about
  // nothing.
  const suite = temporarySuite([BUY]);
  try {
    suite.write(BUY, { 'ticks.csv': 'time,price,volume\n1748736000000,100,1\n' });
    const both = runSuite(['--adapter', OWN_ADAPTER, '--against', OTHER_ADAPTER, '--cases', suite.root]);
    const row = held(both.document, both.stderr).cases[0];
    assert.equal(both.status, 1);
    assert.equal(row?.outcome, 'unsupported');
    assert.equal(/ticks\.csv/.test(row?.feature ?? ''), true, row?.feature);
  } finally {
    suite.remove();
  }
});

test('a comparison that ran no case at all is refused rather than reported as agreement', () => {
  // Catches a gate wired to an engine whose profile quietly stopped covering
  // the cases: the run would print a pass with no comparison behind it, which
  // is the evidence a suite with no cases in it produces.
  //
  // The suite is one `strategy` case and the second engine claims `core`, so
  // nothing is in common and nothing is compared. It is built here rather than
  // taken from the tree, because the tree used to hold no `core` case and this
  // test passed on that accident: the narrow fake was handed nothing whatever
  // the profiles said. The accident was also the Phase 7 gate's hole, and the
  // day it was fixed this test would have started asserting something else.
  const suite = temporarySuite([BUY]);
  try {
    const run = runSuite(['--adapter', OWN_ADAPTER, '--against', fake('narrow'), '--cases', suite.root]);
    assert.equal(run.status, 1);
    assert.equal(/inspected nothing/.test(run.stderr), true, run.stderr);
    assert.equal(held(run.document, run.stderr).summary['pass'], 0);
  } finally {
    suite.remove();
  }
});
