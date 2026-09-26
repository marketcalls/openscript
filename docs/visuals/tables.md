# Tables

By the end of this page you will be able to pin a grid to a corner of a pane,
write cells into it on the bar that matters, align and colour them, fake the
merged cell the language does not have, and know which numbers belong in a table
rather than in a plot.

## What a table is for

Almost everything a study produces is a value per bar, and a value per bar is a
plot. A table is for the rest: **the statistics that are not a value per bar.**

- The current reading of six indicators, which is one state, not a history.
- The higher timeframe picture: four timeframes, one row each.
- Session statistics: today's range, today's volume against its average, bars
  since the open.
- Instrument facts: symbol, interval, tick size, lot size.
- A strategy's running result: trades taken, win rate, open profit.

None of those is a column. They have no shape on a time axis, they are read at a
glance rather than traced, and a plot of any of them would put a flat line
through the middle of a pane to say something a single number says better.

A table is also the only surface that never covers the chart. It is pinned to a
corner of the pane, so unlike a stack of labels it does not move when price
moves and does not have to be repositioned when the instrument reprices.

## Declaring a grid

```
table(title, rows, cols, position = "topRight", textColor = none, bgColor = none, borderWidth = 0)
```

The call returns a handle, and **it must be at the top level.** Like `plot`,
`fill` and `level`, a table is part of the study's fixed shape: the pane has to
know what it is reserving room for before the first bar runs, exactly as a
legend and a settings dialog do. A `table()` inside an `if` or a function is
OS3006, and there is no hiding a table by wrapping it in a branch. You hide it
by writing no cells, which the section on switching it off covers.

For the same reason the grid's size has to be knowable before bar 0: `rows` and
`cols` are a literal, arithmetic over literals, or an `input()`. A row count
that depends on a bar's data has nothing to reserve room for.

| Argument | Takes | Notes |
|---|---|---|
| `title` | `string` | Names the grid. First positional |
| `rows` | `number` | Row count, fixed before bar 0 |
| `cols` | `number` | Column count, fixed before bar 0 |
| `position` | `"topLeft"`, `"topRight"`, `"bottomLeft"`, `"bottomRight"` | Which corner of the pane it is pinned to |
| `textColor` | `color` | Default text colour for every cell |
| `bgColor` | `color` | Background behind the whole grid |
| `borderWidth` | `number` | Border thickness, `0` for none |

Make `position` an input. It costs one line, and which corner is free depends on
the chart the user has, not on the study.

### How many grids reach a chart pane

The language lets a study declare as many grids as it likes and the compiled
program carries all of them. The chart adapter in this repository draws every
one of them on a chart from version 2.5.4 on, each in the corner its own
`position` names, and keeps each grid from one recompute to the next rather
than building it again. Give each grid a corner of its own: two pinned to the
same corner are drawn one over the other.

An older chart has room for one grid per study. On one, or on a host that does
not say which chart it has, the adapter refuses a study that declares a second,
before any bar runs, with OS6024 naming the second grid. It used to draw the
first and say nothing about the rest, which is a study whose second panel never
appears and whose cells look broken.

So if the study has to run on any host, declare one grid and give it the rows
you need. Two grids with different corners are the tidier layout where the host
draws both, and where it does not, two panels are two studies, which a user can
put in different corners.

This is a limit of the drawing surface rather than of the language: another host
may draw every grid. What the chart adapter here draws, and from which chart
version, is recorded in [spec/chart-narrowings.json](../../spec/chart-narrowings.json).

## Writing cells

```
cell(t, row, col, text, textColor = none, bgColor = none, align = "left")
clear(t)
```

`cell` may appear anywhere: inside an `if`, inside a loop, inside a function. It
is per-bar output, not part of the fixed shape.

Rows and columns are zero based, so a grid declared with `rows = 4, cols = 2`
has rows 0 to 3 and columns 0 to 1.

The fourth argument is a `string`, and the language has no implicit conversion,
so a number is converted on the way in: `text(value, decimals)`. That is the
same rule as everywhere else and it is worth one helper per script, because a
warmup reading has to be handled and there is exactly one right answer:

```
fn show(value, decimals) => isNone(value) ? "warming up" : text(value, decimals)
```

