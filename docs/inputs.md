# Inputs

By the end of this page you can give any study or strategy a settings dialog a
reader drives without ever opening the source: the right control for every kind
of value, rows that are grouped and explained, bounds the dialog enforces before
a bad number reaches your calculation, defaults that are right on the first
chart the study lands on, and a clear line between what belongs in the dialog
and what belongs fixed in the script.

## One call, three things

`input()` declares a tunable value. Every call does three things at once.

1. It assigns a name the script reads, exactly like any other assignment.
2. It builds one row of the settings dialog the host generates.
3. It names a slot in the saved layout, so a value the reader typed comes back
   when the chart is reopened tomorrow.

```
version 1

study("Simple average", overlay = true, precision = 2)

len = input(20,    "Length", min = 2, max = 500)
src = input(close, "Source")

plot(sma(src, len), "Average", aqua, width = 2)
```

Two lines of declaration, two rows of dialog, and a study that works on any
instrument at any interval without anyone editing it.

**The default comes first, before the title.** The default fixes the input's
type: `input(20, ...)` is a number input because `20` is a number, and
`input(true, ...)` is a switch because `true` is a bool. There is no `type`
argument to get wrong and no annotation to keep in step with the value. A reader
scanning a column of inputs reads the values, which is what they came for.

The title is the second positional argument. It defaults to the name the input
assigns, and you should write it anyway: `len` is a fine name in source and a
poor label in a dialog.

**The title is also what the value is filed under** when there is no name to file
it under, which is the next section. Write it as a string literal on the line;
the compiler reads it from there rather than folding it, so `input(2, "Off" +
"set")` is OS3021 and not a row labelled Offset.

## Where input() may appear

**At the top level of the file, and nowhere else.** Not inside an `if`, not
inside a loop, not inside a `fn` body. Writing one anywhere else is OS3007.

```
// OS3007
if useBand
    bandLen = input(20, "Band length")

// correct
bandLen = input(20, "Band length")
if useBand
    band = sma(close, bandLen)
```

The reason is the whole design of the dialog. The dialog is built once, before
bar 0 runs, from the `input()` calls the compiler can see without executing
anything. An input inside a block would exist on some bars and not others, so
the dialog would have to grow and shrink as data arrived, and a value the reader
saved last week would have nothing to attach to when the study reloaded.

The same rule pushes one step further: **the default must be a compile-time
constant**, meaning a literal, arithmetic over literals, or another `input()`.
A default that depends on bar data is OS3003.

```
lookback = input(round(close / 100), "Lookback")   // OS3003
lookback = input(20, "Lookback", min = 2)          // correct
```

An `input()` may itself be the value of a declaration option, which is how a
reader gets to change something the declaration decides:

```
study("Oscillator", precision = input(2, "Decimals", min = 0, max = 10))
```

The input has to be the whole of the value. `precision = decimals + 1`, or
`opacity = shade ? 1 : 0` over a checkbox, is OS3025: an option fixed before the
first bar holds a value or one setting, and an expression over a setting is
neither. Declare the setting as the option itself instead, a slider from 0 to 1
for an opacity rather than a checkbox computed into one.

It may also be written inside the expression argument of a higher timeframe read,
where a setting is the one thing from this file that has a meaning: it resolves
before bar 0 and holds for the run, while a value computed on this chart's bars
has no counterpart on the requested ones and is OS6003.

```
bias = req.timeframe("1D", ema(close, input(20, "Bias length")))
```

## What a saved value is filed under

A host stores one value per input, and the key it files it under is **the name
the input was assigned to**, or, where it was assigned to none, **the title**.

That matters the day you edit the file. The key survives every edit that is not a
rename of the row, so inserting a tunable above another one, deleting one or
moving them around leaves every reader's stored value exactly where they put it.
Renaming a row is the one edit that loses its value, which is the honest
behaviour: the row a value was stored for is gone.

```
len = input(20, "Length")                      // filed under len
study("B", precision = input(2, "Decimals"))   // filed under Decimals
var start = input(0, "Start")                  // filed under start
```

Because the title is a key, two rows cannot carry the same one: that is OS3017.
A title that spells another input's name is the same clash from the other side
and is OS3022. And an input with neither a name nor a title has nothing to be
filed under at all, which is OS3021. Writing the title as an empty string reaches
the same dead end by a different edit, and it carries a code of its own, OS3024,
so that the sentence you are handed is about the line you wrote rather than
telling you to write the title you have already written.

```
study("Range", precision = input(2))              // OS3021, no title at all
study("Range", precision = input(2, ""))          // OS3024, a title saying nothing
study("Range", precision = input(2, "Places"))    // correct
```

