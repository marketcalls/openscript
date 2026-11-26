# Troubleshooting

By the end of this page you will be able to take the symptom you are actually
looking at, a blank pane, a line that stops short, a signal that fired twice, a
backtest that disagrees with the chart, and find the cause and the fix without
guessing.

## How to read this page

Each entry is a symptom you can see, the cause behind it, and the fix. They are
grouped by where the symptom shows up, not by which part of the language is
involved, because you know what you are looking at and you do not yet know what
caused it.

Two habits solve more problems than this whole page. The first is to plot the
thing you are unsure about: a `bool` becomes `cond ? 1 : 0` and a suspicion
becomes a line you can look at. The second is to read the warnings. Fourteen of
the one hundred and sixteen diagnostics are OS8xxx warnings, they stop nothing,
and each one describes a shape that is defined, specified and almost never what
the author meant.

## Nothing is drawn

### 1. My study draws nothing at all

**Cause.** Usually one of three things: there is no `plot` in the file, the value
passed to `plot` is absent on every bar, or the study is on its own pane and you
are looking at the price pane. A plot whose value is never present raises warning
OS8009, "this plot can never draw", so check the warnings first.

**Fix.** Confirm a `plot` exists at the top level of the file. Then plot the raw
input to whatever you are computing, rather than the result, and work forward
until the line disappears. If the study belongs over the candles, say so in the
declaration: `study("Name", overlay = true)`.

### 2. My line stops at the left edge

**Cause.** This is warmup, and it is working correctly. A function that needs
`k` bars returns absent until `k` bars exist, and absence reaching a plot draws a
gap rather than a zero. There is no separate warmup phase in OpenScript: the
whole of it is the absent value.

**Fix.** Nothing, if the length is what you wanted. Warmups compose, so
`sma(ema(close, 10), 10)` is absent until bar 18, and every warmup length is
stated exactly in the library catalogue. Where you genuinely want a number during
warmup, ask for one: `orElse(rsi(close, 14), 50)`. Do not do that by reflex,
because a fabricated 50 on the first thirteen bars is data you invented.

### 3. My line has holes in the middle of the chart

**Cause.** Something in the calculation went absent on those bars, and absence
propagates through arithmetic all the way to the plot. The usual sources, in
order of how often they are the answer:

| Source | Why it is absent |
|---|---|
| A division by zero | `up / down` where `down` is 0 on that bar |
| A stateful call inside a branch | The call did not run on those bars, so its series is absent there |
| `volume` on an instrument with none | Absent, not zero, so every volume function is absent |
| A gap in the supplied bars | A windowed function is absent if any bar in the window is |
| A maths call with no real answer | `sqrt` below zero, `log` at or below zero |

**Fix.** Find which term went absent by plotting the terms one at a time. For the
branch case, the compiler already told you with OS8001: compute the call
unconditionally at the top level and use the result inside the branch.

```
// Holes on every non-trending bar.
if trending
    e = ema(close, 20)

// No holes: the average advances on every bar.
e = ema(close, 20)
if trending
    signal("TREND")
```

### 4. My table is blank, or half of it is

**Cause.** A cell written with an absent value is blank, exactly as a plot with
an absent value is a gap. Either the value is absent on that bar, or the `cell`
call did not run on that bar and nothing rewrote it.

**Fix.** Convert deliberately: `text(orElse(v, 0), 2)`, or `text(v)`, which
renders an absent value as the word `none` rather than as nothing at all. Declare
the `table` at the top level, and write every cell you want present on every bar
where you want it present.

### 5. The compiler refused my plot inside an if

**Cause.** OS3006. `plot` and the other calls
[../spec/language.md](../spec/language.md) section 15.3 makes top level only
define the fixed shape of the study, and that shape has to be known before bar 0
so the chart can build a legend, an axis and a settings dialog. A plot inside a
branch would add a column on some bars and not others, and there would be
nothing stable to name.

**Fix.** Move it to the top level and hide it per bar with the absent value.

```
// OS3006.
if trending
    plot(ema20, "EMA 20", aqua)

// Correct: one column, absent on the bars you want hidden.
plot(trending ? ema20 : none, "EMA 20", aqua)
```

## The chart looks wrong

### 6. The price axis reformatted itself when I added my study

**Cause.** `precision` and `format` on a `plot` set the formatting of the price
scale that plot maps to. On a study drawn over the price pane, that scale is the
instrument's own axis, so the study reformats the chart underneath it.

