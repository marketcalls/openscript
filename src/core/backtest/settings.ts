/**
 * What the host chose, which is the half of a run that is not the program.
 *
 * **The dividing rule, and everything in this module follows from it: the
 * record stores what the host chose, and what the program states is stored
 * once, as the program.** So there is no capital here, no slippage and no
 * commission: the declaration states those and the declaration is in the
 * record. A charge schedule the host supplied is here because the host supplied
 * it; a schedule derived from the declaration is derived again on replay.
 *
 * **The fill policy carries its own version** precisely so that a record made
 * before the policy changed replays as it ran, rather than being quietly re-run
 * under today's rules and reported as the same study. A policy that could not
 * say which revision it was would make every stored run a claim about whichever
 * engine happened to read it last.
 *
 * `fillOn` is deliberately not here: it is the declaration's, and the
 * declaration is the program.
 *
 * Three refusals live in this module. A setting the run cannot be carried out
 * under is OS6021, a supplied schedule beside a declared commission that is not
 * the default is OS6023, because two cost models stated at once is a number
 * nobody can explain afterwards, and a supplied schedule whose slippage differs
 * from a declared one is OS6026, for the same reason.
 */
import { scheduleFromDeclaration, scheduleProblem } from '../accounting/index.js';
import type { ChargeSchedule, Contract } from '../accounting/index.js';
import { diagnosticFor } from '../diagnostics/index.js';
import type { Diagnostic } from '../diagnostics/index.js';
import type { Value } from '../engine/index.js';
import type { RunDeclaration } from './declaration.js';

/**
 * Where a refusal about a setting points.
 *
 * Nowhere in the script. A run setting is what the host stated before the first
 * bar, and a caret under a line of the strategy would blame the one party that
 * did not choose it. The money layer states the same position for the same
 * reason.
 */
const NO_POSITION: Diagnostic['span'] = { offset: 0, length: 0, line: 0, column: 0 };

/** The window of the supplied bars a report is about. */
export interface DateRange {
  /** Inclusive, UTC ms; null means the first bar supplied. */
  readonly from: number | null;
  /** Inclusive; null means the last. */
  readonly to: number | null;
}

/** How a resting order is decided against a bar, and who holds a level. */
export interface FillPolicy {
  /** A limit fills only when the bar traded through it. */
  readonly limitNeedsThrough: boolean;
  readonly stopFillsAtOpenOnGap: boolean;
  /** Who holds a bracket's levels; 'destination' until 17.9 exists. */
  readonly levels: 'destination' | 'engine';
  /** This policy's own revision, so an old record replays as it ran. */
  readonly version: number;
}

/**
 * How closely two numbers have to agree, and why they are allowed not to.
 *
 * Exact by default. A bound that is not zero without a reason beside it is
 * refused, because a tolerance with no reason is a failed comparison somebody
 * turned off. The reason a tolerance exists at all is a second implementation,
 * never this one's own re-run: a rerun of the same record on this engine is
 * bit-identical or it is a defect.
 */
export interface Tolerance {
  readonly abs: number;
  readonly rel: number;
  /** Required whenever either bound is non-zero. */
  readonly reason: string | null;
}

/** Everything the host decided about one run. */
export interface BacktestSettings {
  readonly range: DateRange;
  readonly contract: Contract;
  /** Null derives one from the declaration. */
  readonly costs: ChargeSchedule | null;
  readonly fill: FillPolicy;
  readonly inputs: Readonly<Record<string, Value>>;
  readonly now: number | null;
  readonly tolerance: Tolerance;
}

/**
 * How a resting order is decided when the host states nothing.
 *
 * Conservative on both counts, because a backtest that is wrong is wrong in the
 * strategy's favour by default: a limit is only filled where the bar traded
 * through it, so an order resting exactly at the extreme of a bar is not
 * credited with a fill nobody can prove happened, and a stop that gapped is
 * filled at the open rather than at its trigger, which is the price a trader
 * would actually have been given.
 *
 * `levels` is `destination` because there is nowhere else for it to be: a
 * bracket reaches a destination as a protective instruction attached to a tag
 * and the engine holds no level of its own. The other spelling exists so that a
 * record made today says which of the two it ran under.
 *
 * `version` is this policy's own revision. It travels in the record so that a
 * run stored before the rules changed replays as it ran rather than being
 * quietly re-decided under today's.
 */
