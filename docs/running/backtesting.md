# Backtesting

By the end of this page you will be able to run a strategy over a date range you
chose on purpose, work out how many bars of history it needs before its first
trade means anything, and read the record a run stores well enough to reproduce
that run a year later.

## What a run is

A backtest run is one pass of a compiled program over a fixed set of bars.

```
source text
   -> a saved revision
   -> a compiled program
   -> bars: one symbol, one exchange, one interval, one from and one to
   -> a report, stored as a row
```

The engine executes every top-level statement of the file once per bar, oldest
bar first, exactly as it does on a chart. There is no separate backtest mode in
the language and no backtest-only function. The only thing that differs between
backtesting a strategy and running it is where the orders go: in a run they go
to the simulator, and in a live run they go to a destination that can fill them.
Same compiler, same compiled program, same numbers.

A run is not a view of a script. It is a stored row, and the row holds:

| Field | Why it is in the row |
|---|---|
| Script revision | The exact source the run executed |
| Compiled program hash | Proof the source compiled to the program that ran |
| Symbol and exchange | The instrument, including which venue's prices |
| Interval | The resolution of every decision the script made |
| From and to | The range of bars |
| Input values | Every `input()` as it stood at the moment of the run |
| Cost settings | Slippage, commission, product, lot size |
| Resolved legs | The contract each declared leg resolved to, which is what the orders carried |
| Result | The order and fill ledger, the equity curve, the trade list, the named events, and the numbers derived from them |

A result you cannot describe with those nine fields is a result you cannot
defend. Every one of them changes the answer, which is why every one of them is
recorded rather than assumed.

Two of the rows are worth a sentence each. **Resolved legs** matters because a leg
described relatively, such as the nearest expiry at the money, resolves once before
bar 0; recording the description would not let anybody reproduce the run, and
recording the resolution does. **The ledger** is in the result rather than derived
from it because every position and profit figure the run reports is folded from
this strategy's own settled fills, so the ledger is the evidence and the curve is
the summary.

## The file has to be a strategy

A `study()` file computes and draws. A `strategy()` file computes, draws and
places orders. `strategy()` accepts every `study()` option and adds the trading
ones, so turning a study into a strategy means changing one word and adding
order calls, not rewriting anything.

```
version 1

strategy("EMA cross, one lot", overlay = true, precision = 2,
         capital = 500000, qty = 1, qtyType = "lots",
         product = "intraday", fillOn = "nextOpen",
         slippage = 1, commissionType = "perTrade", commission = 20)

fastLen = input(9,  "Fast length", min = 1, max = 500)
slowLen = input(21, "Slow length", min = 2, max = 500)

fast = ema(close, fastLen)
slow = ema(close, slowLen)

if crossUp(fast, slow) and session.isOpen and pos.isFlat
    buy()

if crossDown(fast, slow) and pos.isLong
    close()

plot(fast, "Fast", aqua, width = 2)
plot(slow, "Slow", orange, width = 2)
```

That file is complete. Paste it, pick a symbol, an interval and a range, and it
runs.

Two errors are worth knowing before you meet them. Calling an order function in
a `study()` file is OS7001, which names the declaration to change. Running a
strategy with nowhere for orders to go is OS7015, because a strategy with no
destination would compute a position that nothing ever took.

**Not raised yet.** OS7015 is in the catalogue and nothing raises it: a strategy
with nowhere to send orders places intents that reach nobody.

## Choosing the interval

The interval is the resolution of every decision in the file. It decides what
the script can see, and it decides how coarsely a fill can be modelled.

| Interval | What one bar hides | Where the honesty risk is |
|---|---|---|
| 1m to 5m | Seconds. Spread and queue position dominate | Costs. A small edge per trade is eaten by the spread |
| 15m to 1h | The path inside a quarter hour | Stops and targets that both sit inside one bar |
| 1D | The whole session | A gap through a stop, filled at a price that never traded |
| 1W and up | Weeks | Too few trades to say anything |

