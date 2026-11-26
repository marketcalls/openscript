# OpenScript standard library specification

Version of this document: draft, tracking language version 1.

`language.md` fixes the syntax, the types, the per-bar execution model and the
shape of the library. This document is the catalogue: every name a script can
call, what it returns, the first bar it can honestly produce a value for, and
what it is for.

The two documents are one specification. Where this one and `language.md`
disagree about a rule of the language, `language.md` wins. Where they disagree
about a function, this one wins. Error codes quoted here are defined in
`errors.md`, which is authoritative for their text.

## Contents

1. [How to read an entry](#1-how-to-read-an-entry)
2. [Rules that apply to the whole library](#2-rules-that-apply-to-the-whole-library)
3. [Bar data and instrument facts](#3-bar-data-and-instrument-facts)
4. [Moving averages and trend](#4-moving-averages-and-trend)
5. [Momentum and oscillators](#5-momentum-and-oscillators)
6. [Volatility and ranges](#6-volatility-and-ranges)
7. [Volume](#7-volume)
8. [Maths and rounding](#8-maths-and-rounding)
9. [Series helpers](#9-series-helpers)
10. [Strings and formatting](#10-strings-and-formatting)
11. [Colour](#11-colour)
12. [Time, session and calendar](#12-time-session-and-calendar)
13. [Inputs](#13-inputs)
14. [Drawing and output](#14-drawing-and-output)
15. [Higher timeframe and other instrument reads](#15-higher-timeframe-and-other-instrument-reads)
16. [Alerts](#16-alerts)
17. [Orders, legs and strategy risk](#17-orders-legs-and-strategy-risk)
18. [The chart contract map](#18-the-chart-contract-map)
19. [What is deliberately not here](#19-what-is-deliberately-not-here)
20. [The arithmetic](#20-the-arithmetic)

---

## 1. How to read an entry

Every entry is a row in a table with four columns.

| Column | Holds |
|---|---|
| Call | The name and its parameters, with defaults where they exist |
| Returns | The type of the result |
| Warmup | The first bar the call can produce a value for, counting the oldest bar as 0 |
| For | One line on what it is for |

**Warmup is a promise, not a hint.** A warmup of "bar `n - 1`" means the call
returns `none` on bars `0` to `n - 2` and a value from bar `n - 1` onward, and
that a conforming engine returns `none` on exactly those bars and no others.
"Bar 0" means the call produces a value on the very first bar. Two engines that
disagree about a single warmup bar fail the conformance suite, which is the point
of writing the lengths down rather than saying "after a while".

Warmup is stated in bars of the call's own source. A call whose source is itself
absent on a bar is absent on that bar too, by the propagation rule of
`language.md` section 6.7, so warmups compose: `sma(ema(close, 10), 10)` is
absent until bar 18.

**A call marked `(planned)` is not in the first release.** It is listed so the
surface is legible: a script author can see that the gap is known and named
rather than guess whether it was forgotten. Calling one is OS2001 with a message
saying it is planned, not a message saying the name does not exist.

---

## 2. Rules that apply to the whole library

### 2.1 Bare names and namespaces

Everyday functions are bare, as `language.md` section 15.2 requires:
`ema(close, 9)`, `highest(high, 20)`, `plot(x, "X", aqua)`. The namespaces are
the ones `language.md` section 15.2 lists, and they hold the long tail. `leg` and
`book` exist only in a `strategy()` file, section 17. A function is bare when a
script that does nothing unusual reaches for it on most days, and namespaced
otherwise. There is no third rule, and the split is settled per function here
rather than left to taste.

Every name in this document, bare or namespaced, lives in the global scope, so
assigning to one is OS2002 (`language.md` section 12.4).

### 2.2 Overloads

**A bare name may carry more than one signature, and the signatures must differ
in arity or in argument type.** The checker resolves the call at compile time;
there is no run-time dispatch.

```
sum(prices)             // array<number> -> number, the whole array
sum(close, 20)          // series, length -> series number, a 20 bar window
```

A call that matches no signature is OS3001 when the arity is wrong and OS3011
when an argument's type is wrong. OS3001 names the signature the call was checked
against; OS3011 names the argument and the type it wanted. Overloading is allowed
because `min(a, b)` and `min(arr)` are the same idea and two names for one idea
is worse than one name with two shapes; it is limited to arity and type so the
resolution is mechanical and a reader can do it by eye.

### 2.3 Functions with more than one output

**A function with more than one output returns an `array<number>` holding this
bar's outputs, in the order the entry documents.**

```
m = macd(close, 12, 26, 9)
plot(m[0], "MACD", aqua)
plot(m[1], "Signal", orange)
plot(m[2], "Histogram", gray, style = "histogram")
```

**The returned array itself is never absent and never changes length.** Each
element carries its own warmup and is `none` until it is reached. An array whose
length grew as warmup completed would make `m[1]` an out-of-range error on early
bars, which is a worse failure than an absent value, and a script that indexed it
would break at the left edge of the chart only.

The alternative, one named function per output (`macdLine`, `macdSignal`,
`macdHist`), was rejected because three calls are three call sites and therefore
three independent state slots by `language.md` section 11.4, so the shared
smoothing would be computed three times per bar.

A multi-output call assigned to a top-level name has history in the array sense
described in `language.md` section 9.6: `m[0]` is element 0 of this bar's array,
and `history(m, 1)` is the whole array as it stood one bar ago.

### 2.4 Absence

Every windowed function propagates absence: if any bar in the window is absent,
that bar's result is absent. The three functions that deliberately ignore absent
values are `sumSkip`, `avgSkip` and `countPresent`, and they say so in their
names, per `language.md` section 6.7.

A function whose result has no finite real value returns `none` rather than
raising: `log(0)`, `sqrt(-1)`, a division by zero inside a ratio study. A
function whose *arguments* are wrong raises instead: a negative length is OS3004
at compile time when it is a literal and OS4003 at run time when it is not.

### 2.5 Length arguments

A length argument must be a whole number of 1 or more. A fractional length is
OS3004 with the fix naming `round`, never a silent truncation, because a length
of 14.5 is a bug in the script and rounding it hides the bug. A length of 0 or
below is OS3004. A length may be a series, in which case it is read per bar and
the warmup is measured against the largest value the length has taken since the
start of the dataset, which is the only definition that does not require the
engine to see the future.

For a finite window, the selected values and divisor use the current length,
while readiness requires at least the largest valid length observed by this call
site. Only executions of the call contribute values to its history, as section
20.1 specifies. A shorter length does not restart that history or shorten its
warmup. A larger length reads the earlier contributions it now needs. An absent
length produces absence but still contributes the source value and retains the
previous maximum length.

Distance reads follow the same readiness rule using `distance+1` contributions.
`history`, `change`, `mom` and `roc` select the current distance after the largest
observed distance is ready. For source `[1,2,4,8]` with distances `[3,1,1,1]`,
history is `[none,none,none,4]`, change and momentum have the same readings, and
rate of change is `[none,none,none,100]`. Intervening holes keep their positions;
only the selected endpoints need to be present.

For `sum` over source values `1, 2, 3, 4, 5`, these per-execution lengths give:

| Lengths | Outputs |
|---|---|
| `5, 2, 2, 2, 2` | `none, none, none, none, 9` |
| `2, 2, 2, 5, 5` | `none, 3, 5, none, 15` |
| `none, none, 3, 3, 3` | `none, none, 6, 9, 12` |

Source holes still occupy their positions. The absence rule in section 2.4 and
the explicitly skipping functions apply to the selected window after readiness
has been established. These examples specify finite windows; seeded recurrences
also follow the seed and continuation rules in section 20.2.2.

### 2.6 Rounding and reproducibility

Every function in this document is an exact arithmetic recipe over binary64 in
source order, under the determinism rule of `language.md` section 7.6. **Section
20 is that recipe**: the seed, the step, the accumulation order and what is
summed before what, for every function whose result depends on the order of its
operations, and a statement that the order does not matter for the rest. A
warmup, an argument and a purpose are what an entry in sections 3 to 17 holds; a
second engine needs section 20 as well, and reading only the entry is how two
engines come to disagree in the last bit while both look right.

Where a statistic can be defined two ways, the entry says which one and the other
is available through a named argument. Nothing here is "the usual definition",
and section 20 names the arrangement it is not wherever one is in common use.

### 2.7 Where a call lands in the chart contract

A compiled study is handed to the host chart as a descriptor: a data structure
with fields for the plotted columns, the shaded bands, the levels, the markers,
the table, the free drawings, the pane background, the price bar colours, the
alerts, the fixed pane range and the settings inputs. Sections 13 to 17 name the
field each call lands in, in a **Lands in** column, and section 18 collects the
whole map in one table.

The calculation groups, sections 4 to 11, have no such column. They are pure
computation and reach the contract only through whatever `plot` does with them,
that is as one column of the descriptor's computed values.

---

## 3. Bar data and instrument facts

### 3.1 Built-in series

Available as bare names in every script, one value per bar, with history through
`[]`.

| Call | Returns | Warmup | For |
|---|---|---|---|
| `open` | `series number` | bar 0 | The bar's opening price |
| `high` | `series number` | bar 0 | The bar's highest traded price |
| `low` | `series number` | bar 0 | The bar's lowest traded price |
| `close` | `series number` | bar 0 | The bar's closing price, the last price on a bar still forming |
| `volume` | `series number` | bar 0 | Quantity traded in the bar, absent where the host supplies none |
| `hl2` | `series number` | bar 0 | `(high + low) / 2`, the bar's midpoint |
| `hlc3` | `series number` | bar 0 | `(high + low + close) / 3`, the typical price |
| `ohlc4` | `series number` | bar 0 | `(open + high + low + close) / 4`, the average price |
| `hlcc4` | `series number` | bar 0 | `(high + low + close + close) / 4`, close-weighted average |
| `oi` | `series number` | bar 0 | Contracts outstanding at the end of the bar, absent where the host supplies none |
| `time` | `series number` | bar 0 | The bar's opening instant, UTC milliseconds |
| `timeClose` (planned) | `series number` | bar 0 | The instant the bar's interval ends |

`volume` is absent, not zero, on an instrument the host has no volume for. Zero
is a real reading that means nobody traded, and an index that never reports
volume at all is a different fact; conflating them would make a volume study
silently draw a flat line. Test with `chart.hasVolume` before branching on it.

`oi` follows the same absence rule and `chart.hasOpenInterest` is its test. A cash
instrument has no open interest at all, while zero is a real reading on a contract
nobody is holding.

**`oi` is a level and `volume` is a flow, and every rule about folding bars
follows from that.** Volume is quantity traded *during* a bar, so a coarser bar's
volume is the sum of the bars inside it. Open interest is a position *as at* the
bar, so a coarser bar's is the **last** of them, never the sum. An engine that
adds five one-minute readings together produces a number five times too large that
still looks entirely plausible on a chart, which is the worst kind of defect: no
exception, no visible break, just a wrong number somebody trades on. The same
distinction governs `req.timeframe` (section 15) and any host that builds bars
from ticks.

Open interest is what makes a position reading of a derivative possible at all:
price rising with open interest rising is new money taking a side, and price
rising with open interest falling is an old position being closed. Neither is
expressible from price and volume alone.

### 3.2 `close` is the one name with two roles

`close` read bare is the bar's closing price. `close(...)` written as a call is
the order function of section 17 that flattens the position. The checker tells
them apart by syntax, which is unambiguous at compile time, and both spellings
are the ones a trader expects. The consequence, stated so it is not discovered:
`close` cannot be passed anywhere a function is expected, which costs nothing in
version 1 because there are no function values. In a `study()` file `close(...)`
is OS7001.

### 3.3 The `bar` namespace

Per-bar facts. The bar facts, and which of them the host states, are
`language.md` section 7.2's.

| Call | Returns | Warmup | For |
|---|---|---|---|
| `bar.index` | `series number` | bar 0 | Position of this bar in the dataset, oldest is 0 |
| `bar.count` | `series number` | bar 0 | `bar.index + 1`, bars seen so far |
| `bar.isFirst` | `series bool` | bar 0 | This is the oldest bar supplied |
| `bar.isLast` | `series bool` | bar 0 | This is the newest bar supplied |
| `bar.isConfirmed` | `series bool` | bar 0 | This bar's interval has elapsed and it will not change again |
| `bar.isRealtime` | `series bool` | bar 0 | A live feed is driving updates, rather than a one-off history load |
| `bar.isNew` | `series bool` | bar 0 | The last update appended a bar rather than replacing one |
| `bar.updates` | `series number` | bar 0 | How many times this bar has been executed |

These land in the contract's calculation context rather than in any drawn field.
Which of them the host states and which the engine derives is `language.md`
section 7.2's.

### 3.4 The `chart` namespace

Instrument and chart facts. Every one of these is constant for the whole run
except `chart.now()`, so they are typed as plain values rather than series and
carry no history.

| Call | Returns | Warmup | For |
|---|---|---|---|
| `chart.symbol` | `string` | n/a | The instrument's symbol, or `""` when the host names none |
| `chart.exchange` | `string` | n/a | The exchange the instrument trades on |
| `chart.interval` | `string` | n/a | The chart's interval in canonical form, section 15.2 |
| `chart.intervalMinutes` | `number` | n/a | The interval in minutes, `none` for a non-time interval |
| `chart.isIntraday` | `bool` | n/a | The interval is shorter than one day |
| `chart.timezone` | `string` | n/a | The chart's IANA zone, the calendar its axis is labelled in |
| `chart.tickSize` | `number` | n/a | The instrument's smallest price increment, `none` when the host has not said |
| `chart.lotSize` | `number` | n/a | Units in one lot, `none` when the host has not said |
| `chart.pointValue` | `number` | n/a | Money per one point of price per unit, `none` when unknown |
| `chart.currency` | `string` | n/a | Currency label for money in a report |
| `chart.instrumentType` | `string` | n/a | `"equity"`, `"future"`, `"option"`, `"index"`, `"currency"`, `"commodity"` or `"other"` |
| `chart.hasVolume` | `bool` | n/a | The host supplies volume for this instrument |
| `chart.hasOpenInterest` | `bool` | n/a | The host supplies open interest for this instrument |
| `chart.now()` | `number` | n/a | The chart's wall clock, UTC milliseconds |
| `chart.isReplay` (planned) | `bool` | n/a | The bars are being replayed rather than loaded whole |
| `chart.expiry` (planned) | `number` | n/a | Expiry instant of a derivative instrument |
| `chart.strike` (planned) | `number` | n/a | Strike price of an option instrument |
| `chart.optionType` (planned) | `string` | n/a | `"call"`, `"put"` or `""` |

`chart.tickSize` is `none` rather than a guessed `0.01` when the host has not
supplied it, because a script sizing a stop in ticks has to be able to tell "one
paisa" from "nobody said". Every fact here comes from the instrument record
(`host-interface.md` section 4.1); `chart.intervalMinutes` and `chart.isIntraday`
are derived by the engine from the interval string rather than supplied.
`chart.now()` is the only reading of a clock available during a bar, and the
conformance suite fixes its value, so a script that uses it is still
reproducible.

**Count: 36 entries, of which 5 are planned.**

---

## 4. Moving averages and trend

Unless an entry says otherwise, `src` is any `series number` and `len` is a
length under the rules of section 2.5.

| Call | Returns | Warmup | For |
|---|---|---|---|
| `sma(src, len)` | `series number` | bar `len - 1` | Arithmetic mean of the last `len` values |
| `ema(src, len)` | `series number` | bar `len - 1` | Exponential mean, weight `2 / (len + 1)`, seeded on bar `len - 1` with the simple average of those `len` values |
| `wma(src, len)` | `series number` | bar `len - 1` | Linearly weighted mean, newest value weighted `len` |
| `rma(src, len)` | `series number` | bar `len - 1` | Smoothed mean with weight `1 / len`, seeded like `ema`; the smoothing the classic oscillators use |
| `hma(src, len)` | `series number` | bar `len + round(sqrt(len)) - 2` | Weighted mean tuned to lag less than `wma` at the same length |
| `dema(src, len)` | `series number` | bar `2 * len - 2` | Double exponential mean, an `ema` with its own lag subtracted once |
| `tema(src, len)` | `series number` | bar `3 * len - 3` | Triple exponential mean, the same correction applied twice |
| `vwma(src, len)` | `series number` | bar `len - 1` | Mean weighted by each bar's volume |
| `swma(src)` | `series number` | bar 3 | Fixed four bar symmetric mean, weights 1, 2, 2, 1 divided by 6 |
| `alma(src, len, offset = 0.85, sigma = 6)` | `series number` | bar `len - 1` | Gaussian weighted mean whose peak `offset` slides between lag and smoothness |
| `linreg(src, len, offset = 0)` | `series number` | bar `len - 1` | Value of the least squares line through the last `len` points, `offset` bars back along it |
| `ma(src, len, type = "sma")` | `series number` | the named type's | One call whose shape a `select` input can switch: `"sma"`, `"ema"`, `"wma"`, `"rma"`, `"hma"`, `"vwma"` |
| `supertrend(factor = 3, atrLen = 10)` | `array<number>` | element 0 at bar `atrLen`, element 1 at bar `atrLen` | `[line, direction]`; a trailing band from average true range, `direction` is `-1` long or `1` short |
| `psar(start = 0.02, step = 0.02, max = 0.2)` | `array<number>` | element 0 at bar 1, element 1 at bar 1 | `[sar, direction]`; a stop that accelerates toward price, seeded from bar 0's range |
| `adx(diLen = 14, adxLen = 14)` | `array<number>` | element 1 and 2 at bar `diLen`, element 0 at bar `diLen + adxLen - 1` | `[adx, plusDI, minusDI]`; trend strength and which side owns it |
| `aroon(len = 14)` | `array<number>` | both elements at bar `len` | `[up, down]`; how recently the window's high and low were set, as a percentage |
| `ichimoku(convLen = 9, baseLen = 26, spanLen = 52)` | `array<number>` | element by element at bar `convLen - 1`, `baseLen - 1`, `baseLen - 1`, `spanLen - 1`, `baseLen - 1` | `[conversion, base, spanA, spanB, lagging]`; a five line trend frame, displaced with `plot(..., offset = ...)` |
| `kama(src, len, fast = 2, slow = 30)` (planned) | `series number` | bar `len` | Mean whose smoothing follows how directional the move is |
| `zlema(src, len)` (planned) | `series number` | bar `len - 1` | Exponential mean with its lag removed by displacement |
| `vidya(src, len)` (planned) | `series number` | bar `2 * len - 1` | Mean whose smoothing follows relative volatility |
| `zigzag(src, deviation)` (planned) | `array<number>` | first confirmed swing | Swing points confirmed by a percentage reversal |

`supertrend` and `psar` return a direction alongside the line because a script
almost always wants both and recomputing the line to derive the flip would double
the work. Direction is `-1` for long and `1` for short, matching the sign of the
side the band is protecting against, and it is a number rather than a bool so
that `direction != direction[1]` reads as the flip test.

`ichimoku` returns the spans undisplaced, at the bar they are computed on. A
study draws them forward with the plot's `offset` argument rather than having the
function shift them, because a shifted series cannot be compared with anything
else in the script without shifting it back.

**Count: 21 entries, of which 4 are planned.**

---

## 5. Momentum and oscillators

| Call | Returns | Warmup | For |
|---|---|---|---|
| `rsi(src, len = 14)` | `series number` | bar `len` | 0 to 100 reading of how one-sided the last `len` changes were |
| `stoch(len = 14, smoothK = 1, smoothD = 3)` | `array<number>` | element 0 at bar `len + smoothK - 2`, element 1 at bar `len + smoothK + smoothD - 3` | `[k, d]`; where the close sits inside the window's range |
| `stochRsi(src, rsiLen = 14, stochLen = 14, smoothK = 3, smoothD = 3)` | `array<number>` | element 0 at bar `rsiLen + stochLen + smoothK - 2` | `[k, d]`; the same position test applied to `rsi` instead of price |
| `macd(src, fast = 12, slow = 26, signal = 9)` | `array<number>` | element 0 at bar `max(fast, slow) - 1`, elements 1 and 2 at bar `max(fast, slow) + signal - 2` | `[macd, signal, histogram]`; the gap between a fast and a slow mean |
| `ppo(src, fast = 12, slow = 26, signal = 9)` | `array<number>` | as `macd` | `[ppo, signal, histogram]`; the same gap as a percentage, so two instruments compare |
| `cci(len = 20)` | `series number` | bar `len - 1` | How far the typical price sits from its mean in mean-deviation units |
| `mom(src, len = 10)` | `series number` | bar `len` | `src - src[len]`, change over a fixed distance |
| `roc(src, len = 9)` | `series number` | bar `len` | The same change as a percentage of the older value |
| `williamsR(len = 14)` | `series number` | bar `len - 1` | Position in the window's range, scaled 0 to -100 |
| `tsi(src, longLen = 25, shortLen = 13)` | `series number` | bar `longLen + shortLen - 1` | Double smoothed momentum, so the noise of `mom` is gone |
| `trix(src, len = 18)` | `series number` | bar `3 * len - 2` | Rate of change of a triple exponential mean |
| `cmo(src, len = 9)` | `series number` | bar `len` | Up sum minus down sum over their total, -100 to 100 |
| `dpo(src, len = 21)` | `series number` | bar `len + floor(len / 2)` | Price with its displaced mean removed, to expose a cycle |
| `ultimateOsc(len1 = 7, len2 = 14, len3 = 28)` | `series number` | bar `max(len1, len2, len3)` | Buying pressure blended over three windows so one length cannot dominate |
| `awesomeOsc(fast = 5, slow = 34)` | `series number` | bar `max(fast, slow) - 1` | Difference of two simple means of `hl2`, drawn as a histogram |
| `fisher(len = 9)` (planned) | `array<number>` | bar `len` | `[fisher, trigger]`; range position reshaped so extremes stand out |
| `rvi(src, len = 10)` (planned) | `array<number>` | bar `len + 3` | `[rvi, signal]`; where the close sits inside the bar, smoothed |
| `coppock(src, roc1 = 14, roc2 = 11, wmaLen = 10)` (planned) | `series number` | bar `max(roc1, roc2) + wmaLen - 1` | Long horizon momentum turn |

`rsi` needs `len` changes and a change needs two bars, so its first value is at
bar `len` and not at bar `len - 1`. Every entry in this section that consumes
changes rather than levels carries the same extra bar, and the warmup column
states it rather than leaving the reader to work it out.

**Count: 18 entries, of which 3 are planned.**

---

## 6. Volatility and ranges

| Call | Returns | Warmup | For |
|---|---|---|---|
| `trueRange()` | `series number` | bar 0 | The bar's range including any gap from the previous close |
| `atr(len = 14)` | `series number` | bar `len - 1` | `rma` of `trueRange`, the working measure of how far this instrument moves |
| `natr(len = 14)` | `series number` | bar `len - 1` | `atr` as a percentage of close, so two instruments compare |
| `stdev(src, len, sample = false)` | `series number` | bar `len - 1` | Standard deviation over the window, population by default |
| `variance(src, len, sample = false)` | `series number` | bar `len - 1` | The square of the same |
| `bollinger(src, len = 20, mult = 2)` | `array<number>` | all elements at bar `len - 1` | `[basis, upper, lower]`; a mean with deviation bands |
| `bbWidth(src, len = 20, mult = 2)` | `series number` | bar `len - 1` | Band width over the basis, a squeeze reads as a low |
| `bbPercent(src, len = 20, mult = 2)` | `series number` | bar `len - 1` | Where price sits between the bands, 0 at the lower and 1 at the upper |
| `keltner(len = 20, mult = 2, atrLen = 10, maType = "ema")` | `array<number>` | all elements at bar `max(len, atrLen) - 1` | `[basis, upper, lower]`; the same picture built from `atr` instead of deviation |
| `donchian(len = 20)` | `array<number>` | all elements at bar `len - 1` | `[upper, basis, lower]`; the window's outright high, midpoint and low |
| `chop(len = 14)` | `series number` | bar `len` | 0 to 100 reading of whether the window trended or chopped |
| `hv(src, len = 20, periodsPerYear = 252)` | `series number` | bar `len` | Annualised standard deviation of log returns |
| `massIndex(len = 25)` (planned) | `series number` | bar `len + 17` | Range expansion as a reversal warning |

`trueRange()` on bar 0 is `high - low`. The other two terms of the definition
need the previous close, which is absent there, and propagating absence would
make `atr` start one bar later than every reference implementation while adding
nothing: the bar's own range is a true statement about that bar. This is the one
deliberate exception to absence propagation in the library, and it is written
here rather than left to the engine.

`stdev` and `variance` divide by `len`, the population form, because that is what
the band studies a chart must reproduce use. Pass `sample = true` for the `len -
1` divisor. Naming the choice in an argument means neither camp has to write the
correction by hand.

**Count: 13 entries, of which 1 is planned.**

---

## 7. Volume

Every function here returns `none` on every bar when the host supplies no volume
for the instrument. Test `chart.hasVolume` to branch on that rather than
inspecting the result.

| Call | Returns | Warmup | For |
|---|---|---|---|
| `vwap(src = hlc3)` | `series number` | the session's first bar | Volume weighted average price since the session opened |
| `vwapAnchor(src, resetWhen)` | `series number` | the first bar `resetWhen` is true | The same average, restarted on any bar the condition is true |
| `obv()` | `series number` | bar 0, seeded 0 | Running total of volume signed by the close's direction |
| `ad()` | `series number` | bar 0 | Running total of volume weighted by where the close sat in the bar |
| `adOsc(fast = 3, slow = 10)` | `series number` | bar `max(fast, slow) - 1` | The difference of two means of `ad`, to date its turns |
| `mfi(len = 14)` | `series number` | bar `len` | `rsi` computed on money flow rather than price |
| `cmf(len = 20)` | `series number` | bar `len - 1` | Accumulation over the window as a fraction of its volume |
| `pvt()` | `series number` | bar 1, seeded 0 | Running total of volume weighted by percentage change |
| `eom(len = 14)` | `series number` | bar `len` | How far price moved per unit of volume |
| `forceIndex(len = 13)` | `series number` | bar `len` | Change times volume, smoothed |
| `relativeVolume(len = 20)` | `series number` | bar `len - 1` | This bar's volume over its own recent average |
| `nvi()` (planned) | `series number` | bar 1 | Cumulative change on bars where volume fell |
| `pvi()` (planned) | `series number` | bar 1 | Cumulative change on bars where volume rose |
| `klinger(fast = 34, slow = 55, signal = 13)` (planned) | `array<number>` | bar `slow + signal - 2` | `[klinger, signal]`; volume force against the bar's trend |
| `volumeProfile(rows = 24, from = none)` (planned) | `array<number>` | the anchor bar | Volume by price level, for a histogram drawn sideways |
| `cvd()` (planned) | `series number` | bar 0 | Cumulative signed volume, once the host supplies intrabar data |

`vwap` resets at the start of each trading session as the host defines it, not at
midnight, because the session is what the number means. On a daily or longer
interval, where each bar is its own session, `vwap` equals `src` and the compiler
emits warning OS8006 saying so.

**Not raised yet.** OS8006 is in the catalogue and nothing raises it: the
checker does not compare a session average's call with the chart's interval.

**Count: 16 entries, of which 5 are planned.**

---

## 8. Maths and rounding

### 8.1 Bare functions

None of these has a warmup: they read the current bar's values only, so they
produce a value on bar 0 whenever their arguments do.

| Call | Returns | For |
|---|---|---|
| `abs(x)` | `number` | Magnitude without sign |
| `sign(x)` | `number` | `-1`, `0` or `1` |
| `min(a, b)` | `number` | The smaller of two |
| `max(a, b)` | `number` | The larger of two |
| `clamp(x, lo, hi)` | `number` | `x` held inside a range |
| `floor(x)` | `number` | Toward negative infinity |
| `ceil(x)` | `number` | Toward positive infinity |
| `round(x)` | `number` | To the nearest whole number, halves away from zero |
| `round(x, decimals)` | `number` | To a fixed number of decimals, halves away from zero |
| `trunc(x)` | `number` | Toward zero |
| `roundToStep(x, step)` | `number` | To the nearest multiple of `step` |
| `roundToTick(price)` | `number` | To the instrument's tick, `none` when `chart.tickSize` is absent |
| `sqrt(x)` | `number` | Square root, `none` below zero |
| `pow(x, y)` | `number` | `x` to the power `y`, `none` where the result is not a finite real |
| `exp(x)` | `number` | `e` to the power `x` |
| `log(x)` | `number` | Natural logarithm, `none` at or below zero |
| `log10(x)` | `number` | Base ten logarithm, same absence rule |
| `mod(a, b)` | `number` | `a - b * floor(a / b)`, the floored remainder, whose sign follows `b`; `none` when `b` is zero |
| `isNone(x)` | `bool` | True when the value is absent |
| `orElse(x, fallback)` | same as `x` | `x` when present, `fallback` when absent |
| `toBool(x)` | `bool` | `none` to `false`, a bool to itself; numbers are rejected |

`round(x)` rounds halves away from zero rather than to even, because a price
rounded for display should agree with what a trader would write down, and
round-half-to-even surprises people at exactly the values that matter. The rule
is fixed so two engines cannot differ on a tick.

`roundToTick` returns `none` rather than the unrounded price when the host has
not supplied a tick size. Returning the input would produce an order price that
looks rounded and is not.

`mod` is the floored remainder and `%` is the truncated one, and that is the
whole difference between them: `mod(-7, 3)` is `2` where `-7 % 3` is `-1`, and
`mod(7, -3)` is `-2` where `7 % -3` is `1`. The formula is written out rather
than described because "the modulo" names two different functions in common use
and an engine that picked the other one would disagree with every other engine at
every negative argument. The two agree for every positive `b`, which is every use
that wraps an index, a bar count or a session offset. `mod(a, 0)` is `none`, on
the rule of section 2.4 that a result with no finite real value is absent, and it
is the answer `a % 0` gives as well. `mod` is a library call and compiles to one;
the `MOD` instruction of `compiled-program.md` section 4.5 is the `%` operator,
not this function.

### 8.2 The `math` namespace

| Call | Returns | For |
|---|---|---|
| `math.pi` | `number` | The circle constant |
| `math.e` | `number` | The base of the natural logarithm |
| `math.log2(x)` | `number` | Base two logarithm |
| `math.hypot(x, y)` | `number` | `sqrt(x * x + y * y)` without intermediate overflow |
| `math.toDegrees(x)` | `number` | Radians to degrees |
| `math.toRadians(x)` | `number` | Degrees to radians |
| `math.sin(x)` | `number` | Sine of an angle in radians |
| `math.cos(x)` | `number` | Cosine |
| `math.tan(x)` | `number` | Tangent |
| `math.asin(x)` | `number` | Inverse sine, `none` outside -1 to 1 |
| `math.acos(x)` | `number` | Inverse cosine, same range rule |
| `math.atan(x)` | `number` | Inverse tangent |
| `math.atan2(y, x)` | `number` | Angle of a vector, correct in all four quadrants |
| `math.sinh(x)` (planned) | `number` | Hyperbolic sine |
| `math.cosh(x)` (planned) | `number` | Hyperbolic cosine |
| `math.tanh(x)` (planned) | `number` | Hyperbolic tangent |

There is no random number function, in this namespace or anywhere else. A script
that could produce a different answer on a second run could not be part of a
conformance suite, and a backtest whose numbers move between runs cannot be
compared with another backtest, which is the whole purpose of running one.

**Count: 37 entries, of which 3 are planned.**

---

## 9. Series helpers

The functions that work across bars rather than within one. `cond` is a
`series bool`.

| Call | Returns | Warmup | For |
|---|---|---|---|
| `highest(src, len)` | `series number` | bar `len - 1` | Largest value in the last `len` bars |
| `lowest(src, len)` | `series number` | bar `len - 1` | Smallest value in the last `len` bars |
| `highestBars(src, len)` | `series number` | bar `len - 1` | How many bars back the window's high was set, 0 for this bar |
| `lowestBars(src, len)` | `series number` | bar `len - 1` | How many bars back the window's low was set |
| `change(src)` | `series number` | bar 1 | `src - src[1]` |
| `change(src, len)` | `series number` | bar `len` | `src - src[len]` |
| `rising(src, len)` | `series bool` | bar `len` | True when each of the last `len` changes was positive |
| `falling(src, len)` | `series bool` | bar `len` | True when each of the last `len` changes was negative |
| `crossUp(a, b)` | `series bool` | bar 1 | `a` was at or below `b` and is now above |
| `crossDown(a, b)` | `series bool` | bar 1 | `a` was at or above `b` and is now below |
| `cross(a, b)` | `series bool` | bar 1 | Either direction |
| `barsSince(cond)` | `series number` | first bar `cond` is true | Bars since the condition last held, 0 on the bar itself |
| `valueWhen(cond, src, occurrence = 0)` | same as `src` | the `occurrence + 1` th true bar | `src` as it stood the last time the condition held, or the one before that |
| `cum(src)` | `series number` | bar 0 | Running total from the first bar |
| `sum(src, len)` | `series number` | bar `len - 1` | Total over the window |
| `count(cond, len)` | `series number` | bar `len - 1` | How many of the last `len` bars the condition held on |
| `sumSkip(src, len)` | `series number` | bar `len - 1` | Total over the window, ignoring absent bars |
| `avgSkip(src, len)` | `series number` | bar `len - 1` | Mean over the window, ignoring absent bars |
| `countPresent(src, len)` | `series number` | bar `len - 1` | How many bars of the window had a value |
| `history(src, n)` | same as `src` | bar `n` | `src` as it stood `n` bars ago, the explicit form of `src[n]` |
| `pivotHigh(src, left, right)` | `series number` | bar `left + right` | The value of a local high, reported `right` bars after it formed |
| `pivotLow(src, left, right)` | `series number` | bar `left + right` | The value of a local low, on the same terms |
| `median(src, len)` | `series number` | bar `len - 1` | Middle value of the window |
| `percentile(src, len, p)` | `series number` | bar `len - 1` | The value at percentile `p` of the window, linearly interpolated |
| `percentRank(src, len)` | `series number` | bar `len - 1` | What percentage of the window this bar's value exceeds |
| `correlation(a, b, len)` | `series number` | bar `len - 1` | Linear correlation of two series over the window, -1 to 1 |
| `covariance(a, b, len)` | `series number` | bar `len - 1` | Covariance over the window, population form |

`crossUp` uses "at or below, then above" rather than "strictly below, then
above", so two series that touch and separate report one cross rather than none.
The alternative loses the case where the values are briefly equal, which is
common on instruments with a coarse tick.

`pivotHigh` and `pivotLow` report on the bar `right` bars *after* the pivot,
which is the first bar on which the pivot is knowable. A study that wants the
marker drawn back at the pivot passes `offset = -right` to `plot` or anchors a
drawing at `time[right]`. Returning it at the pivot bar would be a lookahead: the
value would appear on history at a bar where no script could have had it.

`barsSince` and `valueWhen` are absent, not zero, before the condition has ever
been true. Zero would read as "it happened on this bar".

`valueWhen` reads the current zero-based occurrence among this call's true
conditions: zero selects the newest event. Occurrence is an event ordinal,
not a window length, so an earlier larger occurrence does not impose a lasting
warmup after the request shrinks. Retain earlier true events for later larger
requests. A true event with absent source still occupies its ordinal; false or
absent conditions add no event. For conditions `[true,true,false]`, source
`[1,2,3]` and occurrences `[0,0,1]`, readings are `[1,2,1]`. For three true
conditions and occurrences `[1,1,0]`, readings are `[none,1,3]`.

**Count: 27 entries, of which 0 are planned.**

---

## 10. Strings and formatting

| Call | Returns | For |
|---|---|---|
| `text(x)` | `string` | Any value to a string; `text(none)` is `"none"` |
| `text(x, decimals)` | `string` | A number to a string with fixed decimals, halves away from zero |
| `toNumber(s)` | `number` | A string to a number, `none` when it does not parse |
| `str.length(s)` | `number` | Count of Unicode code points |
| `str.upper(s)` | `string` | Upper case, invariant, not locale dependent |
| `str.lower(s)` | `string` | Lower case, on the same terms |
| `str.trim(s)` | `string` | Leading and trailing whitespace removed: the code points listed below |
| `str.contains(s, part)` | `bool` | Whether one string appears in another |
| `str.startsWith(s, part)` | `bool` | Prefix test |
| `str.endsWith(s, part)` | `bool` | Suffix test |
| `str.indexOf(s, part)` | `number` | First position of `part`, or `-1` |
| `str.substring(s, from, to = none)` | `string` | `from` inclusive, `to` exclusive, to the end when `to` is absent |
| `str.replace(s, find, with)` | `string` | First occurrence only |
| `str.replaceAll(s, find, with)` | `string` | Every occurrence |
| `str.split(s, separator)` | `array<string>` | Split into parts |
| `str.join(parts, separator)` | `string` | Join an array back into one string |
| `str.padLeft(s, width, fill = " ")` | `string` | Pad to a width, for a table column that must line up |
| `str.padRight(s, width, fill = " ")` | `string` | The same from the other side |
| `str.repeat(s, n)` | `string` | `n` copies, for a bar drawn out of characters in a table cell |
| `str.format(template, values)` (planned) | `string` | Substitution into a template |
| `str.match(s, pattern)` (planned) | `bool` | Pattern matching, once a pattern syntax is specified |

`text(x, decimals)` writes a positional decimal at every magnitude: a sign where
the value is negative, at least one digit before the point, and exactly
`decimals` digits after it. The digits it writes are the digits `language.md`
5.5 gives the rounded, scaled whole number, zero filled. It never switches to an
exponent. A reader asked for a fixed number of decimal places and an exponent is
not one, and a conversion that changed shape above a threshold would be a label
that read correctly until the day a cumulative volume crossed it. A conversion
whose result would pass the string ceiling is OS5008, measured before the string
is built rather than after.

**`str.trim` removes, and `toNumber` ignores at either end, exactly these code
points**, which are the ones with the Unicode White_Space property, and no
other:

| Code point | Name |
|---|---|
| `U+0009` | character tabulation |
| `U+000A` | line feed |
| `U+000B` | line tabulation |
| `U+000C` | form feed |
| `U+000D` | carriage return |
| `U+0020` | space |
| `U+0085` | next line |
| `U+00A0` | no-break space |
| `U+1680` | ogham space mark |
| `U+2000` to `U+200A` | the en quad through the hair space |
| `U+2028` | line separator |
| `U+2029` | paragraph separator |
| `U+202F` | narrow no-break space |
| `U+205F` | medium mathematical space |
| `U+3000` | ideographic space |

The byte order mark `U+FEFF` is not in the set, and neither are the four
information separators `U+001C` to `U+001F` or the zero width space `U+200B`.
Each of those is in one host's own trim and not another's, which is why the set
is written down here rather than taken from a host, and why an engine
implements it from this table. `tests/engine/strings.test.ts` walks every code
point of the basic plane against the table read out of this page.

**Two strings are ordered by code point**: compared from the front, the first
code point that differs deciding, and a string that ends first ordering first.
It is the one order in the language: `<` and its three companions
(`language.md` 9.3) and `sort` over an array of strings (`language.md` 14.1)
agree, and an engine whose strings are sixteen bit units compares code points
and not units, or a symbol outside the basic plane sorts below the last
thousands of the plane on that engine and above them on every other.

None of these has a warmup: a string operation on a present string produces a
value on bar 0.

Case conversion is invariant rather than locale aware. A script whose output
changed because the machine running it was configured for a different locale
would break the determinism rule of `language.md` section 7.6, and the cases
where a locale-aware conversion differs are not cases a trading script needs.

`str.format` is planned rather than shipped because version 1 has no variadic
call form, and the array-of-strings workaround reads worse than concatenating
with `text()`. It arrives with the call form, not before.

**Count: 21 entries, of which 2 are planned.**

---

## 11. Colour

### 11.1 Named colours

Nineteen bare names, as `language.md` section 3.8 fixes them:

```
aqua     black   blue    brown   fuchsia  gray     green   lime
maroon   navy    olive   orange  pink     purple   red     silver
teal     white   yellow
```

Each is an ordinary global of type `color` with full opacity. Their exact channel
values are fixed in `spec/colours.json`, the authority for them and part of the
conformance suite, so a study looks the same on every engine; the compiler's
table and the engine's are held to that file by
`scripts/check-colour-channels.mjs`.

### 11.2 Construction

| Call | Returns | For |
|---|---|---|
| `rgb(r, g, b)` | `color` | Channels 0 to 255, fully opaque |
| `rgba(r, g, b, a)` | `color` | The same with alpha 0 to 1, where 1 is opaque |
| `fade(color, percent)` | `color` | The same colour at `percent` transparency, where 100 is invisible |
| `mix(a, b, weight)` | `color` | Blend of two colours, `weight` 0 gives `a` and 1 gives `b` |
| `alpha(color)` | `number` | Read a colour's alpha, 0 to 1 |
| `withAlpha(color, a)` | `color` | The same colour at a stated alpha |
| `hsl(h, s, l)` (planned) | `color` | Hue, saturation, lightness construction |
| `gradient(value, from, to, colorFrom, colorTo)` (planned) | `color` | Position a value between two colours |

**Every call that computes a colour rounds red, green and blue to a whole number
before it returns**, with the language's own rounding, halves away from zero, the
`round` of section 8.1. `mix` is the call that produces fractional channels, so
`mix` is where the rule bites: `mix(a, b, weight)` rounds each of the three
channels before returning, and the value model's invariant, whole channels and a
binary64 alpha from 0 to 1, then holds of every colour and not only of a literal
(`compiled-program.md` section 3.1). Alpha is not rounded here.

**At the contract boundary the alpha becomes a byte as `round(alpha * 255)`**,
the same rounding, and that byte is the `aa` of the `#rrggbbaa` spelling the
conformance suite compares. The conversion is one way and is not a round trip:
`fade(aqua, 88)` is an alpha of 0.12, which serialises as `round(0.12 * 255)`,
that is 31, written `1f`, and `1f` read back is 31 divided by 255, which is not
0.12. Nothing in the language observes the difference, because a script reads
alpha with `alpha()` from the machine value and never from the wire form.

`fade` takes transparency, not opacity, and the argument is a percentage. Both
choices follow the way a chart's own style controls are labelled, and the entry
says so here because the two conventions are opposites and a script that guesses
wrong draws something invisible. `withAlpha` exists for the other convention and
takes 0 to 1. `fade(c, p)` is `withAlpha(c, (100 - p) / 100)` exactly, which sets
the alpha rather than scaling it, whatever alpha `c` already carried, so nesting
two fades replaces the inner call's alpha with the outer one's and
`fade(fade(aqua, 50), 50)` is `fade(aqua, 50)`.

A channel argument outside its range is OS3004, not a clamp, because a colour
computed from data and landing at 300 is a bug in the computation.

**Lands in:** a colour reaches the contract as a colour string on whatever field
carries it: a plot's style colour, a per-bar plot colour, a band's up or down
colour, a level's colour, a drawing's line, fill or text colour, a table cell's
text or background, a pane background entry, a price bar colour. An alpha below 1
is carried in the string's alpha channel.

**Count: 8 functions and 19 named colours, of which 2 functions are planned.**

---

## 12. Time, session and calendar

### 12.1 The zone every calendar field is read in

**Every function in this section reads a timestamp in the chart's timezone
(`chart.timezone`) unless a `zone` argument names another.** A session study that
disagreed with the labels on the chart's own axis would be wrong in the way that
is hardest to see, so the default is the axis, not UTC.

A zone is an IANA name, never a fixed offset. A fixed offset is silently wrong
for half the year anywhere that observes daylight saving. An unknown zone name is
OS6005.

### 12.2 The `date` namespace

`t` is a timestamp in UTC milliseconds, usually `time`. None of these has a
warmup.

| Call | Returns | For |
|---|---|---|
| `date.year(t, zone = chart.timezone)` | `number` | Calendar year |
| `date.month(t, zone = ...)` | `number` | Month, 1 to 12 |
| `date.day(t, zone = ...)` | `number` | Day of the month, 1 to 31 |
| `date.dayOfWeek(t, zone = ...)` | `number` | 1 for Monday through 7 for Sunday |
| `date.dayOfYear(t, zone = ...)` | `number` | 1 to 366 |
| `date.hour(t, zone = ...)` | `number` | 0 to 23 |
| `date.minute(t, zone = ...)` | `number` | 0 to 59 |
| `date.second(t, zone = ...)` | `number` | 0 to 59 |
| `date.weekOfYear(t, zone = ...)` | `number` | Week number, weeks starting Monday |
| `date.from(year, month, day, hour = 0, minute = 0, second = 0, zone = ...)` | `number` | Build a timestamp from calendar fields |
| `date.startOfDay(t, zone = ...)` | `number` | Midnight at the start of `t`'s day |
| `date.startOfWeek(t, zone = ...)` | `number` | Midnight at the start of `t`'s Monday |
| `date.startOfMonth(t, zone = ...)` | `number` | Midnight on the first of `t`'s month |
| `date.isSameDay(a, b, zone = ...)` | `bool` | Whether two timestamps fall on one calendar day |
| `date.format(t, pattern, zone = ...)` | `string` | Render a timestamp, section 12.3 |
| `date.add(t, unit, count, zone = ...)` (planned) | `number` | Calendar arithmetic that respects month lengths and daylight saving |

`date.dayOfWeek` numbers Monday as 1 so that a weekday test reads
`date.dayOfWeek(time) <= 5` and a trading week is a contiguous range. Numbering
Sunday as 1, which some calendars do, splits the trading week across the ends of
the range.

`date.weekOfYear` is the ISO 8601 week: weeks start on Monday and week 1 is the
week holding the year's first Thursday, so a week straddling the new year
belongs to the year holding most of it and no year has a week 0. The other
common reading, counting from the first day of January, differs by a whole week
at the turn of most years, and a reader has no way to tell from a chart which of
the two drew it.

**A zone name is resolved against the host runtime's own timezone database.**
This specification fixes no table of its own, because a table is a fact several
governments change every year and a copy of one goes stale silently, in exactly
the way a fixed offset does. Two engines agree as far as their databases do,
which is the same footing every calendar in existence stands on, and it is
stated here rather than implied. A name the database does not hold is OS6005 and
never a guessed offset.

**A zone name is an area and a location, or `UTC`.** Databases differ about
which abbreviations they will quietly accept, so an engine applies this rule
before it consults one: a script refused on one engine has to be refused on
every engine, and an abbreviation is ambiguous in any case, which is what
OS6005 says. `UTC` is the one accepted name with no area, and it names one
offset everywhere.

**Two wall clock readings have no single instant and both are settled.** A
reading the clock skipped, the hour a spring change removes, resolves to the
instant that hour would have been; absence there would put a hole in a study one
morning a year. A reading the clock repeated, the hour an autumn change gives
back, resolves to the first of the two, which is when a session opening at that
clock time opens.

### 12.3 The format pattern

`date.format` accepts these placeholders and copies every other character
through. The set is small and closed so that two engines cannot differ.

```
yyyy  four digit year        MM  two digit month     dd  two digit day
HH    two digit hour, 24     mm  two digit minute    ss  two digit second
MMM   three letter month     EEE three letter weekday
```

Month and weekday abbreviations are English and invariant, for the same
determinism reason as `str.upper`.

### 12.4 The `session` namespace

The session is the instrument record's session (`host-interface.md` section 4.3),
not a window the script invents. Everything here is a per-bar fact.

| Call | Returns | Warmup | For |
|---|---|---|---|
| `session.isOpen` (planned) | `series bool` | bar 0 | This bar falls inside the instrument's trading session |
| `session.isFirstBar` | `series bool` | bar 0 | This is the session's first bar |
| `session.isLastBar` | `series bool` | bar 0 | This is the session's last bar |
| `session.startTime` (planned) | `series number` | the session's first bar | When this bar's session opened |
| `session.endTime` (planned) | `series number` | the session's first bar | When this bar's session is scheduled to close |
| `session.barIndex` (planned) | `series number` | bar 0 | This bar's position within its session, first is 0 |
| `session.isIn(spec, zone = chart.timezone)` | `series bool` | bar 0 | Whether the bar falls in a stated window, section 12.5 |
| `session.isHoliday(t)` (planned) | `bool` | n/a | Whether a date is a trading holiday, once a calendar is supplied |
| `session.nextOpen` (planned) | `series number` | bar 0 | When the next session opens |

`session.isLastBar` is known only because the host states the session's scheduled
close, so it is true on the last bar of the schedule even if trading stopped
early. A strategy that must be flat by the close acts on this rather than on the
appearance of a new bar, which arrives too late.

**Four of these are planned and the reason is where their answer comes from.**
`session.isFirstBar` and `session.isLastBar` follow from the **instrument's**
own session hours, a wall clock range in the instrument's timezone
(`host-interface.md` section 4.3), together with the bar's time, so an engine
derives them and never asks a host for them: the facts a host states about an
execution are the four of `language.md` section 7.2 and no others. A record that
states no session leaves both absent, which is the record's own rule in
`host-interface.md` section 4.1. `session.isIn` reads hours the script itself
wrote, and section 12.2 turns them into a test. The other four want an instant
or a count off that same window rather than a boundary on it, and no engine
reads one yet. They are marked rather than left to be refused at load, so a
script that reaches for one is told at the call that it is planned.

### 12.5 The session window spec

`session.isIn` takes a string of the form `"HHMM-HHMM"` with an optional day
list: `"0915-1530"`, `"0915-1530:12345"`. Days are 1 for Monday through 7 for
Sunday, matching `date.dayOfWeek`. A window whose end is before its start crosses
midnight and is read that way, which is what an overnight session needs. A
malformed spec is OS3008 at compile time when it is a literal.

**Count: 25 entries, of which 7 are planned.**

---

## 13. Inputs

An input is how a study becomes configurable: each call declares one tunable
value and builds one row of the settings dialog the host generates. `input()`
appears only at the top level of a file, never inside a block or a function
(OS3007), because the dialog is built once before the first bar runs.

### 13.1 The one function and its kinds

There is one function, `input()`, and the kind of control is decided by the type
of the default value. Two kinds are both spelled with a string default, so a
`kind` argument separates them.

```
len   = input(14,     "Length", min = 1, max = 500)
src   = input(close,  "Source")
on    = input(true,   "Show the band")
tint  = input(aqua,   "Colour")
mode  = input("fast", "Mode", options = ["fast", "slow"])
tf    = input("60",   "Higher timeframe", kind = "interval")
```

| Call | Returns | Lands in | For |
|---|---|---|---|
| `input(n: number, title, min = none, max = none, step = none, ...)` | `number` | a `number` input | A length, a multiplier, a threshold |
| `input(b: bool, title, ...)` | `bool` | a `bool` input | A switch for an optional part of the study |
| `input(s: string, title, ...)` | `string` | a `string` input | Free text: a label, a note on a drawing |
| `input(s: string, title, options = [...], ...)` | `string` | a `select` input | A choice from a fixed list, rendered as a menu |
| `input(c: color, title, ...)` | `color` | a `color` input | A colour the user can restyle without editing the script |
| `input(src: series, title, ...)` | `series number` | a `source` input | Which price the study reads: one of `open`, `high`, `low`, `close`, `hl2`, `hlc3`, `ohlc4`, `volume` |
| `input(s: string, title, kind = "interval", ...)` | `string` | an `interval` input | A timeframe code, rendered as a menu over the intervals the host can serve |
| `input(s: string, title, kind = "time", ...)` | `number` | a `time` input | An instant the user picks by date, for an anchor |
| `input(s: string, title, kind = "symbol", ...)` (planned) | `string` | a `string` input | Another instrument, rendered as a picker |
| `input(n: number, title, kind = "price", ...)` (planned) | `number` | a `number` input | A price the user sets by clicking the chart |
| `input(s: string, title, kind = "session", ...)` (planned) | `string` | a `string` input | A session window, rendered as two clock fields |

### 13.2 Arguments every kind accepts

| Argument | Type | Default | Means |
|---|---|---|---|
| first positional | the value's type | required | The default value, which fixes the input's type |
| `title` | `string` literal | the variable's name | The label in the settings dialog, and the settings key of an input assigned to no name (`host-interface.md` 8.1). Second positional |
| `group` | `string` | `""` | A heading the dialog groups rows under |
| `tooltip` | `string` | `""` | Help text beside the label, for what a label is too short to say |
| `inline` | `string` (planned) | `""` | Rows sharing a value sit on one line |
| `confirm` | `bool` (planned) | `false` | Ask for this value when the study is added |

The default comes first, before the title, because the default fixes the type and
a reader scanning a column of inputs wants the value. An `input()` whose default
is not a compile-time constant is OS3003.

The title is a string literal on the line rather than an expression folded from
one, because it is the row's label and, where no name was assigned, the row's
settings key, and both are fixed before anything is computed. An input assigned
to no name and given no such title is OS3021.

### 13.3 The kind arguments that only some kinds accept

| Argument | Kinds | Means |
|---|---|---|
| `min`, `max` | number, price | Range the dialog enforces; a value outside it is OS3004 |
| `step` | number, price | Increment of the dialog's stepper |
| `options` | string | The list a menu offers; makes the input a `select` |
| `kind` | string, number | Names the control where the type alone cannot: `"interval"`, `"time"`, `"symbol"`, `"price"`, `"session"` |

An `input` of kind `"time"` returns a number, a timestamp, although its stored
value is a wall clock string in the chart's zone. Storing the string is what lets
a saved layout restore to the same wall clock in another timezone; returning the
timestamp is what a script actually wants to compare against `time`. The
conversion happens once, before bar 0.

### 13.4 Style inputs a script does not write

The host generates a colour, opacity, thickness, line style and plot style row
for every `plot`, without the script declaring any of them. A script that wants a
colour under its own name declares a `color` input and passes it to the plot,
which takes over that row rather than adding a second one.

**Count: 11 input kinds and 6 shared arguments, of which 3 kinds and 2 arguments
are planned.**

---

## 14. Drawing and output

### 14.1 What may appear where

The calls that are top level only are the ones `language.md` section 15.3 lists,
and so are the calls that may appear anywhere.

A `strategy()` file's two leg declarations are on the top level list for the
reason section 17.6 gives, which is this document's own: the set of contracts a
strategy trades is part of its fixed shape, it is resolved before bar 0, and a
leg that existed on some bars and not others would leave the run's record with
nothing to key on.

The two lists are not two halves of one idea. `plot`, `plotCandles`, `fill` and
`level` return a **declaration handle**, a compile-time value; `table()` returns
a **runtime object** although its call site is fixed at the top level; and
`draw.line()` and its siblings return runtime objects a script keeps, mutates
and deletes.
`language.md` section 5.4 defines both kinds and lists exactly what each one
admits. In short: a handle may be named at the top level and passed to `fill`,
and nothing else; an object is an ordinary value and may be held in a `var`, put
in an array and passed to a function.

### 14.2 Plots, bands and levels

| Call | Returns | Lands in | For |
|---|---|---|---|
| `plot(value, title, color = none, width = 1.5, style = "line", offset = 0, overlay = none, precision = none, format = none, scale = "right")` | `plot` | one entry of the contract's plotted columns | Draw a column of numbers |
| `plotCandles(open, high, low, close, title, colorUp = lime, colorDown = red, wickColor = none, borderColor = none)` | `plot` | a plotted column with its four named source columns | Draw bar-shaped output: a smoothed or higher timeframe candle |
| `fill(plotA, plotB, color = none, colorUp = none, colorDown = none, opacity = 1, overlay = none)` | `fill` | one entry of the contract's shaded bands | Shade the region between two declared plots |
| `level(price, title = "", color = gray, style = "dashed", width = 1)` | `level` | one entry of the contract's horizontal levels | A fixed reference line in the study's pane |

**`fill`'s first two arguments are plot handles, not series.** They name the two
declared columns the band is drawn between. The compiled program carries them as
the two plot keys of `outputs.fills[].between` (`compiled-program.md` section
2.8), and the chart's own band spec holds the same pair of keys, so there is
nothing in the contract for a bare expression to become and a script cannot shade
between a column it never declared. An expression in either position is OS3020,
with the fix naming the plot to declare.

```
upper = plot(basis + dev, "Upper", aqua)
lower = plot(basis - dev, "Lower", aqua)
fill(upper, lower, color = fade(aqua, 88))
```

`plot`, `plotCandles`, `fill` and `level` each return a declaration handle, of
the handle type `language.md` section 5.1 names for each call. A handle may
be assigned to a name at the top level and passed to a declaration call that
takes one; it may not be stored in a `var`, put in an array, passed to a user
function or read with `[]`. `fill` is the only call in version 1 that takes one,
so a `fill` or `level` result is normally discarded; naming it is legal and does
nothing. A handle from `plotCandles` is a `plot`, and a band drawn to one follows
its `close` column, which is the column the contract keeps as that plot's
identity.

**The colour arguments.** `color` sets both sides of the band. `colorUp` sets the
side where `plotA` is above `plotB` and `colorDown` the side where `plotB` is
above `plotA`; a band that reads differently depending on which line leads is the
reason the contract carries two. Giving `color` together with either of the other
two is OS3010, because reconciling them would need a rule and every rule for it
surprises somebody. With none of the three given, the band is `plotA`'s colour
faded to twelve percent, which is the chart's own default for a band and is faint
enough not to drown what is behind it.

**Opacity multiplies the colour's alpha, and defaults to 1.** A colour carries
its own alpha everywhere in this language, and `fade(aqua, 88)` is how a script
says "twelve percent" for a pane background, a box fill or a band alike. So
`opacity` is not a second way to say the same thing: it is a dimmer over whatever
the colours already are, it reaches the contract as the band's own `opacity`
field, and a script that never touches it gets exactly the colour it wrote. As on
a plot, a constant colour lands on the band's style and a `series color` lands on
the contract's per-bar colour channel instead.

`style` accepts `"line"`, `"lineWithMarkers"`, `"step"`, `"area"`, `"histogram"`
and `"column"`. These are the styles that make sense for a single column of
values, and they are the same set the host's own plot style menu offers, so a
user can change the style of any plot after the fact without editing the script.

**A constant colour and a per-bar colour are the same argument.** Pass a `color`
and it lands on the plot's style; pass a `series color` and it lands on the
contract's per-bar colour callback instead. One argument covers both because a
script that starts with one colour and later wants two should not have to move to
a different function.

```
plot(macdHist, "Histogram", color = macdHist > 0 ? lime : red, style = "histogram")
```

An omitted colour is the same thing as an explicit `none`, and it leaves the
plot's colour to the host: the compiled program carries null in that plot's
`color` field (`compiled-program.md` section 2.8) and the host assigns one from
the same palette it already uses to fill the generated style row of section 13.4.
That is why the default is `none` rather than a named colour, which would draw
every undecorated column of a three plot study in one colour.

`level(price, ...)` takes a value that may be data-derived, such as the previous
day's high, because the contract recomputes levels after every calculation.

`offset` shifts only where the column is drawn, never what it contains. A
positive offset puts the last values in the margin past the newest bar, which is
what a displaced cloud or a projected channel wants.

`precision` and `format` on a plot set the formatting of the *price scale* the
plot maps to, so setting them on a plot drawn over the price pane reformats the
instrument's own axis. That is almost never wanted, and the compiler emits
warning OS8007 when a script does it.

### 14.3 Markers, paint and grids

| Call | Returns | Lands in | For |
|---|---|---|---|
| `signal(text, color = none, at = "above", shape = "label")` | nothing | one entry of the contract's markers | A named marker on this bar |
| `barColor(color)` | nothing | the contract's price bar colours | Recolour the instrument's own candles on this bar |
| `background(color)` | nothing | the contract's pane background | Shade the whole height of this bar's column behind everything else |
| `table(title, rows, cols, position = "topRight", textColor = none, bgColor = none, borderWidth = 0)` | `table` | the contract's summary grid | Declare a grid pinned to a corner of the pane |
| `cell(t, row, col, text, textColor = none, bgColor = none, align = "left")` | nothing | one cell of that grid | Write one cell on this bar |
| `clear(t)` | nothing | that grid | Empty every cell, so a table can be rebuilt from scratch |
| `print(value)` | nothing | nothing drawn | Write a value to the script's log with the bar's time |

`signal` is the whole of shape plotting, as `language.md` section 15.3 states.
`at` takes `"above"`, `"below"` or `"price"`, and `shape` takes `"label"`,
`"arrowUp"`, `"arrowDown"`, `"triangleUp"`, `"triangleDown"`, `"circle"`,
`"square"`, `"diamond"`, `"cross"` and `"flag"`. `at`, `shape` and `color` are
part of the marker's declaration and are fixed before bar 0, so each must be a
compile-time constant, a literal or an `input()`; a bar-dependent one is OS3003.
Only the text is read per bar. The compiled field carries the same three
spellings (`compiled-program.md` section 2.8).

`signal` does not fire on a bar that is still moving unless the declaration sets
`onUnconfirmed = true` (`language.md` section 7.5).

`cell`'s `align` takes `"left"`, `"center"` or `"right"`, and is the one of its
arguments with a closed set. It is read per bar, like the text and the two
colours beside it, because a cell's style is written with the cell rather than
declared with the grid.

`background(none)` and `barColor(none)` leave the bar alone, which is how a
conditional paint switches itself off. Passing an absent colour is not an error.

**`barColor` paints the instrument's own candles, and they are not the study's.**
Several studies can sit on one price pane and the candles are drawn once, so
which study's colouring is shown is a question the language cannot answer on its
own. `compiled-program.md` section 11 answers it: the study latest in the host's
own study order that paints owns them, and the rule is the order a user sees and
reorders rather than whichever study recomputed last. A background needs no such
rule, because two translucent shadings compose.

`print` writes to the per-script log, not to the chart. It is rate limited by the
host rather than by the language, and a host that drops lines must say how many
it dropped rather than truncating silently.

`table()` is top level only, as a plot is, because the grid's size and corner are
part of the study's fixed shape. What it returns is a **runtime object**, not a
declaration handle: `cell()` and `clear()` take it as an argument and write to it
per bar, so it is an ordinary value that can be named, kept and passed to a
function (`language.md` section 5.4). One call site returns the same object on
every bar. A table is never deleted; `clear(t)` empties its cells and the grid
lives as long as the study. `clear` is one overloaded name: `clear(arr)` is the
array operation of `language.md` section 14.1 and `clear(t)` is this one, told
apart by the argument's type under section 2.2.

### 14.4 The `draw` namespace

Objects a script creates and then mutates over time, rather than a column of one
value per bar. They are anchored to a time and a price, so an object stays where
it was put when more history is loaded and every bar index shifts.

**An object persists until the script deletes it.** The language fixes no number
for how many a script may hold at once; the budget is the host's memory, and a
host that cannot hold another one says so, with OS5010, rather than dropping the
oldest. Nothing is ever discarded to make room, which is the deliberate
difference from the platforms this language exists to replace.

The four creation calls return a value of type `line`, `label`, `box` and
`polyline`. These are runtime objects and ordinary values: a script assigns one
to a name inside a block, keeps it in a `var`, holds a set of them in an
`array<box>`, passes one to a user function and compares one against `none`
(`language.md` section 5.4). That is what a drawing needs and a plot handle is
denied, because the set of drawings is unbounded and changes as bars arrive while
the set of plots is fixed before bar 0.

Dropping the last name that refers to an object does not delete it: the chart
holds it and it keeps drawing until `draw.delete` says otherwise. A handle to a
deleted object is stale rather than absent, so a script assigns `none` to the
name when it deletes the object, and a script holding objects in an array deletes
the object and then removes the element.

Creation:

| Call | Returns | Lands in | For |
|---|---|---|---|
| `draw.line(t1, p1, t2, p2, color = gray, width = 1, style = "solid", extendLeft = false, extendRight = false)` | `line` | one line in the contract's free drawings | A trendline between two points |
| `draw.label(t, p, text, color = none, textColor = white, align = "center", tooltip = "")` | `label` | one label in the same field | A plate of text at a point |
| `draw.box(t1, p1, t2, p2, color = none, fillColor = none, opacity = 0.12, width = 1, text = "", textColor = white, tooltip = "")` | `box` | one box in the same field | A zone: supply, demand, an opening range |
| `draw.polyline(times, prices, color = gray, width = 1, closed = false, fillColor = none, opacity = 0.12)` | `polyline` | one polyline in the same field | A path or a closed shape through many points |

`draw.polyline` takes two parallel arrays rather than an array of points because
version 1 has no record type. It arrives in its natural shape when `type` does.
The path is read once, at the call: the object keeps its own copy of the points,
and `draw.setPoints` is the only thing that changes it, so a `push` to an array
the script kept for its own bookkeeping never silently redraws a shape. The two
arrays are paired by index, and a point whose time or price is absent is a gap
in the path, as absence reaching any other drawing surface is.

Mutation, deletion and counting:

| Call | Returns | For |
|---|---|---|
| `draw.setFrom(obj: line \| box, t, p)` | nothing | Move a line's or box's first anchor |
| `draw.setTo(obj: line \| box, t, p)` | nothing | Move its second anchor |
| `draw.setBounds(obj: line \| box, t1, p1, t2, p2)` | nothing | Move both anchors in one call |
| `draw.setAt(label, t, p)` | nothing | Move a label |
| `draw.setPoints(polyline, times, prices)` | nothing | Replace a polyline's path |
| `draw.setText(obj: label \| box, text)` | nothing | Change a label's or box's caption |
| `draw.setColor(obj: line \| label \| box \| polyline, color)` | nothing | Change the line or border colour |
| `draw.setTextColor(obj: label \| box, color)` | nothing | Change the text colour |
| `draw.setFillColor(obj: box \| polyline, color)` | nothing | Change a box's or polyline's fill |
| `draw.setWidth(obj: line \| box \| polyline, width)` | nothing | Change the line thickness |
| `draw.setStyle(obj: line, style)` | nothing | `"solid"`, `"dashed"` or `"dotted"` |
| `draw.setExtend(line, left, right)` | nothing | Continue a line to the pane edge |
| `draw.setTooltip(obj: label \| box, text)` | nothing | Detail shown while the pointer rests on the object |
| `draw.delete(obj: line \| label \| box \| polyline)` | nothing | Remove one object |
| `draw.deleteAll()` | nothing | Remove every object this script created |
| `draw.count()` | `number` | How many objects this script currently holds |

**A setter names the object kinds it takes.** They are the kinds that carry the
property being written: only a line and a box have two anchors to move, only a
label and a box carry text, only a box and a polyline have a fill, and only a
line has a style. A setter given another kind, or given something that is not an
object at all, is OS3011 at that argument, before any bar runs. The alternative
was a parameter that took whatever it was given, and under it
`draw.setFrom(aLabel, t, p)` wrote an anchor onto a label, drew nothing and said
nothing, which is the failure this language is written to make impossible.

A setter given an object that has been deleted is OS4005 rather than a silent no
operation, because a script mutating a deleted object has lost track of its own
state and will keep doing so. A setter given `none` does nothing, because an
absent handle is a gap like every other absence reaching a drawing surface
(`language.md` section 6.7), and it is what the fix for OS4005 asks a script to
produce.

An object created on a bar that is then re-executed is subject to the rollback
rule of `language.md` section 7.5: the object set is restored to what it was at
the end of the previous bar before the moving bar runs again, so a live chart
does not accumulate a duplicate line per tick.

**Count: 31 entries, of which 0 are planned.**

---

## 15. Higher timeframe and other instrument reads

### 15.1 The two reads and the mode they declare

| Call | Returns | Warmup | Lands in | For |
|---|---|---|---|---|
| `req.timeframe(timeframe, expr, mode = "confirmed")` | series of `expr`'s type | first bar the mode allows, section 15.3 | the study's own calculation, folded from the chart's bars or from a finer base the host serves, section 15.2 | Read an expression computed on another interval, coarser or finer |
| `req.symbol(symbol, timeframe, expr, exchange = chart.exchange, mode = "confirmed")` | series of `expr`'s type | as above, plus the host's answer | the contract's request for another instrument's bars, its attach lifecycle and its data status | Read an expression computed on another instrument |
| `req.isReady(read)` | `series bool` | bar 0 | the same | Whether the host has answered yet |
| `req.error(read)` | `series string` | bar 0 | the contract's data status | The reason a read failed, or `""` |
| `req.candle(timeframe, mode)` (planned) | `array<number>` | as above | a plotted column with four named sources | The whole higher timeframe bar at once, for drawing it |
| `req.events(kind)` (planned) | `series number` | host dependent | the same request path | Dividends, splits and other scheduled events |

### 15.2 Timeframe strings

A timeframe is a count and a unit: `"1m"`, `"5m"`, `"15m"`, `"1h"`, `"4h"`,
`"1D"`, `"1W"`, `"1M"`. The unit letters are case sensitive, so `"1M"` is one
month and `"1m"` is one minute. A bare number is read as minutes, so `"60"` and
`"1h"` are the same timeframe, because that is the form an interval input
supplies. An unrecognised timeframe is OS6001.

**Any whole number of minutes reads on any intraday chart**, coarser or finer
than the chart's own interval. Where its bars come from depends on how the two
intervals relate:

| Requested, on an intraday chart | Its bars are folded from |
|---|---|
| A whole multiple of the chart's interval, or a day, week or month | The chart's own bars |
| Any other intraday interval, finer than the chart's included | Bars at the base interval, which the host serves |

The base interval is the longest one that divides both the chart's interval and
the requested one: five minutes for fifteen or twenty five on a ten minute chart,
and one minute for three. A requested bucket whose boundary falls inside a chart
bar cannot be cut out of the chart's bars, and a finer bucket cannot be either,
so the bars it is folded from are the base bars inside each chart bar, all of
them and nothing after it (`compiled-program.md` section 2.16.2). A read the
host serves no base bars for is absent with its reason in `req.error`, and a host
that serves no requests at all leaves such a read refused at load: OS6015 for a
coarser one and OS6002 for a finer one. A read written inside another read is
folded from that read's buckets and keeps to whole multiples of its timeframe.

**A finer read is the last of its bars that closed by the chart bar's close.** On
a ten minute chart, `req.timeframe("3", close)` on the bar from 09:15 to 09:25 is
the close of the three minute bar from 09:21 to 09:24; with
`mode = "developing"` it is the bar still forming at 09:25, the one from 09:24.

**An intraday bucket is counted from the trading day's open**: the session's
open where the host states a session, midnight in the instrument's timezone
where it states none, and midnight UTC where it states no timezone either. So a
sixty minute bucket on a market that opens at 09:15 runs from 09:15 to 10:15,
as the venue's own candles do, and a period that does not divide a day, such as
twenty five minutes, begins at the same time every day. An interval of a day or
longer written in minutes or hours is counted from the epoch.

On a chart of a day or longer, a requested timeframe finer than the chart's is
OS6002: its base would be minutes across the whole of the chart's history.

### 15.3 The mode, which is the whole point of this section

**`mode` decides what the read is allowed to know, and it is the argument that
makes a repainting study impossible to write by accident.**

| Mode | What it reads | Repaints | Warmup |
|---|---|---|---|
| `"confirmed"` | Only higher timeframe bars that have closed | Never | Absent until the first higher timeframe bar has closed, then the value changes only when the next one closes |
| `"developing"` | Includes the higher timeframe bar currently forming | On the newest bars only, within the current higher timeframe period | Absent until the first higher timeframe bar has begun |
| `"lookahead"` | A higher timeframe bar's final value from its first lower timeframe bar | On history, permanently and by design | Absent only where the higher timeframe bar does not exist |

`"confirmed"` is the default, and it is the only mode that never repaints. The
other two must be written out. That is the whole mechanism: a script that
repaints says so on the line that causes it, in a word a reader will see during
review, and a script that says nothing cannot repaint.

The compiler emits warning OS8005 on a `"lookahead"` read, naming the line and
what the study will now do, and warning OS8002 on a higher timeframe read in a
file that also sets `onUnconfirmed = true`, whatever the read's mode, because
that pair repaints the confirmed history as well. A `"lookahead"` read also marks
the compiled study as repainting, and the host shows that mark in the legend,
because a warning in an editor nobody opens again is not a disclosure. A
`"developing"` read carries no warning of its own in language version 1: the mode
word on the line is its disclosure, which is the whole reason it has to be
written out.

`"lookahead"` exists at all because drawing the completed higher timeframe candle
across history is a legitimate picture, and a language that refused it would push
people to the same thing done worse. It is named so that nobody reaches it
without meaning to.

### 15.4 What an expression means inside a read

The `expr` argument is compiled as a separate program over the requested bars.
Inside it, the built-in series of section 3.1 are the requested instrument's, at
the requested timeframe.

```
dayHigh   = req.timeframe("1D", high)
dayRsi    = req.timeframe("1D", rsi(close, 14))
indexTrend = req.symbol("INDEX", "1D", ema(close, 20) > ema(close, 50))
```

A name from the file scope may be read inside `expr` only when it is a
compile-time constant: a literal, arithmetic over literals, or an `input()`.
Reading a per-bar name is OS6003, because a value computed on this chart's bars
has no counterpart on the requested bars and there is no honest answer for what
it would mean there.

An `input()` may also be written inside `expr` directly, rather than behind a
name. It is the same setting read the same way, and it is the same row of the
same dialog: the engine resolves it in the enclosing program before the body
runs and fills it into a register of the body's own table, which is what the
read's `inputs` list carries (`compiled-program.md` section 2.16). `language.md`
section 13.4 puts an `input()` anywhere at the top level a value belongs, and a
read's expression is not one of the two places it excepts.

A `var` holding a setting is not a setting. Its cell is the setting's value on
the first bar and whatever the file puts in it afterwards
(`language.md` section 8.2), so it is a per-bar name and reading one here is
OS6003 like any other.

An order function inside `expr` is OS7003. Drawing and alert calls inside `expr`
are OS3006.

### 15.5 Waiting for the host

A `req.symbol` read cannot complete until the host supplies the other
instrument's bars, which is not instant. The read is absent until the answer
arrives, the study reports itself as loading through the contract's data status,
and the engine recalculates when the bars land. The study keeps drawing
everything that does not depend on the read.

A request the host cannot answer surfaces as one of three codes, because the
three have three different fixes: a symbol or an exchange the host does not know
is OS6007, an instrument the host resolved and has no bars for over the chart's
range is OS6008, and a source that refused, failed or was never connected at all
is OS6009, carrying the host's own reason. Each of them puts that reason in
`req.error(...)` and leaves the host free to offer a retry. OS6002 is the finer
timeframe of section 15.2 and is never one of these; `errors.md` section 6
records the reassignment.

A read the engine cannot fold surfaces the same way. A day, week or month read
is dated in the instrument's timezone (section 12.1), so a host that stated none
leaves it absent on every bar of the run: `req.isReady` is false and `req.error`
carries OS6012 naming the timezone. A read that is waiting and a read that will
never answer look the same on a chart, and only one of them is worth waiting
for.

**Count: 6 entries, of which 2 are planned.**

---

## 16. Alerts

| Call | Returns | Lands in | For |
|---|---|---|---|
| `alert(message, id = "", title = "", frequency = "oncePerBar")` | nothing | one entry of the contract's watched conditions | Raise a named alert on this bar |
| `notify(message, channel)` (planned) | nothing | the host's routing, not the chart | Send an alert somewhere the host has configured |

`alert()` is the only function in this group. That is not an omission: a
condition is an ordinary `if` in the language, so an alert needs nothing beyond a
way to say what to send.

```
if crossUp(fast, slow)
    alert("Fast crossed above slow at " + text(close, 2), id = "cross-up")
```

### 16.1 How a call becomes a declared condition

The compiler lifts each `alert()` call site into one entry of the contract's
watched conditions. The entry's predicate is the chain of guards that reaches the
call, and its message is the argument, evaluated for the bar the predicate
accepted. The host's runtime then watches the study rather than the script
polling anything.

This is why `id` matters: it is the stable name of that entry, so a user's alert
subscription survives an edit to the script. With no `id` the compiler derives
one from the call's position, which changes when a line is inserted above it, and
emits warning OS8008 saying so.

### 16.2 When an alert fires

An alert follows the rule of `language.md` section 7.5: it does not fire on a bar
that is still moving unless the declaration sets `onUnconfirmed = true`. The
deferred call fires when the bar closes, and if the condition is no longer true
by then it never fires at all. That is the behaviour that makes an alert worth
acting on.

`frequency` takes:

| Value | Means |
|---|---|
| `"oncePerBar"` | At most one alert per bar, the default |
| `"once"` | The first time only, for the life of this study instance |
| `"everyUpdate"` | On every execution of the bar; requires `onUnconfirmed = true`, or OS3009 |

Adding a study to a chart that already holds history fires nothing for those
bars. An alert is a statement about now, and a study added at noon that emitted
four hundred historical alerts would be useless.

**Count: 2 entries, of which 1 is planned.**

---

## 17. Orders, legs and strategy risk

Everything in this section is available only in a `strategy()` file. Calling one
from a `study()` file is OS7001, with the fix naming the declaration to change.

This is the one part of the library that spends money, so it is written to a
different standard from the rest. Two engines that disagree about a colour draw a
different picture; two engines that disagree about when a stop is hit take
different trades from the same script. Everything in sections 17.8 to 17.11 is
therefore a conformance area with vectors of its own, on the same footing as the
rest of the language, and an engine is conforming only when it reproduces them. A
case supplies frames from its case directory (`conformance.md` section 3).

**Most of this section is marked planned, and the fourteen entries that are not
are the ones an engine can answer today.** Six order functions place an order,
three more spell the same act differently, and five position facts are folded
from what those nine sent and what the destination reported back. All fourteen
rest on one thing, which is why they are the fourteen: the ledger of section
17.7, which the run keeps. **No position fact is read from a host's position
row**, and section 17.1 is the rule rather than the preference.

Every other entry here is a rule evaluated against that ledger by the legs and
the book of sections 17.6 and 17.9 to 17.11, or a figure that needs a cost model
to compute, and neither exists in an engine in this release. The names stay in
this table because the shape of the surface is part of what the language promises
and hiding it would make the promise harder rather than smaller. What the marker changes is when a script is told: a marked name is
refused at the call, where a reader can see what they wrote, with a message that
says it is planned, instead of compiling and then being refused at load with a
message that names a function and gives no reason.

### 17.1 The position model

A strategy holds **one position per leg**. A leg is one contract the strategy
trades, named by a string and declared before the run starts (section 17.6). A
strategy trades the legs it declared: a leg names a contract outright with
`leg.fixed` or describes one with `leg.relative`, and the host resolves the
description before bar 0. A file that declares no leg has exactly one leg, the
instrument its chart is showing, and every order acts on it with no leg named.

**Every order names a leg, and no order function takes a symbol.** The engine
neither parses a symbol nor builds one, for the reason section 17.6 gives.

**A strategy never places an order that computes a delta against the account's
position.** Every order states its own side and its own quantity outright.

An account position is held per contract, not per strategy. A second strategy on
the same contract, a manual trade, or this same script started twice all land in
that one row. An order that reads the row and sends the difference is therefore
computing against somebody else's trade: two strategies on one contract would
each keep undoing the other, and neither would be wrong from where it was
standing. This is a rule rather than a default because the failure is silent. It
costs nothing on the day only one strategy is in the market, and it costs the
whole position on the day two are.

What follows from it:

- A strategy's position is folded from the strategy's own settled fills and from
  nothing else. The ledger of section 17.7 is where those fills live.
- Every profit figure the language reports comes from those same fills. No
  number in section 17.4 is read from the account's position row.
- Where the account holds a position in a contract this strategy also holds, the
  run's record says so and carries the account's quantity beside the strategy's.
  The language never divides a shared position between its owners. `pos.isShared`
  reports that the position is shared, and no call returns the account's quantity
  as a number, because a script that could read it would compute against it,
  which is the rule above.

`buy(qty)` adds to a leg's position, `sell(qty)` subtracts from it, and `close()`
flattens it. **No order crosses zero.** An instruction that would take a leg from
long to short is sent as two orders, one that closes the outgoing position and
one that opens the replacement, each carrying its own position reference. A
single order that crossed zero would leave a late fill with no way to say which
of the two positions it settled, and during a flip a leg holds both at once.

**Which position an order is sent against is decided by what the leg holds
including what is working, not by its settled net.** A position is folded from
settled fills and from nothing else, so while an entry is unanswered the net
reads flat and an order opposing that entry is not opposing anything the net can
see: `buy(qty = 6)`, and `sell(qty = 9)` a bar later against a silent
destination, are one position that opened six long and settled three short. A
position with six units still to come is a position holding six, and an opposing
order takes those six off it before it opens anything, because otherwise nothing
can bring that position back to zero. **The answer does not depend on how fast
the destination answers.** The same instruction is the same two orders whether
the entry has settled, is still in flight or has partly arrived; what changes it
is the position changing, so an order that ended having filled three leaves three
to take and one that ended having filled nothing leaves nothing at all.

**An order that spans more than one position is that many orders**, for the
reason the flip already gives. A leg holds more than one position whenever an
order that opposes it is outstanding, and each of them is reduced by an order of
its own, oldest first, so that a late fill can still say which position it
settled. That is as true of a bare `close()` and of `order.reverse` as it is of
an entry: sizing against the whole leg and attaching the result to one position
sends an order large enough to take that position through zero and out the other
side.

**What an opposing entry may take and what a close may send are two different
numbers**, and both are this section's. An entry is sent at the size the script
wrote whatever the leg holds, so the only thing being decided is where its units
land, and it may be divided against a position that has not settled. A close
works its own quantity out, so it may only work out one that has settled: a close
counting an entry that is still working would sell units that may never exist.

**What no engine answers for is a destination that answers one order and not the
other.** An entry divided against an unanswered entry is placed against units
that were promised and may not arrive, and if the first order is rejected while
the second fills, that position settles on the side it did not open on. Holding
the second order back until the destination answers is an engine that stops
trading when a destination is slow, which is worse. What this section is
unconditional about is kept either way: every order names exactly one position,
so every fill, however late, says which position it settled.

**The two halves of that split need different things, and an engine keeps them
apart.** Working out how much of an instruction closes and how much opens
subtracts a position folded from filled quantities from a quantity the script
stated, and those are the same kind of number only under `qtyType = "units"`.
**Minting a position reference needs none of that arithmetic**, so an engine
does it in every unit: an entry that opposes what the leg holds and whose
quantity the engine cannot read carries a position reference of its own and
never the outgoing one. The quantity it sends is the quantity written, because
there is no sound way to divide it, and the outgoing position is then left
holding what it holds, which is the part that waits on the instrument's lot
size. A leg then holds two positions at once, and the average entry price it
reports is taken over the positions on the side of its net, so a position on its
way out does not move the entry price of the one on its way in.

**The position it left behind is still named again.** A close works its own
quantity out in units and is divided across the positions holding the leg's own
side, oldest first, so that position returns to zero as soon as the leg's net
comes back to its side. What waits on the lot size is the instruction itself
closing it: on a leg whose net never returns to that side, the position is
carried for the life of the run with no order able to name it. That is the whole
of what is not kept here, and `errors.md` OS7005, which nothing raises yet, says
so where a reader meets it.

**A close is never minted a position of its own.** It is named for reducing, and
an engine that gave it a position would have made `close` open one, which is the
mistake 17.2 refuses a stated quantity for. A close is sent against the position
it is closing. So where the engine cannot read the quantity a close states, that
position is what the order may take past zero, and that is the one shape of this
section an engine does not keep outright, named again at the end of it.

**The position it is closing is the oldest one holding the side the close
reduces**, and that is true whether or not what has settled there is already
spoken for. A position whose whole settled quantity is inside an order the
destination still has has nothing left for a close that works its own quantity
out, so it is not offered one; but a close whose quantity the engine cannot read
is not choosing a number, and the position it is closing is still that one.
Reading the two as one question sent a close in lots against the position an
entry was opening on the other side, which is a call named close adding to a
position. **Where the leg holds no position on the side the close reduces, the
call sends nothing**, whatever it stated: a close is never minted a position, so
there is nothing for it to be sent against. A part netted over one tag's rows
can read as holding something when no position does, because a position is not
netted per tag.

**What is available to reduce is the settled position less everything already
working against it.** A position is folded from settled fills and from nothing
else (section 17.8), so an order the destination has not answered has filled
nothing and has moved no position figure: measured against the position alone,
every reducing order sends the whole of it again. That is one defect with two
faces, and both are reachable from an ordinary script. Two bare closes on one
bar would take a leg holding three long to three short under one position
reference, with no quantity written anywhere. And with a destination slower than
the chart, `close()` on every bar while `pos.size` is positive sends one close
per bar for the length of the run, because `pos.size` correctly still reads what
settled: six bars end twelve short and it grows without limit.

**So the scope is the run and the position, not the bar.** What is still working
against a position is what the ledger of section 17.7 holds: an order that is
neither terminal nor fully filled, counted by the part of it that has not
filled. A partial fill releases what settled. A rejection, a cancellation and an
expiry release the rest, because nothing more is coming from an order that has
ended, and that is how a strategy whose close was refused closes again.
`cancel()` is how a strategy whose close was never answered gets its way out. An
order that adds to a position holds nothing at all: an entry that has not
settled is not a position, and counting it would send a close for units that may
never exist.

`close()` twice on one bar sends one order and then nothing, and so does
`close()` on the bar after one whose close is still working: that is the
idempotence of 17.2 rather than an exception to it. **A bar declared
`onUnconfirmed` is one bar however many times it is executed, for this count and
for no other rule.** The orders its earlier executions sent really were handed
over, so they are working like any other. It is not a general statement about
the bar: an entry is not a reducing order and is not held to this, so
`buy(qty = 3)` on a bar executed four times sends four orders and the leg holds
twelve where the script wrote one entry. That is `language.md` section 7.5, a
script may not assume it runs once and guards with `bar.isConfirmed`, and it is
the rule an engine keeps there.

That count is in units, because a position is. A quantity the engine worked out
is in units already, and a quantity the script stated is in the declaration's
own unit (`host-interface.md` section 7.1). Where that unit is not units the
engine cannot read the order it sent as a number of units, and it counts such an
order as having reduced the whole of what was left: the alternative is to count
it as nothing and send the position a second time, and between a close that
sends nothing and an order that crosses zero this section has already chosen.
So the rule above is kept outright for every quantity the engine works out,
which is every close that states none, the closing half of a flip and the
closing half of `order.reverse`, and for every quantity a script states in a
declaration counting in units, on the bar it was sent and on every bar after it.
**A quantity stated on a close in lots, cash or an equity percent is the one
thing it cannot be kept for**, because that order cannot be added to the count
at all: it is sent as written, against the position it is closing, and it is the
one shape of this section an engine does not enforce. 17.2's close paragraph and
`errors.md` OS7017 say so at the call a reader writes, and the fact both of them
wait on is the instrument's lot size, which no leg is given today.

One position per leg, rather than one net book across every leg, because legs are
different contracts: adding a position in one to a position in another produces a
number that is not a quantity of anything and cannot be sent anywhere.

An order is filled according to the declaration's `fillOn` option
(`language.md` section 13.3), with the declared slippage and commission applied.
**The party that applies them is the destination**, whether that destination is a
sandbox one, a backtest's own or a venue: the engine folds the price it is told
(section 17.8) and never adjusts one. Two parties applying a slippage apply it
twice, and neither applying it is a backtest that lies in the other direction.

An order function given an absent price or quantity is OS7002 and places nothing,
per `language.md` section 6.8. That is an argument the script wrote whose value
came out absent. An argument it did not write takes the default the signature
states: `buy()` takes the declaration's size, and `buy()` with neither price is a
market order, which is section 17.2's own rule and not a substitution.

### 17.2 Placing orders

| Call | Returns | Lands in | For |
|---|---|---|---|
| `buy(qty = the declaration's, limit = none, stop = none, tag = "", leg = the only leg)` | nothing | the strategy's ledger, then the order destination | Enter or add to a long position in one leg |
| `sell(qty = ..., limit = none, stop = none, tag = "", leg = ...)` | nothing | the same | Enter or add to a short position in one leg |
| `close(tag = none, qty = none, leg = ...)` | nothing | the same | Flatten a leg, or the part of it carrying one tag |
| `exit(tag = "", qty = none, limit = none, stop = none, profit = none, loss = none, leg = ...)` | nothing | the same | Set the leg's stop or target from a call site |
| `cancel(tag)` | nothing | the same | Cancel a working order that has not filled |
| `cancelAll()` | nothing | the same | Cancel every working order this strategy placed |

With neither `limit` nor `stop`, `buy` and `sell` place a market order. With
`limit` alone they place a limit order, with `stop` alone a stop order, and with
both a stop-limit order. One function with optional prices rather than six named
functions, because the trader's decision is direction and the price is a
qualifier.

`side` is `"buy"` or `"sell"`. `type` is `"market"`, `"limit"`, `"stop"` or
`"stopLimit"`. A `type` and the prices given agree or the call is refused:
`"limit"` takes `price`, `"stop"` takes `trigger`, `"stopLimit"` takes both and
`"market"` takes neither. A type that names a price it was not given is OS7007,
and a value outside either set is OS3008.

**Every order function names the leg it acts on.** In a file with one leg the
`leg` argument defaults to that leg and is never written. In a file with more
than one, leaving it out is OS3012: there is no leg the engine could invent. A
`leg` that is not one of the declared names is OS3008, whose message lists the
names that are. **A `leg` written in a file that declares none is OS3023**,
whatever it names and whether the name was written or computed: the set of
accepted names is empty, so the value is not what is wrong, and the fix is to
take the argument out. It is a check rather than a note because ignoring the
argument is silent in the most expensive way an order can be, a script that
enters under one name and closes another trading the leg it did not name.
17.6's declarations are planned, so OS3023 is what every `leg` argument meets in
this release and OS3008 is what it will meet once a file can declare one.

`exit` prices may be given as absolute prices (`limit`, `stop`) or as distances
from the entry (`profit`, `loss`, in the instrument's own price units). Giving
both an absolute and a distance for the same side is OS3010, because the two
would have to be reconciled and any rule for that would surprise somebody.

**A leg carries at most one stop and at most one target at a time.** `exit()`
sets them from a call site and `leg.stop()` and `leg.target()` of section 17.9
set them as standing levels; they are two spellings of one thing, and the last
call to run on a bar is the one in force. `leg.stopPrice()` and
`leg.targetPrice()` read back the level actually in force, whichever set it.
There is no trailing stop here: a trail is a rule evaluated on every bar rather
than a price an order can rest at, so it lives in section 17.9 and has one
spelling only.

Two opposite orders on one leg on one bar are OS7013, and neither is placed. Two
opposite orders on two different legs are ordinary: that is what a two-sided
position is.

**What a tag argument means is written in its default.** A tag that defaults to
the empty string is a **label**: the call carries it to the destination and to
the report, it names nothing that has to exist, and an empty one is an ordinary
order. A tag that is required, or that defaults to absence, is a **reference**:
it names something the strategy already has, and naming nothing is a mistake
rather than a no-op. The rule is readable in every signature in this section and
in 17.3. `buy`, `sell`, `exit`, `order.place`, `order.reverse` and
`order.bracket` default theirs to the empty string, so a bracket whose tag names
no order is not refused: a bracket sets the leg's level, which is the sentence
above about a leg carrying one stop and one target, and the tag rides along as a
label. `cancel` requires its tag and `close` defaults its to absence, and both
name something that has to be there.

The reading calls of 17.3 are the one exception, and it is stated there: their
tag is a reference, and a tag that names no row reads as the entry's documented
empty value instead of raising, because reading is how a script finds out.

`close(tag)` names the part of the position that tag entered. A tag no order in
the file is placed with can never name a part of one, so the call would send
nothing on every bar and say nothing, and that is OS7016 at the call before any
bar runs. It is read from the file rather than from the run because the run
cannot tell it from an ordinary bar: a tag that has never named a ledger row is
also what a working script looks like before its entry has fired. A tag the
script computes is not read at all. Closing a tag that named rows which now hold
nothing is not this: it is idempotence, it sends nothing, and it says nothing.

**The side of a close is the side that reduces what it is flattening**, which is
the part where a tag names one and the leg where none does. The two are not the
same question, and a leg is where they give different answers: it can be long
under one tag and short under another, and its net says nothing about either.
Taken from the net, `close(tag)` on a part holding four short under a leg six
long is a sell of four, which takes that part to eight short and cuts the other
tag's long to six, and that is the reading this section has already refused for
a stated quantity, because it lets `close` open a position. A part whose own
rows have netted to nothing has no side and the call sends nothing, which is the
idempotence above and the same answer a flat leg gives a bare close.

**A part is closed against what it holds, and what is already working against it
is counted on the part's own side too.** The close on its way to flatten a short
part is a buy, which the leg's net calls an addition, so a count taken from the
leg does not see it and the next `close(tag)` sends the part a second time. What
a part can still close is the same subtraction one scope in: what that tag's
rows hold, less what is already coming off them.

**A part on the side its leg is not on is not bounded by the leg.** Where the
two are on one side the leg is the ceiling, so that closing a part can never
take the leg through zero. Where they are not, closing the part moves the leg
away from zero rather than towards it, and there is nothing for the leg to
bound: a part holding ten short under a leg netting two long is closed by ten,
not by two, and under a leg netting nothing at all it is still closed by ten.
What bounds that order is the positions themselves, each of which takes only
what has settled on it, so a part whose position has already returned to zero
sends nothing rather than opening it again.

**A `qty` written on a close may not be larger than what that close is
closing**, which is the whole leg where no tag is named and the part one tag
entered where one is, less whatever is already working against it (17.1). Larger
is OS7017, naming what was asked for and what is left,
and the call sends nothing: no order crosses zero (17.1), and a stated quantity
is the one number a close sends without working it out. A ceiling applied
silently would send a quantity the script did not ask for and leave it believing
it had closed the one it did, and reading the call as a reversal would let
`close` open a position.

**The engine compares the two numbers in full only where they count the same
thing**, which is a declaration whose `qtyType` is `"units"`: a position is
folded from filled quantities and a stated quantity is in the declaration's own
unit (`host-interface.md` 7.1), and the lot size that would join them is the
fact 17.14's list is still waiting for. The half of the comparison that needs no
lot size is made whatever the declaration counts in, because nothing left to
close is zero in all four units: a close that states a quantity against a part
holding nothing is OS7017 in lots, in cash and in an equity percent exactly as
it is in units. What is left unheld is one shape, a quantity stated against a
position that is still there in a declaration counting in anything but units.
That order may cross zero and is not refused. What the engine sizes for itself
after it does not add to the crossing: an order the engine cannot read is
counted as having closed the whole of what was left (17.1), so a `close()` after
it on the same part sends nothing. A second stated quantity is not held either,
because it is another order of the same shape rather than a consequence of the
first.

**This is why `close(tag = "entry", qty = 1)` on a tag that has already
flattened is refused while `close(tag = "entry")` on the same tag is silent**,
and why a bare close sends nothing rather than being refused when the whole of
the leg is already going, whether the order going was sent on this bar or on one
before it: the engine was asked for a number and the number is zero.
The two look inconsistent and are not. A quantity is an argument the script
wrote, so it is a claim about the strategy's own position and the claim can be
false; a call that writes no quantity asks the engine for the right number, and
there is nothing there to be wrong about. The same sentence settles `buy()`
against `buy(qty = none)` (17.1) and `close(tag = "entry")` against a tag no
order places (OS7016), and it is one rule rather than three.

### 17.3 The `order` namespace

| Call | Returns | For |
|---|---|---|
| `order.place(side, qty, type = "market", price = none, trigger = none, tag = "", leg = the only leg)` | nothing | The general form, for a script that computes its side |
| `order.reverse(qty = none, tag = "", leg = ...)` | nothing | Close a leg's position and open the same size the other way, as the two orders of section 17.1 |
| `order.bracket(tag = "", profit = none, loss = none, leg = ...)` | nothing | Set the leg's stop and target as distances from the entry |
| `order.working(tag)` (planned) | `series bool` | Whether an order with that tag is live and unfilled |
| `order.pending` (planned) | `series number` | How many orders are live and unfilled |
| `order.id(tag)` (planned) | `series string` | The destination's own reference for that tag, `""` before the destination has answered |
| `order.status(tag)` (planned) | `series string` | The ledger's folded status for that tag, section 17.7 |
| `order.filled(tag)` (planned) | `series number` | Cumulative filled quantity for that tag, `0` before the first fill |
| `order.avgFill(tag)` (planned) | `series number` | Average fill price for that tag, absent before the first fill |
| `order.rejection(tag)` (planned) | `series string` | The destination's own rejection text, `""` when there is none |
| `order.qtyForCash(cash, price = close)` (planned) | `number` | Size from an amount of money |
| `order.qtyForRisk(risk, entry, stop)` (planned) | `number` | Size so that being stopped out costs `risk` |
| `order.qtyForEquityPercent(percent, price = close)` (planned) | `number` | Size from a percentage of current equity |
| `order.roundToLot(qty, direction = "down", leg = ...)` (planned) | `number` | Round to a whole multiple of that leg's lot size |
| `order.modify(tag, ...)` (planned) | nothing | Change a working order's price or quantity in place |
| `order.oco(tagA, tagB)` (planned) | nothing | Cancel one order when the other fills |

The seven reading calls, `order.working`, `order.pending`, `order.id`,
`order.status`, `order.filled`, `order.avgFill` and `order.rejection`, read the
strategy's own ledger and never the destination. They are what a script prints
into a table when a trader asks why an entry did not happen, and
`order.rejection` carries the destination's own words rather than a paraphrase of
them, because the destination is the only party that knows why it refused.

They read the ledger at any status, terminal included, which is when
`order.rejection` and `order.avgFill` have something to say. A tag that names no
row reads as the entry's documented empty value; OS7009 is for a call that acts
on an order, which is `cancel` and the two planned calls. Where a tag names more
than one row, the reads read the most recently placed one.

Each of them requires its tag, so each of them takes a reference under the rule
of 17.2, and they are the one place the second half of that rule does not
follow: naming nothing is answered rather than refused. Reading is how a script
finds out, and a read that raised would mean a script could not ask the question
without already knowing the answer. The rule holds without exception for the
calls that act.

`side` and `type` take the values of section 17.2.

The sizing helpers round down to a whole number of units by default, and
`order.roundToLot` rounds down unless told otherwise, because a size rounded up
is a position larger than the script asked for and the error compounds with every
entry.

`order.qtyForRisk` returns `none` when `entry` and `stop` are equal, rather than
raising, because that is a real state during warmup and the order function that
receives the absent quantity will refuse it with OS7002 anyway, naming the
argument.

### 17.4 The `pos` namespace

What is readable about the strategy and the run so far. Every entry is a per-bar
fact folded from the strategy's own fills, and reflects fills rather than
intentions: an order placed on this bar and filled on the next bar's open does
not change any of these until that fill settles.

| Call | Returns | Warmup | For |
|---|---|---|---|
| `pos.size` | `series number` | bar 0, `0` when flat | Net position in units, positive long and negative short |
| `pos.isLong` | `series bool` | bar 0 | `pos.size > 0` |
| `pos.isShort` | `series bool` | bar 0 | `pos.size < 0` |
| `pos.isFlat` | `series bool` | bar 0 | `pos.size == 0` |
| `pos.avgPrice` | `series number` | absent while flat | Average price of the open position |
| `pos.entryTime` (planned) | `series number` | absent while flat | When the current position was opened |
| `pos.barsHeld` (planned) | `series number` | absent while flat | Bars since it was opened, 0 on the entry bar |
| `pos.entries` (planned) | `series number` | bar 0 | How many entries make up the current position, for a pyramiding rule |
| `pos.openProfit` (planned) | `series number` | absent while flat | Unrealised profit in money, at this bar's close |
| `pos.openProfitPercent` (planned) | `series number` | absent while flat | The same as a percentage of the position's cost |
| `pos.maxProfit` (planned) | `series number` | absent while flat | Best unrealised profit this position has seen |
| `pos.maxLoss` (planned) | `series number` | absent while flat | Worst unrealised loss this position has seen |
| `pos.isShared` (planned) | `series bool` | bar 0 | The account holds a position in a contract this strategy also holds |
| `pos.equity` (planned) | `series number` | bar 0 | Starting capital plus realised and unrealised profit |
| `pos.netProfit` (planned) | `series number` | bar 0 | Realised profit since the run began |
| `pos.tradeCount` (planned) | `series number` | bar 0 | Closed trades so far |
| `pos.winRate` (planned) | `series number` | bar 0 | Share of closed trades that made money |
| `pos.profitFactor` (planned) | `series number` | bar 0 | Gross profit over gross loss |
| `pos.maxDrawdown` (planned) | `series number` | bar 0 | Largest peak to trough fall in equity so far |

The first twelve describe one position, so they read the file's only leg. In a
file that declares more than one leg they are refused at compile time, with the
fix naming `leg.size()`, `leg.avgPrice()` and their siblings in section 17.6:
adding a quantity of one contract to a quantity of another produces a number that
is not a position in anything, and summing two average prices produces a price at
which nothing traded. `pos.equity`, `pos.netProfit`, `pos.tradeCount`,
`pos.isShared` and the three planned entries are money and counts, which add
across legs, so they read the whole strategy in every file.

`pos.avgPrice` is absent while flat rather than zero, because zero is a price and
a script comparing against it would take a branch that looks correct. `pos.size`
is `0` while flat rather than absent, because zero is the true size and a script
adding it to something should get the right answer.

`pos.openProfit` is marked to this bar's close. A strategy that marks to
something else, such as a bid or an ask, is not expressible in version 1 and the
entry says so rather than leaving the reader to assume.

`pos.isShared` is a boolean and stays one, under the rule of section 17.1. It is
a fact a dashboard should show and a trader should know.

### 17.5 Where orders land in the chart contract

Nothing in this section corresponds to a field of the descriptor a study becomes.
Orders go to the host's order interface, to the sandbox destination by default.
What reaches the chart is their consequence: each settled fill becomes one marker, and a strategy
that wants its stop or target drawn plots them or draws them like any other
value. The named events of section 17.11 reach the run's record and the host's
log, not the descriptor.

That separation is deliberate. The chart shows what happened; the destination
decides what happens.

### 17.6 Legs, and the contract each one trades

A leg is declared once, at the top level, and never inside a block or a function.
The declarations are top level only under OS3006, for the same reason a plot is:
the set of contracts a strategy trades is part of its fixed shape, known before
bar 0, and a leg that appeared on some bars and not others would leave the run's
record with nothing stable to key on.

| Call | Returns | Lands in | For |
|---|---|---|---|
| `leg.fixed(name, symbol, exchange = chart.exchange, product = the declaration's, qty = the declaration's, side = "buy")` (planned) | nothing | the strategy's leg set, resolved before bar 0 | Declare a leg on a contract named outright |
| `leg.relative(name, underlying, kind, expiryRank = 0, expiryCycle = none, strikeOffset = 0, right = none, reference = none, exchange = chart.exchange, product = the declaration's, qty = the declaration's, side = "buy")` (planned) | nothing | the same | Declare a leg on a contract named relatively |

Every argument of both calls is part of a declaration fixed before bar 0, so each
must be a compile-time constant: a literal, arithmetic over literals, or an
`input()`. A bar-dependent one is OS3003. Two legs declared with one `name` is
OS3017, the same code as two columns sharing a title, because the name is what
every later call keys on.

`leg.fixed` names a contract the host already knows. `leg.relative` names one by
description, and the host resolves it. Field by field:

| Field | Holds |
|---|---|
| `underlying` | The instrument the contract derives from, an identity the engine treats as opaque |
| `kind` | `"future"` or `"option"`. Required, because it decides which of the other fields apply |
| `expiryRank` | A rank, `0` for the nearest expiry and `1` for the one after it |
| `expiryCycle` | Which series, where a venue lists more than one; absent means the venue's default series |
| `strikeOffset` | An offset in strikes from the money, `0` at the money and positive offsets above it |
| `right` | `"call"` or `"put"`, and absent for a future |
| `reference` | The price the offset is measured from; absent means the underlying's price at the moment of resolution |
| `name`, `exchange`, `product`, `qty`, `side` | The leg's own bookkeeping, not part of the contract's description |

The engine never parses a symbol and never builds one: a symbol format built for
one market is meaningless in another, and portability is the whole objective.
That is also why `kind` is stated outright rather than implied by `right`: a
field whose value decides what kind of contract the other fields describe is a
field with two jobs.

`right` or `strikeOffset` given with `kind = "future"` is OS3010.

A relative contract resolves once, under `host-interface.md` section 9.4.

| Call | Returns | Warmup | For |
|---|---|---|---|
| `leg.symbol(name)` (planned) | `string` | bar 0 | The resolved contract, which is what the orders carried |
| `leg.exchange(name)` (planned) | `string` | bar 0 | The exchange the orders were sent to |
| `leg.product(name)` (planned) | `string` | bar 0 | The product actually sent, section 17.7 |
| `leg.expiry(name)` (planned) | `number` | bar 0 | The resolved contract's expiry, absent for a contract with none |
| `leg.strike(name)` (planned) | `number` | bar 0 | The resolved contract's strike, absent for a contract with none |
| `leg.size(name)` (planned) | `series number` | bar 0, `0` when flat | Signed units this strategy holds in the leg |
| `leg.avgPrice(name)` (planned) | `series number` | absent while the leg is flat | Average price of the leg's open position |
| `leg.entryTime(name)` (planned) | `series number` | absent while the leg is flat | When the leg's current position was opened |
| `leg.profit(name)` (planned) | `series number` | bar 0, `0` when flat | The leg's open profit in money, marked to this bar's close |
| `leg.isOpen(name)` (planned) | `series bool` | bar 0 | Whether the leg holds a position |
| `leg.stopPrice(name)` (planned) | `series number` | absent when no stop is in force | The stop actually in force, from whichever call set it |
| `leg.targetPrice(name)` (planned) | `series number` | absent when no target is in force | The target actually in force |

The first five report the contract the host resolved, which is the contract the
orders carried, and they are fixed for the run rather than per bar. The next five
are a leg's own position facts, and in a one-leg file they say what section
17.4's first twelve say. A leg carries no equivalent of `pos.isLong`,
`pos.barsHeld`, `pos.maxProfit` or `pos.maxLoss` in version 1: the sign of
`leg.size()` answers the first, `leg.entryTime()` answers the second, and the
other two are a `var` the script keeps. The last two read the levels of section
17.9, which is where a level is set.

### 17.7 The order and fill ledger

**Each strategy owns its own order and fill ledger.** It is the strategy's record
of what it has actually done, it is what every position figure in this section is
folded from, and it is per strategy rather than per account for the reason in
section 17.1.

The ledger holds one row per order placed. A row is appended when the order is
sent and is never rewritten in place: each frame from the destination appends a
revision, and the row's current fact is the fold of its revisions, so the
sequence that produced a position can be replayed and audited rather than
inferred.

**A bar's rows and a bar's orders are the same set.** A refusal anywhere on a
bar places none of that bar's orders, the ones decided before it included, so
none of them may leave a row either. An engine that appends a row as it maps
each call, which is the ordinary way to write it because the calls after one on
the same bar are measured against the rows before it, has to take those rows
back when the bar is refused. Otherwise the ledger reports an order at `placed`
with an empty `orderRef` that no destination was ever handed, and a host
reconciling against this record after a stopped run sees an order it never
received.

| Field | Holds |
|---|---|
| `intentId` | The engine's own key for this order, unique within the run, carried on the intent and on every frame about it |
| `orderRef` | The destination's own opaque order id, exactly as it was given, as a string the engine never parses, `""` until the destination has answered |
| `tag` | The tag the script placed the order with, `""` when it named none |
| `leg` | The leg the order belongs to |
| `positionRef` | The position this order settles against, below |
| `symbol`, `exchange` | The contract actually sent, after the leg resolved |
| `product` | The product actually sent |
| `side`, `qty`, `type`, `price`, `trigger` | The order as it left the engine |
| `status` | The folded status, below |
| `filledQty` | Cumulative filled quantity, never a delta |
| `avgFillPrice` | The destination's average price over `filledQty`, absent while `filledQty` is `0` |
| `rejection` | The destination's own rejection text, `""` when there is none |
| `placedAt`, `updatedAt` | When the order was sent, and when a frame last changed the row |

Three of these exist because the short version loses money.

**The product is recorded as sent, not as declared.** A product is translated per
destination, so the word a strategy carries and the word that reached the
destination are not always the same, and a position reconciled against the
declared word is reconciled against something nobody traded. `leg.product()`
returns the word that was sent.

**The symbol and exchange are recorded as sent.** A leg that resolved a relative
contract carries a name the source never wrote, and that name is the only one a
statement can be matched against.

**Every order carries a position reference.** A position reference is minted when
a leg goes from flat to holding, and it ends when that position's quantity
returns to zero through settled fills. During a flip a leg holds two at once, the
outgoing one and its replacement, which is why a flip is two orders and not one.
A fill settles the position its own order names, never whichever position is
current, because a fill that arrives late would otherwise be applied to the
position that replaced the one it belonged to.

**An order that adds joins the position on its own side, and a reference is
minted where there is none to join.** There is none when the leg holds nothing on
that side, and there is none when the whole of what it holds is already in an
order the destination still has: that position will reach zero and end, and an
order joining it would have to settle into a position that has already ended. So
a leg may hold more than one position on one side as well as one on each.

**An instruction that places no order carries the position it is about, and
never one of its own.** A bracket sets a level on the leg and a cancellation
names an order; neither appends a row and neither moves a position, so neither
mints a reference. A bracket carries the position the leg is holding or opening,
and where the leg holds none there is no position to name: minting one there
took a reference for an instruction that ordered nothing, so the entry after it
opened on the next one and the bracket named a reference no order ever carried,
which is a number a host reconciling the two cannot find on the other side.
`host-interface.md` section 7.1 says what reaches the host when there is none.

**Holding first, opening second, and the newest where a leg holds more than
one.** A leg holds more than one position whenever an order that opposes it is
outstanding, so "the position the leg is holding" needs a choice made: it is the
newest reference the leg's own settled fills have put something on, and only
where nothing has settled at all is it the position the leg is opening. The
newest is the one an entry on that side would join, so a bracket set after an
entry names the position that entry is in. **It is not the reference minted
last**, which is a different fact and answers neither question: a leg whose
newer position closed while an older one was still held reported holding none,
so an `exit()` went out carrying `0` with the strategy's units still on the
books, and a reference minted for an order the destination then refused stayed
the answer for every bracket after it, naming a position that never opened.

**Every position a leg holds can be brought back to zero**, which is what makes
the sentence above a rule rather than a hope. An order on the side that reduces
a position, at the size that position holds, ends it, and a reducing order the
engine sizes itself is divided across the positions holding the leg's own side so
that it reaches them in turn. A reference nothing could ever close would be a
leak in this record. The one shape where that is not kept is an instruction the
engine cannot divide, which is 17.1's last paragraph and `errors.md` OS7005, a
code nothing raises yet.

**Statuses.** The ledger's `status` is one of these words. The Terminal column
says which of them end an order, and the last column says which of them a host
may send in a frame.

| Word | Means | Terminal | A host may send it |
|---|---|---|---|
| `placed` | Sent, and the destination has not answered yet | No | No |
| `working` | Live at the destination and not completely filled | No | Yes |
| `triggerPending` | Accepted and waiting for its trigger price | No | Yes |
| `filled` | The whole quantity is filled | Yes | Yes |
| `cancelled` | Ended by a cancellation | Yes | Yes |
| `rejected` | Refused, carrying the destination's own text | Yes | Yes |
| `expired` | Ended without filling, by the destination's own rule | Yes | Yes |

`placed` is the engine's own: it means an intent has left and nothing has come
back, and a host cannot report a state the destination has never described.

A destination with words of its own maps each of them onto one of these in its
adapter and carries its own word through to `rejection` and the log. The mapping
is the adapter's because a status vocabulary is exactly the kind of thing that
differs per destination and must not reach the language.

### 17.8 Folding an order frame

A frame is cumulative, under `host-interface.md` section 7.2. Frames repeat,
arrive out of order and arrive twice, and an engine that adds each frame's
quantity to a running total doubles a fill and reports a position the strategy
never held.

The fold of a frame `f` into a row `r` is exactly this, and an engine is
conforming only when it is exactly this:

1. **Locate.** `f` names a row by `intentId`. A frame that names no row in this
   strategy's ledger is refused and recorded, and nothing is folded. It is not an
   order this strategy placed. The destination's own reference is recorded from
   the frame and is never used to find a row, because a row has none while it is
   `placed`.
2. **Filled quantity.** `filled = max(r.filledQty, f.filledQty)` and
   `delta = filled - r.filledQty`. The cumulative quantity never decreases, so a
   frame that reports less than the row already holds contributes `delta = 0`.
3. **Average price.** When `delta > 0` the row takes `f.avgFillPrice`, which the
   destination computed over the cumulative quantity. When `delta == 0` the row
   keeps the price it had. The engine never averages two averages of its own: the
   destination's average over the total is already the answer. A frame that
   reports a greater cumulative quantity and no average price is refused and
   recorded, and nothing is folded, because a fill with no price cannot be marked
   against anything.
4. **Status.** Status moves forward along `"placed"`, then `"working"` or
   `"triggerPending"`, then a terminal word, and never backwards. A frame whose
   status sits behind the row's leaves the status alone. A terminal status is
   never left, and a frame arriving at a terminal row does not run this step at
   all: see below.
5. **Changed.** The frame changed the row when the status moved, or `delta > 0`,
   or the rejection text is new. Otherwise it changed nothing.
6. **Settle.** When `delta > 0`, one fill of `delta` units at `f.avgFillPrice`
   settles against `r.positionRef`, which is the position that order belongs to
   and not whichever position the leg holds now.
7. **Stop.** When the frame changed nothing, nothing else happens: no fill, no
   event, no report row, no recalculation. A repeated frame and a frame overtaken
   by a later one both end here.

Because frames are cumulative, a terminal frame that overtakes a partial one
loses nothing: it carries the whole filled quantity, so step 2 produces the
remaining delta in one piece. This is the property that makes the fold safe under
out-of-order delivery, and it is the reason the language reads cumulative frames
rather than asking a destination for deltas it may not be able to give.

**A fill after a terminal status.** A frame naming a terminal row still runs
steps 1, 2, 3, 5 and 6, and does not run step 4. The status keeps the terminal
word it reached, `filledQty` rises, `avgFillPrice` takes the frame's, the
destination's reference, the product as sent and the rejection text take the
newest frame's, and the delta settles against the row's `positionRef` like any
other fill. A `cancelled` row whose cumulative quantity has reached the order's
full quantity stays `cancelled`: the status records how the order ended and the
quantity records what traded, and the two are both true. The fold emits
`fillAfterTerminal` (section 17.11).

A venue reports a fill after a cancellation acknowledgement whenever a cancel
races a fill, which is what a cancel sent near the touch does on a busy
instrument. An engine that refused that frame has lost a real fill, and the loss
is invisible from inside the script: the account holds a position the strategy
cannot see, and every later size, level and square off is computed against the
wrong quantity. Folding a late fill that was never traded would need a
destination to report a quantity it never traded, which is a broken destination
and a visible failure; refusing a real one is silent, and it is silent on exactly
the day a cancel raced a fill.

### 17.9 Protective levels

The levels a strategy declares. Each call sets a level that stays in force until
it is replaced or removed, and passing `none` as the level removes it. These are
not order functions: an absent level removes a rule rather than raising OS7002,
because removing a stop is a thing a script means to do and there is no order to
refuse.

**Per leg.**

| Call | Returns | Lands in | For |
|---|---|---|---|
| `leg.stop(name, price)` (planned) | nothing | the leg's stop, replacing any in force | Close the leg when its price reaches `price` against the position |
| `leg.target(name, price)` (planned) | nothing | the leg's target | Close the leg when its price reaches `price` in favour of the position |
| `leg.trail(name, distance, activateAt = none)` (planned) | nothing | the leg's trailing stop | Follow the best price the leg has seen, `distance` behind it |

**Per strategy.** `book` is the strategy's own book: every leg it has declared,
taken together. Its profit is the sum, in money, of every leg's open profit and
of everything the strategy realised since the book was last flat, which is the
window section 17.12 explains and the reason the combined rules belong to one of
the two shapes and not the other.

| Call | Returns | Lands in | For |
|---|---|---|---|
| `book.stop(amount)` (planned) | nothing | the combined stop | Square off every leg when the book's profit falls to `-amount` |
| `book.target(amount)` (planned) | nothing | the combined target | Square off every leg when the book's profit reaches `amount` |
| `book.lockProfit(activateAt, lock, step = none, advance = none)` (planned) | nothing | the profit floor | Activate a floor at a profit, then advance it as profit grows |
| `book.trailStopsToEntry(at)` (planned) | nothing | every leg's stop | Move every leg's stop to its own entry once the book is `at` in profit |
| `book.direction(filter)` (planned) | nothing | the entry filter | `"long"`, `"short"` or `"both"`, which sides an entry may take |
| `book.entryWindow(spec)` (planned) | nothing | the entry gate | New entries only inside this window, written as section 12.5 writes one |
| `book.exitAt(time)` (planned) | nothing | the exit time | Square off every leg at this `"HHMM"` in the chart's timezone |
| `book.squareOffAtExpiry(minutesBefore = 0)` (planned) | nothing | the expiry rule | Square off a leg this many minutes before its contract expires |
| `book.dailyLoss(amount)` (planned) | nothing | the day's limit | Square off and stop entering for the day when the day's loss reaches `amount` |

What the book reads back:

| Call | Returns | Warmup | For |
|---|---|---|---|
| `book.profit` (planned) | `series number` | bar 0 | The book's profit in money, open and realised since it was last flat |
| `book.dayProfit` (planned) | `series number` | bar 0 | The same measured from this session's open, which is what `book.dailyLoss` tests |
| `book.isOpen` (planned) | `series bool` | bar 0 | Whether any leg holds a position |

A `filter` that is not `"long"`, `"short"` or `"both"`, a window that does not
parse as section 12.5 writes one, and a time that is not four digits are each
OS3008, for the reason that section gives: a value outside the set selects no
rule, and defaulting quietly would change what the script does.

The end of day square off is not a call here. It is the declaration's
`closeOnSessionEnd` option (`language.md` section 13.3), which already exists,
and it is named in section 17.11 for the event it emits. One spelling of one rule.

**The trail, exactly.** `distance` is in the leg's own price units and is
positive. The trail is activated when the leg's profit per unit first reaches
`activateAt`, measured as the last price minus the average entry price for a
long leg and the reverse for a short one; with `activateAt` absent the trail is
activated by the leg's first settled fill. Once active the engine keeps the best
price the leg has seen since activation: the highest price for a long leg, the
lowest for a short one, taken from the bar's high or low on a confirmed bar and
from the last price on a bar that is still moving. The trail's level is the best
price less `distance` for a long leg and plus `distance` for a short one. **The
level only ever moves in the leg's favour.** It never retreats, and it is never
recomputed from a price worse than the best one seen, which is what the word
ratchet means here and what a vector has to prove.

Where a leg carries both a stop and an active trail, the level in force is the
more protective of the two: the higher for a long leg, the lower for a short one.
`leg.stopPrice()` returns that level, not the one the script last wrote.

**The lock profit, exactly.** `book.lockProfit(activateAt, lock, step, advance)`
does nothing until the book's profit first reaches `activateAt`; at that moment a
floor exists at `lock`. When `step` and `advance` are given, the floor stands at
`lock + n * advance` where `n` is the largest whole number for which the book's
profit has reached `activateAt + n * step`. The floor never moves down. When the
book's profit falls to the floor or below while a floor exists, every leg is
squared off. `step` and `advance` are given together or not at all; one without
the other is OS3009.

### 17.10 When a level is tested, and in what order

**Every rule of section 17.9 is evaluated once per bar, after the script's own
statements for that bar have run, in the order below.** The order is part of the
language rather than an implementation detail: two engines that tested a combined
stop before a leg stop would close different positions from the same script on
the same bar.

1. The daily loss limit.
2. The exit time, then the end of day square off, then the expiry square off.
3. The combined stop, then the combined target.
4. The lock profit: activate the floor, then advance it, then test it.
5. The trail to entry.
6. Each leg in declaration order: its stop, then its target, then its trail,
   which is activated, then advanced, then tested.

A rule that squares the book off ends the sequence for that bar. The rules below
it have nothing left to act on and emit nothing. The book rules are tested before
the leg rules because a breached combined limit takes the whole book off either
way, and the record should name the rule that did it.

**How a level is tested.** On a confirmed bar a level is reached when the bar's
traded range reaches it: `low <= level` for a long leg's stop and a short leg's
target, `high >= level` for a long leg's target and a short leg's stop. On a bar
that is still moving the level is tested against the last price only, and the
test is taken again when the bar closes, under the rollback rule of `language.md`
section 7.5.

**When one bar's range contains both a leg's stop and its target, the stop is
taken.** Nothing in a bar says which came first, and assuming the better of the
two is how a backtest invents money that was never made.

**Where the exit fills.** A stop sends a stop order at its level and a target
sends a limit order at its level, so a backtest fills where the level was rather
than at the next bar's open. When the bar's open is already beyond the level, the
fill is at the open, because the level was gone before the bar began. The
declaration's slippage applies to a stop and not to a target: a stop takes the
price on the other side and pays for it, and a limit fills at its own price or
not at all.

A level's exit order is an order like any other. It lands in the ledger, it folds
by section 17.8, and it obeys the lot and tick rules, so a stop that rounds to no
whole lot is OS7005 and a level off the tick is OS7006.

**Not raised yet.** OS7005 is in the catalogue and nothing raises it: nothing
compares an order's quantity with the lot size its leg trades in.

### 17.11 Named events

Every transition a rule causes is emitted as a named event carrying the bar's
time, the leg where there is one, the rule's own level and the value that
crossed it. A trader reading a log after a bad day needs to know which rule
fired, and "the position closed" is not an answer.

| Event | Emitted when |
|---|---|
| `legStopHit` | A leg's stop was reached and the leg was closed |
| `legTargetHit` | A leg's target was reached and the leg was closed |
| `trailActivated` | A leg's trailing stop was activated, because profit reached `activateAt` |
| `trailAdvanced` | A leg's trailing stop moved in the leg's favour |
| `combinedStopHit` | The book's profit fell to the combined stop and the book was squared off |
| `combinedTargetHit` | The book's profit reached the combined target and the book was squared off |
| `lockProfitActivated` | The book's profit first reached `activateAt` and a floor exists |
| `lockProfitFloorAdvanced` | The floor moved up a step |
| `lockProfitTriggered` | The book's profit fell to the floor and the book was squared off |
| `trailToEntryActivated` | Every leg's stop was moved to its own entry |
| `sessionEndSquareOff` | `closeOnSessionEnd` flattened the book at the session's close |
| `expirySquareOff` | A leg was closed because its contract was about to expire |
| `exitTimeSquareOff` | `book.exitAt` flattened the book at its time |
| `dailyLossHit` | The day's loss reached the limit; the book is off and no entry is taken for the rest of the day |
| `entryRefused` | An entry was refused by the direction filter, the entry window or a daily loss already hit, naming which |
| `fillAfterTerminal` | A frame increased an order's filled quantity after the order had reached a terminal status, carrying the tag, the added quantity and the terminal word it arrived after |

`fillAfterTerminal` is not a rule's transition. It is in the list because a fill
the strategy could not have expected is the event a trader most needs named.

An event is a record, not a value. No call reads one, because a script that
branched on its own stop having fired would be deciding twice what the rule
already decided once, and the second decision would be the one nobody tested.

### 17.12 Two strategy shapes

A strategy takes one of two shapes, and the shape decides what a stop means.

**As a unit.** `book.enter(tag = "")` sends every declared leg its declared side
and quantity in one decision, and `book.exit(tag = "")` closes every open leg.
The book has one entry, so the book's profit has one starting point and the
combined rules of section 17.9 measure from it. This is the shape a multi-leg
position is written in when the legs only make sense together.

**Per leg.** `leg.enter(name, side = the leg's, qty = the leg's, limit = none,
stop = none, tag = "")` and `leg.exit(name, qty = none, limit = none, stop =
none, tag = "")` take one leg at a time, on that leg's own signal, filtered by
`book.direction`. Legs open and close at different moments, so the book need
never be flat at all.

| Call | Returns | Lands in | For |
|---|---|---|---|
| `book.enter(tag = "")` (planned) | nothing | one order per declared leg | Enter the whole book as a unit |
| `book.exit(tag = "")` (planned) | nothing | one order per open leg | Exit the whole book as a unit |
| `leg.enter(name, side = the leg's, qty = the leg's, limit = none, stop = none, tag = "")` (planned) | nothing | one order | Enter one leg on its own signal |
| `leg.exit(name, qty = none, limit = none, stop = none, tag = "")` (planned) | nothing | one order | Exit one leg on its own signal |

**This is what a combined stop means, and why it means it.** `book.profit` is
measured from the last moment the book was flat. In a strategy that enters as a
unit that moment is the start of the current trade, because the book goes flat
between trades by construction, so a combined stop is a stop on that trade. In a
per-leg strategy the book may never be flat: one leg closes as another opens, and
the measurement would run from a moment no rule chose and no reader could name.
A combined stop there is a stop on an arbitrary window, which is worse than no
stop at all, because it looks like one.

The shape is therefore decided by which of the two pairs a file uses, and a file
uses one of them. The per-leg pair is `leg.enter` and `leg.exit`, and `buy`,
`sell`, `close`, `exit`, `order.place` and `order.reverse` of sections 17.2 and
17.3 are that same pair written the short way.

- A file that calls `book.enter` or `book.exit` and also calls any per-leg entry
  or exit is refused at compile time. A leg entered outside the unit leaves the
  book holding a position it did not enter as a unit, and the measurement above
  stops being the trade.
- A file that calls `book.stop`, `book.target`, `book.lockProfit` or
  `book.trailStopsToEntry` without calling `book.enter` is refused at compile
  time, with the fix naming `leg.stop` and `leg.target`.

Both refusals hold in a one-leg file as well, although nothing there could go
wrong: one rule that is always true is easier to hold in the head than one rule
with an exception, and a script that grows a second leg later would otherwise
start meaning something different on the day it grew it.

### 17.13 Switching to live

**A strategy is born unable to trade for real.** A new strategy, and a strategy
whose source has just been edited, sends its orders to the sandbox destination.
Switching it to live is a separate, deliberate act performed on that one strategy
in the host, and **nothing in a script can perform it**: there is no call, no
option and no input that switches anything. A misconfigured script found after
the fact cannot have been placing real orders, which is the only guarantee worth
having here.

There is also no call that reports it. A script cannot know whether it is live,
so it cannot behave differently when it is, and the run that was tested in
sandbox mode is the run that goes to market. A strategy that behaved differently
once live would be a strategy nobody had ever tested.

A strategy that places an order with no destination at all, live or not, is
OS7015.

**Not raised yet.** OS7015 is in the catalogue and nothing raises it: a strategy
with nowhere to send orders places intents that reach nobody.

### 17.14 Refusals defined here that the catalogue has no code for

Four refusals above are stated as rules with no code quoted, because `errors.md`
is authoritative for codes and this document does not invent them. This section
states rules and never text: a code's message, cause, fix and scope are
`errors.md`'s. The rules hold either way, and the code follows the rule rather
than the other way round:

- A frame naming an order this strategy's ledger does not hold (section 17.8,
  step 1), at the host.
- A frame reporting a greater cumulative filled quantity with no average fill
  price (section 17.8, step 3), at the host.
- A file that mixes the two shapes of section 17.12, at compile time.
- A combined rule in a file with no book entry (section 17.12), at compile time.

The same applies to the twelve single-position entries of section 17.4 in a file
that declares more than one leg.

**Count: 74 entries, of which 60 are planned.**

---

## 18. The chart contract map

Every call that creates something the host draws, and the descriptor field it
lands in. The field names are the contract's own.

| Call | Contract field |
|---|---|
| `study(overlay = ...)`, `strategy(overlay = ...)` | the descriptor's placement: the price pane or its own pane |
| `study(title = ...)`, `group` | the descriptor's name and its category in a picker |
| `study(range = [min, max])` | the fixed pane range |
| `study(precision = ...)`, `format` | the plot style's precision and the price scale's format |
| `input(...)` | one entry of the declared inputs, with its kind, label, group and tooltip |
| `plot(...)` | one plotted column, plus the computed values it reads |
| `plot(..., color = a series)` | that column's per-bar colour callback |
| `plot(..., offset = ...)` | that column's draw offset |
| `plot(..., scale = ...)` | that column's price scale |
| `plotCandles(...)` | one plotted column naming four source columns, plus the split colour callback for wick and border |
| `fill(...)` | one shaded band between two named columns |
| `level(...)` | one entry of the recomputed horizontal levels |
| `signal(...)` | one entry of the bar-anchored markers |
| `barColor(...)` | the price bar colours, one entry per bar |
| `background(...)` | the pane background, one entry per bar |
| `table(...)`, `cell(...)` | the summary grid, its rows and its options |
| `draw.line`, `draw.label`, `draw.box`, `draw.polyline` | the free drawings, one entry per live object |
| `alert(...)` | one watched condition, with its id, title, message and predicate |
| `req.timeframe(...)` | folding of the chart's own bars, inside the calculation |
| `req.symbol(...)` | the request for another instrument's bars, the attach lifecycle that holds the answer, and the data status the host shows |
| `bar.isNew`, `bar.isConfirmed`, `bar.isRealtime`, `bar.updates` | the calculation context's bar state |
| `chart.timezone`, `chart.now()`, `chart.tickSize`, `chart.symbol`, `chart.interval` | the calculation context's chart facts |
| every calculation in sections 4 to 11 | the computed values, one column per plot, aligned to the bars, absent where the warmup says |
| every order function, level and named event in section 17 | no contract field; the strategy's own ledger, the host's order interface and the run's record |

An absent value reaching any of these is a gap, never a zero: a line breaks, a
band stops, a level is not drawn, a bar keeps its own colour, a cell is blank.

---

## 19. What is deliberately not here

- **Arrays.** `size`, `push`, `pop`, `slice`, `sort` and the rest are specified
  in `language.md` section 14.1, because an array is part of the language rather
  than a library of market functions. They are not repeated here.
- **Operators and conversions.** `text`, `toNumber` and `toBool` appear here
  because a script calls them, but the conversion rules behind them are in
  `language.md` section 5.3 and are not restated.
- **Maps and matrices.** Reserved and unimplemented, `language.md` section 14.2.
  Nothing in this document depends on them.
- **Per-function formulas, in the entry.** A row states the arguments, the
  result, the warmup and the purpose, and stops there, because a table cell is
  not a place to write an accumulation order. The arithmetic is in section 20
  instead, for every function whose result depends on the order of its
  operations, and section 20.10 names the ones whose result does not.
- **An alphabetical index.** The catalogue is grouped by what a function is for,
  which is how somebody looking for one searches. An index over the same names
  is a generated artefact and is not maintained by hand in this document.

---

## 20. The arithmetic

Sections 3 to 17 say what a call takes, what it returns and the first bar it can
honestly return it on. This section says how the number is arrived at: the seed,
the step, the accumulation order, and what is added to what before what.

The two are different promises and only one of them was written down. A second
engine can satisfy every warmup in this document, agree with every description in
it, and still differ from this one in the last bit of every average on the chart,
because a sum has an order as well as a value and binary64 addition is not
associative. Section 8 of `compiled-program.md` makes that difference a release
blocker. This section is what it refers to.

### 20.1 What this section fixes

- **Every operation is under `compiled-program.md` sections 8.1 and 8.2**:
  binary64, round to nearest with ties to even, evaluated in the order written,
  with no reassociation, no distribution and no fused multiply and add. Each line
  below rounds where it is written and the next line reads the rounded value.
- **An arrangement here is normative even where another is mathematically
  equal.** That is the whole reason the section exists. Where a second
  arrangement is in common use, the entry names it and says it is not this one.
- **An arrangement is where one rounding falls relative to another, and nothing
  else.** Only an operation that rounds can be part of one, and two operations
  that do not read each other have no order between them. Four things therefore
  fix nothing and are never constrained here.

  1. **Naming.** Writing a subexpression into a named intermediate and reading
     it back is bit identical to writing it out, because every operation already
     rounds its result to binary64 and 8.1 leaves no wider register for an
     unnamed one to be kept in.
  2. **Forming the same subexpression twice** gives the same value both times,
     for the same reason.
  3. **A step that does not round, spelled another way.** Reordering the
     operands of one addition or one multiplication gives the same value,
     because both are commutative in binary64. So does regrouping a product one
     of whose factors is a power of two, because scaling by a power of two is
     exact and may therefore be applied before the other multiplication or after
     it. And so does writing that exact step differently: a doubling is one
     value whether it is written `2 * v`, `v * 2` or `v + v`, and a halving is
     one value whether it is written `v / 2` or `v * 0.5`. This is the only one
     of the four with an edge, and the edge is not where it looks: two groupings
     part company when the **other** product underflows into the subnormal
     range, where its rounding loses bits the scaling cannot put back, and that
     happens whether or not the answer itself is subnormal. An entry that relies
     on the rule says where its edge is.
  4. **The order of two accumulations that do not read each other.** Where a
     pass over a window feeds more than one total, and no total is read by
     another, each is a sum of its own terms in its own order: interleaving them
     in one pass, running them in two, or swapping which is written first
     changes none of them. What is fixed there is each total's own order, and
     every entry states that as oldest first. A pass that reads what an earlier
     pass produced is the opposite case and is fixed, as `variance`'s second
     pass over the mean is.

  **The test a sentence has to pass to go in here: name the second arrangement
  it refuses, and print the count of where the two differ.** A clause with no
  second arrangement to name is not a constraint, and one whose count is zero
  fixes nothing, whatever the reason. Most zeros are one of the four above in a
  new spelling. Not all of them are: an arrangement of two roundings can still
  come out at zero because of what the operands are, as the grouping of
  `linreg`'s sum of squares does, where the first multiplication of either
  grouping is exact and the second therefore rounds one true product once. That
  is why the test is a count rather than a list to check the sentence against,
  and why a zero is written down with the population it was measured over and
  the edge where it stops being zero. Every sentence this section has had to
  withdraw failed the test the same way: it fixed something about one operation
  on its own, which way round its operands sat, whether its result was named,
  which of two exact spellings produced it. Only a relation between two
  roundings can be fixed, and not one of those is one. A sentence that cannot
  bite sends an implementer to check a half that cannot differ, which is the
  cost 20.10 exists to avoid on whole functions.

  **What a check can do about this, and what it cannot.** It cannot decide
  whether a new sentence is vacuous: deciding that means implementing both
  readings and running them, and a vacuous sentence is precisely one that names
  no second reading to implement, so there is nothing for a checker to read. One
  half of the test is mechanical, though, and `scripts/check-section-20.mjs`
  enforces it: every count this section prints is read back out of this page by
  a test that measures it again. A figure typed here and measured nowhere is how
  each of the withdrawn sentences survived as long as it did, and that failure
  is now a red build rather than a reader's attention. Whether the sentence
  beside the figure is worth making is attention, and it stays attention.
- **A function this section does not name does not depend on the order of its
  operations.** Section 20.10 says which those are and why, so an implementer can
  tell a silence that means "no constraint" from a silence that means "nobody
  wrote it down".
- **Absence is not arithmetic.** Which bars are absent follows from the warmup in
  the call's own entry and from the propagation rule of `language.md` section
  6.7. This section states an absence only where the arithmetic itself chooses
  one, as a division whose divisor is zero does.

Throughout, a **window** of length `len` is the values of the last `len` bars,
and it is indexed from the newest:

```text
w[0]         the value this bar contributed
w[1]         the value the bar before it contributed
w[len - 1]   the oldest value still in the window
```

**Oldest first** means the index runs from `len - 1` down to `0`. That is the
iteration order of `compiled-program.md` section 8.2, and it is the order a
reader assumes when they see a window written out.

### 20.2 The two shapes everything else is built from

Almost every length taking function in the library is one of these two, or is
built out of them. Getting these two right is most of the work of a second
engine.

#### 20.2.1 The window sum

```text
total = 0
total = total + w[len - 1]
total = total + w[len - 2]
...
total = total + w[0]
```

`total` is a binary64 value after each line and is read back rounded on the next
one. The window mean is `total / len`, one division applied to the finished sum,
never a running mean.

**The sum is taken fresh over the window on every bar.** The incremental
alternative, carrying a total forward and subtracting the value that leaves the
window, is the same quantity in exact arithmetic and a different number in
binary64, and its error grows with the history rather than with the window.
Over a walk of twenty thousand bars it differs from the fresh sum on 19745 of
the 19981 windows at length 20, on 19980 of the 19992 at length 9 and on 19301
of the 19951 at length 50. The windows it agrees on are the ones whose roundings
happen to cancel, 236 of the 19981 at length 20, and they are not the early
ones: there the two are at most 4.5 ulps apart over the first thousand windows
and 40.3 ulps apart over the last thousand, which is a drift rather than a fixed
error. `compiled-program.md` section 8.3 refuses it outright, and no function in
this library defines the incremental form as its reference. The anchored running
totals of section 20.6 are not an exception: they have no window to sum, so they
are a different quantity rather than a cheaper way to compute the same one.

The cost is `len` additions per bar, bounded by the length the script asked for
rather than by how much history is loaded.

#### 20.2.2 The seeded recurrence

Every seeded average in the library seeds the same way.

```text
before the seed bar   absent
on the seed bar       running = the window mean of 20.2.1, and that is the value
on a later bar        running = step(running, value), and that is the value
```

The seed bar is the first bar on which the window holds `len` values that are all
present and its normalized mean is finite. An overflowing seed mean returns
absence and leaves the recurrence unseeded, retaining contributions for a later
complete suffix. Over a source that is itself absent during its own warmup, that is the
first bar with `len` present values behind it, which is what makes the warmups of
this document compose rather than having to be asserted one by one.

**A hole after the seed freezes the recurrence**: an absent input produces an
absent output and leaves `running` untouched, so the next present bar continues
from where the last present bar left off. Consuming absence as zero would drag
the average toward nothing, and re-seeding would let one missing bar restart a
two hundred bar average.

An arithmetic overflow after seeding is different from a missing input. A valid
step commits its running value even when that value is non-finite and the exposed
result is absent. It neither freezes the previous finite value nor starts a new
seed. Reset or restoration can return to an earlier state; later ordinary inputs
alone do not recover a recurrence whose running value remains non-finite.

With a changing length, every executed call contributes one position before
seeding, including calls with an absent source or length. Seeding requires the
largest observed valid length's number of contributions under section 2.5 and
a complete suffix of the current length. Changing the length does not discard
earlier contributions or restart the seed clock.

After seeding, each present source with a valid current length advances the
recurrence using that length. Length changes never reseed it. An absent length
freezes the recurrence just as an absent source does. Contribution count and
largest observed valid length continue to advance independently of the running
value. If a later larger length makes the call not ready under section 2.5,
its output is absent, but valid recurrence steps still occur. The next available
reading includes those steps. Only pre-seed values need retained history;
post-seed readiness needs counts, not a second seed buffer.

For source `[1,3,5]` and lengths `[1,3,3]`, EMA is `[1,none,3.5]`. The hidden
second step has running value 2, and the third has 3.5. Freezing the hidden step
would incorrectly give 3. For source `[1,2,3,4]` and lengths `[none,none,3,3]`,
EMA is `[none,none,2,3]`: the first two contributed source values remain available
for the seed. For RSI, the initial absent price change is a contributed position;
it is not a zero change and a seed suffix containing it is incomplete.

Seeding from bar 0 instead, with the first value as the running value, is the
common and cheaper alternative. It is not this one. It draws a line where there
should be a gap and stays materially wrong until the seed decays away.

### 20.3 Moving averages and trend

**`sma(src, len)`** is the window sum of 20.2.1 divided by `len`.

**`ema(src, len)`** is the seeded recurrence of 20.2.2 with

```text
weight = 2 / (len + 1)
rest   = 1 - weight
step   = value * weight + running * rest
```

`weight` and `rest` are computed from the current valid `len`. With constant
length they are the same two values on every bar. **The step is the two products added, and it is not
`running + (value - running) * weight`.** That is a third arrangement of the
same algebra and a third set of last bits, the one the `rma` paragraph below
refuses in the same words, and it is the arrangement an engine is most likely
to reach for, because it is one multiplication rather than two. Over the eighty
bar fixture the release gate compares bit for bit it differs from these lines on
70 of the 72 values at length 9, 42 of the 61 at length 20 and 30 of the 31 at
length 50.

Nothing is fixed about the order the two products are written in, or about the
order of the two factors inside either of them: binary64 multiplication and
addition are both commutative, so every such rearrangement gives the same values
on that fixture, and a sentence fixing one of them would send an implementer to
check the half that cannot differ. Nor is anything fixed about whether `rest` is
computed once or written out as `1 - weight` at the step, because `weight` is
one value and `1 - weight` is therefore one value whenever it is formed. This
is 20.1's second rule read the other way round: an arrangement is named here
when a second one is in common use **and** differs, and this entry names the one
that does.

**`rma(src, len)`** is the seeded recurrence of 20.2.2 with

```text
step = (running * (len - 1) + value) / len
```

**This is not the shape of `ema` with a weight of `1 / len`.** The two are the
same function in exact arithmetic and two different numbers in binary64, and the
difference propagates into the strength reading, the average true range, the
trailing band and the directional index, which are the readings a chart is most
often asked to reproduce. A recipe of `value * (1 / len) + running * (1 - 1 / len)`
is a conforming implementation of a different function. Neither is
`running + (value - running) / len`, which is a third arrangement of the same
algebra and a third set of last bits.

**`wma(src, len)`** accumulates oldest first, so weight 1 is added first and
weight `len` last, and divides once at the end:

```text
divisor = (len * (len + 1)) / 2
total   = 0
total   = total + w[len - 1] * 1
total   = total + w[len - 2] * 2
...
total   = total + w[0] * len
result  = total / divisor
```

The weight on `w[k]` is `len - k`, formed as a multiplication of the value by the
whole number weight, not by a precomputed fraction. Dividing each term by
`divisor` as it is added is a different number.

**Nothing is fixed about how the divisor itself is formed**, and the line above
is one spelling of it rather than a constraint. `(len * (len + 1)) / 2`,
`len * ((len + 1) / 2)` and `(len / 2) * (len + 1)` are the same product scaled
by a power of two, which is exact, so they are one value: over every whole
length from 1 to 100000 they differ on 0. Adding the weights 1 to `len` up
instead reaches the same value again, because every partial sum is a whole
number below 2 to the 53rd and whole number addition below that is exact: over
the first 2000 lengths it differs on 0 as well. What is fixed is what the
divisor is applied to, and that is the sentence above this one.

**`swma(src)`** takes its four weights in the same oldest first order and divides
once at the end:

```text
result = (w[3] + 2 * w[2] + 2 * w[1] + w[0]) / 6
```

**The four terms are added left to right and the finished sum is divided once.**
Over twenty thousand four bar windows of ordinary prices, regrouping them as
`(w[3] + 2 * w[2]) + (2 * w[1] + w[0])` differs on 5281, adding them right to
left differs on 7230, and dividing each term by 6 as it is added rather than
dividing the sum differs on 9564.

**Nothing is fixed about how the two middle terms are doubled.** `2 * w[2]`,
`w[2] * 2` and `w[2] + w[2]` are one exact scaling however it is written, and
over 25176 values covering every binade of the double range in both signs, the
subnormals included, the three never differ: 20.1's third rule. The sentence
that stood here fixed that spelling in the same breath as the addition order, so
one sentence carried a half that can be failed and a half that cannot, with
nothing to tell a reader which was which.

**`vwma(src, len)`** forms this bar's product first and sums the products:

```text
product     = src * volume, formed on the bar and pushed into its own window
numerator   = the window sum of the products
denominator = the window sum of the volumes
result      = numerator / denominator
```

Both sums are the fresh oldest first sum of 20.2.1. The result is absent where
the denominator is zero. Dividing each sum by `len` first and then dividing one
by the other is the same quantity with two extra roundings in it, and it is not
this arrangement.

**`hma(src, len)`** is three linearly weighted means, each the arrangement above:

```text
half   = floor(len / 2), held at a minimum of 1
outer  = round(sqrt(len)), the rounding of section 8.1, held at a minimum of 1
raw    = 2 * wma(src, half) - wma(src, len)
result = wma(raw, outer)
```

`raw` is formed left to right and is fed to the outer mean absences and all, so
the outer mean fills on the first `outer` values `raw` produced. The inner length
is a gap in section 4 rather than a reading of it: see 20.11.

**`dema(src, len)`** and **`tema(src, len)`** are formed left to right from
exponential means each fed the previous one's output, absences and all:

```text
dema = 2 * e1 - e2
tema = 3 * e1 - 3 * e2 + e3
```

where `e1` is `ema(src, len)`, `e2` is `ema(e1, len)` and `e3` is `ema(e2, len)`.
`tema` is three terms added left to right, and is not `3 * (e1 - e2) + e3`.

**`alma(src, len, offset, sigma)`** builds its kernel from the position in the
window, with position 0 the oldest, and runs two passes over that same order:

`sigma` must be strictly positive; zero, negative or absent sigma produces
absence while the source still contributes to the call's chronological history.
The exponent denominator is evaluated as `(2*spread)*spread`. If this denominator
underflows to zero, the reading is absent rather than a division exception.
The exponent is a private Gaussian intermediate: negative infinity means a zero
weight, while an undefined exponent makes the reading absent. A positive
infinite denominator may give a finite zero exponent and weight one. These
limiting weights preserve narrow and broad kernels without allowing infinity
as a language value or changing the public `exp` domain.

```text
peak   = offset * (len - 1)
spread = len / sigma
norm   = 0
total  = 0
for position = 0 to len - 1:
    gap              = position - peak
    weight[position] = exp(-(gap * gap) / (2 * spread * spread))
    norm             = norm + weight[position]
for position = 0 to len - 1:
    total = total + w[len - 1 - position] * weight[position]
result = total / norm
```

The denominator of the exponent is **one product, divided once**. A chain of
divisions, `-(gap * gap) / 2 / spread / spread`, is the arrangement in
circulation and is not this one: over the kernels built at eight lengths, seven
sigmas and six offsets it differs on 4529 of the 17598 exponents, about one in
four. The grouping `(2*spread)*spread` is normative. Although one factor is 2
and over those same 17598 exponents the two groupings never differ, the finite
fixture does not cover every binary64 input: see 20.1, whose edge case needs a
`spread` below about 1.5 times 10 to the minus
154th, so that its square is subnormal, which at a length of 1 is a `sigma` above
about 6.7 times 10 to the 153rd. The
kernel depends only on the position, so an engine may build it once, provided
the values it builds are the ones these lines produce. This is the one average
whose value depends on `exp`, using the portable recipe in 20.10.2.

**`linreg(src, len, offset)`** fits over `x` running 0 at the oldest bar of the
window to `len - 1` at this one. The sums over `x` are constants of `len`:

```text
sumX        = ((len - 1) * len) / 2
sumXSquared = ((len - 1) * len * (2 * len - 1)) / 6
divisor     = len * sumXSquared - sumX * sumX
sumY        = 0
sumXY       = 0
for position = 0 to len - 1:
    y     = w[len - 1 - position]
    sumY  = sumY + y
    sumXY = sumXY + y * position
slope     = (len * sumXY - sumX * sumY) / divisor
intercept = (sumY - slope * sumX) / len
result    = intercept + slope * (len - 1 - offset)
```

**The sum of squares is one product divided once, and it is not
`(((len - 1) * len) / 2) * ((2 * len - 1) / 3)`.** Splitting the 6 into the two
factors it is made of, so that each half of the product meets its own divisor
before the two are multiplied, holds every intermediate below the whole product
and is a different number: over every whole length from 1 to 100000 the two part
company on 3716, the first at a length of 15, where the split gives
1014.9999999999999 against 1015.

**Nothing is fixed about how either product is grouped.** `(len - 1) * len`,
`len * (2 * len - 1)` and `(len - 1) * (2 * len - 1)` are whole numbers below 2
to the 53rd at every length a window can have, so whichever pair is multiplied
first is exact and the second multiplication rounds the same true product once:
over those same 100000 lengths the regrouped sum of squares differs on 0, and so
does `sumX` with its halving moved to either factor, which is 20.1's third rule.
That zero has an edge of its own and it is not 20.1's: it is the length at which
a pairwise product stops being exact, which for the sum of squares is first at a
length of 67108869, further out than any chart has bars. A zero count can be
reached this way as well as through one of 20.1's four, which is why the rule
there is stated as a count rather than as a list.

Each accumulation adds its own terms oldest first. Neither reads the other, so
whether an engine runs them in one pass or in two is not fixed: 20.1's fourth
rule. The result is absent where `divisor` is zero, which is every window of
length 1: a line fitted to one point is not a fit.

**`ma(src, len, type)`** is exactly the named average's arithmetic, with a state
region of its own per type, so a run that switched type mid-history starts the
new average from its own seed rather than from what the old one left behind.

**`supertrend(factor, atrLen)`** takes its width from the average true range and
its midpoint from the bar:

```text
midpoint = (high + low) / 2
rawUpper = midpoint + factor * width
rawLower = midpoint - factor * width
upper = rawUpper when rawUpper < previousUpper or previousClose > previousUpper,
        otherwise previousUpper
lower = rawLower when rawLower > previousLower or previousClose < previousLower,
        otherwise previousLower
```

If the midpoint, average true range, close or factor is absent, both outputs are
absent and the trailing-band state, including its last accepted close, is
unchanged. The range average keeps its own state. The next accepted band step
uses that stored close as `previousClose`; a skipped observation does not replace
it. The named midpoint is normalized under section 2.4 before the band step, so
overflow of `high + low` cannot seed or change a direction.

On the first bar both bands are the raw bands, **and the line starts on the upper
band**. The line then follows one band until price closes through it: while it is
following the upper band it stays there when the close is at or below `upper` and
moves to `lower` otherwise, and while it is following the lower band it stays
there when the close is at or above `lower` and moves to `upper` otherwise. The
comparison is inclusive on the side the band is held, which decides the flip bar
on an exact touch. The first bar runs that same test from the upper band, so it
holds the upper band unless its close is above the raw upper band, and the band
it leaves the state on is the one the bar after it inherits.

**Starting on the lower band is a different study, not a different last bit.**
The seed decides which side of the first test the line is on, and the two
readings then flip on different bars and stay apart until a later flip happens to
put them back together. Measured over four hundred bars at three parameter sets,
a line seeded on the lower band differed from this one on between fifteen and
forty of the bars it reported, by as much as sixteen price units, with the
direction inverted on exactly those bars. An engine that guesses here draws a
visibly different chart.

The bar the width is first available on seeds the state and reports absence: the
carry forward and the flip test both read the previous bar's close and the
previous bar's bands, and on that bar there is neither, so the bands there are
the raw bands arrived at by no test rather than bands that have trailed anything.
Section 4 puts the first value one bar later for that reason.

**It is not withheld on the grounds that the direction there would be chosen by a
seeding rule rather than by the data.** That reason does not survive reading. The
seed bar leaves the state on a band, the next bar inherits it, and on a bar with
no flip the direction the next bar reports is the seeding rule's choice exactly
as the seed bar's would have been. Withholding the seed bar delays the rule by
one bar and does not keep it off the chart. What the seed bar lacks is a trailing
band, not an honest direction.

**`psar(start, step, max)`** seeds from the first pair of complete bars: the
direction is up when this bar's close is above the previous bar's, the stop
starts at the previous bar's low when it is up and at its high when it is not,
and the acceleration starts at `start`. That bar reports the seed itself. On
every later bar the stop moves first:

```text
stop = stop + acceleration * (extreme - stop)
```

then the flip test, then the extreme test:

- Long, and `stop` is above this bar's low: the direction becomes short, `stop`
  becomes the extreme reached, the extreme becomes this bar's low, and the
  acceleration returns to `start`. Short, and `stop` is below this bar's high:
  the mirror of it.
- Long, and this bar's high is above the extreme: the extreme becomes this bar's
  high and the acceleration becomes `min(acceleration + step, max)`. Short, and
  this bar's low is below the extreme: the mirror of it.

The multiply and add on the first line is one rounding of the product and one of
the sum, in that order, and is not
`(1 - acceleration) * stop + acceleration * extreme`.

**The two tests run in the order written, and the second is reached on a flip bar
as well**, where it cannot fire: the extreme has just been set to this bar's own
low or high and both comparisons are strict. So an engine that writes them as one
chain and an engine that writes them as two agree on every bar, and an
acceleration a flip has just returned to `start` is not raised again on the bar
that reset it.

**The stop is reported as the recurrence produced it, and there is no clamp.**
Some published versions hold it out of the previous two bars' range, pulling it
down to the lower of the two previous lows while the direction is long and up to
the higher of the two previous highs while it is short. That is not applied here,
and it is not a difference in the last bit. It moves the line on most bars of a
fast trend, and because the next bar's flip test reads the stop this bar left
behind, a stop pulled back inside the previous two bars can no longer be breached
and the clamp swallows flips this recurrence fires. The two are different
functions rather than two arrangements of one, and a study that wants the clamped
stop writes the clamp itself.

**`adx(diLen, adxLen)`** measures directional movement against the gap aware true
range of 20.5, so all three smoothed quantities cover the same bars:

```text
up       = high - previousHigh
down     = previousLow - low
upMove   = up   when up > down and up > 0,   otherwise 0
downMove = down when down > up and down > 0, otherwise 0
```

Both movements are absent when current or previous high/low inputs are missing.
Compare the raw differences before normalizing the selected branch. Equal
positive differences, including two overflowing differences, select zero on
both sides. Normalize a selected non-finite movement to absence before `rma`
consumes it; this is a missing input under 20.2, not an arithmetic overflow
inside the recurrence.

Each of `upMove`, `downMove` and the gap aware true range is smoothed with `rma`
at `diLen`, and then

```text
plusDI  = (smoothedUp / smoothedRange) * 100
minusDI = (smoothedDown / smoothedRange) * 100
spread  = (abs(plusDI - minusDI) / (plusDI + minusDI)) * 100
result  = rma(spread, adxLen)
```

**The division comes before the multiplication by 100 on all three lines.** The
other association, `100 * a / b`, is the one the readings of 20.4 use and it is a
different number here. `spread` is 0 rather than absent where the two sum to
zero, and the two directional readings are absent where the smoothed range is
zero.

**`aroon(len)`** measures over a window of `len + 1` bars, so an extreme set
`len` bars ago is still inside it and a reading of 0 is reachable:

```text
up   = (100 * (len - barsSinceHigh)) / len
down = (100 * (len - barsSinceLow)) / len
```

where the two ages are counted over that wider window, under the tie rule of
20.10.

**`ichimoku(convLen, baseLen, spanLen)`** builds each of its first four lines
from the outright extremes of a window:

```text
midpoint = (windowHigh + windowLow) / 2
```

The third element is the mean of the two midpoints already computed at the
shorter two lengths, `(first + second) / 2`, and not a midpoint recomputed over a
window of its own. The fifth is this bar's close, reported undisplaced.

### 20.4 Momentum and oscillators

**`rsi(src, len)`** splits the one bar change and smooths each side with `rma`:

```text
delta       = src - src[1]
up          = max(delta, 0)
down        = max(-delta, 0)
averageUp   = rma(up, len)
averageDown = rma(down, len)
result      = 100 - 100 / (1 + averageUp / averageDown)
```

`down` is formed by negating the change and taking the larger of that and zero,
so a rising bar contributes an exact zero to the down side.

**The result is 100 when `averageDown` is zero**, which also covers a window that
never moved and in which both averages are zero. The ratio has no value there,
and every reference reading is 100.

**The arrangement of the last line is normative.** The order is: the ratio, then
one added to it, then 100 divided by that, then subtracted from 100. One other
arrangement is in circulation and is not this one: `100 * up / (up + down)` is
mathematically equal and lands one unit in the last place away on ordinary data.
Over the eighty bar fixture the release gate compares bit for bit it differs from
these lines on 31 of the 73 values at length 7, 31 of the 66 at length 14 and 29
of the 59 at length 21.

**Naming the ratio first is not a second arrangement.** Writing
`ratio = averageUp / averageDown` and then `100 - (100 / (1 + ratio))` is these
same four operations in this same order, and it is bit identical to the line
above on every value at all three of those lengths. It is written out here because the
opposite was written here, and an implementer who believed it would have had two
ways to be wrong: change correct code to avoid a difference that does not exist,
or put a conformance vector on a distinction no conforming engine can make.
20.1 says why no naming can change a value.

**`stoch(len, smoothK, smoothD)`** places the close in the window's outright
range, which is the bars' own highs and lows and not the close's extremes:

```text
raw = (100 * (close - windowLow)) / (windowHigh - windowLow)
k   = sma(raw, smoothK)
d   = sma(k, smoothD)
```

The span is formed once and the result is absent where it is zero. **Here the
multiplication by 100 comes first**, which is the opposite of the directional
index of 20.3 and is deliberate: each is the association its own reading has
always carried, and matching one to the other would move every value of one of
them.

**`stochRsi(src, rsiLen, stochLen, smoothK, smoothD)`** is the same three lines
with the strength reading in place of the close, and with the window high and the
window low taken from the strength reading itself rather than from the bars.

**`williamsR(len)`** is the same position on the other scale, and is formed from
the distance below the window high rather than as the stochastic reading less one
hundred:

```text
result = (-100 * (windowHigh - close)) / (windowHigh - windowLow)
```

**`macd(src, fast, slow, signal)`** and **`ppo(src, fast, slow, signal)`** differ
only in the first line:

```text
macd line = emaFast - emaSlow
ppo line  = (100 * (emaFast - emaSlow)) / emaSlow
trigger   = ema(line, signal)
histogram = line - trigger
```

The signal average is fed the line absences and all, so it seeds on the first
`signal` values the line produced, which is where its warmup comes from. The
histogram is the difference of the two values as reported, not recomputed from
the averages.

**`cci(len)`** divides by the mean absolute deviation, not by the standard
deviation, and the constant is applied to the deviation rather than to the
numerator:

```text
deviation = the mean over the window, oldest first, of abs(w[k] - windowMean)
result    = (typical - windowMean) / (0.015 * deviation)
```

The 0.015 is calibrated against the mean absolute deviation, and substituting a
standard deviation changes every reading while still producing a plausible line.
Writing the numerator as `(typical - windowMean) / 0.015 / deviation` is two
divisions where this is one multiplication and one division.

**`roc(src, len)`**, **`trix(src, len)`** and **`tsi(src, longLen, shortLen)`**
scale by 100 before dividing:

```text
roc  = (100 * (src - src[len])) / src[len]
trix = (100 * (smoothed - smoothed[1])) / smoothed[1]
tsi  = (100 * doubleSmoothedChange) / doubleSmoothedSize
```

`trix` smooths with three exponential means, each fed the previous one's output,
and takes the one bar percentage change of the third. The other reading in
circulation takes the change of the logarithm of the average instead; it is a
different number and it is not what section 5 describes. `tsi` smooths the one
bar change twice, with the long length first and the short length second, and
smooths the absolute size of that change the same way in its own pair of state
regions.

**`cmo(src, len)`** sums the two sides over the window outright, with no
smoothing between:

```text
rise   = the window sum of max(delta, 0)
fall   = the window sum of max(-delta, 0)
result = (100 * (rise - fall)) / (rise + fall)
```

The denominator is formed once, and the result is absent where it is zero.

**`dpo(src, len)`** removes the simple mean as it stood `floor(len / 2) + 1` bars
ago, which is what the declared warmup requires:

```text
result = src - sma(src, len)[floor(len / 2) + 1]
```

**`ultimateOsc(len1, len2, len3)`** forms both per-bar terms against the previous
close, sums each over three windows, and blends the three ratios:

```text
floorOf   = min(low, previousClose)
ceilingOf = max(high, previousClose)
pressure  = close - floorOf
range     = ceilingOf - floorOf
average   = the window sum of pressure / the window sum of range, at each length
result    = (100 * (4 * fast + 2 * middle + slow)) / 7
```

The three weighted terms are added left to right, shortest window first, and the
division by 7 is applied once at the end.

**`mom(src, len)`** and **`awesomeOsc(fast, slow)`** are a single subtraction
each, and are named here only so that the absence of a recipe is not read as an
oversight: `mom` is `src - src[len]`, and `awesomeOsc` is the fast simple mean of
the bar midpoint less the slow one, in that order.

### 20.5 Volatility and ranges

**`trueRange()`** is the largest of three:

```text
result = max(high - low, abs(high - previousClose), abs(low - previousClose))
```

On the oldest bar of the dataset it is `high - low`, which is section 6's stated
exception to absence propagation.

**The gap aware form is a separate quantity.** It is the same three terms with no
exception on the oldest bar, and it is what `chop` and the directional index use.
Section 6 says which of the two a function takes by declaring its warmup one bar
later than the plain reading would give. It is not a call a script can make.

**`atr(len)`** is `rma` over `trueRange`, that first bar included. **`natr(len)`**
is `(100 * atr) / close`.

**`variance(src, len, sample)`** is two passes, the mean first and the deviations
from it second, both oldest first:

```text
mean    = the window mean of 20.2.1
squares = 0
squares = squares + (w[len - 1] - mean) * (w[len - 1] - mean)
...
squares = squares + (w[0] - mean) * (w[0] - mean)
result  = squares / len          when sample is false
result  = squares / (len - 1)    when sample is true
```

Each deviation is squared as a product of the deviation with itself. **The one
pass arrangement is not permitted**: subtracting the square of the mean from the
mean of the squares is mathematically equal, loses most of its significant digits
on a price series where the values are large and their spread is small, and can
return a negative variance that then has to be floored at zero. An implementation
that needs a floor to stay real is computing a different quantity.

**`stdev(src, len, sample)`** is the square root of that variance, taken once at
the end.

**`bollinger(src, len, mult)`**, **`keltner(len, mult, atrLen, maType)`** and the
two readings taken from the first are formed as written:

```text
upper     = basis + mult * width
lower     = basis - mult * width
bbWidth   = (upper - lower) / basis
bbPercent = (src - lower) / (upper - lower)
```

where `width` is the population standard deviation for the first and the average
true range for the second. The multiplier is applied to the width and the product
added to the basis, which is one rounding of the product and one of the sum.
`bbWidth` and `bbPercent` are computed from the bands as reported rather than
from the basis and the width again, so a study that plots all three and a study
that plots one reading agree to the last bit. Nothing is fixed about whether the
span the two readings share is written into a name or written out twice: 20.1
says why that cannot change either of them.

**The basis of `keltner` is the close**, averaged at `len` by the type `maType`
names, and not the typical price. Section 6 writes the call without a source
argument, and the close is the source it means. The two agree only on a bar whose
close is its own typical price, so this decides which function the call is rather
than the order its arithmetic runs in, and it is written here because the entry
alone does not settle it. Where `maType` names the volume weighted average, each
close is weighted by its own bar's volume. The width is `atr(atrLen)` exactly as
this section defines it, the oldest bar's exception included, and not the gap
aware form the directional index takes.

**`donchian(len)`** takes the outright extremes of the window, and its middle
element is `(upper + lower) / 2`.

**`chop(len)`** compares the distance travelled with the range covered:

```text
distance = the window sum of the gap aware true range
span     = windowHigh - windowLow
result   = (100 * log10(distance / span)) / log10(len)
```

The ratio is formed first, then its logarithm, then the multiplication by 100,
then the division by the logarithm of the length. The result is absent where the
span or the distance is not above zero, and where `len` is 1 and the scale is
zero. This reading uses the portable `log10` recipe in 20.10.2.

**`hv(src, len, periodsPerYear)`** is the population standard deviation of the
one bar log return, annualised by one multiplication:

Both source endpoints and `periodsPerYear` must be strictly positive. A missing
or nonpositive source endpoint contributes an absent log return in its original
position; two negative endpoints do not create a valid return merely because
their ratio is positive. A nonpositive annualization count produces absence.

```text
logReturn = log(src / src[1])
result    = stdev(logReturn, len, false) * sqrt(periodsPerYear)
```

The ratio is formed before the logarithm is taken. The result is a proportion and
is not scaled by a hundred: section 6 says annualised standard deviation of log
returns and says nothing about a percentage, so a study that wants a percentage
axis multiplies at the plot, where a reader can see it happen. This reading
uses the portable `log` recipe in 20.10.2.

### 20.6 Volume

The running totals of this section are anchored accumulations rather than
windows, so each carries its total forward and adds one term per bar. That is
what the quantity is, not a cheaper way to compute a window sum, and the refusal
of a carried total in 20.2.1 does not reach them.

**Every total here starts at zero**, before any bar has contributed to it, and an
absent bar produces an absent bar out and leaves the total where it was. It is
neither reset nor fed a zero in place of the missing term, so a gap costs the
reading the bars it covers and nothing after them.

**A term that overflows is an absent term, and an absent term leaves the total
unchanged.** Each operation that forms a bar's term is checked where it rounds,
as `compiled-program.md` section 3.1 requires, and a result there that is not
finite makes the whole term absent: the change or the proportion of `pvt`, the
product `src * volume` of `vwap`, the span of `ad` and `cmf`, as much as the
product each term ends with. Such a bar is an absent bar in the sense of the
paragraph above. Its reading is absent and every total its term would have fed
stays exactly where it was, including a total that would have taken only the
bar's volume, so the overflow costs that one bar and nothing after it. It is a
missing input under 20.2.2, not an overflow inside the total.

**A total that overflows is kept.** A finite term can still carry a total past
the largest finite number. The total then holds what the arithmetic produced,
its reading is absent, and so is any reading divided by it, rather than the zero
a finite number over an infinite one would give. Later terms do not bring it
back. Only what starts the total again does: the anchor of `vwapAnchor`, a new
session for `vwap`, or a restored checkpoint. This is the rule 20.2.2 gives a
seeded recurrence whose running value overflows, applied to a running total.

**`vwap(src)`** and **`vwapAnchor(src, resetWhen)`** are one calculation. Both
totals are reset to zero on an anchor bar, before that bar's own term is added,
so the anchor bar is the first bar of the new average rather than the last bar of
the old one:

```text
flow   = flow + src * volume
traded = traded + volume
result = flow / traded
```

**`obv()`** adds the whole of the bar's volume on a higher close and subtracts
the whole of it on a lower one, and contributes nothing on an unchanged close.
The first bar has no close before it to compare against, so it contributes
nothing either and the reading there is the 0 the total started at.

**`ad()`** and **`cmf(len)`** share one per-bar term:

```text
span = high - low
term = (((close - low) - (high - close)) / span) * volume
```

The two bracketed differences are formed first and subtracted, then divided by
the span, then multiplied by the volume. A bar whose span is not above zero
contributes an exact 0 rather than ending the total. A span that overflows is not
such a bar: it is absent, and the term with it, because dividing by the raw
infinity would give an exact 0 for a bar whose position was never computed. `ad`
is the running total of that term. `cmf` is the window sum of the term divided by the window sum of the
volume, each the fresh sum of 20.2.1. Like any ratio it is absent where that volume sum is zero, and
only there: a window whose volume sums below zero divides like any other.

**`adOsc(fast, slow)`** is the fast exponential mean of the running total less
the slow one, in that order. The averages run over the running total, not over
the per-bar term.

**`pvt()`** adds a proportion of the volume:

```text
total = total + ((close - previousClose) / previousClose) * volume
```

The proportion is formed and rounded before it meets the volume. The first bar
has no change behind it and is absent, and the second already carries its own
term on top of the zero the total started at.

Closes of 1, 1e308, -1e308, 2 and 3 on a volume of 1 read `none`, 1e308, `none`,
1e308 and 1e308. The third bar's change overflows, so its term is absent and the
total stays at 1e308; the fourth adds `((2 + 1e308) / -1e308) * 1`, which is -1,
and the total rounds back to 1e308, as it does after the fifth adds 0.5.

**`mfi(len)`** is the strength reading of 20.4 computed on money flow, with
window sums in place of the smoothing:

```text
flow   = typical * volume
rise   = the window sum of flow on bars where the typical price rose, else 0
fall   = the window sum of flow on bars where it fell, else 0
result = 100 - 100 / (1 + rise / fall)
```

The arrangement of the last line is the one 20.4 fixes, and the result is 100
where `fall` is zero, for the reason given there. A bar whose typical price is
unchanged contributes an exact zero to both sides.

**`eom(len)`** forms its per-bar term and then takes a simple mean of it:

```text
term   = (midpointChange * (high - low)) / volume
result = sma(term, len)
```

The product is formed before the division. **There is no scaling constant**: see
20.11.

**`forceIndex(len)`** is the exponential mean of the one bar close change times
the volume, the product formed per bar and fed to the average.
**`relativeVolume(len)`** is the bar's volume divided by the simple mean of the
volume.

### 20.7 Maths and rounding

**`round(x)`** compares the fractional part rather than adding a half:

```text
below    = floor(x)
fraction = x - below
result   = below + 1   when fraction > 0.5
result   = below       when fraction < 0.5
result   = below + 1   when fraction is exactly 0.5 and x is above zero
result   = below       when fraction is exactly 0.5 and x is not
```

**`floor(x + 0.5)` is not this function.** It is the usual shortcut and it is
wrong for the value just below a half, where adding 0.5 rounds up to the next
representable number before the floor ever runs and the answer comes out one too
high. The last two lines are what halves away from zero means at a negative
value, where `floor` has already produced the downward answer.

**`round(x, decimals)`**, **`roundToStep(x, step)`** and **`roundToTick(price)`**
scale, round and scale back, with one rounding in the middle:

```text
scale              = the binary64 nearest to 10 ^ decimals
round(x, decimals) = round(x * scale) / scale
roundToStep(x, s)  = round(x / s) * s
roundToTick(p)     = roundToStep(p, the instrument's tick size)
```

**The scale is the binary64 nearest to the power of ten**, the value the
literal `1e23` reads as, and not what a floating point power returns for it.
The two are not one function: over the 309 counts from 0 to 308 a host's
`pow(10, d)` returns a value an ulp from the nearest binary64 for at least one
of them, and over the 5000 bars of a price walk and those counts `round(x, d)`
then differs on part of the 1545000 pairs it makes.

**How many, and at which counts, belongs to the host and not to this
language.** It is a property of one `pow` implementation, and the same engine
has measured a different set of them on two runtimes of the same virtual
machine: a figure printed here would be a reading from whichever machine
happened to take it, quoted afterwards as though it described the language.
That difference is the reason for the rule rather than something to build on.
A second engine builds the scale from its own decimal reader or from an exact
integer power converted once, and never from a floating point power; the
display conversion `text(x, decimals)` of section 10 scales by the same value.

**`math.toDegrees(x)`** is `(x * 180) / pi` and **`math.toRadians(x)`** is
`(x * pi) / 180`: multiply first, divide second. The other association, folding
the constant into one factor, is a different number at about a quarter of the
arguments: measured over forty thousand values spread across nine decades, 26 in
every hundred for the first and 29 for the second.

**`mod(a, b)`** is written out in section 8.1 and the formula there is the
arithmetic: the division, then the floor, then the multiplication, then the
subtraction.

### 20.8 Series helpers

**`sum(src, len)`** is the window sum of 20.2.1, and **`count(cond, len)`** is
that sum over a window of ones and zeros, so a count is an addition of whole
numbers and is exact.

**`cum(src)`** is a running total from the first bar, on the terms 20.6 states
for one: the same zero it starts at, and the same treatment of an absent bar.

**`sumSkip(src, len)`** is the same oldest first sum with the absent bars passed
over, and **`avgSkip(src, len)`** is that sum divided by the number of bars that
had a value, counted over the same window. Dividing by `len` would be a different
quantity. A window with nothing present in it is the empty accumulation: the sum
is the 0 it started at and is reported as 0, and the mean is absent there because
its divisor is zero.

**`percentile(src, len, p)`** and **`median(src, len)`** interpolate linearly
between the two ranks either side:

```text
sorted = the window's values in ascending order
rank   = (p / 100) * (len - 1)
below  = floor(rank)
result = sorted[below]                                    when below is the last rank
result = sorted[below] + (rank - below) * (sorted[below + 1] - sorted[below])
```

`median` is this at `p` of 50 and nothing else, so an even length window is the
mean of its two middles rather than one of them chosen by a rule nobody
remembers. The nearest rank method, which returns an actual member of the window,
is the other common choice and is not this one.

**`percentRank(src, len)`** counts this bar's own value among the window, so the
reading runs from `100 / len` to 100 rather than from 0:

```text
counted = how many of the window's values are at or below w[0]
result  = (counted * 100) / len
```

**`covariance(a, b, len)`** and **`correlation(a, b, len)`** are the population
forms, taken in two passes over both windows, oldest first, with the two means
formed first:

```text
meanA    = sumA / len
meanB    = sumB / len
cross    = 0
squaresA = 0
squaresB = 0
cross    = cross    + (a[k] - meanA) * (b[k] - meanB)
squaresA = squaresA + (a[k] - meanA) * (a[k] - meanA)
squaresB = squaresB + (b[k] - meanB) * (b[k] - meanB)

covariance  = cross / len
correlation = covariance / (sqrt(squaresA / len) * sqrt(squaresB / len))
```

`sumA` and `sumB` are the window sums of 20.2.1 over each series, which is the
first of the two passes. The three accumulations of the second pass each add
their own terms oldest first, and none of them reads another, so neither the
order they are written in nor whether an engine runs them in one pass or in
three is fixed: 20.1's fourth rule. What the two passes do fix is that both
means are finished before any deviation is taken, which is the difference
between this and the single pass form refused below.

**The correlation divides by a product of two square
roots, and not by the square root of a product**: those are mathematically equal
and differ in the last bit, and
this is the one stated. The single pass arrangement, summing squares and cross
products and subtracting at the end, is refused for the reason 20.5 gives for the
variance.

### 20.9 Colour

**`mix(a, b, weight)`** interpolates from the first colour toward the second,
channel by channel, the alpha included:

```text
channel = from + (to - from) * weight
```

**This is not `from * (1 - weight) + to * weight`.** The two are mathematically
equal and differ in the last bit, and this is the one stated. Neither is the
safer of the two at an endpoint: the arrangement above returns the first colour
exactly at a weight of 0 and need not return the second exactly at a weight of 1,
and the other one is exact at both ends and inexact between them. Choosing on
that ground would be choosing on the case a blend is never asked for. The three
colour channels are then rounded to whole numbers and clamped as section 11.2
requires, and the alpha is clamped without being rounded.

**`fade(color, percent)`** is the identity section 11.2 states, and that identity
is the arithmetic as well as the meaning: in its `(100 - percent) / 100` the
subtraction happens before the division. Forming the alpha as
`1 - percent / 100` instead is mathematically equal and is a different number at
40 of the 101 whole percentages, 33 among them, so it is not this one. That is
not a rarity a contrived argument has to reach for: it is two in five of the
values a reader writes. Scaling the alpha the
colour already carried, rather than setting it, is a third answer again, and it
is the one that breaks the nesting identity 11.2 states.

The rounding of a computed channel, and the one way conversion of an alpha to a
byte at the contract boundary, are section 11.2's and are not restated here. Both
use the `round` of 20.7.

### 20.10 Where the order does not matter

A function named here has one arrangement and no choice to record. An implementer
can write it the obvious way and be bit-identical.

- **The comparisons.** `highest`, `lowest` and the two that report an age, the
  outright extremes inside the channel and trend studies, `min`, `max` and
  `clamp` select a value and compute nothing. The only thing a scan can differ on
  is a tie, and the tie rules are section 9's: an extreme goes to the most recent
  bar that set it, so an equal value later in the window replaces the earlier
  one, and a pivot is strict on both sides so a run of equal values holds no
  pivot.
- **The single operations.** `abs`, `sign`, `floor`, `ceil` and `trunc` are one
  operation each, as are `change`, `history` and the bare comparisons. `sqrt` is
  correctly rounded by IEEE-754, so it is bit-identical on every conforming
  platform without a portable implementation of its own.
- **The bookkeeping.** `barsSince`, `valueWhen`, `countPresent`, the crossing
  tests and the run tests compare and count rather than accumulate. The crossing
  tests keep the two series apart rather than subtracting, which matters because
  the test turns on whether one was at or below the other and a rounded zero
  would change the answer.
- **The derived prices.** The four of section 3.1 have their order of operations
  fixed in `compiled-program.md` section 2.10, which is where an engine reads
  them, so it is not restated here.
- **The calendar, the session and the strings.** Sections 10 and 12 are exact
  integer and text operations with no accumulation in them.

#### 20.10.1 Hypotenuse

For finite binary64 inputs `x` and `y`, `math.hypot(x, y)` returns the nearest
binary64 value to the exact nonnegative square root of `x*x + y*y`. An exact
halfway value uses the even significand. The squared sum is exact, with no
intermediate overflow or underflow. Absent inputs and rounded overflow produce
absence. Every zero result is positive zero.

The reference arithmetic uses bounded integers:

1. Decode each absolute input as integer significand `m` times `2^e`. Normal
   inputs include the implicit leading bit; subnormals use exponent -1074.
   When one input is zero, return the other's absolute value.
2. Let `E` be the smaller exponent. Form the exact integer
   `S = mx^2 * 2^(2*(ex-E)) + my^2 * 2^(2*(ey-E))`.
3. Let `b = bitLength(S)-1` and `q = max(-1074, E + floor(b/2) - 52)`.
4. Express `S * 2^(2*(E-q))` as the exact rational `N/D`, with a power-of-two
   denominator when needed. Let `m = integerSqrt(floor(N/D))`.
5. Compare `4*N` with `D*(2*m+1)^2`. Increment `m` when the first is larger,
   or when they are equal and `m` is odd.
6. Normalize a significand carry and encode the resulting binary64 bits.
   An overflowing exponent produces absence. Do not round a large integer to
   binary64 before scaling; that would add an unwanted rounding step.

Integer square root is exact. A monotone integer Newton iteration from a
power-of-two upper bound is one implementation. Input width bounds the temporary
integers to fewer than 4,200 bits. Squaring preserves order on nonnegative values,
so step 5 compares against the exact midpoint between neighboring results.

#### 20.10.2 Exponential and logarithms

`exp`, `log`, `log10` and `math.log2` round the real mathematical result once to
nearest-even binary64. Missing or non-finite inputs are absent. Logarithms are
absent for nonpositive inputs. An overflowing rounded result is absent; a
rounded zero is positive zero. The kernels use integer intervals rather than a
platform elementary function or division of already rounded logarithms.

Handle exact cases first: `exp(0)=1`, every logarithm of one is zero, `log2` of
an exact binary power is its integer exponent, and `log10` of an exactly
representable integral power of ten is its integer exponent. Testing powers of
ten uses the exact decoded integer, not a rounded decimal spelling.

At precision `P`, interval endpoints are integers divided by `2^P`. Start at
`P=160`. Every division rounds outward with mathematical floor and ceiling,
including divisions with negative numerators. Decode binary64 arguments into an
integer significand and power of two without first rounding them to the working
precision. Round both final interval endpoints directly to binary64. Return only
when both endpoints round to the same result; otherwise increase `P` by 80 and
recompute. There is no precision cutoff, approximate fallback or absence caused
solely by a rounding interval that has not yet resolved.

For natural logarithm write `x=2^k*m` exactly, with `1<=m<2`, and use

```text
z     = (m-1)/(m+1)
ln(m) = 2 * sum(z^(2*j+1)/(2*j+1), j >= 0)
ln(x) = ln(m) + k*ln(2)
```

Generate an interval for `ln(2)` by the same series at `z=1/3`. Maintain
outward bounds on `z`, its square, each successive odd power and each divided
term. If the first omitted power has odd exponent `n`, the remaining sum before
multiplication by two is at most `(9/8)*z^n/n`: all later denominators increase
and `z^2<=1/9`. Stop when that power's upper bound is at most two integer units,
and add the outward-rounded remainder bound. Multiplication by negative `k`
reverses the constant interval's endpoints.

For exponential set `a=abs(x)`. Let `[Alo,Ahi]` enclose `a` and `[Clo,Chi]`
enclose `ln(2)` at the current precision. Choose `k=floor(Alo/Chi)`. The reduced
argument `r=a-k*ln(2)` lies in
`[Alo-k*Chi,Ahi-k*Clo] / 2^P`, whose endpoints lie in `[0,1]` at these working
precisions. Evaluate `exp(r)` with the positive Taylor series, starting the term
and sum at one, and forming each next term with outward multiplication by `r`
and division by its index. When the next upper term is at most one integer unit,
stop adding explicit terms and add twice that upper term to the upper sum.
Successive tail ratios are at most one half, so this encloses the full tail.
For nonnegative `x` multiply the interval by `2^k`; for negative `x` take its
outward reciprocal and multiply by `2^-k`.

The safe shortcuts `x>=1024` to absence, `x<=-1024` to zero, and
`abs(x)<2^-60` to one avoid unnecessary work. The first follows from `e>2`;
the second follows from `e>5/2` and `(5/2)^4>2^5`; the third lies strictly
inside the rounding cell around one.

For base two or base ten, divide the unrounded `ln(x)` interval outward by the
interval for `ln(2)` or `ln(10)`, then round once. For a negative numerator,
consider both denominator endpoints so that the lower and upper quotient
bounds retain their mathematical order. Generate `ln(10)` by the natural-log
recipe above. Dividing separately rounded binary64 logarithms is a different
operation and is not this contract.

To round a dyadic endpoint `N*2^E`, work with its absolute integer magnitude.
The spacing exponent is `q=max(-1074, bitLength(N)-1+E-52)`. Divide by
`2^(q-E)` when that exponent is positive, or shift exactly when it is not.
Compare the discarded remainder with half the divisor, breaking a tie toward
an even retained significand. Normalize a carry, then encode the sign,
significand and exponent directly. Zero loses its sign; an overflowing exponent
becomes absence. Converting the large integer to a floating value before
scaling would add an unwanted rounding step.

Interval widths decrease to zero as precision grows. After the exact branches,
the true results cannot equal a rational binary64 rounding midpoint. A nonzero
algebraic argument has a transcendental exponential, and the natural logarithm
of an algebraic positive number other than one is transcendental. A rational
base-two or base-ten logarithm of a rational input must be an integer: prime
factor exponents in `x^q=2^p` or `x^q=10^p` force `q=1` when `p/q` is reduced.
Those exact powers are handled first. Refinement therefore eventually encloses
a single rounding cell. This establishes termination, not a practical
worst-case precision or execution-time bound.

Derived constants and Gaussian weights may be cached without entering an
engine's checkpoint state. They must depend only on exact parameter values;
cold, warm, evicted and restored executions must produce identical readings.
The implementation retains only default-precision constant intervals and at
most eight Gaussian parameter tuples containing at most 4,096 coefficients in
total. Larger kernels compute without being retained. Cache residency does not
change the semantic operation budget charged to a script.

#### 20.10.3 Power

`pow(x, y)` rounds the real power once to nearest-even binary64. Missing or
non-finite arguments are absent before any identity is considered. With finite
arguments, exponent zero returns one, including a zero base. A zero base with a
positive exponent returns positive zero; a negative exponent is absent. A
negative base requires an integer exponent. Its result has negative sign only
when that integer is odd. Every rounded zero is normalized to positive zero,
and rounded overflow is absent.

The positive magnitude uses exact dyadic decomposition and outward integer
intervals. It must not compute a separately rounded logarithm, multiply it by
the exponent and pass that rounded product to `exp`: those intermediate
roundings can change the final power.

1. Apply the identities above and the magnitude-one identity. Write the positive
   base as `a*2^e`, with `a` an odd positive integer, and the absolute exponent
   as `n*2^q`, with `n` odd. For a fractional exponent (`q < 0`), a rational
   root exists exactly when repeated integer square roots of `a` are exact and
   repeated halvings of `e` remain integers, for `-q` steps. Otherwise the
   positive power is irrational. For `q >= 0`, the integer exponent magnitude
   is `n << q` and no root extraction is needed.
2. Handle possible exact rounding midpoints before interval refinement. After
   successful root extraction, a root with odd part one is a power of two;
   multiply its integer binary exponent by the exact signed exponent numerator
   and round that dyadic directly. If the odd part exceeds one, the exponent is
   positive and its numerator is at most 53, form that integer power exactly and
   round its dyadic value directly. A larger positive numerator has more than
   54 odd significant bits, so it cannot equal a binary64 rounding midpoint.
   A negative numerator leaves an odd denominator greater than one, so that
   result also cannot equal a dyadic midpoint.
3. For the remaining cases start with precision 160. Enclose the natural
   logarithm of the positive base using 20.10.2. Multiply both fixed-point
   endpoints by the exact dyadic exponent using integers. Negative factors
   reverse endpoint order; right shifts use floor for the lower bound and
   ceiling for the upper bound. Keep the interval at that precision without
   converting either endpoint to binary64.
4. Enclose the exponential of each exact dyadic endpoint using 20.10.2's
   reduction, positive Taylor bounds and reciprocal for a negative endpoint.
   The reduced positive remainder must stay below one, which is the condition
   for the stated Taylor-tail bound. If an outward upper bound crosses one,
   refine before using that series. Working precision is never below 64 bits;
   the lower start is available for refinement verification, while ordinary
   evaluation starts at 160 bits.
   Use the lower exponential bound from the lower input and the upper bound
   from the upper input. Bounds above 1024 are certainly beyond binary64
   overflow after exponentiation; bounds below -1024 round to zero. These are
   analytical output bounds, not a limit on refinement.
5. Round those two output bounds with the direct dyadic encoder. If their
   rounded values agree, apply the result sign and zero normalization. If they
   differ, increase precision by 80 and repeat from step 3. There is no fixed
   iteration limit that changes a valid result into absence.

The root test follows prime factorization of a positive rational with an
exponent whose reduced denominator is a power of two. It covers every rational
power and hence every possible exact binary64 midpoint. The remaining
non-midpoint results are eventually separated by narrowing outward intervals.
This establishes termination mathematically, not a fixed maximum running time
for every finite input pair.

#### 20.10.4 Trigonometric functions

`math.sin`, `math.cos`, `math.tan`, `math.asin`, `math.acos`, `math.atan` and
`math.atan2` round their real mathematical result once to nearest-even binary64.
Missing or non-finite arguments are absent. Arcsine and arccosine are absent
outside `[-1,1]`. Rounded zero is positive zero; rounded overflow is absent.

Normalize both signs of an input zero before quadrant selection, matching the
language's stored-zero contract. For the public argument order `atan2(y,x)`, a
zero vertical component returns positive zero when `x >= 0`, including the zero
vector, and positive pi when `x < 0`. With a zero horizontal component and a
nonzero vertical component, the answer is pi/2 with the sign of `y`. Here pi and
pi/2 mean independently rounded real constants, not a rounded pi multiplied
before the final rounding.

The portable recipe uses outward integer intervals divided by `2^P`, starting
at `P=160`. All signed divisions use mathematical floor for lower endpoints and
ceiling for upper endpoints. Round both final endpoints using 20.10.2's dyadic
encoder. If they select different results, increase `P` by 80 and repeat. There
is no fixed precision cap or host-function fallback. Internal refinement tests
may request a lower start, clamped to at least 64 bits; normal execution starts
at 160 bits.

1. Enclose pi through `16*atan(1/5)-4*atan(1/239)`. Enclose each small arctangent
   with its alternating odd-power series, retaining outward bounds at every
   operation and adding the first omitted term on the appropriate side. The
   identity follows angle addition with the result in the first quadrant.
   One highest-precision pi interval may be cached; coarser requests are rounded
   outward from it. Do not retain a growing table of precision-indexed constants.
2. For sine, cosine and tangent, decode the absolute input as the exact ratio
   `n/d`. Obtain pi at precision `P + max(0,bitLength(n)-bitLength(d)) + 32`.
   Bound `2*abs(x)/pi` and choose its nearest integer, using floor after adding
   one half. Refine if the two bounds do not choose the same integer `q`.
   Subtract `q*pi/2` at the reduction precision and regrid its residual interval
   outward to precision `P`. The exact residual is in `[-pi/4,pi/4]`.
3. Refine if the residual bounds are not inside `[-1,1]`. Bound sine and cosine
   at the residual endpoints through their factorial Taylor series and the
   alternating first-omitted-term remainder. Sine is increasing on this range;
   cosine decreases with absolute argument, with a maximum of one when the
   residual interval crosses zero. Apply exact quadrant swaps and signs from
   `q mod 4`, then the original argument sign. Tangent divides the sine and
   cosine intervals only once the cosine interval excludes zero. Never divide
   separately rounded sine and cosine results.
4. For arctangent and `atan2`, preserve the exact rational argument or component
   ratio. A positive ratio above one uses `pi/2-atan(1/r)`. A ratio above one
   half and at most one uses `pi/4+atan((r-1)/(r+1))`. The remaining small
   arctangent argument has magnitude at most one half; enclose its alternating
   series as in step 1. Apply signs and quadrants to intervals, never to an
   intermediate rounded angle or a binary64 division of the components.
5. For inverse sine and cosine, form `1-x*x` as an exact rational. Obtain
   outward square-root bounds using integer square roots after fixed-point
   scaling. Arcsine uses `atan(abs(x)/sqrt(1-x*x))` and the original sign.
   Arccosine uses `atan(sqrt(1-x*x)/abs(x))`, complemented from pi for negative
   `x`, and pi/2 at zero. Feed the root bounds directly into the rational
   arctangent bounds. In particular, do not round the root or the ratio to
   binary64 first.

Handle exact zero results and cosine of zero directly; endpoint and axis angles
use the pi intervals. For nonzero algebraic arguments, the remaining sine,
cosine and tangent results, and their nonzero inverse angles, cannot be rational
rounding midpoints. Narrowing enclosures therefore eventually choose one rounded
result. Tiny component ratios can require much more precision than ordinary
inputs: an exact half-subnormal ratio must still account for the arctangent's
cubic correction. This recipe promises the same rounded result, not a fixed
maximum number of refinement steps.

### 20.11 What this section cannot pin down yet

Each of these is a gap in the specification rather than a choice made here, and
each is a place two conforming engines may still differ.

A gap reached by a study needs to be distinguished from a gap no study exercises.
An output reached through unfixed arithmetic cannot establish conformance to
this page, even when two engines happen to agree. The table records that boundary
and is checked against the actual gate scripts.

The table below says which calls reach each gap and which gate studies make one.
**Its last column is derived, not asserted.** `tests/gate/gaps.test.ts` reads
the table and both of the gate's script directories, works out for itself which
study reaches which gap, and fails naming both when the table and the tree
disagree. That check is here because the sentence this paragraph replaced said
none of these gaps was reached by the studies the gate compares. Nothing
measured it, studies were added, and by the time it was read again three studies
reached three of the gaps and the sentence still read as a fact.

| Gap | Reached through | Gate studies that reach it |
|---|---|---|
| 2 | `hma` | none |
| 3 | `eom` | none |
| 4 | nothing a script can call | none |

The former platform-math gap is closed by sections 20.10.1 through 20.10.4.
Hypotenuse, exponential, logarithmic, power and trigonometric results, including
studies composed from them, are required to match exactly. No host arithmetic
exclusion applies to those functions.

2. **The inner length of `hma` is not stated.** Section 4 fixes the outer length
   as `round(sqrt(len))`, which the declared warmup confirms, and says nothing
   about the inner one. The declared warmup holds for any inner length at or
   below `len`, so nothing in this document settles it. The arrangement in 20.3
   is the one this implementation uses, recorded as an implementation choice
   rather than presented as a reading of section 4. Selecting it by name, as a
   `ma` or channel call does through its type argument, reaches the gap as surely
   as calling it, which is why the check reads a script's strings as well as its
   calls.
3. **`eom` has no scaling constant.** Implementations of this reading usually
   multiply by a large divisor whose only job is to bring the number into a
   readable range, and they do not agree on it. Section 7 declares no such
   argument, so there is none here and the reading is the quantity itself. That
   leaves it very small on a liquid instrument.
4. **The exact channel values of the named colours** are fixed by section 11.1
   and are part of the conformance suite, and are not written out in this
   document. Until they are, an implementer takes them from the suite. Every
   study in the gate names a colour and no comparison in the gate depends on one
   of these values: both sides of a colour assertion resolve the name through the
   engine's own table, so the channels cancel and what is proved is that the name
   reached the surface. That is checked as well, by refusing a transcribed
   channel value anywhere in the gate's own tests, because a test that wrote the
   numbers out would turn a gap nothing exercises into a third hole.
