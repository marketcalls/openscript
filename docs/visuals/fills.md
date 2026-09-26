# Fills

By the end of this page you will be able to shade the region between two plots,
give each side of a crossing its own colour, control how solid the shading is,
and shade between a plot and a fixed value.

A **fill** is the region between two plotted columns, painted. It costs no plot
slot of its own: it names two columns that already exist and tells the chart to
colour the space between them.

---

## Why a filled region reads where two lines do not

This is worth a paragraph because it is the reason the call exists, and because
knowing it tells you when to reach for a fill and when not to.

Two lines on a chart ask the reader to do work. To know whether the fast average
is above the slow one at some point on the left of the screen, the reader has to
find both lines at that horizontal position, decide which is which by colour,
and compare their heights. That is three operations, repeated for every part of
the chart they look at, and at a glance from two feet away it does not happen at
all.

A filled region between them does the work once and turns it into a colour. The
band is green where the fast line leads and red where the slow one does, and the
reader sees the answer in the same instant they see the chart, without tracing
anything. The width of the band carries a second fact for free: how far apart
the two lines are, which is the thing a reader would otherwise have to estimate.

The same argument applies to a volatility band, where the band's thickness is
the reading and the two edges are incidental, and to an oscillator shaded to its
midline, where the shaded mass above and below is the story.

It does not apply to two unrelated series that happen to share a pane. Shading
between them invents a quantity, the gap, that means nothing, and the reader has
to work out that it means nothing. Fill between two lines only when the region
between them is itself a fact.

---

## The call

```
fill(plotA, plotB,
     color = ...,
     colorUp = none,
     colorDown = none,
     opacity = 1,
     overlay = none)
```

| Argument | Type | Default | Means |
|---|---|---|---|
| `plotA` | a plot handle | required | The first column. "Up" is measured against this one |
| `plotB` | a plot handle | required | The second column |
| `color` | `color` or `series color` | the host's choice | One colour for the whole band |
| `colorUp` | `color` or `series color` | `none` | The colour where `plotA` is above `plotB` |
| `colorDown` | `color` or `series color` | `none` | The colour where `plotB` is above `plotA` |
| `opacity` | `number` | `1` | A dimmer over the colours, 0 to 1 |
| `overlay` | `bool` | the declaration's | `true` draws the band on the price pane |

`fill` is top level only, like `plot` and `level`. It declares part of the fixed
shape of the study, so it cannot be wrapped in an `if`. To make a band appear
and disappear, give it an absent colour on the bars where it should be off, as
shown further down.

---

## A fill names plots, not series

The two positional arguments are **plot handles**, which is what `plot` returns.
So a band is written in three lines, not one:

```
pUpper = plot(basis + band, "Upper", aqua)
pLower = plot(basis - band, "Lower", aqua)
fill(pUpper, pLower, color = aqua, opacity = 0.08)
```

The reason is worth knowing because it explains several other things on this
page. In the compiled program a fill is a declaration holding two plot keys and
some colours. It has no values of its own and no channel of its own. The region
is derived, every bar, from the two columns the plots already carry.

Three consequences follow directly:

- **A fill inherits its ends' warmup.** If both averages are absent until bar 20,
  the band starts at bar 20 with no code from you. You never write a warmup
  guard for a fill.
- **A fill costs nothing per bar** beyond a per-bar colour, if you use one.
- **You cannot fill to something that is not a plot.** A level is not a plot. A
  bare number is not a plot. The workaround is one line and is covered below.

---

## One colour

The simplest band: one colour, one opacity, both ends the same.

```
version 1

study("Bollinger band", overlay = true, precision = 2)

len  = input(20,  "Length", min = 2, max = 500)
mult = input(2.0, "Deviations", min = 0.1, max = 10)

b = bollinger(close, len, mult)

pUpper = plot(b[1], "Upper", fade(aqua, 45))
pLower = plot(b[2], "Lower", fade(aqua, 45))
plot(b[0], "Basis", orange, width = 2)

// The band's thickness is the reading here, so the shading carries it and the
// two edges are faded back out of the way.
fill(pUpper, pLower, color = aqua, opacity = 0.07)
```

Note the hierarchy: the basis is the heavy line, the edges are faint, and the
shading is fainter still. A band drawn with three equally strong elements is
three things competing for attention where there is only one reading.

---

## Two colours, for which side leads

`colorUp` and `colorDown` replace `color` when the two ends cross each other.

**`colorUp` is the colour where the first plot is above the second.** That is
the only thing to remember, and it is worth writing in a comment the first few
times, because a band that is green on the wrong side is a picture that says the
opposite of what you meant and looks entirely plausible while doing it.