**Fix.** Set `precision` on the declaration, which applies to the study, rather
than on a plot drawn over the price pane. The compiler warns when a script does
the latter.

### 7. My plot is a straight sloping line between two daily values

**Cause.** A higher timeframe value changes once per coarse bar and is constant
across every fine bar inside it. Drawn as an ordinary line, the renderer joins
yesterday's reading to today's with a slope, implying intraday values that were
never read.

**Fix.** `style = "step"`. A step plot says what the data says: the value held,
then changed.

```
biasAverage = req.timeframe("1D", ema(close, 20))
plot(biasAverage, "Daily bias", orange, width = 2, style = "step")
```

### 8. My colour made everything invisible

**Cause.** `fade(color, percent)` takes **transparency**, not opacity, and the
argument is a percentage. `fade(aqua, 90)` is nearly invisible;
`fade(aqua, 10)` is nearly solid. The two conventions are opposites and a script
that guesses wrong draws nothing visible.

**Fix.** Use `fade` when you are thinking "how see-through", and
`withAlpha(color, a)` with `a` from 0 to 1 when you are thinking "how opaque".
A channel argument outside its range is an error rather than a clamp, because a
colour computed from data and landing at 300 is a bug in the computation.

## Values, names and warmup

### 9. My running total is absent on every bar after the first

**Cause.** A plain assignment is recomputed from scratch every bar, so a name
that reads its own past through `[1]` reads absence on bar 0, the addition
propagates that absence, and the series is absent forever after.

**Fix.** `var`, which is the language's way of saying "keep this".

```
barCount = barCount[1] + 1  // none on bar 0, and none forever after

var barCount = 0
barCount = barCount + 1     // 1, 2, 3, ...
```

### 10. My counter counts ticks instead of bars on a live chart

**Cause.** You used `live var`. An ordinary `var` rolls back before each
re-execution of the moving bar, which is what makes executing the newest bar ten
times give the same answer as executing it once. `live var` opts out of that by
design, and the compiler says so with warning OS8011.

**Fix.** Use `var`. Keep `live var` for the one case it exists for, which is
counting intrabar updates on purpose, and expect live and backtest numbers to
differ when you do.

### 11. My comparison is neither true nor false

**Cause.** If either operand of `<`, `<=`, `>` or `>=` is absent, the result is
absent, not false. So `a > b` being false does not mean `a <= b` is true: during
warmup both are absent and both branches are skipped. A condition that evaluates
to absent takes the false branch.

**Fix.** That is the correct behaviour and it keeps `not (a > b)` equal to
`a <= b` for every input. Where you need to know, ask with equality, which never
returns absent: `isNone(x)`, or `x == none`. An ordered comparison with `none`
literally on one side is always absent and always dead, which is warning OS8012.

### 12. The compiler says a name is not defined and I can see it three lines up

**Cause.** One of two rules. Either the name was first assigned inside a block,
in which case it is local to that block and invisible outside it, or the name is
read above the line that assigns it, and the file is the body of a per-bar loop
that runs in source order.

**Fix.** Assign it at the top level before you read it. Functions are the one
exception: an `fn` may be called before its declaration appears.

```
if volatile
    scratch = high - low     // declared in the block
plot(scratch, "Scratch")     // OS2001: not visible here

scratch = none               // declared at the top level
if volatile
    scratch = high - low     // updates the existing name
plot(scratch, "Scratch")     // fine
```

### 13. The compiler says the name already exists

**Cause.** OS2002. Declaring a name in an inner scope when the same name exists
in an enclosing scope is an error, because an assignment to an existing outer
name updates it, so shadowing could only ever be a mistake. Assigning to a
built-in such as `close`, `ema` or `aqua` is the same error, since the standard
library lives in the outermost scope.

**Fix.** Rename the inner one. The message names the line of the outer
declaration so you can see what you collided with.

### 14. My values changed when the chart loaded more history

**Cause.** You stored `bar.index`. It is a position in the data the engine was
given, not a universal address, so loading more history renumbers every bar and a
stored index is compared against something that moved underneath it. The compiler
warns with OS8014.

**Not raised yet.** OS8014 is in the catalogue and nothing raises it: the
checker does not follow a bar index into a persistent value.

**Fix.** Store `time` and compare timestamps. A bar's time does not move.

### 15. My warmup silently changed an answer