A blank cell and a zero are both wrong during warmup. The first hides that the
study has not started; the second invents a number. Saying so is the only honest
option, and one function makes it consistent across the whole panel.

An absent value reaching a cell renders a blank cell, never a zero, which is the
same rule as a gap in a plot and a bar left its own colour.

## Write on the last bar only

**A panel shows one state, the current one.** Writing it on every bar of a fifty
thousand bar chart is fifty thousand writes to display the last one.

```
if bar.isLast
    cell(panel, 0, 0, "RSI")
    cell(panel, 0, 1, show(oscillator, 1))
```

This is safe on a live chart, and the reason is the rollback rule. The newest
bar is executed again on every update, and the cell buffer is emptied at the
start of each execution and committed with the rest of the bar's output, so the
panel is rewritten from scratch on every tick rather than accumulating. What you
see is the last write of the last bar.

It is also why a table's cells are written against the handle rather than
through a per-bar channel the way a plot's value is: a grid of two hundred cells
would otherwise need two hundred channels, and almost every one of them would be
absent on almost every bar.

Here is a complete panel:

```
version 1

study("Dashboard", overlay = true, precision = 2)

rsiLen   = input(14,  "RSI length",      min = 2, max = 200)
atrLen   = input(14,  "ATR length",      min = 1, max = 200)
lookback = input(20,  "Range lookback",  min = 2, max = 500)
corner   = input("topRight", "Corner",
                 options = ["topLeft", "topRight", "bottomLeft", "bottomRight"])

// Declared once, before the first bar, for the same reason a plot is.
panel = table("Dashboard", 5, 2, position = corner,
              textColor = silver, bgColor = fade(black, 25))

// Every reading is computed unconditionally at the top level. A stateful call
// made inside the if below would advance only on the bars that branch was
// taken, which is warning OS8001 and a wrong number.
oscillator  = rsi(close, rsiLen)
atrPercent  = atr(atrLen) / close * 100
span        = highest(high, lookback) - lowest(low, lookback)
rangePct    = span > 0 ? (close - lowest(low, lookback)) / span * 100 : none
volumeRatio = volume / sma(volume, lookback)

fn show(value, decimals) => isNone(value) ? "warming up" : text(value, decimals)

zoneColor = isNone(oscillator) ? silver :
            (oscillator > 70 ? red : (oscillator < 30 ? lime : silver))

if bar.isLast
    cell(panel, 0, 0, chart.symbol, textColor = white)
    cell(panel, 0, 1, chart.interval, textColor = white, align = "right")

    cell(panel, 1, 0, "RSI")
    cell(panel, 1, 1, show(oscillator, 1), textColor = zoneColor, align = "right")

    cell(panel, 2, 0, "ATR, percent of price")
    cell(panel, 2, 1, show(atrPercent, 2), align = "right")

    cell(panel, 3, 0, "Position in " + text(lookback, 0) + " bar range")
    cell(panel, 3, 1, show(rangePct, 0) + " percent", align = "right")

    cell(panel, 4, 0, "Volume against average")
    cell(panel, 4, 1, show(volumeRatio, 2), align = "right",
         textColor = volumeRatio > 2 ? orange : silver)
```

## Alignment, and numbers that line up

`align` takes one of the three values `stdlib.md` section 14.3 names, and the
examples above use two of them.

The rule that makes a panel readable: **labels left, numbers right.** Numbers
are compared by their last digit, and a column of right aligned numbers puts the
units under the units whatever their width. A column of left aligned numbers
makes 9.5 look bigger than 11.25.

Where the text itself has to line up inside one cell, `str.padLeft` and
`str.padRight` do it:

```
cell(panel, row, 1, str.padLeft(show(value, 2), 8), align = "right")
```

And `str.repeat` turns a number into a bar drawn out of characters, which is
often more readable at a glance than the number itself:

```
version 1

study("Strength meter", overlay = true)

barLen = input(10, "Meter width", min = 4, max = 40)

meter = table("Strength", 2, 2, position = "bottomRight", textColor = silver)

oscillator = rsi(close, 14)
strength   = isNone(oscillator) ? none : floor(oscillator / 100 * barLen)

if bar.isLast
    cell(meter, 0, 0, "RSI")
    cell(meter, 0, 1, isNone(strength) ? "" :
                      str.repeat("|", strength) + str.repeat(".", barLen - strength),
         textColor = oscillator > 70 ? red : (oscillator < 30 ? lime : aqua))

    cell(meter, 1, 0, "Value")
    cell(meter, 1, 1, isNone(oscillator) ? "warming up" : text(oscillator, 1),
         align = "right")
```

`floor` is not decoration: `str.repeat` wants a whole number of copies, and a
length of 6.4 is a bug in the script rather than something to round away
quietly.

## Colour in a table

Three levels, each overriding the one above it:

| Level | Set by | Applies to |
|---|---|---|
| The grid | `table(..., textColor = ..., bgColor = ...)` | Every cell that says nothing else |
| The cell | `cell(..., textColor = ..., bgColor = ...)` | That cell |
| Absent | Leaving the argument out | The host's own default |

Give the grid a translucent background rather than a solid one:
`bgColor = fade(black, 25)` keeps the candles behind it faintly visible, which
matters because the panel sits over the price pane. The same colour at full
opacity punches a rectangular hole in the chart.

Colour in a cell is information, so spend it on the cell that carries the
reading and not on the label beside it. A panel where every cell is coloured is
a panel where no cell stands out. Which colours survive both a light and a dark
chart is [colors.md](./colors.md).

## Merging cells

**Version 1 has no cell span.** There is no `colspan`, no merge call, and a cell
occupies exactly one row and one column.

Two idioms give the same reading:

**A header across a row.** Put the text in the first column and leave the rest
of the row blank, then give every cell in the row the same background so the row
reads as one block:

```
if bar.isLast
    cell(panel, 0, 0, "Higher timeframes", textColor = white, bgColor = fade(navy, 40))
    cell(panel, 0, 1, "",                  bgColor = fade(navy, 40))
    cell(panel, 0, 2, "",                  bgColor = fade(navy, 40))
```

**A value that needs the width of two columns.** Put it in one cell and pad the
neighbour, or design the grid with fewer, wider columns. A grid is declared with
a fixed shape, so the honest fix for a value that does not fit is usually a
different shape rather than a merge.

What the absence costs you is a header that is centred over two columns exactly.
What it buys is that every cell has one address, so `cell(panel, r, c, ...)`
means the same thing on every bar and a script cannot write into a cell that
another write has swallowed. When merging arrives it will be an argument on
`cell`, and nothing written against version 1 will change meaning.

## Clearing, and switching a table off

`clear(t)` empties every cell so the grid can be rebuilt from scratch.

You need it when the number of rows you write varies. A leaderboard that writes
five rows on one bar and three on the next would leave rows four and five
showing the previous bar's values, because a cell you do not write is a cell
nobody touched. `clear` first, then write:

```
if bar.isLast
    clear(panel)
    for i = 0 to size(names) - 1
        cell(panel, i, 0, element(names, i))
        cell(panel, i, 1, show(element(values, i), 2), align = "right")
```

A fixed panel that writes the same cells every time does not need it.

Switching the whole table off is the same mechanism: **write no cells.** A
`table()` call cannot be wrapped in an `if`, but the writes can:

```
showPanel = input(true, "Show the panel")

if bar.isLast and showPanel
    cell(panel, 0, 0, "RSI")
```

## A higher timeframe grid

The case a table is best at: four timeframes, one row each, each row saying the
same thing about a different interval.

