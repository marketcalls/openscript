# Constants and fixed vocabularies

By the end of this page you will know every named constant OpenScript defines, and
every closed set of string values the language and the standard library accept
where another language would have given you a constant.

## The honest shape of this page

OpenScript defines **twenty-one named constants**: nineteen colours, and two
numbers in the `math` namespace. That is the whole list.

Everything else a script chooses from a fixed menu, the plot style, the table
corner, the order product, the timeframe, is spelled as an ordinary **string**.
There is no `Style.Line` and no `Position.TopRight`. The value is `"line"` and
`"topRight"`, written out.

This is a decision rather than an omission. A constant name has to be reserved in
the global scope, it has to be memorised, and it has to be typed correctly with no
help from a settings dialog. A string can come from an `input()` with an `options`
list, so the user changes the plot style from the dialog without editing the
script, and the same value can be written straight into the compiled program with
no lookup table in between. The cost is that a misspelling is not caught by the
name checker, so the compiler checks the string itself: a value outside the
accepted set is OS3004 at compile time whenever it is a literal.

Every table below that lists string values is therefore a **closed vocabulary**.
Anything not in the table is an error, not an extension point.

---

## Colours

### The nineteen named colours

Each is an ordinary global of type `color`, fully opaque. They are bare names with
no prefix, because a colour appears in almost every line that draws something and
a prefix on a fixed vocabulary of nineteen words is pure noise.

| | | | |
|---|---|---|---|
| `aqua` | `black` | `blue` | `brown` |
| `fuchsia` | `gray` | `green` | `lime` |
| `maroon` | `navy` | `olive` | `orange` |
| `pink` | `purple` | `red` | `silver` |
| `teal` | `white` | `yellow` | |

```
plot(ema(close, 21), "EMA 21", orange)
```

Their exact channel values are fixed in the library manifest and in the conformance
suite rather than in the specification text, so this page cannot list the numbers.
What the specification does promise is that they are identical on every engine, so
a study looks the same wherever it runs.

Assigning to one is OS2002, the same error as assigning to `close`. They are
globals, and the language has no shadowing.

### Colour literals

| Form | Means | Example |
|---|---|---|
| a bare name | One of the nineteen above | `aqua` |
| `#rrggbb` | Twenty-four bit hex, fully opaque | `#ff8800` |
| `#rrggbbaa` | The same with an alpha byte | `#ff880080` |

```
plot(signalLine, "Signal", #ff8800)
```

### Colour construction

Not constants, but the way a script reaches a colour that is not one of the
nineteen. Listed here because a reader looking for a colour looks in one place.

| Call | Returns | Means |
|---|---|---|
| `rgb(r, g, b)` | `color` | Channels 0 to 255, fully opaque |
| `rgba(r, g, b, a)` | `color` | The same with alpha 0 to 1, where 1 is opaque |
| `fade(color, percent)` | `color` | The same colour at `percent` **transparency**, where 100 is invisible |
| `mix(a, b, weight)` | `color` | Blend, `weight` 0 gives `a` and 1 gives `b` |
| `alpha(color)` | `number` | Read a colour's alpha, 0 to 1 |
| `withAlpha(color, a)` | `color` | The same colour at a stated alpha, 0 to 1 |
| `hsl(h, s, l)` | `color` | Hue, saturation, lightness. Planned |
| `gradient(value, from, to, colorFrom, colorTo)` | `color` | Position a value between two colours. Planned |

**`fade` takes transparency and `withAlpha` takes opacity.** They are opposites,
and getting them the wrong way round draws something invisible, so both exist under
names that say which they are. `fade(aqua, 88)` is a faint aqua. `withAlpha(aqua,
0.88)` is an almost solid one.

A channel argument outside its range is OS4009, not a clamp, because a colour
computed from data and landing at 300 is a bug in the computation and clamping it
would hide the bug at exactly the value that proves it exists.

**Not raised yet.** OS4009 is in the catalogue and nothing raises it: a channel
outside its range reaches the chart rather than stopping the bar.

```
version 1

study("Bands", overlay = true)

b = bollinger(close, 20, 2)

upper = plot(b[1], "Upper", aqua)
lower = plot(b[2], "Lower", aqua)
plot(b[0], "Basis", fade(aqua, 40))

fill(upper, lower, color = fade(aqua, 88))
barColor(close > b[1] ? lime : close < b[2] ? red : silver)
```

---

## Maths constants

| Name | Type | Means |
|---|---|---|
| `math.pi` | `number` | The circle constant |
| `math.e` | `number` | The base of the natural logarithm |

