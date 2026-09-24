# Changelog

What changed in each release, written for somebody deciding whether to upgrade.

This file is checked at release: a version with no entry, or an entry that says
nothing, fails the build before it can become permanent.

---

## 0.6.0

**An engine that implemented nothing passed the conformance suite, and now does
not.** Every case in the tree declared the `strategy` profile, so an engine
claiming `core` was handed none of them: every case was skipped, the runner
printed "Suite passed" and exited zero. The repository's own test asserted that
outcome against an adapter written to answer no case at all. If you have been
using a passing suite run as evidence about a `core` engine, it was not one.

`core` cases now exist, twenty three at first across `lexical`, `syntax`,
`static`, `runtime` and `limits`, and fifty two by the end of this entry.
Nothing in the runner changed to make this work: its rules were already right,
and what was missing was cases for them to apply to.

**An engine reporting `engineOnly` is no longer handed compiler-diagnostic
cases.** Section 8 of `conformance.md` always said it should not be, and the
runner did not implement it, which nothing noticed while no such case existed.
Which categories need a compiler is now a column of section 7's table, read by
the runner, so a category added without an answer in that column stops the
suite rather than being handed to an engine with no compiler.

**Behaviour that changed under you, first engine.** Read these before upgrading
a deployment whose numbers you have already checked.

- **A `"lookahead"` read in a backtest now reads a higher timeframe bar's final
  value from its first bar**, as `stdlib.md` 15.3 always said. The backtest
  appended bars one at a time, so a lookahead read answered the bucket so far,
  which is the developing reading. Confirmed and developing reads are
  unchanged. A lookahead backtest now looks as smooth as the mode says it will.
- **Dates before about 1 BCE were one day early.** The day count applied the
  negative era adjustment twice. No modern date moves.
- **Some input that was accepted is now refused, each with a code and a fix.**
  An `input()` in a field fixed before bar 0 that is not the whole of the value
  is OS3025 (arithmetic, a ternary or a colour call over a setting used to
  compile and then fail inside the emitter). A plot's `style` written from an
  input is OS3026 (it used to be folded silently to its default). A bar handed
  over with no time is OS6025. The chart adapter refuses a second declared grid
  and a band coloured per bar with OS6024 before any bar runs, where it used to
  drop them in silence.
- **A cell outside its grid is OS4008**, naming the row, the column and the
  grid's shape, where it was the array code OS4004 with a flattened count. A
  name or an array still holding an object deleted earlier warns OS8019.
- **The editor's hover text for six drawing calls was wrong**: `draw.setFrom`
  said "nothing" and `draw.delete` said "box", because the generator split
  `stdlib.md`'s rows on the pipe inside `line | box`. Fixed at the generator and
  in the pages.

**New.**

- **`engine.run` takes a history as columns**, one array per field, typed arrays
  included, beside the record form. Over 900,000 one minute bars that held 43 MB
  against 104 MB and peaked at 346 MB of heap against 877 MB.
  `docs/integrating/running-the-engine.md` has the shape.
- **`importScript`**, from the main entry point, imports a script written in the
  version-annotated chart dialect, versions 5 and 6. Each statement is translated
  with its original meaning, translated with a warning stating the difference,
  or kept as a comment with an error; the output is compiled before it is
  returned. Twelve codes in a new range, OS9001 to OS9012, and a new catalogue
  stage, `import`. `docs/writing/importing-a-script.md` lists what is translated
  and what is refused.
- **A documentation site.** `npm run site` builds every page of `docs/` and
  `spec/`, and a page per catalogue code, with every address relative.
  `scripts/check-site.mjs` fails the build on a link or anchor that leads
  nowhere.
- **A conformance badge.** `npm run badge` makes one from a passing result
  document, and refuses anything that is not a pass of the profile it claims.
  The suite revision it names is now the package version and a digest of every
  case file (`conformance.md` section 11), so a result names the exact cases it
  was run against.

**If you read the catalogue programmatically**: `spec/errors.json` has 173
entries, a ninth range, OS9xxx, whose severity is "error or warning", and a
sixth stage, `import`. OS4008, OS8019, OS3025, OS3026, OS6024 and OS6025 are
raised; OS6012 is now raised only where a fact cannot default, and a bare read
of an instrument fact the host did not state is absent.

**The suite now measures what it exists for.** Four channels that no engine
answered now have a definition in `conformance.md` section 4 and an answer from
both engines: `values`, one value per bar per plot; `log`; `drawings`; and
`table`. There are 106 cases, 52 `core`, 46 `chart` and 8 `strategy`, and the
`semantics`, `numerics`, `time`, `surface` and `external` categories hold real
cases for the first time, each with expected values computed independently of
both engines. A read of another instrument is served from the case's own
`bars.<SYMBOL>.csv`. `npm run suite:agree` passes 87 cases between the two
engines exactly, the other 19 being compiler-diagnostic cases an engine-only
implementation skips.

**The second engine now holds every library entry the first does**, 251 of
251, checked on every build by `scripts/check-manifests.mjs`: arrays, `print`,
the calendar, the session calls, drawing objects, grids, and higher timeframe
and other instrument reads in all three modes. Two disagreements between the
engines were found by the new cases and settled in the specification: the
`and` and `or` tables are total (decision 71), and the drawing and grid channels
have a written shape (decision 72).

**The installed Python engine can say what it is.** `python -m openscript
--describe` read the engine's name and version from `pyproject.toml` beside the
package, and an install never carries that file, so on every installed copy,
0.5.0 from the index included, it refused, and no host could run the conformance
suite against the engine it had actually installed. It now reads the record the
installer wrote beside the package, and still reads the file in a checkout. A
`pyproject.toml` above an installed package that names some other project is
ignored rather than reported as this one, and two installed records beside one
package, which a broken upgrade leaves, are refused rather than one picked.

**The Python engine is published by a workflow.** 0.6.0 is the first version
uploaded by `release-pypi.yml` rather than by hand. Before anything is uploaded
it builds the wheel, checks every source module is in it and nothing else is,
installs it into a fresh interpreter, and loads a program compiled by this
release's compiler and checks every value. It publishes through trusted
publishing, with no stored token, and each file on the index carries a signed
attestation of the workflow run that built it.

**What this still does not prove.** Both engines were written in this
repository, by the same hands, from the same pages. Their agreement is evidence
about this repository and not yet about the specification: that needs an engine
written by somebody who has read only the pages, which is the gate of Phase 7
and cannot be met from inside.

---

## 0.5.0

**`pow` has no library vector, and the reason is the same one.** A vector is a
bit pattern a second engine is written to match, and `pow` returns different
bits on two runtimes of the same virtual machine: publishing one hands that
second engine a test it cannot pass and this engine cannot keep. The vectors
were added after the last release, so this is the first build to check them
anywhere but where they were made.

`compiled-program.md` 8.3 already requires that the transcendental functions not
use the platform's maths library, and the source records that they do until the
portable algorithm it names exists. Everything in that group is provisional in
the last bit; only `pow` has been measured to differ, so only `pow` is held out,
and the index says why. The rest keep their vectors and the exposure is written
down where the next one goes when it is measured.


**A figure in the specification was one machine's reading.** Section 20.7 said
how many powers of ten a host's `pow` gets wrong and which one, and a test
measured it again on every build, which is the rule this project has for a
printed figure. Both numbers turned out to belong to the host rather than to the
language: the same engine misses a single count on one runtime of its virtual
machine and thirty six on another, and the two sets do not overlap. The claim
that matters, that a floating point power is not the nearest binary64 and that
the difference reaches `round`, is true on both and is what is now printed and
measured. The witnesses the two rounding tests use are found on the host running
them rather than written down, because a literal witness demonstrates the claim
on the machine it was written on and nothing on the next one.


**A chart can draw a strategy, not just a study.** `descriptorFor` takes
`simulateOrders`, and with it a program that places orders runs in the chart
tier against the venue a backtest uses: its plots draw, its legend row and its
settings dialog follow, and its position is right because the venue's frames
reach the engine between bars. Until now a host had two choices, refuse the
strategy or hand it a destination that answered nothing, and the second draws a
strategy that never learns it holds anything: every close closes nothing, every
entry is allowed again on the next signal, and a stop and reverse script
measured five buys and no sells while looking entirely normal.

It is the backtest's own `Simulator` rather than a second one written for
charts, so the marks a trader sees on the price and the trades in the report of
the same script are one answer. A test holds the two together: the position the
chart ends on and the open size the report states are compared directly.

**Off unless asked for.** Without `simulateOrders` a strategy with nowhere to
send an order is still refused at load with OS6006, which is what a host that
meant to wire a destination and forgot needs to be told. Supplying `orders`
still wins over it: somewhere real to send an order is a better destination than
a simulated one. Nothing is placed anywhere by this.


**The Python engine is on the index.** `pip install openscript` gets the engine
that runs a compiled program, Apache-2.0, zero dependencies, Python 3.12 or
newer. Until now the only way to have it was to clone this repository and point
an environment variable at a directory, which meant a platform built from a
container image could not run a strategy at all, and anyone attempting the
second half of Phase 6 had nothing to install. `RELEASING.md` carries the
release, beside the npm one, and the two versions ship together because
`check-python.mjs` holds them equal.

`engine/README.md` is the page the index shows: what the package is, that it
holds no compiler and is handed a compiled program, that nothing in it builds
code out of text, and how a host drives it bar by bar. It was written because
the first build had no long description at all and the page would have been
blank, which is permanent for a version once it is up.

**The Python distribution shipped one package out of six.** `[tool.setuptools]
packages` named `openscript` alone, so an install carried the machine and none
of the halves it calls: `import openscript` worked and
`from openscript.adapter.serving import Serving` did not. A host that followed
`docs/integrating/the-python-engine.md` and installed the directory got an
engine that could not run anything, and the failure appeared at their first
import rather than anywhere in this build.

It was found by doing it: installing the engine into a platform and watching the
adapter go missing. Nothing here could have caught it, because every test in this
repository runs the package from the tree where all six directories are present
whether or not the distribution would have carried them.

`scripts/check-python.mjs` now compares the package list against the packages
that exist, in both directions: a directory holding an `__init__.py` that the
list omits is refused, and a name in the list that is not a package in the tree
is refused too. A new subpackage is shipped because it exists, not because
somebody remembered a line.

**The phase the language was designed for is now scoped.** A strategy trades one
instrument today, chosen by the host before the run starts. The surface for more
than one has been designed and marked planned since `stdlib.md` was written:
`leg.fixed` and `leg.relative` declare what each leg trades, the `leg.*` rules
manage one, and the `book.*` rules reason across all of them. None of it
executes, and a script calling any of it is refused at the call with OS2020.
`ROADMAP.md` now carries Phase 8, which says what building it involves, in the
order it has to be built, and the four questions that have to be answered before
any of it is written. It is placed after Phase 7 deliberately, and the reason is
in the phase: every rule in it is behaviour a third engine has to reproduce
exactly, so designing it before the format is fixed means discovering the
disagreements one at a time in somebody else's engine.

The risk rules that a combination of contracts needs are the point of it. A
position made of two or more derivative contracts has a risk profile belonging to
the combination and not to any leg, so a stop placed per leg both fires on moves
the combination absorbed and misses the ones it did not. Two independent
single-instrument strategies are not a substitute for one multi-leg strategy;
they are two strategies running at the same time.

**Six capabilities that were missing rather than planned now have rows.** The
feature matrix said nothing at all about an account-level drawdown halt, a
position size cap, a cap on orders per session, a halt after consecutive losing
sessions, indexed access to past trades, or a script stating whether it is
evaluated on every update or only on a closed bar. Every one of them is ordinary
in the prior art this language is measured against, and a gap nothing records is
a gap nobody plans. They are `planned` with no section, which is what that status
is for.

**The second engine's host surface is documented, and proved.** `engine/openscript/run.py`
has held everything a live runner needs since the engine was written, and no
document mentioned it once: a host reading `docs/integrating/the-python-engine.md`
concluded that the only way to use this engine was to hand it a case directory,
because the one entry point that page named was the conformance adapter. Phase 6
of the roadmap is a server-side engine running the same compiled program, and the
surface that makes it possible was invisible to the people it exists for.

`docs/integrating/running-a-strategy.md` is the page a platform engineer reads
instead. It states plainly that the engine is handed a compiled program and never
a script, and what that means for a server that cannot run the compiler: the
program is compiled where the compiler runs and stored as data. Then `load` and
`load_text` and what a refusal carries, `execute_bar` argument by argument, what a
`BarResult` holds, the rollback a still-moving bar rests on and the single
condition it needs, the order boundary with `adapter/ordering.py` as the worked
reference, a worked example that runs, and a list of what the surface does not
give a host: no scheduling, no process isolation, no persistence, no data feed, no
destination, no compiler and no chart.

`engine/tests/test_host_surface.py` is the other half. It drives the engine the way
a live host does, with no conformance adapter in the loop: a program loaded from
canonical text, bars pushed one at a time, the order calls read back and placed on
a ledger, a frame folded in at a bar boundary, and a moving bar executed three
times that accumulates once. Every existing test drove this engine in batch, so
nothing held the surface a live host actually uses.

**And the record says what is true.** The registry page claimed there was no second
engine and no case files; both have existed for some time, and it now says the one
thing that is still true, which is that no engine anybody else wrote has run the
suite. The trading-mode sense of "paper" is gone from the documentation, the
specification and the error catalogue, and `docs/running/paper-and-live.md` is now
`docs/running/sandbox-and-live.md`: this platform maintains sandbox mode and
analyzer mode and now says so everywhere. The trading sense of "arm" is gone from the language itself, not
only from the prose: `leg.trail`'s and `book.lockProfit`'s `arm` parameter is
now `activateAt`, and the events `trailArmed` and `lockProfitArmed` are now
`trailActivated` and `lockProfitActivated`, which is the word the event table
already used in `trailToEntryActivated`. Both names are marked planned, so no
script running today is affected. A `switch` arm and a ternary arm are language
vocabulary and are untouched.

**Three cases where the destination behaves badly.** Every one of the 204 frames
the suite held was an order working and then filling whole: no partial fill, no
refusal, no cancellation, no expiry, and no frame arriving later than the bar
that placed its order. Two engines agreeing over that agreed about the half of a
day that costs nobody anything. Three cases are harvested from the crossing
example against a destination told to behave badly on a schedule stated before
the run, and each one reaches a shape `stdlib.md` 17.7 and 17.8 provide for and
no case carried.

- `order/partial-fill`. The first entry is acknowledged with nothing filled,
  reports 400 of its 1084 units two boundaries later and the rest five
  boundaries after it was taken, and the close that ends the trade arrives in
  two pieces as well. The first trade has two entries and two exits where every
  other trade in the suite has one of each, its entry price is the average over
  two pieces filled at two prices, and the run is charged for fourteen fills
  where the same run against a destination that fills whole is charged for
  twelve. An engine that reads a cumulative quantity as a delta folds 1484 units
  onto a 1084 unit order.
- `order/ended-unfilled`. The first three entries are refused carrying the
  destination's own text, expire, and are cancelled, each after being
  acknowledged and each with nothing filled. Because nothing fills, no position
  opens on any of the three, the crossing back finds the strategy flat and sends
  nothing, and the run reaches three trades where the plain run reaches six. It
  is the only case in the suite carrying a `rejection`.
- `order/fold-after-terminal`. The first entry is cancelled a boundary after it
  is taken and reported filled whole the boundary after that. The row ends
  `cancelled` carrying 1084 filled and an average price, which is what 17.8
  describes and why: a cancellation can race a fill at any destination, and an
  engine that refuses the late frame leaves the account holding a position the
  strategy cannot see.

The suite is eight cases now, 273 frames, 140 ledger rows and 66 trades. Across
it a frame says `working` 137 times, `filled` 132, `cancelled` twice, `rejected`
once and `expired` once, and a ledger row ends `filled` 131 times, `placed` five
times, `cancelled` twice, `rejected` once and `expired` once. Two of those
`working` frames carry part of an order rather than none of it, and five of the
`placed` rows are the order each run was holding when its bars ran out.