**A named input is not this, and is not refused.** It has a key already, so its
title is only the dialog label, and an empty one is read as no title: the row
takes the name, exactly as it does when the title is left out.

```
len = input(14, "")   // one row, labelled len, the same as input(14)
```

## var in front of an input

`var len = input(14, "Length")` is an ordinary `var` whose initial value is the
setting. The cell is initialised on the first bar and keeps whatever the script
puts in it after that, which is how a running total starts from a setting:

```
var tally = input(0, "Start")
tally = tally + 1
plot(tally, "Bars so far")
```

A setting cannot change during a run, so a `var` nothing assigns to holds exactly
what the plain form holds. What the word buys is the assignment, and the price is
that the name is no longer the setting: a `var` may be changed by a later line,
so it is not a compile-time constant and cannot be a declaration option (OS3003)
or be read inside a higher timeframe read (OS6003). Write the plain form when you
want the setting itself, and the `var` when you want a value that starts there.

## The kinds, and the control each one renders as

There is one function. The kind of control follows the type of the default.
Two kinds are both spelled with a string default, so a `kind` argument separates
them.

| Written as | Kind | Control the dialog renders | The script gets |
|---|---|---|---|
| `input(14, "Length")` | number | A number field with a stepper | `number` |
| `input(true, "Show the band")` | boolean | A checkbox | `bool` |
| `input("long", "Note")` | text | A single line text field | `string` |
| `input("fast", "Mode", options = ["fast", "slow"])` | select | A dropdown over the listed values | `string` |
| `input(aqua, "Band colour")` | color | A colour swatch with an opacity control | `color` |
| `input(close, "Source")` | source | A dropdown of the price series | `series number` |
| `input("60", "Bias timeframe", kind = "interval")` | interval | A dropdown of the intervals the host can serve | `string` |
| `input("2025-01-01 09:15", "Anchor", kind = "time")` | time | A date and clock picker | `number` |
| `input("", "Second leg", kind = "symbol")` | text (planned) | An instrument picker | `string` |
| `input(0.0, "Level", kind = "price")` | number (planned) | A price set by clicking the chart | `number` |
| `input("0915-1530", "Window", kind = "session")` | text (planned) | Two clock fields | `string` |

The last three are named but not in the first release. Until they land, use a
plain text input and validate what you get.

### A number

The workhorse. The bounds and the step that
[../spec/stdlib.md](../spec/stdlib.md) section 13.3 gives a number input shape
the control, and are enforced before your calculation ever sees the value.

```
atrLen = input(14,  "ATR length",     min = 1,   max = 200, step = 1)
mult   = input(3.0, "Band, in ATR",   min = 0.5, max = 20,  step = 0.1)
risk   = input(5000, "Risk per trade", min = 1)
```

Give `min` and `max` on every number input that feeds a length. A length must be
a whole number of 1 or more; a fractional or zero length is rejected rather than
rounded, because a length of 14.5 is a bug and rounding it hides the bug. If the
dialog carries no bounds, the first check happens inside `sma()` on bar 0 and the
reader gets a run-time failure (OS4003) instead of a field that refuses to go
below 1.

`step` decides the stepper's increment, not the validity of a typed value. A
multiplier with `step = 0.1` still accepts `2.35` if the reader types it.

### A switch

A bool default renders as a checkbox. Use it for the optional half of a study.

```
showBands = input(true,  "Show the bands")
paint     = input(false, "Recolour the candles")

plot(showBands ? upper : none, "Upper", aqua)
barColor(paint ? (dir == 1 ? lime : red) : none)
```

Note what the switch is gating: the drawing, not the calculation. A `plot` may
not sit inside an `if` (OS3006), so a switch hides a plot by feeding it the
absent value, which draws a gap. A switch must also not be used to skip a
stateful call, because a call that is not executed on a bar leaves its series
absent for that bar and its state unadvanced, which is warning OS8001 and a
broken line. Compute unconditionally at the top level, then let the switch decide
what is drawn.

### Free text

A string default with no `options` and no `kind` is a plain text field: the right
control for a label, a note on a drawing, or any value the script parses itself.

```
noteText = input("watch this level", "Zone note")
```

### A choice

Add `options` and the same string default becomes a dropdown. The default has to
be one of the listed values, or the dialog would open with nothing selected and
the script would hold a value the reader cannot reproduce (OS3018).

```
maType = input("ema", "Average type",
               options = ["sma", "ema", "wma", "rma", "hma", "vwma"])
corner = input("topRight", "Panel corner",
               options = ["topLeft", "topRight", "bottomLeft", "bottomRight"])

basis = ma(close, 20, type = maType)
```

