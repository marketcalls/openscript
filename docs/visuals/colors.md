# Colours

By the end of this page you will be able to name a colour, build one from
channels, make it transparent by the right amount for the surface it lands on,
vary it with a value and vary it per bar, and pick a palette that stays legible
whether the reader's chart is light or dark.

## Naming a colour

Nineteen names are built in, written bare with no prefix:

```
aqua     black   blue    brown   fuchsia  gray     green   lime
maroon   navy    olive   orange  pink     purple   red     silver
teal     white   yellow
```

They are bare because a colour appears in almost every line that draws
something, and a prefix on a fixed vocabulary of nineteen words is pure noise.
They are ordinary globals rather than keywords, so the library can add more
later without a grammar change, and so assigning to one is the ordinary
shadowing error (OS2002) rather than a special case.

Their exact channel values are fixed in the library manifest and are part of the
conformance suite. That is the reason to prefer a name over a hex literal you
half remember: `aqua` is the same four numbers on every engine that runs your
script.

The other two forms are hex:

```
#ff8800             // 24 bit, fully opaque
#ff880080           // 32 bit, the last byte is alpha
```

A hex literal compiles to four numbers, red, green and blue from 0 to 255 and
alpha from 0 to 1, rather than to a string. `#ff880080` becomes an alpha of 128
divided by 255 computed once, in binary64, so two engines cannot end up one part
in 255 apart because each parsed the byte its own way.

Two colours are equal when all four channels match, so `aqua == aqua` is true
and a faded colour is not equal to the colour it came from.

## Building one from components

| Call | Returns | For |
|---|---|---|
| `rgb(r, g, b)` | `color` | Channels 0 to 255, fully opaque |
| `rgba(r, g, b, a)` | `color` | The same with alpha 0 to 1, where 1 is opaque |
| `fade(color, percent)` | `color` | The same colour at `percent` transparency, where 100 is invisible |
| `withAlpha(color, a)` | `color` | The same colour at a stated alpha, 0 to 1 |
| `mix(a, b, weight)` | `color` | Blend of two colours, `weight` 0 gives `a` and 1 gives `b` |
| `alpha(color)` | `number` | Read a colour's alpha, 0 to 1 |

`hsl(h, s, l)` and `gradient(value, from, to, colorFrom, colorTo)` are named in
the library reference as planned. They are listed rather than omitted so that a
gap is visibly known instead of looking forgotten; until they land, `mix` with a
weight you compute yourself does the work of `gradient`, and this page shows how.

A channel argument outside its range is OS4009, not a clamp. A colour computed
from data that lands at 300 is a bug in the computation, and clamping it would
draw a plausible picture from a broken number. Where a computed channel can
legitimately run past the end, say so in the script with `clamp`, which is one
call and puts the decision where a reader can see it.

**Not raised yet.** OS4009 is in the catalogue and nothing raises it: a channel
outside its range reaches the chart rather than stopping the bar.

## Transparency, and the two conventions

This is the one part of the colour surface that catches everybody once.

**`fade` takes transparency. `withAlpha` takes opacity. They run in opposite
directions.**

| Call | 0 means | 100 or 1 means |
|---|---|---|
| `fade(color, percent)` | Fully opaque | Invisible |
| `withAlpha(color, a)` | Invisible | Fully opaque |

`fade` follows the way a chart's own style controls are labelled, which is why
it is the one most scripts use and the one the examples are written with.
`withAlpha` exists because a script that computes an alpha from data is usually
computing an opacity, and forcing it to write `fade(c, (1 - a) * 100)` would be
a subtraction in every such line.

Sensible starting values, because the right amount of transparency depends
entirely on what the colour lands on:

| Surface | Typical | Why |
|---|---|---|
| A plotted line | opaque, or `fade(c, 20)` for a secondary line | A line is thin: transparency mostly costs legibility |
| A fill between two plots | `fade(c, 85)` to `fade(c, 95)` | It covers a large area over the candles |
| A box fill | `opacity = 0.08` to `0.15` | The same, and a box often overlaps other boxes |
| A pane background | `fade(c, 90)` or more | It covers the full height of the bar, behind everything |
| A table background | `fade(black, 25)` | It sits over the price pane and should still let it through |
| A label plate | opaque | The text has to be readable against it |

The rule behind the table: **the bigger the area, the more transparent it has to
be.** A fill at 50 percent transparency looks reasonable in a screenshot of
twenty bars and turns the chart into a wash at two hundred.

## Colour that varies with a value

`mix` positions a colour between two others. The weight is yours to compute,
which means it is yours to normalise and yours to bound:

```
version 1

study("Volume heat", overlay = true)

lookback = input(20, "Average over", min = 2, max = 500)
hottest  = input(3.0, "Ratio that counts as hot", min = 1.5, max = 10)

ratio = volume / sma(volume, lookback)

// The weight is clamped rather than left to run past 1, because mix takes a
// position between two colours and a position of 4 is not one. Clamping here
// says what the script means; clamping inside the renderer would hide it.
weight = isNone(ratio) ? none : clamp((ratio - 1) / (hottest - 1), 0, 1)

heat = isNone(weight) ? none : mix(fade(aqua, 40), red, weight)

barColor(heat)
plot(ratio, "Volume ratio", aqua, overlay = false)
```

