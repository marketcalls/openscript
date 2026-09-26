/**
 * What this chart cannot draw of what a program declares, refused before a bar.
 *
 * `compiled-program.md` section 11: a host draws what its surface has room for,
 * and refuses what it does not with OS6024 rather than drawing part of a study
 * and saying nothing. Two things a version 1 program can declare have a place
 * on a newer chart and none on an older one (`capabilities.ts` says which is
 * which), and on an older one both used to be dropped in silence.
 *
 * - **A second grid.** An older descriptor has one `table` hook, so one grid
 *   reaches a pane. Merging two into it would put cells somewhere the script
 *   never asked for, and drawing the first alone is a study whose second panel
 *   never appears and whose cells look broken. A newer chart's list of grids
 *   carries every one (`tables.ts`).
 * - **A band colour computed per bar.** An older chart's band takes one colour
 *   for each side for the whole run, and a band whose colour the script
 *   computes would be drawn in a colour the script did not choose. A newer
 *   chart's band has a per-bar colour callback (`fills.ts`).
 *
 * Which chart the descriptor is registered with is what the host states, and
 * `capabilities.ts` reads it. A host that states nothing is refused both, as
 * before, because a chart that ignores a hook it does not know draws the
 * silent version of each.
 *
 * The compiled program carries no source position for a declaration, so the
 * refusal names the declaration by its title, which is what a reader sees in
 * the legend and the settings dialog, and its span is the load's own.
 */
import { diagnosticFor, makeSpan } from '../../core/index.js';
import type { Diagnostic } from '../../core/index.js';
import type { CompiledProgram, Field } from '../../core/emit/index.js';
import { lacking } from './capabilities.js';
import type { ChartCapabilities } from './capabilities.js';

/** A load refusal has no line of its own: the program is what was refused. */
const AT_LOAD = makeSpan(0, 0, 0, 0);

export function undrawable(program: CompiledProgram, chart: ChartCapabilities): Diagnostic | undefined {
  const second = program.outputs.tables[1];
  if (second !== undefined && !chart.grids) {
    return diagnosticFor('OS6024', AT_LOAD, {
      what: `the table ${titled(second.title, 'after the first')}, the second grid this study declares`,
      limit: lacking(chart, 'grids', 'a chart pane draws one grid'),
    });
  }
  if (chart.bandColours) return undefined;
  for (const band of program.outputs.fills) {
    if (band.colorUpChannel !== null || band.colorDownChannel !== null) {
      return diagnosticFor('OS6024', AT_LOAD, {
        what: "a band's colour that is computed per bar",
        limit: lacking(chart, 'bandColours', "a chart's band takes one colour for the whole run"),
      });
    }
  }
  return undefined;
}

/** A title as a reader sees it, or a description where it is a setting's. */
function titled(title: Field, otherwise: string): string {
  return typeof title === 'string' ? `"${title}"` : otherwise;
}