`ma(src, len, type = ...)` exists precisely so that a select input can switch the
shape of a study without the script growing a `switch` over six branches. Where
a choice does need branching, declare the name before the `switch`, because an
arm cannot introduce a name that outlives it.

```
len = 14
switch maType
    case "fast"
        len = 9
    case "slow"
        len = 21
```

### A colour

A `color` default renders as a swatch with an opacity control. Passing that
colour to a plot takes over the plot's generated colour row rather than adding a
second one, so the reader never sees two colour controls for one line that can
disagree.

```
upColor   = input(lime, "Up colour")
downColor = input(red,  "Down colour")

plot(hist, "Histogram", hist > 0 ? upColor : downColor, style = "histogram")
```

Declare a colour input when the colour carries meaning the reader may want to
restate: a long side against a short side, one band against another. For a line
whose colour is only a colour, say nothing: the generated style row already lets
the reader change it. [settings-and-style.md](./settings-and-style.md) covers the
rows a plot gets for free and what a colour input replaces.

### A source

A `series` default renders as a dropdown over the price series
[../spec/stdlib.md](../spec/stdlib.md) section 13.1 lists for a source input.
The script gets a `series number` and uses it exactly like `close`.

```
src = input(hlc3, "Source")
plot(ema(src, 20), "EMA 20", aqua)
```

A source input costs one line and turns a study that reads closes into one that
reads whatever the reader wants.

### An interval

`kind = "interval"` renders a dropdown over the timeframes the host can serve.
The script gets a string in the canonical timeframe form: a count and a unit,
such as `"5m"`, `"1h"`, `"1D"`, `"1W"`, `"1M"`. Unit letters are case sensitive,
so `"1M"` is one month and `"1m"` is one minute, and a bare number is read as
minutes, which is why `"60"` and `"1h"` are the same timeframe.

```
biasTf = input("1D", "Bias timeframe", kind = "interval")
bias   = req.timeframe(biasTf, ema(close, 20))
```

An unrecognised timeframe is OS6001, and on a chart of a day or longer a
timeframe finer than the chart's own is OS6002. On an intraday chart any whole
number of minutes reads, finer than the chart's included, wherever the host
serves bars. Both refusals are worth saying in a tooltip, because the reader
picking a 1 minute bias on a daily chart has made an honest mistake.

**The repaint mode is not an input, and should never be one.** A higher timeframe
read declares its `mode`, one of those [../spec/stdlib.md](../spec/stdlib.md)
section 15.3 defines, as a literal in the source. A setting would let a reader
change the honesty of a study without reading it, and the point of naming the
mode is that it is visible during review.

### A time

`kind = "time"` renders a date and clock picker. Its stored value is a wall clock
string in the chart's timezone; the script receives a number, a timestamp in UTC
milliseconds, converted once before bar 0.

```
anchorText = input("2025-01-01 09:15", "Anchor", kind = "time")
```

The split is deliberate: this is the only input whose stored form differs from
its delivered form. Storing the wall clock is what
lets a saved layout restore to the same clock when the chart is later read in
another timezone: an anchor placed at the market's open stays at the open.
Delivering a timestamp is what a script actually wants, because `time` is a
timestamp and the comparison has to be against something of the same kind.

## Grouping, labels and tooltips

Every kind accepts these.

| Argument | Type | Default | Does |
|---|---|---|---|
| first positional | the value's type | required | The default, which fixes the input's type |
| `title` | `string` | the variable's name | The row label. Second positional |
| `group` | `string` | `""` | A heading the dialog groups rows under |
| `tooltip` | `string` | `""` | Help text beside the label |
| `inline` | `string` | `""` | Planned. Rows sharing a value sit on one line |
| `confirm` | `bool` | `false` | Planned. Ask for this value when the study is added |

Three habits make a dialog readable.

**Group in the order the reader works.** Calculation first, then what is drawn,
then anything about trading. Rows without a `group` sit above the first heading,
so leave the one or two settings that are always adjusted ungrouped.

**A label says what, a tooltip says why.** The label is a noun phrase short
enough to sit in a column. The tooltip is the sentence you would say out loud if
the reader asked, including the unit and the consequence of moving it.

**Name the unit in the label when it is not obvious.** "Band width, in ATR" and
"Flat this many minutes after the open" need no tooltip at all. "Multiplier" and
"Threshold" need one and will still be misread.

