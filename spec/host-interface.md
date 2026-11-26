# OpenScript host interface specification

Version of this document: draft, tracking language version 1 and compiled format
version 1.0.

This document defines the **host interface**: everything a platform supplies so
that an OpenScript engine can run a compiled program, and everything the engine
hands back. It is the document a platform reads to adopt OpenScript, and it is
written so that a platform can implement it from this page, `compiled-program.md`
and `stdlib.md` alone, without reading a line of anyone's implementation.

A host is whatever already owns the data and the account: a charting product, a
trading terminal, a backtest harness, a research notebook, an exchange's own web
application. OpenScript assumes none of them. It assumes six answers.

The reason to write this down separately is that it is what makes OpenScript a
standard rather than a library. A library is adopted by importing it. A standard
is adopted by implementing an interface, and an interface nobody can implement
without reading the reference implementation is not an interface, it is a
reference implementation with documentation attached.

## Contents

1. [How to read this document](#1-how-to-read-this-document)
2. [The six duties](#2-the-six-duties)
3. [Bars](#3-bars)
4. [Instrument facts](#4-instrument-facts)
5. [Bars for another instrument or timeframe](#5-bars-for-another-instrument-or-timeframe)
6. [Bar state](#6-bar-state)
7. [Orders](#7-orders)
8. [Settings storage](#8-settings-storage)
9. [Identity: a symbol is opaque](#9-identity-a-symbol-is-opaque)
10. [Conformance](#10-conformance)

---

## 1. How to read this document

**Must, may, never.** "Must" is a requirement on a conforming host or a conforming
engine. "May" marks a genuine choice, and every use of it says what the choice may
not change. "Never" is a prohibition.

**Host, engine, compiler.** The **compiler** turns source text into a compiled
program. The **engine** loads a compiled program and runs it over bars. The
**host** is everything else: it supplies the bars, the facts about the instrument,
the settings a user typed, a surface to draw on and a destination for orders.
Nothing here requires the three to be written by the same people, in the same
language, or to run in the same process.

**Shapes, not a transport.** Every shape below is a set of named facts, their
types and their meanings. This document fixes what the facts are and when they are
exchanged. It does not fix a wire format, a function naming style, a threading
model or a storage medium. Where a shape is shown as an object it is written in
the canonical encoding of `compiled-program.md` section 2.14, because a reader
needs something concrete to hold; a host that passes the same facts as positional
arguments to a function call is implementing the same interface.

**Timing.** Step numbers refer to the steps of the bar cycle
(`compiled-program.md` section 5.1). **At load** means before step 1 of bar 0.
**Between bars** means after step 11 of one execution and before step 1 of the
next. Nothing arrives during step 6: an execution reads the checkpoint, the bar
and the settings and nothing else, which is the only reason the replay invariant
of `compiled-program.md` section 6.4 holds. A host that could change an answer
halfway through a bar would produce a chart that cannot be replayed and a
backtest that cannot be reproduced.

**When the host cannot answer.** Every duty below ends with that heading, because
it is the half of an interface that is usually left out and always needed. There
are three outcomes and never a fourth:

1. **The absent value**, where the language has one and a script can test it with
   `isNone`. This is the answer for a fact that is simply not known.
2. **A catalogued error**, which stops the bar or the run, carries a stable code
   and carries the host's own words for the reason rather than a paraphrase.
3. **A refusal at load**, which is better than a failure halfway through a bar
   with half a chart already drawn.

A guess is never one of the outcomes. A tick size invented as `0.01`, a zero
standing in for an unknown volume, a price carried forward from the previous bar:
each produces a number that looks computed, and a number that looks computed is
worse than no number, because nothing downstream can tell that it is not one.

**Error codes.** `errors.md` is the catalogue and the authority. Every code cited
here is defined there. Which document wins where two of them disagree is settled
once: the specification's documents are the ones `spec/README.md` lists, with the
precedence it gives them.

**What a host may add.** A host may hold and show anything it likes beside a
script. Nothing in the language reads it. A fact no script can name is a fact no
script can be written against, which is exactly what keeps a script portable from
one host to another.

---

## 2. The six duties

| Duty | The host supplies | Read | Optional |
|---|---|---|---|
| 1. Bars | Open, high, low, close, volume, time, oldest first | Step 4 of every execution | No |
| 2. Instrument facts | The instrument record, section 4.1 | At load, once | No |
| 3. Bars on request | Another instrument's bars, or another timeframe's | Between bars, when the answer lands | Yes |
| 4. Bar state | The bar state, section 6 | Step 4 of every execution | No |
| 5. Orders | A destination for order intents, and frames reporting what became of them | Step 9, and between bars | Yes |
| 6. Settings storage | A value per input key | At load, once | Yes |

An engine reads what `compiled-program.md` section 5.2 lists and nothing else.
This table is that list cut by duty: each row names a duty a host implements and
the section that fixes the shape it hands over.

Two further things a host supplies are specified elsewhere and are not restated
here: **a drawing surface**, which is `compiled-program.md` section 11 and the
contract map in `stdlib.md` section 18, and **the chart clock** that `chart.now()`
reads (`compiled-program.md` section 5.2). They are named so that a reader working
through this list is not missing one. A summary that counts the drawing surface
among six duties and leaves bar state inside the bars is counting the same
interface: the bars and the state of the execution they arrive in travel together.
Bar state has a duty of its own in this document because the line between what the
host states and what the engine derives is exactly where two implementations
disagree, and that line needs a section rather than a clause.

**An optional duty is declared at load, not discovered during a bar.** A compiled
program lists the capability tags it needs (`compiled-program.md` section 2.2): a
strategy carries `orders`, a script that reads another instrument carries
`req.symbol`. An engine whose host provides no destination for orders does not
have the `orders` capability, and it refuses such a program at load with OS6006,
naming the tag. The alternative, discovering the gap at the moment a script places
an order on bar four thousand, is a failure with a drawn chart behind it.

---

## 3. Bars

### 3.1 The shape of a bar

| Field | Type | Stated | Means |
|---|---|---|---|
| `time` | number | Every bar | The bar's **open** instant, whole milliseconds since the Unix epoch, UTC |
| `open`, `high`, `low`, `close` | number | Every bar | The bar's prices. A price the host does not have is absent, never carried forward and never zero |
| `volume` | number | Only where the host has one | Quantity traded during the bar. Absent and zero are different facts, section 3.3 |
| `oi` | number | Only where the host has one | Contracts outstanding as at the bar. A level, not a flow: a coarser bar takes the last, never the sum |

`time` is the open instant and not the close instant, because the open is the
instant a bar can be identified by while it is still forming, and a bar still
forming is the one case the host and the engine have to agree about. A host whose
feed timestamps a bar by its close converts once, in the host, rather than leaving
two conventions in the interface.

A price may be absent. Real feeds have holes, and the language's central idea is a
value for "not known" (`conformance.md` section 3 admits `none` in the price
columns for exactly this reason). An absent price propagates: what it feeds turns
absent, a plot gaps rather than dropping to zero, and a comparison against it is
absent rather than false.

**The fields are the interface and the representation is the host's.** A history
may be handed over as one record per bar or as one array per field, and an
engine reads the same bars from either. The two are not equal over a long range:
a decade of one minute bars held as records costs more than twice the memory of
the same bars as columns of doubles, and a run over them allocates in proportion.
A column that cannot hold an absent value writes it as a floating point
not-a-number, which is absence here and nowhere a number. A bar that arrives
live, one at a time, is a record.

### 3.2 The order they arrive in, and what the engine will not do to them

- Oldest first. Position 0 is the oldest bar the host has supplied, and that
  position is `bar.index` (`compiled-program.md` section 2.10).
- `time` strictly increases from one bar to the next. Two bars with one timestamp
  are not two bars.
- Spacing is not required to be uniform. Real sessions are not uniform, and a host
  that pads a gap with invented bars is inventing trades.
- **The engine must not adjust, round, resample, deduplicate or reorder the bars
  it is given** (`compiled-program.md` section 5.2). If two engines are handed the
  same bars they compute the same numbers, and if they are handed different bars
  they were never going to agree, which is a host problem with a host's answer.

The engine derives `hl2`, `hlc3`, `ohlc4` and `hlcc4` itself, with the exact order
of operations fixed in `compiled-program.md` section 2.10. A host must not supply
them. A supplied midpoint and a computed one can differ in the last bit, and a
study that matches a reference implementation on one host and not on another is
the failure this project exists to prevent.

### 3.3 A missing volume is not a zero volume

These are two different facts, and the interface keeps them apart at three levels.

**Zero is a reading.** It means the host was watching and nobody traded during the
bar. Arithmetic uses it: a running total is unchanged, an average is pulled down,
a comparison against zero is true.

**Absent means nobody stated it.** `volume` reads as the absent value, anything
computed from it is absent, a volume study draws a gap, and a script can test for
it with `isNone` before branching (`stdlib.md` section 3.1).

**`chart.hasVolume` is about the instrument, not the bar.** It is the one
instrument fact a host must state (section 4), because an instrument that never
reports volume and a bar whose volume nobody supplied are different facts and no
derivation tells them apart. A per-bar absence is still possible while
`chart.hasVolume` is true: the instrument has volume, and this bar's figure did
not arrive.

Two prohibitions follow, and they are the ones a host gets wrong quietly:

- A host must never write `0` for a volume it does not know. That turns a hole
  into a reading, and a volume study then draws a confident flat line at zero
  across the part of the chart where it knew nothing.
- A host must never write an absent volume for a genuine zero. That turns a real
  quiet bar into a gap and breaks every running total that crosses it.

### 3.4 The newest bar moves

The host may hand the newest bar back with new values. That is an update, not a
new bar, and the engine re-executes bar `i`: steps 1 and 2 of the bar cycle
restore the checkpoint and truncate the history, which is what makes executing a
moving bar ten times give the same answer as executing it once.

- An update never changes a bar's `time`. A new `time` is a new bar.
- An update may change `high`, `low`, `close` and `volume`. It may change `open`
  only before the first execution of that bar, because an open that moves after a
  bar has been computed is a different bar wearing the same timestamp.
- A confirmed bar is never revised. Confirmation is one way (section 6.4).
- A correction to a bar **older** than the newest is not an update. Format 1.0 has
  no partial rewind: the checkpoint an engine holds is the end of the previous
  bar. A host that has corrected older history starts the run again from bar 0
  with the corrected dataset. This is stated rather than left open because a host
  that quietly rewrote history would produce a chart that no replay reproduces,
  and the replay invariant is the property a debugger, a chart replay and a
  reproducible backtest all rest on.

### 3.5 When the host cannot answer

| Situation | What happens |
|---|---|
| No bars at all | OS6010. A script cannot run over nothing, and an empty pane with no message is indistinguishable from a study that drew nothing |
| A bar whose time does not follow the one before it | OS6011, naming the first such bar. An engine may not reorder what it is given |
| A bar with no time at all | OS6025, naming the bar. It is the shape of section 3.1 that is broken rather than the order of section 3.2, and the fix is to date the bar |
| A price or a volume the host does not have | The absent value, sections 3.1 and 3.3 |
| Fewer bars than the study's warmup needs | Not an error. Warmup is absence (`compiled-program.md` section 7): the study is absent until it has enough bars, and it draws from the first bar it can |
| A feed that is behind | Not an error. The engine runs over what it has, and later bars arrive as updates |

**The first three are checked as the bars are handed over, and nowhere else.** The
engine compares a bar's `time` against the one before it once, at the moment the
host states that bar, and never again: a bar handed back a hundred times as it
forms is compared a hundred times, and a bar of settled history exactly once. So
the whole of the cost is one comparison per hand-over. It is paid where the bars
arrive rather than on every execution of them, and it is the same comparison
whether a host hands over a whole dataset or one bar at a time, which is what
makes the two paths agree: a series that is refused one way is refused the other
way, at the same bar.

A refused series stops the run and does not resume. The bars that ran before the
refused one were computed on a history that was still strictly increasing, so
what they produced stands; the refused bar and everything after it is not
computed at all. This is the refusal at load of section 1 arriving one step
later, for the one fact a host cannot state before it has stated a bar.

---

## 4. Instrument facts

### 4.1 The record

Twelve facts. This table is where they are defined; `compiled-program.md` section
5.2 names the record as one of the things an engine reads from the host.

| Fact | Type | Required | What a script sees when it is absent | Read by |
|---|---|---|---|---|
| `symbol` | string | No | `""`, by `stdlib.md` section 3.4 | `chart.symbol` |
| `exchange` | string | No | Absent | `chart.exchange` |
| `interval` | string | No | Absent, and the two derived facts are absent with it | `chart.interval` |
| `timezone` | string | **With a `session`** | Absent | `chart.timezone`, and every calendar and session call that defaults to it |
| `tickSize` | number | No | Absent | `chart.tickSize`, `roundToTick` |
| `lotSize` | number | No | Absent | `chart.lotSize`, `order.roundToLot` |
| `pointValue` | number | No | Absent | `chart.pointValue` |
| `currency` | string | No | Absent | `chart.currency` |
| `instrumentType` | string | No | Absent | `chart.instrumentType` |
| `hasVolume` | bool | **Yes** | There is no absent case: this is the one fact a host must state | `chart.hasVolume` |
| `hasOpenInterest` | bool | No | Absent | `chart.hasOpenInterest` |
| `session` | window | No | Absent, and the per-bar session facts are absent with it, section 4.3 | the `session` namespace |

`hasVolume` is the one fact required of every host, and section 4.2 says why.
`timezone` is required of a host that states a `session` and of no other, for the
reason section 4.3 gives: the session is wall clock, so a window with no zone to
read it in states nothing. A host that states one without the other is refused at
load with OS6012 naming the timezone.

Value spellings:

- `interval` is a canonical timeframe string (`stdlib.md` section 15.2). A bare
  number is minutes, so `"60"` and `"1h"` are the same interval.
- `timezone` is an IANA zone name, never a fixed offset. A fixed offset is
  silently wrong for half the year anywhere that observes a seasonal clock change
  (`stdlib.md` section 12.1, `compiled-program.md` section 8.4).
- `instrumentType` is one of `"equity"`, `"future"`, `"option"`, `"index"`,
  `"currency"`, `"commodity"` or `"other"`, and a host with none of those to say
  states nothing rather than inventing an eighth.
- `tickSize` and `lotSize` are positive numbers. Zero is not a tick size.

```json
{
  "symbol": "SAMPLE",
  "exchange": "SAMPLE_VENUE",
  "interval": "60",
  "timezone": "UTC",
  "tickSize": 0.05,
  "lotSize": 25,
  "pointValue": 1,
  "currency": "XXX",
  "instrumentType": "future",
  "hasVolume": true,
  "hasOpenInterest": false,
  "session": { "start": "09:00", "end": "17:30", "days": [1, 2, 3, 4, 5] }
}
```

**Two facts are derived and must not be supplied.** `chart.intervalMinutes` and
`chart.isIntraday` are computed by the engine from the interval string
(`compiled-program.md` section 5.2). Supplying them would let them disagree with
the interval they describe, and there would be no rule for which one wins.

### 4.2 Why exactly one fact is required

`hasVolume` must be stated because it is the one fact no derivation can recover.
Every other fact has an honest answer for "nobody said": the absent value, which a
script can test. Volume does not, because the question is not about a value but
about whether the values mean anything at all: an instrument that never reports
volume and an instrument whose figures are late produce the same empty column
(decision 6 in `decisions.md`).

`hasOpenInterest` asks the same question about open interest, which `stdlib.md`
section 3.1 gives the same absence rule, and it is optional where `hasVolume` is
required for one reason: open interest is absent on the instruments that have
none, and a cash instrument reporting nothing there is the expected case rather
than an ambiguity a script has to resolve.

Everything else may be absent, and absence is deliberately more useful than a
default would be. `chart.tickSize` is absent rather than a guessed `0.05`, because
a script sizing a stop in ticks has to be able to tell "the smallest increment is
five paise" from "nobody said" (`stdlib.md` section 3.4). A default would make the
second look like the first, and the script would size a stop against a number the
venue never used.

### 4.3 The session

The session is the instrument's trading session as the host defines it, not a
window a script invents. It is part of the instrument record, and this is its
shape:

```json
"session": { "start": "09:00", "end": "17:30", "days": [1, 2, 3, 4, 5] }
```

- `start` and `end` are wall clock times, `"HH:MM"`, read in the instrument's
  `timezone`.
- `days` numbers Monday as 1 through Sunday as 7, matching `date.dayOfWeek`
  (`stdlib.md` section 12.2).
- `"24:00"` is midnight at the end of the day.
- An `end` earlier than its `start` crosses midnight and is read that way, which
  is what an overnight session needs (`stdlib.md` section 12.5).

**The scheduled close is the part that earns its place.** `session.isLastBar` is
true on the last bar of the schedule even when trading stopped early, and a
strategy that must be flat by the close acts on that rather than on the appearance
of a new bar, which arrives too late. A host that states a session it does not
actually schedule breaks the one guarantee the field exists for.

**A stated session is checked against itself at load.** A window is wall clock
and a wall clock is read in a zone, so three records are a host that believes it
stated a session and did not, and each is refused at load with OS6012 naming what
is missing rather than answered with the absence an honest record gives:

| The record | What is missing |
|---|---|
| A `session` and no `timezone` | The zone its `start` and `end` are read in |
| A `start` or an `end` not spelled `"HH:MM"` | The spelling this section fixes: `"9:00"` is the one a host writes first, and it is not a time here |
| A `days` entry outside 1 to 7, or an empty list | The numbering of `date.dayOfWeek`, where Monday is 1 |

A `timezone` no calendar can read is the same failure one field earlier, and is
refused the same way. An IANA zone name is what section 4.1 fixes, and a fixed
offset is not one.

**A host that states no session at all is not one of those three.** It is the
honest record of an instrument whose schedule the host does not hold, the per-bar
session facts are absent, and a script tests for that with `isNone`
(`stdlib.md` section 12.4). The difference between that record and the three
above is the difference between a fact nobody stated and a fact stated wrongly,
and only the second can be told apart from the first by reading the record.

What follows for a host, and it is the one sentence in this section a host loses
a study to: **a session study is only as good as the session.** `vwap` restarts
at the session's first bar, `session.isFirstBar` and `session.isLastBar` are
derived from the window, and a host that holds a schedule and does not state it
gets every one of them absent on every bar, with nothing on the chart to say why,
because that is exactly what an instrument with no schedule looks like.

Two limits of version 1, written here rather than papered over:

- **One window per instrument.** An instrument that trades a morning and an
  evening window with a break between them cannot state the break. Its host states
  the enclosing window, and a script that must know about the break tests its own
  window with `session.isIn` (`stdlib.md` section 12.5), which reads the script's
  spec and the timezone rather than the host's session.
- **No holiday calendar.** `session.isHoliday` is marked planned (`stdlib.md`
  section 12.4). A host has no way to state a holiday in version 1, and the honest
  consequence is that a holiday is a day with no bars.

### 4.4 Timing

The instrument record is read once, at load, before bar 0, and it is constant for
the whole run. That is why these facts are typed as plain values rather than
series and carry no history (`stdlib.md` section 3.4).

A host must not change a fact mid-run. Swapping the instrument under a running
script is a new run, not an update: the engine does not re-read the record, and a
tick size that changed between bar 10 and bar 11 would make the first ten bars
disagree with the rest of the same chart.

### 4.5 When the host cannot answer

A fact the host does not state is absent, and a bare read of it returns the absent
value (`stdlib.md` section 3.4, decision 6 in `decisions.md`). `chart.tickSize`,
`chart.lotSize` and every other fact on the table above read as `none`, a script
can test that with `isNone`, and nothing stops the bar.

OS6012 belongs to the other case and only to it: something that needs a fact and
cannot default it. In version 1 that is the instrument record itself, refused at
load when it states a session with no timezone to read it in, a timezone the
calendar cannot read, a session whose clock times are not `HH:MM`, or session days
outside one to seven (section 4.3). A read that dates its buckets by a timezone
the host did not state is not refused: it is absent, and `req.error` carries
OS6012's sentence as the reason. Decision 66 in `decisions.md` records the
settlement.

**State every fact you have.** Withholding a fact the host holds gives the user
an absent value where the host could have supplied the number.

**Optional is not the same for every fact on that table.** Withholding
`tickSize` gives a script an absent value it can test and a user a study that
still draws. Withholding the `session`, or the `timezone` a session is read in,
removes a family of per-bar facts and every study anchored to them, and the
result on the screen is an empty pane. The record cannot tell the two apart after
the fact, so the interface splits them before it: a session with nothing to read
it in is refused at load, section 4.3, and a host that holds a schedule states
it, conformance item 3. A bare read of an instrument fact is never refused, which
is the rule above.

---

## 5. Bars for another instrument or timeframe

### 5.1 What this duty is

A script may read an expression computed on another instrument or on another
timeframe (`stdlib.md` section 15). Some of those reads the engine can satisfy
from the bars it already holds, by folding them; a read of another instrument it
never can, because it holds none of that instrument's bars. This section specifies
the host's side: the shape of a request, the shape of an answer, how a refusal is
reported, and what happens when the asking study goes away. Which reads become
requests is the engine's decision under `stdlib.md` section 15, and a host answers
the requests it is given.

This duty is optional. A host that serves no requests gives its engine no
`req.symbol` capability, and a program that reads another instrument is refused
at load with OS6006 naming the tag, rather than drawing a study with a silently
empty line through it. `req.timeframe` is not the host's to withhold: a read of
the chart's own instrument at a whole multiple of an intraday chart's interval,
or at a day, week or month, is one the engine folds from the bars it already
holds, so an engine serves that tag whether or not its host answers requests
(section 5.2 says what a host that does answer one may do).

One kind of `req.timeframe` read does need the host: an intraday timeframe that
is not a whole multiple of an intraday chart's interval, finer than it included,
such as fifteen or three minutes on a ten minute chart (`stdlib.md` section
15.2). Its bars are folded from a finer **base** interval that the chart's bars
cannot be split into, so the host serves them as it serves another instrument's.
A host that serves no requests leaves those reads refused at load, OS6015 for a
coarser one and OS6002 for a finer one, exactly as before a host could serve them.

### 5.2 The request

| Field | Type | Means |
|---|---|---|
| `id` | number | The engine's handle for this request, unique within the run. Every answer, every refusal and every cancellation carries it back |
| `read` | string | `"symbol"` for another instrument, `"timeframe"` for the chart's own instrument on another interval |
| `instrument` | identity | The instrument, as section 9 defines an identity: opaque, and either the chart's own or one the host resolved |
| `exchange` | string | Where it trades. The chart's exchange when the script named none (`stdlib.md` section 15.1) |
| `timeframe` | string | A canonical timeframe string (`stdlib.md` section 15.2) |
| `interval` | string | The interval of the bars an answer holds: `timeframe` itself, or the base interval of a read folded from finer bars (`stdlib.md` section 15.2) |
| `mode` | string | `"confirmed"`, `"developing"` or `"lookahead"` (`stdlib.md` section 15.3) |
| `warmup` | number | How many requested bars of history the expression needs before its first value, absent where the compiler had no number |

**Every identity on that table is resolved, and none of it is a rule to apply.**
The compiled program spells a read of the chart's own instrument, and an
exchange the script did not name, as an omission (`compiled-program.md` section
2.16), and the engine fills both from the instrument record of duty 2 before it
asks. So `instrument` is an identity a host can resolve and `exchange` is a venue
it can resolve it on, on every request, including the ones the script wrote
nothing in. A host handed the omission instead would be applying a language
default against a record it supplied itself, and the first time the two
disagreed a script would be answered about an instrument nobody named.

One absence is left, and it is deliberate: a `"symbol"` read whose identity a
setting was supposed to supply and did not. The chart's own is never substituted
there, because a read of another instrument that quietly became a read of this
one is a line on a chart nobody asked for. A host with no identity to resolve
refuses that read with OS6007, section 5.4.

**`read` and `interval` say what a host may decline.** A `"timeframe"` read whose
`interval` is its `timeframe` is one the engine can satisfy from the bars it
already holds (section 5.1), so a host that serves no answer to it has declined
nothing: the engine folds. Serving one is still allowed, and a host with its own
coarser bars for the chart's instrument serves them the same way it serves
another instrument's. A `"symbol"` read, and a `"timeframe"` read whose
`interval` differs from its `timeframe`, are the ones an engine cannot satisfy,
so nothing to serve there is a refusal, section 5.4: OS6007 for another
instrument, OS6014 for a base interval the feed does not carry.

**`interval` is the bars to send.** It is `timeframe` on every read except one
folded from a finer base, where it is that base: the longest interval that
divides both the chart's and the requested one, so five minutes for fifteen or
twenty five minutes on a ten minute chart and one minute for three. A host may
send bars at `interval` or at any interval that divides it, because the engine
folds by time and a finer bar is folded the same way. Bars at a coarser interval
would be refused by nothing and folded wrong, which is why the field is stated
rather than left to be guessed from the chart.

**`mode` says whether the newest requested bar may be one still forming.** A
`"confirmed"` read never takes the value of a requested bar that has not closed,
so a host that can only serve closed bars serves that read in full. The other two
take the bar the chart is inside, so a host whose answer stops at the last closed
bar leaves them absent on the bars a user is looking at. `stdlib.md` section 15.3
is what each mode means; it is carried rather than restated because a host that
marks a repainting study on its own surface reads the mark from here.

**The range is the host's, and this is the arithmetic.** A request carries no
`from` and no `to`, because the whole set is settled before bar 0 and at that
moment the engine has been handed no bars: it has no span to state. The host has
one, because the bars are the host's. So the range an answer must cover is the
range the chart's own bars cover, extended backwards by `warmup` requested bars
and forwards to the end of the requested bar the newest chart bar falls in, and,
for a read folded from a base, at least to the end of the newest chart bar. The
length of a requested bar comes from the timeframe string, `stdlib.md` section
15.2.

`warmup` is a floor and not a promise: a length that came from a setting is not
known until the setting resolves, and an absent `warmup` says the compiler had no
number at all. A host that extends backwards by less gets a read that is absent
for longer, never a wrong number, which is the whole reason it is stated as a
count of bars rather than as an instant a host would have to trust.

**The whole set of requests is known at load.** A request's identity is fixed
before bar 0, and a request whose symbol or timeframe changed mid-run is OS6013.
So a host is handed the list once and never discovers a new request during a bar.
That is what lets a host fetch in parallel, cache by instrument and timeframe, and
have the answers in hand before the first bar runs.

**Not raised yet.** OS6013 is in the catalogue and nothing raises it: a read's
identity is settled once before bar 0 and nothing asks again.

**One request per read the file writes, and not one per instrument.** Two reads
of the same instrument at the same timeframe are two entries on the list, whether
they are two lines of a study or one read written out a second time inside the
call that asks after it. A host answers both, and a host that caches by
instrument and timeframe answers both from one fetch, which is what caching by
those two fields is for. What it must not do is answer one and leave the other
outstanding, because each of them is a read some part of the study is waiting on
and neither can be recognised as a copy of the other from the outside.

**A host states its ceiling on outstanding requests at load.** A program that
needs more is refused at load with OS5006, naming the count the file asks for and
the ceiling the host allows. Dropping the requests past the ceiling is not an
option: a dropped request is a plot that quietly turns absent.

### 5.3 The answer

An answer carries the request `id` and a series of bars in the shape of duty 1, at
the requested timeframe, oldest first, covering the requested range.

- It is delivered **between bars**, never during step 6. The read is absent until
  it lands, the study reports itself as loading through the host's data status,
  and the engine recalculates when the bars arrive (`stdlib.md` section 15.5).
- A host that can keep the answer live delivers updates to it the way it delivers
  bars for the chart: a revision to the newest bar of the answer, never a rewrite
  of its history (section 3.4).
- The answer is the host's own bars for that instrument. A host must not fill a
  requested range it does not have by extending, padding or synthesising bars: a
  range it cannot cover is OS6008, which is a sentence a user can act on, and
  invented bars are not.
- **OS6008 is nothing over the range the chart covers, and not history that
  stops short of the warmup.** A host whose stored history begins after the
  warmup asked for serves what it has: the read is absent for longer and every
  value it does produce is right, which is what makes `warmup` a floor. Refusing
  there would take away a study that would have drawn.

### 5.4 Refusal

**A refusal is reported. It is never an empty answer.** An empty series looks
exactly like an instrument that did not trade, which is the reasoning the
catalogue gives under OS6007 and the single most important rule in this section.

| Code | The host is saying |
|---|---|
| OS6007 | It does not know that instrument on that exchange |
| OS6008 | It resolved the instrument and has nothing for the range the chart covers |
| OS6009 | It reached its source and the source refused or did not answer, carrying the source's own reason |
| OS6014 | It does not serve that timeframe for that instrument, carrying the list of intervals it does serve |
| OS6015 | The requested intraday timeframe is not a whole multiple of the chart's, so it cannot be folded |
| OS5006 | The file asks for more outstanding requests than it allows, refused at load |

The reason text reaches the script through `req.error(read)`, for every read that
asked and however that read was written, and the study keeps drawing everything
that does not depend on the failed read (`stdlib.md` section 15.5). The host's
words are carried, not paraphrased: "the account's data subscription does not
cover this instrument" is actionable, and "the request failed" is not. The empty
string is what that call answers for a read nothing refused, so a refusal that
did not reach it is the empty answer this section began by refusing, arriving by
another door.

A host may offer a retry. Until it succeeds the read stays absent, and the rest of
the study stays drawable.

### 5.5 Cancellation, when the asking study goes away

A request belongs to the run that made it. A run ends when the study is removed,
when a recompile replaces it, when a setting changes (a settings change is a new
load, section 8.2), or when the chart's instrument or interval changes.

When a run ends the engine cancels every outstanding request of that run, by `id`.
Then:

- The host stops whatever work it can stop. A host that cannot cancel work already
  in flight is still conforming.
- **The host must not deliver an answer to a run that has ended**, and an answer
  already in flight is discarded rather than handed to the successor run.
- Cancellation is reported to nobody. There is no error, no code and no message,
  because the script that would have read it is gone.

Two reasons this matters more than it looks. A request may be built from an input
(`stdlib.md` section 15.4 admits a compile-time constant, which includes an
`input()`), so the successor run may be asking a different question and an answer
to the old one is not an answer to it. And a stale answer applied to a live study
puts a line on a chart that no current script asked for, which is a value with no
author.

---

## 6. Bar state

### 6.1 What the host states and what the engine derives

The bar facts, and which of them the host states, are `language.md` section 7.2's.

This section is the host's side of that split. A host states every fact that
section gives the host and states none of the rest; an engine must not ask a host
for one of the rest. This is decision 5 in `decisions.md`, and it is fixed.

### 6.2 Why the line falls there

**A fact the engine can compute must not also be stated, or the two can disagree
and no rule says which wins.** That is the whole principle, and the rest is an
application of it.

The facts the host states are facts about the **delivery**, not about the dataset.
None of them is visible in an array of bars: only the side that built the bar
knows how that bar reached the engine, and an engine handed the array cannot
recover any of it.

The facts the engine derives are properties of **the array and the position in
it**, and the engine holds both. That is the whole of the line, and a fact that
sits on one side because of where it can be read from sits there whatever it
describes.

### 6.3 A live feed carries ticks, not bars

A live feed carries ticks, or quotes: a last traded price, a running day range, a
cumulative volume. It does not carry bars. **Turning that into bars is the host's
job, and the engine is handed the result.** The engine never sees a tick.

Three reasons the boundary is there rather than one step further in:

1. **Every feed is a different shape, and none of them disagrees about what a bar
   is.** A venue whose feed looks nothing like any other changes its own adapter
   and nothing else. Put the aggregation inside the engine and every venue becomes
   an engine change.
2. **Bar boundaries are a venue and session question.** When the first bar of a
   session opens, what a shortened day does to the last one, how a cumulative
   volume becomes a per-bar quantity: the host already holds those answers,
   because it already draws a chart with them.
3. **Determinism.** An execution's only inputs are the checkpoint, the bar and the
   settings (`compiled-program.md` section 6.4). A feed read from inside a bar
   would break the replay invariant, and with it the step-back debugger, the chart
   replay and any claim that a backtest reproduces.

The consequence, stated plainly: two hosts that aggregate ticks differently hand
the engine different bars and compute different numbers. That is a host problem
with a host's answer, and it is the same statement `compiled-program.md` section
5.2 makes about bars in general. What the engine guarantees is that identical bars
produce identical numbers.

### 6.4 Exact obligations

- **`updates` and executions are one count.** The host increments `updates` once
  per hand-over, the engine executes once per hand-over, and a host that hands a
  bar over without it being executed does not increment it. What the number itself
  means is `language.md` section 7.2's.
- **Confirmation is one way.** A host that has confirmed a bar must never revise
  it and must never hand it back unconfirmed. Everything the engine defers rides
  on this: markers, alerts and orders are applied at step 9 only on a confirmed
  bar (`compiled-program.md` section 5.4), and an order placed on a bar that is
  later revised cannot be unplaced.
- **A host states every one of them on every execution**, and the two worked
  cases below are what that comes to for most hosts.

Two worked cases, which between them cover most hosts:

| | `isNew` | `isConfirmed` | `isRealtime` | `updates` |
|---|---|---|---|---|
| A history load, every bar | true | true | false | 1 |
| A live bar as it forms | true, then false | false until the interval elapses, then true | true | 1, 2, 3, and on |

### 6.5 When the host cannot answer

The facts a host states have no absent case. They are read at step 4 of every
execution, and a host with nothing to say is not silent, it is wrong. What it does
instead:

- **A host that cannot tell whether the newest bar has closed** states
  `isConfirmed` false for it and confirms it when the next bar arrives. That is
  the same fact one bar late, and it is the safe direction: a bar confirmed early
  and then revised has already placed orders and fired alerts.
- **A host with no live feed** states `isRealtime` false and confirms every bar it
  hands over, which is the history load row above.
- **A host replaying stored bars as though they were live** states what is true of
  the replay: `isRealtime` true while it is driving updates, and each bar confirmed
  when the replay finishes it.

---

## 7. Orders

This duty is for a host that lets scripts trade. A host that does not gives its
engine no `orders` capability, and a strategy program is refused at load with
OS6006 naming the tag (`compiled-program.md` section 2.2). An engine that has the
capability and finds no destination wired raises OS7015 the moment a script places
an order, with a fix that names the change: run the file as a `study()` and
replace the order with a `signal()`.

**Not raised yet.** OS7015 is in the catalogue and nothing raises it: a strategy
with nowhere to send orders places intents that reach nobody.

### 7.1 What the engine hands over

An **order intent**. Not an order: the destination makes the order, and the
distinction is the point of the duty. The engine states what the strategy decided;
the host states what happened.

| Field | Type | Means |
|---|---|---|
| `intentId` | number or string | Unique within the run. Every frame about this order carries it back |
| `kind` | string | `"place"`, `"cancel"` or `"bracket"` |
| `instrument` | identity | The resolved identity of the leg this order names (`stdlib.md` section 17.1), as section 9 defines an identity. Never a symbol the engine assembled |
| `side` | string? | The order's side (`stdlib.md` section 17.2). Absent on a cancellation, which names a tag rather than a direction, and on a bracket, whose side is the position's own |
| `qty` | number? | Quantity, in the unit `qtyType` names, positive. Absent on a cancellation, and on a bracket that names no part of the position |
| `qtyType` | string | The unit `qty` is counted in: the strategy's own option (`language.md` section 13.3), passed through untranslated. A quantity the engine folded from filled quantities, as a flattening order's is, states units |
| `type` | string | The order's type (`stdlib.md` section 17.2), `"market"` on a kind that is not an order |
| `limit` | number? | Limit price, absent where there is none |
| `trigger` | number? | Stop trigger price, absent where there is none |
| `target` | number? | A `"bracket"` intent's target price, absent where it names none and on every other kind |
| `stop` | number? | A `"bracket"` intent's stop price, absent where it names none and on every other kind |
| `profit` | number? | A `"bracket"` intent's target as a distance from the entry, where the script stated one that way, absent otherwise and on every other kind |
| `loss` | number? | The same for its stop |
| `tag` | string | The script's own label, `""` when it named none. A `"cancel"` intent names the tag it cancels |
| `product` | string | The strategy's `product` option (`language.md` section 13.3), passed through untranslated |
| `positionRef` | number or string | The position reference of `stdlib.md` section 17.7. `0` on an intent that is about no position of its own: every `"cancel"`, which names an order rather than a position, and a `"bracket"` set while the leg holds none. No reference an engine mints is `0` |
| `bar` | object | The index and the open time of the bar whose close decided it |

Three notes, each of which is a mistake somebody has already made:

**`type` follows the prices.** `side` and `type` take the values of `stdlib.md`
section 17.2, which is also where `type`'s correspondence with the prices given is
fixed. The field is stated anyway, so a host never has to infer it.

**`product` is passed untranslated.** A product name is a venue's own word, and
translating it is the host's job because only the host knows the venue. The engine
records what the strategy asked for and the host reports what it actually sent
(section 7.2), so the two are both on the record when they differ.

**A quantity is passed with the unit it was counted in, for the same reason.** A
lot is the venue's own fact and the host owns symbology, so an engine that
multiplied a size in lots by a lot size the host had never stated would send a
quantity nobody asked for, which is the substitution rule of duty 2 read from the
order side. `qty` and `qtyType` therefore travel together, and the one quantity
the engine does state in units is the one it worked out itself from filled
quantities.

**A bracket is an instruction, not an implementation.** `exit()` and
`order.bracket()` hand over a protective instruction attached to a tag, carrying
its target and its stop (`stdlib.md` section 17.2). A host may implement it with
resting orders at the destination or by watching the market itself. The engine
assumes nothing about which, and learns what happened only from the frames it gets
back. A trailing stop is never part of a bracket intent, because it is a rule the
engine evaluates every bar rather than a price an order can rest at (`stdlib.md`
section 17.9); what reaches the host when a trail is hit is an ordinary exit
order.

**A bracket's `positionRef` is the position it protects, and `0` where there is
none.** A bracket appends no row and moves no position, so it never mints a
reference of its own (`stdlib.md` section 17.7): it carries the position the leg
is holding or opening at the moment it is set, and `0` when the leg holds none,
which is the ordinary case for a script whose first order call is `exit()` and
for one that brackets before it enters. A host reconciling intents against
positions therefore looks a bracket's reference up only when it is not `0`, and
the same is true of a cancellation, which names an order and no position at all.
An engine that minted one here would hand over a reference no order ever carries.

Where the leg holds more than one position, which it does whenever an order that
opposes it is outstanding, the one named is the newest the leg's own fills have
settled anything on, and the position being opened only where nothing has
settled at all (`stdlib.md` section 17.7). So the reference on a bracket is
always one some order of the same run also carries, and always one the strategy
holds something on when it is not `0`. A host may rely on both: a `0` here means
there is nothing to protect yet, and never that the engine could not work out
which position was meant.

**A distance is carried as a distance.** `profit` and `loss` are measured from
the entry of the order the intent's tag names, and that entry is a fill: it
reaches the destination before it reaches the engine, and on the bar the script
writes `buy()` and its bracket together nothing has filled at all. An engine that
resolved a distance into a price at the call would resolve it against a position
it does not yet hold, and would hand over a level measured from nothing.

**Timing.** An intent leaves at step 9, and only on a confirmed bar or when the
program sets `onUnconfirmed` (`compiled-program.md` section 5.4). An order
function returns nothing at the moment it is called: inventing an order id at call
time would hand a script an identifier for something that may never exist. The
consequence is the one the language promises, and it is worth a host understanding
it: a condition that was true halfway through a bar and false when the bar closed
places no order at all, because the execution that produced the pending intent was
thrown away.

### 7.2 What the host must report back

An **order frame**: a cumulative snapshot of one order as the destination
currently describes it.

**Order frames are cumulative, not deltas. Every frame restates the whole life of
the order**, not what has changed since the frame before it. A reconnecting
session that resends its last frames, a destination that repeats a frame, and two
frames that cross in flight are all normal, and under a delta scheme every one of
them is a phantom fill.

| Field | Type | Means |
|---|---|---|
| `intentId` | number or string | Which intent this is about, and the key the fold matches on (`stdlib.md` section 17.8). A frame the engine does not recognise is ignored |
| `orderRef` | string | The destination's own reference. Recorded, shown, and never parsed |
| `status` | string | One word the host may send, from the vocabulary of `stdlib.md` section 17.7 |
| `filledQty` | number | **Cumulative** filled quantity, from the beginning of this order's life |
| `avgFillPrice` | number? | Average price of that whole cumulative quantity. Absent while nothing has filled |
| `sentInstrument` | identity | What the host actually sent, which is not always what the intent named |
| `sentProduct` | string | The product the host actually sent, after its own translation |
| `time` | number | The destination's timestamp for this frame, UTC milliseconds |
| `text` | string | The destination's own words for a rejection or a cancellation, unparaphrased |
| `seq` | number? | The destination's sequence number for this order, where it has one |

### 7.3 The lifecycle vocabulary

The status words, and which of them are terminal, are the vocabulary of
`stdlib.md` section 17.7. A frame carries one of the words that vocabulary marks
as a host's to send.

**A partial fill is a quantity, not a status.** A partially filled order is
`working` with a non-zero `filledQty`. Giving it a word of its own would double
the vocabulary for every combination of state and quantity, and would give a host
two places to state one fact.

A destination whose words differ maps them onto that vocabulary. The mapping is
the host's, because it is per venue and the engine has no way to learn it. One
rule bounds the mapping:

- **A status the host cannot map is reported as the nearest non-terminal word,
  with the destination's own words in `text`.** Never as a terminal one. Reporting
  a state you do not understand as terminal tells a strategy that an order is dead
  and frees it to place another, while the first one may still be live.

### 7.4 Folding a frame, which is where double counting happens

An engine folds a frame exactly as `stdlib.md` section 17.8 folds one. Nothing of
the fold is written here, so that a host reading what its frames will do to a
ledger row reads one account of it.

What this document fixes is which frames a host sends, and when what it sends
takes effect.

**A host must report at least every frame that changes an order's `status` or its
`filledQty`.** A host that reports only terminal frames is conforming and much
less useful: `order.working` and `order.pending` have nothing to say while an
order lives, and a script waiting for a working order to clear waits blind.

**When a frame is folded.** Frames arrive whenever the destination speaks. The
engine folds them at a bar boundary, before step 4 of the next execution, so that
every `pos` and `order` fact is constant for the length of one execution and a
re-execution of a moving bar sees exactly what the first execution saw. A host
must not expect a script to react within the bar it sent the frame in. This is the
same rule as everywhere else in this document: nothing reaches a running
execution.

A host therefore does not have to put its frames in order before it sends them. A
repeat, a pair that crossed in flight and one that arrives after the order ended
are ordinary traffic, and `stdlib.md` section 17.8 is what says what each of them
does.

**How a frame reaches the engine.** An engine that takes orders **exposes a way
to deliver one**, and a host may call it at any moment between bars. This is an
obligation on the engine rather than on the host, and it is stated because the
duty is unservable without it: a host with cumulative frames in hand and nowhere
to put them cannot report what became of an order, the ledger of `stdlib.md`
section 17.7 stays at `placed` for ever, and every position the strategy reads is
zero while the account holds something.

Three things the intake fixes, and nothing else:

- **It takes one frame.** Not a batch, not a subscription, not a stream the
  engine drives. A destination speaks one order at a time and a host has nothing
  to gain by holding a frame back until it has another.
- **It returns nothing.** What a frame did is read from the run, on the bar the
  fold happened before, because the fold happens at a bar boundary and the
  delivery does not.
- **It is the only way in.** An engine that also read frames from somewhere else
  would have two accounts of what an order did, and `stdlib.md` section 17.8
  could not say which of them a position was folded from.

### 7.5 What the engine keeps, and what it will not read

The run keeps the ledger of `stdlib.md` section 17.7, and every position a
script reads is folded from it.

The engine does not read the account's position, under `stdlib.md` section 17.1.
A host may show the account's own position beside the strategy's; the engine is
neither handed it nor asks for it, and a host that wires one into the order path
has built something the rest of this document does not describe.

### 7.6 When the host cannot answer

| Situation | What happens |
|---|---|
| The engine has no `orders` capability | OS6006 at load, naming the tag |
| The host wired no destination | OS7015 when an order is placed |
| The destination refused the order | OS7014, carrying the destination's own text as `{reason}` |
| The connection dropped and no status is available | The order keeps its last recorded status, because nothing arrived to fold. **Silence is not a fill and is not a cancellation.** The engine does not guess, does not retry on the host's behalf, and does not place a replacement |
| A frame arrives for an intent the engine does not know | Ignored, `stdlib.md` section 17.8 step 1 |
| The destination reports a fill the engine never asked for | Ignored by the ledger and reported by the host as an account event. A strategy's ledger holds what that strategy did |

**Not raised yet.** OS7015 and OS7014 are in the catalogue and nothing raises
them. A strategy with nowhere to send orders places intents that reach nobody. A
destination's own refusal is folded into the ledger row as a status and its
text, and is reported against no line.

---

## 8. Settings storage

### 8.1 The shape

A map from an input's `key` to a value. The `key` is unique within a program and
it survives every edit that does not rename it.

**What the key is.** The name the input was assigned to in the source
(`compiled-program.md` section 2.6), or, where it was assigned to no name, the
input's title. An `input()` may be written anywhere a value belongs
(`language.md` section 13.4), and one written as a declaration option or inside a
larger expression is assigned to nothing, so the title is what names it: it is
what the user sees on the row, and changing it is the rename this sentence
excepts. `var len = input(14, "Length")` is the assigned form and is keyed by the
name, so adding or removing the word `var` does not move a stored value.

**The key is never the input's position.** A positional key survives no edit at
all. Inserting one tunable above another moves every key below it, so a value
stored against the third row arrives on the fourth with nothing to say so,
because section 8.3 validates a number against a number and both are numbers.
A key is a promise about identity, and a position is the one thing about an input
that an edit is most likely to change.

**Two inputs cannot share a key**, and that is enforced by three refusals rather
than by a disambiguating suffix, because a suffix is a position wearing a
different hat. Two inputs carrying one title are OS3017, a title spelling another
input's name is OS3022, and an input with neither a name nor a title is OS3021.

The map is per **instance** of a study, not per script. The same script added
twice to one chart is two instances with two maps, which is what lets one be a
fourteen period reading and the other a fifty.

| Input kind | Stored as |
|---|---|
| `number` | A number |
| `bool` | `true` or `false` |
| `string`, `select` | A string. A `select` value must be one of the declared `options` |
| `color` | `#rrggbbaa`, eight lower case hex digits, the spelling of `conformance.md` section 4 after the alpha conversion of `compiled-program.md` section 3.1 |
| `source` | One of the series a source input may select, `stdlib.md` section 13.1 |
| `interval` | A canonical timeframe string (`stdlib.md` section 15.2) |
| `time` | A wall clock string in the chart's zone, which is what lets a saved layout restore to the same wall clock in another timezone (`stdlib.md` section 13.3) |

The host also generates and stores the style rows no script declares: a colour, an
opacity, a thickness, a line style and a plot style for every plot (`stdlib.md`
section 13.4), and a colour of its own choosing for a plot whose script named none
(decision 14 in `decisions.md`). That storage is the host's own. Nothing in the
compiled program describes it, and nothing in a script reads it.

### 8.2 Timing

Settings are read once, at load, before step 1 of bar 0. The engine resolves every
input then, in the order of `compiled-program.md` section 2.6, and substitutes each
resolved value into every declaration that referenced one (`compiled-program.md`
section 2.3).

**A setting cannot change mid-run.** Changing one is a new load, and the run starts
again from bar 0. That is not an implementation convenience: a declaration is fixed
before bar 0, a table's corner and a plot's colour may be written from an input,
and "fixed before bar 0" means nothing if a value behind it can move on bar four
hundred.

The engine never writes settings. The host writes them, when a user changes a row.

### 8.3 Validation

For each input the effective value is the host's value when the host supplies one
and it passes validation, and the declared default otherwise. Validation is exact:
the wrong type, a number outside `min` or `max`, or a `"select"` value not in
`options` fails it.

A value that fails validation is OS6019 and the program does not run. It does not
fall back to the default, because a settings dialog that silently ignores what a
user typed is worse than one that says the value is out of range.

A stored key with no matching input in the program is not an error. The host keeps
it untouched and the engine ignores it, so that removing an input and putting it
back does not lose what the user had.

### 8.4 When the host cannot store

A host with no storage is conforming. Every run then takes the declared defaults,
every settings row is a control that lasts as long as the page does, and **the host
says so** rather than presenting a dialog that appears to save. A host that keeps
settings for a session but not across restarts is the same case with a longer
horizon, and says that too.

---

## 9. Identity: a symbol is opaque

### 9.1 The rule

**An instrument identity is an opaque token. The engine never parses one.**

It compares identities for equality and hands them back unchanged. It never splits
one on a separator, never changes its case, never formats one for display beyond
printing it as it was given, and never infers an underlying, an expiry, a strike
or a right from it. It never builds one from parts.

A script can hold an identity and pass it to a request. That is the whole of what
the language does with a symbol.

### 9.2 Why, plainly

A naming scheme built around one market's derivatives means nothing on a crypto
exchange. The expiry is not in that shape or is not there at all, the strike
convention is different, the separator characters are different, the case
convention is different, and half the fields the scheme assumes do not exist.
Portability is the entire objective, so the language cannot contain a rule about
one market's spelling.

Any parsing rule would also be a promise the language cannot keep. A venue renames
its contracts, adds a series, changes a separator: with a parsing rule in the
language that is a language change, a compiler release and a re-test of every
engine. With an opaque token it is a line in one host's adapter. The host already
owns symbology, which makes it the only participant that can own it correctly.

### 9.3 Naming a contract by what it is

A script still has to be able to say "the at the money call of the nearest
unexpired weekly expiry". It says it by describing the contract, never by spelling
a symbol, and the host resolves the description to whatever its own symbology
calls it.

A relative contract is described by the fields of `stdlib.md` section 17.6. A host
is handed those fields, under those names, and answers with an identity and the
instrument facts of duty 2, or refuses with OS6007 when it cannot resolve the
description.

Every field of the description is stated in the contract's own terms. None of them
is a piece of a symbol, and none of them assumes how the host spells anything: the
increment between strikes is the venue's, the series are the venue's, and the
resolved identity may be a string, a number, a pair, or a row in the host's own
table. The engine never learns which.

**Where version 1 stands.** The chart-side surface for describing a contract is
not in version 1: `chart.expiry`, `chart.strike` and `chart.optionType` are marked
planned (`stdlib.md` section 3.4), a `symbol` input is marked planned (`stdlib.md`
section 13.1), and a strategy names its contracts with the leg declarations of
`stdlib.md` section 17.6, whose descriptions a host answers with the resolution
shape of this section. What is fixed now is the host's side: that shape, and the
rule in section 9.4. A host that builds the resolution once has the language
surface arrive on top of it rather than against it.

### 9.4 A relative contract resolves once

**A relative contract is resolved once, at the start of a run, before bar 0. The
identity that resolution produced is what every later action uses: every bar
request, every order, every report line, every restart. The engine never
re-evaluates the description.**

The reason is not a preference about determinism. It is how a strategy avoids
exiting a position it does not hold.

"The at the money call" is a different contract at the exit than it was at the
entry, because the price moved, or because the expiry rolled overnight. A
description re-evaluated at the exit names a contract the strategy never entered.
The order it produces does not close the position. It opens a second one, in a
contract nobody chose, and leaves the first one open, and the account is now short
one thing and long another with no record of having decided that.

What follows:

- **The resolved identity is persisted with the run.** A run that is stopped and
  started again re-attaches to the identity it recorded rather than resolving the
  description a second time. A restart that re-resolved would silently roll a
  position into the next expiry.
- **A new expiry, a moved strike or a new trading day is a new run.** The host
  starts one. It does not swap the identity under a running script.
- **A host that cannot resolve the description at the start of a run refuses the
  run.** It does not start the script intending to resolve later, because the
  first bar would then compute against an instrument that does not exist yet.
- The rule is the same one requests already live under: a request's identity is
  fixed before bar 0, and a request that changed mid-run is OS6013.

  **Not raised yet.** OS6013 is in the catalogue and nothing raises it: a read's
  identity is settled once before bar 0 and nothing asks again.

---

## 10. Conformance

### 10.1 What a host must do to claim it implements this interface

Each of these is a statement someone else can check.

1. **Bars.** Supplies open, high, low, close, volume and time, oldest first,
   strictly increasing by open time, unadjusted, unresampled, undeduplicated and
   unreordered. No bars at all is OS6010; a bar out of order is OS6011.
2. **No substitutions.** Never a zero for an unknown volume, never an absent value
   for a real zero, never a default tick size, never a price carried forward. What
   it does not know, it does not state.
3. **Instrument facts.** Supplies the record of section 4.1: the fact that table
   marks required is always stated, every other is stated when the host has it and
   absent when it does not, and a stated `session` comes with the `timezone` it is
   read in and the spellings of section 4.3. A schedule the host holds and does
   not state is the one withheld fact that removes a study rather than a value.
4. **Bar state.** States on every execution the facts `language.md` section 7.2
   gives the host, states none of the rest, builds bars itself from whatever its
   feed carries, and never hands back a confirmed bar unconfirmed.
5. **Declares its optional duties at load**, along with its ceilings, so that a
   program needing more than it offers is refused at load rather than mid-bar:
   OS6006 for a capability tag it does not provide, OS5003 for a `limits()` option
   above its ceiling, OS5006 for outstanding requests above it.
6. **Requests.** Answers or refuses each one with a code from the catalogue and the
   reason in the source's own words, never with an empty answer; covers the range
   of section 5.2, which it works out from its own bars and the request's
   `warmup`; cancels every outstanding request when a run ends, and delivers
   nothing to a run that has ended.
7. **Orders.** Carries `intentId` back on every frame, sends the cumulative frames
   of section 7.2 through the intake of section 7.4, uses the vocabulary of
   `stdlib.md` section 17.7 or maps its own onto it, never reports a state it does
   not understand as terminal, and carries a rejection's own text.
8. **Settings.** Stores a value per input key with the spellings of section 8.1, or
   states plainly that it does not store them.
9. **Identity.** Treats an identity as opaque (section 9.1) and resolves a relative
   contract under section 9.4.
10. **Says which of these it does not do.** A duty a host does not implement is
    declared, not discovered.

**How this is tested.** The conformance suite tests compilers and engines, not
hosts (`conformance.md` section 1). What tests a host is that same suite run
through the host's own interface: a case supplies its input from the files of
`conformance.md` section 2, so a host that can serve a case directory through its
own interface, and produces the expected output, has shown that its side of duties
1, 2, 3, 4 and 6 matches the shapes here. Duty 5 is exercised by the strategy
category of cases, which supply their order frames from the case directory in the
same way. A host claiming this interface says which profile of
`conformance.md` section 8 its engine passed, and which duties its own side serves.

### 10.2 What a host may not assume

- **That the engine will repair what it is handed.** It will not reorder bars, will
  not fill gaps, will not resample and will not deduplicate. Those are decisions
  with market consequences, and the party that knows the market makes them.
- **That absence and zero are interchangeable**, anywhere, for any fact. The
  language has both because they are different, and a host that treats them as one
  removes the distinction for every script that runs on it.
- **That a script parses or produces a symbol.** It does neither, section 9. A host
  that expects the engine to assemble a contract name is waiting for something that
  will never arrive.
- **That settings can change mid-run.** A changed setting is a new load, section
  8.2.
- **That an order has happened when the script called the function.** Intents leave
  at step 9 of a confirmed bar, and a condition that stopped being true before the
  bar closed places nothing.
- **That the engine tracks an account position.** The engine does not read the
  account's position, under `stdlib.md` section 17.1.
- **That a frame may be a partial restatement.** A frame is cumulative, under
  section 7.2.
- **That the engine will call back into host code during a bar.** It will not. An
  execution reads the checkpoint, the bar and the settings.
- **That the engine runs in a particular language, process, thread or machine.** A
  host that makes an answer depend on any of those has built an interface only its
  own engine can use.
- **That a reference implementation is the specification.** Where a host's
  behaviour disagrees with this document because of what some engine does, this
  document is what a second implementer reads, and the engine is the defect.