**A schedule that stops producing its status is refused rather than harvested.**
An act names an order by its ordinal and the run decides how many orders there
are, so a schedule can stop reaching its order without anything failing: the
case is still harvested, still passes, and tests whatever the plain run tests.
`scripts/lib/venue-schedule.mjs` holds each act to the frames the run recorded,
by the facts the act itself fixes and by the row it reached, with the status
vocabulary read out of `stdlib.md` 17.7 rather than copied into it. Twenty four
wrong schedules and wrong pages were put to it and all twenty four were refused:
every ordinal moved past the orders the run places, one act moved past the end
of the run, the plain run asked about a schedule it never ran under, the acts
written in reverse, a verb no word on the page is the stem of, a page with no
status table, a rejection text no frame carries, and a piece of 401 where the
run reported 400. The first version passed one of them, a fill of a whole order
answered by whichever later order happened to fill, which is why an act is now
held to the row its own order was answered about.

**The second engine now carries a frame's instant, and the suite is eight of
eight between the engines.** It did not when the three cases landed: three places
built a frame and left the column off, so every frame carried the instant of the
bar that placed the order and the three new cases failed on the second engine at
`orders[].updatedAt` and at nothing else, with the partial quantities, the
cumulative averages, the refusal text, the trades with two entries and two exits
and the whole summary agreeing exactly. The three were
`openscript/adapter/ordering.py`, where the driver builds the frame it delivers;
`tests/recorded.py`, whose `DeliveredFrame` had no field for the column and read
seven of the file's eight; and `tests/replaying.py`, where the replay that holds
the ledger to a case builds its own. Each now sets it, and an absent column still
leaves the ledger whatever instant the placement carried.

And the language's own `cancel(...)` is still exercised by nothing, because no
shipped example calls it: the cancellation in `order/fold-after-terminal` is the
destination's own and not the strategy's.

**A report says how far the run climbed, and which side made the money.** The
summary answered twenty six figures and could not answer three questions a
reader decides on. A run that made ten and gave back nine reports the same net
profit as one that made one and kept it, and no figure separated them. A run
whose long trades paid for its short ones reported a healthy net, because every
figure in the summary is folded over both sides at once. And how many times in a
row a strategy was wrong, which is the number that actually stops somebody, was
not derivable from the win rate, the drawdown or the trade count.

`maxRunUp`, `maxRunUpPercent` and `maxRunUpAt` join the summary, and `runUp` and
`runUpPercent` join every point of the equity curve. Run-up is measured from a
running trough anchored at the run's capital, which is the running peak's rule
rather than its mirror image: a trough anchored at the first reported point
would report the gain a run arrived with as having come from nowhere. The
fraction is **zero wherever that trough is not above zero**, and that asymmetry
with `maxDrawdownPercent` is deliberate. A peak only rises and stays above zero
throughout any funded run; a trough only falls, and an open position can lose
more than the account holds, so it reaches zero and passes it. Against a
negative basis a positive climb divides to a negative fraction, which is the
shape that once reported a profit factor of minus a half. `maxRunUp` itself is
unaffected and is the figure to read on such a run. The height and the depth
name different bars, and the earliest bar reaching either wins the tie.

`analysisOf` and the report's new `analysis` are the trades taken apart: the
closed trades split long against short with each side's own net and win rate,
the largest win and the largest loss as nets after charges, and the longest run
of wins and of losses. The sides partition the closed trades, so their counts
sum to `tradeCount` and their nets to `netProfit`. A streak is counted **in the
order the trades closed**, which differs from the order they opened whenever a
trade is held across another one's whole life, which is every strategy that
scales in; two trades closing on one bar are ordered by the order they opened,
so the answer does not depend on the order the list arrived in. A trade whose
net is exactly zero breaks a streak and extends neither half.

**What is proved, and what is not.** Run-up is in the `performance` channel, so
all five conformance cases compare it between the two engines exactly; that was
checked by removing it from one engine and watching every case fail. The trade
analysis is **not** in that channel, because the channel holds one flat object
and the side split is nested, so it is proved by unit tests on each engine and
by nothing that compares them. Whether it is flattened into `performance` or
becomes a channel of its own is left open rather than answered in passing.

**And the gap that was invisible is now closed.** Until this release the
summary's figures had no formula stated in any specification document: the two
engines agreed on them because one was translated from the other, not because a
sentence said what they are, so a third engine had nothing to be written
against. `conformance.md` section 4 now defines every field of the summary: the
words the formulas are written in, which trades each figure is counted over, the
equity basis the curve figures are folded from, which figures are absent rather
than zero and why, and the tie rules. The equity curve, drawdown and win rate
rows of `feature-matrix.md` section 30 move from `planned` to `specified` on the
strength of it.

The trade list does **not** move, and the section says why in its own text: how a
run folds the `trades` channel out of its fills is still unspecified, so that
channel is the boundary of what these formulas promise. An engine checking itself
against a case is handed every value they need; an engine folding a report out of
fills alone still has that earlier fold to agree on. `spec/decisions.md` 64 is the
minute.

**A case supplies the frames, and this engine folds them.** `conformance.md`
section 3 has said since it was written that `frames.csv` supplies order frames
the way `bars.csv` supplies bars, so that a case asserts the fold against input
the engine did not choose. This engine's adapter did something else: it re-ran
the case on its own simulated destination and held the frames that run answered
to the case's file byte for byte, reporting the case `unsupported` when the two
differed. So the suite could hold only cases whose frames this engine would have
produced anyway, which is why all 204 frames in it are an order working and then
filling whole, and why a partial fill, a rejection, a cancellation, an expiry
and a fill after a terminal status were all shapes the page provides for and no
case could carry. Two engines agreeing on that suite agreed about the half of a
destination's day that costs nobody anything.

`backtest` now has a second driver beside it, `backtestSupplied`, which delivers
the rows a case supplies and answers none of its own: no fill priced off a bar,
no order resting and no schedule read, so an order the frames say nothing about
stays where its placement left it. A case with no `frames.csv` still runs
against the simulated destination, because section 3 ends that such a case is
handed no frames at all. The two are one function underneath, so the window, the
refusals before the first bar, the boundary a frame is folded at and the record
are the same for both. A row naming an order the run never placed is delivered
and refused by the fold rather than dropped on the way in, which is what section
3 hands an engine such a row for, and a row no boundary of the run delivers, one
after the last bar or one naming no bar, makes the case `unsupported` naming the
row rather than run with part of its own input passed over. `spec/decisions.md`
63 is the minute, and section 3 now says where a frame naming no row is
answered.

The backtest module's door also exports `VenueAct`, `VenueDoes` and
`VenuePolicy` beside `Simulator` and `SimulatorOptions`. A host writing a
schedule for the simulated destination had to reach them structurally, through
`SimulatorOptions['fill']`, and a module's index is its only door.

**What this does not close.** The second engine reads a frame's instant out of
the file and does not put it on the frame it hands its ledger, so a case whose
destination answered later than the bar that placed the order is answered
differently by the two engines, by `updatedAt` and by nothing else: every other
field of the ledger, the trades and the whole performance summary agree exactly
on a case harvested and measured here. That line belongs to the file that owns
that delivery. `BacktestSettings` still states no schedule of its own, because
the field needs a row in a projection this stage does not own, and
`docs/integrating/running-the-suite.md` still describes the reading this change
replaces. None of this is a change to what an engine computes for a case that
supplies the frames its own destination would have answered: the five cases in
the suite pass in both modes, exactly, as they did.

**A frame carries the instant it arrived at.** `frames.csv` gains a `time`
column: the destination's own instant for that frame, UTC milliseconds, absent
as `none`, last in the row and optional in the way `orderRef` and `text` are.
`host-interface.md` 7.2 gives a frame that instant and `stdlib.md` 17.7 folds a
ledger row's `updatedAt` from it, so while no column carried one an engine
driven from a case file had nothing to move that field to and left it at
`placedAt`, while an engine answering its own frames carried the instant it
spoke. The two readings differ by one field, on exactly the rows whose
destination answered later than the bar that placed the order, and every frame
in the suite today arrives at the boundary that placed its own order, which is
why a suite made of them passed both. The column makes the instant input, like
every other byte of a case.

A record carries it too, because a projection can only write what the run kept:
`RECORD_VERSION` is 4, a record written before it reads with no instant on any
frame, and a later revision is still refused rather than read under this one's
rules. Both readers read the column, this engine's and the second engine's, and
`conformance.md` section 3 now says what a `time` means, that a case is not
required to state one, and why. `spec/decisions.md` 62 is the minute.

**What this does not close.** The five cases in the suite were harvested before
the column existed and carry the seven columns of the day, so they are stale
rather than wrong, and until they are harvested again `npm test` stops on them
at `scripts/harvest-cases.mjs --check`, which projects each run again and finds
eight columns where the file on disk has seven. `frames.csv` is the only file it
names. Measured with the five harvested again and nothing else changed: 1843 of
1843 unit tests, the harvest check passes, and the two engines agree on 5 of 5,
exactly. The second engine reads the instant and does not yet carry it onto the
frame it hands its ledger, which is one line in the file that owns that
boundary. None of this is a change to what an engine computes: the ledgers, the
trades and the money of every case are what they were.

**The destination can be told to behave badly, on a schedule stated before the
run.** `SimulatorOptions.fill` now carries one: a list of acts, each naming the
nth order this destination took, how many boundaries after the one that took it
the act falls, and what it does. Four verbs, and between them they reach every
status of `stdlib.md` 17.7 a host may send. A fill carries a cumulative
quantity, so one verb covers the acknowledgement before anything has traded, a
fill of part of the order and a fill of the whole of it, and the other three are
the three ways an order ends carrying less than it asked for: refused, cancelled
and expired. An order the schedule names is answered by the schedule and by
nothing else, and a run that states no schedule is answered exactly as before,
which is what keeps every case already harvested the bytes it was harvested as.

There is no random number in it and there will not be one. `stdlib.md` 8.2 keeps
a script that answers differently on a second run out of a conformance suite,
and a venue that rolled a die would make every case harvested from it
unreproducible in the same breath. The venue works out the average over the
cumulative quantity itself, because that is the figure `stdlib.md` 17.8 step 3
says the row takes whole, and a destination reporting the last piece's price as
an average hands the engine a number that is not one, which the engine may not
correct because it is forbidden to average two averages of its own.

**What the suite had never been handed, measured rather than guessed.** Across
the five cases in this suite there are 204 frames: 102 that say `working` with
nothing filled and 102 that say `filled` with the whole order, and nothing else.
No frame reports part of an order, none arrives at a boundary later than the one
that took the order, and the words a host may send for a refusal, a cancellation
and an expiry appear no times at all. So the two engines are held to each other
over a destination that behaves perfectly, which is not the half of a day that
costs a trader money. The venue above is the half of the fix that could ship
here; the cases it can now produce cannot be added to the suite yet, for two
reasons that this release records rather than hides.

The first is this engine's own adapter. `conformance.md` section 3 says
`frames.csv` supplies frames the way `bars.csv` supplies bars, so a case can
assert the fold against input the engine did not choose, and a backtest here
answers its own frames from its own destination and can be handed none. The
adapter says so honestly, comparing the frames its run answered with the file
and reporting `unsupported` when they differ, so every case in the suite today
is one whose frames this engine's destination would have produced anyway. A case
about a destination that behaves badly is by definition not one of those.

The second is in the file. A frame carries a `time` under `host-interface.md`
7.2 and `stdlib.md` 17.7 folds `updatedAt` from it, and `frames.csv` has no
column for one, so an engine folding a case's frames leaves that field at
`placedAt` where an engine answering its own frames carries the instant it
spoke. Every ledger row in the suite today has the two equal, because every
frame in it arrives after the bar that placed its own order, so no case can tell
the two readings apart. Section 3 now says this, and says what would close it.
The two engines were driven over three harvested cases carrying a partial fill,
an order filled over more than one bar, a refusal with the destination's own
text, an expiry, a cancellation and a fill arriving after a terminal status, and
they agreed on every figure of all three except that one field.

**The second engine has a home, and the gate covers both engines.** `engine/`
holds a Python distribution: the package `openscript`, importable as one name,
its tests beside it, and the tools that run them. It requires an interpreter and
nothing else, so a clone runs the tests as it stands, with no install and
nothing fetched from an index. The entry point the suite's adapter starts is
`python -m openscript`, which works from an installed distribution and from the
directory unchanged. `__init__.py` is the door, and it says what is where: the
machine, the two halves of the library, the orders, the money and the adapter,
each of which is an entry of its own below.

`npm test` now runs `scripts/check-python.mjs`, which finds an interpreter,
refuses one older than the distribution requires, reads every import in the tree
against the module names that interpreter says are its own, and then runs the
engine's tests under it. A missing interpreter fails the gate rather than
skipping half of it, because a suite that quietly checks one engine is how two
engines drift apart. The empty dependency list is therefore a measured fact
rather than a claim about a file, and inside the package the network, threads,
randomness and the locale are refused as well, each with the sentence from the
specification that refuses it.

**The no-eval check reads Python.** A `.py` file used to land in the check's
`unknown` pile and stop the build, deliberately, because code that nothing scans
is the one thing that check will not allow. It now has an arm of its own: a
masker that removes comments, marks string literals, reads a formatted string's
substitutions as code and normalises every identifier the way an interpreter
does, and rules that refuse the string evaluator, the statement executor, the
compiler underneath them, the import machinery driven by hand, objects loaded
out of bytes, function and code objects built at run time, the namespace of the
built-in names, a namespace taken as a dictionary, a process, and the modules
whose purpose is running text handed to them. `ast.literal_eval` is safe and is
allowed, and the rules are written so that it and an ordinary pattern builder
both pass untouched.

The identifier normalisation is the one with no counterpart on the JavaScript
side. An interpreter normalises a name before resolving it, so a call written in
mathematical or fullwidth letters is the same call to it and invisible to any
pattern written against plain letters. Three such spellings are in the attack
corpus, each one run under an interpreter before it was written down, and every
form in that corpus goes through the rules before the check opens a file.

**A Python test run leaves nothing behind and refuses to prove nothing.**
Bytecode caching is off before the first test module is imported, so no cache
directory appears in the tree, and the test count is a result rather than a line
of output: a discovery that found no tests, which the standard runner reports as
a pass, fails instead.

**A run record becomes a conformance case.** `caseFilesFrom(record, identity)`
returns the files of one case, keyed by the names `conformance.md` section 2
gives them: `case.json`, `script.os`, `bars.csv`, `expected.json` and
`instrument.json`, with `frames.csv` and `settings.json` where the run had
frames or inputs. It returns text and writes nothing, because core does no I/O,
so the caller decides where a case lives and the same call works in a browser.

This is what the suite the second engine will be measured against is built from.
A case written by hand asserts what somebody believed a run does; a harvested one
asserts what an engine actually produced, over bars that existed, under settings
somebody chose.

**Record version 2 carries the script's text**, in a new `sourceText` channel.
A record identified its script by hash, and a hash settles whether two files are
the same without yielding either of them, so a case could never be given the
`script.os` it is required to hold. The text is checked against that hash when
the record is written: text from a different revision than the one compiled is
refused, rather than written into a case that could not reproduce its own
expected output.

The text is on the record and not on the compiled program. A program is
executable data that no engine needs the source to run, and it is the versioned
artefact other implementations depend on; putting the text there would send a
script everywhere a program travels and widen the format every engine reads. The
compiled format is unchanged.

**Record version 3 carries the instrument record**, in a new `instrument`
channel: the twelve facts of `host-interface.md` 4.1 as the engine read them at
load. A record carried the money layer's contract, which holds six of them, and
the interval, the timezone, the session and the volume flag were handed to the
engine and written down nowhere, so `instrument.json`, which section 2 says is
that record, was the contract instead: a shape with a rounding digit count no
instrument record has and without the one fact that page requires of every
host. `backtest` takes `instrument` in its options, the six facts beside the
contract; the six the contract holds cannot be stated there, so the two cannot
disagree. A run whose host states no `hasVolume` still runs and still records,
and is refused a case rather than handed a value, because no derivation
recovers that flag and a case stating it would give the engine under test a
study the expected output did not come from.

**A record written before this still reads**, with the channels it never
carried absent: `sourceText` before version 2, `instrument` before version 3. An
earlier revision only ever has fewer channels, and every one it carries means
here what it meant when it was written. A later revision is still refused, which
is the asymmetry that matters: a later one may mean something new by a field this
version thinks it knows. Such a record replays and reruns as before; the one
thing it cannot do is become a case.

**A harvested case's `expected.json` is the shape section 4 fixes.**
`performance` is a list of one flat object, the summary statistics. The equity
curve, the monthly table and the trade markers are no longer written inside it:
the first two are not conformance channels, and a marker belongs to the
`markers` channel, which a case about money does not assert. A case now writes
exactly the channels it declares in `case.json` and no others.

**Specification decisions for the second engine.** Three, all in
`conformance.md` and `stdlib.md`, and each one was a place two implementations
could not have been written against the same page.

