/**
 * The runner, round trip: a suite on disk, an adapter in a child process, a
 * result document out, and the exit code `conformance.md` section 9 fixes.
 *
 * Each test names the wrong runner it catches. Most of them drive one of the
 * fake adapters under `./adapters/`, because the outcomes section 9 reserves
 * for a crash, a hang and a malformed answer can only be produced by a
 * program that crashes, hangs or answers badly, and this engine's own adapter
 * does none of those on purpose.
 */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { OWN_ADAPTER, fake, oneBitUp, packageVersion, runSuite, temporarySuite } from './support.js';
import type { SuiteDocument, TemporarySuite } from './support.js';

const BUY = 'order/buy';

/** Every harvested case, which the round trip below has to pass. */
const HARVESTED = [BUY, 'order/sell'];

/** The one field the mutations below move by one bit. */
const PRICE = 'avgFillPrice';

function held(document: SuiteDocument | null): SuiteDocument {
  assert.notEqual(document, null, 'the runner wrote no document');
  if (document === null) throw new Error('unreachable');
  return document;
}

/** A copy of the buy case whose first order's price is one bit off. */
function oneBitOff(): TemporarySuite {
  const suite = temporarySuite([BUY]);
  suite.rewrite(BUY, 'expected.json', (expected) => {
    const orders = expected['orders'] as Array<Record<string, number>>;
    const first = orders[0] as Record<string, number>;
    first[PRICE] = oneBitUp(first[PRICE] as number);
  });
  return suite;
}

test('this engine passes every harvested case, and the document is section 9\'s', () => {
  // The round trip: catches a runner that never invokes the adapter, one that
  // loses a case, and an adapter that cannot answer the cases its own engine
  // harvested. The revision and identity are held to where they are written.
  const run = runSuite([]);
  const document = held(run.document);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(document.summary['total'], document.cases.length);
  assert.equal(document.summary['pass'], document.cases.length);
  for (const id of HARVESTED) {
    assert.equal(document.cases.find((row) => row.id === id)?.outcome, 'pass', id);
  }
  assert.equal(document.suiteRevision, packageVersion());
  assert.equal(document.engine.version, packageVersion());
  assert.equal(document.engine.profile, 'strategy');
  assert.equal(typeof document.startedAt, 'number');
  for (const row of document.cases) assert.equal(typeof row.durationMs, 'number');
});

test('an expected value one bit off fails at that value, and the run exits non-zero', () => {
  // Catches a comparison through a decimal rendering, which no rounding can
  // tell one bit apart, and a runner that exits 0 on a failing case.
  const suite = oneBitOff();
  try {
    const run = runSuite(['--cases', suite.root]);
    const document = held(run.document);
    assert.equal(run.status, 1);
    const row = document.cases[0];
    assert.equal(row?.outcome, 'fail');
    assert.equal(row?.channel, 'orders');
    assert.equal(row?.column, PRICE);
    assert.equal(row?.index, 0);
    assert.equal(row?.bound, 'exact');
    assert.equal(document.summary['fail'], 1);
  } finally {
    suite.remove();
  }
});

test('a file section 2 does not name makes the case an error, not input', () => {
  // Catches an adapter that reads a directory and ignores what it does not
  // know: the page says a runner reads no other file, and a stray one is a
  // case's file under the wrong name or a mistake, never nothing.
  const suite = temporarySuite([BUY]);
  try {
    writeFileSync(join(suite.directoryOf(BUY), 'stray.txt'), 'not input\n', 'utf8');
    const run = runSuite(['--cases', suite.root]);
    const row = held(run.document).cases[0];
    assert.equal(run.status, 1);
    assert.equal(row?.outcome, 'error');
    assert.equal(/stray\.txt/.test(row?.reason ?? ''), true, row?.reason);
  } finally {
    suite.remove();
  }
});

test('a case.json whose id is not the directory is an error before the adapter runs', () => {
  // Catches a runner that trusts the file: section 2 duplicates the id so a
  // moved directory is caught here rather than by a confused reader.
  const suite = temporarySuite([BUY]);
  try {
    suite.rewrite(BUY, 'case.json', (declared) => {
      declared['id'] = 'order/elsewhere';
    });
    const run = runSuite(['--cases', suite.root]);
    const row = held(run.document).cases[0];
    assert.equal(run.status, 1);
    assert.equal(row?.outcome, 'error');
    assert.equal(/section 2/.test(row?.reason ?? ''), true, row?.reason);
  } finally {
    suite.remove();
  }
});

test('a hang is the error outcome, reported within the timeout', () => {
  // Catches a runner with no clock on the child: the program that hangs
  // writes nothing, so nothing but the caller can report it.
  const run = runSuite(['--adapter', fake('hangs'), '--timeout', '400']);
  const document = held(run.document);
  assert.equal(run.status, 1);
  for (const row of document.cases) {
    assert.equal(row.outcome, 'error');
    assert.equal(/did not finish within 400 ms/.test(row.reason ?? ''), true, row.reason);
  }
  assert.equal(document.summary['error'], document.cases.length);
});