export const DEFAULT_FILL: FillPolicy = {
  limitNeedsThrough: true,
  stopFillsAtOpenOnGap: true,
  levels: 'destination',
  version: 1,
};

/** Exact, which is what a comparison is until somebody writes down why it is not. */
export const EXACT: Tolerance = { abs: 0, rel: 0, reason: null };

/** The whole window of whatever bars were supplied. */
export const WHOLE_RANGE: DateRange = { from: null, to: null };

/**
 * The settings a run takes when the host states only the contract.
 *
 * Every default here is the absence of a choice rather than a choice made on
 * the host's behalf: the whole of the bars supplied, no schedule, exact
 * comparison, no inputs overridden and no clock. A host that wants any of it
 * different says so, and what it said is what the record stores.
 *
 * **The contract is the first argument and cannot be in the second.** The
 * second was `Partial<BacktestSettings>`, which names a `contract` field that
 * this function then ignored in favour of the positional one: a caller passing
 * a contract there silently got the other, and a test written that way passed
 * while proving nothing. Excluding the field makes it a compiler error at the
 * call rather than a wrong answer at the end of a run.
 */
export function settingsFor(
  contract: Contract,
  chosen: Omit<Partial<BacktestSettings>, 'contract'> = {},
): BacktestSettings {
  return {
    range: chosen.range ?? WHOLE_RANGE,
    contract,
    costs: chosen.costs ?? null,
    fill: chosen.fill ?? DEFAULT_FILL,
    inputs: chosen.inputs ?? {},
    now: chosen.now ?? null,
    tolerance: chosen.tolerance ?? EXACT,
  };
}

/**
 * What a run cannot be carried out under, before its first bar.
 *
 * Five questions, and every one of them is a figure nobody could explain
 * afterwards rather than a tidiness rule:
 *
 * - **Two cost models at once**, OS6023. A supplied schedule and a declared
 *   commission describe the same money. Applied together they charge it twice
 *   and applied one at a time they charge whichever an engine preferred, which
 *   is a rule nobody wrote down.
 * - **Two slippages at once**, OS6026. The venue applies the schedule's
 *   slippage where a schedule is supplied, so a declared slippage that differs
 *   from it was dropped with nothing said. Asked after OS6023, because a run
 *   stating both a commission and a slippage beside a schedule is first of all
 *   two cost models.
 * - **A schedule that cannot be evaluated**, OS6021, which `scheduleProblem`
 *   decides, because the schedule is the money layer's and the rule for it is
 *   written once, there. **Whichever schedule the run will be charged under**,
 *   which is the declaration's own when the host supplied none: asking only
 *   about a supplied one left every refusal in the money layer unreachable on
 *   the path almost every run takes.
 * - **A quantity in a unit this destination cannot fill**, OS6021. A backtest
 *   fills in units and works out no running equity, so a quantity in cash or in
 *   a percentage of equity is one it cannot convert, and a lot needs a lot size
 *   the instrument may not state.
 * - **A tolerance with a bound and no reason**, OS6021. A comparison allowed to
 *   pass by a margin nobody justified is a failed comparison somebody switched
 *   off, and the reason a tolerance exists at all is a second implementation:
 *   a rerun of one record on this engine is bit-identical or it is a defect.
 *
 * Nothing has been computed when this is asked, so a refusal costs one run
 * rather than a report a reader has to be told to distrust.
 */
