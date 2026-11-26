# Higher timeframes

By the end of this page you can read a value computed on another interval from
a script running on a chart, coarser or finer than the chart's own, choose
knowingly between the three modes such a read must declare, and say what each
mode returns on a bar that has not finished.

## What folding means

A study on a five minute chart is executed once per five minute bar. A daily
value has no five minute counterpart, so asking for one is asking two separate
questions:

1. Compute this expression on daily bars.
2. Give me the answer that was available on each five minute bar.

`req.timeframe` answers both. The chart's bars are grouped into coarse bars, the
expression is computed over those coarse bars, and the result is sampled back
onto the chart's own bars, one value per chart bar. That grouping is the fold.

When the requested interval is a whole multiple of the chart's, such as thirty
minutes on a ten minute chart, every coarse bar holds whole chart bars and the
chart's own bars are folded. When it is not, such as fifteen minutes on a ten
minute chart, a coarse bar would end halfway through a chart bar, so the read is
folded from finer bars the host serves instead: the **base** interval, the
longest one that divides both, which is five minutes here. The same is true of an
interval finer than the chart's, such as three minutes on a ten minute chart,
whose base is one minute. You write the same call in every case; where the bars
come from is the engine's business.

```
req.timeframe(timeframe, expr, mode = "confirmed")
```

| Argument | Type | Means |
|---|---|---|
| `timeframe` | `string` | The coarse interval, written as in [timeframes.md](./timeframes.md) |
| `expr` | any | An expression evaluated on the coarse bars |
| `mode` | `string` | `"confirmed"`, `"developing"` or `"lookahead"`, section below |

The call returns a series of whatever `expr` produced: a `series number` for a
price or an average, a `series bool` for a comparison, a `series string` for a
formatted label.

## The rules the timeframe argument must satisfy

| Rule | What happens when it is broken |
|---|---|
| The timeframe must be a form the language knows | OS6001 at compile time, naming the value |
| On a chart of a day or longer, it must not be finer than the chart's interval | OS6002, naming both intervals |
| An intraday request that is not a whole multiple of an intraday chart's interval needs a host that serves bars | On a host that serves none, OS6015 for a coarser one and OS6002 for a finer one |
| Day, week and month requests are folded by the calendar, keyed by the civil date in the instrument's timezone | Always folded from the chart's own bars |
| The symbol and timeframe of a request are fixed before bar 0 | OS6013 if they change mid-run |
| The host must be able to serve the base interval for this instrument | The read is absent, and `req.error` names the interval with OS6014's sentence |

Neither refusal is about the arithmetic any more: on an intraday chart any whole
number of minutes reads, fifteen and twenty five on a ten minute chart included,
and so does three. What is refused is a read that needs bars nobody can supply.
A host that serves no bars of its own can only fold the chart's, and an engine
that filled the gap would be inventing prices, which is the definition of a
repainting study, so the request is refused instead of approximated. On such a
host, put the chart on the finest interval you need and fold upward.

OS6013 is the same principle applied to the request itself. The host fetches a
requested series once, keyed by symbol and timeframe, and keeps it in step with
the chart. A request whose identity changed on bar 4000 would need a second
fetch for bars already drawn. So the timeframe comes from a literal or an
`input()`, never from bar data:

**Not raised yet.** OS6013 is in the catalogue and nothing raises it: a read's
identity is settled once before bar 0 and nothing asks again.

```
// Refused: the timeframe depends on this bar's prices.
tf = close > open ? "1h" : "1D"
h = req.timeframe(tf, high)

// Correct: the timeframe is fixed before the first bar runs.
tf = input("1h", "Higher timeframe", kind = "interval")
h = req.timeframe(tf, high)
```

## Where a coarse bar begins

An intraday coarse bar is counted from the open of the trading day: the
session's open where the host states the instrument's session, and midnight in
its timezone where it states none. On a market that opens at 09:15, sixty minute
bars run 09:15 to 10:15, 10:15 to 11:15 and so on, the same candles the venue and
a sixty minute chart show, and the last one of the day is whatever is left before
the close. A period that does not divide a day, such as twenty five minutes,
begins at the open every day rather than drifting.

## Reading a finer interval

A read finer than the chart's interval answers the last of its bars that closed
by the chart bar's close. On a ten minute chart, the bar from 09:15 to 09:25
holds the three minute bars that began at 09:15, 09:18 and 09:21, and the one
from 09:24 still forming when it closes:

```
lastThree  = req.timeframe("3", close)                         // the 09:21 bar's close
stillGoing = req.timeframe("3", close, mode = "developing")   // the 09:24 bar so far
```

Use it for what a finer interval says that the chart's own bar cannot: the
direction of the last few minutes inside a longer bar, or a finer average
sampled once per chart bar.

