/**
 * The chart's indicator descriptor, as this adapter targets it.
 *
 * **Why the shape is declared here rather than imported.** The chart library is
 * a peer dependency: a host that wants a chart installs it, and a host that
 * wants only the language must not be made to. This repository therefore does
 * not install it, cannot type check against it, and would fail its own build the
 * moment a file here imported it. So the adapter declares the shape it produces
 * and the host's own build is where the two are compared: assigning the result
 * of `descriptorFor` to the library's `IndicatorDescriptor` is a one line check
 * that fails to compile if this file has drifted, and it costs a host nothing to
 * write.
 *
 * ```ts
 * import type { IndicatorDescriptor } from "<the chart library>";
 * const descriptor: IndicatorDescriptor = descriptorFor(program);
 * ```
 *
 * **That line catches a value of the wrong shape and not an argument of the
 * wrong shape**, and the difference is worth knowing before trusting it. A
 * method's parameters are compared in both directions, so a hook declared here
 * as taking something the chart never passes still assigns: the chart calls it
 * with what it has, the hook reads nothing, and the study draws none of that
 * output with nothing anywhere saying so. That failure is the one this module
 * has actually made. So every hook below takes the chart's own argument, spelled
 * as the chart spells it, and every test in `tests/adapters/charts` calls each
 * hook with the argument the chart passes rather than with one of its own.
 *
 * Where the two worlds spell something differently the translation is in this
 * module, which is the only one allowed to know both.
 *
 * What is declared is the whole output surface: the inputs and the settings
 * dialog a chart generates from them, the plots with their styles and scales,
 * the bands between them, the horizontal levels, the pane's fixed range, the
 * markers, the candle and pane painting, the summary grids, the drawing objects,
 * the watched conditions, and the lifecycle a read of another instrument fetches
 * through.
 *
 * **Some of what a study declares has no field on the descriptor to land in**,
 * and it is left out rather than approximated. Which parts, and why each one
 * has nowhere to go, is recorded in `spec/chart-narrowings.json`;
 * `scripts/check-chart-surface.mjs` reads that record against the declarations
 * of a compiled program and fails on anything dropped that is not in it, so a
 * narrowing can no longer be added by forgetting to mention one. An alert's
 * per-bar message was on that list for the life of this module and is now
 * carried: the file that would have written it is the file that says so.
 *
 * Every member is narrowed to what the adapter can emit. A narrower type is
 * still assignable to the library's wider one, and a value this adapter cannot
 * produce is better left out than declared and never written.
 */
import type {
  ChartAlertSpec,
  ChartAttachContext,
  ChartDrawing,
  ChartGrid,
  ChartMarker,
  ChartSurfaceContext,
  ChartTableSpec,
} from './surfaces.js';

/** One bar as the chart holds it. Its time is UTC seconds, not milliseconds. */
export interface ChartBar {
  readonly time: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume?: number;
  readonly oi?: number;
}

/** The eight series a `"source"` input may select. */
export type ChartSource = 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4' | 'volume';

/** The plot styles a single column of values can be drawn as, plus candles. */
export type ChartSeriesType =
  | 'line'
  | 'line-markers'
  | 'step'
  | 'area'
  | 'histogram'
  | 'column'
  | 'candlestick';

export type ChartLineStyle = 'solid' | 'dashed' | 'dotted';

/** Which price axis a plot maps to. The empty string is a hidden overlay scale. */
export type ChartPriceScaleId = 'right' | 'left' | '';

export type ChartPriceFormat =
  | { readonly type: 'price'; readonly precision?: number }
  | { readonly type: 'percent'; readonly precision?: number }
  | { readonly type: 'volume' };

/** The style fields a plot built here ever sets. */
export interface ChartSeriesStyle {
  readonly title?: string;
  readonly color?: string;
  readonly lineWidth?: number;
  readonly lineStyle?: ChartLineStyle;
  readonly precision?: number;
  readonly upColor?: string;
  readonly downColor?: string;
  readonly borderUpColor?: string;
  readonly borderDownColor?: string;
  readonly wickUpColor?: string;
  readonly wickDownColor?: string;
}

