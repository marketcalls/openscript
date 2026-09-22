# 0020 The second engine implements neither arrays nor the log, and nothing said so

Status: open
Opened: 2026-09-22
Against: `engine/openscript/library/` (no array module) and
`engine/openscript/logbook.py` (written and wired to nothing)
Also touches: `spec/conformance.md` section 8, and Phase 6's gate in `ROADMAP.md`
Severity: the two engine gate reported agreement on a library the second engine
does not have, because no case reached it

Phase 6's gate is that the two engines agree on every conformance case. It has
been green. Writing the first `core` profile cases for Phase 7 showed why:
**no case reached an array or the log**, so neither engine was ever asked, and
the gate was measuring the part they both implement.

Four cases written against the first engine are held in this issue rather than
in `cases/`, because landing them turns `npm run suite:agree` red on a gap that
is real and is nobody's mistake in the suite. `conformance.md` section 10 says
the case is never the thing that gets changed, and these are not changed: they
are not shipped yet, and this issue is where they wait.

## What the second engine answered

```
array/element-limit: unsupported: the library function push
array/out-of-range:  unsupported: the library function push
log/no-side-effect:  unsupported: the library function print
log/print:           unsupported: the library function print
```

`OS6004` is the engine refusing a library function it does not have, which is
the honest answer. What is not honest is the identity beside it:
`engine/adapter.mjs` describes itself with `"profile": "strategy"`, and section
8 says a profile is cumulative, so `strategy` includes `core`, and `core`
includes the `limits` and `log` categories. The second engine claims a profile
it cannot meet.

## What is actually missing

**Arrays.** `engine/openscript/library/` has twenty four modules and none of
them is about arrays. There is no `push`, and by inspection no element access,
length or sort either. The first engine has them and `stdlib.md` specifies them.

**The log.** `engine/openscript/logbook.py` is written: it holds `PRINT`, a
`LOG_ENTRIES` table and a `Line` type carrying the bar index and the value,
including an absent one. Nothing imports it. Searching the whole engine for
`logbook` or `LOG_ENTRIES` outside that file returns nothing, so the module is
a complete description of a feature wired to no machine.

## What closes this

Arrays and the log implemented in the second engine, and then the four cases
below moved into `cases/` and the suite run in both modes. Until then the
second engine should either implement them or claim a profile it meets, and
today there is no profile below `core` for it to claim, which is itself worth
deciding.

## The cases, held

They were written against the first engine, and each one passed against it:
`node scripts/run-suite.mjs` reported them `pass`. Restore them by writing each
file back to the path in its heading.

### `cases/array/element-limit`

`bars.csv`

```text
time,open,high,low,close,volume
1735689600000,100.0,101.0,99.0,100.5,1000
1735693200000,101.0,102.0,100.0,101.5,1000
1735696800000,102.0,103.0,101.0,102.5,1000
1735700400000,103.0,104.0,102.0,103.5,1000
1735704000000,104.0,105.0,103.0,104.5,1000
```

`case.json`

```json
{"asserts":["diagnostics"],"category":"limits","description":"An array that holds exactly a million elements takes no more: the append past the ceiling raises OS5002 on the bar it happened.","id":"array/element-limit","languageVersion":1,"profile":"core"}
```

`expected.json`

```json
{"diagnostics":[{"barIndex":4,"code":"OS5002","column":5,"line":10,"severity":"error"}]}
```

`notes.md`

