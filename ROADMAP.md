# Roadmap

Each phase ends with a gate that either passes or does not. A phase is not done
because the code is written; it is done because the gate passed.

Estimates assume one developer working steadily.

---

## Phase 0. Specification and skeleton

Three weeks.

- The language specification.
- The feature matrix: one row per language feature, its status, and the test
  that proves it.
- The error catalogue format.
- The compiled program schema, written down and versioned, because every engine
  and every adopter depends on it.
- Twelve target scripts written by hand: EMA cross, Supertrend, anchored VWAP,
  RSI divergence, opening range breakout, straddle premium, higher timeframe
  bias, a dashboard table, a drawing heavy study, and three strategies. If the
  language cannot express these cleanly, the language changes now rather than
  later.
- Repository, licence, continuous integration, an empty conformance suite.

**Gate:** all twelve scripts read cleanly to someone who has never seen the
language, and every construct they use is in the specification.

## Phase 1. Front end

Three to four weeks.

Tokens, tree, and errors that carry a code, a line, a column and a caret under
the offending text.

**Gate:** parses all twelve target scripts and several hundred real world
scripts without crashing, and every error it can emit exists in the catalogue.

**Production bar this phase owes.** No input, however malformed, may hang or crash
the compiler. A trader's editor calls this on every keystroke, and a platform
embedding it is running it on untrusted text from a million people.

## Phase 2. Checker and bar engine

Four to six weeks.

Name and type checking, warmup handling, series history, values that persist
across bars. The instruction engine, with no `eval` anywhere. First chart
output: plots, bands, levels, inputs, a generated settings dialog, saved layout.

**Gate:** EMA, RSI, MACD, Bollinger Bands and Supertrend match reference
implementations to the last decimal, and each one's warmup is exact.

**Production bar this phase owes.** A runaway script stops: an instruction budget
per bar, a memory ceiling and a wall clock, enforced by the engine because it owns
the loop rather than by hoping a script behaves. One script failing is a
diagnostic on that script and touches nothing else. And a benchmark with a number
in continuous integration, because performance regresses silently and a platform
that has to discover it in production will not adopt a second version.

## Phase 3. The whole visual surface

Four to six weeks.

Markers, shapes, bar colouring, pane background, tables, line and label and box
objects a script mutates over time, alerts, higher timeframe reads, other
instrument reads.

**Gate:** one hundred independently written studies reproduced in OpenScript,
each matching its reference output exactly.

## Phase 4. The editor

Three to four weeks.

The editor splits in two, and the split is the point.

**This project ships the language intelligence, headless.** Six pure functions,
text in and data out, no DOM anywhere: highlight, complete, diagnose, hover,
signature, format.

None of them is hand written, because a hand written one drifts from the language
and nobody notices for a release. Highlighting comes from the real lexer, which is
step one of the compiler. Completions come from the standard library manifest, the
same file the example check already reads its globals from. Errors as you type are
the compiler's own errors, with the fix taken from the error catalogue, which is
also what the documentation site is generated from. The editor is not a second
implementation of the language to be kept in step. It is the compiler wearing a
different hat.

**The host ships the editor on screen.** The text component, the panel, the apply
button, saving and revisions, and the theme. Every host has a design system and
none of them wants to fight a styled panel shipped by a language package.

The same headless functions wrap into a language server later, so the same
highlighting, completions and errors appear in a desktop editor for anyone who
would rather keep their scripts in version control and write them there.

**Gate:** someone with no setup writes and plots a working script in under two
minutes, and the same script opens in a desktop editor with identical errors.

**Where this phase stands.** All six functions are built and
`openalgo-script/editor` is an entry point, with a drop-in adapter beside it at
`openalgo-script/adapters/codemirror` that wires them into a text component and
draws nothing itself. None of the six is hand written, and each one says which
part of the compiler answers it:

    highlight    the real lexer, and the language's own tables of words and marks
    complete     the standard library manifest, the checker's bindings, and the
                 error catalogue for what a planned call would be refused with
    diagnose     the whole front end, with every message and fix from the
                 catalogue the documentation is generated from
    hover        the manifest again, and the specification's own table cells,
                 read at build time rather than retyped
    signature    the manifest and the emitter, which between them hold every
                 default the compiler applies
    format       the lexer for the tokens and the parser for the three questions
                 spacing cannot answer without a tree