## What the expression means inside a read

`expr` is compiled as a separate program over the requested bars. Inside it,
`open`, `high`, `low`, `close`, `volume` and `time` are the **coarse** bars', and
every library call reads coarse bars.

```
dayHigh   = req.timeframe("1D", high)                 // the day's high so far
dayTrend  = req.timeframe("1D", ema(close, 20))       // 20 daily closes
dayStrong = req.timeframe("1D", close > open)         // a bool, folded
```

`req.timeframe("1D", ema(close, 20))` is a twenty period average of daily
closes, sampled onto every bar of the chart. It is **not** the same series as
`ema(close, 20)` computed on the chart's own bars, and it is not close to it
either. That is the whole reason to make the read: you want the coarse
instrument's own answer, not a longer average of fine bars.

Two restrictions apply inside `expr`:

- **A name from the file scope may be read only when it is a compile-time
  constant**: a literal, arithmetic over literals, or an `input()`. Reading a
  per-bar name is an error, because a value computed on this chart's bars has no
  counterpart on the coarse bars and there is no honest answer for what it would
  mean there. A `var` initialised from an `input()` is a per-bar name, because a
  later line may change it.
- **An `input()` may be written inside `expr` itself**, not only behind a name.
  It is the same setting and the same dialog row, resolved before the body runs.
- **Orders, drawings and alerts do not belong inside `expr`.** The expression is
  a calculation over another set of bars, not a second script with its own
  effects.

```
len = input(20, "Length", min = 2, max = 500)
ok  = req.timeframe("1D", ema(close, len) > ema(close, len * 2))   // legal
same = req.timeframe("1D", ema(close, input(20, "Coarse length")))  // also legal

atrNow = atr(14)
bad = req.timeframe("1D", close > atrNow)   // refused: atrNow is a per-bar name
```

### History inside the read and history outside it

This is the single most common mistake with a coarse read, and the rule is one
sentence: **`[]` inside `expr` counts coarse bars, and `[]` on the result counts
chart bars.**

```
lastDay  = req.timeframe("1D", high)          // yesterday's high: the last day that closed
dayBefore = req.timeframe("1D", high[1])      // the day before that: coarse history
soFar    = req.timeframe("1D", high, mode = "developing")   // today, as it stands
oneBack  = lastDay[1]                         // the value one CHART bar ago
```

The default mode is `"confirmed"`, so `lastDay` is **the last day that closed**,
which on any bar of today is yesterday. Read that sentence twice before writing a
`[1]` inside a read: `dayBefore` is a day further back again, and a script that
wrote it meaning "yesterday" would draw a level from the wrong session and never
look wrong.

On a five minute chart `lastDay[1]` is the value the read held five minutes ago,
which is the same value on every bar of the day except the first, because a
confirmed read steps only when a coarse bar closes.

| Expression | Counts | On a 5m chart at 11:20 it holds |
|---|---|---|
| `req.timeframe("1D", high)` | Coarse bars | Yesterday's high, the last day that closed |
| `req.timeframe("1D", high[1])` | Coarse bars | The high of the day before yesterday |
| `req.timeframe("1D", high, mode = "developing")` | Coarse bars | Today's high so far |
| `req.timeframe("1D", high)[1]` | Chart bars | Yesterday's high again: what the read held at 11:15 |

## The mode, which is the point of the whole section

A coarse bar takes many chart bars to form. On any chart bar inside it, there
are exactly three things a read can hand back, and `mode` names which one.

| Mode | It reads | On the forming coarse bar it returns | Repaints | Absent until |
|---|---|---|---|---|
| `"confirmed"` | Only coarse bars that have closed | The **last closed** coarse bar's value, held constant | Never | The first coarse bar has closed |
| `"developing"` | The coarse bar currently forming | The value **so far** of the coarse bar this chart bar is inside | On the newest bars only, inside the current coarse period | The first coarse bar has begun |
| `"lookahead"` | The coarse bar's finished value | The **final** value of the coarse bar this chart bar is inside | On history, permanently and by design | Only where the coarse bar does not exist |

`"confirmed"` is the default, and it is the only one that never repaints. The
other two have to be written out in the source. That is the entire mechanism: a
script that repaints says so on the line that causes it, in a word a reviewer
will see, and a script that says nothing cannot repaint.

The compiler warns on a `"developing"` read and on a `"lookahead"` read, naming
the line and saying what the study will now do. A `"lookahead"` read also marks
the compiled study as repainting, and the host shows that mark in the legend,
because a warning in an editor nobody opens again is not a disclosure.

### The same hour, read three ways

A five minute chart, a `"1h"` request, and one hour of trading. The hourly bar
that runs from 10:00 to 11:00 opens at 100.0, works up to 104.0 and closes
there. The hour before it closed at 101.0.