```
version 1

study("Range breakout", overlay = true, precision = 2)

len = input(20, "Lookback", min = 2, max = 500,
            tooltip = "Bars the breakout level is measured over. " +
                      "Longer is slower and gives fewer, cleaner signals.")

stopMult = input(2.0, "Stop, in ATR", min = 0.2, max = 20, group = "Risk",
                 tooltip = "Distance from entry to the initial stop, " +
                           "measured in current average true range.")

showStop = input(true, "Draw the stop", group = "Display")
stopTint = input(red,  "Stop colour",   group = "Display")

hi  = highest(high, len)[1]
atrValue = atr(14)

plot(hi, "Breakout level", aqua, width = 2)
plot(showStop ? hi - stopMult * atrValue : none, "Stop", stopTint)
```

## When a value is checked, and what happens when it fails

A value passes three gates, and it matters which one catches a mistake, because
only the first two can catch it before the study draws anything.

| Moment | Checked | Failure |
|---|---|---|
| Compile | The input declaration itself: placement, a constant default, a default inside `options`, a title of its own, and a key no other input carries; and every option written from an input, which has to be the whole of the value | OS3007, OS3003, OS3025, OS3018, OS3017, OS3021, OS3024, OS3022. The script does not compile |
| Load | The reader's saved value against the input's type, `min`, `max` and `options` | The study reports the row and the bound, and does not run |
| Bar | A legal setting that becomes an illegal argument: a length computed to zero, a colour channel out of range, a name that is not one of a function's accepted values | OS4003, OS4009, OS4012. The bar stops and the study is marked as errored |

**Not raised yet.** OS4009 and OS4012 are in the catalogue and nothing raises
them. A channel outside its range reaches the chart rather than stopping the
bar. A computed name outside the accepted set produces absence on every bar, and
only a name written as a literal is refused, with OS3008.

**A saved value that fails validation stops the study rather than falling back to
the default.** This is the decision most worth stating, because the alternative
looks friendlier and is a trap. A study that silently substituted a default would
come back on the chart under the same name, drawing different numbers from the
ones the reader configured, with nothing on screen to say so. A message naming the
row and the bound costs one dialog and loses nothing.

**Meanwhile the study still describes itself, at its declared defaults.** A host
asks a study for its shape before it asks for a calculation: the title, the pane,
the settings rows, and every declaration option written as an `input()`, such as
the `precision` above. That shape is built while the saved value is still stored,
and the answer there is the **declared default** for any saved value the run will
refuse. So a reader who saves 99 into a `max = 8` row sees the study's own
declared precision in the legend, not 99, and sees the message about the bound as
soon as anything is calculated. The saved value is not repaired: it travels to
the engine exactly as it was saved, and it is what the message names. And the
shape is not withheld: the settings dialog that lets the reader put the value
right is built from it, so a study that refused to describe itself would be one
whose bad setting could not be reached.

A few compile-time checks catch the mistakes that are easy to make and hard to
see. Titles must be unique within a file (OS3017), because the dialog, the legend
and the saved layout all key a row by its title, and two rows with one title would
overwrite each other's saved values; a title spelling another input's name is the
same clash (OS3022), and a row with no name and no title has nothing to be keyed
by at all (OS3021). An input that is declared and never read is warning OS8018:
the row still appears, the reader still changes it, and nothing happens, which is
worse than the setting not existing.

## Choosing defaults

A default is not a placeholder. Most readers will never change it, so the default
is the study for almost everyone who loads it.

- **Use the value you actually use.** If you run the study with a length of 34,
  ship 34. Shipping 14 because it is conventional means every reader sees a study
  you do not use.
- **Make it valid on the first chart it lands on**, which you cannot predict.
  A default that assumes an intraday interval breaks on a daily chart, and one
  that assumes a liquid instrument breaks where volume is absent.
- **Watch the warmup.** A function that needs 200 bars returns the absent value on
  the first 199, so a default length of 200 on a chart holding 300 bars draws
  almost nothing and reads as broken. Warmups compose: `sma(ema(close, 10), 10)`
  is absent until bar 18.
- **Set bounds to the range where the study still means something**, not to the
  range a number can hold. `min = 2, max = 500` on a lookback says more about the
  study than `min = 1` alone, and it stops a reader typing 50,000 and blaming the
  script for the wait.
- **Prefer a bool default of `true` for a feature the study is about**, and
  `false` for anything that paints over the reader's chart. Recolouring candles
  and shading the background are impositions; let the reader opt in.

## The rule that decides what belongs in the dialog

**An input the dialog cannot render is an input the user can never change.**

The dialog is generated in full from the `input()` calls the compiler can see
before bar 0. There is no second channel: nothing else in the script becomes a
row, and nothing the compiler cannot reach becomes a row at all. Every rule on
this page follows from that one fact.

