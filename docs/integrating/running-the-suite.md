# Running the conformance suite

For anyone holding an engine, this one or another, who wants to know whether it
produces the numbers every other engine produces.

By the end of this page you will know how to run the suite against an engine,
how to run two engines against each other, how the build stops a release when
they disagree, what the result document says, and what each of this
repository's two adapters does not yet reach.

---

## What the suite is

A directory of cases under `cases/`, each one a directory of named files: a
script, its bars, its instrument, the frames its destination answered, and
what came out. [`spec/conformance.md`](../../spec/conformance.md) is the whole
rule: section 2 for what a case holds, section 6 for what "matches" means,
section 9 for how a result is reported and section 10 for what happens when two
engines disagree. This page repeats none of it; it says which command to run.

The `strategy` cases in the tree are harvested from runs of the shipped
strategies by `scripts/harvest-cases.mjs`, and `npm test` holds them to what
this engine
produces. Section 10 says a case is never edited to make an engine pass, and
that includes this one.

## The adapter

An engine takes part through an adapter, a program the suite starts once per
case. This repository's own is `scripts/adapter.mjs`, and it answers the three
invocations section 9 gives, each with one JSON object on standard output:

```
npm run build
node scripts/adapter.mjs --describe
node scripts/adapter.mjs cases/order/buy
node scripts/adapter.mjs --actual cases/order/buy
```

The first is the engine's identity. The second is one case result, with its
outcome and, on a failure, the first difference. The third is what the engine
computed for the channels the case asserts, with no comparison made, which is
what the second mode below is built on.

An adapter for another engine answers the same three invocations in the same
shapes. The runner starts every adapter with the runtime it runs on itself, so
an adapter is a JavaScript file; an engine in another language is started by a
small JavaScript file that starts it and relays its output, which is that
engine's to write.

## The second engine's adapter

`engine/adapter.mjs` is that file for the engine in
[`engine/`](./the-python-engine.md), and it answers the same three invocations:

```
npm run build
node engine/adapter.mjs --describe
node engine/adapter.mjs cases/order/buy
node engine/adapter.mjs --actual cases/order/buy
```

It is the one adapter here that does something on the way. The second engine
implements no compiler, so the relay compiles `script.os` with this repository's
compiler and hands the engine the compiled program as the canonical text a host
would send it, on standard input; the engine loads that text, runs the bars and
answers. Section 1 of the specification provides for exactly that: an
implementation that only has an engine reads compiled programs produced
elsewhere, runs the engine half, and says so. What a result means, therefore, is
that the second engine ran the program the first one emitted, which is also the
production arrangement: a container with no runtime for this language is handed
a compiled program as data.

Everything the engine answers goes through `python -m openscript`, which is the
adapter proper and can be driven on its own:

```
echo '{"program":"<the canonical program text>"}' | python -m openscript <case-directory>
```

**What it claims.** The profile that covers the cases it runs, which is
`strategy`: it loads a compiled program, runs the bars, folds the frames a case
supplies and reports what the run made. The identity it writes carries
`engineOnly` beside the profile, because section 8's word for an implementation
with no compiler is not one of the three profiles a runner accepts.

The claim is worth reading against the table it is made from, because the table
and this engine do not line up. A profile there is cumulative, so `strategy`
reads as "everything `chart` covers, and orders as well", and this engine draws
no marker, fill or level: a case asserting one is answered `unsupported` naming
the channel. The alternative is to claim `core` and have every strategy case
skipped, which is a suite that says nothing about the engine that runs the
money. So the wider claim is made and every shortfall is named on the case,
which is the arrangement section 8 describes for a feature and has no spelling
for here.

**The compiler-diagnostic half is not a shortfall and is no longer reported as
one.** Section 8 always said an engine reporting `engineOnly` "runs every case
except the compiler-diagnostic categories", and the runner did not do it: there
were no such cases, so nothing noticed. The moment there were, this engine was
handed nineteen of them and answered `unsupported` on each, and a run of two
engines failed on a gap that was neither engine's. The runner now reads section
7's `Needs a compiler` column and skips those categories for an engine with no
compiler, which is what the page promised.

Everything it cannot do is named on the case with the `unsupported` outcome, and
the engine is what names it: a program needing a capability it does not serve, or
a library function its manifest does not hold, is refused at load with that tag
or that function in the refusal, and the refusal becomes the feature the case
reports.

**What it does not reach.** Said here so a reader does not discover it as a
surprise, and each is `unsupported` or `error` on the case, never a pass.

- **Six of the fourteen channels.** It answers `diagnostics`, `values`, `orders`,
  `trades`, `performance`, `log`, `drawings` and `table`. A case asserting
  `markers`, `fills`, `levels`, `barColors`, `background` or `alerts` is
  `unsupported` naming the channel, because an empty channel compares equal to
  an empty expectation and would be a pass nobody earned.