export type ChartSettings = Record<string, unknown>;
export type ChartStore = Record<string, unknown>;

/** One column per key, aligned one to one with the bars, `null` for a gap. */
export type ChartValues = Record<string, readonly (number | null)[]>;

/** One row of the generated settings dialog. */
export type ChartInput =
  | {
      readonly key: string;
      readonly type: 'number';
      readonly label: string;
      readonly default: number;
      readonly min?: number;
      readonly max?: number;
      readonly step?: number;
      readonly group?: string;
      readonly tooltip?: string;
    }
  | {
      readonly key: string;
      readonly type: 'boolean';
      readonly label: string;
      readonly default: boolean;
      readonly group?: string;
      readonly tooltip?: string;
    }
  | {
      readonly key: string;
      readonly type: 'color';
      readonly label: string;
      readonly default: string;
      readonly group?: string;
      readonly tooltip?: string;
    }
  | {
      readonly key: string;
      readonly type: 'text';
      readonly label: string;
      readonly default: string;
      readonly group?: string;
      readonly tooltip?: string;
    }
  | {
      readonly key: string;
      readonly type: 'select';
      readonly label: string;
      readonly default: string;
      readonly options: readonly { readonly label: string; readonly value: string }[];
      readonly group?: string;
      readonly tooltip?: string;
    }
  | {
      readonly key: string;
      readonly type: 'source';
      readonly label: string;
      readonly default: ChartSource;
      readonly group?: string;
      readonly tooltip?: string;
    }
  | {
      readonly key: string;
      readonly type: 'interval';
      readonly label: string;
      readonly default: string;
      readonly group?: string;
      readonly tooltip?: string;
    }
  | {
      readonly key: string;
      readonly type: 'time';
      readonly label: string;
      readonly default: string;
      readonly group?: string;
      readonly tooltip?: string;
    };

/** What a per-bar callback that has no series value of its own is handed. */
export interface ChartPaintContext {
  readonly index: number;
  readonly values: ChartValues;
  readonly settings: ChartSettings;
}

/** What a per-bar colour callback is handed. */
export interface ChartColorContext extends ChartPaintContext {
  readonly value: number;
}

/** A candle plot's colour, split into the three parts a candle is drawn from. */
export interface ChartBarColor {
  readonly body?: string;
  readonly wick?: string;
  readonly border?: string;
}

export interface ChartPlot {
  readonly key: string;
  readonly type: ChartSeriesType;
  readonly title: string;
  readonly style?: ChartSeriesStyle;
  readonly priceScaleId?: ChartPriceScaleId;
  readonly priceFormat?: ChartPriceFormat;
  readonly overlay?: boolean;
  readonly offset?: number;
  readonly colorKey?: string;
  readonly ohlc?: {
    readonly open: string;
    readonly high: string;
    readonly low: string;
    readonly close: string;
  };
  colorBy?(ctx: ChartColorContext): string | undefined;
  colorParts?(ctx: ChartColorContext): ChartBarColor | undefined;
}

/**
 * What a band's per-bar colour callback is handed, for one bar.
 *
 * `a` and `b` are the two columns the band is drawn between, read on that bar,
 * and `null` where either has no value, which is a bar the band is not drawn on.
 */
export interface ChartFillContext {
  readonly index: number;
  readonly a: number | null;
  readonly b: number | null;
  readonly values: ChartValues;
  readonly settings: ChartSettings;
}

export interface ChartFill {
  readonly between: readonly [string, string];
  readonly colorUp?: string;
  readonly colorDown?: string;
  readonly colorUpKey?: string;
  readonly colorDownKey?: string;
  readonly opacity?: number;
  readonly overlay?: boolean;
  /**
   * The band's colour on one bar, for a band whose colour the script computes.
   *
   * Present only on such a band, and only where the host states a chart that
   * has the callback (`capabilities.ts`). Nothing where that bar's side is not
   * computed per bar, which leaves the chart drawing the band's own colour for
   * that side.
   */
  colorBy?(ctx: ChartFillContext): string | undefined;
}