```
version 1

study("Timeframe bias", overlay = true)

fastLen = input(20, "Fast length", min = 1, max = 500)
slowLen = input(50, "Slow length", min = 1, max = 500)
tfA     = input("15", "Timeframe 1", kind = "interval")
tfB     = input("60", "Timeframe 2", kind = "interval")
tfC     = input("1D", "Timeframe 3", kind = "interval")

grid = table("Bias", 4, 2, position = "topRight", bgColor = fade(black, 20))

// mode is left at its default, "confirmed", which is the only mode that never
// repaints: each row changes when that timeframe's bar closes and not before.
biasA = req.timeframe(tfA, ema(close, fastLen) > ema(close, slowLen))
biasB = req.timeframe(tfB, ema(close, fastLen) > ema(close, slowLen))
biasC = req.timeframe(tfC, ema(close, fastLen) > ema(close, slowLen))

fn word(b)  => isNone(b) ? "warming up" : (b ? "up" : "down")
fn tint(b)  => isNone(b) ? silver : (b ? lime : red)

if bar.isLast
    cell(grid, 0, 0, "Timeframe", textColor = white)
    cell(grid, 0, 1, "Bias",      textColor = white, align = "right")

    cell(grid, 1, 0, tfA)
    cell(grid, 1, 1, word(biasA), textColor = tint(biasA), align = "right")

    cell(grid, 2, 0, tfB)
    cell(grid, 2, 1, word(biasB), textColor = tint(biasB), align = "right")

    cell(grid, 3, 0, tfC)
    cell(grid, 3, 1, word(biasC), textColor = tint(biasC), align = "right")
```

`word` and `tint` both test `isNone` first, and that is not defensive
programming. A condition that is absent takes the false branch, so
`b ? "up" : "down"` would print "down" for every bar before the first higher
timeframe bar closed, and mean it. A panel that says "down" when it means "I do
not know yet" is worse than no panel.

## What a table is not for

| You want | Use | Because |
|---|---|---|
| A value per bar | `plot` | A table shows one state, not a history |
| An event on a bar | `signal` | A marker is attached to the bar it happened on |
| A running log of values | `print` | The log takes a value per bar and draws nothing |
| A caption on a shape | `draw.label` or the box's own `text` | It belongs with the thing it describes |
| Fifty rows of history | Nothing here | That is a report, not a chart surface |

The last row is the one people push against. A table can be declared with fifty
rows and filled with the last fifty bars, and it will work, and it will be
unreadable at the size a chart corner offers. Charts are for shapes over time.
If the thing you want is a list, the `print` log or a strategy report is the
place for it.

## Common mistakes

| Symptom | Cause | Fix |
|---|---|---|
| OS3006 on the `table()` line | Declared inside an `if` or a function | Declare at the top level and guard the `cell` writes instead |
| The panel is empty | Cells written only under a condition that never held on the last bar | Write on `bar.isLast`, and check the guard |
| Stale rows from a previous bar | Fewer rows written than last time | `clear(panel)` before rewriting |
| Every row says "down" on a fresh chart | An absent condition taking the false arm | Test `isNone` and say so |
| The chart is slow with a table on it | Cells written on every bar of history | Write inside `if bar.isLast` |
| OS2003 on a `cell` call | A number passed where a string is expected | `text(value, decimals)` |
| The panel hides the candles under it | A solid `bgColor` | `fade(black, 25)` or similar |
| OS6024 naming a second table | The host's chart draws one grid per study, or the host did not say which chart it has | Run it on a host with a newer chart, declare one grid, or split the study in two |
| Two grids drawn over each other | Both pinned to the same corner | Give each grid its own `position` |
| Numbers do not line up | Left aligned by default | `align = "right"` on the value column |

## See also

- [overview.md](./overview.md) for the map of every drawing surface and what each one costs
- [labels-and-shapes.md](./labels-and-shapes.md) for the stack of labels a table replaces
- [colors.md](./colors.md) for cell colours that work on a light and a dark chart
- [lines-and-boxes.md](./lines-and-boxes.md) for output that belongs on the chart rather than in a corner
- [bar-coloring-and-backgrounds.md](./bar-coloring-and-backgrounds.md) for saying something about a stretch of bars
- [plots.md](./plots.md) for the value per bar that belongs in a column and not in a grid
- [../README.md](../README.md) for the rest of the documentation
- [../../spec/stdlib.md](../../spec/stdlib.md) section 14.3 for the authoritative `table` and `cell` reference
- [../../spec/language.md](../../spec/language.md) section 7.1 for why the fixed surfaces are top level only
- [../../examples/08-dashboard-table.oscript](../../examples/08-dashboard-table.oscript) for a panel written end to end
- [../../examples/07-higher-timeframe-bias.oscript](../../examples/07-higher-timeframe-bias.oscript) for a coarse timeframe read that states its mode