**Cause.** An `if` whose condition can be absent takes the false branch during
warmup, so a name the block assigns keeps whatever it held before, and warmup
bars sit off the left edge of the screen where nobody looks. This is warning
OS8004.

**Not raised yet.** OS8004 is in the catalogue and nothing raises it: the
checker does not follow which names a branch on a possibly absent condition
assigns.

**Fix.** Decide what warmup means and write it down: test `isNone(cond)`
explicitly, or give the name a starting value above the `if`.

## Signals and alerts

### 16. My signal fires twice, or on every bar of a run

**Cause.** The condition tests a **state**, not a **change**. `fast > slow` is
true on every bar of a trend, so it marks every bar of the trend.

**Fix.** Test the transition. `crossUp(a, b)` is the built-in form and is true on
exactly the bar where `a` was at or below `b` and is now above. Where the event
is not a crossing, compare against the previous bar or hold a flag in a `var`.

```
up = fast > slow

if crossUp(fast, slow)                       // once, on the crossing bar
    signal("BUY")

if up and not orElse(up[1], false)           // the same idea by hand
    signal("BUY")
```

### 17. My signal never fires at all

**Cause.** Four candidates, in order of frequency:

1. The condition is absent rather than false, and an absent condition takes the
   false branch. This is warmup, or a missing volume, or a division by zero.
2. The bar is still moving. Signals, alerts and orders are deferred until the bar
   is confirmed, and if the condition is no longer true when the bar closes they
   never happen at all.
3. The condition is genuinely never true, which a constant-condition warning
   (OS8017) will tell you about if it is constant.
4. The guard above it is doing something you did not intend, such as an ordered
   comparison against `none`.

**Fix.** Plot the condition as `cond ? 1 : 0` and look at the line. A flat zero
means false; a gap means absent, and the two have completely different causes.

### 18. My alert never arrives

**Cause.** Everything in the previous entry applies, plus three that are specific
to alerts. An alert does not fire for bars that were already on the chart when
the study was added, because an alert is a statement about now. Nobody subscribed
to the id. Or the subscription was made before an edit and the alert had no `id`,
so its derived name moved when a line was inserted above it.

**Fix.** Give every `alert()` a stable `id`, check the subscription is on that
id, and remember that history fires nothing. See [alerts.md](./alerts.md).

### 19. My marker sits on the wrong side of the bar

**Cause.** The call did not say where the marker goes, so it took the default,
`at = "above"`. A marker's side is never inferred from what the marker says: a
marker whose position depends on its own text reads differently on two engines.

**Fix.** Say which with `at`, and pick a `shape` rather than accepting the
default label: the `signal` entry of
[reference/functions/drawing.md](./reference/functions/drawing.md) lists the
values each one takes. The value has to be a literal or an `input()`, because
the marker's declaration is fixed before bar 0; a per-bar one is OS3003.

## Higher timeframe and other instruments

### 20. My higher timeframe read is empty

**Cause.** Work down this list:

| Code | Means |
|---|---|
| OS6001 | The timeframe string is not a timeframe. Minutes are a number in a string, `"5"` or `"60"`; a day is `"1D"` |
| OS6002 | The request is finer than a daily chart, or finer than an intraday chart on a host that serves no bars of its own |
| OS6015 | The request is not a whole multiple of the chart's interval, on a host that serves no bars of its own |
| OS6007 | The host does not know that symbol on that exchange |
| OS6008 | The instrument returned no bars over the range the chart covers |
| OS6009 | The request failed: a connection, permission or quota problem in the host |

Beyond those, a `req.symbol` read is simply absent until the host answers, which
is not instant.

**Fix.** Check `req.isReady(read)` before branching on the value and
`req.error(read)` for the reason when one failed. Note that the unit letters are
case sensitive: `"1M"` is one month and `"1m"` is one minute.

### 21. My markers move when I reload the chart

**Cause.** The study repaints, and there are only two ways for that to happen by
accident. Either a higher timeframe read uses `mode = "developing"` or
`mode = "lookahead"`, or the declaration sets `onUnconfirmed = true` and the
script acts on a bar that is still moving.

**Fix.** `mode = "confirmed"` is the default and the only mode that never
repaints. A `"lookahead"` read marks the compiled study as repainting and the
host shows that mark in the legend, which is the point. If you set
`onUnconfirmed = true` deliberately, guard every decision with `bar.isConfirmed`
and expect warning OS8002 on every higher timeframe read in the file.

## Strategies, orders and backtests

