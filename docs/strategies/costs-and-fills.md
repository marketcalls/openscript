# Costs and fills

By the end of this page you will be able to say exactly where your backtest
assumes each order was filled, what that assumption is worth, and how to put a
real market's full cost stack into a strategy so the equity curve is one you could
have earned.

## A backtest without costs is a fiction

Not an approximation, not an optimistic case: a fiction. It describes a market in
which trading is free, which has never existed. The shorter the holding period,
the bigger the lie, and the strategies people are most excited about are almost
always the short ones.

Two numbers make the point. Take a strategy that trades twice a day on a turnover
of five lakh a side. The charges on one round trip come to roughly two hundred and
thirty rupees, and one tick of slippage on each of the two fills adds about a
hundred more. Five hundred round trips a year is therefore something like a lakh
and a half of cost. An idea whose gross edge is three lakh a year is a good idea.
The same idea with the costs left out looks like a great one, and the difference
between those two descriptions is a year of your life.

This page is therefore not an appendix. It is the part of the strategy that
decides whether the rest of it was worth writing.

## Where a fill is assumed to happen

The declaration's `fillOn` option names the point at which a signalled market
order is assumed to fill.

| `fillOn` | Decision made on | Fill happens at | What it assumes about you |
|---|---|---|---|
| `"nextOpen"` (default) | The close of bar `i` | The open of bar `i + 1` | You acted on a closed bar and took whatever the market opened at |
| `"close"` | The close of bar `i` | The close of bar `i` | You could transact at the same close your rule was computed from |

The default is `"nextOpen"`, and the reason is the whole of this section: **a
decision made from a bar's close cannot be filled at that same close in the real
market.** By the time the bar's close is a number you can compare against a moving
average, the bar is over. Any backtest that fills there is quietly crediting you
with a price that was only knowable after the last moment you could have traded
at it.

A backtest whose default is optimistic is a backtest that lies, so the default is
the pessimistic one. The gap it exposes is real: on a gappy instrument the
difference between a bar's close and the next bar's open is often larger than
every charge on this page put together, and a strategy that cannot survive it is a
strategy that needed to know that.

`"close"` is not forbidden, because there are honest uses for it: an instrument
with a closing auction you can genuinely participate in, or a rule whose inputs
are all from bar `i - 1` so that filling at bar `i`'s close is not a lookahead at
all. If you set it, write a comment saying which of those two cases you are in.
If you cannot name one, you are inflating your results.

```
version 1

// The honest default, stated rather than inherited, so the next reader does not
// have to remember what the default was.
strategy("Fills where they can happen", overlay = true, precision = 2,
         capital = 500000, qty = 1, qtyType = "lots",
         fillOn = "nextOpen", slippage = 1,
         commissionType = "percent", commission = 0.023)

fast = ema(close, 9)
slow = ema(close, 21)
goLong = crossUp(fast, slow)
goFlat = crossDown(fast, slow)

if goLong and pos.isFlat
    buy(qty = 1, tag = "entry")
else if goFlat and pos.isLong
    close()

// The decision price and the fill price, side by side. Where these two diverge
// is where a backtest that fills on the close is inventing money.
plot(close, "Decision price", fade(silver, 60))
plot(pos.isFlat ? none : pos.avgPrice, "Filled at", aqua, style = "step")
```

### Limit orders, stop orders and gaps

A market order has one fill point and the table above names it. A resting order
does not: it fills when the market reaches it, which may be in the middle of a bar
the script never sees the inside of. Three rules for reading a backtest that uses
them, and none of them is optimism:

- **A limit order is not filled just because the bar's range touched the price.**
  Being touched is not the same as being traded through, and a limit at the
  extreme of a bar is exactly the order that does not get filled in practice,
  because everyone else's order was in the queue first.