```
degrees = math.toDegrees(math.atan2(close - close[10], 10))
```

There is no constant for infinity and none for not-a-number, because a `number` in
OpenScript is always finite. An operation with no finite real result produces
`none` instead, which is a value a plot can draw as a gap and a comparison can
report honestly.

---

## Plot styles

The `style` argument of `plot`.

| Value | Draws |
|---|---|
| `"line"` | A continuous line, the default |
| `"lineWithMarkers"` | The same line with a dot on each bar |
| `"step"` | A stepped line that holds each value until the next |
| `"area"` | A line with the region to the baseline shaded |
| `"histogram"` | A bar per value, from the baseline |
| `"column"` | A column per value |

```
plot(m[2], "Histogram", gray, style = "histogram")
```

These are the styles that make sense for a single column of values, and they are
the same set the host's own plot style menu offers, so a user can restyle any plot
after the fact without editing the script.

---

## Line styles

The `style` argument of `level`, of `draw.line` and of `draw.setStyle`.

| Value | Draws |
|---|---|
| `"solid"` | An unbroken line. The default for `draw.line` |
| `"dashed"` | A dashed line. The default for `level` |
| `"dotted"` | A dotted line |

```
level(70, "Overbought", red, style = "dashed")
```

`level` defaults to dashed and a drawn line defaults to solid, because a reference
level is not data and a trendline is.

---

## Marker shapes and placements

The arguments of `signal(text, color, at, shape)`.

### `at`

| Value | Places the marker |
|---|---|
| `"above"` | Above the bar. The default |
| `"below"` | Below the bar |
| `"price"` | At the bar's price |

Say which. A call that names no `at` takes `"above"` whatever its text says, and
there is no value that places the marker by reading that text, because a marker
whose position depends on its own text reads differently on two engines. `at` is
part of the marker's declaration and is fixed before bar 0, as `shape` and
`color` are, so each takes a literal or an `input()` and never a per-bar value.

### `shape`

| Value |
|---|
| `"label"` (the default) |
| `"arrowUp"` |
| `"arrowDown"` |
| `"triangleUp"` |
| `"triangleDown"` |
| `"circle"` |
| `"square"` |
| `"diamond"` |
| `"cross"` |
| `"flag"` |

`signal` is the whole of shape plotting. One call and one named marker, in place of
a plot call with six positional arguments choosing a shape, a location and an
offset.

A marker has no size argument. The ten shapes above and the three placements are
the whole of the vocabulary.

---

## Positions

### Table corners

The `position` argument of `table`.

| Value |
|---|
| `"topLeft"` |
| `"topRight"` (the default) |
| `"bottomLeft"` |
| `"bottomRight"` |

### Price scales

The `scale` argument of `study`, `strategy` and `plot`.

| Value | Means |
|---|---|
| `"right"` | The right hand price scale, the default |
| `"left"` | The left hand price scale |
| `"none"` | No scale: the plot is drawn but not measured |

```
plot(volumeRatio, "Relative volume", silver, scale = "none")
```

---

## Alignments

The `align` argument of `cell` and of `draw.label`.

| Value | Used by | Means |
|---|---|---|
| `"left"` | `cell`, the default there | Text against the left edge |
| `"center"` | `draw.label`, the default there | Text centred on its anchor |

**The specification is silent on the rest.** It names the two defaults and does not
enumerate the full set, so `"right"` as a cell alignment is not something this page
can promise. Line up a numeric column with `str.padLeft` until it does.

```
cell(panel, 2, 1, str.padLeft(text(atrValue, 2), 8), align = "left")
```

---

## Timeframe codes

A timeframe is a count and a unit, written as a string. It is the argument of
`req.timeframe`, of `req.symbol` and of an `input(..., kind = "interval")`.

| Code | Means |
|---|---|
| `"1m"` | One minute |
| `"5m"` | Five minutes |
| `"15m"` | Fifteen minutes |
| `"1h"` | One hour |
| `"4h"` | Four hours |
| `"1D"` | One day |
| `"1W"` | One week |
| `"1M"` | One month |

Three rules, all of which have caught somebody:

- **The unit letters are case sensitive.** `"1M"` is one month and `"1m"` is one
  minute. There is no third spelling that means either.
- **A bare number is read as minutes**, so `"60"` and `"1h"` are the same
  timeframe. That form exists because it is what an interval input supplies.