```
# array/element-limit

An array at the element ceiling, and the one element past it.

## What it pins

`language.md` 14.1 fixes the ceiling at 1,000,000 elements and says exceeding it
is OS5002. The ceiling is the language's own number and not a host's choice,
which is what makes it a conformance case rather than a local setting: an engine
that holds fewer refuses a script every conforming engine runs.

Four bars append a quarter of a million elements each, so the array holds
exactly the ceiling when bar 3 ends and nothing has been raised. The first
append of bar 4 is the element too many.

A quarter of a million iterations a bar is well inside the default loop budget,
so the bar that stops is stopped by the ceiling and not by the budget.

## What a wrong engine does differently

- A ceiling below a million: the diagnostic carries an earlier bar index.
- A ceiling above a million, or none: nothing is raised and the case fails on an
  empty diagnostics list.
- Refusing at the ceiling rather than past it: the last append of bar 3 is
  refused and the diagnostic carries bar index 3.

## Why the dataset stops at the bar that fails

Every later bar would append past the ceiling too, so an engine that stopped the
bar and carried on would report a diagnostic for each of them. The case asserts
one, and what a run does after a bar it stopped is fixed nowhere.
```

`script.os`

```
version 1

study("An array at its element ceiling and one past it")

// A quarter of a million elements a bar. The array holds exactly the ceiling at
// the end of the fourth bar, and the first append of the fifth is the one
// element too many.
var kept: array<number> = []
for i = 1 to 250_000
    push(kept, close)

plot(size(kept), "Elements held")
```

### `cases/array/out-of-range`

`bars.csv`

```text
time,open,high,low,close,volume
1735689600000,100.0,101.0,99.0,100.5,1000
1735693200000,101.0,102.0,100.0,101.5,1000
1735696800000,102.0,103.0,101.0,102.5,1000
1735700400000,103.0,104.0,102.0,103.5,1000
```

`case.json`

```json
{"asserts":["diagnostics"],"category":"runtime","description":"A read at the bar's own index into a rolling window of three elements raises OS4004 on the first bar whose index is past the window.","id":"array/out-of-range","languageVersion":1,"profile":"core"}
```

`expected.json`

```json
{"diagnostics":[{"barIndex":3,"code":"OS4004","column":6,"line":13,"severity":"error"}]}
```

`notes.md`

```
# array/out-of-range

An element read past the end of an array.

## What it pins

`language.md` 14.1: an index outside `0` to `size - 1` is OS4004 on the bar the
read happened, naming the index and the size. The window keeps the three newest
closes, so its size stops growing at 3 while the index being read, the bar's
own, does not. The read is inside the window on bars 0, 1 and 2 and past its end
on bar 3.

This is the case that tells an array read apart from a history read. They are
spelled the same way and 7.4 makes the second one absent past the oldest bar;
14.1 makes the first one an error, because an array has a known extent the
script chose and an index outside it is a mistake rather than a missing
measurement.

## What a wrong engine does differently

- Answering absence for an index past the end, which is the history rule applied
  to an array: nothing is raised and the case fails on an empty diagnostics
  list.
- Clamping the index to the last element: the same empty list, and a plausible
  number on the plot.
- Reading the size before the window is trimmed, so the array looks one longer
  than it is: nothing is raised on bar 3 either.

## Why the dataset stops at the bar that fails

Bar 4 would be out of range as well, so an engine that stops the failing bar and
carries on to the next would report a second diagnostic. What a run does after a
bar it stopped is fixed nowhere, and a case may not assert it.
```

`script.os`

```
version 1

study("A read past the end of a rolling window")

// The window keeps the three newest closes, so its size stops growing while the
// index being read does not. The read is inside the window while it is filling
// and past the end on the first bar after it is full.
var window: array<number> = []
push(window, close)
if size(window) > 3
    shift(window)

plot(window[bar.index], "The element at this bar's own index")
```

### `cases/log/no-side-effect`

`bars.csv`

```text
time,open,high,low,close,volume
1735689600000,100.0,101.0,99.0,100.5,1000
1735693200000,101.0,102.0,100.0,101.5,1000
1735696800000,102.0,103.0,101.0,102.5,1000
```

`case.json`

```json
{"asserts":["diagnostics"],"category":"log","description":"A print on every iteration of a loop that runs exactly the declared budget charges that budget nothing, so no bar is stopped.","id":"log/no-side-effect","languageVersion":1,"profile":"core"}
```