*The adapter is invoked once per case*, and the runner assembles the result
document. The page allowed both readings. Per-case is forced by the `error`
outcome, which covers a crash, a hang and a timeout: none of the three can be
reported by the program that suffered it, so only a caller holding a clock and a
child process can turn them into an outcome.

*An adapter also answers `--actual`*, writing what it computed with no
comparison. Section 10 requires comparing two engines channel by channel, and a
case result carries an outcome and a first difference rather than the values, so
two adapters both reporting `pass` proved only that each matched an expected
file, which is the thing that section says is not enough.

*The equity curve is not a conformance channel.* It is one value per bar derived
from fills and closes that the case already asserts, so it can only fail with the
channels it comes from or alone, and alone means the engines disagree about
arithmetic section 6 compares directly. It was also most of the bytes in a case.
Trade markers move to the `markers` channel, which already existed, and
`performance` is a list of one flat object.

**The transcendental gap is scoped out of conformance rather than solved.**
`exp`, `log`, `pow`, the trigonometric family and the three indicators built on
them have no portable reference algorithm, and `compiled-program.md` 8.3 forbids
answering them from the platform's maths library. No conformance case may assert
a value reaching them until one is written. They still compute what they always
did; what they do not carry is a cross-engine guarantee. The deciding fact was
deployment rather than theory: the first host installs across two processor
architectures and most common operating systems, so that one library is several
in practice, and the disagreement is two traders reading two numbers.

**A harvested case carries the frames the run was handed.** Without them the
case was unpassable on every engine, including the one that wrote it:
`conformance.md` section 3 ends "a case with no `frames.csv` is handed no frames
at all", and what `expected.json` asserts through its orders channel is what came
of those frames. An engine handed none folds nothing, disagrees with every row,
and takes the blame for a hole in the case. A frame names its intent by ordinal
rather than by an engine's own id, because a case cannot know the id another
engine minted.

`caseFilesFrom` and its types are exported from the package root, so an install
can reach the one function that turns a run into a case. `DriveOptions` and
`InstrumentFacts` are exported beside them, so a host can name what `backtest`
takes.

`backtest` takes `sourceText` and `instrument` in its options. A caller that
has only a compiled program leaves the first out, one that states nothing about
the instrument beside the contract leaves the second out, and either loses
nothing but the ability to harvest.

**The first conformance cases are in the tree, harvested rather than written.**
`scripts/harvest-cases.mjs` runs the shipped strategy examples over the Phase 5
gate's fixture, the placeholder contract and four hundred formula bars, under
the instrument facts `conformance.md` section 3 assumes of a case that states
none, read from that page, and writes each run into `cases/<id>/` through
`caseFilesFrom`, with a `notes.md` saying why the case exists and what it
defends against. The first two: `order/buy`, from the crossing strategy, and
`order/sell`, from the opening range strategy. The rows of
`feature-matrix.md` that name them are the first marked `implemented`, and the
gate's contract and bars now live in one module the reproducibility check and
the harvest share, so what the gate reproduces is what the suite holds.

**The harvest is a check as well as a writer.** Run with `--check`, which
`npm test` does, it writes nothing and fails the build when a case on disk is
not what this engine produces, byte for byte; when a case it wrote names a row
that does not say `implemented`; when an `implemented` row names a case
directory that is not there; or when a case directory exists that no row names.
Every script is harvested twice and the two compared before anything is
written. A script that reaches a gap of `stdlib.md` section 20.11 is refused by
name with the call that reached it, by the gate's own reading of that table,
which now lives in one module the gate's test and the harvest share; and a
strategy this driver cannot run is named and counted rather than passed over.
The short premium example reads a second instrument, which a backtest over one
series of bars cannot supply, so nobody has chosen a case identity for it, and
that is what the report names it for.

**The feature matrix is checked against the tests and the pages it cites.**
`scripts/check-matrix.mjs` enforces the preamble of `spec/feature-matrix.md`,
which described a checker nobody had written, and `npm test` runs it. Every
feature row has five cells and a status the page lists; every citation resolves
to a Markdown document under `spec/` and, where it carries a locator, to a
heading matching the shape the preamble gives; every test identifier is well
formed under a listed area and no two rows share one; an `implemented` row
names a test that exists, a `unit:` identifier written by a file under `tests/`
or a case directory holding its `case.json`; and a case directory no row names
fails the build. Existence is what it proves, and the unit runner and the suite
prove passing. A `specified` or `planned` row naming a case that is not written
is not a failure, which is the direction the preamble's paragraph on
`conformance.md` settles: such rows reserve an identifier, and they are counted
and printed rather than failed. The status words, the column names, the heading
shapes and the areas are read out of the page rather than retyped, every rule
is attacked with a row it must refuse and one it must accept over a fabricated
document and tree before a row is read, and a run that reads no row refuses.
It prints the row count, the count per status and the implemented ratio, which
is the number the page says nobody types. The preamble now names the checker,
says `none` is written in backticks, says what makes a unit test or a case
exist, and no longer says every row is unimplemented.

**This engine has a conformance adapter, and the suite has a runner.**
`scripts/adapter.mjs` is the program `conformance.md` section 9 says an
implementation ships, answering the three invocations that page gives:
`--describe` for the engine's identity, a case directory for one case result,
and `--actual` for what the engine computed with no comparison made. It loads
the built package by its door and nothing behind it, reads a case directory by
the file names section 2's table gives and refuses a file the table does not
name, compiles `script.os`, runs it over `bars.csv` under `instrument.json` and
`settings.json`, and answers the channels the case asserts in the encoding
section 4 gives them. The channels are read out of the same projection the
harvest writes a case with, so what this engine can be held to is stated once.

`scripts/run-suite.mjs` walks `cases/`, invokes an adapter once per case in a
child process with a timeout, turns a crash, a hang, a timeout or an answer
that is not one JSON object into the `error` outcome with the reason in the
row, and writes the result document of section 9. Both modes of section 10 are
there: against the expected files, and `--against` a second adapter, where each
is asked for `--actual` and the runner compares the two channel by channel with
tolerance zero, whatever the case declares. A case outside the claimed profile
is skipped and never counted as a pass; any failing, erroring or unsupported
case exits non-zero. Every harvested case passes on this adapter, alone and
against itself. `docs/integrating/running-the-suite.md` is the page.

**The comparison of section 6 is written once**, in `scripts/lib/compare.mjs`,
and the adapter and the runner both call it: absence first and never inside a
tolerance, a non-finite value as its own `nonFinite` outcome, signed zero
normalised, equality over the binary64 bits rather than a decimal rendering,
exact by default, and the `max` form of the two bounds with the bound that was
broken named. A declared tolerance is refused, not clamped, past the cap the
page prints or without a reason. Every step has a test written against the
implementation that would get it wrong, and each was run against that mutant.

**What the adapter says it does not reach**, reported on the case rather than
passed over. This engine's backtest answers its own frames from a simulated
destination and takes none from a file, so the frames it answered are held to
the case's `frames.csv` byte for byte and a case whose frames the destination
did not answer is `unsupported`; every harvested case runs. A per-bar or chart
channel, a warning case, `ticks.csv` and a secondary series are `unsupported`
by name. A per-column tolerance is not read, because section 6 fixes no shape
for one. Two facts the page owed a place when the adapter was written: the
money rounding digit count, which `backtest.json` below now carries and which
the adapter still takes from the fixture every harvested case ran under until
it reads that file, and a currency for section 3's default instrument, without
which the money layer refuses a strategy case that states no `instrument.json`.
The suite revision has no fixed place either, and the document carries the
package version until it does.

**A case carries what its report was folded under.** `backtest.json` is a new
file of a strategy case, `conformance.md` sections 2 and 3: the money rounding
digit count, the charge schedule the host supplied or `null` for the
declaration's own, and the report window with `null` for an unstated bound. A
run under a supplied schedule or a narrowed window harvested to a case that said
nothing about either, so a second engine ran under other values and took the
blame, and no case file carried the digit count at all. The count is not in
`instrument.json` because `host-interface.md` 4.1 has no such fact, and the
three are not in `settings.json` because that file is the script's inputs keyed
by name. Every field of `BacktestSettings` now has a place in a case,
`caseFilesFrom` carries the table saying which, and a record whose settings hold
a field the table does not know is refused by name rather than written into a
case that ran under something it does not state. The two cases in the tree at
the time were re-harvested and gain the file; nothing else in them changed. Decision 61 has
the reasoning.

**A record past the tolerance cap makes no case.** Section 6 caps a declared
tolerance at `rel = 1e-9` and `abs = 1e-12`, and the runner refused a case past
it while nothing refused a record past it, so a harvest could write a directory
every runner errors on. `caseFilesFrom` now refuses such a record with OS6021,
the code the run refuses a setting with, and writes no file. The cap's two
figures are read out of the page by a test and held to the constants in core,
which cannot read the page itself. `CaseRefusal` gains `code`: the catalogue
code a refusal is filed under, or `null` for a refusal about what the record
holds, which no catalogue entry is about. `reason` is unchanged.

**How a number becomes text is one written rule, and one function.**
`language.md` 5.5 states it completely: the shortest round trip digits, written
positionally from ten to the minus seventh exclusive up to ten to the twenty
first exclusive and with an exponent outside that range, spelled `1e21` and
`1.5e-7` with never a plus, `0` for both zeros, and no spelling for a value that
is not finite. `canonicalNumber` from the emit module is the writer every number
goes through: `text(x)`, `text(x, decimals)`, the canonical encoding, and a
harvested case's csv files. `spec/vectors/number-text.json` carries fifty one
boundary cases as binary64 bit patterns, decimals and text, so an engine in
another language can hold its own writer to the rule without parsing this
repository's source. A new check, `scripts/check-number-writer.mjs`, asks the
type checker for the type of every operand under `src` and refuses a number
turned into text by the host anywhere else; the files that still format a
number for a human are recorded in `spec/number-text-exceptions.json` with an
exact count each.

**`text(x, decimals)` writes the shortest digits at every magnitude.** It used
to write the exact binary expansion of the rounded whole number inside the
scaling range and the shortest form past it, so `text(1152921504606846976, 0)`
gave `1152921504606846976` and now gives `1152921504606847000`, the same digits
`text(x)` gives the value. Only a scaled whole at or above 2 ** 53 is affected;
no price shaped value moves by a digit. The scale it multiplies by is now the
binary64 nearest to the power of ten rather than the host's `pow`, which on this
host is one ulp off at 23 decimals, so `text(3.0627e-8, 23)` no longer ends in a
stray 1, and 20.7 prints the measured figures beside the claim.

**`str.trim` and `toNumber` use a written whitespace set.** `stdlib.md` section
10 now lists the twenty five code points with the Unicode White_Space property,
and both calls are implemented from the list rather than from the host's trim.
The one visible change: the byte order mark U+FEFF is no longer removed, and the
next line character U+0085 now is. A test walks every code point of the basic
plane against the table read out of the page.

**Strings sort by code point, as the specification always said.** `sort` on an
array of strings orders a symbol outside the basic plane after every code point
of the plane, where the host's own order put it before U+E000 to U+FFFF.

**Two corrections a script can observe, for anybody deciding whether to
upgrade.** The `<` family of operators on two strings orders by code point, as
`sort` does and `language.md` 9.3 always said, where it used the host's sixteen
bit units: a comparison between a symbol outside the basic plane and a code
point from U+E000 upward changes its answer, and no other pair of strings does.
`round(x, decimals)` scales by the binary64 nearest to the power of ten, the
scale `text(x, decimals)` uses, rather than the host's `pow`, so a value rounded
at 23 decimals can move by one unit in the last place and a value rounded at any
other count cannot. A stored run that did either reproduces to a different
number after the upgrade; nothing else changes. Decision 60 has the reasoning
for both.

**A program at a lower minor of the same format major loads.** The engine
required every table of its own minor, so a program compiled at format 1.0 was
refused by the 1.1 engine at load, at `requests`, with a message about a
malformed program. `compiled-program.md` 9.4 step 3 now says what 9.5 always
promised: a table a later minor added and an earlier program lacks reads as
empty, never as a refusal. A program at the engine's own minor or a later one
that omits a table is still refused, because section 2 says an empty table is
written and never omitted, and the version is what tells an older program from
a malformed one. Decision 56 has the reasoning.

**`loadText(text, options)` is the engine's text boundary.** A program that
arrives from outside the process as text is parsed, written out again through
the one canonical writer, and refused with OS6018 naming the character where
the two part if the text is not the canonical encoding of 2.14; the object then
goes through `load` so every later refusal applies in the same order.
`load(object)` is unchanged and is not held to canonicity, because an object
built beside the engine was never text. Section 13's first checklist line and
9.4 step 1 now say the same thing (decision 57). The function lives in
`src/core/engine/load.ts` and is exported through both doors, the engine's and
the package's.

**The compiled format is held to its page by four checks.**
`check-format-tables.mjs` reads the instruction table of 4.13 and the tag table
of 2.2 out of the page and compares them with the compiler's opcode table and
tag list, probing a formula depth with several counts rather than reading it as
arithmetic. `spec/format-history.json` records, per released format version,
the field paths, opcodes and capability tags it defined and the sentence of
section 9 that justified the bump, and `check-format-additive.mjs` fails on a
field, opcode or tag the compiler gained that no version records and on one a
version records that the compiler lost, naming the path. `spec/corpus/` holds
the canonical encoding and `programHash` of every shipped example, and
`check-format-corpus.mjs` recompiles each one and compares the bytes, reporting
the first differing byte offset and the field path at it; the recompiled
program is given the corpus's own `compiler` stamp first, so a package bump
alone never fails it. A format change is now a deliberate act: record it in the
history, rewrite the corpus with `--write`, and review the diff.

**The named colours' channel values are published.** `stdlib.md` 11.1 said they
are fixed in the library manifest and are part of the conformance suite, and
they lived only in two source files. `spec/colours.json` now holds them, 11.1
names that file as the authority, and `check-colour-channels.mjs` holds the
compiler's table and the engine's table to it while stating no value of its
own. No value changed; what changed is that a second engine can now read them
from the specification.

**The library's arithmetic ships as vectors a second engine can load.**
`spec/vectors/library/` holds one JSON file per arithmetic function of the
manifest, keyed by name and argument count, with inputs and results as binary64
bit patterns (sixteen hex digits, sign bit first) rather than decimals, so
nothing about this repository's number formatting sits between another
implementation's arithmetic and this one's. Each function gets several cases:
the full 80-bar fixture the gate tests already use, the same with holes in every
series, a history shorter than any length, every constant argument absent, an
edge table for the stateless calls, and a bar with no volume, no session or no
tick where the function reads one; every case records the bar facts the
function read and the warmup index of every output. `index.json` names every
file and the 135 manifest entries in six groups that hold no arithmetic, each
with the reason. `docs/integrating/library-vectors.md` says how to decode, drive
and compare a file from another language, in under a page.

**A case that reaches a gap of `stdlib.md` 20.11 is written and marked, not
left out.** Twenty functions have such a case (the transcendental calls and what
is built on them, `hma`, `eom`, and the `ma` and `keltner` cases that select
`hma` by name), and each case carries the gaps its call reaches, read by the
gate's own reading of the table, so an implementer knows which numbers they are
not held to. `spec/decisions.md` 59 records why a vector is written where a
conformance case would be refused. `npm test` regenerates the directory and
fails on a byte that differs (`scripts/check-library-vectors.mjs`), so a vector
is never older than the engine, and a regeneration is a deliberate act committed
with the change that caused it.

**The second engine runs a strategy, and the build fails when the two engines
disagree.** `engine/` now holds an engine rather than a home for one: the
machine of `compiled-program.md` section 5, both halves of the library in the
accumulation order `stdlib.md` section 20 fixes, the order ledger and the fold
of section 17, and the money that turns fills into trades and a summary. The
conformance adapter joins them over a case directory: it reads `frames.csv` and
`backtest.json`, delivers each frame after the bar it names and folds it before
the next execution, applies the order calls a decided bar left behind, and
answers the `orders`, `trades` and `performance` channels beside `diagnostics`
and `values`.

Every harvested case passes on it, against the expected files and against the
first engine. That is four hundred bars a case, 104 ledger rows and 51 trades
folded into five summaries, reproduced to the last bit, with every figure here
read out of `cases/*/expected.json` rather than remembered.

