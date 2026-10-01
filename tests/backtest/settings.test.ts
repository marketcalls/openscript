/**
 * What a run cannot be carried out under, refused before its first bar.
 *
 * **Both refusals here are figures nobody could explain afterwards.** Two cost
 * models stated at once charge the same money twice or charge whichever an
 * engine happened to prefer, OS6023. A comparison tolerance with a bound and no
 * reason beside it is a failed comparison somebody switched off, OS6021. Each is
 * refused while nothing has been computed, so correcting it costs one run rather
 * than a report a reader has to be told to distrust.
 *
 * The code and the position are asserted and the sentence never is.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { backtest, checkSettings } from '../../src/core/backtest/index.js';
import { declarationOf } from '../../src/core/backtest/index.js';
import type { RunDeclaration } from '../../src/core/backtest/index.js';
import type { ChargeSchedule } from '../../src/core/accounting/index.js';
import { SUPPLIED, inAndOut, rising, runSettings } from './support.js';

const BARS = rising(8);

/** The declaration a program states, read the way the driver reads one. */
function declared(commission: number, slippage = 0): RunDeclaration {
  return declarationOf(inAndOut({ commission, slippage }));
}

/**
 * Settings a run can be carried out under are refused for nothing.
 *
 * The test that keeps the rest honest: a check that said no to everything would
 * satisfy both refusals below and fail here.
 */
test('settings a run can be carried out under are refused for nothing', () => {
  assert.equal(checkSettings(runSettings(), declared(0)), null);
  assert.equal(checkSettings(runSettings({ costs: SUPPLIED }), declared(0)), null);
  assert.equal(
    checkSettings(
      runSettings({ tolerance: { abs: 1e-9, rel: 0, reason: 'a second engine rounds elsewhere' } }),
      declared(20),
    ),
    null,
  );
});

/**
 * A supplied schedule beside a declared commission is refused.
 *
 * Catches an implementation that applies both, which charges the same money
 * twice, and one that silently prefers one of them, which is a rule nobody
 * wrote down and a figure nobody can explain. A commission left at its default
 * of zero is not a second cost model, which is the second half here: a rule
 * that refused every supplied schedule would be unusable.
 */
test('two cost models stated at once are refused', () => {
  const refused = checkSettings(runSettings({ costs: SUPPLIED }), declared(20));
  assert.notEqual(refused, null);
  assert.equal(refused?.code, 'OS6023');
  assert.equal(refused?.span.offset, 0);
  assert.equal(refused?.span.length, 0);
  assert.equal(refused?.span.line, 0);
  assert.equal(refused?.span.column, 0);

  assert.equal(checkSettings(runSettings({ costs: SUPPLIED }), declared(0)), null);
});

/**
 * A tolerance with a bound and no reason is refused.
 *
 * Catches an implementation that takes a tolerance as given: a bound nobody
 * justified is how a conformance comparison stops comparing, and the reason a
 * tolerance exists at all is a second implementation, never this one's own
 * re-run. A bound below zero is refused too, because it admits nothing and
 * refuses what is exact.
 */
test('a tolerance with a bound and no reason is refused', () => {
  for (const tolerance of [
    { abs: 1e-9, rel: 0, reason: null },
    { abs: 0, rel: 1e-9, reason: null },
    { abs: 1e-9, rel: 0, reason: '  ' },
    { abs: -1, rel: 0, reason: 'stated and still nonsense' },
  ]) {
    const refused = checkSettings(runSettings({ tolerance }), declared(0));
    assert.notEqual(refused, null, JSON.stringify(tolerance));
    assert.equal(refused?.code, 'OS6021');
    assert.equal(refused?.span.line, 0);
    assert.equal(refused?.span.column, 0);
  }
});

/**
 * A schedule that cannot be evaluated is refused through the money layer's own
 * rule.
 *
 * The rule for a schedule is written once, where the schedule is. Catches a
 * second copy of it here, which would be the same fact in two files and would
 * drift the first time either was corrected.
 */
