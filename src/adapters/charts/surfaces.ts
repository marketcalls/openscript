/**
 * The four surfaces that are not columns of numbers, as the chart declares them.
 *
 * A plot, a band and a level all reduce to one number per bar, so they ride the
 * table a calculation returns. A marker, a grid, a drawing object and a watched
 * condition do not: three of them carry text and the fourth carries geometry, and
 * a chart reads each of them from its own hook on the descriptor rather than from
 * the table. Their shapes are declared here, away from the calculation's, because
 * they are read at a different moment and by a different part of the chart.
 *
 * **Every hook takes the run it is reading and not a handle to the study.** The
 * argument is the bars, the table the calculation just returned and the settings
 * it was run with, and there is no per-instance store among them. What travels
 * through a hook is therefore what those three can carry, and what cannot is
 * written down in `produced.ts`, which is the one place this adapter solves that
 * problem.
 *
 * **Every member here is narrowed to what this adapter emits.** The chart draws
 * more shapes, more marker positions and more grid options than the language has
 * words for, and a value the language cannot express is better left out of this
 * file than declared and never written. A narrower type stays assignable to the
 * chart's wider one, which is what the one line in `contract.ts` checks.
 */
import type { ChartBar, ChartLineStyle, ChartSettings, ChartValues } from './contract.js';

/** What every hook below is handed: the run whose output it is reading. */
export interface ChartSurfaceContext {
  readonly bars: readonly ChartBar[];
  readonly values: ChartValues;
  readonly settings: ChartSettings;
}

/**
 * Where a marker sits against its bar.
 *
 * The language has three (`stdlib.md` 14.3) and the chart has six. `"above"` and
 * `"below"` are the chart's own two, and `"price"` becomes the in-bar position:
 * the language names no price to put the marker at, and a marker drawn at the
 * close would be this adapter deciding which price `"price"` meant.
 */
export type ChartMarkerPosition = 'aboveBar' | 'belowBar' | 'inBar';

/**
 * The mark itself.
 *
 * Nine of the language's ten shapes are one of the chart's own under the same
 * name. The tenth, `"label"`, is a plate of text with a tail that points at the
 * anchor, so which of the chart's two plates it is follows from where the marker
 * sits rather than from the word: a plate above the bar has its tail pointing
 * down at it.
 */
export type ChartMarkerShape =
  | 'arrowUp'
  | 'arrowDown'
  | 'triangleUp'
  | 'triangleDown'
  | 'circle'
  | 'square'
  | 'diamond'
  | 'cross'
  | 'flag'
  | 'labelUp'
  | 'labelDown'
  | 'text';

/** The four glyph sizes a chart draws a marker at. */
export type ChartMarkerSize = 'tiny' | 'small' | 'medium' | 'big';

/** One marker on one bar: a discrete event with a label, not a column. */
export interface ChartMarker {
  /** The bar's time, in the seconds a chart holds. */
  readonly time: number;
  readonly position: ChartMarkerPosition;
  readonly shape: ChartMarkerShape;
  readonly size: ChartMarkerSize;
  readonly color: string;
  readonly text?: string;
}

export type ChartCellAlign = 'left' | 'center' | 'right';

/** One cell of a grid, as the last executed bar left it. */
export interface ChartCell {
  readonly text: string;
  readonly textColor?: string;
  readonly bgColor?: string;
  readonly align?: ChartCellAlign;
}

/** Which corner of the pane a grid is pinned to. */
export type ChartTablePosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

/** The grid options this adapter sets. A chart's own defaults fill the rest. */
export interface ChartTableOptions {
  readonly position: ChartTablePosition;
  readonly borderWidth: number;
  /** The backdrop behind the whole grid, which is the grid's own `bgColor`. */
  readonly background?: string;
  /**
   * Column widths in media pixels, one per column.
   *
   * The chart's own default is one flat width for every column, which is a
   * width chosen without seeing the text. A grid whose first column says
   * "Moving averages" and whose second says "RSI: 27.22" has two columns that
   * want different room, and one number cannot give it to both.
   */
  readonly cellWidth?: readonly number[];
  /**
   * `'auto'` to shrink a cell's type until its text fits the cell it is in.
   *
   * The chart measures the text it is about to draw, which nothing upstream of
   * it can do, so this is what makes a column width that is slightly wrong
   * merely slightly loose instead of two cells written over each other.
   */
  readonly fontSize?: number | 'auto';
}

/** A grid of cells pinned to a corner, and the options it is drawn with. */
export interface ChartGrid {
  readonly rows: readonly (readonly ChartCell[])[];
  readonly options?: ChartTableOptions;
}