Three things in that script generalise to every gradient you will write.

**Normalise first.** A colour weight is a fraction of the way between two
readings, so the raw value has to be divided by the range you consider
meaningful. Here that range is an input, because "hot" is a judgement, not a
constant.

**Clamp second.** A ratio has no upper bound and a weight does.

**Handle absence third.** `mix` given an absent weight has nothing to position,
and `barColor(none)` leaves the bar its own colour, which is exactly the right
picture during warmup: the study says nothing about bars it knows nothing about.

For a two-sided scale, mix from the middle out rather than end to end:

```
strength = rsi(close, 14)
weight   = isNone(strength) ? none : clamp(abs(strength - 50) / 50, 0, 1)
tint     = isNone(weight) ? silver :
           mix(silver, strength > 50 ? lime : red, weight)
```

That reads correctly at 50, where both sides are grey, which an end-to-end mix
between lime and red does not: it puts a muddy brown at the value the reader
cares about most.

## Colour that varies per bar

**A constant colour and a per-bar colour are the same argument.** Pass a `color`
and it lands on the plot's style. Pass a `series color`, an expression that
produces a colour each bar, and it lands on the contract's per-bar colour
callback instead.

```
m = macd(close, 12, 26, 9)
plot(m[2], "Histogram", color = m[2] > 0 ? lime : red, style = "histogram")
```

One argument covers both cases because a script that starts with one colour and
later wants two should not have to move to a different function. That is a
decision about the shape of the library, and it has a cost worth knowing: when
the colour argument is not constant the compiler allocates a second channel
beside the value and emits a colour per bar. A constant colour costs nothing per
bar; a computed one costs one more value per bar. That is cheap, and it is not
free, so a colour that never changes is written as a constant.

The same argument shape appears on the other surfaces:

| Surface | Constant | Per bar |
|---|---|---|
| `plot(value, title, color)` | Style colour | Per-bar colour callback |
| `fill(a, b, color)` | Band colour | Per-bar band colour |
| `signal(text, color)` | Marker plate | Not per bar: `color` is part of the marker's declaration, fixed before bar 0 (`stdlib.md` section 14.3) |
| `barColor(color)` | Every bar the same | The usual case |
| `background(color)` | Every bar the same | The usual case |
| `cell(..., textColor, bgColor)` | The cell's colour | Recomputed each time the cell is written |

A band's per-bar colour is the one row of that table that depends on the chart
drawing it: the chart adapter in this repository draws it on a chart new enough
to take one and refuses it with OS6024 on any other. [fills.md](./fills.md) says
which charts those are, and shows a band that switches itself off in a way
every chart draws.

`fill` also takes two colours rather than one:

```
version 1

study("Two sided band", overlay = true, precision = 2)

fastLen = input(9,  "Fast length", min = 1, max = 500)
slowLen = input(21, "Slow length", min = 1, max = 500)

fast = plot(ema(close, fastLen), "Fast", aqua,   width = 2)
slow = plot(ema(close, slowLen), "Slow", orange, width = 2)

// colorUp paints the band where the first plot leads, colorDown where the
// second does. Which side leads is the signal, so it gets a colour rather than
// being left for the reader to work out from which line is on top.
fill(fast, slow, colorUp = fade(lime, 88), colorDown = fade(red, 88))
```

`plot` returns a handle so that `fill` can name two of them. The handle is a
compile-time value: it cannot be stored in a `var` or passed to a function, and
that is the whole of its life.

## An absent colour paints nothing

`none` is a member of every type, including `color`, and every paint surface
treats it the same way: **an absent colour leaves the surface alone.**

```
barColor(paint ? (up ? lime : red) : none)     // the input switches it off
background(risky ? fade(red, 92) : none)       // only risky bars are shaded
plot(ready ? value : none, "Value", aqua)      // a gap, not a zero
```

Passing an absent colour is not an error, and it is not a fallback to a default.
It is how a conditional paint switches itself off, which means a script never
needs a separate call to clear one.

Watch for the interaction with absent conditions, because it is where a script
tells a lie without meaning to. A condition that is absent takes the false
branch, so `up ? lime : red` paints every warmup bar red and means it. What you
want is three states:

```
tint = isNone(up) ? none : (up ? lime : red)
barColor(tint)
```

Absent for "I do not know yet", lime for up, red for down. The chart then shows
its own candle colours across the warmup, which is the truth.

## Colours that survive a light and a dark chart

**A script cannot read the chart's theme.** There is no `chart.theme`, and
nothing in the `chart` namespace reports whether the background is light or
dark. That is not an oversight to work around: it means the colours you pick
have to work on both, and a study that only looks right on the theme its author
uses is a study half its readers will restyle or discard.