- An `input()` inside a block is not a row, so it is OS3007 rather than a silently
  invisible setting.
- A row the compiler cannot name is a row a host cannot file a value under, so it
  is OS3021 rather than a row labelled with nothing.
- A default that depends on bar data cannot be resolved when the dialog is built,
  so it is OS3003.
- A number written as a literal in the middle of a calculation is not a row, and
  no reader will ever change it without editing the source.
- An input whose name is never read is a row that changes nothing, which is the
  same failure seen from the other end, and is warning OS8018.

The working version of the rule: **every number, colour or choice in a script is
either an input or a deliberate constant.** When you fix a value, say in a comment
why it is fixed. A reader who finds `14` hard-coded and no comment assumes you
forgot; a reader who finds a sentence saying the value is part of the definition
moves on.

The counterweight matters as much. Some things must not be inputs even though the
dialog could render them: the repaint mode of a higher timeframe read, the
declaration's `onUnconfirmed` flag, anything that changes what the study is
allowed to know. Those belong in the source where review can see them, because a
setting the reader can flip is a claim the script no longer makes.

## Common mistakes

| Symptom | Diagnostic | Fix |
|---|---|---|
| `input()` inside an `if` or a `fn` | OS3007 | Move it to the top level and read the name inside the block |
| A default computed from bar data | OS3003 | Use a literal, or an input for the thing the default depended on |
| Two rows with one title | OS3017 | Rename one; the saved layout keys on the title |
| A row with no name and no title | OS3021 | Give it a title written as a string literal |
| A row with no name and an empty title | OS3024 | Give the title something to say |
| A title that spells another input's name | OS3022 | Retitle this one, or rename the other input |
| A `var` holding an input used as an option | OS3003 | Drop the `var`, or pass the setting the `var` started from |
| An option computed from an input, `width = w + 1` | OS3025 | Declare the setting as the option itself, `width = w` |
| An input whose default or bound is another input | OS3025 | Write the default out as a literal |
| A plot's `style` written from an input | OS3026 | Write the style out; it is the one option a setting cannot reach |
| A select default outside its list | OS3018 | Add it to `options`, or pick a listed value |
| `range = [100, 0]` on the declaration | OS3016 | Write two numbers, lowest first |
| A row nobody reads | OS8018, warning | Use the name, or delete the input and its row |
| A length reaching zero on some bar | OS4003, at run time | Set `min = 1` on the input so the dialog refuses it first |

## Worked example: one study, a complete dialog

```
version 1

study("Bands", overlay = true, precision = 2)

// Calculation. Ungrouped, because these are the two rows a reader adjusts.
len = input(20,  "Length", min = 2, max = 500,
            tooltip = "Bars in the basis average and in the deviation.")
src = input(hlc3, "Source")

mult = input(2.0, "Band width, in standard deviations",
             min = 0.1, max = 5, step = 0.1, group = "Bands")
maType = input("sma", "Basis type", group = "Bands",
               options = ["sma", "ema", "wma", "rma", "hma", "vwma"])

showFill = input(true,  "Shade between the bands", group = "Display")
bandTint = input(aqua,  "Band colour",             group = "Display")
basisTint = input(orange, "Basis colour",          group = "Display")

basis = ma(src, len, type = maType)
dev   = mult * stdev(src, len)

upper = basis + dev
lower = basis - dev

plot(basis, "Basis", basisTint, width = 2)
upperPlot = plot(upper, "Upper", bandTint)
lowerPlot = plot(lower, "Lower", bandTint)

// The shade is switched off by fading it all the way out, never by wrapping the
// call in an if: fill is top level only, like plot, and fade takes transparency,
// where 100 is invisible.
fill(upperPlot, lowerPlot, fade(bandTint, showFill ? 92 : 100))
```

Eight rows, two headings, and nothing in the calculation that a reader might
reasonably want different is locked away in the source.

## See also

- [settings-and-style.md](./settings-and-style.md) for the rows a study gets
  without asking, and what a saved layout stores against them
- [revisions.md](./revisions.md) for what happens to a reader's saved values when
  you rename an input in a later revision
- [visuals/plots.md](./visuals/plots.md) for the plot arguments an input usually
  feeds, and why a plot is hidden with the absent value rather than an `if`
- [first-study.md](./first-study.md) for a study built from nothing, inputs
  included
- [errors/overview.md](./errors/overview.md) for every diagnostic named on this
  page
- [../spec/stdlib.md](../spec/stdlib.md) section 13 for every input kind and its
  arguments as the specification states them