test('a crash is the error outcome, carrying the exit code and the adapter\'s own words', () => {
  // Catches a runner that reads an empty standard output as a result, and one
  // that drops what the child said, which is the only clue anybody has.
  const run = runSuite(['--adapter', fake('crashes')]);
  const row = held(run.document).cases[0];
  assert.equal(run.status, 1);
  assert.equal(row?.outcome, 'error');
  assert.equal(/exited with 3/.test(row?.reason ?? ''), true, row?.reason);
  assert.equal(/fell over/.test(row?.reason ?? ''), true, row?.reason);
});

test('an answer that is not one JSON object is the error outcome, whatever the exit code', () => {
  // Catches a runner that believes a zero exit: the one failure a clean exit
  // hides is a program that wrote prose where a document was owed.
  const run = runSuite(['--adapter', fake('garbles')]);
  const row = held(run.document).cases[0];
  assert.equal(run.status, 1);
  assert.equal(row?.outcome, 'error');
  assert.equal(/JSON/.test(row?.reason ?? ''), true, row?.reason);
});

test('a case outside the claimed profile is skipped, never run, and never counted as a pass', () => {
  // Catches a runner that hands every case to every adapter: the narrow fake
  // exits non-zero if it is handed one, and a skipped case counted as a pass
  // would be the badge section 12 says is not a claim at all.
  //
  // The fake claims `core`, so the cases outside it are the ones this asserts
  // about. It is handed the `core` cases and errors on them, which the test
  // below is about; what must never happen is a `strategy` case reaching it.
  const run = runSuite(['--adapter', fake('narrow')]);
  const document = held(run.document);
  const skipped = document.cases.filter((row) => row.outcome === 'skipped');
  assert.notEqual(skipped.length, 0, 'nothing was skipped, so this asserts nothing');
  // Every one of them was skipped for being outside `core`, never for being
  // inside it: a case the fake claims to cover must reach it.
  for (const row of skipped) assert.notEqual(row.profile, 'core');
  assert.equal(document.summary['pass'], 0);
});

test('an engine that answers no case does not pass, which is the whole of the gate', () => {
  // THE ONE THE PHASE 7 GATE TURNS ON, and it asserted the opposite until the
  // first `core` cases were written.
  //
  // The gate is "a core profile engine ... passes the suite". Every case in the
  // tree declared `strategy`, so an engine claiming `core` was handed none of
  // them: every case was skipped, `failing` excludes skipped, and the runner
  // printed "Suite passed" and exited zero. An engine implementing nothing met
  // the bar this project sets for engines, and this file asserted that outcome.
  //
  // No rule in the runner was wrong. What was missing was a case for it to
  // apply, which is why this test is about the suite's contents as much as the
  // runner's logic: it fails again the day `core` is emptied.
  const run = runSuite(['--adapter', fake('narrow')]);
  const document = held(run.document);
  const reached = document.cases.filter((row) => row.outcome === 'error');
  assert.notEqual(reached.length, 0, 'the suite holds no core case, so the gate claims nothing');
  assert.equal(document.summary['pass'], 0);
  assert.equal(run.status, 1, 'an engine answering no case was reported as passing');
});

test('two engines are compared on what they computed, which catches one that echoes the expected file', () => {
  // Section 10's reason for the second mode. The echo fake claims a pass on
  // every case and answers `--actual` with the expected file: against the
  // expected files it passes a broken suite, and against this engine it is
  // caught at the value. Catches a runner that compares outcomes rather than
  // values, which is exactly the runner section 10 says is not enough.
  const suite = oneBitOff();
  try {
    const alone = runSuite(['--adapter', fake('echo'), '--cases', suite.root]);
    assert.equal(alone.status, 0, alone.stderr);
    assert.equal(held(alone.document).cases[0]?.outcome, 'pass');

    const both = runSuite(['--against', fake('echo'), '--cases', suite.root]);
    const document = held(both.document);
    assert.equal(both.status, 1);
    assert.equal(document.against?.name, 'echo');
    const row = document.cases[0];
    assert.equal(row?.outcome, 'fail');
    assert.equal(row?.channel, 'orders');
    assert.equal(row?.column, PRICE);
    assert.equal(row?.index, 0);
  } finally {
    suite.remove();
  }
});

test('two engines that agree pass the second mode', () => {
  // The other half: catches a second mode that fails on its own comparison,
  // which the test above cannot tell from one that works.
  const run = runSuite(['--adapter', OWN_ADAPTER, '--against', fake('echo')]);
  const document = held(run.document);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(document.summary['pass'], document.cases.length);
});

test('the second mode is exact whatever the case declares', () => {
  // Section 6's last rule. With the loosest tolerance a case may declare, one
  // bit at a price near a hundred is far inside the relative bound, so the
  // first mode passes; the second mode has to fail it anyway. Catches a
  // runner that hands the case's tolerance to the cross-engine comparison.
  const suite = oneBitOff();
  try {
    suite.rewrite(BUY, 'case.json', (declared) => {
      declared['tolerance'] = { abs: 1e-12, rel: 1e-9, reason: 'a test of the second mode' };
    });
    const alone = runSuite(['--cases', suite.root]);
    assert.equal(alone.status, 0, alone.stderr);
    const both = runSuite(['--against', fake('echo'), '--cases', suite.root]);
    assert.equal(both.status, 1);
    assert.equal(held(both.document).cases[0]?.outcome, 'fail');
  } finally {
    suite.remove();
  }
});
