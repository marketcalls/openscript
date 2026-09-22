<div align="center">

# OpenScript

**An open trading language. Write a study or a strategy once, plot it, backtest it, trade it.**

Compiles in the browser in milliseconds with no build step and no `eval`, runs
the same compiled program on a server, and is specified well enough that anyone
can write their own engine for it.

[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![status](https://img.shields.io/badge/status-early%20development-orange.svg)](./ROADMAP.md)

</div>

---

## Architecture at a glance

[![OpenScript connects a trading idea to charts, backtests and planned live trading, using the platform's editor, market data and broker connection.](https://raw.githubusercontent.com/marketcalls/openscript/main/docs/architecture-overview.png)](https://raw.githubusercontent.com/marketcalls/openscript/main/docs/architecture-overview.png)

Write an indicator or a strategy once, then use it on a chart or test it against
historical data. Your platform supplies the editor, saved scripts, market data
and connections. The live runner is planned, with sandbox testing before live
execution; see [Phase 6](./ROADMAP.md#phase-6-the-second-engine-and-live-running).

## Status

**`0.4.0` runs studies, backtests strategies, and ships the language
intelligence an editor needs.**

What an install gets you today: the compiler, the engine, the chart adapter and
the backtest. A script compiles in milliseconds in a browser tab and computes,
bar by bar, the same numbers everywhere. One hundred and one independently
written studies compile, load and run, and five of them match arithmetic
transcribed from the specification alone, bit for bit, warmups included.

A strategy is walked over a range of bars and what comes back is a document
rather than a number: the program, the bars, the settings, every frame, every
fill, the ledger and the report. That document replays to the same report and
reruns to the same bytes, and `npm test` proves it over the shipped strategy
examples on every run rather than asserting it in a page. Two records can be put
beside each other, and a pair over different bars is reported incomparable
instead of being subtracted into a table that reads like a result.

What it does **not** do yet, stated plainly because the registry page is the
first thing a stranger reads:

- **The backtest does not model everything, and says which.** A bracket's stop
  cannot fill, because the engine appends no order row for a bracket. A quantity
  stated in cash or in a percentage of equity is refused rather than filled,
  because a backtest works out no running equity to size against. The equity
  curve marks a trade at the size it ended up entering, so a strategy that
  scales in is reported with a drawdown deeper than the account had. A script
  still cannot read its own equity mid-run. The `0.4.0` entry in
  [`CHANGELOG.md`](./CHANGELOG.md) is the full list, and every item on it is
  there because somebody would otherwise find it inside a report they had
  already believed.
- **No editor on screen, and that is the design.** The six headless functions are
  here and resolve as `openalgo-script/editor`: highlight, complete, diagnose,
  hover, signature and format, text in and data out, with no DOM at any tier. The
  text component, the panel, the apply button, saving and the theme are yours,
  and the drop-in adapter for one editor component wires the six into it without
  drawing anything itself. What each function gives you, and what stays yours, is
  in
  [`docs/integrating/the-editor-half.md`](./docs/integrating/the-editor-half.md).
  The language server that would put the same errors in a desktop editor is the
  rest of Phase 4 and is not written.
- **No engine anybody else wrote has run the suite, so the portability claim is
  still untested.** The second engine is here: `engine/` holds a complete
  engine in Python with a test suite of its own, and `npm test` runs both on
  every build. A run record carries its own
  source text rather than only a hash of it (`sourceText` in
  [`src/core/backtest/record.ts`](./src/core/backtest/record.ts)), and
  `caseFilesFrom` in [`src/core/backtest/case.ts`](./src/core/backtest/case.ts)
  writes the files a suite runs from straight out of a record, which is where the
  eight cases under [`cases/`](./cases) came from. `npm run suite:agree` reports
  8 pass of 8 between the two engines. What that run does not prove is the thing
  the suite exists for: both engines were written in this repository, from the
  same specification, by the same hands, so their agreement is evidence about
  this repository rather than about the specification. Until an engine written by
  somebody who had only the specification passes these cases, portability is a
  design with one corroborating implementation, not a result.

The version is `0.4.0` rather than `1.0` because of that list. The studies
surface is the part that is finished, and it is the part to build on.

`ROADMAP.md` says what each phase owes before it is allowed to finish. The
specification is written first and the implementation follows it, which is why
there is still more specification here than compiler.

## What it looks like

```
study("EMA cross", overlay = true)

fast = input(9,  "Fast")
slow = input(21, "Slow")

ef = ema(close, fast)
es = ema(close, slow)

plot(ef, "Fast", aqua)
plot(es, "Slow", orange)

if crossUp(ef, es)
    signal("BUY")
```

The same file becomes a strategy by adding orders:

```
strategy("EMA cross", overlay = true)

if crossUp(ef, es)
    buy(qty = 1)

if crossDown(ef, es)
    close()
```

One script. One set of numbers on the chart, in the backtest, and in the market.

## Why it exists

Chart scripting today is closed. You write in someone's editor, your script runs
on their servers under their limits, and the only way out is a webhook. The
numbers you backtest are not the numbers you trade, and you cannot check either.

OpenScript is the opposite of that:

- **Yours.** Plain text files in a folder. Version control, diffs, your own editor.
- **Local.** It compiles and runs on your machine. No execution quota, no loop
  timeout, and nothing you drew silently dropped to make room for the next one.
- **Honest.** A higher timeframe read has to say whether it repaints. The
  compiler warns when a script would.
- **Connected.** Designed to route orders through your own broker connection,
  with sandbox testing before live execution. The live runner is planned.
- **Open.** Apache-2.0, a written specification, and a conformance suite anyone
  can run against their own implementation. It covers the compiler's
  diagnostics, the runtime errors and the limits today; the per-bar values are
  specified and not yet testable, and [the suite's own page](./spec/conformance.md)
  says which is which.

## How it is built

The compiler does not emit JavaScript. It emits a **compiled program**: a plain
data structure of instructions, defined by a versioned schema.

That one decision carries the whole project:

1. It runs in a browser under a strict content security policy, with no `eval`
   and nothing for a security team to approve.
2. A server-side engine is a few hundred lines that walk an instruction list,
   not a second implementation of the language.
3. Anyone can write an engine in any language, and hold it to the conformance
   suite. What the suite reaches today is written down rather than implied: an
   engine claiming the narrowest profile is handed cases and fails if it
   answers none of them, which it was not before the `core` cases existed.

One compiler. One compiled format. Many small engines, all of which must agree
to the last decimal.

The same decision shapes the editor. This project ships the language
intelligence as pure functions with no DOM: highlight, complete, diagnose, hover,
signature, format. Highlighting comes from the real lexer, completions from the
standard library manifest, and the errors you see while typing are the compiler's
own, with their fixes taken from the error catalogue. A host supplies the text
component and the panel around it, and keeps its own design. The editor is not a
second implementation of the language to be kept in step.

[![OpenScript compiler and runtime: source passes through lexing, parsing, checking and emission into a portable data program, then verification, loading and bar-by-bar interpretation produce outputs for the host.](https://raw.githubusercontent.com/marketcalls/openscript/main/docs/architecture-compiler.png)](https://raw.githubusercontent.com/marketcalls/openscript/main/docs/architecture-compiler.png)

### From source to a compiled program

| Stage | What happens | Implementation |
|---|---|---|
| Lex | Turns text into tokens with source positions. Newlines, indentation and dedentation become explicit tokens, so later stages do not reinterpret whitespace. | [`src/core/lex`](./src/core/lex/index.ts) |
| Parse | Builds the abstract syntax tree (AST). It recovers around malformed statements so an editor can still work with a partially typed file. | [`src/core/parse`](./src/core/parse/index.ts) |
| Check | Resolves names, checks types and calls, determines storage and tracks when a value becomes available. `CheckedScript` keeps those answers beside the original tree. | [`src/core/check`](./src/core/check/index.ts) |
| Emit | Allocates registers and persistent state, lowers statements into instructions, links calls and requests, and checks stack depths and limits. | [`src/core/emit`](./src/core/emit/emit.ts) |

The result is a [`CompiledProgram`](./src/core/emit/program.ts), not executable
code in the host's language. Alongside its instructions it carries the constants,
inputs, output declarations, storage layout and source mapping the engine needs.
Its [canonical encoding](./src/core/emit/canonical.ts) makes the program portable
and gives it stable bytes for hashing. The language and compiled format have
separate versions, defined by the [compiled program specification](./spec/compiled-program.md).

Every compiler stage reports through the same diagnostic system. Codes, messages
and fixes come from the [error catalogue](./spec/errors.json); the
[headless editor](./src/editor/index.ts) reuses the compiler and its language
tables for highlighting, completion, diagnostics, hover, signatures and formatting.

### From a compiled program to results

Before the first bar, [`load`](./src/core/engine/load.ts) verifies the program's
format, capabilities, tables and instructions, including stack and address
bounds. It checks the host's limits, resolves inputs and plans requested series.
A rejected program returns a diagnostic before execution starts.

The [engine](./src/core/engine/engine.ts) then advances one bar at a time. Its
[interpreter](./src/core/engine/machine.ts) walks the instruction list using
registers, persistent memory and the standard library, with instruction, memory
and time budgets. Updating the newest bar restores its checkpoint before
recomputing it; explicitly live state is retained. Drawing values are published
on updates, while signals, alerts and orders follow the confirmation policy.

The [chart adapter](./src/adapters/charts/index.ts) maps study outputs into the
host's chart. The [backtest driver](./src/core/backtest/drive.ts) supplies a
simulated order destination and records frames, fills, orders and the report.
[Replay and rerun](./src/core/backtest/replay.ts) let a stored result be checked
again. The host owns data access, rendering, persistence and order routing;
the language core does not reach into those systems itself.

## The pieces, and which way they point

A platform adopting OpenScript usually already has a chart, or an editor, or a
broker connection, and sometimes all three. So the pieces are separate packages
and the dependencies only ever point one way.

```
   openalgo-script            a chart library
   (knows nobody)             (knows nobody)
        |      \              /
        |       \            /
        |   .../adapters/charts       <- knows both. The only place that does
        |
   .../editor                         <- the six headless functions. No DOM, no
        |                                 package, nothing on screen
        |
   .../adapters/codemirror            <- knows both. Takes its markup from the
                                         host, so it draws nothing either
```

The language ships as one package with an entry point per tier, so a consumer who
wants only the compiler never pays for an adapter. A tier is declared only once it
exists: an entry point that resolves to nothing fails at a consumer's run time
rather than honestly at install.

These four resolve today, from an install holding nothing but the manifest and the
built output. That is a check rather than a sentence: `scripts/check-entry-points.mjs`
builds exactly that install in a temporary directory, with no package of any kind
beside it, and imports every one of them.

| Entry point | Is | Depends on |
|---|---|---|
| `openalgo-script` | Compiler and engine | Nothing |
| `openalgo-script/editor` | The six headless language functions an editor needs | The compiler |
| `openalgo-script/adapters/charts` | Turns a compiled study into a chart's indicator descriptor | The compiler and a chart |
| `openalgo-script/adapters/codemirror` | Wires the six into a text component | The editor half and a text component |

The server-side engine is not among them: it is a separate package in another
language, and the roadmap says which phase owes it.

An adapter is the only thing allowed to know two worlds at once, which is what
makes it the piece a platform replaces rather than the piece they patch. A
platform with its own chart writes their own chart adapter and keeps everything
else. A platform with its own editor does the same on that side.

This is enforced rather than promised. `scripts/check-layering.mjs` runs in
continuous integration and fails the build if the compiler imports a chart, if
anything outside an adapter imports a package, or if anything under `src` so much
as mentions a browser global. That last one holds of the adapters too: the editor
adapter takes a tooltip's markup from the host rather than building an element,
so every file in the package loads in a worker and on a server.

## Taking it, one step at a time

Each row is usable on its own. Nobody has to take the next one.

| You want | You add | Roughly |
|---|---|---|
| Scripts that produce numbers | `openalgo-script`, and the six-item host interface | An afternoon |
| Those studies on your chart | the charts adapter, plus a chart | Days. Free if the chart is the one this adapter already targets |
| Traders authoring in your app | The editor half, and your own text component or the drop-in adapter | Days |
| Traders trading from it | Wire the order half of the host interface to your order API | About a week |
| To run it on your own stack | Implement the compiled program format in your language, then pass the conformance suite | Weeks |

The last row is the one that matters for the standard. A platform that will not
run our code at all reads the compiled program specification, writes its own
engine, passes the suite, and its traders' scripts are the same scripts as
everyone else's.

## What is guaranteed, and what proves it

A platform's engineering review asks two questions about a dependency: what do you
promise, and how would I know. This table is the answer to the second one. Where a
row says a check enforces something, that check runs in continuous integration and
fails the build.

| Guarantee | How you can tell | Today |
|---|---|---|
| The package cannot build code out of text: every door to a generator is a module, and it imports none of them | `scripts/check-layering.mjs`. Nothing under `src` may import a module from the runtime's own namespace, at either spelling, and no load may have a specifier that is not written down. So there is no virtual machine, no worker and no child process in the graph to reach. Unreachable by construction, not unmatched by a pattern | Enforced |
| The two names that need no import, the string evaluator and the function builder, are refused | A runtime switch you set on your own process, `--disallow-code-generation-from-strings`. Our own suite runs under it. It refuses those two names and closes no other door: see [`docs/integrating/running-the-engine.md`](./docs/integrating/running-the-engine.md) for what it does not cover and what is yours to do | Yours to turn on |
| No generator anywhere in this repository's own text | `scripts/check-no-eval.mjs`, over the source, both built outputs, the tooling, the hooks and the build steps, attacking itself with every form it knows before it reads a file. **It is a lint, not a proof.** It has now been got past five times, the last by a constructor reached through a key assembled at run time, and a list of spellings only ever has to be beaten once more. Treat a pass as evidence that no known form is present | **Lint** |
| A generator that runs is refused | The suite runs under the setting that refuses to compile text, so a builder throws the moment its path executes, however it was spelled. This caught the form the scan missed. What it cannot cover: a line no test reaches, and the module doors above, which is why the row above it matters more than this one | Enforced, for code the tests execute |
| Zero runtime dependencies | `dependencies` is empty and stays empty | Enforced |
| The pieces are separable: take the language without the chart, or the chart without the language | `scripts/check-layering.mjs`. The core may not import a package or touch a browser global | Enforced |
| Small modules with a stated surface | `scripts/check-modularity.mjs`. A module's index is its only door | Enforced |
| Every error is documented, with a code, a cause and a fix | `scripts/check-error-codes.mjs` reads every file in the tree, and the code type is generated from the catalogue so an invented code will not compile. `scripts/check-catalogue-tests.mjs` compares the catalogue a reader opens with the file the compiler is generated from, string for string, so the two cannot say different things | Enforced |
| No fact is stated in two places | `scripts/check-duplication.mjs` | Enforced, with recorded debt |
| The compiled program is implementable without reading our code | `spec/compiled-program.md` and `spec/host-interface.md`. Every engine test drives a host built from those pages rather than one we wrote | Written, and used |
| Two engines agree to the last decimal | The conformance suite, run against both. A disagreement blocks a release | Phase 6 gate |
| A runaway script stops | Instruction, memory and wall clock budgets, counters in the loop the engine owns. `tests/engine/budget.test.ts` | Enforced |
| A failing script does not take anything else down | One script's failure is a diagnostic on that script and reaches nothing else | Enforced |
| Every entry point in the export map resolves from a real install | `scripts/check-entry-points.mjs`. Each one is imported from a temporary install built from the `files` list alone, with no package beside it, which is also what says both adapters' peer dependencies are optional in fact and not only in the manifest | Enforced |
| A completion, a tooltip and a default come from the compiler, not from a list | The names are the standard library manifest the checker resolves against; what a call is for is the cell `spec/stdlib.md` prints, read at build time by `scripts/generate-library-prose.mjs`; a default is the one `scripts/check-defaults.mjs` holds the compiler to. `tests/editor/hover.test.ts` fails if the manifest and the specification describe different sets of names | Enforced |
| Laying a script out again cannot change what it computes | `tests/editor/format.test.ts`. Every example and every gate script is formatted, both texts are compiled, and the compiled programs are compared. Each call also checks itself against the lexer, so a rule that is wrong returns your source untouched rather than a changed program | Enforced |
| A saved script never stops working | The language version is declared per file and old front ends are retained | Phase 7, with a test per retained version |
| Performance | Eight benchmarks with recorded budgets, run by `npm test` and in continuous integration. A regression past a budget fails the build | Enforced |

The rows marked as gates are not promises we intend to keep. They are conditions a
phase does not finish without, and each one is written into the roadmap beside the
phase that owes it.

### Why a script cannot reach anything

This is the row a security review spends its time on, so it is worth stating
plainly rather than leaving as a property of the architecture.

A compiled program is **data**. It is a list of instructions the engine walks. A
script has no way to name a function the instruction set does not expose, so there
is no call into the host, no network, no filesystem, no access to the object graph
of the process it runs in. There is nothing to escape from, because nothing was
ever handed over.

That also makes the budgets real rather than best-effort. The engine owns the
loop, so an instruction count per bar, a memory ceiling and a wall clock are
counters in that loop rather than something to hope about. A platform running many
customers' scripts in one process needs exactly this, and a design that generates
code and runs it cannot offer it.

## The host interface

Whatever a platform takes, it supplies six things and nothing more:

1. Bars: open, high, low, close, volume, time.
2. Instrument facts: tick size, lot size, session, timezone.
3. More bars on request, for another instrument or another timeframe.
4. Somewhere to draw.
5. Somewhere to send orders, if scripts are allowed to trade.
6. Somewhere to save settings.

No instrument naming scheme, no exchange rules and no broker concepts appear in
the language. A symbol is opaque to it: a script names a contract by what the
contract is, and the platform resolves that to whatever its own symbology calls
it. A format built around one market's derivatives means nothing on a crypto
exchange, and portability is the entire objective.

## Errors

Every error has a stable code, a message, the cause, the fix and an example,
held in one machine-readable catalogue. The compiler, the editor and the
documentation all read that same file, so the documentation cannot drift from
the compiler. The build fails if an error exists without a documented entry, or
an entry without a test.

## Documentation

- [ROADMAP.md](./ROADMAP.md) - what is being built, in what order
- [docs/](./docs) - guides, once there is something to guide
- [spec/](./spec) - the language specification and the compiled program schema
- [CONTRIBUTING.md](./CONTRIBUTING.md) - how to work on this
- [RELEASING.md](./RELEASING.md) - how a release is published, and the one manual step that cannot be automated

## Licence

Apache-2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

Apache-2.0 was chosen deliberately over a copyleft licence. A trading platform
that wants to embed OpenScript must be able to do so without publishing its own
source, or the language cannot become a shared standard.

## A note on independence

OpenScript is an independent open source language. It is not affiliated with,
sponsored by, or endorsed by any charting or trading platform, and it is not a
reimplementation of any existing product. Its specification, its documentation
and its error text are original work.