test('a schedule that cannot be evaluated is refused', () => {
  const circular: ChargeSchedule = {
    ...SUPPLIED,
    lines: [
      { name: 'levy', base: 'charges', side: 'both', rate: 0.18, min: null, max: null, of: ['brokerage'] },
      { name: 'brokerage', base: 'order', side: 'both', rate: 15, min: null, max: null, of: [] },
    ],
  };
  const refused = checkSettings(runSettings({ costs: circular }), declared(0));
  assert.equal(refused?.code, 'OS6021');
});

/**
 * A refused setting stops the run before a bar executes.
 *
 * Catches a driver that checks the settings after driving the bars, where the
 * refusal arrives having already spent the run, and one that never checks at
 * all, where the report is the figure OS6023 exists to prevent.
 */
test('a run under refused settings produces no record', () => {
  const refused = backtest(inAndOut({ commission: 20 }), BARS, runSettings({ costs: SUPPLIED }));
  assert.equal(refused.ok, false);
  if (refused.ok) return;
  assert.equal(refused.diagnostic.code, 'OS6023');

  const allowed = backtest(inAndOut({ commission: 0 }), BARS, runSettings({ costs: SUPPLIED }));
  assert.equal(allowed.ok, true);
  if (!allowed.ok) return;
  // Two fills at fifteen each, which is the supplied schedule and not the
  // declaration's.
  assert.equal(allowed.record.report.summary.charges, 30);
});

/**
 * A supplied schedule whose slippage replaces a different declared slippage is
 * refused.
 *
 * The venue worsens a fill by one slippage, and when a schedule is supplied it
 * is the schedule's (`drive.ts`). A declaration stating two ticks beside a
 * schedule carrying one was filled at one with nothing said, so the script's
 * own statement of how bad its fills are simply did not happen. Catches an
 * engine that applies the schedule's figure silently, one that applies the
 * declaration's silently, and one that adds the two.
 */
test('a supplied slippage that replaces a different declared slippage is refused', () => {
  const refused = checkSettings(runSettings({ costs: { ...SUPPLIED, slippageTicks: 1 } }), declared(0, 2));
  assert.equal(refused?.code, 'OS6026');
  assert.equal(refused?.span.line, 0);
  assert.equal(refused?.span.column, 0);
  // A schedule that carries no slippage is still a statement that fills cost
  // nothing extra, which is a different number from the declaration's two.
  assert.equal(
    checkSettings(runSettings({ costs: SUPPLIED }), declared(0, 2))?.code,
    'OS6026',
  );
});

/**
 * The same number stated twice is one statement, and a declaration stating
 * none leaves the schedule's to stand.
 *
 * The refusal is about the declared figure being replaced, not about a
 * schedule existing: a rule that refused every schedule beside a declared
 * slippage would leave a host no way to supply the rest of the costs for a
 * script that states its own slippage.
 */
test('a supplied slippage equal to the declared one, or beside none, is carried out', () => {
  assert.equal(checkSettings(runSettings({ costs: { ...SUPPLIED, slippageTicks: 2 } }), declared(0, 2)), null);
  assert.equal(checkSettings(runSettings({ costs: { ...SUPPLIED, slippageTicks: 3 } }), declared(0, 0)), null);
});

/**
 * Two cost models are named before two slippages.
 *
 * Order, which is not arbitrary: a run stating both a commission and a
 * slippage beside a schedule is first of all two cost models, and a reader
 * told only about the slippage would correct it and meet OS6023 next.
 */
test('two cost models are refused before two slippages', () => {
  const refused = checkSettings(runSettings({ costs: SUPPLIED }), declared(20, 2));
  assert.equal(refused?.code, 'OS6023');
});

/** And the refusal stops the run before a bar executes, like every other one. */
test('a run under a replaced slippage produces no record', () => {
  const refused = backtest(
    inAndOut({ slippage: 2 }),
    BARS,
    runSettings({ costs: { ...SUPPLIED, slippageTicks: 1 } }),
  );
  assert.equal(refused.ok, false);
  if (refused.ok) return;
  assert.equal(refused.diagnostic.code, 'OS6026');
});
