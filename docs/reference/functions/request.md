# Higher timeframe and other instrument functions

By the end of this page you will be able to read any expression computed on a
coarser interval or on another instrument, choose the mode that says what the
read is allowed to know, and tell at a glance whether a study repaints.

## The two reads

| Call | Returns | Warmup | For |
|---|---|---|---|
| `req.timeframe(timeframe, expr, mode = "confirmed")` | series of `expr`'s type | the first bar the mode allows | An expression computed on another interval of this instrument, coarser or finer |
| `req.symbol(symbol, timeframe, expr, exchange = chart.exchange, mode = "confirmed")` | series of `expr`'s type | the same, plus the host's answer | An expression computed on another instrument |
| `req.isReady(read)` | `series bool` | bar 0 | Whether the host has answered yet |
| `req.error(read)` | `series string` | bar 0 | The reason a read failed, or `""` |
| `req.candle(timeframe, mode)` (planned) | `array<number>` | as above | The whole higher timeframe bar at once, for drawing it |
| `req.events(kind)` (planned) | `series number` | host dependent | Dividends, splits and other scheduled events |

```
dayHigh = req.timeframe("1D", high)
dayRsi  = req.timeframe("1D", rsi(close, 14))
```

A read folds the chart's own bars up to the requested interval and runs `expr`
over them, so the result is a series on the chart's bars: one value per bar of
the chart you are looking at, changing when the coarser bar changes.

---

## 1. The calls

### `req.timeframe(timeframe, expr, mode = "confirmed")`

Read an expression computed on another interval, coarser or finer.
Parameters: `timeframe` `string` required, a timeframe code from section 3;
`expr` any expression, compiled as its own program over the requested bars;
`mode` `string` default `"confirmed"`, one of `"confirmed"`, `"developing"` or
`"lookahead"`.
Returns a series of `expr`'s type. Warmup: the first bar the mode allows, in
section 2.

```
plot(req.timeframe("1D", ema(close, 20)), "Daily EMA 20", orange, style = "step")
```

### `req.symbol(symbol, timeframe, expr, exchange = chart.exchange, mode = "confirmed")`

Read an expression computed on another instrument.
Parameters: `symbol` `string` required; `timeframe` `string` required; `expr`
any expression; `exchange` `string` default `chart.exchange`; `mode` `string`
default `"confirmed"`.
Returns a series of `expr`'s type. Warmup: as above, plus however long the host
takes to answer.

```
other = req.symbol(otherSymbol, "1D", close)
```

### `req.isReady(read)`

Whether the host has answered yet.
Parameters: `read` the value returned by a read.
Returns `series bool`. Warmup: bar 0.

```
if not req.isReady(other)
    background(fade(gray, 94))
```

### `req.error(read)`

The reason a read failed.
Parameters: `read` the value returned by a read.
Returns `series string`, `""` when there is no error. Warmup: bar 0.

```
if req.error(other) != ""
    print("Comparison read failed: " + req.error(other))
```

### `req.candle(timeframe, mode)` (planned)

The whole higher timeframe bar at once, for drawing it.
Parameters: `timeframe` `string` required; `mode` `string` required.
Returns `array<number>`. Warmup: as the other reads.

```
c = req.candle("1D", "confirmed")
```

### `req.events(kind)` (planned)

Dividends, splits and other scheduled events.
Parameters: `kind` `string` required.
Returns `series number`. Warmup: host dependent.

```
dividend = req.events("dividend")
```

---

## 2. The mode, which is the whole point

**`mode` decides what the read is allowed to know, and it is the argument that
makes a repainting study impossible to write by accident.**

| Mode | What it reads | Repaints | Warmup |
|---|---|---|---|
| `"confirmed"` | Only higher timeframe bars that have closed | Never | Absent until the first higher timeframe bar has closed, then the value changes only when the next one closes |
| `"developing"` | Includes the higher timeframe bar currently forming | On the newest bars only, within the current higher timeframe period | Absent until the first higher timeframe bar has begun |
| `"lookahead"` | A higher timeframe bar's final value from its first lower timeframe bar | On history, permanently and by design | Absent only where the higher timeframe bar does not exist |