**The gate is not met, and both halves of it are outstanding.** A host has to put
these in front of a trader before anyone can write and plot a script in two
minutes, and the language server that would open the same script in a desktop
editor with identical errors is not written. The functions are the part of this
phase that belongs in this repository; the gate is measured on a product.

## Phase 5. Strategy and backtest

Six to eight weeks.

Orders, position, brackets, sizing, a cost model that matches the market being
traded, backtest over a from and to date range, and the report: equity curve,
drawdown, trade list, win rate, expectancy, and every trade marked on the chart.

**Gate:** a backtest is reproducible from its stored script revision months
later, and two runs can be compared well enough to tell a real improvement from
noise.

**Held, and held by a check.** `scripts/check-reproducible.mjs` runs on every
`npm test` over the shipped strategy examples: each run is written to JSON, every
other reference to it is dropped, and the record is parsed back from that text
alone before it is reported again, run again, refused over revised bars, and
compared. What the gate does not cover, and says so in its own summary, is the
half that needs somebody else's engine, which is the next phase's.

**What this phase owed the next one, and has since paid.** A run record is the
conformance case, and it is written. The case *files* could not be produced from
a record alone: `spec/conformance.md` section 2 requires a case directory to
carry `script.os`, the source text, and a record carried only the source's hash,
its line count and its file name. A hash settles whether two files are the same
and yields neither of them.

Settled by putting the text in the record rather than beside it. Record version 2
carries `sourceText`, checked against the hash the compiled program already
holds, and `caseFilesFrom` projects a record into the files of a case: text out,
no I/O, nothing computed. A record that cannot make a whole case makes none,
because a directory missing one file fails on somebody else's engine and the
cost lands on them.

It went in the record and not in the compiled program deliberately. A program is
executable data no engine needs the source to run, and it is the versioned
artefact adopters depend on; the text there would travel everywhere a program
travels and widen the format every engine has to read. Earlier records still
read, with the text absent: a version bump that made every stored run unreadable
would cost the thing the record is for.

## Phase 6. The second engine, and live running

Twelve to sixteen weeks, in two halves that can overlap: eight to eleven for the
engine, four to five for live running.

The first number was four to five for both halves together, and it was written
before anybody measured. A survey of `src/core/engine` and `src/core/stdlib`
put the engine alone at eight to eleven, and that budget also had to cover
process isolation, scheduling, per-script logs and the switch from sandbox to
live. One of the two numbers had to change, and it was not going to be the
engine: an engine squeezed to fit an estimate is an engine that agrees with the
first one on the cases it got to. The figure is here, in the document a reader
plans from, rather than in a note nobody opens.

A server-side engine running the same compiled program. Process isolation per
strategy, scheduling against exchange calendars, per-script logs, sandbox mode
by default and live only as a deliberate act.

**Strategy execution is server side, and never the browser's.** Decided rather
than deferred, so nothing earlier is built as though a tab might run a strategy
one day. Three things force it and none is a preference. A production container
ships no runtime for the language the front end is written in, so the only place
a browser engine could run is the browser. A tab that closes stops every strategy
in it, and closing a tab is not a decision anybody makes about their positions.
And one page is one heap and one main thread, so the number of strategies a
trader can run would be set by their browser rather than by their machine, and
they would all fail together.

What makes the alternative possible is a decision already made for another
reason: the compiled program is plain data rather than generated code. It was
made so the language could run under a strict content security policy, and it is
what lets an engine in another language run the same program at all. This phase
is where that pays.

**Phase 5 owes this phase its run record.** Phase 5's gate is that a backtest is
reproducible from its stored script revision months later; this phase's gate is
that two engines agree on every conformance case. Those are one artefact seen
twice: a compiled program, the bars it ran over, the settings it ran with, and
the deterministic result. A run recorded so that another implementation can
replay and compare it IS a conformance case, so the suite this phase is measured
against is a by-product of the phase before it rather than something invented
here. Invented here, it would test what somebody imagined a run does instead of
what runs actually did.

**Alerts stay on the chart for now, and that is a decision rather than an
omission.** An alert is evaluated by the chart that is open: it is set on a
price, a study plot, a drawing level or a candle condition, it fires while
somebody is watching, and it stops when the tab does. The alternative is
server-side evaluation, where an alert outlives the session and fires with
nothing open, which is what a hosted platform sells and what a trader eventually
wants.

