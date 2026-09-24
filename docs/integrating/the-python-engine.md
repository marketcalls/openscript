# The engine in the other language

For anyone who has to run a compiled program somewhere a JavaScript runtime is
not, and for anyone working on the engine that does it.

By the end of this page you will know what is in `engine/`, what a host needs in
order to run it, how to run its tests and its checks, how the build holds it to
the other engine, and what refuses a piece of Python that would quietly break
the two promises the whole design rests on.

---

## Why there is a second engine at all

A production container can be Python only. Not "prefers Python": the front end
is built in a stage that is thrown away, and nothing that speaks another
language survives into the image. A server-side sidecar in a second language is
not a worse option there, it is not an option.

That constraint is what makes the compiled program's shape load bearing rather
than tidy. The program is **data**, so an engine for it can be written in
whatever language the infrastructure already speaks, and this directory is the
first proof of that claim rather than an argument for it.
[`integrating/your-own-engine.md`](./your-own-engine.md) is the same route for
somebody outside this repository, and everything it says applies here.

## What is in engine/

```
engine/
  pyproject.toml     the distribution: its name, the version, and an empty
                     dependency list
  adapter.mjs        the file the suite's runner starts, which starts the
                     adapter below and relays what it writes
  openscript/        the package, importable as one name
    __init__.py      the door
    __main__.py      the conformance adapter's command line
    *.py             the machine: the program read as data, the instructions,
                     the memory regions, the values, the bars, the inputs, the
                     verification before the first bar and the encoding
    library/         the functions of the library, both halves
    strategy/        orders, frames, fills and the ledger
    accounting/      what a run made, what it cost and what that is worth
    adapter/         what it answers: a case read, run and compared
  tests/             the engine's own tests
  tools/             programs about the engine rather than part of it
```

The project file is here rather than at the repository root on purpose. The root
belongs to the JavaScript package, and a second project file beside it would
leave two answers to the question of what an install of this directory ships.
Under `engine/` there is one answer.

`__init__.py` says what is where. What is not there is absent rather than
stubbed, which is the rule this package was started under and still keeps: a
stub that answers an invocation with a shape somebody starts depending on is
worse than nothing.

What is written runs a strategy end to end: the machine, both halves of the
library, the order ledger, the money, and the adapter that joins them over a
case, and the part of the chart surface a script holds rather than emits: its
drawing objects and its grids. It executes reads as well: a read of the chart's
own instrument at a coarser interval is folded from the bars a run is handed, in
each of the three modes, and a read of another instrument is folded from the
bars a host's provider answers with, which is the one way a run serves the
`req.symbol` tag. Its library is the first engine's, entry for entry, which
`scripts/check-manifests.mjs` measures on every build. What it does not have is
the rest of the surface, markers, fills, levels and paint, and a case asserting
one of those is answered `unsupported` naming the channel.
[`running-the-suite.md`](./running-the-suite.md) has the whole list.

## What a host needs

An interpreter, at the version `pyproject.toml` requires, and nothing else.

There is no install step for the tests and no package to fetch from an index.
The engine imports the standard library and nothing outside it, so a clone runs
as it stands:

```
python engine/tools/run_tests.py
```

A host that wants the package on the import path can install it from the
Python package index, where it is published as `openscript`, install this
directory with its own tooling, or put the directory on the path and import
it. No console
script is declared, and the reason is worth a sentence rather than a footnote:
there is no single command to declare, because this engine is driven two ways
and which one a host wants depends on what it is doing.

### The conformance adapter, which is the batch one

Three invocations. The two that name a case directory read it, run it and answer
it, and each is handed the compiled program on standard input. `--describe` is
the capability probe: it is handed no program, reads no standard input, and
answers what this engine claims.

```
python -m openscript --describe
python -m openscript <case-directory>
python -m openscript --actual <case-directory>
```

They answer the same from an installed copy as from this directory: an
installed engine reads its name and version from the record its installer
wrote, since the distribution file is not installed with it.

Those three invocations are the whole of the command line, and they are
`spec/conformance.md` section 9's rather than this engine's.
[`running-the-suite.md`](./running-the-suite.md) is how they are driven, what
they claim and what they report unsupported.

### The host surface, which is not a command line at all

`engine/openscript/run.py` is the other way in: a program loaded once, and bars
pushed at it one at a time. `load_text` takes the canonical text a host stored,
`Run.execute_bar` is one execution of one bar, `Run.checkpoint` and `Run.restore`
are the rollback a re-executed bar rests on, exposed for a host that has to
replay one itself, and the order calls a decided bar left behind come back on the
result for the host to send.

A program that reads another interval or instrument needs two more things at
load: the instrument record, which its reads are planned against (the interval
they are compared with, the zone a day is dated in), and, for a read of another
instrument, a provider that answers each read with bars, a refusal or a wait.
`load_text` takes both, and a run handed no provider refuses such a program at
load naming `req.symbol`. `Run.history` hands a run over a history the whole
dataset before bar 0, which is what a `"lookahead"` read reads; a live runner
does not call it.

That is what a live runner and a server-side backtest use, and neither of them
has a case directory to hand.
[`running-a-strategy.md`](./running-a-strategy.md) is the whole of it: every
argument, what comes back, and the one thing a live host gets wrong.

### What both of them are handed