`"confirmed"` is the default, and it is the only mode that never repaints. The
other two have to be written out. That is the whole mechanism: a script that
repaints says so on the line that causes it, in a word a reader will see during
review, and a script that says nothing cannot repaint.

The compiler emits warning OS8002 on a `"developing"` read and warning OS8005 on
a `"lookahead"` read, each naming the line and what the study will now do. A
`"lookahead"` read also marks the compiled study as repainting, and the host
shows that mark in the legend, because a warning in an editor nobody opens again
is not a disclosure.

`"lookahead"` exists at all because drawing the completed higher timeframe
candle across history is a legitimate picture, and a language that refused it
would push people to do the same thing worse. It is named so that nobody reaches
it without meaning to.

### What the three modes look like on a chart

Take a five minute chart reading `req.timeframe("1D", high)`.

| Mode | On a bar at 11:00 today, the value is |
|---|---|
| `"confirmed"` | Yesterday's high, unchanged all day |
| `"developing"` | Today's high so far, which can rise later in the day |
| `"lookahead"` | Today's final high, known at 09:15, which no one could have known then |

Only the first is a number a script could have acted on at 11:00. The second is
honest about the present and moves on the newest bars. The third is a statement
about the future on every bar of history, which is why it is marked.

---

## 3. Timeframe strings

A timeframe is a count and a unit.

| Form | Means |
|---|---|
| `"1m"`, `"5m"`, `"15m"` | Minutes |
| `"1h"`, `"4h"` | Hours |
| `"1D"` | One day |
| `"1W"` | One week |
| `"1M"` | One month |
| `"60"` | A bare number is read as minutes, so this is the same as `"1h"` |

The unit letters are case sensitive: `"1M"` is one month and `"1m"` is one
minute. The bare number form exists because that is what an interval input
supplies, so a value straight out of the settings dialog can go straight into a
read.

An unrecognised timeframe is OS6001. On an intraday chart any whole number of
minutes reads, coarser or finer than the chart's own: a whole multiple of the
chart's interval is folded from the chart's bars, and any other interval from
finer bars the host serves, so on a host that serves none it is OS6015 for a
coarser one and OS6002 for a finer one. On a chart of a day or longer, a
timeframe finer than the chart's is OS6002, because a daily chart does not
contain the five minute bars that made it. See
[higher timeframes](../../data/higher-timeframes.md).

---

## 4. What an expression means inside a read

The `expr` argument is compiled as a separate program over the requested bars.
Inside it, the built-in series are the requested instrument's, at the requested
timeframe. `close` inside a `req.timeframe("1D", ...)` is the daily close, not
this chart's close.

```
dayHigh    = req.timeframe("1D", high)
dayRsi     = req.timeframe("1D", rsi(close, 14))
indexTrend = req.symbol(other, "1D", ema(close, 20) > ema(close, 50))
```

A name from the file scope may be read inside `expr` only when it is a
compile-time constant: a literal, arithmetic over literals, or an `input()`.
Reading a per-bar name is OS6003, because a value computed on this chart's bars
has no counterpart on the requested bars and there is no honest answer for what
it would mean there.

```
len = input(14, "Length")
ok  = req.timeframe("1D", rsi(close, len))      // len is an input: allowed

myAtr = atr(14)
bad   = req.timeframe("1D", close > myAtr)      // OS6003
```

An order function inside `expr` is OS7003. Drawing and alert calls inside `expr`
are OS3006. A read computes a value; it does not act and it does not draw.

---

## 5. Waiting for the host

