/**
 * The chart adapter: a compiled program becomes a chart's indicator descriptor.
 *
 * This is the only module in the repository allowed to know two worlds at once,
 * and it is the piece a platform with its own chart replaces rather than the
 * piece it patches. Everything under `src/core` stays ignorant of charts, and
 * the layering check is what keeps it that way.
 *
 * **The chart library is a peer dependency, and nothing here imports it.** A
 * package that pulled a chart into everyone's install would defeat the point of
 * a language that a platform can take on its own, so the descriptor's shape is
 * declared in `contract.ts` and the value this produces is assigned to the
 * library's own type by the host, in one line, at the host's build. See that
 * file for the line.
 *
 * What is mapped is the whole output surface: the declared inputs and the
 * settings dialog a chart generates from them, the plots with their styles and
 * scales, the bands between them, the horizontal levels, the pane's fixed range,
 * the markers, the candle and pane painting, the summary grids, the drawing
 * objects a script mutates over time, the watched conditions, and the lifecycle
 * a read of another instrument fetches through.
 *
 * **Two of those depend on the chart the host states.** A band coloured per bar
 * and a study with more than one grid need hooks only a newer chart has, so a
 * host passes the chart library's own `VERSION` as
 * `ChartAdapterOptions.chartVersion`, and without it such a study is refused
 * with OS6024 rather than drawn in part. `capabilities.ts` has the versions.
 *
 * What a study can express and this descriptor has no field for is recorded,
 * with its reason, in `spec/chart-narrowings.json`, and each one is also named
 * in the file that would have written it. `scripts/check-chart-surface.mjs`
 * reads that record against a compiled program, so the list cannot grow in
 * silence.
 */
export { descriptorFor } from './descriptor.js';

export { candleOwner } from './paint.js';
export type { Painter } from './paint.js';

export { ChartAdapterError } from './errors.js';

export { release } from './run.js';
export type { ChartAdapterOptions } from './run.js';

export type {
  ChartBar,
  ChartCalcContext,
  ChartDescriptor,
  ChartFill,
  ChartFillContext,
  ChartInput,
  ChartLevel,
  ChartLevelContext,
  ChartLineStyle,
  ChartPlot,
  ChartPriceFormat,
  ChartPriceScaleId,
  ChartSeriesStyle,
  ChartSeriesType,
  ChartSettings,
  ChartSource,
  ChartStore,
  ChartValues,
} from './contract.js';

export type {
  ChartAlertContext,
  ChartAlertSpec,
  ChartAnchor,
  ChartAttachContext,
  ChartBarsRequest,
  ChartCell,
  ChartCellAlign,
  ChartDataChange,
  ChartDataStatus,
  ChartDrawing,
  ChartGrid,
  ChartMarker,
  ChartMarkerPosition,
  ChartMarkerShape,
  ChartMarkerSize,
  ChartSurfaceContext,
  ChartTableOptions,
  ChartTablePosition,
  ChartTableSpec,
} from './surfaces.js';