**A compiled program, and never a script.** There is no compiler in this
directory and there is not meant to be one. The program arrives as the canonical
text a host sends, so the check that the text is the encoding a recorded hash was
taken over runs on every case rather than being skipped by handing the engine an
object it built itself. A host that builds the program object in the same process
it compiled in has nothing to be canonical about and says so by calling `load`
instead.

The version the distribution carries is the version the package manifest
carries. They are one fact written in two files, because a build backend cannot
read the other one, and `scripts/check-python.mjs` fails the build the day they
disagree rather than leaving a release to discover it.

## Running it from the gate

`npm test` runs both engines. The Python half is one step:

```
npm run check:python
```

That step finds an interpreter, refuses one older than the distribution
requires, reads every import in the tree, and then runs the tests under the same
interpreter it just measured. A missing interpreter fails it. That is
deliberate: a suite that quietly checks one engine is how two engines drift
apart.

The other half of the gate is the two engines compared with each other:

```
npm run suite:agree
```

`npm test` runs it, so a case where the two disagree by one bit fails the build
with the case, the channel and the first differing value named. That is the
phase's own gate rather than a report anybody has to read, and
[`running-the-suite.md`](./running-the-suite.md) says what it does and does not
reach.

The test runner is the standard library's, with one thing added. A discovery
that found nothing exits zero and prints a passing line, and that failure has
been paid for four times on the other side of this tree, so the count is a
result rather than a line of output: a run that discovered no tests, or ran
fewer than it discovered, is refused.

Nothing a run does writes into the tree. Bytecode caching is turned off before
the first test module is imported, so no cache directory is left behind for the
next check to meet.

## What refuses bad Python

Two checks, and the division between them is the same one the JavaScript side
has had from the start.

**`scripts/check-python.mjs` is about the package a host installs.** Every
import in every Python file is read and compared against the module names the
running interpreter says are its own, so an empty dependency list is a measured
fact rather than a claim about a file. Inside the package a handful of the
interpreter's own modules are refused as well, each with the sentence that
refuses it: the network, threads, randomness and the locale are all ways for two
runs of the same program to differ, and two engines that differ are what this
whole effort exists to prevent.

**`scripts/check-no-eval.mjs` is about every Python file here, shipped or not.**
It reads each one with a masker that removes comments, replaces string literals
with a marker, reads a formatted string's substitutions as code, and normalises
every identifier the way the interpreter normalises it. Then it refuses the
string evaluator, the statement executor, the compiler underneath them, the
import machinery driven by hand, objects loaded out of bytes, function and code
objects built at run time, the namespace the built-in names live in, a namespace
taken as a dictionary, a process, and the modules whose whole purpose is running
text handed to them.

`ast.literal_eval` is safe and is allowed. It reads one literal, builds the
value it denotes, and runs nothing.

Both checks attack themselves before they read a file. Every form in
`scripts/lib/no-eval-python-attacks.mjs` goes through the rules first, every
ordinary line beside it has to be left alone, and every rule has to be the
reason some form is caught: a pattern that can never match looks exactly like a
pattern that works, and this repository has shipped one of those before.

The identifier normalisation is worth one more sentence, because it is the piece
with no counterpart on the other side. An interpreter normalises every
identifier before it resolves it, so a name written in mathematical letters or
in fullwidth letters is a different sequence of characters, the same name to the
interpreter, and invisible to any pattern written against plain letters. Three
such spellings are in the corpus, and each was run under an interpreter before
it was written down.

**What neither check covers**, said plainly so the claim is not read wider than
it is: a scan reads text, and a watched name can be spelled in ways nobody has
thought of yet. What is enforced rather than scanned is narrower and stronger,
and it is the dependency rule above: a module that is not imported is not
reachable, whatever it was spelled.

## Where the numbers come from

The engine is not measured against the other engine's source. It is measured
against the documents and against the vectors:
[`spec/compiled-program.md`](../../spec/compiled-program.md) for the machine,
[`spec/stdlib.md`](../../spec/stdlib.md) for the library and for the order every
accumulation is performed in, and
[`integrating/library-vectors.md`](./library-vectors.md) for the bit patterns a
function has to reproduce, including how to decode one in this language.

Two consequences worth carrying around.

**Order is the whole game.** The specification fixes the order of every
accumulation because binary64 addition is not associative, so the order decides
the last bit. The convenient way to add a column of numbers is not the specified
order, and neither is the accurate one.

**Some calls are not compared at all.** `stdlib.md` section 20.11 records the
gap where no portable reference algorithm exists, and `conformance.md` section 8
scopes it out of every profile. Those calls use the interpreter's own maths
module here, and no case may assert a value that reaches one.

## What is independent here, and what is not

The arithmetic is held to the vectors and the behaviour to the pages. The module
layout is not independent at all: it falls one to one with the first engine's,
`strategy/` beside that engine's order ledger and `accounting/` beside its money
layer, because two engines that divide one behaviour the same way are cheap to
read against each other on the day they disagree, and a disagreement is the
moment either of them is worth having.

What follows is worth writing down rather than leaving for a reader to work out.
The two engines agreeing to the last bit says that this one computes what that
one computes, which is the claim the gate makes and the claim a host needs. It
does not say that the pages on their own were enough to build an engine from. A
page with a hole in it can be read the same wrong way twice by somebody who has
the other engine open beside them, and the suite cannot tell that apart from two
readings that agree because the page is complete. What can tell them apart is
somebody implementing from the pages with nothing else to hand, which is
[`integrating/your-own-engine.md`](./your-own-engine.md), and that has not
happened yet.