- **A compiler case.** A case whose assertion is a diagnostic raised by
  compiling is `unsupported`: the compiler here is the first engine's, and its
  diagnostics are not the second engine's to claim.
- **`ticks.csv`.** The machine re-executes a bar and rolls its state back, the
  fold of every higher timeframe read included, and how a tick row becomes the
  newest bar's four prices is written down nowhere, so a replay would be the
  adapter's invention. The rollback is held by the engine's own tests instead.
- **A frame delivered after the last bar.** Section 3 has a frame delivered
  after the bar it names and folded before the next execution, and the last bar
  has no next execution, so what becomes of such a frame is written down
  nowhere. A case carrying one is `unsupported` rather than run against a
  ledger missing whatever the frame said.
- **`expectedExitCode`.** Section 2 names the field and fixes no shape for it,
  so no shape is read.
- **A calendar outside the one timezone this engine reads.** A written time, a
  session boundary and a day, week or month read are all dated in the
  instrument's zone, and a host with another zone supplies its own reader; this
  engine has been given none. A record that states no zone at all is not this
  case: both engines leave a calendar read with nothing to date it by absent,
  and say why through `req.error`.
- **The planned entries of every namespace.** Each is refused at load naming
  the function, which the case reports as the feature.

A read of another instrument is not on this list. It is answered from the
case's own `bars.<SYMBOL>.csv`, as section 3 serves one, and a case whose script
reads an instrument it holds no file for is `error` naming the file: a missing
file is a broken case, never an absent series.

## Running it

Both commands are run from the repository root, after `npm run build`.

**Against the expected files.** The runner walks `cases/`, hands each case to
the adapter in a child process of its own with a timeout, and writes the result
document of section 9 to standard output:

```
node scripts/run-suite.mjs
node scripts/run-suite.mjs --adapter path/to/their-adapter.mjs --out result.json
```

**Engine against engine.** Each case is handed to both adapters with
`--actual`, and the runner compares the two answers channel by channel with
tolerance zero, whatever the case declares, through the same comparison the
adapter uses. The first adapter's values are the `expected` side of a reported
difference and the second's the `actual` side:

```
node scripts/run-suite.mjs --against path/to/their-adapter.mjs
```

`--cases <dir>` walks another suite root, `--timeout <ms>` bounds one
invocation, and `--out <file>` writes the document to a file instead of
standard output. The one-line summary goes to standard error either way, so
standard output is the document and nothing else.

Three named commands do the same three things from the repository root, and the
third is the one the build runs:

```
npm run suite          # this engine, against the expected files
npm run suite:engine   # the second engine, against the expected files
npm run suite:agree    # the two engines, against each other, exactly
```

## The gate

`npm test` runs `suite:agree`, so a disagreement between the two engines fails
the build. That is section 10 made mechanical: a disagreement is a release
blocker, and the release stops where the disagreement is found rather than where
somebody remembers to look.

One rule belongs to that mode alone. A run where every case was skipped exits
non-zero, saying it compared nothing. In the first mode a skipped case is one
engine honestly reporting the profile it claims, which is what section 8 is for;
in the second it means neither engine was asked about a single case, and a green
line there would be the same evidence a suite with no cases in it produces.

## Reading the result

The exit code is the verdict: zero for a passing run, non-zero otherwise. A run
fails on any `fail`, `nonFinite` or `error` outcome, and on any `unsupported`
one, because section 8 says an implementation with an unsupported case inside
the profile it claims does not pass that profile. A case outside the claimed
profile is not run and is reported `skipped`, which is never a pass.

A crash, a hang past the timeout, or an answer that is not one JSON object is
the `error` outcome, with a reason in the row: the program that suffered it
cannot report it, which is why an adapter is invoked once per case and never
for the suite as a whole.

The document's `suiteRevision` is the revision `conformance.md` section 11
spells: the package version the cases shipped with and a digest of every file
under the suite root the run walked, so a result names the cases it was run
against and a suite that differs by a byte has a revision of its own. An
engine-only adapter's identity carries `engineOnly` in the document, because
section 8 says its report says so.

## Making a badge

A badge is the claim a passing run entitles you to make, and `conformance.md`
section 12 says it carries four things or it is not valid: the implementation
and its version, the suite revision, the profile, and a link to the result
document. Run the suite with your adapter, publish the document it writes, then
make the badge from that document:

```
node scripts/run-suite.mjs --adapter path/to/your-adapter.mjs --out result.json
npm run badge -- result.json --link <where result.json is published> --out badge.svg
```