### 22. My backtest and my chart disagree

**Cause.** Usually not a bug. The candidates, in the order worth checking:

| Cause | What to look at |
|---|---|
| Fill timing | `fillOn` defaults to `"nextOpen"`, because a decision made from a bar's close cannot be filled at that same close in the real market |
| Costs | `slippage`, `commission` and `commissionType` are applied to every fill |
| A `live var` | It does not roll back, so it counts updates live and bars in a backtest |
| `onUnconfirmed = true` | The live run acts on a bar the backtest only ever saw closed |
| A repainting read | `"developing"` and `"lookahead"` mean history and live are different pictures |

**Fix.** Read the declaration first: five of those six are options set on one
line. Leave `fillOn = "nextOpen"` alone unless you can say why the other is
honest for your market.

### 23. My strategy did nothing when I ran it live

**Cause.** In order of likelihood: no order destination is connected, so the
strategy placed an order and had nowhere to send it (OS7015); the destination
rejected the order and the reason came from the account rather than the script
(OS7014); the instrument was outside its trading session (OS7012); or the
strategy was never switched to live, since sandbox mode is the default and live
is deliberate.

**Not raised yet.** OS7015, OS7014 and OS7012 are in the catalogue and nothing
raises them. A strategy with nowhere to send orders places intents that reach
nobody. A destination's own refusal is folded into the ledger row as a status
and its text, and is reported against no line. Nothing compares the bar's time
with the instrument's session before an order is sent.

**Fix.** Connect a destination, read the rejection reason, guard entries with
`session.isOpen`, and set `closeOnSessionEnd = true` if you must be flat at the
close. To test the logic without any of this, run the file as a `study()` and
replace `buy()` with `signal("BUY")`.

### 24. My order was refused

**Cause.** The OS7xxx range, and the code says which:

| Code | Means | Usual reason |
|---|---|---|
| OS7002 | An order argument is absent | A stop computed from a window that has not filled yet |
| OS7004 | Quantity is zero or negative | A sizing formula returned 0 after rounding down |
| OS7005 | Quantity is not a multiple of the lot size | Sizing in units on an instrument that trades in lots |
| OS7007 | A limit or stop order has no price | `limit` or `stop` named and not supplied |
| OS7008 | The entry was refused by pyramiding | Already at the declared maximum entries in that direction |
| OS7011 | The order needs more capital than the strategy has | Size from equity, or test `pos.equity` first |
| OS7013 | Two opposite orders on one bar | Two conditions that are not exclusive |
| OS7016 | A close names a tag nothing places | A typo in a `close` tag, reported by the compiler rather than by a run |
| OS7017 | A close states more than it is closing | A `qty` on a `close` larger than what is left to close, which is what the leg or the tag holds less everything already working against it, including an order sent on an earlier bar that the destination has not answered |

**Not raised yet.** OS7005 and OS7011 are in the catalogue and nothing raises
them. Nothing compares an order's quantity with the lot size its leg trades in.
Nothing compares an order's cost with the capital the strategy has.

**Fix.** For the absent-argument case, guard the call rather than defaulting the
value, because an order is the one place in the language where doing nothing
quietly is worse than stopping loudly.

```
stop = lowest(low, 20)
qty  = order.qtyForRisk(5000, close, stop)

if crossUp(fast, slow) and not isNone(stop) and not isNone(qty) and qty > 0
    buy(qty = qty)
    exit(stop = stop)
```

For OS7013, make the two conditions exclusive with `else if`, or place the exit
on this bar and the entry on the next.

For OS7017, leave the quantity off the `close` and it sends whatever is left, or
guard the scale-out on `pos.size` so it cannot fire twice on one position. If the
bar already sent a close, what is left is smaller than `pos.size`: a position
moves when a fill settles, and nothing has settled yet. The
engine will not send the smaller number for you: that would be a quantity you
did not write, and the script would go on believing it had closed the one you
did. Note that `close(tag = "runner")` with no quantity stays silent on a tag
that has already flattened, which is deliberate and is not the same case.

### 25. My stop was hit live and not in the backtest

**Cause.** A backtest sees bars, not ticks. Everything inside a bar, the order
the high and the low were made in, the path between them, is not in the data. A
stop and a target that both sit inside one bar's range cannot be resolved from
that bar, and the fill model has to choose.

**Fix.** Do not treat a backtest as a tick-accurate simulation of intrabar
behaviour. Test the same rule on a finer interval, where each bar carries less
unresolved path, and size the stop so that being wrong about the path inside one
bar does not decide the result.