It is not being built yet, and the reason is cost rather than doubt. Evaluating
alerts server side means a second evaluator running continuously per user, a
delivery path with retries and deduplication, a store with its own migration, a
quota, and a decision about what an alert means when the instrument it watches
has no subscriber. That is a phase of its own, not a feature inside one, and
none of it is needed to make the language or the backtest correct.

So the chart-triggered form ships and the server-side form is left open. Nothing
above depends on which is chosen: an alert's definition is already portable data
in the same shape everything else here travels in, so a server-side evaluator
reads the same records rather than a second format invented for it. **This is
the paragraph to revisit while implementing the next phases**, because the
engine that runs a strategy without a browser is the same engine that would
evaluate an alert without one, and the moment that exists the cost above is
mostly already paid.

**Gate:** the two engines agree on every conformance case. A disagreement is a
release blocker, because a backtest that disagrees with the chart is worthless.

**Production bar this phase owes.** The conformance suite has to be runnable by
somebody who has never seen this repository, against an engine we did not write.
That is the whole claim of the project, and until an outside engine passes it the
claim is untested.

## Phase 7. The standard

Ongoing.

**The gate became falsifiable on 2026-09-22, and was not before.** Every case in
the suite declared the `strategy` profile, so an engine claiming `core` was
handed none of them: every case was skipped, the runner printed a pass and
exited zero, and `tests/suite/runner.test.ts` asserted that outcome against an
adapter that answers no case at all. An engine implementing nothing met the bar
this phase sets. Twenty three `core` cases now exist across `lexical`, `syntax`,
`static`, `runtime` and `limits`, and the same adapter now fails on twenty three
errors. No change to the runner was needed for that: its rule was already right,
and what was missing was cases for it to apply.

**Two things that remain, and the second is the larger.** The suite still has no
case asserting a per-bar value, because this engine's own projection has no
channel for one (`caseFilesFrom` writes diagnostics, orders, trades and
performance). So `semantics` and `numerics`, which are the categories section 1
of `conformance.md` says the suite exists for, cannot be written against the
reference implementation yet. And the gate itself needs an engine written by
somebody who has not read this implementation, which nobody inside this
repository can supply.

An importer for scripts written in other chart languages, a documentation site
generated from the specification and the error catalogue, a versioned compiled
format with a compatibility promise, a conformance badge, and an engine written
in a third language to prove the format travels.

**Gate:** a `core` profile engine written in a third language, from the
specification alone, by somebody who has not read this implementation, passes
the suite at a named revision. That is the only result that means the format
travels rather than that two teams who talked to each other agree, and it is
why the badge is the last thing in this phase and not the first: a badge names
a suite revision, and it is not shown for a revision no third engine has passed.

This phase had no gate line until now, which made "done" undefined for the one
phase whose artefacts leave the repository. The importer and the site are
deliverables inside it; the gate is what finishes it.

---

## Phase 8. Multi-leg strategies and the risk controls over them

Ten to fourteen weeks. It is written down here rather than left as a note because
it is the phase the language was designed for and the one nothing in Phases 1 to 7
delivers.

A strategy today trades one instrument, chosen by the host before the run starts.
The surface for more than one is already designed and marked planned in
`stdlib.md` sections 17.6 and 17.9 to 17.11: `leg.fixed` and `leg.relative`
declare what each leg trades, the `leg.*` rules manage each one, and the `book.*`
rules reason across all of them. None of it executes. A script calling any of it
is refused at the call with OS2020, which is the honest behaviour and is not the
same as the feature existing.

This matters most for the strategies nobody can express any other way. A position
made of two or more derivative contracts has a risk profile that belongs to the
combination and not to any leg: the loss that matters is the book's, the stop
that matters squares off everything at once, and a stop placed per leg both
triggers on moves the combination absorbed and misses the ones it did not. That
is why `book.stop` exists in the design, and it is why two independent
single-instrument strategies are not a substitute for one multi-leg strategy.
They are two strategies that happen to be running at the same time.

### What this phase delivers, in the order it has to be built

