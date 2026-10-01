/**
 * The backtest: a program, some bars, and a record of what happened.
 *
 * **A run produces a record, and the record is the product.** Not a number
 * printed at the end and not a chart: a document that carries the program, the
 * bars, the settings the host chose, every frame the destination answered,
 * every fill the engine folded, the ledger at the end and the report. A second
 * engine is handed that document as a conformance case, and this engine is
 * handed it again months later to prove that an upgrade did not change a result.
 *
 * **The cost model lives in this module and not in the engine.** `stdlib.md`
 * 17.1 puts slippage and commission on the destination, and the engine folds the
 * price it is told; a backtest is a destination, so this is where a price is
 * worsened by a tick and a fill is charged. The engine never adjusts a price and
 * this module never folds one.
 *
 * `backtest` drives one against a simulated destination and `backtestSupplied`
 * drives one over frames somebody else supplied, which is what `conformance.md`
 * section 3 asks of an engine running a case. `replay` folds a stored one's
 * money again from its own fills, and `rerun` executes a stored one again and
 * is held to producing the same bytes. `recordToJson` and `recordFromJson` are
 * the document itself. `compareRuns` puts two records beside each other and
 * says whether the gap between them clears the noise. `caseFilesFrom` turns a
 * record into the files of a conformance case, returning text and writing
 * nothing because core does no I/O. It needed three channels the record did not
 * carry. `conformance.md` section 2 requires a case to hold `script.os`, the
 * source text, and a record carried only the source's hash, its line count and
 * its file name: record version 2 carries the text, checked against that hash.
 * The same section says `instrument.json` is the record of `host-interface.md`
 * 4.1, and a record carried the money layer's contract, which holds six of its
 * twelve facts: record version 3 carries the record the engine was handed,
 * whole. And a case is handed frames, which `stdlib.md` 17.7 folds one ledger
 * field from an instant of: a record carried a frame without the instant it
 * arrived at, so a case projected from it asserted a field its own input could
 * not reproduce. Record version 4 carries a frame's time.
 */
export { backtest, backtestSupplied } from './drive.js';
export type { BacktestResult, DriveOptions, InstrumentFacts } from './drive.js';
export type { LogLine } from './walk.js';
export type { Surface } from './drive.js';
export { declarationOf } from './declaration.js';
export type { RunDeclaration } from './declaration.js';
export { marksFor, windowFor } from './range.js';
export type { ReportWindow, WindowResult } from './range.js';
export { replay, rerun } from './replay.js';
export type { ReplayResult } from './replay.js';
export { testResting } from './resting.js';
export type { RestOutcome, RestingOrder } from './resting.js';
export { Simulator } from './simulate.js';
export type { SimulatorOptions } from './simulate.js';
export type { VenueAct, VenueDoes, VenuePolicy } from './acts.js';
export { DEFAULT_FILL, EXACT, WHOLE_RANGE, checkSettings, settingsFor } from './settings.js';
export { caseFilesFrom } from './case.js';
export type { CaseFiles, CaseIdentity, CaseResult } from './case.js';
export { RECORD_VERSION, barsHash, recordFromJson, recordOf, recordToJson, runBytes } from './record.js';
export type { RecordParts } from './record.js';
export type { BacktestSettings, DateRange, FillPolicy, Tolerance } from './settings.js';
export type {
  BarsInRecord,
  RecordedBar,
  RecordedDiagnostic,
  RecordedFrame,
  RecordedOrder,
  RunRecord,
} from './record.js';
export { compareRuns } from './compare.js';
export type { RunComparison } from './compare.js';