- **A stop order does not fill at the stop price when the market gaps past it.**
  It fills at the first price actually available, which on the day it matters most
  is a long way from the trigger. A backtest that shows every stop filling exactly
  at the stop has not been asked what happened on the gap days.
- **A stop-limit order can fail to fill entirely.** That is not a defect, it is
  what the order is: a limit on the price you will accept after the trigger. The
  position it was supposed to close stays open.

The practical discipline: run the strategy twice, once with the stop as a level the
engine holds and once as a rule in the script that exits at the next bar's open,
and compare. If the two results are far apart, the strategy's returns are mostly a
claim about fill quality, and fill quality is the thing you have least control
over.

### Where a level's exit fills

A stop, a target or a trail set as a level is not filled at the declaration's fill
point. It fills where the level was, because that is what the order it sends does:

- **A stop sends a stop order at its level and a target sends a limit order at its
  level**, so a backtest fills at the level rather than at the next bar's open.
- **When the bar's open is already beyond the level, the fill is at the open**,
  because the level was gone before the bar began. That is the gap case, stated
  rather than modelled away: on the day it matters most, a stop fills a long way
  from its trigger.
- **The declared slippage applies to a stop and not to a target.** A stop takes the
  price on the other side and pays for it. A limit fills at its own price or not at
  all, so charging it slippage would be charging for something that did not happen.
- **When one bar's range contains both a leg's stop and its target, the stop is
  taken.** Nothing in a bar says which came first, and assuming the better of the
  two is how a backtest invents money that was never made.

A level's exit order is an order like any other. It lands in the strategy's ledger,
it obeys the lot and tick rules, and it can be refused: a stop that rounds to no
whole lot is OS7005 and a level off the tick is OS7006.

**Not raised yet.** OS7005 is in the catalogue and nothing raises it: nothing
compares an order's quantity with the lot size its leg trades in.

## Slippage

`slippage` is a number of ticks of adverse slippage applied to every fill.
Adverse means it always works against you: worse on a buy, worse on a sell, never
in your favour.

```
strategy("...", slippage = 2)     // two ticks worse on every fill
```

It is expressed in ticks rather than in money or in percent because a tick is the
unit the instrument actually moves in, and `chart.tickSize` tells the script what
one is worth. One tick on an instrument that ticks at five paise is a different
cost from one tick on an instrument that ticks at one paisa, and the same number
is right for both in tick terms.

**When the platform supplies the costs.** A platform may hand a backtest a
charge schedule of its own, and a schedule carries a slippage in ticks beside
its charge lines. Where one is supplied, its slippage is the one every fill is
worsened by. So a script that states a slippage of its own and a schedule that
carries a different figure are refused before the first bar, OS6026, rather
than the script's figure being dropped with nothing said. The same figure in
both is one statement and runs, and a script that leaves `slippage` at zero
leaves the platform's figure to stand. A declared commission beside a supplied
schedule is refused the same way, OS6023, because both describe the same money.

How to choose the number, in order of how much it matters:

| Ask | Then |
|---|---|
| How wide is the spread when you actually trade | At minimum, half the spread, in ticks, on each fill |
| How large is your order against the visible depth | Add a tick for every time you would have to take a second price level |
| When do your signals fire | The open and the close are the widest parts of the day, so a strategy that trades there pays more |
| How fast does the instrument move | A volatile instrument gaps between your decision and your fill even without a spread |

Then do the only test that matters, which is to make it an input and turn it up:

```
version 1

strategy("Slippage sensitivity", overlay = true, precision = 2,
         capital = 500000, qty = 1, qtyType = "lots",
         fillOn = "nextOpen", slippage = 1)

// Not used by the engine: this is the script's own estimate of what the engine's
// slippage setting costs, so the panel can show it in money.
slipTicks = input(1, "Ticks assumed per fill", min = 0, max = 20)

tick     = orElse(chart.tickSize, 0)
lotUnits = max(orElse(chart.lotSize, 1), 1)

// Two fills per round trip, so two lots of slippage.
slipPerTrip = 2 * slipTicks * tick * lotUnits

panel = table("Slippage", 2, 2, position = "bottomRight", textColor = silver)

if bar.isLast
    cell(panel, 0, 0, "Per round trip")
    cell(panel, 0, 1, text(slipPerTrip, 2))
    cell(panel, 1, 0, "Over the run")
    cell(panel, 1, 1, text(pos.tradeCount * slipPerTrip, 0))

fast = ema(close, 9)
slow = ema(close, 21)
goLong = crossUp(fast, slow)
goFlat = crossDown(fast, slow)

if goLong and pos.isFlat
    buy(qty = 1, tag = "entry")
else if goFlat and pos.isLong
    close()

plot(fast, "Fast", aqua)
plot(slow, "Slow", orange)
```

The rule of thumb this produces is worth more than any single number: **if the
edge dies between one tick and two, it was never an edge.** It was the backtest
reading a price nobody would have given you.

## Commission

| `commissionType` | `commission` means | Suits |
|---|---|---|
| `"perTrade"` | A flat amount charged on each trade the engine records | A flat fee per order |
| `"perUnit"` | An amount per unit traded | A per share or per contract charge |
| `"percent"` | A percentage of the traded value | Everything that scales with turnover |

Set one of the three and check what the report charged you, because "per trade" is
the one place where a reasonable person can read the words two ways: per order, or
per completed round trip. The check takes two minutes and removes the doubt for
good. Run the strategy over a range that produces exactly one round trip, read the
cost line in the report, and see whether it charged once or twice.

Most real cost stacks are not one of the three. They are a mixture of a flat fee,
a percentage, and a tax that applies to one side only. The rest of this page is
how to turn that mixture into numbers the declaration can hold.

## The full cost stack

What a real market charges on a round trip, in the order it usually appears on a
contract note:

| Charge | Base | Side | Notes |
|---|---|---|---|
| Brokerage | Turnover, or a flat fee per order, whichever the plan says | Both | Often the smaller of a percentage and a cap |
| Exchange transaction charge | Turnover | Both | Set by the exchange, varies by segment |
| Clearing charge | Turnover | Both | Small, and easy to forget entirely |
| Regulator turnover fee | Turnover | Both | Small, same |
| Tax on services | The charges above, not the turnover | Both | A tax on a tax base, so it compounds the others |
| Securities transaction tax | Turnover, or premium, or settlement value by segment | Often one side only | The largest single line for many intraday strategies |
| Stamp duty | Turnover | The buy side only, in most segments | Varies by state and by segment |

**The numbers below are illustrative.** They are the right shape and they are not
your rates. Take yours from your own contract note, which is the only document
that knows your plan, your segment and your state.

A worked round trip: buy five lakh of an intraday equity position and sell it the
same day, so turnover is five lakh a side and ten lakh in total.

| Line | Rate used | Base | Amount |
|---|---|---|---|
| Brokerage | 0.03 percent, capped at 20 per order | 5,00,000 a side | 40 |
| Exchange transaction charge | 0.00325 percent | 10,00,000 | 32.50 |
| Regulator turnover fee | 0.0001 percent | 10,00,000 | 1.00 |
| Tax on services | 18 percent | 73.50 of charges | 13.23 |
| Securities transaction tax | 0.025 percent | 5,00,000, sell side only | 125.00 |
| Stamp duty | 0.003 percent | 5,00,000, buy side only | 15.00 |
| **Round trip total** | | | **226.73** |

Two readings of that total, and both are useful:

- **As a percentage of turnover:** 226.73 on 10,00,000 is 0.0227 percent per fill.
- **As money per round trip:** about 227, or about 113 per fill.

Now the declaration can hold it:

```
// 0.023 percent per fill: the round trip stack above, divided between the two
// fills, rounded up rather than down. Rates are from the contract note of
// 2026-04, in the intraday equity segment, and need rechecking when they change.
strategy("Costed", commissionType = "percent", commission = 0.023, slippage = 1)
```