**1. Contract resolution, which everything else waits on.** `leg.fixed` names a
contract outright. `leg.relative` describes one: an underlying, whether it is a
future or an option, which expiry by rank, which series, how far from the money
in strikes, and which right. Resolving a description into a contract needs an
instrument master, a definition of "at the money" at the moment of resolution,
and a rule for what happens when the described contract does not exist. Resolution
happens once, before bar zero, and the resolved contract is then fixed for the
run: a leg that re-resolved mid-run would be a different position under the same
name.

**2. One run, several data feeds.** Each leg has its own contract and therefore its
own bars. The engine's bar cycle takes one bar at a time today, so this phase
decides what a bar is when a strategy holds three contracts: whether legs share a
clock, what happens when one feed is late or has a hole, and which leg's bar the
script is executing on. This is the largest piece of engine work in the phase and
the one most likely to be got wrong quietly.

**3. Per-leg rules.** `leg.stop`, `leg.target` and `leg.trail`, each attached to a
named leg, each replacing any in force on that leg. A leg carries at most one stop
and one target at a time, which is already the rule written down for the
single-instrument case.

**4. Book rules, which are the point of the phase.**
   - `book.stop(amount)` and `book.target(amount)`: square off every leg when the
     combination's profit reaches a figure. The combination's profit, not any
     leg's.
   - `book.lockProfit(activateAt, lock, step, advance)`: a floor under the book's
     profit that ratchets up.
   - `book.trailStopsToEntry(at)`: move every leg's stop to its own entry once the
     book is ahead by a stated amount.
   - `book.direction`, `book.entryWindow`, `book.exitAt`, `book.dailyLoss` and
     `book.squareOffAtExpiry`: the gates on when a position may be opened and the
     rules that close it whatever the strategy thinks.

**5. The order in which rules are tested**, which is a specification problem
before it is an implementation one. Within one bar a leg stop, a leg target, a
book stop, a book target, a profit floor and a time rule can all be true at once.
`stdlib.md` 17.10 already owns this question for the single-instrument case and
this phase extends it: the order must be total, written down, and identical in
both engines, because two engines testing the same conditions in a different
order take different trades from the same script.

**6. Squaring off a book is not squaring off each leg in turn.** A square-off that
sends one leg and is refused on the next leaves a position that is no longer the
position the strategy was reasoning about, and it is the shape most likely to
lose money. The phase owes a rule for a partial square-off and an engine that
reports it rather than continuing.

**7. The host side.** A runner that holds one instrument per script cannot run
this. It needs a feed per leg, an order path that knows which leg an order belongs
to, and a stop that means every leg.

### What has to be decided before any of it is written

- **Where the instrument master comes from**, and what an engine does with a
  description that resolves to nothing.
- **What "at the money" means** at the moment of resolution, to the tick.
- **Whether a leg may be added after bar zero.** The design says no; this phase
  either confirms that or changes it deliberately.
- **What a book-level stop does to a leg whose contract is halted or has no
  quote.** Squaring off a book means squaring off every leg, and a leg that
  cannot be squared off is the case that decides whether the rule is honest.

### Gate

A multi-leg strategy, expressed once, backtested and then run, where the
combination's stop squares off every leg; both engines agree on every conformance
case for sections 17.6 and 17.9 to 17.11, including the order rules of 17.10 and
at least one case per book rule; and a partial square-off is reported rather than
hidden. The adoption bar this phase owes: a platform that did not build this can
run a multi-leg strategy on it without reading the implementation.

### Why it is after Phase 7 and not before

Phase 7 fixes the format and proves it travels. Every rule above is behaviour a
third engine has to reproduce exactly, so adding them before the format is fixed
and a second implementation has been written against it means designing them
against one implementation and discovering the disagreements later, one at a time,
in somebody else's engine.

## The adoption bar

Every phase is measured against two questions, not one: is it correct, and can a
platform that did not build it run production on it. The second is written into
each phase's gate above rather than left as an intention, and the README carries
the table of what is guaranteed today and what enforces it.

The rule behind all of it: prefer a check to a promise. A promise in a document is
worth exactly as much as the attention of whoever reads it next.

## Promises that hold from version 1

- **A saved script never stops working.** A file declares the language version
  it was written for, and every past front end is kept.
- **Nothing changes under you.** A chart, a backtest run and a running strategy
  each pin the script revision they started with. Editing a script does not
  silently change a study on a chart or a strategy holding a position.
- **Every error is documented.** Enforced by the build, not by discipline.
- **Engines agree.** Cross-engine equality on the conformance suite is a release
  blocker.