```
version 1

study("EMA cross, shaded", overlay = true, precision = 2)

fastLen = input(9,  "Fast length", min = 1, max = 500)
slowLen = input(21, "Slow length", min = 1, max = 500)

fast = ema(close, fastLen)
slow = ema(close, slowLen)

pFast = plot(fast, "Fast", aqua,   width = 2)
pSlow = plot(slow, "Slow", orange, width = 2)

// pFast is the first argument, so colorUp is the colour where the FAST average
// is the higher of the two.
fill(pFast, pSlow, colorUp = fade(lime, 85), colorDown = fade(red, 85))

if crossUp(fast, slow)
    signal("BUY", at = "below", shape = "triangleUp")

if crossDown(fast, slow)
    signal("SELL", at = "above", shape = "triangleDown")
```

The band and the markers say the same thing at two different distances. The
markers tell you the exact bar when you are looking closely. The band tells you
the regime from across the room. Neither replaces the other.

Both colours accept a series, exactly like a plot's colour, so a band can carry
a second dimension: which side leads decides the hue, and how far apart the
lines are decides the strength.

---

## Opacity

Two different places can carry transparency for a fill, and they do not do the
same job.

| Where | Range | What it is for |
|---|---|---|
| `opacity` | 0 to 1, 1 is solid | A dimmer over the colours. The default is 1, so it changes nothing until you set it |
| The colour itself, via `fade` or `rgba` | `fade` takes 0 to 100 transparency, `rgba` takes 0 to 1 alpha | How see-through this particular colour is |

**Pick one and leave the other alone.** A band faded twice is a band nobody can
see, and worse, the next person to open the script cannot tell which of the two
numbers to change. For a band with one colour, use `opacity` and pass a plain
colour. For a band with `colorUp` and `colorDown`, put the transparency in the
colours so the two sides can differ, and leave `opacity` at its default.

A band's usual translucency does not come from `opacity`, which starts at 1 and
leaves the colour as written. It comes from the colour: name no colour at all
and the band is `plotA`'s colour faded to twelve percent. That number is low on
purpose. A fill sits above the candles on a price pane, and the candles are what
the trader is actually reading, so a band at half strength turns the instrument
into a smear. Whichever of the two you set it with, keep a band near a tenth of
solid, and if you find yourself much past a fifth, check whether the thing you
want is really a `background` wash rather than a band.

---

## Where a fill stops

A fill stops wherever either of its ends has no value, and resumes where both
come back. That is the same gap rule that breaks a line, applied to a region,
and it has three everyday uses.

**Warmup.** Neither end exists yet, so the band starts where the data does. No
code.

**A conditional band.** Make one end absent on the bars where the band should be
off. This is the shape to use when the band's edges should disappear too:

```
version 1

study("Session range", overlay = true, precision = 2)

var sessionHigh = none
var sessionLow  = none

if session.isFirstBar
    sessionHigh = high
    sessionLow  = low
else
    sessionHigh = max(sessionHigh, high)
    sessionLow  = min(sessionLow, low)

// Outside the session both ends are absent, so the two lines stop and the band
// between them stops with them. No guard is written anywhere.
inSession = session.isOpen

pHigh = plot(inSession ? sessionHigh : none, "Session high", aqua,   style = "step")
pLow  = plot(inSession ? sessionLow  : none, "Session low",  orange, style = "step")

fill(pHigh, pLow, color = aqua, opacity = 0.09)
```

**A band that switches off while its edges stay.** Give the fill's colour the
absent value instead. An absent colour reaching a drawing surface is a gap, not
an error, so the band simply is not painted on those bars while both lines carry
straight on:

```
version 1

study("Squeeze", overlay = true, precision = 2)

len = input(20, "Length", min = 2, max = 500)

b = bollinger(close, len, 2)
k = keltner(len, 1.5, len, "ema")

// The deviation band has contracted inside the range band: the instrument is
// coiled. This is a state, so it is shading rather than a fourth line.
squeezed = b[1] < k[1] and b[2] > k[2]

pUpper = plot(b[1], "Upper", fade(aqua, 40))
pLower = plot(b[2], "Lower", fade(aqua, 40))

// The two lines are always drawn. Only the shading switches off, because the
// colour is absent on the bars where the condition does not hold.
fill(pUpper, pLower, color = squeezed ? orange : none, opacity = 0.18)
```

During warmup `b[1] < k[1]` is absent, `and` propagates it, and the ternary's
absent condition takes the false branch, so `squeezed` is effectively off there.
It does not matter: both ends are absent too, so nothing would be painted
anyway.

**A colour per bar needs a chart that can take one.** The language carries a
band's colour per bar, and the chart adapter in this repository draws it bar by
bar on a chart from version 2.5.4 on: each bar is shaded in the colour the
script computed there for the side the band is on, an absent colour leaves that
bar unshaded, and `opacity` dims the computed colour exactly as it dims a
constant one. An older chart's band takes one colour for each side for the
whole run, so on one, or on a host that does not say which chart it has, the
adapter refuses a program whose band colour is computed per bar before any bar
runs, with OS6024, rather than drawing the band in a colour the script did not
choose. If your host refuses it, switch the band off by plotting its edges
absent instead, as in the session example above, which every chart draws.

---

## Filling between a plot and a level

`level` draws a horizontal line. It is not a plot, it has no column of values in
the contract, and `fill` names two plot keys. So a level cannot be one end of a
fill, and there is no argument that makes it one.