`expected.json`

```json
{"diagnostics":[]}
```

`notes.md`

```
# log/no-side-effect

A print inside a loop that is already spending its whole budget.

## What it pins

`stdlib.md` 14.3: a log line changes no value. The script declares a budget of
four iterations and runs a loop of exactly four, printing on every one, so the
bar has nothing left to spend. An engine whose `print` cost the loop budget
anything at all would stop bar 0 with OS5001, and the case asserts that no bar
was stopped.

The budget is small on purpose. Any charge at all, one tick per print or one
per statement, takes a loop of four iterations past a budget of four, so the
case does not depend on how large a charge a wrong engine would make.

## What it does not pin, and why

That the numbers the bar computed are the same with logging on and off. That
comparison wants the `values` channel, and the projection this engine's adapter
answers from writes none, so the observation left is the one the diagnostics
channel carries: printing perturbed nothing the run could be stopped by.

## What a wrong engine does differently

- A `print` that charges the loop budget an iteration: OS5001 on bar 0, where
  this case has an empty diagnostics list.
- A `print` compiled as a loop of its own, whose tick is charged as well: the
  same diagnostic on the same bar.
- An engine with no `print`: the program is refused at load and the case reports
  the function it lacks.
```

`script.os`

```
version 1

study("A print inside a loop that is exactly at its budget")
limits(loops = 4)

// The loop runs the whole declared budget and prints on every iteration, so the
// run has nothing left to spend on a print. A print that cost the budget an
// iteration would stop the first bar instead of finishing the dataset.
total = 0.0
for i = 1 to 4
    print(i)
    total += close

plot(total, "This bar's close, added once per iteration")
```

### `cases/log/print`

`bars.csv`

```text
time,open,high,low,close,volume
1735689600000,100.0,101.0,99.0,100.5,1000
1735693200000,101.0,102.0,100.0,101.5,1000
1735696800000,102.0,103.0,101.0,102.5,1000
```

`case.json`

```json
{"asserts":["diagnostics"],"category":"log","description":"A script that prints a number, a bar fact, a string, a bool and two absent values runs every bar to the end with no diagnostic.","id":"log/print","languageVersion":1,"profile":"core"}
```

`expected.json`

```json
{"diagnostics":[]}
```

`notes.md`

```
# log/print

Printing a value of every kind the language has, and the run finishing.

## What it pins

`stdlib.md` 14.3: `print` takes one value, draws nothing and answers nothing. It
is handed a series number, a bar fact, a string, a bool, a read from before the
dataset began and the absent literal, on every bar, and the run reaches the end
of the dataset with no diagnostic.

An absent argument is asserted on purpose, twice over. A script that prints a
value which is absent during warmup is printing the one thing its author is
looking at the log for, and an engine that refused it, or that refused the
absent literal beside it, would be refusing the case a log is read for.

## What it does not pin, and why

Not the log. `conformance.md` 2 lists `log` among the channels a case may
assert, and the projection this engine's adapter answers from writes
`diagnostics`, `orders`, `trades` and `performance` and no `log`, so a case that
asserted the stream would be reported `unsupported` rather than run. What is
asserted here is that printing is legal and costs the run nothing, not what was
written.

## What a wrong engine does differently

- An engine with no `print` in its library refuses the program at load, naming
  the function it does not have, and the case reports that rather than passing.
- An engine that refuses an absent argument, a string or a bool raises on bar 0,
  and the diagnostics list holds a row where this case has none.
```

`script.os`

```
version 1

study("A printed value of every kind")

// A number, a bar fact, a string, a bool and two absent values: one read from
// before the dataset began and one written out. Printing is not drawing and
// takes whatever it is handed.
print(close)
print(bar.index)
print("a line of text")
print(close > open)
print(close[50])
print(none)

plot(close, "Close")
```
