/**
 * What one calculation produced that no column of numbers can carry.
 *
 * A chart's calculation returns a table of numbers, and five of the things a
 * study emits are not numbers: a marker's text, a cell's text, a drawing's
 * caption, a drawing's geometry and an alert's message. The chart reads each of
 * those from its own hook, and **those hooks are handed the run rather than the
 * study**: the bars, the table the calculation just returned, and the settings
 * it was run with. There is no per-instance store among them, so there is
 * nowhere for the calculation to leave the answer and nowhere for the hook to
 * pick it up.
 *
 * This is that place, and it is deliberately the only one. An alert's message
 * was thought to have no way across for exactly the reason above, and was
 * dropped for the life of this adapter: the entry carried the declared title
 * and every notification a user received was the same sentence, whatever the
 * script had computed from the bar that fired. The alert's own context carries
 * the settings, so it reaches this record like every other hook.
 *
 * **The settings object is the instance.** A chart resolves one settings object
 * per study instance and hands the same object to the calculation and to every
 * hook that follows it, so its identity is what tells three moving averages of
 * one script apart. A map keyed on it therefore holds one record per instance,
 * and holds it only while the chart still holds the settings: the map is weak,
 * so an instance the chart has dropped takes its record with it and nothing
 * here has to be told about removal.
 *
 * **A hook that finds no record draws nothing.** That is the honest answer to a
 * hook called before any calculation has run, and it is a gap rather than
 * somebody else's markers, which is what a single latched record would give on
 * a chart holding two studies.
 */
import type { Value } from '../../core/engine/index.js';
import type { ChartSettings } from './contract.js';
import type { ChartDrawing, ChartMarker, ChartTableSpec } from './surfaces.js';

/**
 * One declared alert's message channel, whole, as the run left it.
 *
 * It is the engine's own column and not a copy of it. A message is a string per
 * bar and the alert that carries it fires on a handful of bars out of a hundred
 * thousand, so building a second column here would cost the length of the
 * history to answer a question about one bar.
 */
export type MessageColumn = readonly Value[];

/** One run's non-numeric output, as the hooks that follow it read it. */
export interface Produced {
  readonly markers: readonly ChartMarker[];
  /** Every declared grid, in declaration order; the single hook reads the first. */
  readonly tables: readonly ChartTableSpec[];
  readonly drawings: readonly ChartDrawing[];
  /** One entry per declared alert, in the order `outputs.alerts` declares them. */
  readonly messages: readonly MessageColumn[];
}

const NOTHING: Produced = { markers: [], tables: [], drawings: [], messages: [] };

const runs = new WeakMap<ChartSettings, Produced>();

/** What the calculation just produced, against the settings it was run with. */
export function remember(settings: ChartSettings, produced: Produced): void {
  runs.set(settings, produced);
}

/** What the last calculation for this instance produced, or nothing. */
export function producedFor(settings: ChartSettings): Produced {
  return runs.get(settings) ?? NOTHING;
}