The fix is one line: **plot the constant as a second column, and make it
invisible if you do not want the line.** A number used where a series is
expected is broadcast to every bar, so `plot(50, ...)` is a legal, constant
column.

```
version 1

study("RSI, shaded to the midline", precision = 2, range = [0, 100])

len = input(14, "Length", min = 2, max = 200)

r = rsi(close, len)

level(70, "Overbought", fade(red, 40))
level(30, "Oversold",   fade(lime, 40))

pOsc = plot(r, "RSI", purple, width = 2)

// A level cannot be one end of a fill, so the midline is plotted instead. It is
// fully transparent, so it costs a legend entry and draws no line: fade takes
// transparency and 100 is invisible.
pMid = plot(50, "Midline", fade(gray, 100))

fill(pOsc, pMid, colorUp = fade(lime, 86), colorDown = fade(red, 86))
```

This reads better than three lines at 70, 50 and 30 with nothing between them,
because the shaded mass above and below the midline is exactly the quantity an
oscillator is measuring.

Why not give `fill` a version that takes a number? Because the same picture
would then have two spellings with different capabilities, one of which could
not be restyled by the user from the settings dialog, could not appear in the
legend, and could not be given a per-bar value later when the "constant" turns
out to want to move. Plotting the constant costs one line now and costs nothing
later when the level becomes a session VWAP.

The same technique shades a plot to a moving reference that is not a level at
all: a session open, a previous close, an entry price. Plot the reference, fade
it as far as you want, and fill to it.

---

## Which pane

A fill lands in the pane the declaration chose, and `overlay = true` moves it to
the price pane. The one rule to respect is that **a fill and the two plots it
names have to end up in the same pane**, because a region between two columns in
different panes is not a region.

If you move a plot onto the price pane with `overlay = true`, move its partner
and the fill with it:

```
pA = plot(spanA, "Span A", lime, offset = 26, overlay = true)
pB = plot(spanB, "Span B", red,  offset = 26, overlay = true)
fill(pA, pB, colorUp = fade(lime, 88), colorDown = fade(red, 88), overlay = true)
```

An offset works the same way: both ends of a band that is drawn 26 bars forward
carry `offset = 26`, and the region moves with them.

---

## Recipes

| Picture | How |
|---|---|
| A volatility band | Two plots for the edges, `fill(..., color = c, opacity = 0.07)` |
| A cross, shaded by which side leads | `fill(a, b, colorUp = ..., colorDown = ...)` |
| An oscillator shaded to its midline | Plot the midline at `fade(colour, 100)`, then fill to it |
| A band only while a condition holds | `color = cond ? c : none` |
| A band that appears and disappears with its edges | Make one end `none` on the off bars |
| The shading without the edges | Plot both edges at `fade(colour, 100)` |
| A displaced cloud | Both plots and the fill carry the same `offset` |
| A band on the price pane from a study with its own pane | Both plots and the fill carry `overlay = true` |

---

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| `fill(fast, slow, ...)` passing series, not handles | The arguments are plot handles | Assign the plots to names and pass those |
| `colorUp` on the wrong side | A picture that says the opposite, convincingly | `colorUp` is where the **first** argument is above the second |
| `fade` on the colour and a raised `opacity` | A band nobody can see, and two numbers to guess between | Use one or the other |
| Wrapping `fill` in an `if` | OS3006 | Give the colour `none` on the off bars |
| OS6024 naming a band's colour computed per bar | The host's chart takes one colour per side for the whole run, or the host did not say which chart it has | Run it on a host with a newer chart, or make the band's edges absent on the off bars instead |
| Filling to a `level` | There is no argument for it | Plot the constant, at full transparency if it should not show |
| One end on the price pane, the other in the study's pane | Not a region | Give both plots and the fill the same `overlay` |
| Shading between two unrelated series | Invents a quantity that means nothing | Only fill where the gap is itself a fact |

---

## See also

- [overview.md](./overview.md) for the map of every drawing surface and the decision table that picks between them
- [plots.md](./plots.md) for the two columns every fill names: their styles, colours, offsets and panes
- [levels.md](./levels.md) for horizontal reference lines, and why a level is not a column a fill can name
- [lines-and-boxes.md](./lines-and-boxes.md) for a shaded zone that is a drawn object rather than a band between two columns
- [tables.md](./tables.md) for readings that belong in a corner panel rather than on the pane
- [../README.md](../README.md) for the rest of the documentation
- [../../spec/stdlib.md](../../spec/stdlib.md) section 14.2 for the authoritative signature of `fill`, and section 11 for `fade`, `rgba` and `mix`
- [../../spec/language.md](../../spec/language.md) section 6.7 for why an absent colour is a gap rather than an error
- [../../examples/01-ema-cross.oscript](../../examples/01-ema-cross.oscript) and [../../examples/03-anchored-vwap.oscript](../../examples/03-anchored-vwap.oscript) for complete scripts that shade a band