**What was read from the pages, and what was not.** The behaviour is the
pages': the machine of `compiled-program.md` section 5, the fold and the ledger
of `stdlib.md` section 17, and the accumulation order section 20 fixes for every
library function, with the arithmetic held to `spec/vectors/library/` bit for
bit. The decomposition is not: the modules of `strategy/` and `accounting/`
fall one to one against the first engine's order ledger and money layer, name
for name, and much of the prose explaining them is that engine's prose. A reader
deciding what the gate is worth should have both halves of that. Two engines
agreeing to the last bit says this one computes what the other computes, which
is what a host needs and what the release is gated on. It does not say the pages
alone were enough to build an engine from: a page with a hole in it can be read
the same wrong way twice by somebody with the other engine open beside them, and
no suite can tell that apart from two readings that agree because the page is
complete. Only an implementation from the pages with nothing else to hand can,
and there has not been one. `docs/integrating/the-python-engine.md` says the
same on the page somebody reading the engine reaches.

**`npm test` runs the two engines against each other.** `npm run suite:agree`
hands every case to both adapters with `--actual` and compares what each
computed, channel by channel, at tolerance zero whatever the case declares. A
difference of one bit fails the build naming the case, the channel, the column
and both values. `conformance.md` section 10 calls a disagreement between two
engines a release blocker; this is the sentence made mechanical, and it is the
gate the phase is measured by. `npm run suite` and `npm run suite:engine` run
each engine against the expected files on its own.

One rule belongs to that comparison alone: a run where every case was skipped
now exits non-zero saying it compared nothing. A skipped case is one engine
honestly reporting the profile it claims, which is what the first mode is for,
but in the second mode it means neither engine was asked about a single case,
and a green line there is the evidence a suite with no cases in it would
produce.

**The second engine claims the `strategy` profile**, so a strategy case is run
rather than skipped, and every shortfall is named on the case with the
`unsupported` outcome: a chart channel it does not draw, a capability it does not
serve, a library function its manifest does not hold, a `ticks.csv`, a secondary
series, a calendar in a timezone it cannot read, or a frame delivered after the
last bar, which no fold boundary reaches. `docs/integrating/running-the-suite.md`
holds the whole list and says why a cumulative profile table has no word for an
engine that runs the money and draws nothing.

**Three more cases, and a straight answer about how much the two engines
agreeing proves.** The suite held two cases, and the script was the only thing
that differed between them: no charge schedule, two rounding digits, the whole
of the bars reported, no value stored for an input, one instrument and one entry
at a time, in both. Between them, 47 ledger rows and 23 trades, and every frame
in both was an order working and then filling whole. Three cases join them,
harvested the same way from the same shipped strategies:

- `perf/report-window` reports 151 of the 400 bars, with a position open at each
  end of the window. The ledger, the trades and the realised profit are
  `order/buy`'s to the bit and the summary is not: the bars reported, the bars
  spent holding a position and the deepest drawdown all change, because every
  bar still executes and only the ones inside the window are reported.
- `perf/money-digits` folds the opening range run under a rounding count of zero
  instead of two. Every figure is `order/sell`'s, which is the assertion: the
  count reaches the total of one fill's charges, half to even, and no other
  figure of the report. An engine reading `conformance.md` section 3 as every
  money figure being rounded to that count writes a net profit of -654 where
  this case says -653.55.
- `input/host-values` runs the crossing strategy under three values a host
  stored for its inputs, and is the only case that carries a `settings.json`.
  Ten ledger rows and five trades, where the declared defaults give thirteen and
  six.

That harvest made the suite five cases, 104 ledger rows and 51 trades, each passing against
the expected files on both engines and against the other engine exactly. Each
one was mutation tested before it was committed: an engine that reports every
bar supplied fails the window case at the bar count, one that never opens
`settings.json` fails the input case on the length of the ledger, four rows
where the case says ten, and one that rounds every money figure fails the digits
case at the first trade. The one
mutant that survives is an engine that ignores the digit count and rounds at
two, and the case says so in its own notes rather than leaving it to be found.

**A case is a run, so one example can be more than one case.**
`scripts/harvest-cases.mjs` now harvests every identity that names an example
rather than the first one, and an identity carries what the host chose for its
run: a money rounding digit count, a report window as two bar indices, or values
for the script's inputs. An identity that chooses none is the run the gate
drives everywhere else, which is why the two cases already in the tree are byte
for byte what they were. The harvest's report no longer files a strategy nobody
has chosen a case identity for under the sentence about gaps, which is what it
was doing to the short premium example on every run.

**What the suite does not reach, written down rather than left to be
discovered.** No case supplies a charge schedule: a supplied schedule beside a
declared commission is refused before the first bar (OS6023) and every shipped
strategy declares one, so a case for it needs a strategy example that declares
none. No case hands an engine a partial fill, a repeated frame, two frames in
the wrong order, a fill reported after the order had gone terminal, a rejection,
a cancellation, or a frame naming no row of the ledger. The frames in a
harvested case are the ones its own run was answered, the destination a backtest
runs against fills an order once and in full, and no shipped strategy cancels an
order or leaves one resting, so none of those shapes can be harvested from what
is in the tree today. `docs/integrating/running-the-suite.md` carries the list
beside the commands, because that is where somebody reading a green run is
standing.

---

## 0.4.0

**A backtest is driven, and what it produces is a document rather than a
number.** `backtest(program, bars, settings)` walks a compiled program over a
range of bars against a destination that prices fills, and hands back a
`RunRecord`: the compiled program and the hash of the source it came from, the
bars or a hash naming them, the settings the host chose, every frame the
destination answered in delivery order, every fill the engine folded in fold
order, the ledger the run ended with, the diagnostics and the report. Nothing in
it is an object reference, a function or a shape only this engine can read,
because the same document is what a second engine will be handed as a
conformance case.

**A stored run can be reported again and run again, and both are checked rather
than asserted.** `replay(record)` folds the money again from the record's own
fills with no bar executed, and has to produce the report the record carries:
that is what says the report is a function of the fills and not of anything the
engine happened to be holding. `rerun(record)` executes the record again and the
two runs are compared as bytes. Bars are revised, so a replay over bars that do
not hash to the record's is refused, OS6022, rather than reporting the original
figures over different data.

**The comparison that tells an improvement from noise.** `compareRuns` puts two
records beside each other. Two runs over different bars or different contracts
are two studies, so the pair is reported incomparable and given no separation at
all; a different program over the same bars is exactly what is comparable, and
every other difference is named, because the reason a run improved is as often a
setting somebody forgot they changed as it is the change they meant to test.
Separation is the gap between the two expectancies over the combined standard
error, analytic and with no resampling, so the same pair gives the same figure
for ever. It is null rather than infinite where neither run has the two closed
trades a spread needs.

**The phase's gate is executed rather than promised.**
`scripts/check-reproducible.mjs` runs on every `npm test`, over the shipped
strategy examples rather than over a probe written the same afternoon. Each run
is written to JSON, every other reference to it is dropped, and the record is
parsed back from that text alone; then it is reported again from its own fills to
the same report, executed again to the same bytes, refused a replay over revised
bars, compared with itself to no movement, and refused a separation against a run
over other bars. A strategy needing a capability the driver cannot supply is
named and counted, never skipped.

**The report: a trade list, an equity curve, a drawdown and a month by month
table.** A trade is one position reference from the fill that takes it off zero
to the fill that returns it, so a pyramided entry is more entry fills on one
trade, a partial close is an exit fill that does not close it, and a reversal is
two trades. Win rate is over closed trades on the net after charges, with an
exactly zero net counted as a scratch in neither half; expectancy carries its own
standard error. None of it is readable by a script: the money entries of the
`pos` namespace stay planned and go on refusing at the call, because the moment a
script can branch on its own equity every formula joins the conformance surface.

**Every bar supplied executes and only the ones inside the window are reported.**
A bar before the window is warmup: it runs, its orders are real, and a position
opened on one is carried in with its charges paid. A window holding none of the
bars supplied is refused, OS6020, rather than reported as a flat curve, which is
what a strategy that did nothing also produces.

**The costs are the destination's, where the specification puts them.** Slippage
is measured in ticks and is adverse always, worse on a buy and worse on a sell,
and it applies to a market fill and to a stop and never to a limit. A platform
that has its own rates supplies a charge schedule; a script that states a
commission gets a schedule of one line derived from it; both at once is refused,
OS6023, because two cost models charge the same money twice or charge whichever
an engine preferred.

**A quantity is converted into units by the destination, or the run is refused.**
A quantity travels in the declaration's own unit and the destination is the party
that converts it. Lots are converted through the instrument's lot size, and a lot
on an instrument stating none is refused. Cash and a percentage of equity are
refused by name: a backtest fills in units and works out no running equity to
size against, so it can convert neither, and filling the number as written is
what it used to do.

**What it does not model, said here rather than left to be discovered.** A
bracket reaches the destination as a protective instruction attached to a tag and
the engine appends no order row for one, so a stop cannot fill in a backtest yet
and a page that says otherwise is ahead of the engine. A limit fills only where
the bar traded through it and a stop that gapped fills at the open, both of which
a host can change in the fill policy; a bar is four prices and no path, and
nothing here pretends to know which extreme came first.

The equity curve marks a trade at the size it ended up entering from the bar it
first opened, so a scale-in is marked, before its second entry, on units it did
not hold at an average it had not reached: the curve reports a drawdown the
account never had, and the maximum drawdown figures are folded from it, so a
pyramiding strategy is reported as having risked more than it did. The realised
total is unaffected. Folding the curve from the fills rather than from the trades
is what fixes it, and that is a different fold rather than a correction to this
one.

The conformance case files a second engine would be handed are not written, and
cannot be from a record alone: a case has to carry the source text and a record
carries the source hash, its line count and its file name. Nothing can recompile
a stored revision for the same reason. Both belong to the next phase, and both
are now written down instead of implied.

**Four defects found by review before any of this shipped**, each a wrong number
rather than a crash:

- A quantity stated in lots, cash or a percentage of equity was filled at the
  number the script wrote, so a strategy sizing in lots of sixty five traded one
  sixty fifth of what it asked for and every money figure went with it.
- `checkSettings` asked about the cost model only when the host supplied one, so
  on the path almost every run takes it asked nothing: a declared commission of
  minus five was charged as a credit and turned a loss into a gain. A declared
  slippage below zero improved both sides of every fill through the same hole.
- A month's return was divided by the equity it had already earned, so a month
  that doubled an account reported fifty percent, with the money column beside it
  right.
- A gross loss driven under zero by charges gave a negative profit factor, which
  is a ratio nobody can act on. It is null there now, and the field says it can
  go under zero instead of calling itself a positive magnitude.

A bar time outside the range a calendar can hold, which is what nanoseconds
instead of milliseconds produce, made the monthly table NaN and then threw a bare
error with no catalogue code out of core. Such a time names no month.

**`load` hands back the inputs it resolved**, beside the engine, so that a caller
outside the engine can read the declaration's capital, commission and fill rule
without resolving an input a second time under its own rules.

**`settingsFor`'s second argument no longer names a contract it ignored.** It
took a partial settings object whose contract field it discarded in favour of the
positional one, so a caller passing a contract there silently got the other. It
is now a compiler error at the call.

## 0.3.0

**The editor half is here: six functions, text in and data out, and a drop-in
adapter for a text component.** `src/editor` is a new tier whose index is its
only door. It imports the compiler and nothing else: no package, no browser
global, no DOM type, which the layering check has enforced for it since before
the directory existed. Nothing in it is on screen, and nothing in it is hand
written: a hand written highlighter, completion list or tooltip drifts from the
language and nobody notices for a release.

**Two new entry points resolve: `openalgo-script/editor` and
`openalgo-script/adapters/codemirror`.** They are declared now that the tier they
name exists, because an entry point that resolves to half a tier fails at your
run time rather than honestly at install. A fifteenth check,
`scripts/check-entry-points.mjs`, builds a temporary install holding exactly what
the `files` list ships, with no package of any kind beside it, and imports every
door the export map declares. That is also what says both adapters' peer
dependencies are optional in fact: neither could have loaded if it imported one.

**`highlight(source)` gives every piece of a file, in order, covering every
character exactly once.** The kind of each piece comes from the language's own
tables, so a word added to the reserved list, a mark added to an operator table
and a function added to the standard library manifest are each painted the day
they are added. The covering property is the one a host cannot do without: a
highlighter that drops one character leaves everything after it on that line
drawn one column to the left, and that arrives as a bug report about the caret.
`highlightLines(source)` is the same pieces per line, which is where a host
otherwise makes the off-by-one itself.

Comments come out of `highlight` and are recovered in one place rather than by
each host. The lexer emits none, because the parser has no use for one; the two
ways a consumer ends up doing it, reading the gaps between token spans and
scanning the text for `//`, are folklore and a second lexer respectively, and the
second is wrong inside a string literal.

**`diagnose(source)` is the whole front end**, lexer through emitter, and returns
the compiler's own diagnostics with the message and the fix the error catalogue
gives them. Not a subset: there are codes the emitter raises and nothing before
it does, so an editor that stopped after the checker would show a clean file and
then have the apply refused. A source that does not parse answers usefully rather
than throwing, which is the state a file being typed into is in most of the time.

**What that costs is now a number rather than an impression.** Two measurements
join the benchmark suite, `diagnose-heavy` and `diagnose-typing`, the second on a
file with a call bracket left open half way down it, which is what a file looks
like the moment somebody types one. A third of a millisecond and about a
millisecond, against budgets of 1.5 and 4. That is the answer to whether an
editor needs a compiler of its own: at this price it does not, and the number to
beat is in the table rather than in somebody's judgement.

**`format(source)` lays a file out in the canonical layout, now stated in
`language.md` 3.13**, and formatting never changes what a script means. That is
proved twice rather than asserted: every example and every gate script in the
repository, a hundred and nineteen of them today, is laid out again, both texts are
compiled, and the compiled programs are compared field for field; and every call
lexes its own output and compares it with the tokens that went in, so a rule that
is wrong returns your source untouched rather than a changed program. A source
that does not parse comes back byte for byte, because a character the lexer
refused produces no token and a reprint from the tokens would delete it.

The three questions a reprinter usually guesses at are put to the parser instead:
which `-` is a sign, which bracket groups an expression rather than opening an
argument list, and which `:` belongs to a ternary rather than to a type. All
three are in the tree already, and the guess is where every formatter that has
turned `a - -b` into something else began.

**`complete(source, offset)` offers what may be written there**: the library's
names, the names the file has declared and still has in scope, the named
arguments of the call being written, and the members of a namespace after a dot.
The names are the standard library manifest, the same index the checker resolves
against and the same one the example check reads its globals from, so a function
added to the library is offered the day it is added. A name is offered from the
end of the statement that declares it and inside the block that declared it,
which are the compiler's own two rules rather than a second reading of them.

A call the library names and has not implemented is offered, sorted after
everything a script may write today, and carries the error catalogue's own OS2020
sentence with its name filled in. Leaving those out would send a writer to the
documentation to find out why a name is missing; offering them unmarked walks
them into a script that will not compile.

**`hover(source, offset)` says what the word under the pointer is**, and the
sentence it shows is the cell `spec/stdlib.md` prints for that call. It is read
out of the specification at build time by a new generator rather than retyped
into the source, so a description improved in the specification is improved in
the tooltip, and a test fails if the manifest and the specification ever describe
different sets of names. A name the file declared carries the type the checker
worked out and the span it was declared at; a named colour carries its channels.

Three things a hover wants and has no machine readable source for are stated
rather than invented: a reserved word has no per-word explanation anywhere, a
name with several signatures is described by the first row the specification
states for it, and a parameter has no description of its own. Those, and what the
adapter narrows, are recorded in `spec/editor-narrowings.json`.

**`signature(source, offset)` gives the call being written, which parameter the
cursor is in, and each parameter's name, type, default and whether it is
required.** The default is the one the compiler applies, which is the trap in
this function: most defaults live in the library manifest, and the eight
declaration calls keep theirs in the emitter, so a tooltip reading the manifest
alone shows nothing beside `width?` while every plot is drawn 1.5 wide. Both are
read through one answer that `scripts/check-defaults.mjs` holds to the
specification, so a number in a tooltip and a number in a compiled program cannot
differ without the build failing.

**The adapter, `src/adapters/codemirror`, is a drop-in that draws nothing.** The
text component is a peer dependency and nothing in the adapter imports it, the
same way the chart adapter treats a chart. Both tooltips take their markup as a
required parameter with no default, so no tier of this package names a browser
global at all and every file in it loads in a worker and on a server. Offsets are
translated between the document a component holds and the normalised text every
span in this package indexes, so a file with two character line endings is
underlined in the right place. Highlighting is computed a line at a time, which
is how the component asks for it, and a test compares that against the whole-file
`highlight` over every script in the repository: 4279 lines, not one piece
different.

