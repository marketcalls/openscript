# Working on OpenScript

Conventions for anyone, human or agent, changing this repository.

---

## The rules that are not negotiable

Twenty seven checks enforce these, twenty six `check-*` scripts and the harvest
run with `--check`, and each one of them is a rule somebody broke once.
`npm test` runs all of them, and so does every pull request. The count is here
to be corrected when it changes, not to be trusted: `package.json`'s `test`
script is the list.

1. **No `eval`, no `Function` constructor, no dynamic code construction.** The
   compiler emits data. This is what lets the language run inside an application
   with a strict content security policy, and it is the reason a platform can run
   many customers' scripts in one process. It is not a preference.
2. **Zero runtime dependencies.** `dependencies` is empty and stays empty. Every
   dependency is something an adopting platform has to accept.
3. **Layering.** A module is a directory and its index is its only door. Nothing
   under `src/core` may import a package or touch a browser global. An adapter is
   the only place allowed to know two worlds at once.
4. **No code file over 500 lines**, wherever it sits: source, tooling or test. A
   file past it is usually two things that were never separated. A document is
   prose and is not counted. One already over it is recorded in
   `spec/modularity-exceptions.json` with the length it was recorded at, which is
   a ceiling it cannot grow past and a row that has to go the moment it is
   earned out.
5. **Name nobody.** No outside product, platform, company, trademark, market index
   or real instrument, anywhere: not in source, comments, documentation, examples,
   test names or commit messages. Describe prior art generically. Examples use
   placeholder symbols.

   **What the check covers is narrower than the rule, and a green build is not
   proof of the rule.** `scripts/check-names.mjs` reads every file in the tree
   against a fixed list: about eighteen products and platforms, and thirteen
   indices and instruments, each stored encoded so that the checker is not the
   one file breaking the rule it enforces. A name on that list is caught
   anywhere, in any file; a name that is not on it passes, and so does every
   name nobody has thought of yet. The list also leaves out, on purpose,
   identifiers that are ordinary English words, because a build that fails on a
   sentence costs more than the leak it would catch.

   So the mechanical half is "these names, everywhere", and the rest is
   attention: a reviewer reading a new comment, a new example symbol or a new
   commit message. That is the whole of what can be mechanised here, and it is
   written down rather than implied, because this repository's own standard is
   that a check overstating its reach is worse than a small one stated
   truthfully. A name that does get through is added to the list in the same
   change that removes it, so the list grows by the cases attention missed.
6. **No fact stated twice.** A value set written out in two files is a fact you
   would have to edit two places to change, and every copy reads as authoritative.

Plain text everywhere: no emoji, and no em dashes or en dashes. Use a comma, a
colon, parentheses or a full stop.

## Diagnostics

Every error carries a catalogue code. Never throw a bare string.

**The message says what is wrong and the fix says what to do, and both must be
true of the actual program.** A fix that would change the meaning of the code is
worse than no fix, because a reader trusts it. An error that cannot suggest a
concrete fix is a badly designed error; redesign the error.

Error codes and their text live in `spec/errors.json` and are generated into the
compiler. Nothing under `src/` retypes a message.

**A documented refusal is a refusal something raises.** A code in the catalogue
is raised by some code path, or the entry carries a `deferred` sentence saying
what happens instead today and what has to exist first. There is no third case:
a code taught as current behaviour that nothing can produce is a promise nothing
keeps, and `scripts/check-raises.mjs` fails the build on one. The deferral goes
in the catalogue, never in the checker, because a list of exemptions inside a
check is read by nobody and grows by a line whenever somebody is in a hurry.

**A worked example is compiled, and its mistake raises its own code.** Every
entry's `after` block goes through the compiler, because it is the fix a reader
is handed at the moment they are stuck and they will paste it; every `before`
block is compiled, and run where the code needs a bar, and has to raise the code
it is filed under. `scripts/check-examples-compile.mjs` does both, and what it
cannot reach it says and counts rather than skipping. The three states it
accepts are fields on the entry, beside `deferred` and for the same reason: an
`unexercised` sentence for a code no example can reach, and an example `kind` of
`transcript` for the entries whose example is the host's input rather than
source.