Three rules follow from the fact that the simulator sees four prices per bar and
nothing else.

**A fill lands one interval after the decision.** `fillOn` defaults to
`"nextOpen"`, so a decision taken from a bar's close fills at the next bar's
open. On a daily interval that is the next day. The default is the pessimistic
one on purpose: a decision made from a close cannot be filled at that same close
in the real market, and a backtest whose default is optimistic is a backtest
that lies. `fillOn = "close"` exists, and every result it produces is better
than the result you will get.

**When one bar's range contains both a leg's stop and its target, the stop is
taken.** Only the tick data the simulator does not have could say which came
first, and assuming the better of the two is how a backtest invents money that was
never made. So the language states the rule rather than leaving two engines to
disagree, and it states it against you. Two things follow: a run on a coarse
interval quietly attributes every ambiguous bar to the stop, and the honest
response is to drop to an interval where the two levels are rarely inside one bar,
or to count those trades and know how many of them there are.

**A coarser interval is not a slower version of a finer one.** A 15 minute
script rerun on 1 hour bars is a different strategy with the same source: its
averages span four times the time, its stop is four times as far from its entry
in bar terms, and its signal count falls. Compare two intervals as two
strategies, not as one strategy at two speeds.

To read another interval from the chart, use `req.timeframe`, which takes a mode
saying what the read is allowed to know. On an intraday chart it reads any whole
number of minutes, finer than the chart's included, where the host serves bars;
reading a finer interval from a chart of a day or longer is OS6002.

## Choosing the date range

The range decides what the result is a statement about. Three things matter and
the calendar is not one of them.

**Count trades, not days.** A five year daily run of a strategy that trades
twice a year is ten trades. Ten trades is an anecdote. Aim for a range that
produces at least a hundred closed trades, and treat anything under thirty as a
sketch. If a hundred trades needs ten years of daily bars, the honest conclusion
is that the idea has to be tested on a finer interval or not at all.

**Cover more than one regime.** A range has to contain at least one strong
trend, at least one long sideways stretch, and at least one fast fall, because
those are the three shapes a strategy can be wrong in. A run that spans only a
rising market tells you that the strategy was long during a rise, which you
already knew.

**Hold something back.** Pick the range, then decide before you look at any
result which section you will not tune on. A common split is to develop on the
first two thirds and check on the last third, but any split chosen in advance is
better than the best split chosen afterwards.

Two practical points. End the range on a bar that has closed, so no trade in the
report depends on a bar that was still moving. And keep the range fixed while
you are comparing versions of a script: a change to the range and a change to
the script in the same step means neither one is measured.

## Warmup: how much history before the first trade is honest

Everything in this section follows from one rule in the language: a function
that needs `k` bars returns the absent value until `k` bars exist, and absence
propagates through arithmetic, through comparison, and into the branch that
would have placed the order.

That rule protects you automatically. An absent condition takes the false
branch, so during warmup no order is placed. What the rule does not do is tell
you when warmup ended, and that is the number you need in order to choose a
range.

### Warmups compose

A call whose source is absent is absent too. So warmup lengths add up along a
chain:

```
sma(ema(close, 10), 10)     // absent until bar 18
```

The inner mean is absent until bar 9, the outer one needs ten present values,
and the eighteenth bar is the first on which it has them.

### There are three kinds of warmup, and only one is in the library reference

| Kind | Where it comes from | How to find it |
|---|---|---|
| Library warmup | Each call's own length | The warmup column in the library reference |
| Lookback warmup | `[n]` and windowed helpers | The largest `n`, added to the call's own warmup |
| State warmup | A `var` that fills over time | Read the script |

State warmup is the one that gets missed. A range anchored on `session.isFirstBar`
is not warm until a full session has passed. A running total anchored to a date
is not warm until the anchor. A counter of how many times something happened is
not warm until it has happened enough times to matter. None of these appear in
any reference, because they are in your file.

### Work out your own file's warmup

