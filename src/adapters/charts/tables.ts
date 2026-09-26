/**
 * Declared grids into the chart's summary grid.
 *
 * **A table is written, not plotted.** It is the one output that is not a value
 * per bar: its cells are written by library calls against a handle, into a
 * buffer the engine empties at the start of every execution of a bar
 * (`compiled-program.md` 2.8 and 5.1). What survives is what the last executed
 * bar wrote, which is what a grid pinned to a corner of a pane shows.
 *
 * **So it is read once, after the run, and never per bar.** The obvious way to
 * get this wrong is to collect a grid for every bar of a long history in order
 * to display the last one, which costs the length of the history and throws all
 * of it away. The engine holds one buffer per grid rather than one per bar, and
 * this reads it exactly once per calculation, so a hundred thousand bars cost
 * the same as ten.
 *
 * A script pays the other half of that bill for itself: `cell()` on every bar of
 * a long history does the work of writing a grid that only the last bar's copy
 * is kept from, and the documentation says to guard it with `bar.isLast`. That
 * is a script's decision and not one this can make for it, because the buffer is
 * cleared per bar and an engine cannot know which execution is the last one
 * until it is.
 *
 * **The engine's cells are sparse and the chart's grid is dense.** A script
 * writes the cells it has something to say about; the chart draws rows of cells.
 * So the declared size is filled with blank cells and the written ones are
 * placed into it, which is what `language.md` 6.7 asks for from the other
 * direction: a cell nothing was written into is blank, never a zero.
 *
 * **The language declares as many grids as it likes, and a chart with the list
 * of grids draws them all** (`capabilities.ts` says which chart has it). The
 * list holds each grid under an id the chart keeps it by, and every declared
 * grid is built for it here under its declaration's key. The single `table`
 * hook stays beside the list with the first grid in it, because a chart
 * without the list reads that one. Merging two grids into the single hook
 * would put cells somewhere the script never asked for, so on a chart without
 * the list a program declaring a second grid never reaches this file:
 * `undrawable.ts` refuses it before any bar runs, with OS6024.
 * `spec/chart-narrowings.json` records both halves and
 * `scripts/check-chart-surface.mjs` proves both with a study that declares two.
 */
import type { CompiledProgram, Grid as DeclaredGrid } from '../../core/emit/index.js';
import type { Grid, GridCell } from '../../core/engine/index.js';
import { cssColour, cssOf } from './colours.js';
import { colourField, numberField, stringField } from './fields.js';
import type { InputLookup } from './fields.js';
import type {
  ChartCell,
  ChartCellAlign,
  ChartGrid,
  ChartTablePosition,
  ChartTableSpec,
} from './surfaces.js';

/** The language's four corners, in the chart's own words. */
const CORNERS: Readonly<Record<string, ChartTablePosition>> = {
  topLeft: 'top-left',
  topRight: 'top-right',
  bottomLeft: 'bottom-left',
  bottomRight: 'bottom-right',
};

const ALIGNMENTS: readonly string[] = ['left', 'center', 'right'];

/**
 * Every grid a chart draws, from the declarations and the engine's buffers.
 *
 * Each buffer is paired with its declaration by the key both of them carry
 * rather than by position. The engine reads its grids in declaration order, so
 * the two agree today, and a pairing by position is one reordering away from
 * drawing one grid's cells into another grid's shape, which would be a wrong
 * table that looks like a right one.
 *
 * The key is the id as well. The compiler writes one per declaration and never
 * an empty one, and it does not move between recomputes, which is what lets the
 * chart keep a grid rather than build it again on every tick.
 */
export function buildTables(
  program: CompiledProgram,
  lookup: InputLookup,
  written: readonly Grid[],
): readonly ChartTableSpec[] {
  return program.outputs.tables.map((declared) => ({
    id: declared.key,
    ...oneTable(declared, lookup, written.find((one) => one.key === declared.key)),
  }));
}

/** The first grid alone, for the single hook a chart without the list reads. */
export function firstGrid(tables: readonly ChartTableSpec[]): ChartGrid | null {
  const first = tables[0];
  if (first === undefined) return null;
  return { rows: first.rows, ...(first.options === undefined ? {} : { options: first.options }) };
}

function oneTable(
  declared: DeclaredGrid,
  lookup: InputLookup,
  written: Grid | undefined,
): ChartGrid {
  const position = stringField(declared.position, lookup, 'topRight');
  const textColour = colourField(declared.options.textColor, lookup);
  const bgColour = colourField(declared.options.bgColor, lookup);
  const rows = whole(numberField(declared.rows, lookup, 0));
  const cols = whole(numberField(declared.cols, lookup, 0));
  const fallback = textColour === undefined ? undefined : cssColour(textColour);

  const grid: ChartCell[][] = [];
  for (let row = 0; row < rows; row += 1) {
    grid.push(new Array<ChartCell>(cols).fill({ text: '' }));
  }
  for (const cell of written?.cells ?? []) {
    const built = oneCell(cell, fallback);
    const line = grid[cell.row];
    if (built === undefined || line === undefined || cell.col >= cols) continue;
    line[cell.col] = built;
  }

  return {
    rows: grid,
    options: {
      position: CORNERS[position] ?? 'top-right',
      borderWidth: numberField(declared.options.borderWidth, lookup, 0),
      ...(bgColour === undefined ? {} : { background: cssColour(bgColour) }),
      ...(cols > 0 ? { cellWidth: columnWidths(grid, cols) } : {}),
      // The chart measures the text it is about to draw and shrinks it to fit,
      // which is the half of this that cannot be done from here.
      fontSize: 'auto',
    },
  };
}