**A fix sentence is held to the language this release has.** The blocks are
compiled and the sentence beside them is what a reader acts on, so every call a
`fix` names is put to the compiler one at a time: a name the language does not
have, or one marked planned, fails the build unless the entry itself carries a
`deferred` sentence. And a fix that writes a call out with a reader's own values
in it, a string literal or a named argument, has to show one of its calls in its
own after block, because the block is the only part of an entry a compiler sees.
Both rules are narrow and `scripts/lib/fix-sentence.mjs` says which cases they
do not reach, because a check that overstates its reach is worse than one that
states a small reach truthfully.

**A test an entry points at is a test that exists.** The `test` field names a
file under `tests/` that writes the code, or `null` saying in the open that
nothing tests it. `scripts/check-catalogue-tests.mjs` resolves every pointer,
fails a `null` the day a test does name the code, and prints the codes nothing
exercises every run.

**And the page says what the file says.** `spec/errors.md` is the catalogue a
reader is sent to and `spec/errors.json` is what the compiler is generated from,
so the two are compared character for character: every heading, first line,
message, placeholder gloss, cause, fix, deferral and example block, then each
whole section against the text the documentation site renders from its entry,
and the two tables outside part 8 that are copies of the file as well. Until
that was enforced, one word of a message could differ between them and the
whole build passed. `scripts/lib/catalogue-page.mjs` holds the comparison and
says which parts of the page it does not reach.

## Tests

Assert the **code and the span**, not the message text. Wording is allowed to
improve; a code is a promise.

A test that cannot fail is documentation with a green tick on it. Before adding
one, write down the wrong implementation it is supposed to catch and check that it
would actually fail.

**A figure the specification prints is measured by a test, not quoted by one.**
`stdlib.md` section 20 prints a count beside every arrangement it refuses, and
five sentences there have had to be withdrawn or corrected because their figures
were measured once and by nobody since. `tests/stdlib/section-20.ts` reads a
figure out of the page by pattern so the document is the input, and
`scripts/check-section-20.mjs` fails the build on a count in that section which
no test reads back. What the check cannot do, and says so, is decide whether the
sentence beside the figure constrains anything: that stays attention, and 20.1
says why.

## The second engine, in Python

`engine/` holds it: the package `openscript`, its tests beside it, and the tools
that run them. Every rule above applies there, in that language's spellings.

**Nothing builds code out of text.** The string evaluator, the statement
executor, the compiler, the import machinery driven by hand, objects loaded out
of bytes, a function object built at run time, the namespace of the built-in
names, a namespace taken as a dictionary, a process, and the modules whose
purpose is running text handed to them. `ast.literal_eval` is safe and is
allowed: it reads one literal and runs nothing. `scripts/check-no-eval.mjs`
reads every Python file here for those forms, with rules and a corpus of its
own.

**Zero dependencies means the standard library**, and not the parts of it that
make a run stop being reproducible. `scripts/check-python.mjs` reads every
import against the module names the running interpreter says are its own, so the
empty dependency list is measured rather than promised.

`npm test` runs both engines and fails when no interpreter is there.
`docs/integrating/the-python-engine.md` is the page, including how a host
installs it and how to run the tests on their own.

## Every release

In this order. The changelog check and the release workflow enforce the parts that
can be enforced.

1. **Update `CHANGELOG.md`** with an entry for the new version, written for
   somebody deciding whether to upgrade. A consumer reads the changelog at the one
   moment it matters to them. "Various fixes" answers nothing, and a version with
   no entry tells them to diff two tags, which they will not do: they will simply
   not upgrade. `scripts/check-changelog.mjs` fails the release on a missing or
   empty entry.
2. **Update the documentation that the change makes wrong.** A language change
   almost always touches `docs/`, and the specification wins every disagreement
   between the two. If a behaviour changed, the page that teaches it changed too.