/**
 * One grid of several, under an identity the chart keeps it by.
 *
 * The chart reuses the grid a recompute names again and removes one it no
 * longer names, so the id is the declaration's key: stable across recomputes,
 * never empty, and unique within a program because the compiler writes one per
 * declaration.
 */
export interface ChartTableSpec extends ChartGrid {
  readonly id: string;
}

/** One end of a drawing: a time on the shared axis, a price on the pane's scale. */
export interface ChartAnchor {
  readonly time: number;
  readonly price: number;
}

/**
 * One free-standing shape, anchored to time and price rather than to a bar.
 *
 * The four kinds are the language's four, `stdlib.md` 14.4, and the fields are
 * the chart's own names for the same arguments. The whole list is replaced on
 * every recompute, which is what makes a script that deletes an object have it
 * disappear and a script that rolls a bar back not accumulate one per tick.
 */
export type ChartDrawing =
  | {
      readonly kind: 'line';
      readonly from: ChartAnchor;
      readonly to: ChartAnchor;
      readonly color?: string;
      readonly lineWidth?: number;
      readonly lineStyle?: ChartLineStyle;
      readonly extendLeft?: boolean;
      readonly extendRight?: boolean;
    }
  | {
      readonly kind: 'box';
      readonly from: ChartAnchor;
      readonly to: ChartAnchor;
      readonly color?: string;
      readonly fillColor?: string;
      readonly opacity?: number;
      readonly lineWidth?: number;
      readonly text?: string;
      readonly textColor?: string;
      readonly tooltip?: string;
    }
  | {
      readonly kind: 'label';
      readonly at: ChartAnchor;
      readonly text: string;
      readonly color?: string;
      readonly textColor?: string;
      readonly align?: ChartCellAlign;
      readonly tooltip?: string;
    }
  | {
      readonly kind: 'polyline';
      readonly points: readonly ChartAnchor[];
      readonly color?: string;
      readonly lineWidth?: number;
      readonly closed?: boolean;
      readonly fillColor?: string;
      readonly opacity?: number;
    };

/** What an alert's condition is handed, for the bar it is judging. */
export interface ChartAlertContext extends ChartSurfaceContext {
  readonly index: number;
}

/**
 * One watched condition, declared before bar 0 and evaluated by the chart.
 *
 * The chart judges bars that are new since it last looked, which is the rule
 * `stdlib.md` 16.2 states from the other side: a study added to a chart holding
 * two years of bars announces none of them.
 */
export interface ChartAlertSpec {
  readonly id: string;
  readonly title: string;
  /**
   * The notification's text, computed for the bar that fired.
   *
   * The chart takes either a fixed string or a function of the same context
   * `when` was judged on, and it calls the function only for a bar `when`
   * accepted. This adapter writes only the function: a declared alert's message
   * is an expression evaluated on the bar, so a fixed string could only ever be
   * the title again, which is what this used to hand over.
   */
  message?(ctx: ChartAlertContext): string;
  when(ctx: ChartAlertContext): boolean;
}

/**
 * Bars of another instrument or interval, as the host is asked for them.
 *
 * There is no cancellation token on it, and none is needed: a chart bounds every
 * request it forwards by the study instance's own lifetime, so a study removed
 * while another instrument is loading is not answered after it is gone. A second
 * token carried from here would be the same fact stated twice, and the weaker of
 * the two.
 */
export interface ChartBarsRequest {
  readonly symbol: string;
  readonly exchange?: string;
  readonly interval: string;
  /** UTC seconds, both ends. */
  readonly from: number;
  readonly to: number;
}

/** What a study says about the data it is waiting for. */
export type ChartDataStatus =
  | { readonly state: 'loading' | 'ready' | 'empty' | 'unsupported' }
  | { readonly state: 'error'; readonly error: unknown };

/** Why the host says the bars or the identity behind a study have moved. */
export type ChartDataChange = 'context' | 'range';

/**
 * The lifecycle of one study instance, for the data that is not on its bars.
 *
 * It is the only place the chart offers a transport, and a read of another
 * instrument is the only thing in this language that needs one. Everything else
 * a study produces is computed from bars the chart already holds.
 */
export interface ChartAttachContext {
  /** Scratch this instance owns: the same object the calculation receives. */
  readonly store: Record<string, unknown>;
  /** Ask the host for another instrument's bars. Absent when it serves none. */
  requestBars?(request: ChartBarsRequest): Promise<readonly ChartBar[]>;
  /** Run the calculation again and repaint, once an answer has arrived. */
  requestRecompute(): void;
  setDataStatus?(status: ChartDataStatus): void;
  setDataRetry?(retry: (() => void) | null): void;
  subscribeDataChanges?(listener: (change: ChartDataChange) => void): () => void;
}