The second command writes `badge.svg` and prints the line a page embeds it
with, linking to the document. It refuses, and writes nothing, when the document
is not a passing run of the profile it claims (any `fail`, `nonFinite`, `error`
or `unsupported` case, or a skipped case inside that profile), when it compares
two engines rather than running one, when it lacks any of the four things, or
when its revision is not the revision of the suite under `--cases`, which it
recomputes rather than reads. An engine-only run may skip the compiler
categories, and its badge says it is engine only.

What the badge does not say is that the run happened as the document reports.
The project certifies nothing and vouches for nobody; a badge is credible
exactly to the extent that the document is published beside a build anybody can
rerun.

This repository shows no badge of its own. `ROADMAP.md` Phase 7 holds it back
until an engine written from the specification alone, by somebody who has not
read this implementation, passes a named revision, because until then a badge
here would be two engines that talked to each other agreeing.

## What the reference adapter does not reach

Said here so a reader does not discover it as a surprise. Each is reported as
`unsupported` or `error` on the case, never as a pass. The second engine's own
list is in its section above.

- **A frame no boundary of the run delivers.** Section 3 puts a frame's
  delivery after the bar it names and its fold before the next execution, so a
  row naming the last bar has no fold left and a row naming no bar of the run
  has no delivery. What becomes of either is not written down anywhere, so the
  case is `unsupported` naming the row rather than run with part of its own
  input passed over. Every other `frames.csv` is folded as it is written: this
  engine delivers the rows a case supplies and answers none of its own.
- **Six of the fourteen channels.** The adapter answers `diagnostics`, `orders`,
  `trades` and `performance`, which a run records, and `values`, `log`,
  `drawings` and `table`, which a run hands back beside its record when a case
  asks for them. A case asserting `markers`, `fills`, `levels`, `barColors`,
  `background` or `alerts` is `unsupported`, by name.
- **A warning case.** The diagnostics a run records are the ones it raised; a
  compile warning is not among them.
- **`ticks.csv`.** A backtest replays no intrabar update. A read of another
  instrument is served, from the case's own `bars.<SYMBOL>.csv` handed to the
  run as its host's answer, and a read whose file is missing is `error`.
- **A per-column tolerance.** Section 6 allows one and fixes no shape for it,
  so none is read.
- **A strategy case with no `instrument.json`.** Section 3's default
  instrument names no currency, and the money layer refuses to charge in none,
  so such a case is answered with that refusal in its diagnostics. A harvested
  case always states its instrument.
- **A strategy case with no `backtest.json`.** Section 3 requires the file of
  every strategy case and both adapters refuse a case without it, by name,
  rather than running it under a digit count, a schedule or a window nobody
  stated. Two engines rounding to counts they each assumed agree by
  coincidence.

## How wide the agreement is

A passing run says the engines agree on the cases there are, and the cases there
are do not cover the language. This is the part a reader has to be told, because
a green suite reads as wide as the reader imagines it.

What the cases exercise: a strategy entering long and one entering on either
side of a range, both sized and flattened by the script; the ledger the frames
of a simulated destination fold to; the trades and the summary folded from those
fills; a report narrowed to a window inside the bars, with a position open at
each end of it; a money rounding digit count other than the fixture's; and
values a host stored for a script's inputs. Beside the strategies, the cases
under `cases/req` hold a read of the chart's own bars at a coarser interval in
each of its three modes and by the calendar, a read of another instrument
served from a file, and the status of a read, each against columns worked out
from the bars without either engine.

What no case has yet, each with the reason:

- **A read folded from a base interval**, fifteen or three minutes on a ten
  minute chart (`stdlib.md` 15.2). A case's host serves another instrument from
  its own file and has no file for the chart's own instrument at a second
  interval, so the two engines' own tests hold it instead:
  `tests/engine/requests-base.test.ts` and `engine/tests/test_request_base.py`
  assert the same columns from the same bars.
- **A charge schedule the host supplied.** A supplied schedule beside a declared
  commission is refused before the first bar, and every shipped strategy
  declares one, so harvesting such a case needs a strategy that declares none.
- **A frame repeated, and two frames arriving in the wrong order.** These are
  shapes the specification provides for and no case hands to an engine, so two
  engines could differ on them today and the build would not say so. What used
  to be on this line with them, and is not any more: a partial fill, a
  rejection, a cancellation, an expiry and a fill reported after the order had
  gone terminal are each carried by a case now, because a case states the
  destination's behaviour and no longer only records what this engine's own
  simulated destination happened to do.
- **More than one entry in a direction, and more than one instrument.** Every
  shipped strategy holds one position at a time on the chart's own instrument.

Each of those is a place where two engines could differ today and the build
would not notice, which is the honest reading of a green run.