/**
 * How wide each column has to be, in media pixels.
 *
 * The chart's default is one width for every column, chosen without seeing the
 * text, and a grid whose header says "Moving averages" over cells saying
 * "RSI: 27.22" has one column bleeding into the next. Nothing downstream can
 * choose better, because by the time the chart has the grid it has lost which
 * cells belong together; and nothing upstream can, because the script declares
 * a size and writes text, not a layout.
 *
 * **This is an estimate, and it is allowed to be.** A real width needs the font
 * the chart will draw with, and only the chart has it. So the width is counted
 * off the characters and the chart's own `fontSize: 'auto'` corrects whatever
 * this gets wrong: too narrow and the type shrinks a little, too wide and the
 * column is a little loose. Either is a table that reads. The failure this
 * replaces was neither.
 *
 * Delete it when the chart can size a column from its own measurements. It
 * exists because that is not a thing it can be asked to do yet.
 */
function columnWidths(grid: readonly (readonly ChartCell[])[], cols: number): number[] {
  const widths: number[] = [];
  for (let col = 0; col < cols; col += 1) {
    let widest = 0;
    for (const row of grid) {
      const text = row[col]?.text ?? '';
      if (text.length > 0) widest = Math.max(widest, textWidth(text));
    }
    widths.push(Math.min(MAX_COLUMN, Math.max(MIN_COLUMN, Math.ceil(widest) + CELL_PADDING * 2)));
  }
  return widths;
}

/**
 * Roughly how wide a string is at the type size the chart starts from.
 *
 * Counted rather than measured, and counted in two weights rather than one: a
 * column of "Histogram: -7.01" is half punctuation and narrow digits, and
 * treating every character as an em-and-a-bit makes that column half again as
 * wide as it needs to be while "Moving averages" stays too narrow. Two weights
 * is not typography, but it is enough to tell those two apart.
 */
function textWidth(text: string): number {
  let width = 0;
  for (const character of text) {
    width += NARROW.has(character) ? BASE_SIZE * NARROW_EM : BASE_SIZE * WIDE_EM;
  }
  return width;
}

/** The characters that take noticeably less than an average advance. */
const NARROW = new Set([...' .,:;!|ijlt1IJfr()[]{}-']);

/**
 * The type size the widths are counted at.
 *
 * The chart's own default row is 18 media pixels and it draws at 62% of the
 * row, so this is the size a cell gets before anything shrinks it. Counting at
 * a larger size would reserve room the text never uses.
 */
const BASE_SIZE = 11;
const NARROW_EM = 0.32;
const WIDE_EM = 0.56;

/** What the chart insets a cell's text by, on each side. */
const CELL_PADDING = 4;

/**
 * The narrowest a column is drawn.
 *
 * A column of one-character cells sized to its content is a sliver, and a grid
 * of slivers reads as a rendering fault rather than as a narrow column.
 */
const MIN_COLUMN = 56;

/**
 * The widest a column is drawn.
 *
 * A cell holding a sentence would otherwise push the grid past the pane it is
 * pinned inside, taking the chart with it. Past this the type shrinks instead,
 * which is the chart's job and it is better at it.
 */
const MAX_COLUMN = 220;

/**
 * One written cell, or none.
 *
 * A cell whose text is absent is dropped rather than drawn, which leaves the
 * blank cell that was already in its place: absence reaching a drawing surface
 * is a gap, and a blank cell is what a grid draws where nothing was written
 * (`language.md` 6.7).
 *
 * The grid's own text colour is written into each cell that named none, because
 * the chart carries a text colour per cell and the language declares one for the
 * whole grid as well.
 */
function oneCell(cell: GridCell, fallback: string | undefined): ChartCell | undefined {
  if (typeof cell.text !== 'string') return undefined;
  const align = typeof cell.align === 'string' && ALIGNMENTS.includes(cell.align)
    ? (cell.align as ChartCellAlign)
    : 'left';
  const textColour = cssOf(cell.textColor) ?? fallback;
  const bgColour = cssOf(cell.bgColor);
  return {
    text: cell.text,
    ...(textColour === undefined ? {} : { textColor: textColour }),
    ...(bgColour === undefined ? {} : { bgColor: bgColour }),
    align,
  };
}

/** A declared size, as a count of rows or columns a grid can be built with. */
function whole(size: number): number {
  return size > 0 ? Math.floor(size) : 0;
}