| Chart bar | Confirmed | Developing | Lookahead |
|---|---|---|---|
| 10:00 | 101.0 | 100.2 | 104.0 |
| 10:15 | 101.0 | 100.9 | 104.0 |
| 10:30 | 101.0 | 102.4 | 104.0 |
| 10:55 | 101.0 | 103.8 | 104.0 |
| 11:00 | 104.0 | 104.1 | the 11:00 hour's close |

Read the columns, not the rows.

- **Confirmed** is flat for the whole hour and steps once, at 11:00, to the
  value the 10:00 hour finished at. Everything it shows at 10:30 was knowable at
  10:30. It is one hour behind by construction, and that lag is the price of
  never being wrong about the past.
- **Developing** moves with the market. At 10:30 it says what the hour has done
  so far, which is a true statement and a useful one. It is also a statement
  that will change: a signal taken at 10:30 can be withdrawn at 10:35, and the
  live chart and a backtest of the same data will not agree about it.
- **Lookahead** shows 104.0 at 10:00, which nobody could have known at 10:00. On
  a historical chart this column is beautiful: every breakout is anticipated,
  every trend is entered at the open. It is the shape of a study that looks
  brilliant in history and loses money live.

### The three modes in one script

Put them on the chart together once, and the difference stops being an
abstraction.

```
version 1

study("Three readings of one hour", overlay = true, precision = 2)

tf = input("1h", "Coarse interval", kind = "interval")

// Three reads of the same expression at the same interval. Each is a separate
// request, which is fine here because the point of this study is the
// comparison; a working study makes one read and reuses the name.
confirmed  = req.timeframe(tf, close, mode = "confirmed")
developing = req.timeframe(tf, close, mode = "developing")
lookahead  = req.timeframe(tf, close, mode = "lookahead")

// Step, not line. Each of these changes at most once per coarse bar, and a
// sloping line between two readings would draw intermediate values that were
// never read.
confirmedPlot = plot(confirmed,  "Confirmed",  aqua,   width = 2, style = "step")
plot(developing, "Developing", orange, width = 2, style = "step")
lookaheadPlot = plot(lookahead,  "Lookahead",  red,    width = 2, style = "step")

// On history the lookahead line sits on top of a value the chart had not
// reached yet, and the gap between it and the confirmed line is exactly how
// much this study would be cheating if it traded from the red line.
fill(lookaheadPlot, confirmedPlot, fade(red, 90))
```

Leave that on a chart for one session and the `"lookahead"` line will be ahead
of price at every turn. That is not a bug in the mode. It is what the mode does,
which is why it has a name nobody types by accident.

### When each mode is the right answer

| You want | Mode | Because |
|---|---|---|
| A trend filter a strategy trades from | `"confirmed"` | Only a closed bar is a fact, and the backtest must be the live run |
| The day's range so far, on a dashboard | `"developing"` | The trader is reading it, not trading it, and "so far" is the question |
| A finished coarse candle drawn across history, for a picture | `"lookahead"` | The picture is the point and it is disclosed in the legend |
| Yesterday's high as a level | `"confirmed"`, which is the default | It takes the last day that closed, and nothing about a closed day can change |

## Warmup, and the left edge of the chart

A confirmed read is absent until the first coarse bar has **closed**. On a five
minute chart with a `"1D"` request, that is the whole of the first day: the
study's first value appears at the open of the second day. If the coarse
expression itself has a warmup, add it. `req.timeframe("1D", ema(close, 20))` in
confirmed mode needs twenty closed daily bars, so on an intraday chart the line
starts about a month in.

This is worth stating in the study's own comments, because a user who loads five
days of intraday history and sees an empty pane will blame the script rather
than the history.

Absence propagates, so guard comparisons rather than assuming a false:

```
bias = req.timeframe("1D", ema(close, 20))

// close > bias is absent during warmup, not false, and an absent condition
// takes the false branch. Both of these are skipped on a warming up bar, which
// is what you want, but the two names below are also absent, so write them out
// rather than relying on one being the complement of the other.
up   = not isNone(bias) and close > bias
down = not isNone(bias) and close < bias
```

## A working example: a coarse bias on a fine chart