Take the entry condition apart, write down each term's warmup, and take the
largest.

| Term in the entry | Warmup |
|---|---|
| `ema(close, 200)` | bar 199 |
| `atr(14)` | bar 13 |
| `rsi(close, 14)` | bar 14 |
| `highest(high, 20)[1]` | bar 20 |
| `macd(close, 12, 26, 9)` signal line | bar 33 |
| a `var` reset each session | the first bar of the second session |

The file above is warm at bar 199, or at the first bar of the second session if
that is later. On a 15 minute interval with 25 bars a session, bar 199 is eight
sessions in. Load at least that much history before the first bar you want to
trade.

### Two ways to make the first trade honest

The better way is to load history before the range you trade, so that the
strategy is already warm on the first bar of the window you care about.

```
version 1

strategy("Traded window", overlay = true, precision = 2,
         capital = 500000, qty = 1, qtyType = "lots")

tradeFrom = input("2022-01-01", "Trade from", kind = "time")
tradeTo   = input("2024-12-31", "Trade to",   kind = "time")

fast = ema(close, 20)
slow = ema(close, 200)

// Bars before tradeFrom are loaded and computed, they are simply not traded.
// The 200 bar average is already warm on the first bar inside the window, which
// is what makes that window's first trade comparable with its last.
inWindow = time >= tradeFrom and time <= tradeTo

if inWindow and crossUp(fast, slow) and pos.isFlat
    buy()

if pos.isLong and (crossDown(fast, slow) or not inWindow)
    close()

plot(slow, "Slow", orange, width = 2)
background(inWindow ? none : fade(silver, 92))
```

The second way is to state the guard in the script, which is worth doing anyway
because it lets the script say out loud when it went live rather than leaving
you to infer it from the first marker.

```
version 1

strategy("Guarded entry", overlay = true, precision = 2,
         capital = 500000, qty = 1, qtyType = "lots")

trend    = ema(close, 200)
breakout = highest(high, 20)[1]
strength = rsi(close, 14)

// Every value the entry reads, tested once. Absence would already have skipped
// the entry, because an absent condition takes the false branch. The guard
// exists so the run can report which bar the strategy became honest on.
warm = not isNone(trend) and not isNone(breakout) and not isNone(strength)

var announced = false
if warm and not announced
    announced = true
    print("Warm at bar " + text(bar.index) + ", " +
          date.format(time, "yyyy-MM-dd HH:mm"))

if warm and pos.isFlat and close > breakout and strength > 55 and close > trend
    buy()

if pos.isLong and close < trend
    close()

plot(trend, "Trend", aqua, width = 2)
plot(breakout, "Breakout level", orange, style = "step")
```

A useful default: load the file's warmup in bars, add a fifth, and round up to a
whole session. The extra fifth covers the lookbacks you forgot.

## The cost model, because a free backtest is a fiction

Every trading option on the declaration changes the result, and leaving one at
its default is a decision even when it does not feel like one.

| Option | Default | What happens if you leave it |
|---|---|---|
| `fillOn` | `"nextOpen"` | Honest. Changing it to `"close"` improves every result and none of the improvement is real |
| `slippage` | `0` | Every fill is at the exact price. No instrument does this |
| `commission` | `0` | Trades are free. On a high frequency script this alone can invert the result |
| `commissionType` | `"perTrade"` | A flat fee. Use `"perUnit"` or `"percent"` where the charge actually scales |
| `qtyType` | `"units"` | Sizes in units, not lots. On a lot-traded instrument that is the wrong number |
| `product` | `"intraday"` | Positions are treated as same-day. An overnight strategy needs `"overnight"` |
| `pyramiding` | `1` | One entry per direction. Raise it only if adding is part of the idea |
| `closeOnSessionEnd` | `false` | Intraday positions are carried. Usually not what an intraday script means |

Fill in slippage and commission first, before you look at any result at all. The
order matters: a strategy you have already seen a clean equity curve for is a
strategy you will argue with when the costs arrive.