**Two facts the core now exposes**, because a tier above it needs them and
reading them out of a module's internals would be a second copy: what a
declaration call's omitted argument resolves to, and the channels a colour name
denotes.

Eighty-eight further tests, each naming in a comment the wrong implementation it
catches, on top of the fifty-eight the first three functions came with.
Forty-five of those implementations were then written into the source one at a
time, with every file copied first and restored from the copy by hash afterwards:
forty-three were caught by a test and two by the compiler. One more was tried and
changed nothing a caller can observe, a guard in a private function, and is left
in place and untested for rather than counted as a catch.

**The first run of that harness proved nothing and said it had.** It named the
test directory, and `node --test <directory>` fails on this runtime whatever the
directory holds, so every mutation came back caught. The harness now names the
test files and runs each of its verify commands on the clean tree before it
starts, and refuses to run at all if one of them does not pass. Five mutations
then survived, every one of them a test that could not fail: a completion list
filtered by a word the assertion was about, a signature rendering compared with
the mapping it came from, a stale cache handed an empty cache to be stale with.
All five are caught now, and a control change that nothing should catch is
checked to be caught by nothing.

## 0.2.0

**This release is the studies surface, finished.** A script compiles in a browser
tab in milliseconds and computes, bar by bar, the same numbers everywhere. One
hundred and one independently written studies compile, load and run; five of
them match arithmetic transcribed from `stdlib.md` section 20 alone, bit for
bit, warmups included. The chart adapter turns a compiled study into an
indicator descriptor, and a stored setting now reaches a declaration option
through it.

**Upgrade for studies. Do not upgrade expecting a backtest or an editor.** There
is no equity curve, no drawdown, no trade list and no reproducible run: that is
Phase 5. There are no editor functions: that is Phase 4. There is no second
engine and no conformance suite, so the portability claim is still a design
rather than a result: that is Phase 6. `README.md` says the same in the same
words, because the registry page must not overstate.

**The order surface changed a great deal and is not finished.** A strategy can
place orders through a host and the ledger refuses what the specification says
to refuse, but six rounds of adversarial work on it each found a real defect,
and the entries below are mostly that work. If you are building on orders, read
them. If you are building on studies, the short version is that nothing in the
study path changed under you.

Previously published as `0.1.0-alpha.0` and `0.1.0-alpha.1`, which parsed and
did not compute. This version takes `latest`.


**A bracket now names the position the strategy is actually holding.** `exit()`
and `order.bracket()` hand the host the position reference they protect, and
`host-interface.md` 7.1 tells a host to look that reference up only when it is
not `0`, because `0` means the leg holds nothing yet. The reference was a slot
on the position book rather than an answer worked out from it: set when a
reference was minted, cleared when that one reference returned to zero, and
never pointed at another. So a leg holding two positions, whose newer one closed
while the older one was still held, reported holding none, and the bracket went
out carrying `0` while the strategy held ten units. The same slot read the other
way named a reference nothing ever opened: a reference minted for an order the
destination then refused stayed the answer for every bracket after it, so the
intent carried a number a host reconciling against its own positions cannot find
on the other side. Neither needed an unusual destination. One entry, one
opposing entry large enough to open a second position and an ordinary partial
fill reach the first. **The reference is now derived from the leg's own book**:
the newest position its fills have settled anything on, and the position it is
opening only where nothing has settled at all, which is the order `stdlib.md`
17.7 states the two in. Both pages now say which position is named where a leg
holds more than one.

**The arithmetic manifest now measures what it prints, and a check keeps it
that way.** `stdlib.md` section 20 is the page a second engine implements its
arithmetic from, and the way it goes wrong is always the same: a figure is
measured once, printed beside a refusal, and believed forever. Three sentences
there are corrected. `linreg` said its sums over `x` were "formed as written",
which covered a real refusal and a spelling that cannot be failed: splitting the
divisor of the sum of squares into the 2 and the 3 it is made of differs on 3716
of the whole lengths from 1 to 100000, first at 15, where it gives
1014.9999999999999 against 1015, while the grouping of the products cannot
differ at any length a window can have. `wma` said its divisor was "computed as
written" and nothing about how it is written changes its value. And 20.2.1 said
a carried total is not bit-identical to a fresh sum on any bar, which is false:
it agrees on 236 of the 19981 windows at length 20 over a walk of twenty
thousand bars, and what is true, that it differs on the other 19745 and drifts
further as the history grows, is now the sentence. **A new check,
`scripts/check-section-20.mjs`, requires every count the section prints to be
read back out of the page by a test that measures it again**, so a figure
quoted there and measured nowhere fails the build. It found the three counts the
exponential mean prints, which a test quoted in a comment and asserted nothing
about.

**A close now flattens the part it was told to flatten, on the side that reduces
it.** `close(tag)` took its direction from the leg's net rather than from the
part the tag names, so it could send an order that **added** to that part. A leg
holding ten long under one tag and four short under another is a net six long,
and closing the short part was answered with a sell of four: that part went to
eight short, the other tag's long was cut to six, and a call named `close` had
opened position. This is the shape a hedge is written in, and `stdlib.md` 17.2
says of the reading that takes the leg's net that it would let `close` open a
position. Three things follow it and are now held: what is already working
against a part is counted on the part's own side, so a second `close(tag)` holds
back the close already on its way instead of sending the part again; a part on
the side its leg is not on is closed by the whole of itself rather than by
whatever the leg has left, because closing it moves the leg away from zero; and
a part whose position has already returned to zero sends nothing rather than
opening it again.

**A position reference no longer reads as the side it is not on.** A reference's
side was read from what had settled on it plus what a reduction claimed of the
**leg** at the moment it was sent, and those two numbers can drift apart. A
second stated close claims nothing, because the first already spoke for the
whole leg, and it still fills and still reduces what has settled: the sum went
negative, the reference read short while it was long, and an entry opposing it
was handed it as an order that **adds**. Under a declaration counting in lots,
cash or an equity percent, `buy(qty = 10)` and then two closes of one and a
`sell(qty = 9)`, with every order answered in full and nothing rejected, left
reference 1 having opened ten long and settled one short. A reference is now
measured against the orders' own sizes, which fall as a fill arrives, so the two
halves of that sum cannot drift.

**Two more, both found by the properties rather than by reading, and both the
same sentence: a close is sent against the position it is closing.** A close
whose quantity the engine cannot count in units was handed the reference an
entry was opening on the other side, where the leg's own long was entirely
inside an order the destination still had. And a bracket minted a position
reference when the leg was flat, so a script whose first order call is `exit()`
or `order.bracket()` burned reference 1 on an instruction that appends no row
and moves nothing: the entry after it opened on reference 2, and the bracket
carried a reference no order ever shared, which a host reconciling intents
against positions cannot find on the other side. **A bracket now carries the
position it protects, and `0` where the leg holds none**, which is what a
cancellation has always carried; `host-interface.md` 7.1 says so for the party
that has to read it.

**`order.reverse` is unchanged, and now says why.** Its opening half mints a
position of its own without going through the division every other entry takes.
That is correct by construction rather than an omission: a reference minted
there has nothing on it, so the order cannot cross it. Dividing it instead is a
defect, because the orders of a call are all mapped before any of them appends a
row, so the opening half would be divided against the very position the closing
half is flattening. `tests/engine/parts.test.ts` pins the reference now as well
as the quantities.

**How much of this is checked rather than promised.** Two thousand generated
scripts, ten bars each, against a destination that answers late, partially, out
of order, with rejections, with more than was asked, with a frame repeated, with
a stale quantity restated after a later one, and not at all. The oracle is
folded from what the host sent and what it answered and reads nothing the engine
kept, because an oracle folded from the ledger agrees with the engine by
construction, which is how both of these defects passed 1414 tests. Every fix
was then mutated back one at a time and the suite run against each.

**An order now knows which position it belongs to.** An order picked its position
reference by comparing its own side against the leg's net, which is folded from
settled fills, so while an entry was unanswered the leg read flat and an order
opposing that entry was not seen as opposing anything: `buy(qty = 6)` on one bar
and `sell(qty = 9)` on the next, against a destination that had said nothing, put
both orders on position reference 1, which opened six long and settled three
short. That is one position holding both signs, which is the single failure the
position reference exists to prevent, because a fill arriving late can no longer
say which position it settled. The same script with the entry acknowledged first
was already correct, which is the whole shape of the defect: **what a bar sends
must not depend on how fast the destination answers**, and now it does not.

A position is measured by what is on it, settled and what is still working
together. A position with six units still to come is a position holding six, and
an order that opposes it takes those six off it before it opens anything, because
otherwise nothing can ever bring that position back to zero. Three more shapes
went with it. A close after such an entry held nothing back for it and sent the
position again, which is last round's runaway exit with an entry in place of the
close. An order agreeing with the leg's net was attached to whichever position was
current, which during a flip is the one carrying the other sign, so a buy of
twelve took a position from nine short to three long. And a close or an
`order.reverse` sized against the whole leg and attached the result to one
position, with nothing asking whether that position could absorb it: a leg holding
seventy two short across two positions was handed one order large enough to take
either of them through zero. Each of them is now one order per position it
reduces, oldest first.

**A close is held to every order already coming off the leg, not only the ones
that were reductions when they left.** An entry the destination has not answered,
on a leg the orders after it took the other way, is a reduction now whatever it
was then. Left out of the count, `close(qty = 12)` against a leg twelve short was
accepted as true when five of the twelve were already on their way.

**Pyramiding counts the entries the leg holds in a direction**, which is what the
declaration option has always said, and which used to be the same number as the
entries on one position reference. It is not any more: an entry placed while the
whole of a position is already in an order the destination still has opens a
position of its own, because the one it would join is about to reach zero and
end. And whether an order is an entry at all is now read from the order rather
than from the leg's net, which calls every order an entry while the leg reads
flat.

**In lots, cash and an equity percent, an opposing entry is still one order, and
two things about it are now held.** It carries a position reference of its own
whether or not anything has settled, which is the defect above wearing another
unit and was not held before. And the position it leaves behind is named again: a
close works its own quantity out in units, so it is divided across the positions
holding the leg's side and reaches that one in turn, and it returns to zero as
soon as the leg's net comes back to its side. What still waits on the instrument's
lot size is the instruction itself closing it, and a leg whose net never returns
to that side carries the position for the rest of the run. OS7005's deferral says
so, and `tests/engine/ending.test.ts` asserts both halves rather than describing
them.

**What no engine answers for, recorded rather than left to be found.** A position
settles on the side it did not open on only when an order on it was never answered
in full: one still going, or one that ended rejected, cancelled or expired with
part of its quantity unfilled. An order divided against an unanswered order is
placed against units that were promised and may not arrive, and the alternative is
holding an order back until the destination answers, which is an engine that stops
trading when a destination is slow. Over six thousand generated runs against a
destination that answers late, out of order, partially, with a rejection and not
at all, every position all of whose orders were answered in full ended on the side
it opened on.

**A setting a reader stores now reaches the declaration option it was written
into.** `docs/inputs.md` teaches `study("S", precision = input(2, "Places"))` as
how a reader gets to change something the declaration decides. Through this
package's own chart adapter it did not: `descriptorFor` took no settings at all,
so `plots[0].priceFormat.precision` was 2 whatever the host had stored, and 5
when the script wrote `input(5, ...)`, which is the default and not the setting.
The engine loaded with the same stored value resolved it correctly, so the chart
formatted a pane at one precision while the column beside it was computed at
another. `ChartAdapterOptions` gains **`settings`**, and every declaration field
written as an `input()` now resolves against it: the study's name and category,
its placement, and every plot, band and alert field. A host that keeps one
descriptor per study instance passes that instance's stored settings and builds
again when a user changes one; the parts that follow a later change with no
rebuild are the calls, `levels`, `range`, the painting hooks and the calculation,
and which is which is recorded in `spec/chart-narrowings.json` and measured by
`scripts/check-chart-surface.mjs` rather than promised. One declaration option
still cannot be tuned and now says so: a plot's `style` is a plain string in the
compiled format, so an `input()` written there is folded to its default with no
diagnostic anywhere. That is issue 0018, and closing it is a format change.

**And a stored setting the engine will refuse no longer reaches the chart.** The
change above brought its own defect, in the half of it nothing had asked about:
the declared shape is built before anything is calculated, so a settings map of
`{ Places: 99 }` against `input(2, "Places", min = 0, max = 8)` put a precision
of 99 into `plots[0].priceFormat`, and `{ Places: -4 }` put -4 there. The run
refuses that map with OS6019 and nothing is drawn, but the descriptor a host was
handed first carries a number the input forbids, and a host may show it in a
legend or on a price scale before it asks for a bar. The adapter also kept a
second idea of an unusable value beside the engine's: a stored `null` or object
read as the declared default while the engine refused the same map, and a stored
`"7"` read as neither, landing on the chart's own fallback of 4.

Both are one question with one answer now, and it is the engine's own:
`checkSetting` is the function the load refuses with, and the adapter asks it
before a load exists. A stored value it will not take reads as the **declared
default** in the declared shape, and travels to the engine exactly as the host
stored it, so the run still stops with OS6019 naming the key and the bound.
Neither half is a fallback: the value is not repaired, and the shape is not
withheld, because the settings dialog a reader corrects the value in is built
from it. The incremental path compares what the engine is handed rather than what
the shape shows, because every refused value shows the same default and a
signature taken from the shape would keep a held engine across a change from a
setting that runs to one that cannot. `scripts/check-chart-surface.mjs` moves a
plot width outside its declared bounds, as text and as `null`, and reads both the
shape and the run on each.

**An input written in place whose title is empty now has a code that is true of
it: OS3024.** `input(14, "")` raised OS3021, whose message says the input "has no
title written as a string literal" and whose fix says to give it one. The reader
had. It was empty, and the sentence told them to make the edit they had already
made. OS3021 keeps the two programs it describes, an input with no title argument
and one whose title is not a literal; the empty title is OS3024, whose fix is to
give the title something to say. Beside it, a decision that had been made by
nobody is now written down: **an input assigned to a name and given an empty
title is labelled by the name**, exactly as one given no title is, because a
named input has its key already and what an empty title costs there is only a
label. `language.md` 13.4 states it, and a test pins it.

**`spec/errors.md` and `spec/errors.json` are now compared in full.** The page is
named the authority a reader is sent to, and the file is what the compiler is
generated from, and until now only the test pointer and the two example blocks
were held to each other: changing one word of a message on the page passed the
whole build, showing a reader one sentence and the user of the compiler a
different one. Every heading, first line, message, placeholder gloss, cause, fix,
deferral and unexercised sentence is now compared character for character, along
with the two tables outside part 8 that are copies of the file as well. Both of
those had already drifted: the ranges table said the argument block held 20
entries and the catalogue held 147, against 23 and 150, and the refinements table
was missing an entry added in the last release.

**The error code check reads the whole tree, not only its Markdown.** Its own
docstring said "nothing else in the repository gets to invent one" while it
walked `.md` files, and source comments cite codes heavily: changing one in a
comment to a code the catalogue does not define passed the whole build. It now
reads every file the project holds, source and tests and tooling alike, and
prints the count it read. A number outside every thousand block the catalogue
declares is not a code and is counted rather than refused, which is what lets
four checks go on attacking their own rules with a fabricated entry; those
citations and the files holding them are printed on every run.

**Three sentences in `stdlib.md` section 20 fixed nothing and have been
replaced.** Section 20 is the manifest a second engine implements from, so a
sentence there that cannot be violated costs an implementer the time the section
exists to save. `rsi` said that naming the ratio first and writing
`100 - (100 / (1 + ratio))` was "the same expression with an extra rounding in
it": there is no extra rounding, and the two spellings are bit identical on every
value at all three gate lengths. `alma` fixed the grouping of `2 * spread *
spread`, which cannot differ because one factor is a power of two; the
arrangement that does differ is the chain of divisions, and that is what it names
now. `bollinger` said a span was "formed once". 20.1 gains the general rule so
the next one is caught by reading, and two measured figures that were overstated
as "most" are now the numbers: `fade`'s refused arrangement differs at 40 of the
101 whole percentages, and `math.toDegrees`'s at 26 in every hundred.