Or, when the order size is stable enough that a flat figure is honest:

```
strategy("Costed", commissionType = "perTrade", commission = 113, slippage = 1)
```

The comment is not decoration. A cost setting with no note of where its number
came from is a number nobody will dare to change, which means it will be wrong for
years.

### What a single number cannot capture

Two things, and both are worth knowing rather than hiding:

**One-sided taxes.** A percentage applied to every fill charges the sell-side tax
on the buy as well. Over a round trip the total comes out right; per trade it is
smeared across both sides. That is fine for an equity curve and wrong for a
question like "what does one extra entry cost me", so answer that question with
the arithmetic above rather than with the engine's setting.

**Caps and tiers.** A brokerage plan that is the smaller of a percentage and a cap
is not a percentage. Work out which side of the cap your typical order sits on,
use that, and re-check it when your size changes. A strategy that grows into its
cap gets quietly cheaper, and one that shrinks out of it gets quietly dearer.

## Make the script refuse a trade that cannot pay for itself

The most valuable thing a cost model does is not correcting the equity curve after
the fact. It is stopping the trade. A strategy that knows what a round trip costs
can decline the trades whose expected move does not clear it, and that filter is
often worth more than any change to the entry rule.

```
version 1

strategy("Only trade what can pay for itself", overlay = true, precision = 2,
         capital = 500000, qty = 1, qtyType = "lots",
         product = "intraday", closeOnSessionEnd = true,
         fillOn = "nextOpen", slippage = 1,
         commissionType = "percent", commission = 0.023)

costPercent = input(0.046, "Round trip cost, percent of one side", min = 0, max = 2)
slipTicks   = input(2,     "Ticks given up per round trip", min = 0, max = 40)
edgeMult    = input(3.0,   "Require the target to be this many times the cost", min = 1, max = 20)
targetMult  = input(2.0,   "Target, in ATR", min = 0.2, max = 20)

atrValue = atr(14)
tick     = orElse(chart.tickSize, 0)

// The cost of a round trip expressed in price, so it can be compared with a
// move in price. Charges scale with the price; slippage does not.
costInPrice = close * costPercent / 100 + slipTicks * tick
target      = targetMult * atrValue

// An ordered comparison against an absent value is absent, and an absent
// condition takes the false branch, so this one test also covers warmup.
worthIt = target > edgeMult * costInPrice

fast   = ema(close, 9)
slow   = ema(close, 21)
goLong = crossUp(fast, slow)
goFlat = crossDown(fast, slow)

if goLong and worthIt and pos.isFlat and session.isOpen
    buy(qty = 1, tag = "entry")
    exit(tag = "entry", profit = target, loss = atrValue)
else if goFlat and pos.isLong
    close()

plot(fast, "Fast", aqua)
plot(slow, "Slow", orange)

// The two quantities the filter compares, on their own pane, so a run that takes
// no trades explains itself at a glance.
plot(target, "Target", lime, overlay = false)
plot(edgeMult * costInPrice, "Cost hurdle", red, overlay = false)
```

The plot at the bottom is the part to keep. When a costed strategy stops trading,
the first question is always whether the entry rule stopped firing or the cost
filter started refusing, and two lines on a pane answer it without a single print
statement.

## A costs panel

Reading the report is right at the end of a run. While you are working, put the
numbers on the chart.