The rules that follow from it:

| Purpose | A choice that works on both | Why |
|---|---|---|
| A primary line | `aqua`, `orange`, `purple`, `fuchsia` | Mid-tone, saturated hues have contrast against both a near-white and a near-black background |
| A secondary line | `fade(silver, 50)` or `gray` | Grey reads as secondary on both themes |
| A line you want to disappear into the background | Nothing | There is no such colour on both themes at once. Use transparency instead of a near-background colour |
| Up and down | `lime` and `red`, plus a difference that is not colour | Colour alone excludes a reader who cannot separate red and green |
| Text on a coloured plate | A `textColor` chosen from the plate: `white` on `red` or `navy`, `black` on `lime` or `yellow` | The plate is the background for that text, and the plate does not change with the theme |
| A fill or a background | The colour at 85 to 95 percent transparency | The theme's own background shows through and does the work |

The two colours to be careful with are `white` and `black`. Each is invisible on
one of the two themes, so neither belongs on a line, a marker or a label anchor
where it is the only carrier of meaning. They are fine as a `textColor` on a
plate whose colour you chose, because there the background is the plate rather
than the chart.

"A difference that is not colour" is worth spelling out. Where two things must
be told apart, give them a second difference: a solid line against a dashed one,
a triangle up against a triangle down, a label above the bar against a label
below it. Then the picture still works for a reader who sees your lime and your
red as the same grey.

Finally, let the user override. Every `plot` gets a colour, opacity, thickness
and style row in the settings dialog whether or not the script asks for one, so
a reader can always restyle a plot. Where a colour is central to the study,
declare it as an input and pass it through:

```
version 1

study("Bands", overlay = true, precision = 2)

len       = input(20,   "Length", min = 2, max = 500)
mult      = input(2.0,  "Width, in deviations", min = 0.5, max = 5)
bandColor = input(aqua, "Band colour")

// One place that decides the palette, so the whole study restyles from four
// lines rather than from twelve scattered literals.
LINE_MAIN = bandColor
LINE_SOFT = fade(bandColor, 45)
BAND_WASH = fade(bandColor, 90)

b = bollinger(close, len, mult)

basis = plot(b[0], "Basis", LINE_MAIN, width = 2)
upper = plot(b[1], "Upper", LINE_SOFT)
lower = plot(b[2], "Lower", LINE_SOFT)

fill(upper, lower, BAND_WASH)
```

A `color` input takes over the style row the host would have generated for that
plot rather than adding a second one, so the user still has exactly one place to
change it. Naming the palette in `UPPER_SNAKE` at the top is the convention for
values a script treats as constants, and it is what turns a restyle from a
find-and-replace into an edit of three lines.

## Common mistakes

| Symptom | Cause | Fix |
|---|---|---|
| A fill covers the candles | Transparency too low | `fade(c, 88)` or higher for a band |
| Nothing is drawn at all | `fade(c, 100)` | 100 is invisible; `fade` takes transparency, not opacity |
| Every warmup bar is painted the "down" colour | An absent condition taking the false arm | `isNone(cond) ? none : (cond ? up : down)` |
| OS4009 on an `rgb` call | A channel computed past 255 | Fix the computation, or `clamp` it and say why |
| The study is invisible on a dark chart | `black` used as a line colour | `gray` or `silver`, or a mid-tone hue |
| The label text cannot be read | `textColor` picked for the theme rather than the plate | Choose the text colour from the plate colour |
| Two colours look identical when printed | Colour is the only difference | Add a line style, a shape or a position difference |
| A gradient is muddy in the middle | Mixing end to end across a neutral midpoint | Mix from the middle outwards on each side |

**Not raised yet.** OS4009 is in the catalogue and nothing raises it: a channel
outside its range reaches the chart rather than stopping the bar.

## See also

- [overview.md](./overview.md) for the map of every drawing surface and what each one costs
- [bar-coloring-and-backgrounds.md](./bar-coloring-and-backgrounds.md) for the two surfaces that take a colour per bar and nothing else
- [tables.md](./tables.md) for cell and grid colours
- [labels-and-shapes.md](./labels-and-shapes.md) for plate and text colours on markers and labels
- [lines-and-boxes.md](./lines-and-boxes.md) for line, border and fill colours on drawing objects
- [plots.md](./plots.md) for the per-bar colour argument on a plot in full
- [fills.md](./fills.md) for the two-sided band colours built here
- [../README.md](../README.md) for the rest of the documentation
- [../../spec/stdlib.md](../../spec/stdlib.md) section 11 for the authoritative colour reference
- [../../spec/language.md](../../spec/language.md) section 3.8 for the literal forms
- [../../examples/02-supertrend.oscript](../../examples/02-supertrend.oscript) for a study whose colour carries the state
- [../../examples/01-ema-cross.oscript](../../examples/01-ema-cross.oscript) for a faded band between two plots