**A fourth one, and the rule that covers all four.** `swma` said "the two middle
terms are formed as `2 * value`, and the four terms are added left to right":
one sentence, one half of which can be failed and one of which cannot, with
nothing to tell a reader which. Writing `value * 2` or `value + value` instead is
bit identical on every finite value, measured over 25176 values covering every
binade of the double range in both signs, the subnormals included. Writing the
four additions in a different grouping is not: over twenty thousand four bar
windows of ordinary prices, pairing them differs on 5281, adding right to left on
7230, and dividing each term by 6 as it is added on 9564. The entry now states
both, with the figures.

Four sentences of one shape in three rounds is a pattern rather than three
coincidences, so 20.1 now states the general rule rather than another list of
instances: **an arrangement is where one rounding falls relative to another**.
Only an operation that rounds can be part of one, and two operations that do not
read each other have no order between them. The three things that fixed nothing
become four, gaining the exact respelling of a step that does not round (`2 * v`,
`v * 2`, `v + v`; `v / 2`, `v * 0.5`) and the order of accumulations that do not
read each other, and the section now states the test a sentence has to pass to go
in it: name the second arrangement it refuses and count where the two differ. The
whole of section 20 was swept against that test, which found two more: `linreg`
and `covariance` fixed the pass structure of accumulations that never read each
other, `covariance`'s down to the order the three are written in. Both now fix
what is real, which is that each total runs oldest first. `tests/stdlib` reads
every figure above out of the page and measures it again, so rewording a claim or
moving a figure fails a test instead of going on being quoted.

**CLAUDE.md rule 5 now says what its check covers.** "Name nobody. No outside
product, platform, company, trademark, market index or real instrument,
anywhere" is enforced by a fixed list of eighteen products and thirteen indices.
A name on the list is caught in any file and a name that is not on it passes,
which is the only mechanizable form of the rule; the rule was written as though
the check covered all of it. It now says which half is mechanical and which is
attention, and `scripts/check-names.mjs` says the same in its passing line,
because a green build read as proof of something wider is the way this one fails.

**A close still working at the destination is no longer sent again on the next
bar.** A position moves when a fill settles and from nothing else, so an order a
strategy has sent and not had answered has moved no position figure: the leg
still reads what it held before it left. The previous release held the orders of
one bar against that, and one bar out the defect was still there. Measured, with
the entry acknowledged and the closes not acknowledged, on the plainest exit a
strategy can write:

```
strategy("P", qty = 3)
if bar.index == 0
    buy(qty = 3)
if bar.index > 0 and pos.size > 0
    close()
```

six bars sent one close per bar and netted **twelve short** under one position
reference, ten bars netted twenty four, and it grew with the run. With the closes
filling one of three at a time it sent 3, then 3, then 3 and ended three short.
Nothing was reported, on a leg that opened long three, and a destination slower
than the chart is the whole of what it takes. The script was not wrong: `pos.size`
is folded from settled fills and correctly still read three.

**What is available to reduce is now the settled position less everything already
working against it**, over the run rather than over the bar, which subsumes the
bar rule rather than sitting beside it. What is working is read from the ledger:
an order that has not ended and has not fully filled, counted by the part of it
that has not filled. A partial fill releases what settled, so three sold with one
filled leaves two working and the next close sends two. A rejection, a
cancellation or an expiry releases the rest, and the script may close again.
`cancel()` is the way out of a destination that never answers, and it now works
end to end. An unsettled entry adds nothing to what a close may reduce, because
nothing has settled. `close(qty = ...)` against a leg whose close is already
going is **OS7017** naming nothing left, where before it sent the position a
second time.

**A crossing entry carries a position reference of its own in every `qtyType`.**
Under `"lots"`, `"cash"` and `"equityPercent"`, `buy(qty = 3)` then `sell(qty = 9)`
sent one order on the outgoing position's reference: at a lot size of twenty five
the destination saw reference 1 go from seventy five units to minus one hundred
and fifty, which is the crossing the split exists to prevent. Dividing the
quantity into a closing half and an opening half needs the instrument's lot size
and still waits on it, but **minting a reference needs no arithmetic**, so it is
done in all four. What still waits is written where a reader meets it, in
`stdlib.md` 17.1 and in OS7005's deferral: the outgoing position is not closed by
an order of its own.

**`pos.avgPrice` is now averaged over the positions on the side the leg holds.**
A leg holds more than one position whenever an opposing order is outstanding.
Summed across both, the cost of a position on its way out was subtracted from the
cost of the one on its way in: three hundred bought at one hundred beside two
hundred and twenty five sold at one hundred and ten reported an entry at
**seventy**, and every level measured from the entry would have been measured
from that. It also corrects the same blend during a flip, where a leg long three
at one hundred with a new short five at one hundred and ten reported one hundred
and twenty five.

**An order that names a `leg` is now refused: OS3023.** `stdlib.md` promised that
a leg outside the declared names was refused, and nothing raised it:
`buy(qty = 3, leg = "nosuchleg")` placed the order on the only leg with no
diagnostic, and a computed name was ignored too. The sharp case is
`buy(qty = 3, leg = "a")` followed by `close(leg = "b")`, which flattened the
position: a script that named one leg and closed another traded the leg it did
not name and was told nothing. Leg declarations are planned, so no file can
declare one, so there is no name the argument could carry; it is refused whatever
it holds and whether the name was written or computed, and the fix is to take the
argument out. It is a code of its own rather than OS3008 because OS3008's fix
sentence is "use one of these values" and here there are none, and a fix a reader
cannot act on is worse than no fix.

**Two sentences of `stdlib.md` 17.1 corrected.** One claimed the engine held
every order it can read in units to "no order crosses zero" bar one named
exception; the across-bars case above was entirely in units and was not that
exception, so the engine was made true and the sentence now says what is. The
other, "a bar declared `onUnconfirmed` is one bar however many times it is
executed", is true of the reducing count and read as a general rule about the
bar: on such a bar executed four times a close sends one order and `buy(qty = 3)`
sends four, which is `language.md` 7.5 working as designed. The sentence now
carries its scope, and both halves are asserted in tests.

**A settings value now stays on the row it was stored for.** An `input()` may be
written anywhere a value belongs, and one written in a declaration option or
inside a larger expression is bound to no name, so it was keyed by its position:
`input0`, `input1`, `input2`. `host-interface.md` 8.1 promises a key that
"survives every edit that does not rename it" and a positional key survives no
edit at all. Measured end to end, on a file with three tunables in it, inserting
one in the middle and renaming nothing moved the keys down and put the value a
user had stored for Width onto Smoothing, silently, because 8.3 validates a
number against a number and both are numbers. A delete and a reorder did the
same. **An input written where a value belongs is now keyed by its title**, which
is what the user sees on the row and what changing is the rename 8.1 excepts; an
input bound to a name is keyed by the name as before, and `var len = input(...)`
is the named form, so adding or removing the word does not move a stored value.
Uniqueness is held by refusing rather than by a suffix, because a suffix is a
position again: an input with neither a name nor a title written as a string
literal is **OS3021**, a title spelling another input's name is **OS3022**, and
two inputs carrying one title were already OS3017. This changes the stored key of
every input written in place, and there were none to change: across the gate
studies, the gate scripts and `examples/`, 0 of 241 inputs carried a generated
key, because until the previous entry below closed, such an input did not compile
at all.