### 26. My strategy entered again when it was already in

**Cause.** `pyramiding` defaults to 1, so the second entry is refused with
OS7008 and the strategy simply does not do what the source appears to say. The
source appears to say it because nothing in the entry condition tests the
position.

**Fix.** Test the position, which also makes the intent readable.

```
if crossUp(fast, slow) and pos.isFlat
    buy(qty = 1)
```

## Numbers and performance

### 27. My indicator disagrees with another implementation's numbers

**Cause.** Two implementations of the same named indicator routinely differ in
three places: the seeding of a smoothed average, whether a standard deviation
divides by the window length or by one less, and how halves are rounded. All
three are fixed in OpenScript and stated per function, rather than left as "the
usual definition".

**Fix.** Check the three. `ema` is seeded on bar `len - 1` with the simple
average of those `len` values. `stdev` and `variance` divide by `len`, the
population form, and take `sample = true` for the other. `round` takes halves
away from zero. Then check the warmup: an implementation that starts a bar
earlier or later than the specification has a different first value and therefore
a different smoothed series for ever after.

### 28. My loop ran out of budget

**Cause.** OS5001. Every iteration of every loop, summed over all loops executed
during one bar, counts against a per-bar budget of 2,000,000 iterations by
default. The bar stops rather than breaking out of the loop, because a loop that
ran two million times and then stopped produces a plausible wrong number, and a
plausible wrong number is worse than no number.

**Fix.** Two honest answers. Either the exit condition is wrong, which the named
line will show you, or the script genuinely needs more, in which case raise it
deliberately in one place. There is no platform ceiling you cannot see.

```
study("Heavy")
limits(loops = 50_000_000)
```

Also check for the descending loop that never runs: `for i = 9 to 0` runs zero
times, and needs `step -1`. The compiler warns with OS8015.

### 29. My script is slow, or a bar timed out

**Cause.** Almost always recomputation: a loop that walks the whole history on
every bar, so the work grows with the square of the dataset. The host may stop it
with OS5007 when one bar takes too long.

**Fix.** Keep a running value in a `var` and update it per bar instead of
recomputing over the whole history. The built-in series helpers already do this:
prefer `highest`, `sum`, `cum`, `barsSince` and `valueWhen` to a loop that does
the same thing by hand.

```
// Recomputes 200 additions every bar.
total = 0
for i = 0 to 199
    total += close[i]

// One addition and one subtraction per bar, inside the engine.
total = sum(close, 200)
```

### 30. The compiler rejected a character I cannot see

**Cause.** OS1001. Outside a string literal the language accepts ASCII letters,
ASCII digits, space, newline and its own punctuation, and nothing else. A
non-breaking space or a typographic quotation mark pasted from a web page or a
word processor is invisible in every editor, and rejecting it where it sits is
what stops it producing a baffling parse error three tokens later.

**Fix.** The message names the plain character to use instead. Related refusals
from the same family: a tab in the indentation (OS1002, indent with spaces), a
semicolon (put the second statement on its own line), `!` (write `not`), `&&` and
`||` (write `and` and `or`), and `^` (write `pow(a, b)`).

## Still stuck

Three things to try before anything else. Read the warnings, because OS8xxx
diagnostics stop nothing and describe exactly the shapes that produce mysterious
behaviour. Plot the intermediate value, because a gap and a flat zero look
identical in your head and completely different on a chart. And look the code up
in the catalogue, where every one of the one hundred and sixteen carries a cause,
a fix and a before-and-after example.

## See also

- [writing/debugging.md](./writing/debugging.md) for finding the exact bar and line that goes wrong
- [errors/overview.md](./errors/overview.md) for how the codes are organised and where they are looked up
- [language/warmup.md](./language/warmup.md) and [language/absent-values.md](./language/absent-values.md) for the left edge and the holes
- [data/repainting.md](./data/repainting.md) for markers that move
- [running/backtesting.md](./running/backtesting.md) for the backtest that disagrees with the chart
- [writing/limits.md](./writing/limits.md) and [writing/profiling.md](./writing/profiling.md) for budgets and speed
- [alerts.md](./alerts.md) for the alert that will not fire
- [faq.md](./faq.md) for the questions rather than the symptoms
- [glossary.md](./glossary.md) for any term above that is new
- [../spec/errors.md](../spec/errors.md) for the full catalogue