The test that settles most arguments: double the slippage and rerun. An edge
that survives twice the assumed cost is an edge. An edge that halves is a cost
model, not a strategy.

## Why a run records the script revision

Three things can move under a result: the script, the data and the engine. The
recorded revision answers the first, the recorded range and symbol answer the
second, and the compiled program hash plus the language version answer the
third.

Pinning is the mechanism. Every save writes a revision, and a chart, a run and a
live process each pin the revision they started with. Editing a script does not
silently change a study on a chart, does not change a run that has already
happened, and does not change a strategy that is holding a position. The chart
offers to move to the newer revision instead of moving on its own.

This matters because of how backtests are actually used. You run a strategy,
you like the result, you keep working, and six weeks later you want to know
whether the version now running is the version that produced that curve. Without
a recorded revision that question has no answer and the honest response is to
throw the result away. With one it is a diff.

The language makes the guarantee worth having. There is no random number
function anywhere in the library, and the only reading of a clock during a bar
is `chart.now()`, whose value the host supplies. All arithmetic is binary64 in
source order, with no reassociation and no fused operations permitted. The same
compiled program over the same bars produces the same numbers on every engine,
every time. That is what makes a rerun a check rather than a new experiment.

## Reproducing a run

To reproduce a result you need seven things, and the run row holds all of them:
the revision, the compiled program hash, the symbol, the exchange, the interval,
the from and to dates, and the input values. Restore the revision, set those
inputs, run that range, and compare the trade list rather than the summary. Two
runs with the same net profit and different trade lists are not the same run.

Where the file declares legs, add the resolved contracts to that list. A relative
leg resolves against the market as it stood before bar 0, so a rerun started on
another day would resolve a different contract from the same description, and the
two runs would not be comparable however carefully everything else was pinned. The
run keeps what it resolved for exactly this reason.

If the trade lists differ and everything in the row matches, the data changed.
Adjusted history, a revised bar, a different vendor for the same symbol: all of
them move a result, and none of them is in the script.

## What a run cannot tell you

A run tells you what a fixed set of rules did over a fixed set of bars. It
cannot tell you whether the rules will keep working, whether you chose those
rules because they fit those bars, or whether you would have held the position
through the drawdown in the middle. Reading the report well is a separate skill
and it is the next page.

## Mistakes that produce a beautiful, wrong result

| Mistake | What it looks like | Fix |
|---|---|---|
| Range starts where the data starts | The first trades fire on partly warm values | Load warmup bars before the traded window |
| `fillOn = "close"` | Every entry is at the price that triggered it | Leave the default |
| Zero costs | A dense intraday script prints money | Set slippage and commission before reading anything |
| A lookahead read | The equity curve is too smooth to be real | Use the default `"confirmed"` mode on `req.timeframe` |
| One regime | A long-only strategy over a rising market | Extend or move the range |
| Tuned on the whole range | Every parameter is at a local peak | Hold a section back before tuning |
| Too few trades | A 22 trade backtest with a 68 percent win rate | Longer range, finer interval, or drop the idea |

## See also

- [reading-a-report.md](./reading-a-report.md) for what every number in the
  result means
- [sandbox-and-live.md](./sandbox-and-live.md) for the step after a run you
  believe, and for why nothing in a script can switch one to live
- [scheduling.md](./scheduling.md) for running strategies on a calendar
- [../strategies/exits-and-brackets.md](../strategies/exits-and-brackets.md) for
  the rules a run evaluates after each bar, and where their exits fill
- [../strategies/reading-the-books.md](../strategies/reading-the-books.md) for the
  ledger a run stores alongside its curve
- [../README.md](../README.md) for the documentation index
- [../../spec/language.md](../../spec/language.md) for the execution model,
  absence and the strategy options
- [../../spec/stdlib.md](../../spec/stdlib.md) for each function's exact warmup
- [../../examples/README.md](../../examples/README.md) for the twelve worked
  scripts