**An `input()` may be written inside a read's expression.** `req.timeframe("1D",
high + input(1, "K"))` produced exactly one diagnostic, OS6018, whose message
tells the reader that if nothing else was reported their correct script came from
a broken compiler. Nothing forbade the script: `language.md` 13.4 forbids an
input in a block and in a function, a read's expression argument is neither, and
`stdlib.md` 15.4 already permitted a **name** bound to an input there, for a
reason that is about the setting rather than about the name. The compiled format
already carried the mechanism as well, in the `inputs` list a read's body has had
since `compiled-program.md` 2.16: the engine resolves the key in the enclosing
program before the body runs and fills a register of the body's own table. The
call now resolves through the same scope the name does, and two reads of one
setting inside one body share one register. A `var` holding a setting is still
OS6003 there, because a later assignment may change it.

**`var len = input(14, "Length")` no longer compiles to a dead settings row.** It
was accepted with no diagnostic and read absent on every bar: the name was given
one slot, the input another, and nothing joined them, so a user got a row in the
dialog they could move that changed nothing. It is now an ordinary `var` whose
initial value is the setting, which is how a running total starts from one. A
setting cannot change mid-run, so a `var` nothing assigns to holds exactly what
the plain form holds; what the word buys is the assignment. The name is not the
setting, though: a `var` is a cell a later assignment may change, so it is
OS3003 in a declaration option and OS6003 inside a read's expression, like any
other per-bar name.

**A hole in the compiler's own copy of verification check 5.** The check is three
sentences, and only two were walked: the depth agrees on every path, and it never
goes below zero. The third, that it is zero at the terminator, is not a
restatement of the second, because a `RET` reaches nothing after it: a body one
value short is at minus one exactly at the `RET`, where the walk asked nothing,
and the walk finished clean. That is how a read's expression with an `input()` in
it came to be emitted as a body no conforming engine will load, found by an
engine rather than by the compiler that wrote it. Every `RET` and every `HALT` is
now checked, rather than the last instruction, because an early `return` is a
terminator too.


**Every worked example in the error catalogue is now compiled, and every
pointer in it resolves.** The catalogue carries a before and an after block per
entry. The after block is the fix a reader is handed at the moment they are
stuck, and they paste it; nothing had ever put one through a compiler. That is
how OS7009's fix came to call a function the language does not have, be cited in
five documents and sit there being read. Four more did not compile: OS7012's
names a planned call, OS1023's puts a `plot` inside an `if`, and OS1022's and
OS3003's were both refused by the emitter, which was a defect in the emitter and
is fixed below. OS3003's example is back to the input form its own fix sentence
names. OS1022's stays as deleting the trailing operator, on its own merits: the
statement was already complete before the stray operator, and supplying an
operand instead invents a number the reader never wrote. Five compiled and warned, which is the compiler complaining about
the reader for doing what it had just told them to do. Every after block now
compiles with no diagnostic, bar the two warnings that say a fragment stopped
rather than that it is wrong.

The before blocks were held to the code they are filed under, by compiling them
and, for a runtime code, by loading the program on a host and running it over a
fixed dataset on two venues. Seven were about a different code than the one they
were printed under. OS3001, wrong number of arguments, showed a call with one
argument missing, which is OS3012. OS3004, a literal that is not a whole number,
showed a computed value, which is OS4003 on a bar. OS4003 showed an array index,
which `compiled-program.md` assigns to OS4004. OS4002, a read past the retained
depth, declared no depth to pass. OS7010, a bracket on the wrong side of the
entry, read the entry price on the bar the entry was placed, where it is absent,
so the refusal a reader would have met is OS7002. Each of those is now the
example its own code is about. Four codes are ceilings an example cannot reach,
a million array elements among them, and each of those entries now carries an
`unexercised` sentence saying so, which expires by itself the day one is proved.
Eight entries whose example is the host's input rather than a script say that in
an example `kind`, and are held to it: a block declared not to be source that
compiles fails the build.

Every entry also used to carry `"test": "tests/errors/<CODE>"`, and that
directory has never existed in any commit. A hundred and forty-five pointers,
every one dead, printed as "Test `tests/errors/OS7009`" beside a rule promising
that every entry has a test. They now name a file under `tests/` that writes the
code, or `null`. Twenty-four codes carry the null, seventeen of them deferred and
seven taught as current behaviour and exercised by nothing, which is printed on
every run and recorded as an issue rather than papered over with a row somebody
invented. `spec/errors.md` part 8 is compared with `errors.json` character for
character for the pointer and both example blocks, because it is a copy and this
pair had drifted for every entry at once.

Two checks, `scripts/check-examples-compile.mjs` and
`scripts/check-catalogue-tests.mjs`, enforce all of it, and both say what they
cannot reach and count it: eleven host codes are the host's own answer and this
harness drives one host, so they are compiled, run, and listed by name as not
proved on every run.

**The order layer now refuses what the specification says it refuses.** Eight
codes of the orders range were written into the catalogue, taught across five
documents in the present tense, credited by a shipped example with protecting it,
and raised by nothing: an order call became an intent and was held against no
rule at all. Measured on a host built from the page, an absent quantity was
replaced with the declaration's size and filled, two opposite orders on one bar
both filled while the position read zero for the whole run, a pyramiding limit of
one let three entries through, and a typed order with no price for that type went
out unrefused. OS7002, OS7004, OS7006, OS7007, OS7008, OS7009, OS7010 and OS7013
are now raised at the call that wrote them, and each of them refuses before
anything is handed over: every order call on a bar is mapped before any of them
is routed, so a refused order reaches no destination rather than being sent and
then reported. OS7005, OS7011, OS7012, OS7014 and OS7015 stay deferred in the
catalogue, each with the sentence saying what has to exist before it is raised.
An argument the script left out and an argument it wrote that came out absent are
no longer one thing. They used to be: two of an order call's defaults are absence
itself, the compiler substituted them, and `buy()` and `buy(qty = none)` compiled
to byte identical programs, so OS7002 had nothing to fire on. The catalogue's own
worked example for that refusal, `buy(qty = 1, stop = lowest(low, 20))`, placed a
market order on every bar of the twenty bar window and then stop orders: a stop
entry silently became a market entry on every warmup bar. An order call now
carries the names of the arguments the script wrote, so `buy()` still takes the
declaration's size and `buy()` with neither price is still a market order, while
every order argument written as a value that came out absent, a quantity, a
limit, a stop, a trigger, a type, a tag, a bracket's target or its distance, is
OS7002 naming that argument and reaches no destination. The example that credited OS7013 with a
protection now says what that refusal covers and what the shape of the script
covers.

**A `close` that could never close anything is now refused, and the repository
now says one thing about what a tag argument means.** `close(tag = "entryy")`,
a tag no order in the file is placed with, sent nothing and said nothing: the
position stayed open and the script believed it had flattened. It is now OS7016,
reported at the call before any bar runs. The checker rather than the engine,
because the engine cannot tell that mistake from an ordinary bar: a tag that has
never named a ledger row is also what a working script looks like before its
entry has fired, and refusing that would stop a strategy whose exit signal simply
came first, with no guard available to write, since every call that reads the
ledger is planned. A file, unlike a run, is complete. What is not refused, and is
covered by a test of its own so that it stays that way, is a close on a tag that
holds nothing right now: closing the same tag twice sends one order and says
nothing about the second call.

Underneath it is a rule that was always in the signatures and had never been
written down: **a tag that defaults to the empty string is a label the call
carries to the destination, and a tag that is required or defaults to absence is
a reference to something that has to exist.** The catalogue disagreed with it.
OS7009's worked example was a bracket whose tag named no order, presented as a
refusal, while the engine sends that bracket without a word, as it should: a
bracket sets the leg's own level and its tag rides along as a label. The example
is now a cancellation, which does raise the code. OS7009's fix was worse than
wrong: it told the reader to test `order.working(tag)`, which is marked planned,
so the fix the catalogue handed a reader was itself a refusal. Both halves now
say something that compiles today.

**A strategy's position is folded from what it traded, and a host is no longer
asked for one.** The five position facts answered from a position row on the
engine's host type, which no specification document describes and which a host
built from the page does not supply. On such a host every one of them read
absent, so a guard written `flat = pos.size == 0` was absent rather than true,
the branch was not taken, and a strategy shipped in `examples/` placed no orders,
raised no diagnostic and drew its plots as though it were working. The run now
keeps the ledger those facts were always documented to come from: an order call
becomes the order intents the host interface specifies, each intent appends a
row, and the cumulative frames a host reports fold into those rows exactly as the
library page's fold says, including the repeated frame that must cost nothing and
the fill that arrives after a cancellation and must not be thrown away. What a
script reads is what that strategy traded, which is the point: an account
position row is shared with every other strategy and every manual trade in the
same contract, so a size computed against one is computed against somebody
else's. The position option on the chart adapter is gone with it.

**A host can now deliver an order frame.** Sending cumulative frames has been a
conformance duty since the host interface page was written, the frame was
specified in ten fields, and no engine exposed anywhere to put one: an
implementer working through the list searched for an interface that was not
there. An engine that takes orders now takes a frame at any moment between bars,
folds what arrived at the bar boundary so that every position fact is constant
for the length of one execution, and reports on that bar what each frame did,
a refused one included.

**A series the engine cannot run on is now refused instead of computed on.** Two
codes the host interface page requires, OS6010 for no bars at all and OS6011 for
a bar whose time does not follow the one before it, were in the catalogue and in
the conformance list and were raised by nothing. A host handing over an empty
dataset, a swapped pair or the same timestamp twice was accepted in silence and
the study computed on it, which is the worst failure this project has: not a
crash, a wrong number nobody is told about, entering at the boundary so that
every value downstream is confidently derived from bars that were never valid.
Both are now raised, at the hand-over, on the whole-dataset path and the bar at a
time path alike, and a refused series stops the run. The cost is one comparison
per bar handed over: about half a millisecond over fifty thousand bars, against a
full compute of the same history that the benchmark records at a hundred and
eighty five milliseconds, and it is paid where the bars arrive rather than on
every execution of them.

**A read the host refused now reports its reason when it is written inline.**
`req.error(read)` and `req.isReady(read)` answered about a read assigned to a
name and answered nothing at all about the same read written out inside the call:
the compiler resolved it to a handle and emitted no request under it, so the host
was never asked and the script was told nothing was wrong. A study that draws
nothing while its own diagnostics say nothing is wrong is the worst version of a
silent failure, because the user has already looked and been sent to look
elsewhere. A read written inline is now a read like any other: it is emitted, the
host is asked about it, and its refusal reaches the script. Two reads written in
one file are two requests and count as two against a host's ceiling, which
`spec/host-interface.md` section 5.2 now states.

**A request now carries what the host interface page says it carries.** A host
built from `spec/host-interface.md` section 5.2 alone could not implement duty 3:
the table printed six fields, three of which never arrived, and the request
carried three more the table did not print. The request is now `id`, `read`,
`instrument`, `exchange`, `timeframe`, `mode` and `warmup`, on the page and in
the engine. `symbol` is `instrument`, which is what the page calls it and what
section 9 says it is; `read`, `mode` and `warmup` are documented, because the
engine sends them and they are each worth having; and `from` and `to` are gone
from the page, because the whole set of requests is settled before bar 0 and at
that moment the engine holds no bars and has no span to state. The page now gives
the arithmetic instead: the chart's own span, extended backwards by `warmup`
requested bars, worked out by the host, which is the side that has the bars.

**A read of another instrument is now told which exchange to resolve it on.**
`req.symbol`'s `exchange` defaults to `chart.exchange` in `stdlib.md` 15.1, the
compiled format spells the omission as an absence meaning the chart's own, and
the engine passed the absence straight through. A host was therefore left to
resolve an instrument on no venue at all wherever a script did not name one,
which is a different contract wherever a ticker is listed twice. The engine now
resolves it, along with the identity of a read of the chart's own instrument,
so every request carries an identity and a venue rather than a rule to apply.

**An instrument record that contradicts itself is now refused at load.** A host
that stated a `session` and no `timezone`, a session spelled `"9:00"` rather than
`"09:00"`, or days numbered from Sunday as zero, lost `vwap` and every session
study on every bar with nothing reported anywhere, because that is exactly what
an instrument with no schedule looks like. Each of the three is OS6012 at load
naming what is missing, and so is a timezone no calendar can read. A host that
states no session at all is unchanged and still conforming: the per-bar session
facts are absent and a script tests for them.

**An alert's message now carries the bar that fired it.** A study that computed
`"crossed up at " + text(close, 2)` sent a notification reading "Crossed up", the
declared title, on every alert this adapter has ever raised. The message is a
string per bar, so it cannot travel in the table of numbers a calculation
returns, and it was left out on the ground that nothing carried it across. The
chart's own entry takes a function of the same context its condition was judged
on, and that context carries the settings object, which is how every other hook
here finds the run it is reading. So the message is read from the run at the bar
that fired, and an alert whose message was absent on that bar still falls back to
the title, which is what a chart does for an entry that states no message at all.

**A `draw` setter now takes only the objects it can move.** Eleven of the
fourteen setters declared their object argument as "whatever you give me",
because the real type is a set of kinds and there was no way to write one. So
`draw.setFrom(aLabel, t, p)` compiled, wrote an anchor a label has no field for,
drew nothing and reported nothing, and `draw.setColor(5, red)` compiled as
readily. Each setter now names the kinds that carry the property it writes, which
is the kinds whose creation call takes that argument, and a call that misses is
OS3011 at that argument with the kinds it does take in the sentence. A
declaration handle in the same place keeps OS3019. Two documentation tables
promised more than any kind carries, `setStyle` on a box and `setTooltip` on a
line, and they now say what is drawn.

**A second declared grid is still dropped, and the drop is now written down and
checked.** A chart pane has one grid and the language declares as many as it
likes, so a study with two panels draws one, and nothing said so anywhere. The
refusal that belongs there cannot be written: it needs a catalogue code for a
host that cannot draw something a study declares, the catalogue has none, and
this project reports the gap rather than inventing one. It is reported in
`issues/0011`, with the sentence the entry should carry, and the documentation
for tables now tells a reader that the first declared grid is the one drawn.

Meanwhile the class is checked instead of promised. `spec/chart-narrowings.json`
records every field and every count the chart adapter does not carry, each with
its reason, and `scripts/check-chart-surface.mjs` compiles a study that declares
two of everything, builds a descriptor from it, and fails the build on a declared
field the record does not mention, a record entry the compiled format no longer
has, a narrowing recorded with no reason, and any declaration dropped whose limit
is not recorded. It also reads the mapping back out of a run, so a field recorded
as carried cannot be a claim. The record began with eight narrowings, one of them
found by writing it: a band whose colour is computed per bar has no per-bar colour
in a chart's band and is drawn in the first plot's colour.

**Every documented default now reaches the call.** `atr()`, `rsi(close)`,
`bollinger(close)`, `macd(close)`, `stoch()`, `psar()`, `supertrend()`, `adx()`,
`keltner()`, `donchian()`, `cci()`, `williamsR()` and the rest: twenty-nine calls
out of thirty-one, written exactly as the library reference prints them,
compiled with nothing reported, loaded with nothing reported, ran to the last bar
and drew no value on any bar. The reference gives each of those arguments a
default, the surface recorded only that the argument was optional, and an
argument left out reached the engine as absence, where a lookback of an absent
length answers absence for ever. Only the calls whose length was written out drew
anything.

The hundred and sixty missing defaults are now written into the surface, taken
from the reference, and an omitted argument is filled with the value the
reference prints. `vwap()` reads `hlc3`, a calendar call reads the chart's
timezone, and a grid cell written with no alignment is aligned left, each exactly
as writing the argument out would have done. A warmup follows its default too: an
omitted length used to weaken a study's warmup to a floor, so `atr()` promised
"no earlier than" where `atr(14)` promises bar 13. Both now promise bar 13.

A check refuses the class rather than the instance. An optional parameter must
either carry the default the specification states, spelled as the specification
spells it, or be recorded in `spec/default-exceptions.json` with what the
specification says in place of a value and why that is not one. Neither is a
defect and both is a contradiction, and a default the surface invented or one
that has drifted from the specification fails the build as well. Seventeen
parameters are recorded: the leg an order acts on and the size the `strategy()`
declaration sets, which the library has no value for, and one row that states no
mode where the two beside it do.

**The library the reference page promises now runs.** Ninety-five names compiled
and were then refused at load with an error that named a function and gave no
reason. Every one of them is settled: it either runs or says it is planned at the
call, where you can see what you wrote.

Sixty-three names that could not run now do. The moving averages `dema`, `tema`,
`vwma`, `swma`, `alma`, `linreg` and `ma`; the trend frames `psar`, `adx`,
`aroon` and `ichimoku`; the oscillators `stoch`, `stochRsi`, `ppo`, `cci`,
`williamsR`, `tsi`, `trix`, `cmo`, `dpo`, `ultimateOsc` and `awesomeOsc`;
`keltner`, `chop` and `hv`; the whole of the volume section, `vwap` and
`vwapAnchor` among it; `percentRank`, `correlation` and `covariance`; every
calendar call in `date`, and `session.isIn` with them; and the six instrument
facts `chart.timezone`, `chart.pointValue`, `chart.currency`,
`chart.instrumentType`, `chart.hasVolume` and `chart.hasOpenInterest`.

The arithmetic for the studies was already written and gated against reference
vectors; what was missing was a form an engine could drive a bar at a time, so
each one is now a step over a state region like the rest of the library, and its
whole-series form is that step folded. There is still one implementation of every
formula, and the engine holds none of it.

The calendar is new. It reads an instant in a named zone using the runtime's own
timezone database rather than a table copied into this package, because a copied
table goes stale silently in exactly the way a fixed offset does. Two readings
that have no single instant are settled in the specification rather than left to
an engine: an hour a spring change removed resolves to where it would have been,
and an hour an autumn change repeated resolves to the first of the two.
`date.weekOfYear` is the ISO week, which the specification now states.

Fifty-nine names are now marked planned instead of failing at load. The strategy
surface, everything in `order`, `leg` and `book` that is folded from a ledger, and
the position facts beyond the five an engine reads from the account's own row: no
engine holds a ledger in this release. So are the four session facts read off the
instrument's trading hours, which the engine's host record does not yet carry.
Nothing was removed from the specification; a marked name is refused where it is
written, with a message saying it is planned.

A test now fails the build if a name the checker accepts can neither run nor says
it is planned, so this cannot come back quietly.

**Three diagnostics now say what is true.** Calling or reading a name the library
lists as planned reports OS2020, whose message says the name is planned. It used to
report OS2001, which told a reader the name was not defined at this point in the
file and offered them a different function as the fix. OS2004 no longer tells a
reader to assign the value to a name at the top level in the case where it already
is one: a declaration handle, a runtime object and a library fact that is not a
series have no history whatever they are named, and the fix now says so. OS6016 no
longer describes a program below the engine's format as though it were above it,
and says that the major number decides in either direction.

**The integration guide described a surface the engine does not have.** The page on
running the engine told an integrator to hand over columnar arrays, one per field.
The engine takes one object per bar, so code written from that page did not compile
against the library. The page now describes the surface as it is, and the memory
case it was making, which is real and unanswered, is measured in `issues/0005`.

**Higher timeframe and other instrument reads run.** A file containing one used
to compile, carry its capability tag, and be refused at load with a message
naming the capability. The engine now evaluates a read's expression over the
requested bars and folds the result onto the chart's, so `req.timeframe`,
`req.symbol`, `req.isReady` and `req.error` do what the reference page says.

A read of the chart's own instrument at a coarser interval is folded from the
bars the engine already holds and needs nothing from a host. A read of another
instrument needs bars only a host can supply, so a host states a request provider
and an engine without one still refuses exactly those files, by name, at load:
that path is what an older engine uses to tell a newer file what it lacks, and it
is kept and tested.

**The three modes produce three different numbers, and the difference is the
whole repainting question.** A `"confirmed"` read takes the last coarse bar that
closed and steps on the first chart bar of the next one, so it never uses a bar
that had not happened. A `"developing"` read is the coarse bar as it stands on
this chart bar. A `"lookahead"` read is the coarse bar in full, from its first
chart bar, which is why it repaints. The first two stop at the bar being executed,
so a chart given a whole dataset and a chart given one bar at a time compute the
same numbers; the third reads past the bar, which is the mode.

**Read the default twice if you have written `[1]` inside a read.**
`req.timeframe("1D", high)` is yesterday's high, because `"confirmed"` is the
default and it takes the last day that closed. `req.timeframe("1D", high[1])` is
the day before that. Three documentation pages had those one day apart and said
so in words; they now say what the specification has said all along, and the
previous-session example no longer takes the extra step back.

A read's warmup is counted in requested bars rather than chart bars, because the
expression runs on the requested ones: `req.timeframe("1D", sma(close, 20))` is
absent until twenty daily bars have closed, which on an intraday chart is about a
month of history. A day, a week and a month are folded by the calendar, so a read
at one of them needs the instrument's timezone and is absent without it rather
than dated in a zone nobody chose.

A request that cannot be folded is refused at load with the code that names it,
OS6002 for one finer than the chart and OS6015 for one that is not a whole
multiple of it, and a timeframe a setting supplied that is not a timeframe is
OS6001. A refusal from the host is not: an unknown instrument, a range with no
bars, a source that would not answer and an interval the feed does not carry
leave the read absent, put the host's own words in `req.error(read)`, and let the
rest of the study keep drawing. A host's ceiling on how many reads a file may make
is OS5006 at load, with the count named rather than reads dropped quietly.

The compiled format gains no field. What it gained is section 2.16.2, the fold
itself: which requested bar each chart bar may see, written out so that a second
engine computes the same number rather than inventing its own alignment.

**A read's expression is verified like the program it sits in.** The same
interpreter walks it over another instrument's history, so its tables, its
instruction list and the lists of the functions it calls all go through check 1
and check 8. A body that was not verified could jump out of its own instruction
list, and the failure would have looked like a wrong number.

**Every output a study can produce now reaches a chart.** Markers, bar colouring,
the pane background, summary grids, watched conditions, drawing objects and reads
of another instrument were all fields the compiled program carried and the chart
adapter left empty, so a study that called `signal`, `barColor`, `background`,
`cell`, `alert`, `draw.line` or `req.symbol` computed everything and drew none of
it. Each of them is mapped onto the field the chart already has for it, under the
chart's own name for that field and taking the chart's own argument.

A marker arrives with its text, its declared shape and position and the bar's own
time, and only for the bars its branch was taken on. A bar colour and a background
arrive as columns of colours beside the plot columns, so a spliced tail carries
them. A grid arrives as the last executed bar left it, read once per calculation
rather than once per bar, which is the difference between a constant cost and the
length of the history, and its cells are placed into the declared size so that a
cell nothing wrote is blank rather than missing. A watched condition arrives as a
row a user can subscribe to, under the `id` the script gave it, whose predicate
reads the guard chain out of a column.

**A study's drawing objects are handed to the chart as a set, and the set is
replaced every time.** A line, a label, a box or a path the script created, moved,
recoloured and deleted over many bars arrives as the shapes it currently holds,
in the order it created them. Nothing has to tell the chart about a deletion, and
a bar that re-executed five times leaves what one execution of it leaves, because
the engine has already rolled the set back. An anchor crosses as a time and a
price, converted into the seconds a chart counts exactly where a bar's time is,
and an anchor past the newest bar stays where it was written so a projection
reaches into the margin. An anchor missing its time or its price draws nothing,
and a path with a hole in it becomes one shape per stretch that has none, rather
than a line through prices the script never named.

**A read of another instrument fetches through the chart, and the study draws
while it waits.** The engine settles every read before bar 0 and asks the host
there and then; a chart answers later, and a chart computes a study once before
it attaches the lifecycle that has the transport. So the first calculation says
"not yet", the read is absent, `req.isReady` is false and everything that does not
depend on the read is drawn; the answer asks for the recompute that uses it. The
range asked for covers the chart's own span, extended back by the read's warmup
and quantised to requested bar boundaries, so a chart that ticks does not fetch
once per bar, and what was fetched keeps serving while a wider fetch is in flight.
A host that refuses is carried through as its own words, in `req.error` for the
script and in the study's data status for the user, with a retry offered.

**An alert fires for now and never for history.** Adding a study to a chart
holding two years of bars fires nothing for any of them. The rule is in the
specification rather than in a host: an alert is raised only on a bar the host
states it is driving live and has confirmed, and `isRealtime` is a fact the host
already states for every execution. The frequency is the engine's too: `once` is
once for the life of the study, `oncePerBar` is once for a bar however many times
that bar executes, and `everyUpdate` is once per execution. A host whose own
runtime watches the declared conditions applies the same rule from its side, by
judging only the bars that are new since it last looked.

**A marker no longer appears on a bar that is still moving.** The channel
carrying it was published for every bar whatever the bar's state, so a host
reading the column drew the marker on a tick and took it off on the next one.
Step 9 discards a deferred channel on a bar it did not decide, and the columns a
host reads now say so. Plot columns are unaffected and are still published on
every execution.

**Which study owns the candles is a stated rule.** The instrument's bars are one
object and two studies painting them are two answers to one question. The owner
is the study latest in the chart's own study order that paints, which is the
order a legend shows and a user reorders, so it does not change because one
study recomputed before another. Every other study's bar colouring is not drawn.

**Five declaration options that could not be carried now say so at the line that
wrote them.** A level's colour, a grid's two colours and an alert's `id`, `title`
and `frequency` are written into the program before the first bar, and one
computed from bar data used to reach the compiler with nowhere to put it: it
reported OS6018, which says the program is malformed and asks the author to
report a compiler defect. They are checked with OS3003 like every other fixed
option, which names the option and says what to write instead.

**A colour built out of constants counts as one.** `fade(red, 50)` is the same
four numbers on every bar, and it is what a level or a marker is normally
coloured with. The checker accepts exactly the six colour calls the compiler
folds, so a field that has to be fixed before bar 0 can hold one.

**Two alerts can no longer share one name.** A subscription is kept under the
alert's id, so two entries under one name left the host with two conditions and
one row and nothing to say which the user subscribed to. It is OS3017, the same
code two plots sharing a title get, and it counts the derived name as well as
the written one. An id taken from an `input()` is derived rather than used, for
the reason OS8008 now gives: a name that moves when somebody opens the settings
dialog is not a name a subscription can be kept under. A derived id is now taken
from the call's line, which is what OS8008 said all along.

**The trailing stop in the volatility example drew nothing.** The band trails
against the band as it stood, and `max` and `min` propagate absence like every
other calculation, so the first bar after the average warmed up trailed against
an absent band, the band went absent, and the next bar's previous band was that
absence. The study ran, kept its legend row and plotted an empty column for the
rest of the dataset. The example reads the previous band through `orElse` in the
trail as well as in the comparison, and a test fails the build if that column
stops being drawn.

**A cell alignment that is not one of the three is refused.** `align = "middle"`
compiled and was silently drawn left for ever. It is OS3008, which names the
three and suggests the nearest.

**Drawing objects are live.** Lines, labels, boxes and polylines are created,
moved, extended, restyled, deleted and counted as bars arrive. Thirty-one calls,
every one of them driven bar by bar in the tests, and the lifetime rules the
specification states are now the ones the engine keeps.

Three of those rules decide what a study looks like on a live chart. An object
created while the newest bar was moving is rolled back when that bar runs again,
along with every change made to an object that already existed, so five updates
and a confirm leave exactly what one pass leaves and a live chart does not gain a
copy per tick. A setter given an object the script already deleted is OS4005 with
the bar it went on, rather than a silent no operation that leaves a drawing that
quietly stopped moving; a setter given `none` does nothing, which is what the
catalogue's own fix for OS4005 asks a script to produce. An anchor is a time and
a price and is never resolved against a bar, so an anchor past the newest bar
reaches into the margin and an old one does not move when more history loads.

**A ceiling on drawing objects, reported rather than absorbed: OS5010.** An
object lives until the script deletes it and nothing can reclaim one that is
still drawing, so a script that creates one per bar and deletes none used to grow
until the machine stopped it. It now stops with a diagnostic that names the
ceiling and the count. The ceiling is the host's, as the string ceiling is; the
language still fixes no number and nothing is ever dropped to make room, which is
the part that would make a study wrong on the left of the chart and right on the
right.

**An argument a drawing call leaves out now arrives as the default the
specification gives it.** `draw.line(t1, p1, t2, p2)` used to reach the engine
with an absent colour, an absent width and an absent line style, and absence on a
drawing surface means nothing is drawn. The library surface carries these four
calls' defaults and the compiler writes them into the program, so an engine needs
no table of them.

**A polyline keeps its own path.** The two arrays are read once, at the call, and
`draw.setPoints` is what changes a path, so pushing to an array a script kept for
its own bookkeeping no longer silently redraws a shape. The arrays are paired by
index, and a point missing a time or a price is a gap in the path rather than a
point dropped.

**`Engine.drawings()` hands a host facts instead of heap contents.** Each live
object arrives as its kind, its anchors in time and price, and its style, in
creation order. A host no longer dereferences anything, which it had no way to
do: a polyline's path was a handle into the engine's own heap.

**Two library calls no script could make are now callable.** The conversions to
`bool` and to `number` were published under those names, and both are reserved
words, so every spelling of them was refused before the checker saw one, with a
message about naming a variable handed to somebody who had written a call. They
are now `toBool(x)` and `toNumber(s)`. `text(x)` is unchanged: it is not a type
name, so it never collided.

If you wrote either old spelling it did not compile, so nothing that ran before
stops running. Writing one now is still OS1019, and the fix names the spelling
that works instead of telling you to rename a variable you never declared. The
rule behind it is in the specification: no library name is a reserved word, and a
test fails the build if one ever is again.

**The no-eval check can no longer be got past.** The first rule of this project is
that nothing here builds code out of text, and the check enforcing it knew only
the obvious spellings. It now refuses the function builder however it is reached,
including through `call`, `apply`, `bind`, `Reflect.construct` and a constructor
property taken as a value; a name looked up on the global object by computed key;
the runtime's own compiler reached through a binding rather than by naming its
module; code assembled out of bytes; text put into a document; and a module
specifier built out of text. It reads the git hooks and the compiled tests as
well, which it never did. Before reading a file it puts forty-eight attack forms
through its own rules and stops the build if one is not caught, or if an innocent
form is.

**The build removes output that no source makes.** A compiled module from a
layout two refactors old was still in `dist`, which `package.json` publishes, so
the package carried a file no source produced, no test covered and nothing here
explains. Every build now names and removes any such file before it compiles,
in both outputs, reading the directories from the compiler's own configuration
rather than from a copy of them.

**OS8001 now reaches a call that could be written past it.** The warning for a
stateful call that runs on some bars and not others was decided by the pass that
walks statements, so it saw an `if`, a `switch` arm and a loop body and nothing
else. `v = trending ? ema(close, 20) : none` compiled with nothing reported and
drew an average of the bars the guard let through, presented as an average. The
warning now covers a ternary arm, both of them; the right operand of `and` and
`or`, which is skipped whenever the left one has already decided the answer; the
condition of an `else if`; and the values of a `case` arm after the first. Each
of those is a place a bar can pass without evaluating the call, and the engine
always ran them that way. What was missing was the compiler saying so.

A file that compiled clean before can report OS8001 now. Nothing it computes has
changed, and the fix is the one the warning already names: take the call at the
top level and use its result inside the guard.

**A tunable declaration option now compiles.** `language.md` 13.2 has always
allowed an option value to be "a literal, arithmetic over literals, or a call to
`input()`", 13.4 allows an `input()` anywhere at the top level of a file, and
`decisions.md` decision 9 settled how such an option reaches a compiled program.
The emitter carried none of it. An `input()` that was not the entire right-hand
side of a top-level assignment had nowhere to go, so
`study("Range", precision = input(2, "Precision"))` was refused with OS6018 and
no program, and so were `study(input("R", "Title"))`,
`len = input(14, "Length") + 1` and an input written inside any other expression.
OS6018's message says a program that fails verification came from a broken
compiler, so a correct script was told it had found our bug, and every
declaration option in the language was a literal in practice whatever the page
said. A platform adopting the language from those pages wrote a study that would
not compile.

Two halves were missing and both are here. Folding now resolves an `input()`
written in place to the `{ "input": "<key>" }` reference of
`compiled-program.md` 2.3, which is the form decision 9 put in the format and
which every field of `meta`, of `meta.strategy` and of every declaration in
`outputs` may hold; the engine substitutes the resolved value at load, as it
already did for an option written as a name. And an `input()` read inside an
expression now loads the slot the engine writes at step 5 of every bar, while the
same call written as the whole of `name = input(...)` goes on emitting nothing,
because there the name and the input share that slot and the engine's write is
the assignment. The two are told apart by which caller reaches the emitter, never
by inspecting the call: the statement is the only place that can see whether the
call is the whole of itself.

A colour computed from an input comes back with the rest of it.
`plot(close, "C", fade(input(aqua, "Tint"), 50))` was refused for the same
reason: the per-bar colour path emits the expression a script wrote, and the
input inside it emitted nothing. It paints the colour the setting gives it on
every bar now, which is what the checker had always accepted.

Nothing is now allowed that 13.2 and 13.4 did not already allow. An `input()`
inside a block or a function is still OS3007, and the single line form of a
function body is now held to that rule as the indented form always was:
`fn f(x) => x + input(3, "K")` was checked as though it stood at the top level
and declared a settings row from inside a function with nothing said.

**A `close` no longer crosses zero, and the ledger no longer keeps a row for an
order nobody was sent.** On a leg holding one unit long, `close(qty = 5)` sent
one sell of five: the leg ended the bar four short, under one position
reference, with no diagnostic anywhere, and a call named `close` had opened a
position. `stdlib.md` 17.1 forbids it outright, and a quantity the script
states was the one a close sent without working it out. It is now OS7017,
naming what was asked for and what is left to close, and the call reaches no
destination: a bar that places a good
order and then meets it sends nothing at all, the good order included.

Refused rather than quietly reduced to what is there. Sending the smaller number
would send a quantity the script did not write and leave it believing it had
closed the one it did, which is the wrong belief this release has now refused
three times already; and reading the call as a reversal would let `close` open a
position, which the order page already calls the most expensive naming mistake
available. `close()` with no quantity is untouched and goes on working the
number out for itself.

One consequence is worth knowing before you meet it.
`close(tag = "entry", qty = 1)` on a tag that has already flattened is now
refused, while `close(tag = "entry")` on that same tag stays silent and
idempotent. The two look inconsistent and are not: a quantity is an argument the
script wrote, so it is a claim about its own position and the claim can be
false, while a call with no quantity asks the engine for the right number and has
nothing in it to be wrong about. It is the same sentence that separates `buy()`
from `buy(qty = none)`. The comparison with a stated quantity is made in
full only where that quantity and the folded position count the same thing,
which is a declaration whose `qtyType` is `"units"`; in lots, cash or equity
percent they are different kinds of number, and the entry below says which half
of it is made anyway.

The second half of that area: `engine.orders()` reported rows for orders no
destination was ever handed. A bar that placed an order tagged `"good2"` and
then called `cancel("nosuch")` left the destination with zero intents from that
bar, which is right, and left the ledger reporting `good2` at `placed` with an
empty `orderRef`. A host reconciling against that record after a stopped run saw
an order it never received. A bar's rows and a bar's orders are now the same set:
mapping a call still appends its row, because the calls after it on the same bar
are measured against the rows before it, and a bar that is then refused takes
those rows back.

**No order crosses zero, on the three paths that still reached it.** The
sentence `stdlib.md` 17.1 states without qualification held on the shapes that
had been tried. On a leg holding three long, `close()` twice on one bar sent two
sells of three under one position reference: the destination netted three short,
the ledger folded to minus three, and nothing was said. Five bare closes in a
loop ended the leg twelve short, and `close(qty = 2)` twice ended it one short
with each order inside OS7017's own ceiling. The cause was not the position
figure, which is folded from settled fills and is right to be: an order sent a
line ago has filled nothing, so the second close measured against the same
position the first one did. **A reducing order is now measured against what is
left to close on this bar**, which is what the part holds less what the bar has
already sent against it, and the invariant is written into 17.1: the orders one
bar sends can never sum past the position they are reducing. The second of two
bare closes sends nothing, which is the same idempotence as closing a tag that
holds nothing; a second stated quantity is held against what the first one left,
so `close(qty = 2)` twice on a leg of three is one order and then OS7017 naming
one left rather than three. The count covers a `sell` that reduces a long leg,
the closing half of `order.reverse`, and a bar declared `onUnconfirmed` executed
many times, which is one bar however often it runs.

**An entry that would cross zero is now sent as two orders, which is what the
page already taught.** `sell(qty = abs(pos.size) + newQty)` is documented as one
instruction the engine splits into two, because no order crosses zero, and the
engine mapped one order at the quantity written: on a leg holding three, a sell
of five left it two short under one position reference, where a late fill has no
way to say which of the two positions it settled. It now sends the closing half
at what is left of the outgoing position, under that position's own reference,
and the opening half at the remainder under a reference minted for it, which is
what `order.reverse` has always done. An order opposing a position the bar has
already committed to closing in full is opening a replacement rather than
reducing anything, so it too is minted a position of its own.

**A strategy declaring lots now gets the part of that rule that can be held for
it.** OS7017 was narrowed to a declaration counting in units, so `buy(qty = 1)`
and then `close(qty = 5)` under lots, cash or an equity percent sent one sell of
five against a leg holding one, with no refusal on any of the three. The
narrowing is sound where it is about two kinds of number, and it stays there:
comparing a stated quantity with a folded position needs the instrument's lot
size, which is the fact OS7005 has been deferred on from the beginning. But
nothing left to close is zero in every one of those units, so **a close that
states a quantity against a part holding nothing is now refused whatever the
declaration counts in.** Two bare closes on one bar are held in every unit too,
because the quantity a close works out for itself is in units by construction.
What is still not held is one shape, named in OS7017's entry, in 17.2 and in the
feature matrix: a quantity stated against a position that is still there, in a
declaration counting in anything but units. An order like that is sent as
written, and no quantity the engine works out after it adds to what it may have
crossed, because an order the engine cannot read is counted as having closed the
whole of what was left: a `close()` after it on the same part sends nothing. A
second stated quantity on the same bar is another order of the same unheld
shape, not a consequence of the first. Between a close that sends nothing and an
order that crosses zero, 17.1 has already chosen.

Decision 42 records the tension this turned on, which is worth reading before
relying on either half: sizing a bare close is the engine deciding a quantity,
and refusing one refuses a call that wrote no claim at all. It is resolved by
the rule the repository keeps arriving at rather than by choosing between them.
An argument the script wrote is a claim and a false claim is refused; an
argument it did not write is the engine's to work out, and what was always the
engine's to work out here is what is left to close.

**One sentence of the arithmetic manifest could not be violated, and now can.**
`stdlib.md` 20.3 said of the exponential mean that "the new value is multiplied
first and the running value second, and the two products are added in that
order". Binary64 multiplication and addition are both commutative, so that
constrained nothing: run over the eighty bar fixture the release gate compares
bit for bit, the swapped arrangement gives 0 differences out of 164 values. The
arrangement that does vary is `running + (value - running) * weight`, which
differs on 142 of them, and it is the one an implementer is most likely to reach
for because it is one multiplication rather than two. The paragraph now names
it, says what it measured, and says in the open what is deliberately not fixed.
Section 20 is the manifest a second engine implements from, and a sentence that
cannot bite sends that implementer to check the half that does not matter.

**The catalogue check now reads the fix sentence, not just the blocks.** The
blocks were compiled and the sentence beside them never was, and the sentence is
the part a reader acts on. That is how OS7009's fix came to tell a reader to
call `order.working(tag)`, which is marked planned, and how OS3003's came to
hand out `precision = input(2, "precision")` while its own after block had been
edited to show something else because that form did not compile at the time. Two
rules now, both narrow and both stated narrowly. Every call a fix names is put to
the compiler, one at a time, and a name the language does not have or one marked
planned fails the build, unless the entry itself carries a `deferred` sentence.
And a fix that writes a call out with a reader's own values in it, a string
literal or a named argument, has to show one of its calls in its own after
block, which is the only part of an entry a compiler sees. What the rules do not
cover is written in `scripts/lib/fix-sentence.mjs`: the fix is not compiled,
because the code in it is a fragment of a line rather than a line; the second
rule asks for one call rather than all of them, because eleven entries offer a
reader two remedies and demonstrate one; an after block that writes no call at
all is counted and named rather than skipped, and one entry is in that state;
and neither rule can tell whether the advice is any good.

## 0.1.0-alpha.1

The first release published by the automation rather than by hand.

Fixes a version skew that would have bitten anybody running the tests on a
different runtime than the author. Test discovery passed a glob to the runtime's
test runner, which expands it on a recent version and treats it as a literal path
on an older one, so the suite silently found no files and reported success.
Discovery now walks the filesystem in code, and finding zero test files is a
failure rather than a pass.

The supported runtime floor moves to Node 22. Node 20 reached end of life earlier
this year, and supporting a runtime nobody should be running was forcing a worse
test setup.

The build now reports two version numbers of its own: the package version, so a
bug report can establish which build produced a number, and the compiled program
format version, so an engine written by somebody else can refuse a program it does
not implement. Both are generated from the files that already state them rather
than typed into source.

## 0.1.0-alpha.0

First publication. **This version parses and does not compute anything.**

A lexer, a parser, a syntax tree, and diagnostics carrying a code, a line, a
column and a fix. It will tell you whether a script is well formed. It will not
calculate a moving average, draw anything, or place an order.

It exists to reserve the name and to prove the release path while the stakes are a
placeholder, on the principle that automation which has never run is not
automation.

What is behind it: the language specification, a 143 entry error catalogue in
prose and machine readable form, the compiled program format, the host interface a
platform implements, a conformance suite design, twelve worked example scripts and
72 pages of documentation. All twelve examples parse with no diagnostics, which
was the gate for this phase.

Published with no long lived credential. The checker and the engine are next.