- **Any whole number of minutes reads on an intraday chart**, finer than the
  chart's own included, where the host serves bars. On a chart of a day or
  longer a finer timeframe is OS6002. An unrecognised code is OS6001.

### Higher timeframe modes

The `mode` argument of `req.timeframe` and `req.symbol`. This is the argument that
makes a repainting study impossible to write by accident, so it is the one string
vocabulary in the language worth memorising in full.

| Value | Reads | Repaints |
|---|---|---|
| `"confirmed"` | Only higher timeframe bars that have closed. The default | Never |
| `"developing"` | Includes the higher timeframe bar currently forming | On the newest bars only |
| `"lookahead"` | A higher timeframe bar's final value from its first lower timeframe bar | On history, permanently and by design |

`"confirmed"` is the default and the only mode that never repaints. The other two
have to be written out, in a word a reader will see during review. The compiler
warns on each of them, and a `"lookahead"` read also marks the compiled study as
repainting so the host can show that in the legend, because a warning in an editor
nobody opens again is not a disclosure.

```
version 1

study("Daily bias", overlay = true)

// "confirmed" is the default and is written out anyway, so that a reader of this
// file does not have to know the default to know what it does.
dailyHigh = req.timeframe("1D", high, mode = "confirmed")
dailyLow  = req.timeframe("1D", low,  mode = "confirmed")

plot(dailyHigh, "Previous daily high", aqua, style = "step")
plot(dailyLow,  "Previous daily low",  orange, style = "step")
```

---

## Session codes

The `spec` argument of `session.isIn`.

| Form | Means |
|---|---|
| `"HHMM-HHMM"` | A window between two clock times, in the chart's timezone unless a `zone` argument names another |
| `"HHMM-HHMM:d..."` | The same window, restricted to the listed days |

Days are numbered 1 for Monday through 7 for Sunday, matching `date.dayOfWeek`.
Monday is 1 so that a weekday test reads as a contiguous range rather than
straddling the ends of one.

| Example | Means |
|---|---|
| `"0915-1530"` | Nine fifteen to three thirty, every day |
| `"0915-1530:12345"` | The same window, Monday to Friday only |
| `"2300-0500:12345"` | An overnight window: an end before the start crosses midnight |

A malformed spec is OS3008 at compile time when it is a literal.

### Date format placeholders

The `pattern` argument of `date.format`. The set is small and closed so that two
engines cannot differ. Every other character is copied through.

| Placeholder | Renders |
|---|---|
| `yyyy` | Four digit year |
| `MM` | Two digit month |
| `dd` | Two digit day |
| `HH` | Two digit hour, 24 hour clock |
| `mm` | Two digit minute |
| `ss` | Two digit second |
| `MMM` | Three letter month |
| `EEE` | Three letter weekday |

Month and weekday abbreviations are English and invariant. A script whose output
changed because the machine running it was configured for a different locale would
break the determinism rule, and a chart label is not the place to solve
internationalisation.

---

## Order, product and strategy vocabularies

### `qtyType`, on the `strategy()` declaration

| Value | The `qty` number means |
|---|---|
| `"units"` | A count of units. The default |
| `"lots"` | A count of lots, each of `chart.lotSize` units |
| `"cash"` | An amount of money, converted at the fill price |
| `"equityPercent"` | A percentage of current equity |

### `product`, on the `strategy()` declaration

| Value | Means |
|---|---|
| `"intraday"` | Positions are expected to be closed the same session. The default |
| `"overnight"` | Positions may be carried |

### `fillOn`, on the `strategy()` declaration

| Value | Fills a signalled order at |
|---|---|
| `"nextOpen"` | The next bar's open. The default |
| `"close"` | This bar's close |

`"nextOpen"` is the default rather than `"close"` because a decision made from a
bar's close cannot be filled at that same close in the real market, and a backtest
whose default is optimistic is a backtest that lies.

### `commissionType`, on the `strategy()` declaration

| Value | The `commission` number is |
|---|---|
| `"perTrade"` | A flat cost per trade. The default |
| `"perUnit"` | A cost per unit traded |
| `"percent"` | A percentage of the trade's value |

### `type`, on `order.place`

| Value | Means |
|---|---|
| `"market"` | Fill at the market. The default |

**The specification is silent on the rest.** `order.place(side, qty, type =
"market", price = none, trigger = none, tag = "")` is described as the general
form, and `buy` and `sell` are documented as placing a market order with neither
price, a limit order with `limit`, a stop order with `stop` and a stop-limit order
with both. The string names for those order types in `order.place`, and the values
the `side` argument accepts, are not written down anywhere in the specification.
Until they are, use `buy`, `sell`, `close` and `exit`, whose behaviour is fully
specified.