3. **Update the specification** if the change is to the language rather than to
   the implementation. The specification is written first and the implementation
   follows it, not the other way round.
4. **Update `README.md`** if the change alters what the package does today. The
   registry page is the first thing a stranger sees, and it must not overstate.
5. Bump the version in `package.json`.
6. `npm test`.
7. Commit, tag `vX.Y.Z`, push the tag.
8. Dispatch both release workflows manually with that tag: `Release` for the
   npm package and `Release to PyPI` for the Python engine. They carry one
   version and ship as one release.

A tag push publishes nothing by itself. A tag is cheap to create by accident and
publishing is not reversible, so the two are kept separate.

`RELEASING.md` has the detail, including the one manual step that cannot be
automated.

## Two version numbers, not one

The **package version** and the **compiled program format version** are separate
and move at different speeds.

Somebody implementing the compiled program in another language targets the format.
The package can reach 2.0 for an API change while the format stays at 1 and their
engine keeps working. What must never happen is the format version drifting
between the specification they implemented from and the compiler that emits it.
The release refuses to publish if it has.

## What the first host can and cannot change

The language stays neutral and its specification names no platform. These are
constraints on the **integration work**, not on the language, and they are here
because breaking one of them is expensive in a way that is not obvious from
inside this repository.

**The deployment's nginx configuration is fixed.** It is in production for a large
user base, and changing it means every hosted upgrade carries a config migration
that can take people offline. So the integration adds no location block, no port
and no directive. This is achievable because `location /` already proxies
everything to the application, and only the websocket and socket paths have
blocks of their own. Every route and asset is already routed.

Three limits that block sets, which decide the shape of the work:

- **Five minute request timeout.** Anything longer is a job that returns an id,
  not a request that returns a result. A backtest over years of minute bars would
  be killed partway through, and the user would see a gateway error with a run
  still executing behind it.
- **One megabyte request body** on the smallest deployment, where the limit is
  left at the default. Scripts and compiled programs are kilobytes and fine.
  Nothing that grows with history may travel in a body.
- **Responses are buffered** on the main path. A progress stream there arrives in
  one lump at the end. Progress rides the socket channel that is already open and
  already unbuffered.

**The production container has no runtime for JavaScript.** It is Python only: the
frontend is built in a discarded stage. A server-side sidecar in any other
language is not a worse option, it is not an option. This is why the second engine
is Python, and why the compiled program being plain data rather than generated
code is load bearing rather than tidy.

**A worker must be a served file, not a blob.** The content security policy allows
scripts from the application's own origin and nothing else, so a worker built from
a blob URL is refused. Same conclusion as the no-eval rule, reached from a
different direction.

**Nothing may assume an origin.** The application is served from a local port, a
domain, a subdomain and a container, and people move between them with a script
written for that purpose. Every URL is relative or comes from configuration. An
absolute URL baked into a bundle works perfectly for whoever wrote it and breaks
every hosted install.

**A trader's files live on a mounted volume**, never inside the image, so they
survive a container rebuild.

**Nothing new is started, and nothing computes in the request process.** The
integration adds routes and services to an application that already runs, so the
existing start command brings up everything. But that application is a single
cooperatively scheduled worker, where ordinary threads and thread pools are green
rather than real, so anything that occupies the worker stops it for every user
until it returns. A backtest over fifty thousand bars is pure computation with no
yield points: it runs in a subprocess, the route returns an id, and progress goes
over the socket that is already open. The development server uses real threading,
so this exact mistake works perfectly on a developer's machine and only fails in
production.

The rule underneath all of these: **the smallest deployment sets the budget.** A
limit that is generous on one install and default on another is the default one.

## The standing bar

Everything here has to clear two questions, not one: is it correct, and can a
platform that did not build it run production on it. The second is written into
each phase's gate in `ROADMAP.md`.

**Prefer a check to a promise.** A promise in a document is worth exactly as much
as the attention of whoever reads it next. When something has gone wrong twice,
the answer is a script that refuses it, not a firmer intention.
