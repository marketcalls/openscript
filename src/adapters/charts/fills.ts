/**
 * Declared bands into the chart's shaded bands.
 *
 * A band is two plot keys and two colours, which is the chart's own spec, so the
 * pair of keys crosses unchanged. Three details do not.
 *
 * **Opacity is a dimmer, not a second alpha.** A colour carries its own alpha
 * everywhere in the language, and the band's `opacity` multiplies whatever the
 * colours already are. That is exactly what the chart does with the field, to a
 * colour computed per bar as much as to a constant one, so a script that never
 * touches it gets the colour it wrote.
 *
 * **A band with no colour of its own follows the first plot.** `stdlib.md` 14.2
 * says such a band is that plot's colour faded to twelve percent, and the plot's
 * colour may be one the host picked from its palette rather than one the script
 * wrote, so the band is pointed at the plot's settings key rather than at a value
 * read now. The twelve percent is then the dimmer, multiplied by whatever the
 * script asked for. A band whose colour is computed per bar has a colour of its
 * own, so neither applies to it.
 *
 * **A colour computed per bar travels as columns and is read back per bar.**
 * It arrives on a channel, rides the values table as the two columns
 * `columns.ts` describes, and the band's colour callback reads them on each bar
 * for the side the band is on there. The side is decided the way the chart
 * decides it, the first plot at or above the second, so the colour answered is
 * the colour of the run the chart is drawing that bar in. An absent colour is a
 * transparent one rather than no answer, because no answer hands the bar to
 * the band's colour for that side, and `docs/visuals/fills.md` teaches an absent
 * colour as how a band switches itself off. The callback exists only on a chart
 * that reads it (`capabilities.ts`); on any other, `undrawable.ts` has refused
 * the program before this is drawn.
 */
import type { Band, CompiledProgram } from '../../core/emit/index.js';
import type { ChartCapabilities } from './capabilities.js';
import { cssColour } from './colours.js';
import { bandColourKey, colourAt, colourColumns } from './columns.js';
import type { ColumnSpec } from './columns.js';
import type { ChartFill, ChartFillContext } from './contract.js';
import { boolField, colourField, isReference, numberField } from './fields.js';
import type { InputLookup } from './fields.js';

/**
 * The fade a band with no declared colour is drawn at, `stdlib.md` 14.2.
 *
 * It is written here because the adapter has to multiply it by the script's own
 * opacity, and a chart applies its own default only where the field is absent.
 */
const UNCOLOURED_FADE = 0.12;

/** What a bar whose computed colour is absent is painted in: nothing. */
const UNPAINTED = 'rgba(0, 0, 0, 0)';

export interface FillsBuild {
  readonly fills: readonly ChartFill[];
  /** The colour columns the bands' callbacks read, for the values table. */
  readonly columns: readonly ColumnSpec[];
}

export function buildFills(
  program: CompiledProgram,
  lookup: InputLookup,
  chart: ChartCapabilities,
): FillsBuild {
  const fills: ChartFill[] = [];
  const columns: ColumnSpec[] = [];
  program.outputs.fills.forEach((band, index) => {
    const perBar = chart.bandColours ? perBarColours(band, index) : undefined;
    if (perBar !== undefined) columns.push(...perBar.columns);
    fills.push(oneBand(program, band, lookup, perBar));
  });
  return { fills, columns };
}

/** The keys a band's two computed colours travel under, and their columns. */
interface PerBar {
  readonly up: string | undefined;
  readonly down: string | undefined;
  readonly columns: readonly ColumnSpec[];
}

/**
 * The columns a band's computed colours need, or nothing for a band with none.
 *
 * `color = ...` computed per bar writes one channel into both sides, and that
 * channel travels once rather than twice.
 */
function perBarColours(band: Band, index: number): PerBar | undefined {
  const upChannel = band.colorUpChannel;
  const downChannel = band.colorDownChannel;
  if (upChannel === null && downChannel === null) return undefined;
  const up = upChannel === null ? undefined : bandColourKey(index, 'up');
  const shared = downChannel !== null && downChannel === upChannel;
  const down = downChannel === null ? undefined : shared ? up : bandColourKey(index, 'down');
  const columns: ColumnSpec[] = [];
  if (up !== undefined && upChannel !== null) columns.push(...colourColumns(up, upChannel));
  if (down !== undefined && downChannel !== null && !shared) columns.push(...colourColumns(down, downChannel));
  return { up, down, columns };
}

function oneBand(
  program: CompiledProgram,
  band: Band,
  lookup: InputLookup,
  perBar: PerBar | undefined,
): ChartFill {
  const up = colourField(band.colorUp, lookup);
  const down = colourField(band.colorDown, lookup);
  const overlay = boolField(band.overlay, lookup);
  const computed = band.colorUpChannel !== null || band.colorDownChannel !== null;
  const declared = up !== undefined || down !== undefined || computed;
  const opacity = numberField(band.opacity, lookup, 1) * (declared ? 1 : UNCOLOURED_FADE);
  const follow = declared ? undefined : plotColourKey(program, band.between[0]);

  return {
    between: band.between,
    ...(up === undefined ? {} : { colorUp: cssColour(up) }),
    ...(down === undefined ? {} : { colorDown: cssColour(down) }),
    ...(isReference(band.colorUp) ? { colorUpKey: band.colorUp.input } : {}),
    ...(isReference(band.colorDown) ? { colorDownKey: band.colorDown.input } : {}),
    ...(follow === undefined ? {} : { colorUpKey: follow, colorDownKey: follow }),
    opacity,
    ...(overlay === undefined ? {} : { overlay }),
    ...(perBar === undefined ? {} : { colorBy: colourBy(perBar) }),
  };
}

/**
 * The band's colour on one bar: the computed colour for the side it is on.
 *
 * Nothing where either column is absent, which is a bar the chart does not
 * draw, and nothing where that side's colour is not computed, which leaves the
 * chart the band's own colour for the side.
 */
function colourBy(perBar: PerBar): (ctx: ChartFillContext) => string | undefined {
  return (ctx: ChartFillContext): string | undefined => {
    if (typeof ctx.a !== 'number' || typeof ctx.b !== 'number') return undefined;
    const key = ctx.a >= ctx.b ? perBar.up : perBar.down;
    if (key === undefined) return undefined;
    return colourAt(ctx.values, ctx.index, key) ?? UNPAINTED;
  };
}

/**
 * The settings key holding a plot's colour.
 *
 * A chart generates one appearance row per plot and names it after the plot,
 * except where the plot declares a colour key of its own, which is what a plot
 * whose colour came from an `input()` does. The two cases are the same two this
 * adapter produces in `plots.ts`.
 */
function plotColourKey(program: CompiledProgram, key: string): string {
  const plot = program.outputs.plots.find((one) => one.key === key);
  if (plot !== undefined && isReference(plot.color)) return plot.color.input;
  return `${key}:color`;
}