### `direction`, on `order.roundToLot`

| Value | Means |
|---|---|
| `"down"` | Round down to a whole lot. The default |

The specification states that the sizing helpers round down by default and that
`order.roundToLot` rounds down "unless told otherwise", without naming the other
value. Rounding down is the default everywhere in the sizing group because a size
rounded up is a position larger than the script asked for, and that error compounds
with every entry.

```
version 1

strategy("Lot sized entry", overlay = true,
         capital = 500000, qty = 1, qtyType = "lots",
         product = "intraday", fillOn = "nextOpen",
         commissionType = "perTrade", commission = 20, slippage = 1)

stopPrice = low - atr(14)
orderSize = order.roundToLot(order.qtyForRisk(5000, close, stopPrice))

if pos.isFlat and crossUp(ema(close, 9), ema(close, 21))
    buy(qty = orderSize)
    exit(tag = "protect", stop = stopPrice, profit = 3 * atr(14))
```

---

## Study and strategy option vocabularies

### `format`, on `study()`, `strategy()` and `plot`

| Value | Formats the axis and crosshair as |
|---|---|
| `"price"` | A price. The default |
| `"percent"` | A percentage |
| `"volume"` | A quantity, abbreviated |

Setting `precision` or `format` on a plot changes the price scale that plot maps
to, so doing it on a plot drawn over the price pane reformats the instrument's own
axis. That is almost never wanted, and the compiler emits warning OS8007 when a
script does it.

### `instrumentType`, read from `chart.instrumentType`

| Value |
|---|
| `"equity"` |
| `"future"` |
| `"option"` |
| `"index"` |
| `"currency"` |
| `"commodity"` |
| `"other"` |

### `optionType`, read from `chart.optionType` (planned)

| Value | Means |
|---|---|
| `"call"` | A call option |
| `"put"` | A put option |
| `""` | Not an option, or the host has not said |

---

## Alert frequencies

The `frequency` argument of `alert`.

| Value | Means |
|---|---|
| `"oncePerBar"` | At most one alert per bar. The default |
| `"once"` | The first time only, for the life of this study instance |
| `"everyUpdate"` | On every execution of the bar. Requires `onUnconfirmed = true`, or OS3009 |

---

## Library vocabularies

Small closed sets that belong to one function each. Where the specification
writes a set out, the row says where rather than copying it.

| Vocabulary | Values | Used by |
|---|---|---|
| Moving average type | The types the `ma` row of [`stdlib.md`](../../spec/stdlib.md) section 4 names | `ma(src, len, type)` |
| Keltner basis type | `"ema"` and the same set | `keltner(..., maType)` |
| Sort order | `"asc"`, `"desc"` | `sort(arr, order)` |
| Input kind | The kinds the `kind` row of [`stdlib.md`](../../spec/stdlib.md) section 13.3 names | `input(..., kind)` |

`ma(src, len, type = "sma")` exists precisely so that a `select` input can switch
the shape of a study without the script writing a `switch` over one call per type,
each of which would be its own call site with its own state.

```
version 1

study("Switchable mean", overlay = true)

maType = input("ema", "Average", options = ["sma", "ema", "wma", "rma", "hma", "vwma"])
maLen  = input(21, "Length", min = 2, max = 500)

plot(ma(close, maLen, type = maType), "Mean", aqua)
```

---

## Where the specification is silent

Collected in one place, because a dictionary that quietly fills a gap is worse than
one that names it.

| Vocabulary | What is missing |
|---|---|
| `cell(align = ...)`, `draw.label(align = ...)` | Only the two defaults, `"left"` and `"center"`, are named |
| `order.place(side = ...)` | No accepted values are named |
| `order.place(type = ...)` | Only `"market"` is named |
| `order.roundToLot(direction = ...)` (planned) | Only `"down"` is named |
| The named colours' channel values | Fixed in the library manifest and the conformance suite, not in the specification text |

---

## See also

- [variables.md](./variables.md) for the built-in names these values are passed alongside
- [keywords.md](./keywords.md) for the reserved words, including `color` and `step`
- [operators.md](./operators.md) for how a `color` compares and what `+` does to a string
- [../README.md](../README.md) for the documentation index
- [../../spec/stdlib.md](../../spec/stdlib.md) for the functions that accept these values
- [../../spec/language.md](../../spec/language.md) for the colour literal grammar