```
version 1

strategy("Cost panel", overlay = true, precision = 2,
         capital = 500000, qty = 1, qtyType = "lots",
         fillOn = "nextOpen", slippage = 1,
         commissionType = "percent", commission = 0.023)

costPercent = input(0.046, "Round trip cost, percent of one side", min = 0, max = 2)

lotUnits  = max(orElse(chart.lotSize, 1), 1)
tripValue = close * lotUnits
costTrip  = tripValue * costPercent / 100

paid  = pos.tradeCount * costTrip
gross = pos.netProfit + paid

panel = table("Costs", 4, 2, position = "bottomRight", textColor = silver)

if bar.isLast
    cell(panel, 0, 0, "Closed trades")
    cell(panel, 0, 1, text(pos.tradeCount))
    cell(panel, 1, 0, "Cost per round trip")
    cell(panel, 1, 1, text(costTrip, 0))
    cell(panel, 2, 0, "Estimated costs paid")
    cell(panel, 2, 1, text(paid, 0))
    cell(panel, 3, 0, "Costs over gross profit")
    cell(panel, 3, 1, gross > 0 ? text(paid / gross * 100, 1) + " percent" : "no gross profit",
         textColor = gross > 0 ? silver : red)

fast = ema(close, 9)
slow = ema(close, 21)
goLong = crossUp(fast, slow)
goFlat = crossDown(fast, slow)

if goLong and pos.isFlat
    buy(qty = 1, tag = "entry")
else if goFlat and pos.isLong
    close()

plot(fast, "Fast", aqua)
plot(slow, "Slow", orange)
```

The last row is the one to watch. Costs over gross profit is the share of what the
idea earned that went to somebody else. Below about a fifth, the strategy owns its
returns. Above a half, you are running a business whose main customer is the cost
stack, and the fix is fewer and larger trades rather than a better entry.

## What still differs from the live account

Even a fully costed backtest is a model. These are the gaps that remain, so you
recognise them when the live account underperforms:

| Gap | Why it exists | What to do |
|---|---|---|
| Queue position | A backtest does not know how many orders were ahead of yours at that price | Assume resting limit fills are optimistic |
| Partial fills | A backtest fills the whole order or none of it | Size below the visible depth |
| Market impact | Your own order moves the price, and the historical bars did not contain it | Trade smaller than you think you can |
| Rejections | Margin, product and permission refusals happen live and never in history | Handle OS7014 rather than assuming a fill |
| Carry and funding | Holding overnight costs money that a bar series does not show | Account for it outside the strategy, per position per night |
| Missed bars | A live script that was not running took no trades | Compare the trade list, not just the curve |

**Not raised yet.** OS7014 is in the catalogue and nothing raises it: a
destination's own refusal is folded into the ledger row as a status and its
text, and is reported against no line.

None of these is an argument against backtesting. They are the reason a backtest
result is a hypothesis and a sandbox run is the test of it, which is why the same
script runs in all three places without being rewritten.

## Pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Wonderful equity curve, terrible live account | Costs left at zero | Fill in the stack, then rerun |
| The edge halves when slippage goes from one tick to two | The edge was fill quality | Trade a slower version of the idea |
| Every stop in the report filled exactly at its level | The gap days are the exception and you have not looked at them | Sort the trade list by the gap between the level and the fill |
| Cost per trade looks too small | `"perTrade"` charged once per round trip instead of per fill | Run one round trip and read the report |
| Intraday results are good and overnight ones are not | Carry and product type | Set `product` correctly and account for carry |
| Costs changed and the results did not | The cost number is a literal nobody dares touch | Make it an `input` with a comment on its source |

## See also

- [overview.md](./overview.md) for the declaration options named here
- [orders.md](./orders.md) for the order kinds whose fills these assumptions cover
- [reading-the-books.md](./reading-the-books.md) for the ledger every one of these fills lands in
- [position-and-sizing.md](./position-and-sizing.md) for the turnover these costs are charged on
- [exits-and-brackets.md](./exits-and-brackets.md) for the levels whose exits fill where this page says they do
- [../../spec/language.md](../../spec/language.md) for `fillOn`, `slippage` and the commission options
- [../../examples/10-strategy-ema-cross.oscript](../../examples/10-strategy-ema-cross.oscript) for a declaration with the cost model filled in