```
version 1

study("Higher timeframe bias", overlay = true, precision = 2)

biasTf  = input("1D", "Bias interval", kind = "interval")
biasLen = input(20,   "Bias average length", min = 2, max = 500)
paint   = input(true, "Recolour the candles")

// The mode is a literal, not an input, and that is deliberate: an input would
// let a user change the honesty of the study from the settings dialog without
// reading a line of it.
biasClose   = req.timeframe(biasTf, close, mode = "confirmed")
biasAverage = req.timeframe(biasTf, ema(close, biasLen), mode = "confirmed")

up   = not isNone(biasAverage) and biasClose > biasAverage
down = not isNone(biasAverage) and biasClose < biasAverage

plot(biasAverage, "Bias average", orange, width = 2, style = "step")

barColor(paint ? (up ? lime : down ? red : none) : none)
background(up ? fade(lime, 95) : down ? fade(red, 95) : none)

// This file does not set onUnconfirmed, so a signal waits for the chart bar to
// close. Setting it would make the compiler warn about both reads above, with
// OS8002, and it would be right to: an unconfirmed fine bar reading a coarse
// bar is where repainting comes from even when the mode is honest.
if up and not orElse(up[1], false)
    signal("BIAS UP")

if down and not orElse(down[1], false)
    signal("BIAS DOWN")
```

`orElse(up[1], false)` rather than `up[1]` is not decoration. On bar 0 the
history is absent, `not none` is `none`, and an absent condition takes the false
branch, so the very first flip of the dataset would go unmarked.

## Previous session levels, which is mostly what people want

Most "higher timeframe" studies are really "yesterday's numbers" studies. Those
are a confirmed read, which is the default, and they are completely safe:
yesterday closed, so nothing about it can change. No `[1]` is needed inside the
expression, because a confirmed read is already reading the last day that closed;
adding one would take the day before that.

```
version 1

study("Previous day levels", overlay = true, precision = 2)

// One request per distinct symbol and timeframe. Each of these is a separate
// series the host fetches and keeps in step with the chart, and a host has a
// ceiling on how many a file may make: exceeding it is OS5006, not a silent
// drop, because a dropped request is a plot that quietly turns absent.
prevHigh  = req.timeframe("1D", high)
prevLow   = req.timeframe("1D", low)
prevClose = req.timeframe("1D", close)

// The midpoint is computed here, from the three values already fetched, rather
// than as a fourth request. A request is the expensive part; arithmetic is not.
prevMid = (prevHigh + prevLow) / 2

prevHighPlot = plot(prevHigh,  "Previous high",  aqua,   width = 2, style = "step")
prevLowPlot  = plot(prevLow,   "Previous low",   orange, width = 2, style = "step")
plot(prevClose, "Previous close", silver, width = 1, style = "step")
plot(prevMid,   "Previous mid",   fade(silver, 50), width = 1, style = "step")
fill(prevHighPlot, prevLowPlot, fade(aqua, 94))
```

If either of the two extremes is absent, the midpoint is absent too, because
absence propagates through arithmetic. That is the behaviour you want: half a
midpoint is not a level.

## The cost of a read

Each distinct symbol and timeframe is one series the host fetches and keeps in
step with the chart. The costs are:

- **A ceiling on requests per file.** Exceeding the host's limit is OS5006,
  which names how many the file makes and how many are allowed. Keep one request
  per symbol and timeframe, assign it to a name, and reuse the name.
- **A recalculation when an answer lands**, for a request the host has to fetch.
  See [other-instruments.md](./other-instruments.md), where that matters more.
- **Nothing per bar worth worrying about.** Once the folded series exists,
  reading it is a lookup. A study that makes three reads and does arithmetic on
  them is cheap; a study that makes thirty reads is a study to rewrite.

Drawing the coarse bar as a candle currently takes four reads, one per price,
fed to `plotCandles`. A single call that returns the whole coarse bar,
`req.candle`, is listed in the library as planned for exactly this reason.

## Higher timeframe reads and the moving bar

By default, a signal, an alert or an order does not fire on a chart bar that is
still moving: the call is deferred until the bar closes, and if the condition is
no longer true by then it never happens. A study or strategy opts out with
`onUnconfirmed = true`, and when it does, the compiler warns about every higher
timeframe read in the file with OS8002:

> This file sets onUnconfirmed = true and reads {timeframe}; together they
> repaint.

The reason is stacked uncertainty. The chart bar is still moving, so its own
`close` will change. The coarse bar is unfinished, so the read may change. Acting
on the pair means acting on a value that has two ways of being withdrawn. The
fix is in the warning: drop `onUnconfirmed = true`, or guard every use of the
read with `bar.isConfirmed`.

## See also

- [repainting.md](./repainting.md) for the full account of what repainting is,
  the four ways a script causes it, and when it is legitimate
- [timeframes.md](./timeframes.md) for interval strings, the chart's own
  interval, and converting a period in time into bars
- [other-instruments.md](./other-instruments.md) for reading another
  instrument's bars, which uses the same modes and adds a fetch
- [sessions-and-time.md](./sessions-and-time.md) for when a daily fold, which
  follows the civil date, is the session and when midnight splits one
- [../README.md](../README.md) for the rest of the documentation
