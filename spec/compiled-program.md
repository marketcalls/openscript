# OpenScript compiled program specification

Version of this document: draft, tracking compiled format version 1.1 and language
version 1.

This document defines the **compiled program**: the plain data structure an
OpenScript compiler emits and an engine executes. It is the contract that lets a
second engine exist. Someone who has never seen our implementation must be able to
write a conforming engine, in a language of their choosing, from the
specification documents `spec/README.md` lists alone.

A compiled program is data. It is never code in any host language, it contains no
expressions to be interpreted by a host compiler, and an engine never calls `eval`,
never builds a function from text and never loads generated source. An engine is a
loop over an instruction list.

Two engines that both pass the conformance suite must produce identical output for
identical input, to the last decimal. An unspecified corner is a defect in this
document, not a licence for an engine to choose.

## Contents

1. [How to read this document](#1-how-to-read-this-document)
2. [The shape of a compiled program](#2-the-shape-of-a-compiled-program)
3. [The machine](#3-the-machine)
4. [The instruction set](#4-the-instruction-set)
5. [Per-bar execution](#5-per-bar-execution)
6. [State, checkpoints, rollback and replay](#6-state-checkpoints-rollback-and-replay)
7. [Warmup and the absent value](#7-warmup-and-the-absent-value)
8. [Determinism](#8-determinism)
9. [Versioning and compatibility](#9-versioning-and-compatibility)
10. [Errors an engine raises](#10-errors-an-engine-raises)
11. [Becoming a chart](#11-becoming-a-chart)
12. [A worked example](#12-a-worked-example)
13. [Conformance checklist](#13-conformance-checklist)

---

## 1. How to read this document

**Must, may, never.** "Must" is a requirement on a conforming engine or a
conforming compiler. "May" marks a genuine choice, and every use of it says what
the choice may not change. "Never" is a prohibition.

**Compiler and engine.** The **compiler** turns source text into a compiled
program. The **engine** loads a compiled program and runs it over bars. The
**host** supplies bars, instrument facts, settings, a drawing surface and an order
route. Nothing in this document requires the compiler and the engine to be written
by the same people or in the same language, which is the point of it.

**Encoding.** The canonical encoding of a compiled program is a text document in
the object notation described in section 2.14. An engine may hold the program in
memory in any form it likes once it has read it. Where this document shows a
structure, it shows the canonical encoding.

**Field tables.** Every field table gives the field name, its type, whether it is
required, and what it means. A field typed `T?` may be null. A required field that
is missing makes the program invalid, and an invalid program is refused at load
time (section 3.5), never half executed.

**Error codes.** An engine reports a failure with a stable code, as `language.md`
requires. Section 10 lists every code this document uses and marks the ones it
introduces to the catalogue. Where this document and another disagree about a
code, the precedence that settles it is the one `spec/README.md` states.

**Examples.** Every instruction carries a source fragment and the instructions it
compiles to. Instruction indices in an example are relative to the start of that
fragment unless the example says otherwise.

---

## 2. The shape of a compiled program

A compiled program is one object with the fields below, in this order in the
canonical encoding. Everything else in this section defines one of them.

| Field | Type | Required | Holds |
|---|---|---|---|
| `openscript` | object | yes | Format version and language version, section 2.1 |
| `requires` | array of string | yes | Capability tags the engine must have, section 2.2 |
| `compiler` | object | yes | Who emitted this, for a bug report. Never read by the engine |
| `source` | object | yes | Source hash, line count, optional file name |
| `meta` | object | yes | The declaration: study or strategy and its options, section 2.3 |
| `limits` | object | yes | Loop budget and retained history depth, section 2.4 |
| `lib` | object | yes | The library functions this program calls, section 2.5 |
| `inputs` | array | yes | Declared inputs, section 2.6 |
| `channels` | array | yes | Per-bar output channels, section 2.7 |
| `outputs` | object | yes | Plots, fills, levels, markers, tables, alerts, paint, section 2.8 |
| `consts` | array | yes | The constant pool, section 2.9 |
| `series` | array | yes | Series registers, section 2.10 |
| `frame` | object | yes | Slot count of the top-level frame, section 2.11 |
| `cells` | array | yes | Persistent value cells, section 2.11 |
| `states` | array | yes | Library state regions, section 2.11 |
| `functions` | array | yes | User function bodies, section 2.12 |
| `callSites` | array | yes | One entry per user function call path, section 2.12 |
| `loops` | array | yes | One entry per loop, section 2.13 |
| `code` | array | yes | The per-bar instruction list, section 2.14 |
| `debug` | object | yes | Source positions and names, section 2.15 |
| `requests` | array | yes | Higher timeframe and other instrument reads, section 2.16 |

An empty table is written as an empty array, never omitted. A program with no user
functions carries `"functions": []`. Uniform presence costs three characters and
removes a whole class of "is it missing or is it empty" from every engine.

### 2.1 openscript

```json
"openscript": { "format": "1.1", "language": 1 }
```

| Field | Type | Means |
|---|---|---|
| `format` | string | The compiled format version, `major.minor`, section 9 |
| `language` | number | The language version the source declared or defaulted to |

`format` governs the structure of this document: the instruction set, the field
names, the encoding. `language` governs meaning: which front end parsed the source,
and which version of the standard library's behaviour the engine must apply. They
move independently, because a format change that adds a field has nothing to do
with a library function that was computing a number slightly wrong.

**An engine must select library semantics by `language`, not by the newest it
implements.** An engine that has both version 1 and version 2 of a function runs
version 1 for a program that says `"language": 1`, forever. That is how
`language.md` section 4.1 is kept: a saved script never changes its numbers.

### 2.2 requires

```json
"requires": ["core.1", "arrays", "orders"]
```

A list of capability tags. At load time the engine compares the list against its
own capabilities and refuses the program, naming the first tag it does not have, if
any is absent (OS6006).

Tags are the real compatibility mechanism, and the version number is the coarse
one. A version number says how new a program is; a tag says what it actually needs.
An engine that implements everything except order placement can run every study
ever written and refuses exactly the strategies, with a message that says which
capability it lacks rather than "too new".

The tags defined in format 1.0:

| Tag | Required when the program |
|---|---|
| `core.1` | Always. The instruction set of section 4 |
| `arrays` | Uses the `ARRAY` or `ELEM` instruction, or any array library function |
| `functions` | Declares a user function |
| `loops` | Contains a loop |
| `orders` | Is a strategy that places, modifies or cancels an order |
| `objects` | Creates a line, label, box or polyline object |
| `tables` | Declares a table |
| `alerts` | Declares an alert |
| `req.timeframe` | Reads a higher timeframe |
| `req.symbol` | Reads another instrument |

A compiler must emit every tag the program needs and must not emit a tag it does
not need, because a spurious tag turns an engine that could have run the program
into an engine that refuses it.

Which format version defined each tag is `spec/format-history.json`'s to say,
beside the opcodes and the field paths that version defined, and the table above
is read on every build: `scripts/check-format-tables.mjs` compares it with the
tags the compiler can emit and the tags the reference engine declares, and
`scripts/check-format-additive.mjs` compares the compiler with the history in
both directions, so a tag that gains or loses a home fails the build naming it.

### 2.3 meta

The declaration statement, evaluated at compile time. Every option value here is a
compile-time constant, by `language.md` section 13.2, so nothing in this object can
depend on a bar.

Each field below is the declaration option of the same name. The options a
declaration takes, what each one means and the default each one carries are the
ones `language.md` section 13.2 gives. This table is the representation and
nothing else: the field name and the shape its value takes in the canonical
encoding. `kind` is the one field that is not an option, because it records which
declaration statement the source wrote.

| Field | Type |
|---|---|
| `kind` | string, `"study"` or `"strategy"` |
| `title` | string |
| `short` | string |
| `overlay` | bool |
| `precision` | number |
| `format` | string |
| `range` | array? |
| `scale` | string |
| `group` | string |
| `onUnconfirmed` | bool |

`meta.onUnconfirmed` is the field section 5.4 reads when it decides whether a
deferred effect is applied on a bar that is still moving.

When `kind` is `"strategy"`, `meta` also carries the trading options of
`language.md` section 13.3, under a `strategy` sub-object. The object below
illustrates the shape, one field per option and spelled as the option is spelled;
which options there are and what each one defaults to are that section's, and a
program carries whatever its own declaration resolved to:

```json
"strategy": {
  "capital": 100000, "currency": "", "qty": 1, "qtyType": "units",
  "product": "intraday", "fillOn": "nextOpen", "slippage": 0,
  "commission": 0, "commissionType": "perTrade",
  "pyramiding": 1, "closeOnSessionEnd": false
}
```

A study program carries no `strategy` object.

**Every option and every declaration field is written with its effective value.**
The compiler writes each field of `meta`, each field of `meta.strategy` and each
field of every declaration in `outputs` with the value that option or that
argument resolved to, defaults included, rather than omitting the ones the script
left out or writing null in their place. A field is nullable only where absence is
a value the script itself could have written, and there null is the effective
value rather than a missing one. An engine therefore never needs a table of
defaults, and a default that changes in a later language version cannot silently
change an old program, because the old program carries the old value in writing.
The one thing a field may hold in place of a value is the reference below, and it
is resolved away before bar 0.

**An option a script wrote with an `input()` is carried as a reference.** A field
may hold the object `{ "input": "<key>" }` in place of a literal value, naming an
entry of `inputs[]` by its `key`. Every field of `meta`, every field of
`meta.strategy` and every field of every declaration in `outputs` may hold the
form, except `kind`, which is what decides how the rest of an object is read. The
engine resolves inputs once at load, in the order of section 2.6, and substitutes
each resolved value for its reference before it builds the descriptor, so a
reference is gone before bar 0 and nothing is resolved per bar. Section 3.5 is
where a reference is checked. This is how a tunable precision, a tunable table
corner and a tunable plot colour reach a declaration that is otherwise fixed
before the first bar: `language.md` section 13.2 permits it, and it is the fix
OS3003 names for an option that would otherwise depend on a bar.

### 2.4 limits

```json
"limits": { "loops": 2000000, "history": null }
```

| Field | Type | Means |
|---|---|---|
| `loops` | number | Loop iterations allowed per bar, section 5.5 |
| `history` | number? | Retained series depth in bars, or `null` for unbounded |

Both come from the script's `limits()` statement or from the language defaults.
`history: null` means the engine retains every bar it has been given, which is the
default, and makes OS4002 unreachable.

A host may refuse to run a program whose `limits` exceed what it is willing to
spend. It refuses at load time with OS5003, naming the limit and the value it
allows. It must not silently cap the value, because a program that quietly gets a
smaller budget than it asked for produces a wrong number instead of a message.

### 2.5 lib

```json
"lib": {
  "manifest": 1,
  "functions": [
    { "name": "sma", "arity": 2, "state": true, "effect": "none" },
    { "name": "buy", "arity": 6, "state": false, "effect": "order" }
  ]
}
```

| Field | Type | Means |
|---|---|---|
| `manifest` | number | The library manifest version, tied to `openscript.language` |
| `functions` | array | Every library function this program calls, in first-use order |

A function entry:

| Field | Type | Means |
|---|---|---|
| `name` | string | The manifest name, including any namespace, as in `math.round` |
| `arity` | number | Argument count after defaults are filled, section 4.10 |
| `state` | bool | The function holds per-call-site state |
| `effect` | string | `"none"`, `"signal"`, `"order"`, `"draw"` or `"log"`, section 5.4 |

The `CALL_LIB` instruction names a function by its index in this array, so a
program's own table is the only name resolution an engine does, once, at load.

An order function's `arity` is one more than the language's own signature shows,
because an order call carries the names of the arguments the script wrote and
section 4.10 says why it has to.

At load the engine checks every entry against its manifest: the name must exist,
the arity must match, and `state` and `effect` must agree with the manifest. A
mismatch is OS6004. This catches a program compiled against a newer library before
it computes a single wrong number, and it is why the entries carry facts the engine
already knows: they are there to be disagreed with.

### 2.6 inputs

One entry per `input()` call, in source order. Each input owns a slot in the
top-level frame, and the engine writes the effective value into that slot at the
start of every bar (section 5.1).

| Field | Type | Means |
|---|---|---|
| `key` | string | Settings key: the name the input was assigned to, or its title where it was assigned to none (`host-interface.md` section 8.1) |
| `kind` | string | `"number"`, `"bool"`, `"string"`, `"color"`, `"source"`, `"interval"`, `"time"` or `"select"` |
| `label` | string | Row label in the settings dialog |
| `default` | value | The declared default, in constant pool value form (section 2.9) |
| `min` | number? | Numeric lower bound, inclusive |
| `max` | number? | Numeric upper bound, inclusive |
| `step` | number? | Numeric step for a spinner |
| `options` | array? | Allowed values for `"select"` |
| `group` | string | Settings group heading |
| `tooltip` | string? | Help text for the row |
| `slot` | number | The frame slot this input is written into |

**A `"source"` input's default names a series rather than holding one.** It is
written `["s", "<field>"]`, in the same `[tag, value]` form as every other
default, and the string is one of the built-in series a source input may select,
which `stdlib.md` section 13.1 lists. The
`kind` field is what says the string names a series rather than holding one, so
the constant pool needs no tag of its own for a series (section 2.9). The engine
resolves the name to the matching `"bar"` register and
writes that register's value for the bar being executed into the input's slot at
step 5 of every bar (section 5.1); where the program reads the input's history it
reads a `"computed"` register, like any other top-level name.

The host supplies a settings object keyed by `key`. For each input the engine
resolves the effective value as: the host's value when the host supplies one and it
passes validation, otherwise `default`. Validation is exact: wrong type, a number
outside `min` or `max`, a `"select"` value not in `options`. A value that fails
validation is OS6019 and the program does not run, rather than falling back to the
default, because a settings dialog that silently ignores what a user typed is worse
than one that says the value is out of range.

An input value is never absent. `input()` cannot declare `none` as a default,
because the default's type is what fixes the input's type.

### 2.7 channels

Everything a script draws for a bar leaves the machine through a **channel**. A
channel holds at most one value per bar. The `EMIT` instruction is the only way to
write one.

| Field | Type | Means |
|---|---|---|
| `id` | number | Channel index, equal to its position in the array |
| `type` | string | `"number"`, `"string"`, `"color"` or `"bool"` |
| `defer` | bool | Held back on an unconfirmed bar, section 5.4 |
| `once` | bool | The verifier requires exactly one write on every path, section 3.5 |

One instruction and one flat table cover plots, levels, markers, alert conditions,
alert messages, bar colouring and pane background. The alternative, an instruction
per drawing surface, would have added six opcodes that all do the same thing and
would have made every new surface a format change. A surface is a declaration in
`outputs` that points at a channel; it is not machinery.

A channel's value is absent unless something wrote it, and absent is what the host
sees: a gap in a plot, no marker, no alert, a bar left its own colour.

### 2.8 outputs

The declared, fixed shape of the study. It is fixed before bar 0 because a legend,
a settings dialog and a pane have to exist before the first bar runs
(`language.md` section 7.1).

```json
"outputs": {
  "plots": [], "fills": [], "levels": [], "markers": [],
  "tables": [], "alerts": [], "barColor": null, "background": null
}
```

**`plots[]`**

| Field | Type | Means |
|---|---|---|
| `key` | string | Stable identity, unique within the program |
| `title` | string | Legend title |
| `type` | string | `"line"`, `"step"`, `"area"`, `"histogram"`, `"column"`, `"lineWithMarkers"` or `"candle"` |
| `channel` | number | The channel carrying its value |
| `color` | color? | Default colour, or null when the script named none, in which case the host assigns one from its own palette |
| `colorChannel` | number? | A channel carrying a per-bar colour, when the call's colour argument is not constant |
| `width` | number | Line thickness |
| `lineStyle` | string | One of the line styles `stdlib.md` section 14.4 gives `draw.setStyle` |
| `offset` | number | Bars to shift the drawn column right, negative for left |
| `overlay` | bool? | Force this one plot onto the price pane |
| `scale` | string | `"right"`, `"left"` or `"none"` |
| `precision` | number? | Decimals on the scale this plot maps to, or null when the script named none |
| `priceFormat` | string? | `"price"`, `"percent"` or `"volume"` for the scale this plot maps to, or null when the script named none |
| `ohlc` | object? | The channels and colours of a candle, in the shape below; null for every other type |

A plot's colour argument is constant in almost every script, so the common case is
a declaration and no per-bar cost. When it is not constant the compiler allocates a
second channel and emits it beside the value, which is how a script paints a
histogram by sign without a second plot.

`precision` and `priceFormat` are the plot's own `precision` and `format`
arguments, which set the formatting of the price scale this plot maps to rather
than the study's own (`stdlib.md` section 14.2). They are two fields because they
are two arguments of two types, exactly as they are two fields of `meta`, and a
plot that named neither carries null in both and leaves that scale formatted as
the pane already formats it.

`scale` carries a value on every plot, by the rule of section 2.3: a plot that
named no scale carries the effective value of `plot`'s own `scale` argument
(`stdlib.md` section 14.2). `overlay`, `precision` and `priceFormat` are nullable
because absence is what those arguments resolve to when a script names none,
which is an effective value like any other and not a field left out.

**A candle is one plot.** The six styles of `stdlib.md` section 14.2 are the whole
of what a `style` argument may name; `"candle"` is the seventh value of this field
and no style names it, because it is written by a `plotCandles()` call site and by
nothing else. Its entry is the only one that carries `ohlc`, which is null for
every other type. One call site is one entry, with one key and one legend row:
four declared plots with one of them nominated as the candle's identity would put
four rows in a legend for one column and would need a flag to hide three of them.
The entry's `channel` is the same channel as `ohlc.close`, which is what makes a
band drawn to the handle follow the close column (`stdlib.md` section 14.2).
`color` and `colorChannel` are null on a candle, because its colours are the four
below, and `width` and `lineStyle` describe its border and take a plot's own
defaults, since `plotCandles` has no argument for either.

| Field of `ohlc` | Type | Means |
|---|---|---|
| `open`, `high`, `low`, `close` | number | The four channels carrying the four values, one per bar; `close` is the entry's own `channel` |
| `colorUp` | color? | Body, border and wick where `close` is at or above `open` |
| `colorDown` | color? | The same where `close` is below `open` |
| `wickColor` | color? | The wick alone, overriding the body colour |
| `borderColor` | color? | The border alone, overriding the body colour |
| `colorUpChannel` | number? | A channel carrying `colorUp` per bar, when that argument is not constant |
| `colorDownChannel` | number? | The same for `colorDown` |
| `wickColorChannel` | number? | The same for `wickColor` |
| `borderColorChannel` | number? | The same for `borderColor` |

These are the four colour arguments of `plotCandles` (`stdlib.md` section 14.2),
each beside the channel that carries it when a script passes a series colour
instead of a constant, which is the same pair `color` and `colorChannel` make for
every other plot. The wick and border channels are the split colour callback
`stdlib.md` section 18 names. A colour field is null when its own channel holds
the value; `wickColor` and `borderColor` are also null when the script overrode
neither, and a null override means that part of the candle takes the body's colour
for the bar. That is the opposite of a null `color` on a line plot, and
deliberately so: the host may pick an undecorated line's colour because nothing
else depends on it, while a wick the host coloured independently of the body it
grows out of would draw a different candle on every chart.

**`fills[]`**

| Field | Type | Means |
|---|---|---|
| `between` | array of two string | The two plot keys to fill between |
| `colorUp` | color? | Where the first plot is above the second |
| `colorDown` | color? | Where the second is above the first |
| `colorUpChannel` | number? | Per-bar colour, as on a plot |
| `colorDownChannel` | number? | Per-bar colour |
| `opacity` | number | 0 to 1 |
| `overlay` | bool? | Draw on the price pane |

`fill`'s own `color` argument has no field here and needs none. It sets both sides
of the band, and giving it together with `colorUp` or `colorDown` is OS3010
(`stdlib.md` section 14.2), so the compiler writes that one colour into both
fields and an engine reads one representation of a band rather than two. A script
that named no colour at all leaves both null, and the host draws the band in the
first plot's colour faded to twelve percent: the compiler cannot fold that default
away, because that plot's own `color` may be null and taken from the host's
palette.

**`levels[]`**

| Field | Type | Means |
|---|---|---|
| `title` | string | Label |
| `channel` | number | The channel carrying the price |
| `color` | color | Line colour |
| `lineStyle` | string | One of the line styles `stdlib.md` section 14.4 gives `draw.setStyle` |
| `lineWidth` | number | Thickness |

A level's price arrives through a channel and is therefore evaluated every bar, and
**the level drawn is the one from the last bar executed**. The alternative was to
require a compile-time constant, which is simpler and would have made
`level(previousDayHigh, ...)` impossible; a level that tracks the data is worth a
channel.

**`markers[]`**

One entry per `signal()` call site.

| Field | Type | Means |
|---|---|---|
| `key` | string | Stable identity |
| `channel` | number | The channel carrying the marker text, `defer` true |
| `position` | string | `"above"`, `"below"` or `"price"` |
| `shape` | string | `"label"`, `"arrowUp"`, `"arrowDown"`, `"triangleUp"`, `"triangleDown"`, `"circle"`, `"square"`, `"diamond"`, `"cross"` or `"flag"` |
| `color` | color? | Plate colour |
| `textColor` | color? | Text colour |

A marker is emitted when its channel holds a string for the bar, and not otherwise.
A call site that fires more than once on a bar, which can only happen inside a
loop, leaves the last text written; one bar and one call site produce at most one
marker.

**`tables[]`**

| Field | Type | Means |
|---|---|---|
| `key` | string | Stable identity |
| `title` | string | Legend and settings name for the grid |
| `slot` | number | The frame slot holding the table handle |
| `position` | string | `"topLeft"`, `"topRight"`, `"bottomLeft"` or `"bottomRight"` |
| `rows` | number | Row count |
| `cols` | number | Column count |
| `options` | object | The declared style: `textColor`, `bgColor` and `borderWidth` |

A table's cells are written by library calls against the handle, not by channels: a
grid of two hundred cells would otherwise need two hundred channels, and almost all
of them would be absent on almost every bar. The cell buffer is an output buffer
cleared at the start of each execution of a bar and committed with the rest
(section 5.1).

One committed cell carries its row, its column, its text, and the three style
arguments `cell()` takes: `textColor`, `bgColor` and `align`. That buffer is per
bar rather than declared, so none of it appears in `outputs`; what `outputs`
declares is the grid the cells are written into.

A grid carries a `title` beside its `key` for the same reason a plot and an alert
do. It is `table()`'s first positional argument and has no default (`stdlib.md`
section 14.3), and a host given no name for a grid has no row to put in a legend
and no heading to put over its settings.

`options` holds exactly the three style arguments `table()` takes: `textColor` and
`bgColor`, each a colour or null, and `borderWidth`, a number. There is no text
size in it, because no call in the library writes one, and a field for a value no
script can express is a field no engine can fill; a later language version may add
the argument and the field together (section 9.2).

A declaration field that a script wrote from an `input()` carries the reference
form of section 2.3 rather than a literal value, until the engine resolves inputs
at load; `tables[].position` and `plots[].color` are the two a script reaches for.

**`alerts[]`**

| Field | Type | Means |
|---|---|---|
| `key` | string | Stable identity |
| `title` | string | Short label |
| `condChannel` | number | Boolean channel, `defer` true |
| `messageChannel` | number? | String channel for the message, `defer` true |
| `frequency` | string | `"oncePerBar"`, `"once"` or `"everyUpdate"` |

When an alert fires at all is section 5.4's, and it is two rules rather than one:
the bar has to have been decided, and the host has to have stated that it is
driving that bar live.

`frequency` sits beside the key and the title because nothing else in the program
implies it, and two engines that guessed would fire different numbers of alerts
from one program. `"oncePerBar"` is at most one alert for a bar, `"once"` is the
first firing only, for the life of this study instance, and `"everyUpdate"` is one
per execution of the bar, which is why it needs `meta.onUnconfirmed` true and is
OS3009 without it (`stdlib.md` section 16.2). The compiler writes the effective
value, the default included, as it does for every option of `meta`.

**`barColor`** and **`background`** are each either `null` or
`{ "channel": n }`. There is one of each per program. A script with three
`barColor()` calls writes the same channel three times and the last write on the
bar wins, which is the same rule as any other channel and needs no extra sentence
anywhere else.

### 2.9 consts

The constant pool. Every literal in the program, deduplicated, plus three reserved
entries.

**Entries 0, 1 and 2 are fixed:**

```json
"consts": [ ["z", null], ["b", false], ["b", true], ... ]
```

Index 0 is the absent value, 1 is `false`, 2 is `true`. Fixing them costs three
pool entries in every program and saves three opcodes in every engine, because
`CONST 0` is then the whole of pushing absence and no instruction needs to encode a
literal of its own.

Each entry is a two element array `[tag, value]`:

| Tag | Value encoding | Example |
|---|---|---|
| `"z"` | `null` | `["z", null]` |
| `"b"` | `true` or `false` | `["b", true]` |
| `"n"` | a finite number | `["n", 14]` |
| `"s"` | a string | `["s", "BUY"]` |
| `"c"` | `[r, g, b, a]` | `["c", [255, 136, 0, 1]]` |

A colour is four numbers: red, green and blue as whole numbers from 0 to 255, and
alpha as a number from 0 to 1. A hex literal `#ff8800` compiles to
`[255, 136, 0, 1]` and `#ff880080` to `[255, 136, 0, 0.5019607843137255]`, which is
128 divided by 255 in binary64 and is exact in the sense that every engine computes
the same bits from the same division. Storing a colour as a string would have been
shorter to read and would have left the alpha byte to be parsed and divided by each
engine separately, which is a place for two engines to differ by one part in 255.

A pool entry is never an array literal. `[1, 2, 3]` compiles to three pushes and an
`ARRAY` instruction, because an array literal must produce a **new** array every
time it is evaluated, and a shared pool object would be the same array on every
bar.

### 2.10 series

A **series register** is the per-bar history of one value. Only a register has
history, and the `HIST` and `HISTP` instructions are the only way to read it.

| Field | Type | Means |
|---|---|---|
| `id` | number | Register index, equal to its position in the array |
| `kind` | string | `"bar"`, `"computed"`, `"argument"`, `"request"` or `"input"` |
| `field` | string? | For `"bar"`: which bar field, see below |
| `name` | string? | Source name, for a debugger |

A `"bar"` register is filled by the engine from the host's bar before the bar's
code runs. The fields and their exact definitions:

| Field | Value |
|---|---|
| `open`, `high`, `low`, `close` | The bar's prices |
| `volume` | The bar's volume, absent when the host supplies none |
| `time` | Bar open time, milliseconds since the Unix epoch, UTC |
| `hl2` | `(high + low) / 2` |
| `hlc3` | `(high + low + close) / 3` |
| `ohlc4` | `(open + high + low + close) / 4` |
| `hlcc4` | `(high + low + close + close) / 4` |
| `bar.index`, `bar.count`, `bar.isFirst`, `bar.isLast`, `bar.isConfirmed`, `bar.isRealtime`, `bar.isNew`, `bar.updates` | The bar facts of `language.md` section 7.2, which fixes what each one means and which of them the host states |

The derived price fields are written as expressions because their order of
operations is part of the contract: `hlc3` adds high to low, adds close to that,
then divides. A different association gives a different last bit, and a study that
matches a reference implementation on one engine and not on another is exactly the
failure this project exists to prevent.

An absent `volume` rather than a zero is deliberate, on the same ground as the
chart contract's treatment of an unknown tick size: a script that sizes something
by volume has to be able to tell "no trades" from "nobody told me".

A `"computed"` register is written by `SSTORE`: it is a top-level name whose history
the program reads. A `"argument"` register is written by `SSTORE` immediately before
a user function call, to retain a series argument's per-bar values for that call
site (section 4.10).

The last two are the engine's to fill, like a `"bar"` register and unlike the two
above: **no instruction ever writes one.** A `"request"` register holds the value
of the read that names it in section 2.16, for the bar about to run. An `"input"`
register appears only inside a read's body, and holds the resolved value of the
setting that names it, the same value on every bar. Both are registers rather than
slots for the same two reasons: a slot belongs to one frame (section 3.2) and
either may be read from inside a `fn`, and only a register has history, which is
what makes `dayHigh[1]` the previous bar's reading with nothing further to
arrange.

**The compiler allocates a register for a top-level name only when the program
reads that name's history**, and otherwise gives it a plain slot. This changes
memory, never numbers. A host that wants every name watchable in a debugger asks
the compiler for full retention, which allocates a register for every top-level
name and sets `debug.retain` to true.

### 2.11 frame, cells and states

Three regions, three lifetimes. Section 3.2 defines them as memory; this is what
the program declares about them.

```json
"frame": { "slots": 7 },
"cells": [ { "id": 0, "kind": "var", "name": "stop" } ],
"states": [ { "id": 0, "fn": 3 } ]
```

**`frame.slots`** is the number of slots in the top-level frame. Slots hold every
name that is not a register and not persistent: top-level names, block-scoped
names, loop variables, loop bounds, input values and table handles. They are set to
absent at the start of every execution of a bar.

**`cells[]`** are persistent values: one entry per `var` or `live var` declaration.

| Field | Type | Means |
|---|---|---|
| `id` | number | Cell index |
| `kind` | string | `"var"` or `"live"` |
| `name` | string? | Source name, for a debugger |

A `"var"` cell obeys the rollback rule. A `"live"` cell does not (`language.md`
section 8.2). Both survive from bar to bar; both start uninitialised, and
`CELL_INIT` is what initialises one.

**`states[]`** are per-call-site regions for library functions that hold state.

| Field | Type | Means |
|---|---|---|
| `id` | number | State region index |
| `fn` | number | Index into `lib.functions` |

The contents of a state region are defined by the library, `stdlib.md` section 20,
not here. What this document requires of the library is that a state region is
**snapshottable by a mechanical copy**. A region contains scalar values, mutable
queues or immutable contribution history. Copy mutable data; immutable history
may share storage with its snapshot. Appending after either a snapshot or a
restore must not change any older version, including a later branch that a host
still retains. An engine must copy and restore a region without knowing which
function owns it, because the rollback and replay rules of section 6 apply to
every region at once.

A length that can grow in a later execution requires earlier contributions to
remain available. Storage may grow with the contributions for such a call, but
appending or checkpointing must not copy its entire prefix. Bounded immutable
chunks with a shared prefix satisfy that requirement. A proved constant or
bounded length may use a bounded queue instead. Observing the same length so far
does not prove a bound on future inputs. This is an internal storage rule, not a
new field in the compiled program. `limits.history` retains its existing meaning
for explicit register history reads.

### 2.12 functions and callSites

```json
"functions": [
  { "name": "change", "params": 1, "slots": 2, "code": [ ... ] }
],
"callSites": [
  { "fn": 0, "argc": 1, "cellBase": 2, "stateBase": 1, "series": [4] }
]
```

A **function** entry:

| Field | Type | Means |
|---|---|---|
| `name` | string | Source name, for a debugger and for an error message |
| `params` | number | Parameter count. Parameters occupy slots 0 to `params - 1` |
| `slots` | number | Frame size, including the parameters |
| `code` | array | The body's instruction list, ending in `RET` |

A **call site** entry, one per distinct **call path**, not per syntactic call:

| Field | Type | Means |
|---|---|---|
| `fn` | number | Index into `functions` |
| `argc` | number | Arguments this site passes, equal to `functions[fn].params` |
| `cellBase` | number | Added to every cell operand inside the body |
| `stateBase` | number | Added to every state operand inside the body |
| `series` | array of number | Register bound to each series parameter, `-1` for a parameter with no history read |

`language.md` section 11.4 says state is allocated per call site, and its own
example makes clear what that has to mean when a stateful helper is called from two
places: the `var` inside `barsSince` is a separate counter per call. So state is
allocated per **call path**, the chain of call sites from the top level down. With
recursion banned the call graph is a directed acyclic graph, so the set of paths is
finite and the compiler enumerates it. A function body addresses its cells and its
state regions relative to the frame's bases, and the call site supplies them, which
is what makes one body serve many independent pieces of state.

The number of paths can grow multiplicatively in a program where several functions
each call the next twice. A compiler that would exceed an engine's declared region
count reports OS5004 naming the two functions whose nesting caused it, rather than
emitting a program no engine will load.

### 2.13 loops

One entry per loop in the program, in source order. The `TICK` instruction names
one.

| Field | Type | Means |
|---|---|---|
| `id` | number | Loop index |
| `kind` | string | `"for"`, `"forIn"` or `"while"` |
| `line` | number | Source line of the loop header |
| `col` | number | Source column of the loop header |

The loop table exists so that OS5001 can name the line of the loop that was running
when the budget ran out, which is the loop's header line and not the line of
whatever instruction happened to be executing.

### 2.14 code, and the canonical encoding

`code` is the top-level instruction list: the body of the per-bar loop. It is an
array of instructions. Each instruction is an array whose first element is the
opcode name as a string, followed by its operands:

```json
["CONST", 4]
["CALL_LIB", 0, 2, 0]
["HALT"]
```

The opcode is a name rather than a number so that a program is readable, diffable
and hashable by hand, and so that a format that adds an opcode does not renumber
anything. Decoding happens once, at load; the cost of a string is paid per program,
not per bar. An engine may map the names to its own integers on load and must not
depend on any numbering, because none is defined.

`code` and every function's `code` must end with a terminator: `HALT` for `code`,
`RET` for a function body. Falling off the end of an instruction list is not
defined, and the verifier rejects a list that could.

**The canonical form**, which is what a hash is taken over:

- UTF-8, with no byte order mark.
- No whitespace between tokens.
- Object keys sorted ascending by Unicode code point. Sorted rather than in the
  order this document lists them, because a sort is a rule an emitter in any
  language can follow without a table.
- A number is written as the shortest decimal string that reads back as the same
  binary64 value, with a leading `-` for a negative, no leading `+`, no leading
  zero before a digit other than in `0.x`, and an exponent written as `e` followed
  by an optional `-` and the decimal exponent when the shortest form needs one.
- A string escapes only what it must: the quote, the backslash and the code points
  below 0x20, the last as `\u00XX` except for `\n`, `\r` and `\t`.

`source.hash` is `"sha256:"` followed by the lowercase hexadecimal SHA-256 of the
UTF-8 source text, after the CRLF normalisation of `language.md` section 3.1.
`source.hash` identifies the source; the hash of the canonical encoding identifies
the program. A host records both against a chart, a backtest run and a live
process, which is what makes a result reproducible months later.

### 2.15 debug

```json
"debug": {
  "pos": [[0, 6, 11], [1, 6, 18], [2, 6, 7]],
  "fnPos": [[0, [[0, 3, 18]]]],
  "names": { "slots": [], "cells": [], "series": [], "channels": [] },
  "retain": false
}
```

| Field | Type | Means |
|---|---|---|
| `pos` | array | Source positions for `code`, see below |
| `fnPos` | array | `[functionIndex, positions]` pairs, same form, for function bodies |
| `names` | object | Slot, cell, register and channel names, by index |
| `retain` | bool | The compiler gave every top-level name a register |

`pos` is a list of `[instructionIndex, line, column]` triples in ascending index
order. The position of any instruction is the triple with the greatest index at or
below it, so a run of instructions from one expression costs one triple.

`debug` never affects execution. An engine may drop it after load. It may not be
absent from the program, because an error message without a line is the thing this
project promised not to ship.

### 2.16 requests

A higher timeframe read and another instrument read (`stdlib.md` section 15) are
the one thing in the language whose value is not computed from the bars the
program is running on. Everything else an engine can work out from this chart. A
read needs another series entirely, and an expression evaluated over it.

So a read compiles to two halves, the same split section 2.8 makes for a plot.
The fixed half is an entry here, settled before bar 0. The per-bar half is a
`"request"` register (section 2.10), which the engine fills with the read's value
for the bar about to run.

```json
"requests": [
  {
    "id": 0,
    "read": "timeframe",
    "symbol": null,
    "exchange": null,
    "timeframe": { "input": "biasTf" },
    "mode": "confirmed",
    "series": 3,
    "warmup": 19,
    "body": { "...": "section 2.16.1" }
  }
]
```

| Field | Type | Means |
|---|---|---|
| `id` | number | This read's handle. Unique across the program, the reads nested inside another read's body included. It is **not** an index into this table |
| `read` | string | `"timeframe"` for the chart's own instrument on another interval, `"symbol"` for another instrument |
| `symbol` | identity | The instrument, for a `"symbol"` read. `null` on a `"timeframe"` read, which reads the chart's own |
| `exchange` | identity | Where it trades. `null` means the chart's exchange |
| `timeframe` | identity | A timeframe string, `stdlib.md` section 15.2 |
| `mode` | string | `"confirmed"`, `"developing"` or `"lookahead"`, `stdlib.md` section 15.3 |
| `series` | number | The `"request"` register this read's value lands in |
| `warmup` | number? | Requested bars of history the body needs, or `null` when no number is known |
| `body` | object | The expression, compiled over the requested bars, section 2.16.1 |

The three identity fields take one of three forms, and each is resolved at load:

| Form | Means |
|---|---|
| a value | The string the script wrote |
| `{ "input": "<key>" }` | The resolved value of that input, section 2.3's own form |
| `{ "chart": "<fact>" }` | The chart's own `symbol`, `exchange` or `interval` |

The third exists because `stdlib.md` section 15.1 writes one of them into the
signature: `exchange` defaults to `chart.exchange`, and a leg read at the chart's
own interval writes `chart.interval` for the timeframe. Both are settled before
bar 0 and neither is a value a compiler can know, so the request names the fact
and the engine resolves it from the instrument record (`host-interface.md`
section 4.1). Only those three facts may appear: the rest describe the chart
rather than identify it.

**A request's identity is fixed before bar 0**, which is what lets the whole set
of requests be known at load, and what makes a request that changed afterwards
OS6013. An engine hands the host the whole list once (`host-interface.md` section
5.2) and never discovers a new request during a bar.

**Not raised yet.** OS6013 is in the catalogue and nothing raises it: a read's
identity is settled once before bar 0 and nothing asks again.

`warmup` is what a host extends the requested range backwards by, so that the
first chart bar has a value rather than the first requested bar. It is a floor
and not a promise: a length that comes from a setting is not known until the
setting resolves, and `null` says the compiler had no number at all. A host that
extends by less gets a read that is absent for longer, never a wrong number.

**`mode` is carried and not restated.** What each of the three readings is
allowed to know, and what it does to the first bar a value appears on, is
`stdlib.md` section 15.3's and is the same sentence for every engine. The one
consequence worth naming here: a host that shows the repainting mark of that
section reads it from the modes in this table, because `meta` carries no separate
flag and two places to state one fact are two places to disagree.

A read whose answer has not arrived is absent, and so is a read on a bar its mode
allows no value for (`stdlib.md` section 15.5). Absence here is the ordinary
absence of section 3.4: the study keeps drawing everything that does not depend
on the read.

`req.isReady` and `req.error` name a read rather than taking its value, and a
value on a bar cannot say which request produced it. **The compiler resolves the
name to the request's `id` and passes that number**, which is the resolution
section 2.8 already does on a plot handle, for the same reason: the argument is a
compile-time identity wearing the clothes of a value.

#### 2.16.1 The body

The body is the expression of `stdlib.md` section 15.4, compiled over the
requested bars. It holds the tables a program holds for the machine of section 3,
and none of the tables that describe a chart:

| Field | Type | Means |
|---|---|---|
| `inputs` | array | `{ "input": "<key>", "series": n }`: the setting to fill that register with |
| `series` | array | Registers over the requested bars, section 2.10's shape |
| `frame` | object | Slot count of the body's own frame |
| `cells` | array | Section 2.11 |
| `states` | array | Section 2.11 |
| `functions` | array | Section 2.12 |
| `callSites` | array | Section 2.12 |
| `loops` | array | Section 2.13 |
| `requests` | array | Reads written inside this one, this section again |
| `code` | array | The body's instruction list, ending in `RET` |
| `pos` | array | Source positions, section 2.15 |
| `fnPos` | array | Source positions per function body, section 2.15 |

**Every one of those tables is the body's own, counted from zero.** The registers
are the requested instrument's bars, the cells and the state regions step once
per requested bar rather than once per chart bar, and an engine that reached into
the program's tables instead would put this chart's history behind another
chart's name. Inside the body, the built-in series of `stdlib.md` section 3.1 are
the requested instrument's, at the requested timeframe, which is that section's
own sentence and the whole point of the arrangement.

What the body does not carry is `consts` and `lib.functions`. It uses the
program's, because neither holds anything that depends on a bar, and one constant
pool and one manifest is one of each for an engine to verify.

An engine evaluates the body once per requested bar, oldest first, exactly as it
runs `code` once per chart bar: the same machine, the same memory rules, the same
verification. The value the body's `RET` hands back is the read's value for that
requested bar. `RET` rather than `HALT` because a body produces a value and
`HALT` does not, and reusing it means an engine's instruction loop is asked for
nothing new.

The settings a body reads are the only names it may take from the file scope
(`stdlib.md` section 15.4), and they arrive as `"input"` registers rather than
slots: a body is one expression with no statement to write a slot from, and a
function it calls reaches a register from any frame.

**A read carries no channel, no plot and no declaration.** Those are calls the
language refuses inside a request expression (OS3006), so nothing in a body can
write a column, and an engine never has to decide what a plot declared on other
bars would mean on this chart.

#### 2.16.2 The fold

`stdlib.md` section 15.3 says what each of the three modes is allowed to know.
This is the arithmetic that produces it, and it is here because two engines that
folded differently would disagree about the value of every higher timeframe study
ever written, one bar at a time, in a way nothing on a chart would show.

**Where the requested bars come from.** A `"timeframe"` read is of the chart's own
instrument at a coarser interval, so an engine folds the bars it already holds. A
`"symbol"` read is of an instrument the engine holds none of, so the bars come
from the host (`host-interface.md` section 5) and a host that serves none gives
its engine no `req.symbol` capability. A host may also answer a `"timeframe"`
read, and an engine that is answered folds the answer instead of the chart's bars.
Either way one fold runs, over whichever bars are the source.

**A bucket is a key, and the key comes from a bar's open instant.** Source bars
whose open instants give the same key are one requested bar. The key is:

| Timeframe | Key |
|---|---|
| `m`, `h` | The open instant divided by the period, rounded down, counted from the epoch |
| `D` | The day number of the civil date the open instant falls on, in the instrument's timezone, divided by the count |
| `W` | That day number's week, weeks starting Monday, divided by the count |
| `M` | The civil year times twelve plus the month, divided by the count |

An intraday key is a count and a calendar key is a date, which is the distinction
OS6015 turns on: an intraday request must be a whole multiple of the chart's
interval, because a boundary that fell inside a chart bar would put part of one
bar in two requested bars, and a dated request is exempt because its boundaries
are the calendar's.

**A calendar key needs the instrument's timezone and is absent without it.** A
host states the zone or it does not; an engine that folded days in a zone nobody
chose would put the boundary in the middle of a session for most of the world and
look correct doing it. A read with no key is absent on every bar, on the same
terms as any other absence.

**The bucket bar.** Its `time` is the first source bar's open instant, which is a
reading from the data rather than the boundary the key names; its `open` is the
first source bar's open and its `close` the last one's; `high` and `low` are the
extremes; `volume` is the sum; `oi` is the last source bar's, because it is a
level and not a flow (`host-interface.md` section 3.1). **Absence propagates
through every one of them**: a bucket missing one bar's high has no high, rather
than the highest of the bars that did report one, which is a number with no name.

**The three modes are three horizons over the same fold.** Let `k` be the bucket
key of the chart bar's own open instant.

| Mode | Source bars the fold may consume | The value the chart bar takes |
|---|---|---|
| `"confirmed"` | Those opening at or before this chart bar | The last bucket that closed |
| `"developing"` | Those opening at or before this chart bar | The bucket keyed `k`, as far as it has formed |
| `"lookahead"` | Those keyed `k` or lower | The bucket keyed `k`, in full |

A bucket closes when a source bar of a later one is folded, and never by the
clock. So **a confirmed read steps on the first chart bar of the next bucket**,
holds that value across every bar of it including the last, and steps again on
the first bar of the one after: on the bar a bucket closes, that bucket had not
closed at the bar's own open instant, so the bar still reads the one before it.

The first two horizons stop at the chart bar, so an engine given a whole dataset
and an engine given one bar at a time compute the same numbers. The third does
not, which is the mode: on settled history it reads the bucket's final value from
the bucket's first bar, and on the newest bucket, where there is nothing past the
bar to read, it is the bucket so far because nothing better exists. That is
`stdlib.md` section 15.3's "repaints on history, permanently and by design",
stated as the one place an engine's answer depends on how much it has been given.

**Warmup translates by arithmetic rather than by a rule.** The body runs on
requested bars, so a length inside it is counted in requested bars and its absence
folds onto the chart like any other value: a twenty period average of daily closes
is absent until twenty daily bars have closed, which on a five minute chart is
about a month of history. The `warmup` field above is what a host extends the
fetched range backwards by, and nothing an engine applies.

**A bucket at the left edge of the chart may be partial**, because the host chose
the range and the oldest bar it supplied may not be its bucket's first. An engine
folds what it was given and does not discard it: section 5.2 forbids adjusting,
resampling or padding the bars, and `warmup` is how a host is told to supply more.

---

## 3. The machine

### 3.1 Values

A value on the machine is one of six things, and every instruction's behaviour is
defined by the tags of the values it is handed.

| Tag | Holds |
|---|---|
| absent | Nothing. The value written `none` in source |
| number | A finite IEEE-754 binary64 value |
| bool | `true` or `false` |
| string | A sequence of Unicode code points |
| color | Red, green, blue as whole numbers 0 to 255, alpha as a number 0 to 1 |
| reference | An array, a table, or a drawing object, held in the object heap |

Rules that hold everywhere and are not repeated at each instruction:

- **A number is always finite.** Any arithmetic result that is not finite is
  absent, checked after each individual operation and not at the end of an
  expression. So `(1e308 * 10) / 10` is absent, not `1e307`. Checking per operation
  rather than per expression is what makes the rule explainable and what makes two
  engines agree, because the alternative depends on where an engine happens to
  round.
- **Negative zero is normalised to positive zero** on every arithmetic result and
  on every store. Nothing in the language can observe the sign of a zero, since
  dividing by one produces absence rather than a signed infinity, so normalising
  removes a difference that could otherwise reach a string through `text()` and
  differ between two engines for no reason a reader could ever act on.
- **A string is a sequence of code points.** Length, indexing and comparison are by
  code point, not by the storage unit of whatever language the engine is written
  in. An engine whose native strings are sixteen bit units must count and index
  past a surrogate pair as one element, or two engines will disagree about the
  length of a string holding a symbol outside the basic plane and about every
  substring taken after one.
- **A colour's channels are whole numbers and its alpha is not.** Red, green and
  blue are whole numbers from 0 to 255 in every colour the machine holds, not only
  in a literal, because every library call that computes a colour rounds the three
  channels before returning with the language's own rounding, halves away from
  zero (`stdlib.md` section 11.2). Alpha stays a binary64 number from 0 to 1. At
  the contract boundary the alpha becomes a byte as `round(alpha * 255)`, the same
  rounding, and that byte is the `aa` of the `#rrggbbaa` spelling the conformance
  suite compares (`conformance.md` section 6). **The conversion is one way and is
  not a round trip**: `#ff880080` parses to 128 divided by 255, while an alpha of
  0.12 serialises to `1f`, which reads back as a different number. Nothing in the
  language observes the difference, because a script reads alpha with `alpha()`
  from the machine value and never from the wire form.
- **A reference is opaque.** Equality on two references is identity
  (`language.md` section 9.3). A reference is never a number and never converts to
  one.

### 3.2 Memory

| Region | Addressed by | Lifetime | Rolled back | In a checkpoint |
|---|---|---|---|---|
| Operand stack | implicit | one statement | not applicable | no |
| Frame slots | `LOAD`, `STORE` | one execution of a bar | not applicable | no |
| Call frames | `CALL_FN`, `RET` | one call | not applicable | no |
| Cells | `LOADC`, `STOREC`, `CELL_INIT` | across bars | `"var"` yes, `"live"` no | yes |
| Library state | the `CALL_LIB` state operand | across bars | yes | yes |
| Series registers | `SLOAD`, `SSTORE`, `HIST`, `HISTP` | across bars | current bar's entry only | yes |
| Object heap | references held anywhere | across bars while reachable | yes | yes |
| Channels | `EMIT` | one execution of a bar | rewritten | the committed bar values |
| Pending effects | library calls with an effect | one execution of a bar | discarded | no |
| Loop counter | `TICK` | one execution of a bar | reset | no |
| Strategy state | order library calls | across bars | yes | yes |

The whole of the per-bar state question is in that table's third and fourth
columns, and section 6 is its consequences.

**The operand stack** is where instructions take their arguments and leave their
results. It is empty at the start of every top-level statement and empty when
`HALT` executes. A frame's stack region is its own: a called function cannot see or
disturb the caller's operands, which is what makes the verifier's job local.

**Frame slots** are indices into the current frame. The top-level frame has
`frame.slots` slots and is frame 0. A `CALL_FN` pushes a frame of
`functions[fn].slots` slots, with the arguments already written into slots 0 to
`argc - 1`. Slots are not shared between frames and have no history.

**Cells** are a flat array of `cells.length` entries, each either uninitialised or
holding one value. A cell operand inside a function body is added to the current
frame's `cellBase`, so the same body reaches different cells from different call
sites.

**Library state** is a flat array of `states.length` regions. The state operand of
a `CALL_LIB` inside a function body is added to the current frame's `stateBase`,
on the same principle.

**Series registers** each hold a history of one value per bar plus a cell for the
bar currently executing. The current cell is set to absent at the start of each
execution of a bar; `SSTORE` writes it; `HIST` at offset 0 reads it. At the end of
the execution the current cell becomes the history entry for that bar, replacing
whatever a previous execution of the same bar left there.

**The object heap** holds arrays, tables and drawing objects. A reference is a
handle into it. The heap is reachable from cells, from slots and from inside other
objects; only what is reachable from cells and from strategy state survives a bar.

### 3.3 Frames

A frame is:

| Field | Means |
|---|---|
| `code` | The instruction list being executed |
| `pc` | The index of the next instruction |
| `slots` | This frame's slot array |
| `cellBase` | Added to every cell operand |
| `stateBase` | Added to every state operand |
| `series` | Register bound to each series parameter, from the call site |
| `stack` | This frame's operand stack |

Frame 0 has `cellBase` 0, `stateBase` 0, an empty `series` array and the top-level
`code`. Frames nest to the depth of the call graph, which is statically bounded
because recursion is an error (`language.md` section 11.4). An engine that declares
a maximum frame depth refuses a program that exceeds it at load, with OS5005, and
never discovers the problem halfway through a bar.

### 3.4 The absent value in memory

Absent is a value, not a missing field. In the canonical encoding it is the pool
entry `["z", null]`. In a value that leaves the machine for a host, it is `null`,
which is what the chart contract already uses for a gap in a plotted column.

An engine must not represent absence as a number. A sentinel such as not-a-number
would make absence propagate through arithmetic by accident, which happens to be
the right answer for four operators and the wrong answer for six, and it would make
`isNone` and `==` a floating point comparison. A separate tag costs a branch and
buys every rule in `language.md` section 6.

### 3.5 Load-time verification

Before executing a single bar, an engine **must** verify the program. Verification
is not optional and not a debug mode: an engine that skips it can be handed a
malformed instruction list and will read past the end of an array or execute a jump
into the middle of an expression. A program that fails verification is refused with
OS6018, naming what failed and why: the first instruction index, or the field where
the failure is not in an instruction list. One code covers every such failure, and
its message carries one location placeholder holding whichever location the
failure has: the instruction index, the field's path, or, for a program that did
not parse at all (section 9.4, step 1), where the encoding stopped being readable.
These are not separate codes because they are not separate fixes. A malformed
instruction list, an unreadable encoding and an `{ "input": "<key>" }` reference
naming an input that was never declared are all defects of the compiler that wrote
the program, and none of them is repairable by hand. The one load failure that is
repairable by hand has a code of its own already: OS6019, a settings value the
user who typed it can correct.

Every check below is decidable from the program alone, with the one exception
check 10 names:

1. **Structure.** Every required field is present and of the declared type. Every
   index into a table is in range: constant pool, slots, cells, states, registers,
   channels, library functions, call sites, loops, functions.
2. **Opcodes.** Every opcode name is one this engine implements, with exactly the
   operand count of section 4.
3. **Jumps.** Every jump target is an instruction index within the same list. No
   target is past the terminator.
4. **Termination.** The last instruction of `code` is `HALT`, and of every function
   body is `RET`. No other instruction may be the last.
5. **Stack depth.** Every instruction has a fixed stack effect, so the depth at
   each instruction is computable by walking the list. The depth must agree on
   every path reaching an instruction, must never go below zero, and must be zero
   at `HALT`. A disagreement at a join is a corrupt program.
6. **Loops.** The target of every backward jump must be a `TICK` instruction. This
   is the whole of the loop budget's integrity: it means no cycle in the control
   flow graph can run without charging the budget, and it is checkable by looking
   at one instruction rather than by analysing the graph.
7. **Channels.** Every channel declared `once` is written exactly once on every
   path from instruction 0 to `HALT`. That is how a plot column is guaranteed to
   have a value, or an explicit absence, for every bar.
8. **Capabilities.** Every tag in `requires` is one this engine has, and every
   instruction used is covered by a tag the program declared.
9. **Library.** Every `lib.functions` entry matches the manifest for
   `openscript.language`, in name, arity, `state` and `effect`.
10. **Input references.** Every `{ "input": "<key>" }` reference (section 2.3)
    names an input declared in `inputs[]`, and the value that input resolves to is
    admissible in the field holding it. A key no input declares is OS6018, naming
    the field. A resolved value the field refuses is OS6019, naming the field and
    the value, because that value came from the host's settings rather than from
    the program. The key half is decidable from the program alone; the value half
    runs at load with the settings in hand, before step 1 of bar 0, and is the same
    validation section 2.6 applies to every input value.
11. **Requests.** Every entry of `requests` (section 2.16) names a `"request"`
    register that exists and is not named by a second entry, and no two entries
    share an `id`. Each body is verified by checks 1 to 10 against its own tables
    and the program's `consts` and `lib.functions`, with check 4 reading `RET`
    for the body's last instruction and check 7 vacuous because a body declares
    no channel. A body's own reads are verified the same way, to any depth.

A verified program cannot underflow the stack, cannot jump out of bounds, cannot
address a slot that does not exist and cannot loop without charging the budget.
Every remaining failure is a script error with a source position, which is the only
kind of failure a user should ever see.

---

## 4. The instruction set

Forty-one instructions. The set is deliberately small and deliberately dull: there
is one way to do each thing, no instruction is a shorthand for two others, and
nothing in it is clever. An engine's dispatch loop is a switch with forty-one arms,
and a new one cannot be added without a major format bump (section 9), so the
number is a promise rather than a measurement.

**Operand names** are used consistently throughout:

| Name | Means |
|---|---|
| `k` | Constant pool index |
| `s` | Frame slot index |
| `c` | Cell index, relative to the frame's `cellBase` |
| `r` | Series register index |
| `p` | Series parameter index in the current frame |
| `t` | Jump target: an absolute instruction index in the current list |
| `l` | Loop index into `loops` |
| `f` | Library function index into `lib.functions` |
| `st` | Library state index relative to `stateBase`, or `-1` for none |
| `site` | Call site index into `callSites` |
| `n` | A count, given in the instruction |
| `ch` | Channel index |

**Stack** columns are written as `before -> after`, with the top of the stack on
the right. A blank side is an empty effect.

### 4.1 Constants and stack

| Opcode | Operands | Stack | Effect |
|---|---|---|---|
| `CONST` | `k` | `-> v` | Push `consts[k]`. Pool entries 0, 1 and 2 are always absent, `false` and `true` |
| `DUP` | | `v -> v v` | Push a second reference to the value on top. Never copies an array, only the reference |
| `POP` | | `v ->` | Discard the top value |

```
// close                          // none
["SLOAD", 3]                      ["CONST", 0]

// 14                             // an argument retained for a call site
["CONST", 7]                      ["SLOAD", 5]
                                  ["DUP"]
                                  ["SSTORE", 2]

// a statement whose value is discarded: log("hi")
["CONST", 9]
["CALL_LIB", 4, 1, -1]
["POP"]
```

`DUP` and `POP` are the only stack shuffling instructions. There is no swap and no
rotate, because the compiler evaluates every expression left to right and never
needs to reorder what it has already pushed. Adding a swap would create a second
way to compile the same expression, and two compilers that agree on the language
would then disagree on the program.

### 4.2 Slots

| Opcode | Operands | Stack | Effect |
|---|---|---|---|
| `LOAD` | `s` | `-> v` | Push the current frame's slot `s` |
| `STORE` | `s` | `v ->` | Pop into the current frame's slot `s` |

```
// len = 14                       // total = len
["CONST", 7]                      ["LOAD", 0]
["STORE", 0]                      ["STORE", 1]
```

A slot read before anything wrote it yields absent, but the checker makes that
unreachable in a valid program (`language.md` section 12.5), so an engine that sees
it is looking at a program its verifier should have rejected.

### 4.3 Cells: values that persist across bars

| Opcode | Operands | Stack | Effect |
|---|---|---|---|
| `CELL_INIT` | `c`, `t` | | If cell `c` is initialised, jump to `t`. Otherwise mark it initialised and continue |
| `LOADC` | `c` | `-> v` | Push cell `c`. Absent if it holds absent |
| `STOREC` | `c` | `v ->` | Pop into cell `c` |

```
// var count = 0
 0 ["CELL_INIT", 0, 3]
 1 ["CONST", 3]          // 0
 2 ["STOREC", 0]
 3 ...

// count = count + 1
["LOADC", 0]
["CONST", 4]             // 1
["ADD"]
["STOREC", 0]
```

`CELL_INIT` marks the cell before the initialiser runs, not after. The two differ
only if the initialiser could reach the same `CELL_INIT` again, which needs
recursion, which is an error; marking first means the flag is set by one
instruction rather than by a pair that must stay together across a jump.

A cell declared inside a block is initialised on the first bar on which control
reaches its `CELL_INIT`, which is exactly `language.md` section 8.2: a `var` inside
an `if` that is false for a hundred bars is absent for a hundred bars.

### 4.4 Series registers

| Opcode | Operands | Stack | Effect |
|---|---|---|---|
| `SLOAD` | `r` | `-> v` | Push register `r`'s value for the bar being executed |
| `SSTORE` | `r` | `v ->` | Pop into register `r`'s current bar cell |
| `HIST` | `r` | `n -> v` | Pop `n`, push register `r`'s value `n` bars back |
| `HISTP` | `p` | `n -> v` | As `HIST`, on the register the call site bound to series parameter `p` |

```
// close                          // close[1]
["SLOAD", 3]                      ["CONST", 5]     // 1
                                  ["HIST", 3]

// diff = close - open, at the top level, where diff[n] is read somewhere
["SLOAD", 3]
["SLOAD", 0]
["SUB"]
["SSTORE", 7]

// inside fn change(src) => src - src[1]
["LOAD", 0]
["CONST", 5]     // 1
["HISTP", 0]
["SUB"]
["RET"]
```

`HIST` resolves `n` in this order, and an engine must follow it:

1. `n` is absent: the result is absent, by the propagation rule.
2. `n` is not a whole number, or is negative: OS4001, with the offending value in
   the message.
3. `n` is greater than `bar.index`: the result is absent. Not clamped, not zero.
4. `n` is greater than `limits.history` when that is not null: OS4002, naming the
   depth and the `limits(history = ...)` line that raises it.
5. Otherwise the value the register held on that bar, which may itself be absent
   because nothing wrote the register on that bar.

Case 3 and case 4 are different on purpose. In case 3 the value never existed; in
case 4 it existed and the engine threw it away. Returning absence for both would
hide a real bug behind a plausible gap.

`HISTP` reads `frame.series[p]` to find its register and then behaves as `HIST`. A
parameter whose call site bound `-1` cannot be reached by a `HISTP`, because the
compiler only binds a register for a parameter whose history the body reads;
`HISTP` against `-1` is a corrupt program, caught by the verifier.

### 4.5 Arithmetic

| Opcode | Operands | Stack | Effect |
|---|---|---|---|
| `ADD` | | `a b -> v` | Sum of two numbers, or concatenation of two strings |
| `SUB` | | `a b -> v` | `a - b` |
| `MUL` | | `a b -> v` | `a * b` |
| `DIV` | | `a b -> v` | `a / b`, absent when `b` is zero, including `0 / 0` |
| `MOD` | | `a b -> v` | Remainder of truncated division, sign follows `a`, absent when `b` is zero |
| `NEG` | | `a -> v` | `-a` |

```
// a + b * c
["LOAD", 0]
["LOAD", 1]
["LOAD", 2]
["MUL"]
["ADD"]

// -x                             // bar.index % 5
["LOAD", 0]                       ["SLOAD", 8]
["NEG"]                           ["CONST", 16]
                                  ["MOD"]

// high - low
["SLOAD", 1]
["SLOAD", 2]
["SUB"]

// "count: " + text(n)
["CONST", 8]
["LOAD", 1]
["CALL_LIB", 2, 1, -1]
["ADD"]
```

Every one of the six: if either operand is absent the result is absent, and no
further work is done. Otherwise the operation is performed in binary64 with
round-to-nearest-even, the result is checked for finiteness and becomes absent if
it is not finite, and negative zero becomes positive zero.

`ADD` is the only instruction that reads two tags. Two numbers add, two strings
concatenate, and any other combination is a program the checker should have
rejected: an engine treats it as a corrupt program rather than inventing a
conversion, because `language.md` section 5.3 has no coercion anywhere and an
engine that grows one here becomes the only engine that runs that script.

There is no instruction for unary plus. `+x` on a number is the identity and its
type is checked at compile time, so it compiles to nothing at all.

There is no exponent instruction. `pow(x, y)` is a library call, and `stdlib.md`
section 20.10.3 pins its arithmetic. The exact real power is rounded once using
the portable algorithm, so the host's power approximation cannot choose its bits.

### 4.6 Comparison

| Opcode | Operands | Stack | Effect |
|---|---|---|---|
| `LT` | | `a b -> v` | `a < b` |
| `LE` | | `a b -> v` | `a <= b` |
| `GT` | | `a b -> v` | `a > b` |
| `GE` | | `a b -> v` | `a >= b` |
| `EQ` | | `a b -> v` | `a == b`, always `true` or `false` |
| `NE` | | `a b -> v` | `a != b`, always `true` or `false` |

```
// close > open                   // r == none
["SLOAD", 3]                      ["LOAD", 2]
["SLOAD", 0]                      ["CONST", 0]
["GT"]                            ["EQ"]

// close < avg                    // close <= avg
["SLOAD", 3]                      ["SLOAD", 3]
["LOAD", 1]                       ["LOAD", 1]
["LT"]                            ["LE"]

// r >= 70                        // mode != "fast"
["LOAD", 2]                       ["LOAD", 3]
["CONST", 16]                     ["CONST", 17]
["GE"]                            ["NE"]
```

The four ordering instructions **propagate absence**: if either operand is absent
the result is absent, not `false` (`language.md` section 6.4). They compare two
numbers, or two strings by Unicode code point.

`EQ` and `NE` are **total**: they always produce a boolean. Absent equals absent,
absent equals nothing else. Two colours are equal when all four channels match. Two
references are equal when they are the same object, which is why `arrayEqual`
exists in the library for comparing contents.

The split is the one place in the language where absence is treated two ways, and
it is deliberate: an operator that can itself be absent gives a script no way to
ask whether a value is absent at all, so equality is the exception and every other
comparison is not.

### 4.7 Logic

| Opcode | Operands | Stack | Effect |
|---|---|---|---|
| `NOT` | | `a -> v` | `true` becomes `false`, `false` becomes `true`, absent stays absent |
| `AND` | | `a b -> v` | The three-valued conjunction below |
| `AND_SHORT` | `t` | `a -> a` | If the top value is `false`, jump to `t` leaving it in place |
| `OR` | | `a b -> v` | The three-valued disjunction below |
| `OR_SHORT` | `t` | `a -> a` | If the top value is `true`, jump to `t` leaving it in place |

`AND` implements the three-valued conjunction of `language.md` section 6.6, and
`OR` the disjunction beside it. **Each table is total**: every pair of two
booleans or absences has a row, including the three a short-circuit decides
before the instruction runs, a `false` left operand under `and` and a `true` one
under `or`. Those rows are here because the compiler emits `AND` and `OR` with no
short-circuit before them where neither operand can have an effect, the values of
a `switch` case among them (`language.md` section 10.6), and their answers are
the ones section 6.6 gives, so a program that took the short-circuit and one that
did not compute the same value.

| `a` | `b` | `a and b` |
|---|---|---|
| `true` | `true` | `true` |
| `true` | `false` | `false` |
| `true` | absent | absent |
| `false` | `true` | `false` |
| `false` | `false` | `false` |
| `false` | absent | `false` |
| absent | `true` | absent |
| absent | `false` | `false` |
| absent | absent | absent |

| `a` | `b` | `a or b` |
|---|---|---|
| `true` | `true` | `true` |
| `true` | `false` | `true` |
| `true` | absent | `true` |
| `false` | `true` | `true` |
| `false` | `false` | `false` |
| `false` | absent | absent |
| absent | `true` | `true` |
| absent | `false` | absent |
| absent | absent | absent |

```
// a and b
 0 <a>
 1 ["AND_SHORT", 4]      // a is false: the answer is false, and b is not evaluated
 2 <b>
 3 ["AND"]
 4 ...

// a or b
 0 <a>
 1 ["OR_SHORT", 4]       // a is true: the answer is true, and b is not evaluated
 2 <b>
 3 ["OR"]
 4 ...

// not ready
["LOAD", 0]
["NOT"]
```

The two operators are symmetric, and their instruction pairs are mirror images.
Each short-circuits on the one value that decides the answer by itself, `false`
for `and` and `true` for `or`, and leaves that value on the stack as the result.
Absence on the left short-circuits neither of them, because the other side can
still decide: a `false` on the right of an `and` and a `true` on the right of an
`or` fix the answer whatever the absent operand would have held. So the right
operand runs and the combining instruction takes both values, which is what
`language.md` section 9.4 requires and what makes both operators commutative
(`language.md` section 6.6).

Whether the right operand runs is observable, not a detail: a stateful call that
does not execute does not advance its state and leaves its series absent for the
bar (`language.md` section 11.4). Two engines that short-circuit differently would
produce different numbers, so the short-circuit points are instructions rather than
an engine's choice.

### 4.8 Branching and loops

| Opcode | Operands | Stack | Effect |
|---|---|---|---|
| `JUMP` | `t` | | Continue at `t` |
| `JUMP_FALSE` | `t` | `v ->` | Pop. Jump to `t` when the value is `false` or absent |
| `TICK` | `l` | | Charge one iteration of loop `l` to the per-bar budget. OS5001 when the budget is spent |
| `FOR_INIT` | `l`, `s`, `sLim`, `sStep`, `t` | `a b c ->` | Pop step, limit and start. Set up the loop. Jump to `t` when the body must not run |
| `FOR_NEXT` | `l`, `s`, `sLim`, `sStep`, `t` | | Advance the loop variable. Jump to `t` when another iteration is due |

**`JUMP_FALSE` treats absence as false.** This is the one place absence is absorbed
rather than propagated, and it is unavoidable: execution has to go somewhere. It
serves `if`, `else if`, `while`, the ternary and a `switch` condition arm, so the
rule is written once in one instruction.

```
// if close > open
//     signal("UP")
 0 ["SLOAD", 3]
 1 ["SLOAD", 0]
 2 ["GT"]
 3 ["JUMP_FALSE", 6]
 4 ["CONST", 9]          // "UP"
 5 ["EMIT", 1]
 6 ...

// up ? lime : red
 0 ["LOAD", 0]
 1 ["JUMP_FALSE", 4]
 2 ["CONST", 6]          // lime
 3 ["JUMP", 5]
 4 ["CONST", 7]          // red
 5 ...

// while i < 10
//     i += 1
 0 ["TICK", 0]
 1 ["LOAD", 0]
 2 ["CONST", 8]          // 10
 3 ["LT"]
 4 ["JUMP_FALSE", 10]
 5 ["LOAD", 0]
 6 ["CONST", 4]          // 1
 7 ["ADD"]
 8 ["STORE", 0]
 9 ["JUMP", 0]
10 ...
```

**`TICK`** is the loop budget, and the budget is counted in `TICK` executions
rather than in anything an engine measures for itself, so two engines run out at
the same iteration of the same loop on the same bar. The counter is set to zero at
the start of every execution of a bar. When a `TICK` would take the count past
`limits.loops`, the engine raises OS5001 naming `loops[l].line`, stops the bar and
marks the study errored. It does not break out of the loop and carry on, because a
loop that ran two million times and then stopped produces a plausible wrong number.

Every loop body begins with a `TICK`, and the verifier requires that the target of
every backward jump **is** a `TICK` instruction (section 3.5, check 6). One
structural rule, checkable by looking at a single instruction, guarantees that no
cycle can execute without charging the budget.

**`FOR_INIT` and `FOR_NEXT`** carry the numeric `for` loop. They take four
operands besides the loop index: the loop variable's slot and two hidden slots
holding the limit and the step, which the compiler allocates in the frame.

`FOR_INIT` pops the step, then the limit, then the start, in that order. It then:

1. Raises OS4013 if any of the three is absent. An absent bound means the number of
   iterations is unknown, and running zero times would hide that; the alternative,
   treating absence as "do not run", was rejected because a `for` loop whose bound
   is absent during warmup would silently produce nothing and the script would look
   correct.
2. Raises OS4001 if any of the three is not a number.
3. Raises OS3004 if the step is zero.
4. Writes start into `s`, limit into `sLim`, step into `sStep`.
5. Jumps to `t`, the instruction after the loop, when the first iteration must not
   run: the step is positive and start is above limit, or the step is negative and
   start is below limit. A descending range with a positive step runs zero times
   and is never silently reversed.

`FOR_NEXT` adds `sStep` to `s`, then jumps back to `t`, the `TICK` at the top of
the body, when the new value is still within the limit for the step's sign.
Otherwise it falls through and the loop is over.

```
// for i = 0 to 9
//     total += close[i]
 0 ["CONST", 3]          // 0, start
 1 ["CONST", 8]          // 9, limit
 2 ["CONST", 4]          // 1, step
 3 ["FOR_INIT", 0, 1, 2, 3, 12]
 4 ["TICK", 0]
 5 ["LOAD", 4]           // total
 6 ["LOAD", 1]           // i
 7 ["HIST", 3]           // close[i]
 8 ["ADD"]
 9 ["STORE", 4]
10 ["FOR_NEXT", 0, 1, 2, 3, 4]
11 ["JUMP", 12]
12 ...
```

`break` compiles to a forward `JUMP` to the instruction after the loop, and
`continue` to a forward `JUMP` to the `FOR_NEXT`, or to the `TICK` for a `while`.
Both are forward jumps, which is why the backward jump rule stays simple.

The `for x in arr` form has no instructions of its own. It compiles to a `while`
over a hidden cursor slot, because its semantics are already a `while`: the element
count is read when the loop is entered, elements appended during the loop are not
visited, and the loop stops early if the array shrinks past the cursor. Giving it a
dedicated instruction pair would have meant an instruction that re-reads an array's
size, which is a library call the compiler can emit in one line:

```
// for price in prices
//     total += price
 0 ["LOAD", 0]           // prices
 1 ["CALL_LIB", 1, 1, -1]  // size
 2 ["STORE", 5]          // hidden limit
 3 ["CONST", 3]          // 0
 4 ["STORE", 6]          // hidden cursor
 5 ["TICK", 1]
 6 ["LOAD", 6]
 7 ["LOAD", 5]
 8 ["LT"]
 9 ["JUMP_FALSE", 25]
10 ["LOAD", 6]
11 ["LOAD", 0]
12 ["CALL_LIB", 1, 1, -1]  // size again: the array may have shrunk
13 ["LT"]
14 ["JUMP_FALSE", 25]
15 ["LOAD", 0]
16 ["LOAD", 6]
17 ["ELEM"]
18 ["STORE", 7]          // price
19 <body>
20 ["LOAD", 6]
21 ["CONST", 4]
22 ["ADD"]
23 ["STORE", 6]
24 ["JUMP", 5]
25 ...
```

### 4.9 Arrays

| Opcode | Operands | Stack | Effect |
|---|---|---|---|
| `ARRAY` | `n` | `v1 .. vn -> a` | Pop `n` values, push a new array holding them in order |
| `ELEM` | | `a i -> v` | Pop index and array, push the element |

```
// [20.0, 50.0, 80.0]             // prices[1]
["CONST", 10]                     ["LOAD", 0]
["CONST", 11]                     ["CONST", 5]     // 1
["CONST", 12]                     ["ELEM"]
["ARRAY", 3]
```

`ARRAY` allocates a new array every time it executes, which is why an array literal
is not a constant pool entry. `ARRAY 0` builds an empty array.

`ELEM` raises OS4004, naming the index and the size, when the index is outside `0`
to `size - 1`, when it is not a whole number, or when it is absent. That is the
opposite of a history read past the start of the dataset, which is absence, and the
difference is the point: an array has an extent the script chose, so an index
outside it is a mistake rather than a missing measurement.

Everything else an array does is a library call: `size`, `push`, `pop`, `set`,
`slice`, `sort` and the rest. Only the two operators of the language, the literal
and the subscript, are instructions.

### 4.10 Calls

| Opcode | Operands | Stack | Effect |
|---|---|---|---|
| `CALL_LIB` | `f`, `n`, `st` | `a1 .. an -> v` | Call library function `f` with `n` arguments, using state region `stateBase + st` when `st` is not `-1` |
| `CALL_FN` | `site` | `a1 .. an -> v` | Call the user function the call site names |
| `RET` | | `v ->` | Leave the current frame, pushing the value onto the caller's stack |

```
// ema(close, 9)                  // sma(close, len), which holds state
["SLOAD", 3]                      ["SLOAD", 3]
["CONST", 13]                     ["LOAD", 0]
["CALL_LIB", 0, 2, 0]             ["CALL_LIB", 1, 2, 1]

// change(hlc3), where change reads src[1]
["SLOAD", 6]            // hlc3
["DUP"]
["SSTORE", 4]           // retain this call site's argument history
["CALL_FN", 0]

// fn typicalPrice() => (high + low + close) / 3
["SLOAD", 1]
["SLOAD", 2]
["ADD"]
["SLOAD", 3]
["ADD"]
["CONST", 14]           // 3
["DIV"]
["RET"]
```

**Arguments are positional and complete.** Named arguments, defaults and argument
order are entirely a compile-time matter: the compiler fills every default and
emits the arguments in parameter order, so an engine never sees a name, never
consults a signature and never counts. A default that is an expression rather than
a literal is compiled **into the call site**, not into the function body, so its
per-call-site state lives with the call that used it, which is where
`language.md` section 11.4 puts every other piece of state.

**An order function takes one argument more than the language shows, and it is
the names of the arguments the script wrote.** Filling a default in is the whole
of the job for every other call, because the value is the whole of the answer.
For an order call it is not, because two of its defaults are absence itself:
`stdlib.md` 17.2 writes `buy(qty = the declaration's, limit = none, stop = none)`.
Substitute those and an argument left out and an argument written that came out
absent arrive as the same value, while `language.md` 6.8 gives them opposite
meanings. `buy()` means "use the size I declared". `buy(qty = none)` means "I
computed a size and it came out absent", which is a sizing calculation that has
not warmed up or a divisor that was zero, and it is OS7002. With the two
indistinguishable the refusal has nothing to fire on, and `buy(qty = 1, stop =
lowest(low, 20))` places a **market** order on every bar of the window instead of
the stop order it asks for.

So the last argument of an order call is a string: the names of the arguments the
script wrote, in parameter order, separated by single spaces, and the empty
string where it wrote none. It is a value like any other and an engine reads it
like any other, which is why this needs no new value, no new instruction and no
new table. The `arity` of section 2.5 counts it, so a call to `buy` pushes six
arguments and not five. An engine reads an argument the string does not name as
the default `stdlib.md` states for it, and refuses one the string does name and
that arrived absent.

```
// buy(qty = 1, stop = lowest(low, 20)), where the window is still absent
["CONST", 5]            // qty, written: 1
["CONST", 0]            // limit, not written: absence, which is no limit price
["SLOAD", 2]            // low
["CONST", 18]           // 20
["CALL_LIB", 3, 2, 0]   // lowest, absent until the window fills
["CONST", 19]           // "qty stop"
["CALL_LIB", 4, 6, -1]  // buy: the stop was written and is absent, so OS7002
```

This is the only place the format distinguishes an argument by how it was
written, and it is here because it is the only place where the two spellings mean
opposite things. Everywhere else `atr()` and `atr(14)` are one program, which is
what section 2.5's `arity` and this paragraph's first sentence are for.

**A stateful library call names its region.** `st` is `-1` for a pure function and
a region index otherwise. The region is created on first use and persists across
bars. A call that does not execute on a bar leaves its region untouched and its
series absent for that bar, which falls out of the instruction never running rather
than being a rule an engine has to implement.

**A series argument is always given a fresh register.** When a call site passes an
expression to a series parameter whose history the body reads, the compiler emits
`DUP` and `SSTORE` into an `"argument"` register and binds that register in the
call site. It does this even when the argument is a bare series name whose register
already exists, and the extra register is not an oversight: binding the existing
register would give the body history on bars where the call did not execute, which
would contradict the rule above and would make a call inside an `if` behave
differently from a call inside a function inside an `if`.

**`CALL_FN`** reads everything it needs from `callSites[site]`: the function, the
argument count, the cell and state bases, and the series bindings. It pops `argc`
values into the new frame's slots 0 to `argc - 1`, in order, so the first argument
lands in slot 0. The remaining slots start absent.

**`RET`** pops the return value from the current frame and pushes it onto the
caller's. A bare `return` compiles to `CONST 0` followed by `RET`, and a function
body that ends without an expression does the same, so every function returns a
value and `RET` never has to decide.

### 4.11 Output

| Opcode | Operands | Stack | Effect |
|---|---|---|---|
| `EMIT` | `ch` | `v ->` | Pop and write the value into channel `ch` for the bar being executed |

```
// plot(avg, "Mean", aqua)        // signal("BUY")
["LOAD", 1]                       ["CONST", 9]
["EMIT", 0]                       ["EMIT", 1]

// background(risky ? fade(red, 92) : none)
["LOAD", 2]
["JUMP_FALSE", 6]
["CONST", 7]
["CONST", 15]
["CALL_LIB", 3, 2, -1]
["JUMP", 7]
["CONST", 0]
["EMIT", 4]
```

One instruction covers every drawing surface. A plot's value, a plot's per-bar
colour, a level's price, a marker's text, an alert's condition, an alert's message,
a bar colour and a pane background are all one value per bar written to a declared
channel. A second write on the same bar replaces the first, so the last write wins
and no surface needs a rule of its own.

A channel whose value is absent means a gap in a plot, no marker, no alert, no
recolouring: absence reaching a drawing surface is never a zero (`language.md`
section 6.7).

Table cells and drawing objects do not go through channels. A table is a handle in
a slot and its cells are written by library calls; a line, label or box is an
object in the heap that a script creates once and mutates over many bars. Both
would need an unbounded number of channels, and a channel is by definition one
value per bar.

### 4.12 Termination

| Opcode | Operands | Stack | Effect |
|---|---|---|---|
| `HALT` | | | End the bar. The stack must be empty |

`HALT` is the last instruction of `code` and the only way a bar ends normally.
Requiring it, rather than treating the end of the array as the end of the bar,
gives the verifier something to check against and gives a truncated program a
definite failure instead of an accidental one.

### 4.13 The whole set

Forty-one instructions, with their stack effect as a signed depth change.

| Opcode | Operands | Depth | Group |
|---|---|---|---|
| `CONST` | `k` | `+1` | Constants and stack |
| `DUP` | | `+1` | Constants and stack |
| `POP` | | `-1` | Constants and stack |
| `LOAD` | `s` | `+1` | Slots |
| `STORE` | `s` | `-1` | Slots |
| `CELL_INIT` | `c`, `t` | `0` | Cells |
| `LOADC` | `c` | `+1` | Cells |
| `STOREC` | `c` | `-1` | Cells |
| `SLOAD` | `r` | `+1` | Series |
| `SSTORE` | `r` | `-1` | Series |
| `HIST` | `r` | `0` | Series |
| `HISTP` | `p` | `0` | Series |
| `ADD` | | `-1` | Arithmetic |
| `SUB` | | `-1` | Arithmetic |
| `MUL` | | `-1` | Arithmetic |
| `DIV` | | `-1` | Arithmetic |
| `MOD` | | `-1` | Arithmetic |
| `NEG` | | `0` | Arithmetic |
| `LT` | | `-1` | Comparison |
| `LE` | | `-1` | Comparison |
| `GT` | | `-1` | Comparison |
| `GE` | | `-1` | Comparison |
| `EQ` | | `-1` | Comparison |
| `NE` | | `-1` | Comparison |
| `NOT` | | `0` | Logic |
| `AND` | | `-1` | Logic |
| `OR` | | `-1` | Logic |
| `AND_SHORT` | `t` | `0` | Logic |
| `OR_SHORT` | `t` | `0` | Logic |
| `JUMP` | `t` | `0` | Control |
| `JUMP_FALSE` | `t` | `-1` | Control |
| `TICK` | `l` | `0` | Control |
| `FOR_INIT` | `l`, `s`, `sLim`, `sStep`, `t` | `-3` | Control |
| `FOR_NEXT` | `l`, `s`, `sLim`, `sStep`, `t` | `0` | Control |
| `ARRAY` | `n` | `1 - n` | Arrays |
| `ELEM` | | `-1` | Arrays |
| `CALL_LIB` | `f`, `n`, `st` | `1 - n` | Calls |
| `CALL_FN` | `site` | `1 - argc` | Calls |
| `RET` | | `-1` | Calls |
| `EMIT` | `ch` | `-1` | Output |
| `HALT` | | `0` | Termination |

`CALL_FN`'s depth change uses `callSites[site].argc`, which is fixed at load, so
the depth remains statically computable.

This table is read on every build. `scripts/check-format-tables.mjs` takes each
row's opcode, operand names and depth out of the page and compares them with the
compiler's own opcode table: a row with no entry, an entry with no row, an operand
count that differs or a depth that differs fails the build naming both sides. A
depth written as `1 - n` or `1 - argc` is not read as a number; the compiler's
answer is probed with several counts of the operand the formula names, or of the
call site's `argc` where the count is not an operand.

---

## 5. Per-bar execution

### 5.1 The bar cycle

An engine executes a bar by running these eleven steps in this order. Everything
else in this document is a detail of one of them.

1. **Restore.** If this is not the first execution of bar `i`, restore the
   checkpoint taken at the end of bar `i - 1` (section 6). On the first execution
   of bar `i` the state already is that checkpoint, so nothing is copied.
2. **Truncate.** Set every series register's history length to `i`, discarding any
   entry a previous execution of bar `i` wrote.
3. **Clear.** Empty the operand stack. Set every slot of frame 0 to absent. Set
   every channel to absent. Empty the table cell buffers. Empty the pending effect
   list. Set the loop counter to zero. Set every series register's current bar cell
   to absent.
4. **Fill bar registers.** Write the host's bar `i` into every `"bar"` register,
   including the derived fields and the `bar.*` facts, using the definitions in
   section 2.10. Write each read's value for bar `i` into its `"request"`
   register (section 2.16), absent where the answer has not arrived or the read's
   mode allows no value yet.
5. **Fill inputs.** Write each input's effective value into its slot.
6. **Execute.** Run `code` from instruction 0 until `HALT`.
7. **Close the registers.** Append each series register's current bar cell to its
   history as the entry for bar `i`.
8. **Publish the columns.** Write each channel's value into the per-bar output
   buffer for bar `i`, as `null` where the channel is absent.
9. **Decide about effects.** If the bar is confirmed, or `meta.onUnconfirmed` is
   true, apply the deferred channels and the pending effect list (section 5.4).
   Otherwise discard them, having already published the columns.
10. **Trim history.** If `limits.history` is a number, drop register entries older
    than that depth.
11. **Checkpoint.** If the engine is moving on to the next bar, take a checkpoint
    (section 6.1).

Input resolution, and the substitution of every `{ "input": ... }` reference
(section 2.3) with the value it resolves to, happen once at load, before step 1 of
bar 0, so the declaration in `outputs` and the descriptor built from it exist
before the first bar runs. Step 5 writes the already resolved values into slots and
resolves nothing.

Steps 1 and 2 are what make a still-moving bar idempotent. Steps 8 and 9 are what
separate what a script may do on a moving bar from what it may not: the drawing is
recomputed from scratch on every update and published every time, while a signal,
an alert or an order waits for the bar to close.

An error raised during step 6 stops the bar. Steps 7 to 11 do not run, the bar's
output columns keep whatever the previous execution published or stay absent, and
the engine reports the error with its code and source position. It does not
continue to the next bar with a half executed state.

### 5.2 What the host supplies

An engine reads all of this from the host and none of it from anywhere else:

| Fact | Used by |
|---|---|
| The bars: open, high, low, close, volume, time | Step 4 |
| Bar state: the facts the host states (`language.md` section 7.2) | Step 4 and step 9 |
| Settings, keyed by input `key` | Step 5 |
| The instrument record (`host-interface.md` section 4.1) | The `chart` library namespace |
| The chart clock, for `chart.now()` | The `chart` library namespace |
| More bars, on request | Step 4, through `requests` (section 2.16) |
| A drawing surface | Steps 8 and 9 |
| An order route | Step 9 |
| Order frames about the intents this run sent (`host-interface.md` section 7.2) | The bar boundary, before step 4 of the next execution |

`chart.intervalMinutes` and `chart.isIntraday` are not on that list because the
engine derives them from the interval string rather than reading them, which keeps
them from disagreeing with the interval they describe.

**The strategy's position is not on it either, and it is not read from anywhere
else.** It is folded from the orders the run sent and the frames the last row
reports back, under `stdlib.md` section 17.1, which is why the frames are a row
here and the position is not. A host is never asked for one: its own position row
is per contract and is shared with every other strategy trading that contract, so
a position read from it would be somebody else's as much as this run's. An engine
that took one from a host would answer every `pos` call with a number no rule in
this format can account for, and would answer absence on a host that conforms to
`host-interface.md` and states none. Which facts the record
holds, which of them a host must state and what a script sees when one is absent
are `host-interface.md` section 4.1's.

An engine must not adjust, round, resample, deduplicate or reorder the bars it is
given. If two engines are handed the same bars they compute the same numbers, and
if they are handed different bars they were never going to agree, which is a host
problem with a host's answer.

### 5.3 What persists and what does not

Restating section 3.2 as the two questions a script author actually asks.

**Cleared at the start of every execution of a bar:** the operand stack, every
frame 0 slot, every channel, every table cell buffer, the pending effect list, the
loop counter, every register's current bar cell.

**Kept from bar to bar:** every cell, every library state region, every series
register's history, the object heap, and the strategy's ledger (`stdlib.md`
section 17.7) with everything folded from it.

A name that is not a `var` is therefore computed fresh every bar even though its
slot is the same slot, which is exactly `language.md` section 8.1: the previous
value is still readable through `[]` when the name has a register, but it is not
the starting point for this bar's computation.

### 5.4 Deferred effects

Two things are held back on a bar that is still moving: **channels declared
`defer`**, which are markers and alerts, and **library calls whose manifest entry
carries an `effect`**, which are the order functions and anything else that reaches
the outside world.

A library function with an effect does not perform it when it executes. It appends
a record to the pending effect list, holding the function index and the argument
values as they stood, and pushes absent as its result. The list is discarded at
step 3 of every execution and applied at step 9 only when the bar is confirmed, or
when `meta.onUnconfirmed` is true.

The consequence is the one `language.md` section 7.5 promises: a condition that was
true halfway through a bar and false when it closed never places an order at all,
because the execution that produced the pending record was thrown away and the
execution that decided the bar produced no such record.

An order function returning absent while deferred is deliberate. The alternative,
inventing an order id at call time, would hand the script an identifier for
something that may never exist. A script that needs to act on a placed order reads
the `pos` and `order` namespaces on the next bar, where the fact is real.

**An alert is raised only on a bar the host is driving live.** Deferral covers
half of when an alert fires: the condition channel is applied at step 9, so a
condition that was true halfway through a bar and false when it closed never
fires. The other half is that adding a study to a chart that already holds
history fires nothing for those bars (`stdlib.md` section 16.2), and the fact
that separates a bar of history from the bar in front of you is `bar.isRealtime`,
which the host states and no engine can derive (`host-interface.md` section 6.1).
So an engine raises the alerts of `outputs.alerts` at step 9 on a bar it decided
and the host stated `isRealtime` for, and on no other bar. An engine that only
backtests is handed `isRealtime` false throughout and raises none, which is the
same answer reached from the other side.

**What a raised alert carries** is the entry's `key`, its `title`, the value the
message channel held for that bar, the bar's index in this run and the bar's open
time. That is the whole payload, and it is fixed here because a host cannot
compose a notification out of fields that differ between engines. The message is
whatever the channel held, absence included: a message built out of a value that
was absent during warmup is absent, and an engine that substituted an empty
string for it would hide the one thing the author needs to see. Both the index
and the time are carried because they answer different questions: the index
locates the bar in the run the host has just computed, and the time is the one
that still means the same bar after more history loads.

The frequency of section 2.8 is applied on top of that, and neither it nor a
firing is rolled back. A moving bar's executions are discarded before they are
decided, so nothing is fired to take back; once one has been raised it has been
sent, and section 6's restore does not unsend it.

### 5.5 The loop budget

The counter is set to zero at step 3 and incremented by one for each `TICK`
executed, including every `TICK` inside a user function called from the bar. When
the count would exceed `limits.loops`, the engine raises OS5001, names
`loops[l].line`, and stops the bar.

The budget is per bar rather than per loop so that ten sequential loops and one
nested loop are treated alike, and it resets each bar so that a long dataset is
never itself a reason to fail.

---

## 6. State, checkpoints, rollback and replay

One mechanism serves three purposes: making a moving bar idempotent, letting a
debugger step backwards, and making a chart replay exact. They are the same
problem, and an engine that implements the checkpoint gets all three.

### 6.1 What a checkpoint holds

A checkpoint taken at the end of bar `i` holds:

| Content | Note |
|---|---|
| Every cell, `"var"` and `"live"` alike, with its initialised flag | |
| Every library state region | |
| The object heap, restricted to what is reachable from the above | Sharing preserved, section 6.2 |
| The strategy's position, pending orders, equity and trade list | Strategies only |
| The history length of every series register, which is `i + 1` | The entries themselves are append only |

A checkpoint does not hold the operand stack, the frame slots, the channels, the
pending effects or the loop counter, because step 3 of the next execution clears
all of them anyway.

### 6.2 Restoring one

A restore replaces every region above with its recorded contents. Two requirements
that are easy to get wrong:

- **Sharing is preserved.** If two cells held the same array before the checkpoint,
  they hold the same array after the restore, and a `push` through one is visible
  through the other. A restore that deep copied each cell separately would turn one
  array into two and would change what the script computes.
- **Library state is restored wholesale**, not recreated. An engine does not
  re-seed an `ema` from history; it puts back the record it copied. This is why
  section 2.11 requires a state region to be mechanically copyable.

An engine may implement a checkpoint however it likes: a full copy, copy on write,
an undo journal, or nothing at all when it can prove the state is unchanged. **The
specification requires the semantics, not the representation.** An engine that only
ever runs history and never re-executes a bar may keep one checkpoint; an engine
backing a debugger keeps many.

### 6.3 The rollback rule

Before re-executing bar `i`, the engine restores the checkpoint from the end of bar
`i - 1`, **except** that cells declared `"live"` keep their current values.

That exception is the whole of `live var` (`language.md` section 8.2). Everything
else rolls back, so executing a moving bar ten times gives the same answer as
executing it once, and a live chart agrees with a backtest of the same data.

A `"live"` cell is still written into the checkpoint even though rollback skips it,
so that a debugger stepping backwards can show what the value actually was rather
than what a replay would recompute. A script using `live var` is not reproducible
by design, and recording the value is the only honest way to show it.

### 6.4 The replay invariant

**Restoring the checkpoint taken at the end of bar `j` and then executing bars
`j + 1` through `k` must produce state and output for bar `k` that is identical, bit
for bit, to the original run's.**

This is the property a chart replay, a step-backwards debugger and a reproducible
backtest all rest on, and it is testable rather than aspirational: the conformance
suite runs a program over `n` bars, then for each `k` restores the checkpoint at
`k - 1`, re-runs bar `k`, and compares every channel, every cell and every state
region. A difference is a failing engine.

The invariant holds only because execution reads nothing but the checkpoint, the
bar and the settings. Section 8 is the list of ways an engine could break it.

### 6.5 Stepping

A debugger steps **forward** by executing one bar. It steps **backward** by
restoring the checkpoint at `k - 2` and executing bar `k - 1`, or, where an engine
keeps sparse checkpoints, by restoring the nearest earlier one and replaying
forward. Either way the invariant makes the result exact.

Within a bar, `debug.pos` gives the source line and column of every instruction, so
a stepper can walk instruction by instruction and show the position. An engine that
wants to step backwards within a bar records the stack and slots per instruction;
that is permitted and is not required, because it changes nothing a script can
observe.

---

## 7. Warmup and the absent value

**There is no warmup field in a compiled program, and there is no warmup phase in
an engine.** The script runs on bar 0 exactly as it runs on bar 40,000.

Warmup is entirely the absent value:

- A library function that needs `k` values returns absent until it has seen `k`.
  The count lives in its state region, so a call that does not execute on some bar
  does not count that bar.
- `HIST` past the start of the dataset is absent.
- A cell that has not been initialised is absent.
- A channel nothing wrote is absent, and a plot column with `null` is a gap.

The compiler could have emitted a warmup length per plot for a host to trim, and
does not, because a declared number would be a second source of truth about when a
line starts and the two could disagree. The line starts on the bar the value stops
being absent, and there is nowhere for that to be wrong.

**Absence propagates through arithmetic and ordering comparison, is total under
equality, is three-valued under `and`, `or` and `not`, and is false at a branch.**
Those five rules are implemented by the instructions of sections 4.5 to 4.8 and by
nothing else. An engine that gets all five right has the whole of `language.md`
section 6, and an engine that special cases absence anywhere else has a bug.

At the boundary, absence is `null`: in a plot column, in a level's price, in a
table cell, in an alert message, in anything an engine hands a host.

---

## 8. Determinism

Two engines running the same compiled program over the same bars must produce the
same output, to the last bit, on every machine, every operating system and every
run. This section is the list of things an engine may not do. Each one has cost
somebody a mismatched backtest somewhere.

### 8.1 Floating point

- Every arithmetic operation is IEEE-754 binary64 with round-to-nearest, ties to
  even.
- **Operations happen in the order the instructions give.** An engine may not
  reassociate, may not distribute, may not fuse a multiply and an add into a single
  rounding, may not vectorise in a way that changes the order of a sum, and may not
  hoist an operation out of a loop if doing so changes when it rounds.
- **No extended precision.** An engine on hardware with wider internal registers
  must round every intermediate to binary64 before it is used again. In practice:
  use the double precision path rather than an eighty bit stack, store each
  intermediate to a binary64 variable, and turn off the compiler flags that permit
  unsafe maths.
- **No flush to zero and no denormals as zero.** Subnormal results are computed
  exactly as IEEE-754 says.
- **The rounding mode is never changed** while a program runs.
- Negative zero is normalised to positive zero at every store and every result
  (section 3.1).
- A non-finite result becomes absent, checked after each operation (section 3.1).

### 8.2 Order of evaluation

- Arguments are evaluated left to right, as the instruction order shows.
- Both operands of a binary operator are evaluated left to right, except where
  `AND_SHORT` or `OR_SHORT` skips the right one.
- A short circuit is an instruction, not a choice: whether the right operand runs is
  observable through the state of any stateful call inside it.
- Iteration over an array is index order. Version 1 has no unordered collection.
- Statements run in source order, which is instruction order.

### 8.3 The standard library

The library is where determinism is actually won or lost, because a moving average
is a sum and a sum has an order.

- **A library function's result is defined by the accumulation order `stdlib.md`
  section 20 states.** An engine may use any algorithm that is bit-identical to
  it, and no other. Specifically, an incremental rolling sum that subtracts the
  outgoing value and adds the incoming one is **not** bit-identical to a fresh sum
  over the window, so it is permitted only for a function that section 20 defines
  the incremental form for, and section 20.2.1 defines it for none of them. The
  anchored running totals of section 20.6 are not this: they have no window to
  sum, so they are a different quantity rather than a cheaper way to compute the
  same one.
- **Transcendental functions do not use the platform's maths library.** `exp`,
  `log`, `pow`, the trigonometric functions and anything built on them are computed
  by a portable reference algorithm rather than by the host's. A platform's own
  implementation is correct to within an ulp or so and differs between platforms in
  the last bit, which is precisely the difference this project has declared a
  release blocker. The cost is a slower `pow`; the alternative is a chart and a
  backtest that disagree in the fourth decimal and no way to say which is right.
  `stdlib.md` sections 20.10.1 through 20.10.4 specify the portable algorithms.
  Each result is rounded once from a certified enclosure or an exact rational
  value. `sqrt` uses its correctly rounded host operation, as required by
  IEEE-754; conforming platforms return the same bits.
- **Number to string conversion is specified.** `text(x)` produces the shortest
  decimal string that reads back as the same binary64 value. `text(x, d)` rounds to
  `d` decimals, ties away from zero, and always emits exactly `d` digits after the
  point. Ties away from zero rather than ties to even because this is a display
  conversion and half up is what a reader of a price expects, and because the
  choice has to be written down somewhere or two engines will label the same bar
  differently.
- **String to number is specified** by `language.md` section 5.3, and returns
  absent for anything it does not parse.

### 8.4 Nothing outside the program

- No randomness. There is no random function in version 1 and no source of entropy
  in an engine.
- No wall clock during a bar, except `chart.now()`, whose value the host supplies
  and the conformance suite fixes.
- No locale. Number formatting, string comparison and case conversion are defined
  by the manifest and by Unicode, never by an environment setting.
- No timezone from the environment. The chart's zone is a host fact and an IANA
  zone name, never a fixed offset, because a fixed offset is silently wrong for
  half the year anywhere that observes a seasonal clock change.
- No iteration over a hash table's natural order, anywhere, for anything a script
  can observe.
- No concurrency that a script can observe. An engine may use threads, and the
  result must be what a single pass in instruction order would have produced.

### 8.5 The budget is part of the semantics

Two engines must fail at the same iteration of the same loop on the same bar, so
the loop budget counts `TICK` executions and nothing else (section 5.5). An engine
that counted its own instructions, or measured time, would make a script that runs
on one engine fail on another.

---

## 9. Versioning and compatibility

### 9.1 Two versions, two jobs

`openscript.format` versions **this document**: the field names, the instruction
set, the encoding. `openscript.language` versions **meaning**: the front end that
parsed the source and the library semantics the engine must apply.

An engine declares what it implements:

| Declares | Means |
|---|---|
| Format majors | Which majors it can load, and the highest minor of each |
| Language versions | Which language versions it has library semantics for |
| Capabilities | The tags of section 2.2 |
| Limits | Maximum instructions, cells, states, frame depth, loop budget it will allow |

### 9.2 What a minor bump may do

A minor bump of the format may:

- Add a field to any object, where an engine that ignores the field computes
  exactly the same numbers.
- Add an entry kind to a table that is only reachable from a new field.
- Add a capability tag.
- Add metadata, including anything under `debug` and `compiler`.
- Tighten a rule that no valid program could have depended on, such as a
  verification check that only rejects programs that were already malformed.

A minor bump may **not** add an instruction, change what an instruction does,
change an instruction's operand count, change the constant pool encoding, change
the canonical form, add a required field, or change any default in `meta`.

The guarantee that makes this work: **any field whose absence would change a number
must be announced by a capability tag in `requires`.** Given that, an older engine
may ignore a field it does not recognise, because anything that mattered would have
been named in a tag it did not have. Without that rule an older engine would have
to refuse every program from every later minor, and a minor bump would be a major
one wearing a smaller number.

**Format 1.1 added `requests` (section 2.16)**, the `"request"` and `"input"`
register kinds it reaches, and verification check 11. A program without a read
carries `"requests": []` and is otherwise byte for byte what format 1.0 emitted.
A program with one names `req.timeframe` or `req.symbol` in `requires`, so an
engine built for 1.0 refuses it at step 4 rather than drawing a study with a
silently empty line through it.

### 9.3 What a major bump may do

A major bump may do anything this document forbids a minor one: add or remove an
instruction, change an instruction's meaning, renumber or restructure a table,
change the encoding. It is a different format that happens to share a name.

A major bump is not a way to change what an existing program computes. A program
carries its `language` version, and a compiler that emits a new format from old
source emits a program that computes the same numbers, because `language.md`
section 4.1 binds the project to that whatever the format does.

### 9.4 How an engine refuses

At load, in this order, stopping at the first failure:

1. Parse the canonical encoding. A parse failure is OS6018, and so is text that
   parses but is not the canonical encoding of what it parses to, each naming
   where the text stops being readable or stops being canonical. This step is
   about text: a program an engine reads from outside its process arrives as
   the canonical encoding, and its hash was taken over those bytes. An object
   built in the same process by the compiler beside the engine was never text,
   has nothing to be canonical about, and enters at step 2 (section 13).
2. Read `openscript.format`. If the major is higher than any the engine implements,
   refuse with OS6016, naming the program's format and the highest the engine has.
   If the major is one the engine does not implement at all, refuse the same way; an
   engine never makes a best effort at a format it does not have.
3. If the major matches and the minor is higher than the engine's, continue. A
   minor bump is additive by section 9.2, and step 4 catches anything that is not.
   If the minor is lower than the engine's, continue as well: a table a later
   minor added and this program lacks reads as empty, never as a refusal,
   because section 9.5's first line is a promise about exactly this program. A
   compiler always stamps the minor it emits, the current one, and never a
   lower one, so a lower minor is an older program and nothing else. A program
   at the engine's own minor or a later one is owed no such reading: section 2
   says an empty table is written as an empty array and never omitted, so a
   table missing there fails step 8.
4. Check every tag in `requires`. Refuse with OS6006 at the first tag the engine
   does not have, naming the tag.
5. Read `openscript.language`. If the engine has no library semantics for that
   version, refuse with OS6017, naming the version.
6. Check `lib.functions` against the manifest for that language version. Refuse
   with OS6004 on the first mismatch, naming the function and what disagreed.
7. Check the program against the engine's declared limits: OS5009 for the
   instruction count, OS5004 for the state region count, OS5005 for the call
   depth, each naming the limit and the program's value.
8. Verify the program (section 3.5). Refuse with OS6018, naming the instruction
   index, or the field where the failure is not in an instruction list.

Every refusal names what is missing and what would fix it. "This program is too
new" is not a message an engine is allowed to stop at.

### 9.5 What never changes

- A program that ran yesterday runs today and produces the same numbers.
- A program's numbers depend on `openscript.language` and on nothing about the
  engine, its version, its host or its machine.
- An engine upgrade never changes a stored backtest result. A host that recorded
  the source hash and the program hash can prove it.

---

## 10. Errors an engine raises

Every failure carries a stable code, a source line and column where one exists, a
message and a fix, as `language.md` section 16 requires. `errors.md` is the
catalogue and the authority.

Codes this document uses that the catalogue already carries:

| Code | Raised when |
|---|---|
| OS3004 | A loop step is zero, or an argument value is out of range |
| OS4001 | A history index is negative or not a whole number |
| OS4002 | A history index is past the retained depth |
| OS4004 | An array index is outside the array |
| OS5001 | The per-bar loop budget is spent |
| OS5003 | A host refuses the program's `limits()` |
| OS5004 | The program needs more state regions than the engine allows |
| OS5005 | A construct nests deeper than the engine allows, including call depth |
| OS5009 | The program holds more instructions than the engine allows |
| OS6004 | A library entry disagrees with the engine's manifest |
| OS6006 | The program requires a capability this engine does not have |
| OS7002 | An order argument is absent |

Codes this document introduces, to be carried in the catalogue:

| Code | Raised when |
|---|---|
| OS4013 | A `for` loop's start, limit or step is absent |
| OS6016 | The compiled format version is not one this engine implements |
| OS6017 | The program's language version is not one this engine implements |
| OS6018 | The compiled program is malformed or fails verification |
| OS6019 | A host setting fails an input's declared validation, or fails the declaration field an `{ "input": ... }` reference put it in |

A load-time refusal carries no line, because the failure is in the program rather
than in the source; it carries the instruction index, or the field where the
failure is not in an instruction list, which is the one location its message
names (section 3.5). An error raised during execution carries the line and column
from `debug.pos` for the instruction that raised it, and for OS5001 the line of
the loop rather than the line of whatever was executing.

---

## 11. Becoming a chart

An engine computes columns. Turning them into a drawing is a separate job, done by
a separate module, and it is a mapping rather than a decision:

| Compiled program | Chart descriptor |
|---|---|
| `meta.title`, `meta.short`, `meta.group` | Name and category |
| `meta.overlay` | Price pane or its own pane |
| `meta.precision`, `meta.format` | Value formatting for the pane's scale |
| `meta.range` | Fixed pane range |
| `inputs[]` | The settings rows, by `kind` |
| `outputs.plots[]` and their channels | One column per plot, `null` for a gap |
| `outputs.fills[]` | Shaded bands between two plot keys, in a colour per bar where the program computes one |
| `outputs.levels[]` | Horizontal reference levels, from the last bar's value |
| `outputs.markers[]` | Bar anchored markers |
| `outputs.tables[]` | Summary grids, each pinned to a corner |
| `outputs.alerts[]` | Conditions the runtime watches |
| `outputs.barColor` | Recolouring of the price bars |
| `outputs.background` | Per-bar shading behind the pane |
| The drawing objects the script holds | The free drawings the host redraws each recompute |
| `requests[]` | The host's fetch for another instrument, and the study's data status |

The mapping is listed here so that an independent engine knows what its output is
for, not because an engine must perform it. An engine that only backtests produces
the same columns and hands them to a report instead.

The last two rows are the two that are not fields of `outputs`, and each is read
from somewhere else for a reason section 2.8 already gives. The drawing objects
are in the object heap because their set is unbounded and changes as bars arrive,
which is the whole difference from a plot. The reads are in `requests` because
their identity is fixed before bar 0 and the host answers them there.

**The whole set of drawing objects is handed over after every execution, and it
replaces what was handed over before.** There is no instruction to add one, none
to remove one and no field in the compiled program for the live set: an engine is
asked what the script holds now, and what it holds now is the answer. Three
things follow, and they are the reason this is a rule rather than an engine's
choice. An object the script deleted is simply not in the set, so nothing has to
be told about deletion. A bar that re-executes has already rolled its objects back
(section 6.3), so the set after five updates to a moving bar is the set after one,
and a host that redraws what it is given accumulates nothing. And an anchor is
carried in the unit `bar.time` is carried in, so a host whose chart counts time
differently converts an anchor exactly where it converts a bar, and nowhere else.

**A read of another instrument is asked once and may be answered later.** The set
of reads is settled at load and a host is asked about each one there, which is
what lets it fetch in parallel; a host that has not fetched yet says so, the read
is absent, `req.isReady` is false and the study draws everything that does not
depend on it (`stdlib.md` section 15.5). An answer arriving afterwards is a fresh
load and a recalculation over the whole history, never a splice into a run already
past the bars it would have changed.

**Only one study may own the instrument's candles.** Every other output on that
table belongs to the study that produced it: two studies plotting a line draw two
lines, and two shading a pane background compose, because a colour carries its
own alpha and two translucent shadings are two drawings that overlap. The price
bars are not like that. They are one object, drawn once, and `outputs.barColor`
is a statement about them rather than about the study, so two studies painting
them is not an overlap, it is two answers to one question.

The rule is that **the owner is the study latest in the host's own study order
that declares a `barColor`**, and every other study's bar colouring is not drawn.
Two things about it matter more than which end of the list wins. It is decided
from the list of studies, which is what a legend shows and what a user reorders,
rather than from the order the calculations returned in, so it does not move when
one study is slower than another on a frame. And it changes only when a user adds,
removes or reorders a study, so the candles do not alternate between two
colourings while both studies keep recomputing. A host that draws the study list
in the other order applies the rule in that order: what is fixed is that the rule
is the order the user sees, stated, rather than whichever study ran last.

**A host draws what its surface has room for, and refuses what it does not.** The
table above is what a program can carry, and a host's surface may be narrower: a
chart pane with one grid, a band drawn in one colour for the whole run, and the
same host may be narrower on an older version of its chart than on a newer one.
The difference is allowed and invisible is not. A host that cannot draw a declaration
refuses the program before any bar runs with OS6024, naming the declaration and
its own reason, rather than drawing part of the study and saying nothing. A host
that can draw all of it refuses nothing, which is why this is a host's refusal and
never the compiler's: the program is correct, and another host may draw every
line of it.

---

## 12. A worked example

A short script, its compiled program in full, and a bar by bar trace including a
re-executed moving bar. It is a few lines longer than the smallest thing that would
compile, because it has to exercise an input, a stateful library call, a value that
persists across bars, a branch, a marker, a plot and warmup, and five lines cannot.

### 12.1 The source

```
 1  version 1
 2
 3  study("Two bar mean", overlay = true)
 4
 5  len = input(2, "Length")
 6  avg = sma(close, len)
 7  var hits = 0
 8
 9  if close > avg
10      hits = hits + 1
11      signal("UP")
12
13  plot(avg, "Mean", aqua)
```

`sma(src, len)` is absent until it has seen `len` values, and is otherwise the sum
of the last `len` values in oldest to newest order, divided by `len`. That order is
`stdlib.md` section 20.2.1's, and section 8.3 is why it is written down.

### 12.2 The compiled program

```json
{
  "openscript": { "format": "1.1", "language": 1 },
  "requires": ["core.1"],
  "compiler": { "name": "openscript", "version": "0.1.0" },
  "source": {
    "hash": "sha256:9f2c1b7e4a6d508fb3c0e21d7a4f8b95c6d3e07a1b2c4d5e6f708192a3b4c5d6",
    "lines": 13,
    "file": "two-bar-mean.osc"
  },
  "meta": {
    "kind": "study",
    "title": "Two bar mean",
    "short": "Two bar mean",
    "overlay": true,
    "precision": 4,
    "format": "price",
    "range": null,
    "scale": "right",
    "group": "",
    "onUnconfirmed": false
  },
  "limits": { "loops": 2000000, "history": null },
  "lib": {
    "manifest": 1,
    "functions": [
      { "name": "sma", "arity": 2, "state": true, "effect": "none" }
    ]
  },
  "inputs": [
    {
      "key": "len", "kind": "number", "label": "Length", "default": ["n", 2],
      "min": null, "max": null, "step": null, "options": null,
      "group": "", "tooltip": null, "slot": 0
    }
  ],
  "channels": [
    { "id": 0, "type": "number", "defer": false, "once": true },
    { "id": 1, "type": "string", "defer": true, "once": false }
  ],
  "outputs": {
    "plots": [
      {
        "key": "p0", "title": "Mean", "type": "line", "channel": 0,
        "color": [0, 255, 255, 1], "colorChannel": null,
        "width": 1.5, "lineStyle": "solid", "offset": 0,
        "overlay": null, "scale": "right",
        "precision": null, "priceFormat": null, "ohlc": null
      }
    ],
    "fills": [],
    "levels": [],
    "markers": [
      {
        "key": "m0", "channel": 1, "position": "above", "shape": "label",
        "color": null, "textColor": null
      }
    ],
    "tables": [],
    "alerts": [],
    "barColor": null,
    "background": null
  },
  "consts": [
    ["z", null], ["b", false], ["b", true],
    ["n", 0], ["n", 1], ["s", "UP"]
  ],
  "series": [
    { "id": 0, "kind": "bar", "field": "close", "name": "close" }
  ],
  "frame": { "slots": 2 },
  "cells": [ { "id": 0, "kind": "var", "name": "hits" } ],
  "states": [ { "id": 0, "fn": 0 } ],
  "functions": [],
  "callSites": [],
  "loops": [],
  "code": [
    ["SLOAD", 0],
    ["LOAD", 0],
    ["CALL_LIB", 0, 2, 0],
    ["STORE", 1],
    ["CELL_INIT", 0, 7],
    ["CONST", 3],
    ["STOREC", 0],
    ["SLOAD", 0],
    ["LOAD", 1],
    ["GT"],
    ["JUMP_FALSE", 17],
    ["LOADC", 0],
    ["CONST", 4],
    ["ADD"],
    ["STOREC", 0],
    ["CONST", 5],
    ["EMIT", 1],
    ["LOAD", 1],
    ["EMIT", 0],
    ["HALT"]
  ],
  "debug": {
    "pos": [
      [0, 6, 11], [1, 6, 18], [2, 6, 7], [3, 6, 1],
      [4, 7, 1], [5, 7, 12], [6, 7, 1],
      [7, 9, 4], [8, 9, 12], [9, 9, 10], [10, 9, 1],
      [11, 10, 12], [12, 10, 19], [13, 10, 17], [14, 10, 5],
      [15, 11, 12], [16, 11, 5],
      [17, 13, 6], [18, 13, 1], [19, 13, 1]
    ],
    "fnPos": [],
    "names": {
      "slots": ["len", "avg"],
      "cells": ["hits"],
      "series": ["close"],
      "channels": ["Mean", "UP"]
    },
    "retain": false
  },
  "requests": []
}
```

Reading it back to the source: instruction 0 to 3 is line 6, 4 to 6 is the `var` on
line 7, 7 to 10 is the `if` on line 9, 11 to 14 is line 10, 15 to 16 is the
`signal` on line 11, and 17 to 19 is the `plot` on line 13 plus the terminator.
There is no instruction for `input()`: the engine writes the effective value into
slot 0 at step 5 of every bar. There is no instruction for `study()` or for the
plot's declaration: both are in `meta` and `outputs`, read once.

`requires` is just `core.1`: no arrays, no user functions, no loops, no orders.
`requests` is empty, and written out, because an empty table is an empty array.

### 12.3 The bars

| Bar | close | State |
|---|---|---|
| 0 | 100 | confirmed |
| 1 | 102 | confirmed |
| 2 | 101 | confirmed |
| 3 | 105 | confirmed |
| 4 | moving | executed twice, see 12.6 |

### 12.4 Bar 0, instruction by instruction

Before step 6: cell 0 uninitialised, state region 0 empty, register 0's history
empty, register 0's current cell is 100, slot 0 is 2 from the input, slot 1 is
absent, both channels absent.

| pc | Instruction | Stack after | Note |
|---|---|---|---|
| 0 | `SLOAD 0` | `100` | close |
| 1 | `LOAD 0` | `100, 2` | len |
| 2 | `CALL_LIB 0, 2, 0` | `none` | region 0 becomes `{queue: [100], seen: 1}`. One value, two needed |
| 3 | `STORE 1` | | avg is absent |
| 4 | `CELL_INIT 0, 7` | | uninitialised: mark it, fall through |
| 5 | `CONST 3` | `0` | |
| 6 | `STOREC 0` | | hits is 0 |
| 7 | `SLOAD 0` | `100` | |
| 8 | `LOAD 1` | `100, none` | |
| 9 | `GT` | `none` | an ordering comparison with an absent operand is absent |
| 10 | `JUMP_FALSE 17` | | absent takes the false branch |
| 17 | `LOAD 1` | `none` | |
| 18 | `EMIT 0` | | the plot column gets absent |
| 19 | `HALT` | | the stack is empty, as the verifier proved it would be |

After: plot column at bar 0 is `null`, no marker. Checkpoint 0 holds
`hits = 0`, `{queue: [100], seen: 1}`, and a history length of 1.

The whole of warmup is on lines 2, 9 and 10 of that table: the library function has
not seen enough values, the comparison is absent rather than false, and the branch
is not taken. Nothing declared a warmup length and nothing had to.

### 12.5 Bar 1, instruction by instruction

| pc | Instruction | Stack after | Note |
|---|---|---|---|
| 0 | `SLOAD 0` | `102` | |
| 1 | `LOAD 0` | `102, 2` | |
| 2 | `CALL_LIB 0, 2, 0` | `101` | region 0 becomes `{queue: [100, 102], seen: 2}`, and `(100 + 102) / 2` is 101 |
| 3 | `STORE 1` | | avg is 101 |
| 4 | `CELL_INIT 0, 7` | | already initialised: jump to 7, the initialiser never runs again |
| 7 | `SLOAD 0` | `102` | |
| 8 | `LOAD 1` | `102, 101` | |
| 9 | `GT` | `true` | |
| 10 | `JUMP_FALSE 17` | | true: fall through |
| 11 | `LOADC 0` | `0` | |
| 12 | `CONST 4` | `0, 1` | |
| 13 | `ADD` | `1` | |
| 14 | `STOREC 0` | | hits is 1 |
| 15 | `CONST 5` | `"UP"` | |
| 16 | `EMIT 1` | | the marker channel holds "UP" |
| 17 | `LOAD 1` | `101` | |
| 18 | `EMIT 0` | | |
| 19 | `HALT` | | |

Bar 1 is confirmed, so step 9 applies the deferred marker channel and a marker is
drawn above bar 1.

### 12.6 Bars 0 to 4

| Bar | close | State region 0 after the call | avg | close > avg | hits | Plot column | Marker |
|---|---|---|---|---|---|---|---|
| 0 | 100 | `{[100], 1}` | absent | absent | 0 | `null` | none |
| 1 | 102 | `{[100, 102], 2}` | 101 | true | 1 | 101 | UP |
| 2 | 101 | `{[102, 101], 3}` | 101.5 | false | 1 | 101.5 | none |
| 3 | 105 | `{[101, 105], 4}` | 103 | true | 2 | 103 | UP |
| 4 first execution | 106 | `{[105, 106], 5}` | 105.5 | true | 3 | 105.5 | held |
| 4 second execution | 104 | `{[105, 104], 5}` | 104.5 | false | 2 | 104.5 | none |

Every value in the table is exact in binary64: `(100 + 102) / 2`,
`(102 + 101) / 2`, `(101 + 105) / 2` and `(105 + 104) / 2` all divide by two.

### 12.7 The moving bar, and what rollback is for

Bar 4 is the newest bar of a live chart. It is executed once when the price is 106
and again when the price has fallen back to 104.

Checkpoint 3, taken at the end of bar 3, holds `hits = 2`,
`{queue: [101, 105], seen: 4}`, and a history length of 4.

**First execution**, price 106. This is the first execution of bar 4, so nothing is
restored. The library call pushes 106 onto `[101, 105]`, giving `[105, 106]` and an
average of 105.5. 106 is above 105.5, so `hits` becomes 3 and the marker channel is
written. Bar 4 is not confirmed and `meta.onUnconfirmed` is false, so step 8
publishes the plot column, 105.5, and step 9 discards the marker.

**Second execution**, price 104. Step 1 restores checkpoint 3: `hits` goes back to
2 and the state region goes back to `{queue: [101, 105], seen: 4}`. Step 2 truncates
the history to four entries. The library call then pushes 104, giving `[105, 104]`
and an average of 104.5. 104 is below 104.5, so the branch is not taken, `hits`
stays 2 and no marker is written. The plot column for bar 4 is rewritten to 104.5.

**Without the restore**, the second execution would have pushed 104 onto
`[105, 106]`, giving `[106, 104]` and an average of 105, which is a number that
corresponds to no two bars on the chart. `hits` would have stayed at 3, counting a
crossing that did not happen, and the same script would produce different numbers
on a live chart than in a backtest of the same data.

That is the whole argument for section 6 in one table row.

---

## 13. Conformance checklist

An engine claims conformance to compiled format 1.1 and language 1 when all of the
following hold, and the conformance suite tests each one.

**Loading**

- [ ] Reads a program that arrives as text by parsing the canonical encoding, and
      refuses text that is not it with OS6018 (section 9.4, step 1). Canonicity
      is required of the text an engine reads from outside its process; an
      object built in the same process is the post-parse half of that step and
      enters section 9.4 at step 2.
- [ ] Performs every verification check of section 3.5 before executing a bar.
- [ ] Refuses in the order of section 9.4, with the code and the named cause.
- [ ] Declares its format majors, language versions, capabilities and limits.

**The machine**

- [ ] Implements all forty-one instructions of section 4, with the stated stack
  effect.
- [ ] Implements six value tags, with absence as its own tag and never a number.
- [ ] Keeps numbers finite, normalises negative zero, and measures strings in code
      points.
- [ ] Addresses cells and state regions through the frame's bases, so one function
      body serves many call sites.
- [ ] Evaluates each read's body (section 2.16) over the requested bars against
      the body's own tables, or declares neither `req.timeframe` nor `req.symbol`
      and refuses such a program at load with OS6006.
- [ ] Folds a read onto the chart's bars by section 2.16.2, taking each mode's
      horizon and stepping a confirmed read on the first chart bar of the next
      bucket.

**Per bar**

- [ ] Runs the eleven steps of section 5.1 in order.
- [ ] Clears exactly what section 5.3 says to clear, and keeps exactly the rest.
- [ ] Charges the loop budget once per `TICK` and raises OS5001 at the same
      iteration as every other engine.
- [ ] Holds deferred channels and pending effects on an unconfirmed bar, and
      discards rather than applies them when the bar is re-executed.

**State**

- [ ] Takes a checkpoint holding everything section 6.1 lists.
- [ ] Restores it before re-executing a bar, exempting `"live"` cells.
- [ ] Preserves object sharing across a restore.
- [ ] Hands over the whole live object set after every execution, in creation
      order, with every anchor resolved and with nothing left from an execution
      that was rolled back (section 11).
- [ ] Satisfies the replay invariant of section 6.4 for every bar of every
      conformance case.

**Determinism**

- [ ] Does nothing in section 8's list of prohibitions.
- [ ] Matches the accumulation order of `stdlib.md` section 20 for every library
      function.
- [ ] Uses the portable algorithms for elementary functions specified in
      `stdlib.md` sections 20.10.1 through 20.10.4.
- [ ] Produces byte-identical output to the reference engine on every conformance
      case.

The last line is the only one that cannot be satisfied by reading this document
carefully, and it is the one that matters: a backtest that disagrees with the chart
is worthless, so cross-engine equality is a release blocker rather than a target.