A `req.symbol` read cannot complete until the host supplies the other
instrument's bars, which is not instant. Until then the read is absent, the
study reports itself as loading, and the engine recalculates when the bars land.
A refusal is reported and is never an empty answer, because an empty series looks
exactly like an instrument that did not trade. An instrument the host does not
know is OS6007, one it resolved with no bars over the chart's range is OS6008,
and a source that refused or did not answer is OS6009 carrying the host's own
reason. Each of them leaves the read absent and puts its reason in
`req.error(...)`.

A host that serves no requests at all is a different case and is settled before
the first bar: it gives its engine no `req.symbol` capability, so a file that
reads another instrument is refused at load with OS6006 naming the capability
rather than drawing a study with a silently empty line through it.

The study keeps drawing everything that does not depend on the read, which is
why a comparison study should be written so that its own instrument's plots do
not pass through the read. A reader then sees a chart that works with one panel
missing, rather than a blank pane.

---

## 6. Three worked examples

### A daily bias on an intraday chart

```
version 1
study("Higher timeframe bias", overlay = true)

tf   = input("1D", "Bias timeframe", kind = "interval")
fast = input(20, "Fast length", min = 2, max = 200)
slow = input(50, "Slow length", min = 2, max = 400)

// The default mode is "confirmed", so the bias changes only when a bar of the
// chosen timeframe closes, and the value on a historical bar is the value a
// script would have had at the time.
biasUp = req.timeframe(tf, ema(close, fast) > ema(close, slow))

// Absent until the first higher timeframe bar has closed, and an absent
// condition takes the false branch, so nothing is painted during warmup.
barColor(isNone(biasUp) ? none : (biasUp ? lime : red))

plot(req.timeframe(tf, close), "Timeframe close", silver, style = "step")
```

### Another instrument, with the wait handled

```
version 1
study("Relative strength", precision = 4)

otherSymbol = input("", "Compare with")

other = req.symbol(otherSymbol, chart.interval, close)

ratio = close / other

plot(ratio, "Ratio", aqua)

// Three states, three different pictures: no symbol chosen, chosen and still
// loading, chosen and refused. Each one is a different thing for the reader to
// do, so each one says something different.
if otherSymbol == ""
    background(none)
else if req.error(other) != ""
    background(fade(red, 90))
else if not req.isReady(other)
    background(fade(gray, 94))
```

The ratio divides by a value that is absent while the host is answering, so the
plot simply starts when the answer lands. Nothing else in the study depends on
the read, so the pane is still useful while it waits.

### Drawing the completed higher timeframe candle, on purpose

```
version 1
study("Daily candle", overlay = true)

// "lookahead" reads a higher timeframe bar's final value from its first lower
// timeframe bar. On history that is a value no script could have had, which is
// why this study is marked as repainting in the legend. It is the right mode
// for drawing the finished candle and the wrong mode for any decision.
o = req.timeframe("1D", open,  mode = "lookahead")
h = req.timeframe("1D", high,  mode = "lookahead")
l = req.timeframe("1D", low,   mode = "lookahead")
c = req.timeframe("1D", close, mode = "lookahead")

plotCandles(o, h, l, c, "Daily", colorUp = fade(lime, 60), colorDown = fade(red, 60))
```

If any part of a study that takes a decision uses `"lookahead"`, the backtest of
that study is worthless and will look excellent. The mode argument is not a
performance knob; it is a statement about what the study knew, and the only
mode a signal, an alert or an order should ever be built on is `"confirmed"`.

## See also

- [ta.md](./ta.md) for the expressions most reads compute
- [input.md](./input.md) for the interval input that feeds `timeframe`
- [series.md](./series.md) for `chart.interval`, `chart.exchange` and the built-in series a read redefines
- [drawing.md](./drawing.md) for `plotCandles`, which draws what `req.candle` will return
- [strategy.md](./strategy.md) for why an order should only ever see a confirmed read
- [../../../spec/stdlib.md](../../../spec/stdlib.md) for the specification these entries are derived from