export interface ChartLevel {
  readonly price: number;
  readonly color?: string;
  readonly title?: string;
  readonly lineWidth?: number;
  readonly lineStyle?: ChartLineStyle;
}

/** What `levels` is handed: the settings, with the data spread beside them. */
export type ChartLevelContext = ChartSettings & {
  readonly settings?: ChartSettings;
  readonly bars?: readonly ChartBar[];
  readonly values?: ChartValues;
};

/** What the calculation cannot read off the bars themselves. */
export interface ChartCalcContext {
  readonly barState: {
    readonly isNew: boolean;
    readonly isConfirmed: boolean;
    readonly isRealtime: boolean;
    readonly lastIndex: number;
  };
  readonly symbol?: string;
  readonly interval?: string;
  readonly timezone: string;
  now(): number;
  readonly tickSize?: number;
}

export interface ChartDescriptor {
  readonly id: string;
  readonly name: string;
  readonly category?: string;
  readonly placement: 'onchart' | 'pane';
  readonly inputs: readonly ChartInput[];
  readonly plots: readonly ChartPlot[];
  readonly fills?: readonly ChartFill[];
  /** The conditions a user may subscribe to, fixed before the first bar. */
  readonly alerts?: readonly ChartAlertSpec[];
  calc(
    bars: readonly ChartBar[],
    settings: ChartSettings,
    store: ChartStore,
    ctx?: ChartCalcContext,
  ): ChartValues;
  calcTail?(
    bars: readonly ChartBar[],
    settings: ChartSettings,
    fromIndex: number,
    previous: ChartValues,
    store: ChartStore,
    ctx?: ChartCalcContext,
  ): ChartValues | null;
  levels?(ctx: ChartLevelContext): readonly ChartLevel[];
  range?(settings: ChartSettings): { readonly min: number; readonly max: number } | null;

  /**
   * The instrument's own candles, one colour per bar and `null` where the script
   * painted none.
   *
   * Present only on a study that calls `barColor()`. Only one study may own the
   * candles of a pane at a time, which is `compiled-program.md` 11's rule rather
   * than whichever calculation ran last; a chart that arbitrates between
   * publishers applies it itself, and `candleOwner` is the same rule for a host
   * whose chart does not.
   */
  barColors?(ctx: ChartSurfaceContext): readonly (string | null)[];
  /** The full height shading behind each bar's column, `null` for unshaded. */
  background?(ctx: ChartSurfaceContext): readonly (string | null)[];
  /** Every marker the last calculation produced, oldest bar first. */
  markers?(ctx: ChartSurfaceContext): readonly ChartMarker[];
  /** The first declared grid as the last executed bar left it, or nothing. */
  table?(ctx: ChartSurfaceContext): ChartGrid | null;
  /**
   * Every declared grid as the last executed bar left it, each under its
   * declaration's key.
   *
   * A chart that has this hook reads it in place of `table`, and one that does
   * not reads `table` and draws the first grid. So it is present only where the
   * host states a chart that has it (`capabilities.ts`), and a second grid is
   * refused on a chart that does not.
   */
  tables?(ctx: ChartSurfaceContext): readonly ChartTableSpec[];
  /** Every drawing object the script currently holds, oldest first. */
  draws?(ctx: ChartSurfaceContext): readonly ChartDrawing[];
  /**
   * The lifecycle one instance runs, for a read of another instrument.
   *
   * Present only on a program that makes one. A study that computes from the
   * chart's own bars needs no transport and declares no lifecycle, so it costs
   * a host nothing.
   */
  attach?(ctx: ChartAttachContext): (() => void) | void;
}