export function checkSettings(
  settings: BacktestSettings,
  declared: RunDeclaration,
): Diagnostic | null {
  if (settings.costs !== null && declared.isStrategy && declared.commission !== 0) {
    return diagnosticFor('OS6023', NO_POSITION, {
      commission: declared.commission,
      commissionType: declared.commissionType,
    });
  }

  // The venue worsens a fill by the schedule's slippage where one is supplied,
  // so a declared slippage that differs from it would simply not happen. The
  // same figure in both is one statement, and a declaration stating none
  // leaves the schedule's to stand.
  if (
    settings.costs !== null &&
    declared.isStrategy &&
    declared.slippage !== 0 &&
    settings.costs.slippageTicks !== declared.slippage
  ) {
    return diagnosticFor('OS6026', NO_POSITION, {
      supplied: settings.costs.slippageTicks,
      declared: declared.slippage,
    });
  }

  // Whichever schedule the run will actually be charged under, which is the
  // declaration's own when the host supplied none. Guarding this on
  // `settings.costs !== null` left every refusal in the money layer unreachable
  // on the default path: a declared commission of -5 was charged as a credit
  // and turned a loss into a gain, with nothing raised anywhere.
  const schedule = settings.costs ?? scheduleForDeclaration(declared, settings.contract);
  if (schedule !== null) {
    const problem = scheduleProblem(schedule, settings.contract);
    if (problem !== null) return problem;
  }

  const sizing = sizingProblem(declared, settings.contract);
  if (sizing !== null) return sizing;

  return toleranceProblem(settings.tolerance);
}

/** The schedule a run with no host schedule is charged under, or none. */
function scheduleForDeclaration(
  declared: RunDeclaration,
  contract: Contract,
): ChargeSchedule | null {
  if (!declared.isStrategy) return null;
  return scheduleFromDeclaration(
    declared.commission,
    declared.commissionType,
    declared.slippage,
    contract.currency,
    contract.digits,
  );
}

/**
 * Whether this destination can fill the unit the strategy sizes in.
 *
 * **A quantity is stated in the declaration's own unit and the destination is
 * the party that converts it** (`host-interface.md` 7.1). This one filled every
 * order at the number the script wrote, whatever unit it was written in, so a
 * strategy sizing in lots on a lot of sixty five traded one sixty fifth of what
 * it asked for and every money figure in the record was out by that factor,
 * with nothing refused and nothing said. A record like that is worse than a
 * refused run twice over: somebody trades on the number, and a second engine is
 * handed it as a conformance case and taught the wrong quantity.
 *
 * So: units and lots are converted, and the two that need a running equity this
 * destination does not hold are refused by name. A refusal costs one run. The
 * alternative cost a whole report that looked right.
 */
function sizingProblem(declared: RunDeclaration, contract: Contract): Diagnostic | null {
  if (!declared.isStrategy) return null;
  if (declared.qtyType === 'units' || declared.qtyType === '') return null;
  if (declared.qtyType === 'lots') {
    if (contract.lotSize !== null && contract.lotSize > 0) return null;
    return diagnosticFor('OS6021', NO_POSITION, {
      setting: 'A quantity stated in lots',
      problem:
        'this instrument states no lot size, so there is nothing to convert a lot into',
    });
  }
  return diagnosticFor('OS6021', NO_POSITION, {
    setting: 'A quantity stated in ' + declared.qtyType,
    problem:
      'a backtest fills in units and works out no running equity to size against, so it ' +
      'cannot convert one. State the quantity in units or in lots',
  });
}

/**
 * A bound, and the reason it is there.
 *
 * Both bounds are checked rather than the first one found, because a tolerance
 * carrying two bounds and one reason is two allowances and one justification.
 */
function toleranceProblem(tolerance: Tolerance): Diagnostic | null {
  const stated = tolerance.reason !== null && tolerance.reason.trim() !== '';
  const bounded = tolerance.abs !== 0 || tolerance.rel !== 0;
  if (bounded && !stated) {
    return diagnosticFor('OS6021', NO_POSITION, {
      setting: 'The comparison tolerance',
      problem: 'a bound of ' + String(tolerance.abs) + ' absolute and ' + String(tolerance.rel) +
        ' relative is stated with no reason beside it',
    });
  }
  if (tolerance.abs < 0 || tolerance.rel < 0) {
    return diagnosticFor('OS6021', NO_POSITION, {
      setting: 'The comparison tolerance',
      problem: 'a bound below zero admits nothing and refuses what is exact',
    });
  }
  return null;
}
