# OpenScript error catalogue

Version of this document: draft, tracking language version 1.

This is the authoritative list of every diagnostic OpenScript can emit. The
language specification quotes codes from here; where the two disagree, this
document wins and `language.md` is wrong.

The catalogue exists as one machine-readable file, `errors.json`, with three
consumers that must never drift apart:

1. **The compiler and the engines** emit a code, a line, a column and the values
   that fill the message. They never emit a bare string.
2. **The editor** reads the message and the fix and puts them on the exact
   character, and applies the fix directly where the entry says it can.
3. **The documentation site** generates one page per code from the same file.

This document is the human face of that file. Each per-code section in part 8
is the text the documentation site renders from that code's entry and prints on
the code's own page, and the build compares every section with that rendering
character for character, so the two cannot disagree. The parts before it are the
design that `errors.json` implements.

## Contents

1. [The shape of errors.json](#1-the-shape-of-errorsjson)
2. [What a diagnostic carries](#2-what-a-diagnostic-carries)
3. [The two rules every entry obeys](#3-the-two-rules-every-entry-obeys)
4. [The ranges](#4-the-ranges)
5. [What the build enforces](#5-what-the-build-enforces)
6. [Codes that refine or reassign a code quoted elsewhere](#6-codes-that-refine-or-reassign-a-code-quoted-elsewhere)
7. [Substitutions for OS1001](#7-substitutions-for-os1001)
8. [The catalogue](#8-the-catalogue)

---

## 1. The shape of errors.json

The file is one object. Everything above `entries` is a small amount of context a
consumer needs in order to read the entries at all; `entries` is the catalogue.

| Field | Type | Holds |
|---|---|---|
| `catalogue` | string | Always `openscript-errors`, so a file can be identified by content |
| `schemaVersion` | number | The shape of this file. A new field is not a bump; a changed or removed field is |
| `languageVersion` | number | The language version this catalogue describes |
| `placeholderSyntax` | string | Always `{name}`. Stated so a consumer does not infer it from examples |
| `severities` | object | Each severity and what it does to the run |
| `stages` | object | Each stage and where in the pipeline it sits |
| `stageLabels` | object | The word each stage is printed as in part 8 |
| `ranges` | array | One per thousand block: prefix, kind, what it covers, its severity |
| `entries` | array | The catalogue, ascending by code |

An entry:

| Field | Type | Holds |
|---|---|---|
| `code` | string | `OSNxxx`. Stable for ever: a code is never reused and never renumbered |
| `title` | string | Two to six words, sentence case, no full stop. The heading and the editor's list entry |
| `message` | string | The template the reader sees, with `{name}` placeholders |
| `placeholders` | object | Every placeholder in `message` and `fix`, mapped to what the compiler puts there |
| `cause` | string | What the compiler or the engine saw, and why the rule exists |
| `fix` | string | What to do, in the imperative. Never a restatement of the message |
| `severity` | string | `error` or `warning` |
| `stage` | string | `lex`, `parse`, `check`, `runtime`, `host` or `import` |
| `since` | number | The language version the code first appeared in |
| `autofix` | boolean | Whether an editor can apply the fix without asking a question |
| `example` | object | `before`, the shortest script that raises it, and `after`, the same script fixed. `kind` is `transcript` on the entries whose example is the host's input rather than a script, and `import` on the importer's entries, whose before block is a script in another chart language |
| `spec` | string | The specification sections that define the rule |
| `refines` | string or null | The broader code this one takes a case from, if any |
| `test` | string or null | A file under `tests/` that writes this code, or `null` saying that no test in this repository names it |
| `deferred` | string, or absent | Present only while no code path raises the code: what happens instead today, and what has to exist before it is raised |
| `unexercised` | string, or absent | Present only where the code is raised and no example can reach it: what it needs that an example cannot carry |

A complete entry, as it appears in the file:

```json
{
  "code": "OS1006",
  "title": "Assignment used as a condition",
  "severity": "error",
  "stage": "parse",
  "since": 1,
  "message": "= assigns a value, and a condition needs a comparison.",
  "placeholders": {},
  "cause": "Assignment is a statement and never an expression, so the classic typo cannot compile into a condition that is always true.",
  "fix": "Write == to compare, or move the assignment to its own line above the if.",
  "autofix": true,
  "example": {
    "before": "if len = 14\n    signal(\"DEFAULT\")",
    "after": "if len == 14\n    signal(\"DEFAULT\")"
  },
  "spec": "language.md 10.1",
  "refines": null,
  "test": "tests/examples/rejected/OS1006.oscript"
}
```

Four decisions in that shape are worth stating, because each could have gone the
other way.

**The message is a template, and the values are not in the catalogue.** The
compiler supplies a line, a column and the values; the catalogue supplies the
words. The alternative, letting the compiler build whole strings, is what allows
a message in the product to drift from the message in the documentation, and
drift is the one thing this file exists to prevent.

**Every placeholder is declared.** A placeholder that appears in `message` or
`fix` and not in `placeholders` fails the build, and so does one declared and
never used. The editor therefore knows, without running anything, exactly what a
diagnostic will carry, and a translator knows what each slot means.

**The example is two scripts, not one.** A before with no after tells a reader
what is wrong and leaves them to guess the shape of right. The after is the same
script with the smallest change that compiles. Both may be fragments; where the
condition is one the host produces rather than the script, the example shows the
host input that fails and the host input that passes.

**`since` is on the entry, not derived from a changelog.** A code that appears in
language version 2 is invisible to a version 1 script, and an editor pinned to a
version needs to know which diagnostics it can be shown without consulting
anything else. Codes are never renumbered and never reused, so the field only
ever grows.

---

## 2. What a diagnostic carries

A diagnostic, as the compiler or an engine hands it over, is the code plus the
position plus the values:

```
code    OS2002
line    14
column  5
span    3
values  { name: "len", line: 1 }
```

The reader sees the message with the values filled in, a caret under the span,
and the fix underneath:

```
14 |     len = 9
   |     ^^^
OS2002: len is already declared at line 1, so a second one cannot be declared here.
Fix: rename this one, or drop the inner declaration and let the assignment update the len at line 1.
```

An error stops compilation, or stops the bar that raised it. A warning stops
nothing: it is reported on its line, and the script runs.

A runtime error stops the bar and marks the study as errored, with the message on
the chart. It does not silently skip the bar, because a gap that has no
explanation is indistinguishable from a gap the script meant.

---

## 3. The two rules every entry obeys

**One. The message tells the reader what to do.** The `fix` field names an action
on the source in front of them: a replacement, a line to move, a call to wrap, a
guard to add. If a proposed error cannot say something concrete, the error is
badly designed and the design changes, rather than the entry shipping with advice
like "check your script". Three shapes are banned outright: a fix that restates
the message, a fix that says the behaviour is undefined, and a fix that names
only the section of a document to go and read.

**Two. No entry names any product, platform or company.** Not in a title, a
message, a cause, a fix, an example, a symbol in an example or a file path. Prior
art is described generically, as "an existing chart scripting language". Example
scripts use `SYMBOL` and `EXCHANGE` as placeholder instruments. This is checked
mechanically over this file and `errors.json`, so it is not a matter of taste.

---

## 4. The ranges

A code's thousand block says what kind of thing went wrong, and it never says how
serious it is: severity is a field. The blocks are stable, and a range that fills
up is not renumbered.

| Range | Kind | Covers | Severity | Entries |
|---|---|---|---|---|
| OS1xxx | Syntax | The source text is not a program: characters, layout and grammar. | error | 29 |
| OS2xxx | Names and types | The program parses, and a name or a type does not work out. | error | 20 |
| OS3xxx | Arguments | A call or an option is wrong at the call site. | error | 26 |
| OS4xxx | Runtime | A bar produced a value the engine cannot act on. | error | 13 |
| OS5xxx | Limits | A budget was exhausted: loops, memory, size or time. | error | 10 |
| OS6xxx | Data | Bars, instruments, timeframes and the host's answers to requests. | error | 26 |
| OS7xxx | Orders | An order could not be placed as written. | error | 19 |
| OS8xxx | Warnings | The script compiles and runs, and something in it is probably not meant. | warning | 19 |
| OS9xxx | Import | A script written in another chart language could not be translated as written, or was translated with a stated difference. | error or warning | 12 |
| | | | **Total** | **174** |

Ranges OS1xxx to OS7xxx are errors. OS8xxx is warnings, and the split is by
kind rather than by severity precisely so that a reader can tell from a bare code
in a log which part of the system produced it. OS9xxx is the importer's, and it
holds both severities for the same reason: what it reports is about a script in
another chart language rather than about an OpenScript file, so the part of the
system is the whole of what a bare code needs to say. Its errors are statements
it could not translate as written and its warnings are translations whose
meaning differs in a way the message states.

Numbers within a range are assigned in the order the codes were added, not
grouped by topic. A new entry takes the next free number in its range, because
renumbering to make a range tidy would break every log, every saved report and
every link that ever quoted a code.

---

## 5. What the build enforces

Documentation drifts from code because nothing fails when it does. Three rules,
all run in continuous integration, all of which fail the build rather than
print a note.

### Rule 1. Every code the compiler can emit exists here

The compiler and every engine emit codes from one generated constant table, and
nothing anywhere constructs a code string by hand. The build extracts the set of
codes from that table, reads the set of codes from `errors.json`, and compares
them in both directions:

- A code the compiler can emit with no entry here fails the build, naming the
  code and the source position that emits it. This is the rule that stops a
  diagnostic reaching a user with no documentation behind it.
- An entry here that no code path can emit also fails the build, naming the code.
  An entry for a diagnostic that no longer exists is worse than no entry: it
  sends a reader looking for a cause that cannot occur. A code that is genuinely
  retired stays in the file with an explicit retirement, and a retired code is
  never reused.
- An entry raised somewhere other than the stage it names fails the build as
  well. "Emitted somewhere" is one step short of the question a reader is asking:
  a code raised by one call site for one case, whose entry points at a section
  describing another, is a promise nothing keeps while the check stays green. So
  the sites are counted against the stage the entry declares, which is also the
  word the reader is shown, and a code raised only elsewhere names both places
  when it fails. One of the two is wrong, and either the entry or the raise is
  corrected.

A code that no code path raises **yet** is the third state, and it says so in the
entry. `deferred` holds a sentence naming what happens instead today and what has
to exist before the code is raised, and the entry's page in part 8 repeats that
sentence under its first line, where somebody looking the code up will meet it.

The field is on the entry rather than in a list inside the checker on purpose. A
list inside a checker is read by nobody: it is invisible to the reader of the
entry, invisible to the pages that teach the code, and it grows by a line every
time somebody is in a hurry. This field is an edit to the specification that a
reviewer sees, and it expires by itself, because the build fails while a deferred
code is raised as well as while an undeferred code is not. `deferred` is also the
status such a code's rows carry in `feature-matrix.md`, and the same check
compares the three files. This half of rule 1 is `scripts/check-raises.mjs`.

The check covers the message templates too: the placeholders the emitting call
site supplies must be exactly the placeholders the entry declares. A message with
an unfilled slot is a build failure, not a run-time surprise.

**And it reads every document, not the two that define.** A deferral recorded
here, in part 8 and in the feature matrix is invisible on the page a reader
actually meets the code on, and that page goes on teaching a refusal in the
present tense. So every Markdown file in the repository is read, and a deferred
code taught as something that happens today fails the build, naming the file and
the line. The shape is narrow, because a page may reasonably name a code it does
not teach: what it may not do is describe a deferred code as current behaviour.
A mention passes when the sentence, row or item it sits in says the code is not
raised yet, or when a sentence in the same section says so and names the code,
which is where a note belongs and where a reader will meet it.

A page's note is a copy of a fact this file owns, so it expires the same way the
rest of them do. A note opens **Not raised yet.** and its first clause names the
codes it is about, and every one of those has to be a code still deferred here.
The day something raises one, the pages repeating the deferral fail the build
instead of going on telling a reader that the refusal does not happen.

### Rule 2. Every worked example compiles, and every mistake raises its own code

The `after` block is read at the one moment a reader is stuck, and it is read as
authoritative because everything around it is. They paste it. So every after
block goes through the whole front end, to the program a host is handed, and any
diagnostic fails the build: an error because the paste would be refused, a
warning because the compiler that has just told the reader what to do would then
complain about their doing it. Two warnings are the exception, and they are the
two that say the block stopped rather than that it is wrong: a name the fragment
declares and does not go on to read, and an input it does not go on to use. A
fragment always ends one line before the line that would use its last value.
Neither is excused for the entry that is about it.

The `before` block is held to the case it names. A lex, parse or check code is
settled by compiling it. A runtime code is not: it needs a bar, so the program is
loaded on a host and driven over a fixed dataset, on a venue that fills orders
and a venue that leaves them working, and the code has to appear. This is the
step rule 1 does not take. Rule 1 asks whether some call site can raise the code
at the stage the entry names; this asks whether the mistake the entry prints
raises it, which is the question a reader is actually asking when they compare
their script with the example.

Both blocks are fragments, and section 1 says so. A fragment is compiled inside
the smallest program it could be part of: a `version` line and a declaration
where it has neither, and a binding for each conventional name it reads and does
not declare. Nothing is repaired. A block that has a declaration keeps its own,
and a before block is compiled as written as well, because several entries are
about the very line a harness would helpfully supply.

Where a case cannot be reached, the entry says so and the check counts it. There
is no list of exemptions inside the checker, for the reason rule 1 gives about
deferrals: a list there is invisible to everybody who reads the catalogue.

- `deferred` already means nothing raises the code yet, so no example can.
- `unexercised` is a sentence saying what the code needs that an example cannot
  carry. A ceiling of a million elements is not an example, it is a fortnight.
  Like a deferral it expires by itself: an entry that carries one and is then
  proved fails the build.
- `example.kind` of `transcript` marks the entries whose example is the host
  input that fails and the host input that passes rather than source. A
  transcript is held to the opposite rule, so the field cannot be used to take a
  compiling example out of the check: a block declared not to be source that
  compiles fails the build.
- `example.kind` of `import` marks the importer's entries, whose before block is
  a script in another chart language. The compiler has nothing to say about
  one, so the importer proves it instead and has to raise the code; the after
  block is OpenScript and is compiled like every other. The kind is required on
  the `import` stage and refused on every other, so it cannot move an
  OpenScript example out of the compile.

And one state that is not declared anywhere, because it follows from the entry's
own `stage`: a host code is the host's answer to the engine, and the check drives
one host that answers everything the ordinary way. Those entries are compiled,
run, and counted as not proved, by name, on every run. A check that silently
skipped them would be the more comfortable design and the worthless one.

This rule is `scripts/check-examples-compile.mjs`.

### Rule 3. The test an entry points at exists and names the code

Each entry's `test` field is a file under `tests/` that writes the code, or
`null`. There is no third state: a reader is either sent somewhere or told in the
open that there is nowhere to go. Both directions fail the build. A path that
does not exist, or that exists and does not write the code, is the dead pointer
this rule was written for: for the whole life of this repository every entry
pointed at a directory that has never existed, printed beside a sentence
promising a test, and nothing read the field. A `null` on a code some test does
name fails as well, so the null expires the day somebody writes the test.

The pointer is not a claim that the test asserts the code, and the check does not
make one. It is a claim that the file exists and the code is written in it, which
is what a reader chasing the proof needs and is the whole of what can be settled
by reading. The convention that a test asserts a code and a span, and never the
message text, is what makes naming the code mean something.

The codes that no test names are printed on every run, split into the ones
nothing raises yet and the ones documented as current behaviour. The second list
is the one that matters, and it is worth more than a full column of pointers
would have been.

The same check compares part 8 with `errors.json`, character for character, for
the pointer sentence and for both example blocks. Part 8 is a copy, copies drift,
and a page printing a different example from the one rule 2 compiles is a page
whose example nothing has checked. This rule is
`scripts/check-catalogue-tests.mjs`.

**And the same check compares the rest of what a reader acts on.** Every
heading's title, every first line's severity, stage, language version,
specification reference and autofix sentence, every deferral, every unexercised
sentence, every message template, every placeholder gloss, every cause and every
fix, character for character against the file the compiler is generated from.
Two tables outside part 8 go with them, because both are the same fact written
twice: part 4's ranges table, which restates `ranges` and counts the entries in
each block, and part 6's refinements table, which is the set of entries carrying
`refines`. Until that was enforced, one word of a message could differ between
the page and the file and the whole build passed.

**What it does not compare is the prose around all of it.** Parts 1 to 3, this
part and part 7 are the design `errors.json` implements rather than a copy of
it, and a check that held them to the file would be a check nobody could keep
green. That reach is stated here and in `scripts/lib/catalogue-page.mjs`, which
holds the comparison, rather than left to be assumed, because a check
overstating what it covers is worse than a small one that says so.

Two smaller checks run in the same job, because they are cheap and they catch the
same class of rot: the schema check (every field present, every placeholder
declared and used, every fix non-empty and ending in a full stop) and the
independence check (no product, platform or company named anywhere in either
file).

---

## 6. Codes that refine or reassign a code quoted elsewhere

The specification is several documents, and a rule is often stated where it
belongs rather than here. Two kinds of difference are therefore possible, and
both are resolved the same way: the catalogue is what the compiler emits.

**Refinements.** `language.md` and `stdlib.md` sometimes quote a family code for a
case this catalogue gives its own code, so that the fix can be specific rather
than general. The family code remains correct for every case not listed here.

| Code | Refines | The case it takes over |
|---|---|---|
| OS1005 | OS1004 | Unknown escape sequence |
| OS1027 | OS1001 | A colour literal with the wrong number of digits |
| OS1028 | OS1003 | A continuation line indented at or left of its statement |
| OS1029 | OS1001 | A name written against a number |
| OS2011 | OS2003 | A condition must be a bool |
| OS2012 | OS2003 | The two arms of the ternary have different types |
| OS2013 | OS2003 | An array literal mixes types |
| OS2019 | OS2016 | A type that cannot be an array element |
| OS2020 | OS2001 | A name the library lists as planned |
| OS3019 | OS3011 | A declaration handle where a runtime object belongs |
| OS3020 | OS3011 | fill's first two arguments, which name two declared plots |
| OS3022 | OS3017 | An input written in place whose title is another input's name |
| OS3023 | OS3008 | An order naming a leg in a file that declares none |
| OS3024 | OS3021 | An input written in place whose title is empty |

**Reassignments.** Where a sibling document quotes a code that this catalogue
assigns to something else, the catalogue's assignment is the one the compiler
emits, and the sibling document is corrected rather than the code moved. A code
is never reused for a second meaning, so these are listed once and then settled.

| Quoted as | In | This catalogue emits | Why |
|---|---|---|---|
| OS6002, quoted for any request the host cannot answer | `stdlib.md` | OS6007, OS6008, OS6009 | an unknown symbol, an empty answer and a failed fetch have three different fixes |
| OS3008, for a host setting that fails an input's validation | `compiled-program.md` | OS6019 | OS3008 is about a value written in the source; a setting arrives from outside it |

---

## 7. Substitutions for OS1001

OS1001 names the character it found and the plain spelling to use instead. The
table the compiler fills the message from:

| Written | Fix named in the message |
|---|---|
| a non-breaking space | a plain space |
| a typographic quotation mark, single or double | a straight quote |
| an en space, an em space or a narrow space | a plain space |
| a non-ASCII letter in a name | the ASCII spelling of the name |
| ! | not |
| && | and |
| \|\| | or |
| ^ | pow(a, b) |
| ** | pow(a, b) |
| ++ | a += 1 |
| { or } | indentation, which is how a block is written |
| #, $ or @ outside a colour literal | delete it, or put the text in a string |

A character not in the table is reported with the generic fix, which is to delete
it or move it inside a string literal.

The qualifier on the last row carries weight. A `#` in front of a run of
hexadecimal digits is a colour literal, and one whose run is not six or eight
digits long is a colour the writer had nearly right, so it is OS1027, which names
the form. Applying this table's row to it would advise deleting the colour.

---

## 8. The catalogue

Entries are grouped by range and ascending by code. Each one carries its
severity, the stage that raises it, the language version it appeared in, the
specification sections that define the rule, and the test that produces it.

A section prints the stage's label from `stageLabels` rather than the token the
entry carries: `lex` is printed as lexer, `parse` as parser, `check` as checker,
`runtime` as engine, `host` as host, and `import` as importer. The entries
themselves carry the token, and it is the token a consumer reads.

## 8.1 OS1xxx Syntax

### OS1001 Unexpected character

Severity error. Stage lexer. Since language version 1. Reference language.md 3.1, 3.3, 3.12. Test `tests/examples/rejected/OS1001.oscript`. The editor can apply the fix.

**Message.** `Unexpected character {char}. {suggestion}`

- `{char}` is the offending character, quoted, with its Unicode name when it is not an ASCII graphic.
- `{suggestion}` is the replacement sentence for this character, from the substitution table in section 7 of this document.

**Cause.** Outside a string literal the language accepts ASCII letters, ASCII digits, space, newline and the punctuation list of language.md 3.12, and nothing else. A non-breaking space pasted from a web page, a typographic quotation mark pasted from a word processor, a non-ASCII letter in a name, and an operator the language does not have (!, &&, ||, ^, {, }) all arrive here. The character is rejected where it sits rather than three tokens later, because an invisible character produces a baffling parse error otherwise. Two runs whose every character is legal are not this code: a name written against a number is OS1029, and a colour literal with the wrong number of digits is OS1027. Naming one character of either and advising its deletion, which is what this fix says to do, would leave a program that still compiles and means something else.

**Fix.** Delete the character or replace it with the plain ASCII spelling the message names: a plain space for a non-breaking space, a straight quote for a typographic one, not for !, and for &&, or for ||, pow(a, b) for ^.

Before:

```
if !ready
    signal("BUY")
```

After:

```
if not ready
    signal("BUY")
```

### OS1002 Tab in indentation

Severity error. Stage lexer. Since language version 1. Reference language.md 3.10. Test `tests/examples/rejected/OS1002.oscript`. The editor can apply the fix.

**Message.** `This line is indented with a tab.`

**Cause.** Leading whitespace is spaces only. A tab is rejected rather than expanded because the width of a tab is an editor setting, so a file whose block structure depends on it means something different when someone else opens it.

**Fix.** Replace the leading tabs with spaces. Four spaces per level is the convention and the formatter's output.

Before:

```
if close > open
	signal("UP")
```

After:

```
if close > open
    signal("UP")
```

### OS1003 Indentation does not match this block

Severity error. Stage lexer. Since language version 1. Reference language.md 3.10. Test `tests/examples/rejected/OS1003.oscript`. The editor can apply the fix.

**Message.** `This line is indented {found} spaces; the block opened at line {line} is indented {expected}.`

- `{found}` is the leading space count on this line.
- `{expected}` is the leading space count every line of this block carries.
- `{line}` is the line that opened the block.

**Cause.** Every line of one block carries exactly the same leading whitespace. A difference of one space is still a difference, because the alternative is a language where a block's extent depends on a tolerance nobody can see. A blank line and a comment-only line stand outside the rule: they carry no token and no indentation at all, so any leading whitespace is accepted on them and neither one is ever this error. A continuation line stands outside it for a different reason: it belongs to a statement that began above it and opens no block, so what its indentation has to clear is that statement rather than a block, and that is OS1028.

**Fix.** Indent this line to {expected} spaces to keep it in the block, or to {line}'s own indentation to end the block here.

Before:

```
if trending
    body = close - open
     wick = high - low
```

After:

```
if trending
    body = close - open
    wick = high - low
```

### OS1004 Unterminated string literal

Severity error. Stage lexer. Since language version 1. Reference language.md 3.6. Test `tests/examples/rejected/OS1004.oscript`.

**Message.** `This string literal opens with {quote} and the line ends before a matching {quote}.`

- `{quote}` is the opening delimiter, a double or a single quote.

**Cause.** A string literal may not span a line, so the scanner reports the opening quote rather than swallowing the rest of the file and complaining about the last line.

**Fix.** Close the string with a matching {quote} before the end of the line, and join text across lines with + and a continuation.

Before:

```
signal("BUY)
```

After:

```
signal("BUY")
```

### OS1005 Unknown escape sequence

Severity error. Stage lexer. Since language version 1. Reference language.md 3.6. Test `tests/examples/rejected/OS1005.oscript`. The editor can apply the fix.

**Message.** `{sequence} is not an escape sequence.`

- `{sequence}` is the backslash and the character that followed it.

**Cause.** The escapes are a backslash followed by one of \ " ' n t r 0, and uXXXX with exactly four hexadecimal digits. Anything else is almost always a Windows path or a regular expression that was pasted without doubling its backslashes.

**Fix.** Double the backslash to write one literally, or use one of the escapes the language defines.

Before:

```
path = "C:\data\bars"
```

After:

```
path = "C:\\data\\bars"
```

### OS1006 Assignment used as a condition

Severity error. Stage parser. Since language version 1. Reference language.md 10.1. Test `tests/examples/rejected/OS1006.oscript`. The editor can apply the fix.

**Message.** `= assigns a value, and a condition needs a comparison.`

**Cause.** Assignment is a statement and never an expression, so the classic typo cannot compile into a condition that is always true. There is no form of this language in which if x = 5 means anything.

**Fix.** Write == to compare, or move the assignment to its own line above the if.

Before:

```
if len = 14
    signal("DEFAULT")
```

After:

```
if len == 14
    signal("DEFAULT")
```

### OS1007 Semicolon

Severity error. Stage lexer. Since language version 1. Reference language.md 3.10. Test `tests/examples/rejected/OS1007.oscript`. The editor can apply the fix.

**Message.** `; is not part of the language.`

**Cause.** A statement ends at the end of its line and a line holds at most one statement, so there is no separator to write.

**Fix.** Delete the ; and put the second statement on its own line.

Before:

```
fast = ema(close, 9); slow = ema(close, 21)
```

After:

```
fast = ema(close, 9)
slow = ema(close, 21)
```

### OS1008 Chained comparison

Severity error. Stage parser. Since language version 1. Reference language.md 9.3. Test `tests/examples/rejected/OS1008.oscript`.

**Message.** `A comparison cannot be chained: {op1} is already applied before {op2}.`

- `{op1}` is the first comparison operator on the line.
- `{op2}` is the second comparison operator on the line.

**Cause.** Two readings of a < b < c are plausible to a reader, the mathematical one and the C-family one, and a form with two plausible meanings has no place in a language that places orders. The grammar allows at most one comparison operator per expression.

**Fix.** Split it with and, naming the middle value twice: a < b and b < c.

Before:

```
if 30 < r < 70
    zone = "mid"
```

After:

```
if 30 < r and r < 70
    zone = "mid"
```

### OS1009 break or continue outside a loop

Severity error. Stage parser. Since language version 1. Reference language.md 10.5. Test `tests/examples/rejected/OS1009.oscript`.

**Message.** `{word} is only valid inside a for or a while body.`

- `{word}` is break or continue, whichever was written.

**Cause.** break leaves the innermost loop and continue starts its next iteration, so neither has a meaning where there is no loop to act on.

**Fix.** Move it inside the loop body, or write return to leave a function early.

Before:

```
fn firstAbove(values, mark) =>
    if size(values) == 0
        break
    values[0]
```

After:

```
fn firstAbove(values, mark) =>
    if size(values) == 0
        return none
    values[0]
```

### OS1010 Block header with no body

Severity error. Stage parser. Since language version 1. Reference language.md 3.10. Test `tests/examples/rejected/OS1010.oscript`. The editor can apply the fix.

**Message.** `{header} opens a block, and the next line is not indented more deeply.`

- `{header}` is the keyword that opened the block, such as if, else, for, while, case or default.

**Cause.** A header line introduces a block that consists of the following lines indented more deeply than the header. With nothing indented under it the header has no body, which is almost always a line that lost its indentation in a paste. Blank and comment-only lines carry no token, so they never count as a body: a header followed only by those, and then by a line at or left of the header, is still this error.

**Fix.** Indent the body under the header, or delete the header line if the body is genuinely empty.

Before:

```
if crossUp(fast, slow)
signal("BUY")
```

After:

```
if crossUp(fast, slow)
    signal("BUY")
```

### OS1011 var with no initial value

Severity error. Stage parser. Since language version 1. Reference language.md 8.2. Test `tests/examples/rejected/OS1011.oscript`. The editor can apply the fix.

**Message.** `var {name} has no initial value.`

- `{name}` is the name being declared.

**Cause.** The declaration and the first assignment are one statement, so a persistent value always has something in it and no bar can read it before it exists.

**Fix.** Give it a starting value; var {name} = none is the empty start.

Before:

```
var runningHigh
if high > orElse(runningHigh, high)
    runningHigh = high
```

After:

```
var runningHigh = none
if isNone(runningHigh) or high > runningHigh
    runningHigh = high
```

### OS1012 Bracket is never closed

Severity error. Stage parser. Since language version 1. Reference language.md 3.11. Test `tests/examples/rejected/OS1012.oscript`.

**Message.** `The {bracket} opened at line {line} is never closed.`

- `{bracket}` is the opening bracket character.
- `{line}` is the line the bracket was opened on.

**Cause.** An open ( or [ continues the statement onto the following lines, so a missing closer makes the scanner read the rest of the file as one statement. The error is reported at the opening bracket, which is where the mistake is.

**Fix.** Add the matching closer at the end of the argument list on line {line}.

Before:

```
plot(ema(close, 9), "EMA", aqua
```

After:

```
plot(ema(close, 9), "EMA", aqua)
```

### OS1013 Mismatched closing bracket

Severity error. Stage parser. Since language version 1. Reference language.md 19. Test `tests/examples/rejected/OS1013.oscript`. The editor can apply the fix.

**Message.** `Found {found} where {expected} was expected, closing the {opener} opened at line {line}.`

- `{found}` is the closing bracket that was written.
- `{expected}` is the closing bracket the opener requires.
- `{opener}` is the opening bracket character.
- `{line}` is the line the bracket was opened on.

**Cause.** Brackets nest, and a call closes with ) while an index or an array literal closes with ].

**Fix.** Change {found} to {expected}, which is what closes the {opener} opened at line {line}.

Before:

```
total = sum(closes]
```

After:

```
total = sum(closes)
```

### OS1014 Missing comma between arguments

Severity error. Stage parser. Since language version 1. Reference language.md 11.2. Test `tests/examples/rejected/OS1014.oscript`. The editor can apply the fix.

**Message.** `Two arguments run together; a comma is missing before {token}.`

- `{token}` is the first token of the second argument.

**Cause.** Arguments are separated by commas. Two expressions side by side inside a call are not a form the language has, so the missing comma is reported rather than guessed at.

**Fix.** Put a comma between the two arguments.

Before:

```
plot(ema(close, 9) "EMA", aqua)
```

After:

```
plot(ema(close, 9), "EMA", aqua)
```

### OS1015 Ternary with no second arm

Severity error. Stage parser. Since language version 1. Reference language.md 9.5. Test `tests/examples/rejected/OS1015.oscript`.

**Message.** `This ? has no matching :`

**Cause.** The ternary always yields a value, so both arms are required. A ternary with one arm is usually a plot that wanted to draw nothing on some bars.

**Fix.** Give the ternary both arms, and use none for the arm that should draw nothing.

Before:

```
plot(ready ? value, "Value", aqua)
```

After:

```
plot(ready ? value : none, "Value", aqua)
```

### OS1016 else does not follow an if

Severity error. Stage parser. Since language version 1. Reference language.md 10.2. Test `tests/examples/rejected/OS1016.oscript`. The editor can apply the fix.

**Message.** `This else is indented {found} spaces and the nearest if is indented {expected}.`

- `{found}` is the leading space count on the else line.
- `{expected}` is the leading space count of the if it should pair with.

**Cause.** An else pairs with the if at its own indentation. At any other indentation there is no if for it to belong to, and guessing which one was meant would make the block structure unreadable.

**Fix.** Line the else up with its if, at {expected} spaces.

Before:

```
if trending
    signal("BUY")
  else
    signal("WAIT")
```

After:

```
if trending
    signal("BUY")
else
    signal("WAIT")
```

### OS1017 case or default in the wrong place

Severity error. Stage parser. Since language version 1. Reference language.md 10.6. Test `tests/examples/rejected/OS1017.oscript`.

**Message.** `{word} is only valid inside a switch, and default must be its last arm.`

- `{word}` is case or default, whichever was written.

**Cause.** The arms of a switch are its whole body. A default that is not last would leave the arms after it unreachable, which the language rejects rather than silently accepts.

**Fix.** Move the arm inside the switch block, and put default after every case.

Before:

```
switch method
    default
        len = 14
    case "fast"
        len = 9
```

After:

```
switch method
    case "fast"
        len = 9
    default
        len = 14
```

### OS1018 More than one statement on a line

Severity error. Stage parser. Since language version 1. Reference language.md 3.10. Test `tests/examples/rejected/OS1018.oscript`.

**Message.** `Unexpected {token} after the end of this statement.`

- `{token}` is the first token that follows the complete statement.

**Cause.** A line holds at most one statement, so anything after a statement ends is either a missing operator or a second statement that lost its newline. An assignment operator after an index or after a dotted name is not this error: the statement did not end there, and what is wrong is the target rather than anything following it. Those two are OS1024 and OS1025.

**Fix.** Put {token} and what follows it on its own line, or supply the operator that was meant to join them.

Before:

```
fast = ema(close, 9) slow = ema(close, 21)
```

After:

```
fast = ema(close, 9)
slow = ema(close, 21)
```

### OS1019 Reserved word used as a name

Severity error. Stage parser. Since language version 1. Reference language.md 3.4. Test `tests/examples/rejected/OS1019.oscript`.

**Message.** `{word} is a reserved word and cannot be used as a name.`

- `{word}` is the reserved word that was used as a name.
- `{suggestion}` is a near name that is not reserved, derived from the word.

**Cause.** The reserved words of language.md 3.4 include five that version 1 does not implement (import, map, matrix, type, as). They are reserved now so that implementing them later cannot break a script that used one as a name. A named argument label is not a name: it is matched against the callee's parameter list and is never looked up in any scope, so plot(v, "V", color = aqua) is correct and is not this error. The rule stops at the label. A parameter of a user function is an ordinary identifier, because the body refers to it, so fn f(color = red) is this error.

**Fix.** Rename it; {suggestion} keeps the meaning and is not reserved.

Before:

```
type = input("fast", "Mode", options = ["fast", "slow"])
```

After:

```
mode = input("fast", "Mode", options = ["fast", "slow"])
```

### OS1020 Incomplete for header

Severity error. Stage parser. Since language version 1. Reference language.md 10.3. Test `tests/examples/rejected/OS1020.oscript`.

**Message.** `A for header needs = start to end or in array; found {token}.`

- `{token}` is the token that appeared where to or in was expected.

**Cause.** There are two loop forms and no third. A counted loop names a start and an end, and a loop over an array names the array.

**Fix.** Write for i = 0 to size(values) - 1 for a counted loop, or for v in values to visit elements.

Before:

```
for i = 0, 9
    total += close[i]
```

After:

```
for i = 0 to 9
    total += close[i]
```

### OS1021 The version declaration is not first

Severity error. Stage parser. Since language version 1. Reference language.md 4. Test `tests/examples/rejected/OS1021.oscript`. The editor can apply the fix.

**Message.** `version must be the first line that is not blank and not a comment; line {line} came before it.`

- `{line}` is the line of the first statement that preceded the version declaration.

**Cause.** A host reads the version with a one-line scan so it can pick a front end before any parsing happens. A declaration further down the file would be read by the wrong front end, which defeats the purpose of having one.

**Fix.** Move the version line to the top of the file, above the study or strategy declaration.

Before:

```
study("EMA cross")
version 1
```

After:

```
version 1

study("EMA cross")
```

### OS1022 Expression expected

Severity error. Stage parser. Since language version 1. Reference language.md 3.11. Test `tests/examples/rejected/OS1022.oscript`.

**Message.** `An expression was expected after {token}.`

- `{token}` is the operator or punctuation the statement ended on.

**Cause.** An operator, a comma or an opening bracket at the end of a statement continues it onto the next line, so a statement that ends this way and is followed by nothing usable has lost its right-hand side.

**Fix.** Supply the missing operand, or delete the trailing {token}.

Before:

```
len = input(14, "Length") +
```

After:

```
len = input(14, "Length")
```

### OS1023 A function declared inside a block

Severity error. Stage parser. Since language version 1. Reference language.md 11.1. Test `tests/examples/rejected/OS1023.oscript`.

**Message.** `fn {name} is declared inside a block, and a function is declared at the top level of the file.`

- `{name}` is the function being declared.

**Cause.** Functions may not be nested (language.md 11.1). A declaration under an if, a loop, a switch arm or another function's body sits in a scope that ends where the block ends, so the name would exist for part of a file and not the rest, and a reader would have to trace the block structure to know whether a call on the line in front of them was legal. The declaration is reported rather than dropped or lifted: dropping it leaves every call to it as OS2001 with no word about where the function went, and lifting it to the top level compiles a form the language does not have.

**Fix.** Move the whole declaration out to the top level of the file, and call {name} from inside the block.

Before:

```
if trending
    fn smoothed(src) => sma(src, 9)
    plot(smoothed(close), "Smooth", aqua)
```

After:

```
fn smoothed(src) => sma(src, 9)

smooth = smoothed(close)
plot(trending ? smooth : none, "Smooth", aqua)
```

### OS1024 Assignment to an indexed element

Severity error. Stage parser. Since language version 1. Reference language.md 9.6, 14.1, 19. Test `tests/examples/rejected/OS1024.oscript`.

**Message.** `An assignment writes to a name, and this target is an index into {name}.`

- `{name}` is the name that was indexed.

**Cause.** The grammar of language.md 19 admits one assignment target, an identifier, and there is no indexed assignment anywhere in the language. The reason is that [] reads two different things (language.md 9.6): on an array it is an element, which section 14.1 writes with set(arr, i, v), and on a series it is a bar the engine has already computed, which nothing in a script may overwrite. One syntax covering both would read as though a past bar could be rewritten.

**Fix.** Change an array element with set({name}, i, v), or assign to a plain name: the past of a series is computed and never written.

Before:

```
var prices = [0.0]
prices[0] = close
```

After:

```
var prices = [0.0]
set(prices, 0, close)
```

### OS1025 Assignment to a member

Severity error. Stage parser. Since language version 1. Reference language.md 15.2, 19. Test `tests/examples/rejected/OS1025.oscript`.

**Message.** `An assignment writes to a name, and this target is the member {member} of {name}.`

- `{name}` is the name written before the dot.
- `{member}` is the name written after the dot.

**Cause.** The grammar of language.md 19 admits one assignment target, an identifier. A dotted name reads a member of one of the namespaces on the closed list in language.md 15.2, and every member on that list is a per-bar fact, an instrument fact, a position fact or a function, each of them produced by the engine or by the host. There is nothing behind a dot that a script owns. Version 1 has no user-declared types that could add one either: type is a reserved word and is not implemented (language.md 18). A dotted name whose first half is not a namespace is the same answer for a simpler reason: it has no members at all.

**Fix.** Assign to a plain name. Version 1 has no member assignment: a dot reads a member, and the members a script can reach are facts and functions the library and the host supply.

Before:

```
chart.tickStep = 0.05
plot(close + chart.tickStep, "Stepped", aqua)
```

After:

```
tickStep = 0.05
plot(close + tickStep, "Stepped", aqua)
```

### OS1026 Block comment

Severity error. Stage lexer. Since language version 1. Reference language.md 3.2. Test `tests/examples/rejected/OS1026.oscript`.

**Message.** `{marker} does not open or close a comment. A comment is written // and runs to the end of its line.`

- `{marker}` is the two characters that were written, the opener or the closer.

**Cause.** The language has line comments and no block form (language.md 3.2). The block form is left out on purpose: an unterminated one swallows the rest of a file and reports its error at the last line, which is the worst message a compiler can produce. Without the form there is nothing special about the two characters, so a divide and a multiply are what they are and the line parses as arithmetic with its operands missing. The diagnostics then land on the operators rather than on the comment that caused them, and a reader is told three things that are each true of a program they did not write. The marker is reported where it sits instead.

**Fix.** Write // instead, and give every line of a commented region its own //, which every editor does with one keystroke.

Before:

```
lookback = 14 /* bars */
```

After:

```
lookback = 14 // bars
```

### OS1027 Malformed colour literal

Severity error. Stage lexer. Since language version 1. Reference language.md 3.8. Test `tests/examples/rejected/OS1027.oscript`.

**Message.** `{written} is not a colour: a colour literal is # and six or eight hexadecimal digits.`

- `{written}` is the # and the run of characters written against it.

**Cause.** A hexadecimal colour is # and six digits, two each for red, green and blue, or eight where the last two are the alpha byte (language.md 3.8). The three and four digit shorthands belong to other formats and this language does not have them, and a run of any other length, or one carrying a digit outside 0 to f, is a typing slip. It has a code of its own because every character in it is one the language accepts: the substitution row that gives OS1001 its sentence about # is written for a # outside a colour literal, and its advice, to delete the character or move the text into a string, would throw away a colour the writer had nearly right.

**Fix.** Give it six hexadecimal digits, or eight where the last two are the alpha byte. A named colour or rgb(r, g, b) says the same thing without the digits.

Before:

```
plot(close, "Close", #ff88)
```

After:

```
plot(close, "Close", #ff8800)
```

### OS1028 A continuation line is not indented past its statement

Severity error. Stage lexer. Since language version 1. Reference language.md 3.11. Test `tests/examples/rejected/OS1028.oscript`. The editor can apply the fix.

**Message.** `A continuation line must be indented more deeply than the line its statement began on; line {line} is indented {statement} and this line is indented {found}.`

- `{found}` is the leading space count on this line.
- `{statement}` is the leading space count of the line the statement began on.
- `{line}` is the line the statement began on.

**Cause.** A statement continues onto the next line when a bracket is still open, when the line ends with a binary operator, a comma, a ?, a : or an =, or when it ends with a backslash (language.md 3.11). A continuation is required to sit further right than the line the statement began on, so that a reader can tell a continued statement from a new one without scanning back up the file for a trailing operator. This is not the block rule of OS1003, and it has a code of its own for that reason: a continuation opens no block, so OS1003, whose message names the indentation every line of a block carries and whose fix offers to end that block, would state a fact about a block that is not there.

**Fix.** Indent this line further than the {statement} spaces on line {line}. Four more is the convention and the formatter's output.

Before:

```
total = ema(close, 9) +
ema(close, 21)
```

After:

```
total = ema(close, 9) +
        ema(close, 21)
```

### OS1029 A name written against a number

Severity error. Stage lexer. Since language version 1. Reference language.md 3.3, 3.5. Test `tests/examples/rejected/OS1029.oscript`.

**Message.** `{written} is neither a number nor a name: the number literal ends at {number}, and a name cannot begin with a digit.`

- `{written}` is the whole run, the number literal and the name characters against it.
- `{number}` is the part of the run that is a number literal.

**Cause.** A number literal is decimal, with an optional fractional part and an optional exponent, or 0x and hexadecimal digits. There is no octal form and no binary form, and an underscore belongs to a literal only where a digit follows it (language.md 3.5). A name cannot begin with a digit (language.md 3.3). A base prefix the language does not have, a unit written against a quantity, and a literal that ends in an underscore all produce this run. The whole run is reported rather than its first character, because every character in it is one the language accepts: naming the leading digit would name something legal, and deleting it, which is what OS1001 advises, leaves a valid name behind and a program that means something else.

**Fix.** Write the value in a form the language has: a decimal literal, or 0x and hexadecimal digits. There is no binary form and no octal form, and an underscore separates digit groups only where a digit follows it. Where a number and a name were meant as two things, put an operator between them.

Before:

```
mask = 0b1011
```

After:

```
mask = 0x0b
```

---

## 8.2 OS2xxx Names and types

### OS2001 Name is not defined here

Severity error. Stage checker. Since language version 1. Reference language.md 12.2, 12.5. Test `tests/unit/check-names.test.ts`.

**Message.** `{name} is not defined at this point in the file.`

- `{name}` is the name that was read.
- `{suggestion}` is the closest name that is in scope here, by edit distance.

**Cause.** The file is the body of the per-bar loop and runs top to bottom, so a name must be assigned above the line that reads it. A name first assigned inside a block belongs to that block and is not visible outside it. A misspelling arrives here too.

**Fix.** Assign {name} above this line, move this line below its assignment, or correct the spelling to {suggestion}.

Before:

```
plot(spread, "Spread", aqua)
spread = high - low
```

After:

```
spread = high - low
plot(spread, "Spread", aqua)
```

### OS2002 The name already exists in an enclosing scope

Severity error. Stage checker. Since language version 1. Reference language.md 12.3, 12.4. Test `tests/unit/check-names.test.ts`.

**Message.** `{name} is already declared at line {line}, so a second one cannot be declared here.`

- `{name}` is the name being declared.
- `{line}` is the line of the existing declaration, or the word built-in when it is a library name.

**Cause.** There is no shadowing. An assignment to a name that exists in an enclosing scope updates that name, so declaring the same name inside is a request the language has no syntax for and is always a mistake. Built-in names such as close, ema, aqua and plot live in the global scope, so assigning to one lands here as well.

**Fix.** Rename this one, or drop the inner declaration and let the assignment update the {name} at line {line}.

Before:

```
len = 20

fn smooth(src) =>
    len = 9
    sma(src, len)
```

After:

```
len = 20

fn smooth(src) =>
    inner = 9
    sma(src, inner)
```

### OS2003 Types do not match

Severity error. Stage checker. Since language version 1. Reference language.md 5.3, 5.4, 10.1. Test `tests/unit/check-handles.test.ts`.

**Message.** `{leftType} and {rightType} do not mix here.`

- `{leftType}` is the type of the left operand or of the name's first assignment, or the words a per-bar value where the position takes a value of any type and a declaration handle was written.
- `{rightType}` is the type of the right operand or of the value being assigned.

**Cause.** There is no implicit conversion anywhere in the language: 0 is not false, an empty string is not false, and a number is not a string. A name's type is fixed by its first assignment, so assigning a different type later arrives here too. A first assignment of none fixes no type, because none is a member of every type; the type comes from the first assignment that gives a definite one, and this code names the second definite type rather than the first. Every silent coercion rule is a source of bugs that survive review, and a trading script that quietly treats a zero as a false is a bug nobody finds until it costs money. A declaration handle arrives here as well: plot(), plotCandles(), fill() and level() return the compile-time half of a declaration (language.md 5.4), so a handle in a position that requires a value has nothing to give, and the message names its type as plot, fill or level.

**Fix.** Convert explicitly: text(x) for a string, or text(x, decimals) to fix the decimals. Where no conversion applies, write the value in the type the line needs, or give the second value a name of its own. A plot, fill or level handle converts to nothing: leave it named at the top level, pass it to fill(), and use draw.line() or draw.box() where the script needs something it can keep.

Before:

```
s = "count: " + 5
```

After:

```
s = "count: " + text(5)
```

### OS2004 This value has no history

Severity error. Stage checker. Since language version 1. Reference language.md 5.2, 5.4. Test `tests/unit/check-types.test.ts`.

**Message.** `{expr} has no history, so [] cannot read a past value of it.`

- `{expr}` is the expression the history operator was applied to.

**Cause.** History is retained for four kinds of value: a built-in series, a name assigned at the top level of the file, a call to a function declared to return a series, and a series parameter of a user function. Retaining it for every temporary inside every block would cost memory per bar and would not run fifty thousand bars in a browser tab. A name bound to a declaration handle is none of the four, although it sits at the top level: it is a compile-time binding with no per-bar value at all. A runtime object carries no history either, so [] on a line, a label, a box, a polyline or a table is this error as well (language.md 5.4).

**Fix.** If the value is a per-bar number computed inside a block or left as a temporary, assign it at the top level of the file and read the history of that top level name. If it is a declaration handle, a runtime object or a library fact that is not a series, no name gives it a history: assign what you want to look back at to a top level name of its own, and read that.

Before:

```
if trending
    body = close - open
    plot(body[1], "Previous body", aqua)
```

After:

```
body = close - open
plot(trending ? body[1] : none, "Previous body", aqua)
```

### OS2005 Recursive call

Severity error. Stage checker. Since language version 1. Reference language.md 11.4. Test `tests/unit/check-names.test.ts`.

**Message.** `{name} calls itself: {cycle}.`

- `{name}` is the function at the start of the cycle.
- `{cycle}` is the call chain, from the function back to itself.

**Cause.** State slots for var and for stateful library calls are allocated statically, one per call site. Recursion would need a dynamic stack of them, whose cost would be paid on every bar of every script to support a form a per-bar language almost never needs.

**Fix.** Rewrite it as a loop, or split the work into two functions that do not call each other.

Before:

```
fn total(n) =>
    if n <= 0
        return 0
    close[n] + total(n - 1)
```

After:

```
fn total(n) =>
    runningTotal = 0.0
    for i = 0 to n
        runningTotal += close[i]
    runningTotal
```

### OS2006 Assignment to a loop variable

Severity error. Stage checker. Since language version 1. Reference language.md 10.3. Test `tests/unit/check-names.test.ts`.

**Message.** `{name} is this loop's variable and cannot be assigned inside the body.`

- `{name}` is the loop variable.

**Cause.** The loop controls its own variable, so a body that also writes to it produces a loop whose iteration count cannot be read from its header.

**Fix.** Use break to leave early, or keep a separate name for the value the body changes.

Before:

```
for i = 0 to 9
    if close[i] > hi
        i = 9
```

After:

```
for i = 0 to 9
    if close[i] > hi
        break
```

### OS2007 The file has no declaration

Severity error. Stage checker. Since language version 1. Reference language.md 13.1. Test `tests/unit/check-support.ts`.

**Message.** `A file needs one study() or strategy() declaration before any other statement.`

**Cause.** The declaration supplies the title, the pane, the precision and the settings the host needs before the first bar runs. Without one there is nothing to put in a legend and nothing to name in a picker.

**Fix.** Add study("Name") as the first statement, or strategy("Name") if the file places orders.

Before:

```
fast = ema(close, 9)
plot(fast, "Fast", aqua)
```

After:

```
study("EMA", overlay = true)

fast = ema(close, 9)
plot(fast, "Fast", aqua)
```

### OS2008 More than one declaration

Severity error. Stage checker. Since language version 1. Reference language.md 13.1. Test `tests/unit/check-calls.test.ts`.

**Message.** `This file already declares {kind} at line {line}.`

- `{kind}` is study or strategy, whichever came first.
- `{line}` is the line of the first declaration.

**Cause.** Two declarations would need a rule for whose overlay, precision and title win, and the answer to that question is always that there should have been one. A strategy accepts every study option, so a file that wants both is a strategy.

**Fix.** Delete this declaration and move the options you wanted onto the one at line {line}.

Before:

```
study("EMA cross", overlay = true)
strategy("EMA cross")
```

After:

```
strategy("EMA cross", overlay = true)
```

### OS2009 Unknown member of a namespace

Severity error. Stage checker. Since language version 1. Reference language.md 15.2. Test `tests/unit/check-names.test.ts`.

**Message.** `{namespace} has no member named {member}.`

- `{namespace}` is the namespace that was read.
- `{member}` is the member name that does not exist.
- `{suggestion}` is the closest member of that namespace, by edit distance.

**Cause.** Namespaces hold a fixed set of names, published in the library manifest the editor completes from. A member that does not exist is a typo or a name from a different namespace.

**Fix.** Use one of {namespace}'s members; {suggestion} is the closest match to what was written.

Before:

```
plot(bar.idx, "Bar", aqua)
```

After:

```
plot(bar.index, "Bar", aqua)
```

### OS2010 This name is not a function

Severity error. Stage checker. Since language version 1. Reference language.md 15.1. Test `tests/unit/check-names.test.ts`.

**Message.** `{name} is {type}, not a function, so it cannot be called.`

- `{name}` is the name that was called.
- `{type}` is the type the name holds.
- `{suggestion}` is the library function whose name is closest, with its first argument filled in.

**Cause.** A built-in series and a user value are read bare. An argument list after one of them is usually a library function that was remembered with the wrong name.

**Fix.** Remove the argument list to read the value, or call the function that was meant: {suggestion}.

Before:

```
v = volume(20)
```

After:

```
v = sma(volume, 20)
```

### OS2011 A condition must be a bool

Severity error. Stage checker. Since language version 1. Reference language.md 5.3, 10.2. Test `tests/unit/check-types.test.ts`.

**Message.** `This condition is {type}; a condition must be bool or none.`

- `{type}` is the type the condition expression produced.
- `{name}` is the condition expression as written, or its name when it is one.

**Cause.** There is no truthiness. A number is not a condition, a string is not a condition, and an absent value takes the false branch only after the condition has been written as a genuine test.

**Fix.** Write the test out: {name} > 0 for a count, isNone({name}) for absence, {name} != "" for a string.

Before:

```
if hitCount
    signal("SEEN")
```

After:

```
if hitCount > 0
    signal("SEEN")
```

### OS2012 The two arms of the ternary have different types

Severity error. Stage checker. Since language version 1. Reference language.md 9.5. Test `tests/unit/check-types.test.ts`.

**Message.** `The arms of this ? : are {leftType} and {rightType}.`

- `{leftType}` is the type of the arm before the colon.
- `{rightType}` is the type of the arm after the colon.

**Cause.** The ternary yields one value, so both arms must agree on its type. The one exception is none, which is a member of every type and is how an arm says there is nothing here.

**Fix.** Make both arms the same type with text() or toNumber(), or use none for the empty arm.

Before:

```
label = up ? 1 : "down"
```

After:

```
label = up ? "up" : "down"
```

### OS2013 An array literal mixes types

Severity error. Stage checker. Since language version 1. Reference language.md 14.1. Test `tests/unit/check-types.test.ts`.

**Message.** `This array holds {firstType} at index 0 and {otherType} at index {index}.`

- `{firstType}` is the type of the first element.
- `{otherType}` is the type of the element that disagrees.
- `{index}` is the index of the element that disagrees.

**Cause.** An array is homogeneous, which is what lets size, sum, avg and sort mean one thing. A mixed literal is usually two lists that belong side by side.

**Fix.** Make every element {firstType}, or keep two arrays and index them together.

Before:

```
rows = ["RSI", 14, "EMA", 9]
```

After:

```
names = ["RSI", "EMA"]
lengths = [14, 9]
```

### OS2014 A function cannot be used as a value

Severity error. Stage checker. Since language version 1. Reference language.md 11.1, 18. Test `tests/emit/worked-example.test.ts`.

**Message.** `{name} is a function, and version 1 has no function values.`

- `{name}` is the function name that was used bare.

**Cause.** Functions are not values in version 1: they cannot be assigned, stored in an array or passed as an argument. The feature is reserved rather than absent, and language.md 18 names it.

**Fix.** Call {name} with its arguments and use the value it returns.

Before:

```
src = ema
plot(src, "EMA", aqua)
```

After:

```
src = ema(close, 9)
plot(src, "EMA", aqua)
```

### OS2015 The element type of this empty array is unknown

Severity error. Stage checker. Since language version 1. Reference language.md 14.1. Test `tests/unit/check-types.test.ts`.

**Message.** `An empty array literal needs its element type from an annotation or from a first use.`

**Cause.** An array is homogeneous, so its element type has to be known before anything is pushed into it. An empty literal takes that type from an annotation when it has one, and otherwise from the first call in the file, in source order, that puts an element into it: push, unshift, insert or set. With neither an annotation nor such a call, nothing in the file says what the array holds and the language does not guess.

**Fix.** Annotate the declaration, var hits: array<number> = [], or put the first element in with push(), unshift(), insert() or set() and let the type be read from that call.

Before:

```
var hits = []
plot(size(hits), "Hits", aqua)
```

After:

```
var hits: array<number> = []
plot(size(hits), "Hits", aqua)
```

### OS2016 Unknown type in an annotation

Severity error. Stage checker. Since language version 1. Reference language.md 5.1, 5.4, 19. Test `tests/unit/check-types.test.ts`.

**Message.** `{type} is not a type.`

- `{type}` is the word that was written where a type was expected.

**Cause.** The types are number, string, bool, color, none, array<T> and the five runtime object types line, label, box, polyline and table, with series in front where a per-bar value is meant. There is no integer type: a length, a bar count and a price are all number. The declaration handle types plot, fill and level are deliberately not in the grammar, so writing one in an annotation is this error as well: a handle can never be a var, a parameter, a return value or an array element, and there is nothing left for an annotation to describe.

**Fix.** Use number, string, bool, color, array<T>, or an object type (line, label, box, polyline, table), with series in front for a per-bar value.

Before:

```
fn band(src: series number, len: int = 20) =>
    sma(src, len)
```

After:

```
fn band(src: series number, len: number = 20) =>
    sma(src, len)
```

### OS2017 A function with this name is already declared

Severity error. Stage checker. Since language version 1. Reference language.md 11.1. Test `tests/unit/check-names.test.ts`.

**Message.** `{name} is already declared as a function at line {line}.`

- `{name}` is the function name.
- `{line}` is the line of the first declaration.

**Cause.** A user function is not overloaded in version 1, so one name in a file is one function. Two declarations would make the call site's meaning depend on argument types, which is exactly the kind of resolution a reader cannot do in their head. The library's own overloads are a different thing: they are a fixed published set, round() and clear() among them, and a script cannot add to it.

**Fix.** Rename one of them, or give the one function a default argument that covers both uses.

Before:

```
fn band(src) => sma(src, 20)
fn band(src, len) => sma(src, len)
```

After:

```
fn band(src, len = 20) => sma(src, len)
```

### OS2018 Duplicate parameter name

Severity error. Stage checker. Since language version 1. Reference language.md 11.2. Test `tests/unit/check-names.test.ts`.

**Message.** `{name} appears twice in this parameter list.`

- `{name}` is the repeated parameter name.

**Cause.** Two parameters with one name make every use of that name inside the body ambiguous, and a named argument at the call site could not say which one it meant.

**Fix.** Rename the second parameter, so every name in the list appears once.

Before:

```
fn ratio(src, src) => src / src[1]
```

After:

```
fn ratio(src, len) => src / src[len]
```

### OS2019 This type cannot be an array element

Severity error. Stage checker. Since language version 1. Reference language.md 5.4, 14.1, 19. Test `tests/unit/check-types.test.ts`.

**Message.** `array<{type}> is not a type: {type} cannot be an array element.`

- `{type}` is the element type written inside the angle brackets.

**Cause.** An array element is a number, a string, a bool, a color, or one of the runtime object types of language.md 5.4, and nothing else. A declaration handle is the compile-time half of a declaration and has no run-time value, so there would be nothing to store. A series is a per-bar history, and an array of them would be a second history the engine retained per element, as many as the script chose to push. An array of arrays is the matrix that language.md 14.2 reserves for a later version.

**Fix.** Use an element type an array holds: number, string, bool, color, line, label, box, polyline or table. A plot cannot be kept anywhere, so declare each plot at the top level and give it its own name.

Before:

```
var edges: array<plot> = []
push(edges, plot(upper, "Upper", aqua))
```

After:

```
upperEdge = plot(upper, "Upper", aqua)
lowerEdge = plot(lower, "Lower", aqua)
fill(upperEdge, lowerEdge, color = fade(aqua, 88))
```

### OS2020 Name is planned, not implemented

Severity error. Stage checker. Since language version 1. Reference stdlib.md 1. Test `tests/unit/check-names.test.ts`.

**Message.** `{name} is planned and is not implemented in this version.`

- `{name}` is the planned name that was called or read.

**Cause.** The library names a few calls and facts it does not implement yet, so that the gap is visible rather than left for a reader to guess at (stdlib.md 1). The checker knows this name and knows it carries no behaviour, which is a different fact from a name it has never heard of: nothing about the spelling is wrong, no line above it would help, and the name starts working on a version that implements it.

**Fix.** Compute what {name} would give from names the library implements today, or take the line out until a version implements it. Do not reach for the nearest name that compiles: a neighbour computes something else, and a plot that quietly changes meaning is worse than one that refuses to compile.

Before:

```
zScore = (close - sma(close, 20)) / stdev(close, 20)
plot(math.tanh(zScore), "Squashed", aqua)
```

After:

```
zScore = (close - sma(close, 20)) / stdev(close, 20)
doubled = exp(2 * zScore)
plot((doubled - 1) / (doubled + 1), "Squashed", aqua)
```

---

## 8.3 OS3xxx Arguments

### OS3001 Wrong number of arguments

Severity error. Stage checker. Since language version 1. Reference language.md 11.2. Test `tests/unit/check-calls.test.ts`.

**Message.** `{name} takes {expected} arguments and {found} were given.`

- `{name}` is the function being called.
- `{expected}` is the number of parameters, or the range when some have defaults.
- `{found}` is the number of arguments at this call site.
- `{signature}` is the function's full signature, parameter names and defaults included.

**Cause.** A call site is checked against the declared parameter list. Parameters with defaults may be left out, and every parameter without one must be supplied.

**Fix.** Pass the arguments the signature names: {signature}.

Before:

```
e = ema(close, 9, 2)
```

After:

```
e = ema(close, 9)
```

### OS3002 Unknown named argument

Severity error. Stage checker. Since language version 1. Reference language.md 11.2. Test `tests/unit/check-calls.test.ts`.

**Message.** `{name} has no argument called {argument}.`

- `{name}` is the function being called.
- `{argument}` is the named argument that does not exist.
- `{names}` is every argument name the function accepts, in declaration order.
- `{suggestion}` is the closest accepted name, by edit distance.

**Cause.** Named arguments are matched against the parameter list by exact name. A name that is not on the list is a spelling that the call site and the function disagree about, and ignoring it would leave the argument silently unapplied.

**Fix.** Use one of {names}; {suggestion} is the closest to what was written.

Before:

```
plot(v, "V", colour = aqua)
```

After:

```
plot(v, "V", color = aqua)
```

### OS3003 This option must be a constant

Severity error. Stage checker. Since language version 1. Reference language.md 13.2, 15.3. Test `tests/unit/check-calls.test.ts`.

**Message.** `{option} is read once, before the first bar, so it cannot depend on bar data.`

- `{option}` is the option that was given a bar-dependent value.

**Cause.** The declaration builds the legend, the axis and the settings dialog before bar 0 runs, so its options must be literals, arithmetic over literals, or an input() written as the whole of the value; an expression over an input is OS3025. A value that changes per bar has no single answer at the moment the dialog is built. The rule covers more than the declaration's own options: every argument that lands in a declaration fixed before bar 0 arrives here too, signal's at, shape and color, table's position, rows and cols, and a plot's style arguments among them. An input() counts as a constant for this purpose, because the engine resolves inputs at load and substitutes the resolved value before bar 0 runs.

**Fix.** Use a literal, or make it tunable with an input(): {option} = input(2, "{option}").

Before:

```
study("Range", precision = round(close / 1000))
```

After:

```
study("Range", precision = input(2, "precision"))
```

### OS3004 Argument is not a valid whole number

Severity error. Stage checker. Since language version 1. Reference language.md 5.1, 10.3. Test `tests/engine/machine.test.ts`.

**Message.** `{name}'s {argument} must be a whole number {range}; {found} was given.`

- `{name}` is the function being called.
- `{argument}` is the parameter name.
- `{range}` is the accepted range, such as 1 or more.
- `{found}` is the literal value that was written.

**Cause.** A lookback length, an index and a loop step are counts of bars or of elements. A fractional value is rejected rather than truncated, because a length of 14.5 is a bug in the script and rounding it hides the bug. A step of 0 is rejected because it is the one loop that cannot finish.

**Fix.** Pass a whole number inside {range}, and wrap a computed value in floor() or round().

Before:

```
t = table("Summary", 2.5, 2)
```

After:

```
t = table("Summary", 3, 2)
```

### OS3005 Positional argument after a named one

Severity error. Stage checker. Since language version 1. Reference language.md 11.2. Test `tests/unit/check-calls.test.ts`.

**Message.** `A positional argument cannot follow a named one.`

**Cause.** Once an argument is named, the position of the arguments after it no longer says which parameter they fill. The order is positional first, named afterwards, which keeps every call site readable without the signature in front of you.

**Fix.** Name this argument too, or move it in front of the first named argument.

Before:

```
b = band(close, len = 20, 3)
```

After:

```
b = band(close, len = 20, mult = 3)
```

### OS3006 This call must be at the top level

Severity error. Stage checker. Since language version 1. Reference language.md 7.1, 15.3; stdlib.md 17.6. Test `tests/unit/check-calls.test.ts`.

**Message.** `{name} defines part of the study's fixed shape and cannot appear inside {construct}.`

- `{name}` is the call, one of plot, plotCandles, fill, level, table, leg.fixed or leg.relative.
- `{construct}` is the enclosing construct, such as an if block, a loop or a function body.

**Cause.** The set of plotted columns, bands, levels and grids is fixed before bar 0 so the chart can build a legend, an axis and a settings dialog. A call inside a branch would add a column on some bars and not others, and there would be nothing stable to name. table() is on the list for the same reason, the grid's size and corner being part of the study's fixed shape, although what it returns is a runtime object that cell() writes to per bar (language.md 5.4). A leg declaration is on the list for the same reason: the set of contracts a strategy trades is fixed before bar 0, and a leg that existed on some bars and not others would leave the run's record with nothing to key on. A drawing or an alert call inside a request expression is the same error for a related reason: that expression is evaluated on another instrument's bars, so there is no bar of this chart for it to draw on.

**Fix.** Move the call to the top level and hide it per bar by passing none: plot(cond ? value : none, ...). Inside a request expression, read the value first and draw with it afterwards. A leg is not hidden by passing none: declare it at the top level and decide per bar whether to send it an order.

Before:

```
if trending
    plot(ema20, "EMA 20", aqua)
```

After:

```
plot(trending ? ema20 : none, "EMA 20", aqua)
```

### OS3007 input() must be at the top level

Severity error. Stage checker. Since language version 1. Reference language.md 13.4. Test `tests/unit/check-calls.test.ts`.

**Message.** `input() builds one row of the settings dialog, which is read once before the first bar.`

**Cause.** The dialog exists before any bar runs, so every input has to be reachable without executing the script. An input inside a block would appear or vanish depending on the data, and a saved setting would have nothing to attach to.

**Fix.** Move the input() to the top level and use the name it assigns inside the block.

Before:

```
if useBand
    len = input(20, "Length")
```

After:

```
len = input(20, "Length")
b = sma(close, len)
plot(useBand ? b : none, "Band", aqua)
```

### OS3008 The value is not valid for this parameter

Severity error. Stage checker. Since language version 1. Reference language.md 13.3. Test `tests/unit/check-calls.test.ts`.

**Message.** `{argument} accepts {values}; {found} is not one of them.`

- `{argument}` is the parameter, option or setting key.
- `{values}` is the accepted values or the accepted form, written out.
- `{found}` is the value that was written or that the host supplied.
- `{suggestion}` is the accepted value closest to what was written.

**Cause.** Some parameters take a value out of a fixed set, or in a fixed written form, rather than free text, because each one selects a different rule in the engine or the report. Two cases arrive here: a name that is not in the set, and a structured string that does not parse, a session window for instance. An unknown name has no rule to select, and defaulting quietly would change what the script does without saying so. The same failure in a setting the host supplied is OS6019, because there the value came from outside the source.

**Fix.** Use one of {values}; {suggestion} is the closest to what was written.

Before:

```
strategy("Breakout", qtyType = "shares")
```

After:

```
strategy("Breakout", qtyType = "units")
```

### OS3009 This option needs another option to be set

Severity error. Stage checker. Since language version 1. Reference language.md 7.5, 13.2. Test `tests/unit/check-calls.test.ts`.

**Message.** `{option} = {value} requires {required}.`

- `{option}` is the option that was set.
- `{value}` is the value it was set to.
- `{required}` is the option and value it depends on.

**Cause.** A few options only mean something in combination. An alert that fires on every execution of a bar only has executions to fire on in a file that acts on unconfirmed bars. Accepting the option on its own would leave it doing nothing, silently, which is the worst of the three possible behaviours.

**Fix.** Set {required} in the declaration, or choose a value of {option} that stands on its own.

Before:

```
study("Ticks")

if close > open
    alert("Up", id = "up", frequency = "everyUpdate")
```

After:

```
study("Ticks", onUnconfirmed = true)

if close > open
    alert("Up", id = "up", frequency = "everyUpdate")
```

### OS3010 Two arguments that cannot both be given

Severity error. Stage checker. Since language version 1. Reference language.md 13.3, 15.3. Test `tests/unit/check-calls.test.ts`.

**Message.** `{first} and {second} set the same thing two ways.`

- `{first}` is the first of the two arguments.
- `{second}` is the second of the two arguments.

**Cause.** Two arguments that set one thing have to be reconciled, and every rule for reconciling them surprises somebody, so the call is refused and the script says which it meant. There are three pairs. An exit level can be written as an absolute price or as a distance from the entry, and the candidate rules (the nearer one, the later one, the absolute one) each surprise someone. A band takes color for both of its sides, or colorUp and colorDown for the leading and the lagging side, and color together with either of those leaves no answer for which side wins. The third is a relative leg described as a future and given a right or a strike offset, which are fields of an option.

**Fix.** Keep one of the two: an absolute price or a distance from the entry, one colour for the whole band or a colour for each side, and on a leg described as a future neither right nor strikeOffset.

Before:

```
exit(limit = 105, profit = 5)
```

After:

```
exit(limit = 105)
```

### OS3011 Argument has the wrong type

Severity error. Stage checker. Since language version 1. Reference language.md 5.2, 5.3. Test `tests/unit/check-calls.test.ts`.

**Message.** `{name}'s {argument} is {expected}; {found} was given.`

- `{name}` is the function being called.
- `{argument}` is the parameter name.
- `{expected}` is the declared parameter type.
- `{found}` is the type of the expression at the call site.

**Cause.** Arguments are checked against the declared parameter types, with broadcast as the only widening: a plain value may be passed where a series is expected, and it is read as that same value on every bar. Nothing else converts on its own. A declaration handle passed to an argument that does not take one arrives here too; where that argument wanted a runtime object the case has its own code, OS3019, and fill's two plot arguments have OS3020.

**Fix.** Convert the value with text(), toNumber() or toBool(), or pass an expression of type {expected}.

Before:

```
e = ema(close, "9")
```

After:

```
e = ema(close, 9)
```

### OS3012 A required argument is missing

Severity error. Stage checker. Since language version 1. Reference language.md 11.2, 13.2. Test `tests/unit/check-calls.test.ts`.

**Message.** `{name} requires {argument}, which has no default.`

- `{name}` is the function being called.
- `{argument}` is the parameter that was left out.
- `{example}` is a filled-in call showing the argument in place.

**Cause.** A parameter without a default has no value the engine could invent. The title of a study and the source of an indicator are the common cases, and an order's leg argument in a file that declares more than one leg is a third: with several contracts to choose from there is none the engine could pick.

**Fix.** Pass {argument} at the call site, as the example shows: {example}.

Before:

```
study(overlay = true)
```

After:

```
study("Range breakout", overlay = true)
```

### OS3013 Argument given twice

Severity error. Stage checker. Since language version 1. Reference language.md 11.2. Test `tests/unit/check-calls.test.ts`.

**Message.** `{argument} is given twice at this call site.`

- `{argument}` is the parameter that received two values.

**Cause.** A named argument may not repeat one already filled by position, and may not appear twice. Either would leave the reader guessing which value wins.

**Fix.** Delete one of the two, keeping the value that was meant.

Before:

```
b = band(close, 50, len = 20)
```

After:

```
b = band(close, len = 20)
```

### OS3014 limits() is in the wrong place

Severity error. Stage checker. Since language version 1. Reference language.md 10.7. Test `tests/unit/check-calls.test.ts`.

**Message.** `limits() appears at most once, immediately after the declaration; this one is at line {line}.`

- `{line}` is the line the limits() call was found on.

**Cause.** The budgets apply to the whole run and are read before the first bar. One fixed position means a reader can see a script's budgets without searching the file, and two calls would need a rule for which one wins.

**Fix.** Move the limits() line directly under study(...) or strategy(...), and merge two calls into one.

Before:

```
study("Heavy")

len = input(20, "Length")
limits(loops = 50_000_000)
```

After:

```
study("Heavy")
limits(loops = 50_000_000)

len = input(20, "Length")
```

### OS3015 limits() takes literal numbers

Severity error. Stage checker. Since language version 1. Reference language.md 10.7. Test `tests/unit/check-calls.test.ts`.

**Message.** `limits() is read before the first bar, so {option} must be a literal number.`

- `{option}` is the limits option that was given a computed value.

**Cause.** The engine allocates against these budgets before it runs anything, so there is no bar on which a computed budget could be evaluated. An input() is not accepted here either, because a budget that a settings dialog can change is a budget a reader cannot see.

**Fix.** Write the number: limits(loops = 50_000_000).

Before:

```
limits(loops = maxBars * 1000)
```

After:

```
limits(loops = 50_000_000)
```

### OS3016 range must be a low and a high

Severity error. Stage checker. Since language version 1. Reference language.md 13.2. Test `tests/unit/check-calls.test.ts`.

**Message.** `range is [{low}, {high}]; it takes two numbers and the first must be below the second.`

- `{low}` is the first element as written.
- `{high}` is the second element as written.

**Cause.** The range option fixes the study pane's scale, so it is exactly two numbers in axis order. A reversed or single-element range has no scale to build.

**Fix.** Write two numbers, lowest first: range = [0, 100].

Before:

```
study("RSI", range = [100, 0])
```

After:

```
study("RSI", range = [0, 100])
```

### OS3017 Two of these share a name

Severity error. Stage checker. Since language version 1. Reference language.md 15.3. Test `tests/unit/check-calls.test.ts`.

**Message.** `{kind} names must be unique in a file; {name} is also used at line {line}.`

- `{kind}` is the thing being named: plot, plotCandles, level, input, table, alert or leg.
- `{name}` is the repeated name, quoted.
- `{line}` is the line of the first use of that name.

**Cause.** The legend row, the settings dialog and the saved layout all key a column by its name, and an alert message names it. Two columns with one name would overwrite each other's saved settings. fill is not on the list: a band has no name of its own and is identified by the two plots it is drawn between. A leg's name is what every later call keys on, so two legs with one name leave every leg call with no answer. An alert is named by its id, written or derived from the line, and a subscription is kept under that name, so two alerts sharing one leave the user subscribed to whichever of the two the host kept.

**Fix.** Rename one of them so each name appears once.

Before:

```
plot(fast, "EMA", aqua)
plot(slow, "EMA", orange)
```

After:

```
plot(fast, "EMA fast", aqua)
plot(slow, "EMA slow", orange)
```

### OS3018 The default is not in the options list

Severity error. Stage checker. Since language version 1. Reference language.md 13.4. Test `tests/unit/check-calls.test.ts`.

**Message.** `This input's default {default} is not one of options {values}.`

- `{default}` is the default value as written.
- `{values}` is the options list as written.

**Cause.** An input with options is a dropdown, and its default is the row that is selected when the dialog opens. A default outside the list leaves the dialog with nothing selected and the script with a value the user cannot reproduce.

**Fix.** Add {default} to options, or make the default one of the listed values.

Before:

```
mode = input("medium", "Mode", options = ["fast", "slow"])
```

After:

```
mode = input("fast", "Mode", options = ["fast", "slow"])
```

### OS3019 A declaration handle in an object argument

Severity error. Stage checker. Since language version 1. Reference language.md 5.4, 15.3. Test `tests/unit/check-calls.test.ts`.

**Message.** `{name}'s {argument} is {expected}; {found} is a declaration handle, which has no value at run time.`

- `{name}` is the function being called.
- `{argument}` is the parameter name.
- `{expected}` is the object type the parameter takes.
- `{found}` is the handle type at the call site: plot, fill or level.

**Cause.** plot(), plotCandles(), fill() and level() return a declaration handle: the compile-time half of a declaration, an entry in the program's outputs, with no run-time representation at all. The draw setters, cell() and clear() take a runtime object, which is a value the script made on a bar and can keep, move and delete. The two kinds are separated in the type system for exactly this reason, and fill() is the one call in version 1 that takes a handle.

**Fix.** Pass an object the script created with draw.line(), draw.box() or draw.label(), and change a plot's own appearance through the arguments of the plot call instead.

Before:

```
upper = plot(basis + dev, "Upper", aqua)
draw.setColor(upper, red)
```

After:

```
plot(basis + dev, "Upper", color = close > basis ? lime : red)
```

### OS3020 fill needs two declared plots

Severity error. Stage checker. Since language version 1. Reference language.md 5.4, 15.3. Test `tests/unit/check-calls.test.ts`.

**Message.** `fill's {argument} is {found}; it takes a plot declared by plot() or plotCandles().`

- `{argument}` is the parameter that was given the wrong thing, plotA or plotB.
- `{found}` is the type of the expression at the call site.

**Cause.** A band is one entry of the chart contract's shaded bands, and that entry holds the two plot keys the band is drawn between (compiled-program.md 2.8). A bare expression has no key, because no column was ever declared for it, so there is nothing in the contract for it to compile into. Naming the two edges is what makes a band readable as well: it is drawn between two columns the chart already shows, rather than instead of them.

**Fix.** Plot both edges at the top level, name each one, and pass the two names to fill().

Before:

```
fill(basis + dev, basis - dev, color = fade(aqua, 88))
```

After:

```
upper = plot(basis + dev, "Upper", aqua)
lower = plot(basis - dev, "Lower", aqua)
fill(upper, lower, color = fade(aqua, 88))
```

### OS3021 An input written in place has no title

Severity error. Stage checker. Since language version 1. Reference language.md 13.4, host-interface.md 8.1. Test `tests/unit/check-calls.test.ts`.

**Message.** `An input() assigned to no name is named by its title, and this one has no title written as a string literal.`

**Cause.** A host stores one value per input key, and the key is the name the input was assigned to (host-interface.md 8.1). An input written where a value belongs is assigned to no name, so its title is its key as well as its dialog label. The title is read from the line as a string literal rather than folded, because a key and a label are both fixed before anything is computed and because the row a reader sees should be named on the line that declares it. With neither a name nor such a title there is nothing to label the row with and nothing to store a user's value under, and a key made from the input's position instead would move the moment another input was written above it, taking a user's stored value onto a different row.

**Fix.** Give it a title written as a string literal: input(2, "Precision").

Before:

```
study("Range", precision = input(2))
```

After:

```
study("Range", precision = input(2, "Precision"))
```
### OS3022 Two inputs share a settings key

Severity error. Stage checker. Since language version 1. Reference language.md 13.4, host-interface.md 8.1. Test `tests/unit/check-calls.test.ts`.

**Message.** `This input is keyed by its title {name}, which is already the name of the input at line {line}.`

- `{name}` is the title of the input written in place, quoted.
- `{line}` is the line of the input that already carries that key.

**Cause.** A host stores one value per key (host-interface.md 8.1). An input assigned to a name is keyed by that name, and one written in place is keyed by its title, so a title that spells another input's name puts two rows on one key. One user value would then serve two rows and nothing anywhere decides which of them gets it. Two inputs carrying one title are OS3017 for the same reason.

**Fix.** Give this one a title of its own, or rename the input at line {line}.

Before:

```
width = input(2, "Width")
plot(close + width * input(3, "width"), "Band", aqua)
```

After:

```
width = input(2, "Width")
plot(close + width * input(3, "Multiplier"), "Band", aqua)
```

### OS3023 An order names a leg this file does not declare

Severity error. Stage checker. Since language version 1. Reference stdlib.md 17.1, 17.2. Test `tests/unit/check-calls.test.ts`.

**Message.** `{name} was given a {argument}, and this file declares none.`

- `{name}` is the order function that was called.
- `{argument}` is the parameter that names the declaration, which is leg.

**Cause.** Every order function names the leg it acts on, and a leg is a contract declared before the run (stdlib.md 17.1, 17.6). A file that declares no leg has exactly one, the instrument its chart is showing, and every order acts on it with no leg named. So in a file with no leg declaration there is no name a leg argument could carry, and one written there names nothing. Ignored, it is silent in the most expensive way an order can be: a script that entered under one name and closed another flattened the only leg there is and was told nothing, and a name the script computed was dropped just as quietly. It is refused whatever the argument holds, rather than held against a list of accepted values the way OS3008 holds every other fixed set, because here the list is empty and the value is not what is wrong.

**Fix.** Leave {argument} out. A file that declares no leg has exactly one, and every order acts on it.

Before:

```
if pos.isFlat
    buy(qty = 1, leg = "hedge")
else
    close()
```

After:

```
if pos.isFlat
    buy(qty = 1)
else
    close()
```

### OS3024 An input written in place has an empty title

Severity error. Stage checker. Since language version 1. Reference language.md 13.4, host-interface.md 8.1. Test `tests/unit/check-calls.test.ts`.

**Message.** `An input() assigned to no name is named by its title, and this one's title is empty.`

**Cause.** The title of an input written where a value belongs is its settings key as well as its dialog label (host-interface.md 8.1), and the empty string is neither. There is nothing to store a user's value under and nothing to label the row with, and a second input written the same way would land on the same empty key and take the same stored value. This is the case OS3021 refuses, reached by a different edit, and it carries its own code because OS3021 tells a reader to give the input a title written as a string literal and this reader has written one. A message and a fix that are both already true of the program in front of somebody send them to change nothing. What is wrong here is not that the title was left out: it is that the title says nothing, and the fix is to give it something to say. An input assigned to a name is not this. It has a key already, and an empty title there is read as no title and labelled with the name, which language.md 13.4 states.

**Fix.** Give the title something to say: input(2, "Precision").

Before:

```
study("Range", precision = input(2, ""))
```

After:

```
study("Range", precision = input(2, "Precision"))
```

### OS3025 A setting is part of a larger expression here

Severity error. Stage checker. Since language version 1. Reference language.md 13.2. Test `tests/unit/check-plot-options.test.ts`.

**Message.** `{option} is fixed before the first bar and holds an input() only as the whole of its value, so it cannot hold an expression over one.`

- `{option}` is the option or field whose value reads a setting as part of something larger.

**Cause.** A field fixed before bar 0 is written into the compiled program as one of two things: the value itself, which the compiler folds, or a reference to one input, which the engine resolves once at load (compiled-program.md 2.3). An expression over a setting is neither. The compiler cannot fold it, because the setting's value is not known until the host resolves the settings, and the program has no form for an expression evaluated at load, because that would be a second evaluator every engine has to agree on before the first bar. An input's own default, bounds and step are the same kind of field and are held tighter still: they are what the settings dialog shows before anybody has chosen, so none of them may read another setting at all.

**Fix.** Declare the setting as the value itself, with an input() written as the whole of {option}, or write the value out as a literal.

Before:

```
w = input(1, "Width")
plot(close, "Close", aqua, width = w + 1)
```

After:

```
w = input(2, "Width")
plot(close, "Close", aqua, width = w)
```

### OS3026 This option cannot be a setting

Severity error. Stage checker. Since language version 1. Reference language.md 13.4. Test `tests/unit/check-plot-options.test.ts`.

**Message.** `{option} is written into the compiled program as a plain value, so a setting cannot choose it in this format version.`

- `{option}` is the option that was written from an input().

**Cause.** An option fixed before bar 0 carries either its value or a reference to one input, resolved at load (compiled-program.md 2.3), and almost every option takes both. A plot's style takes only the value: its field in the compiled format is a plain string. So an input() written into it could only be folded to its default, the settings row it declares would move nothing, and a select offering values the option does not accept would pass, because the set check reads a value written out and a setting is not one. Widening the field changes the compiled format that every other engine is written against, so it is refused here rather than half carried.

**Fix.** Write the option out as a string literal and drop the input(): style = "step", for instance, is one of the values OS3008 names.

Before:

```
st = input("line", "Style", options = ["line", "step", "area"])
plot(close, "Close", aqua, style = st)
```

After:

```
plot(close, "Close", aqua, style = "step")
```
---

## 8.4 OS4xxx Runtime

### OS4001 History index is not usable

Severity error. Stage engine. Since language version 1. Reference language.md 7.4. Test `tests/engine/machine.test.ts`.

**Message.** `[{index}] is not a whole number of bars at or above zero.`

- `{index}` is the value the index expression produced on this bar.

**Cause.** A history index counts bars back, so it is a whole number and it is never negative: reading the future is not available at any price. A negative literal is caught at compile time as OS3004; this is the computed case.

**Fix.** Wrap the index in floor() or round(), and clamp a computed index with max(0, n).

Before:

```
prev = close[len / 2]
```

After:

```
prev = close[floor(len / 2)]
```

### OS4002 History index is deeper than the retained depth

Severity error. Stage engine. Since language version 1. Reference language.md 7.4, 10.7. Test `tests/engine/machine.test.ts`.

**Message.** `[{index}] reaches past the retained depth of {depth} bars.`

- `{index}` is the index that was requested.
- `{depth}` is the depth the host or the script set.
- `{suggested}` is an adequate depth for this script, being the deepest index it uses.

**Cause.** The value existed and the engine discarded it, which is a different situation from a value that never existed. Conflating the two would hide a real bug behind a plausible gap, so this is an error while a read past the start of history is simply absent.

**Fix.** Raise the depth in one place: limits(history = {suggested}).

Before:

```
study("Long lookback")
limits(history = 50)

old = close[120]
```

After:

```
study("Long lookback")
limits(history = 120)

old = close[120]
```

### OS4003 A whole number was required here

Severity error. Stage engine. Since language version 1. Reference language.md 14.1. Test `tests/engine/machine.test.ts`.

**Message.** `{name}'s {argument} was {found} on this bar; a whole number was required.`

- `{name}` is the function being called.
- `{argument}` is the parameter name.
- `{found}` is the value that reached the call.

**Cause.** An index, a digit count and a repeat count are whole numbers. Where the value is a literal the checker catches it as OS3004; where it is computed it arrives here, on the bar that produced it.

**Fix.** Round the value before passing it: floor() towards zero, round() to nearest.

Before:

```
s = sma(close, len / 2)
```

After:

```
s = sma(close, floor(len / 2))
```

### OS4004 Array index out of range

Severity error. Stage engine. Since language version 1. Reference language.md 14.1. Test `tests/engine/machine.test.ts`.

**Message.** `Index {index} is outside {name}, which holds {size} elements.`

- `{index}` is the index that was requested.
- `{name}` is the array's name.
- `{size}` is the array's element count on this bar.

**Cause.** An array has an extent the script chose, so an index outside it is a mistake rather than a missing measurement. This is deliberately the opposite of the history operator, where reading past the start of history is absence.

**Fix.** Guard the read with size({name}), and index from size({name}) - 1 for the last element.

Before:

```
last = values[10]
```

After:

```
last = size(values) > 10 ? values[10] : none
```

### OS4005 The drawing object no longer exists

Severity error. Stage engine. Since language version 1. Reference language.md 5.4. Test `tests/engine/objects.test.ts`.

**Message.** `This {kind} was deleted on bar {bar} and cannot be changed.`

- `{kind}` is the object kind: line, label, box or polyline.
- `{bar}` is the bar index the object was deleted on.

**Cause.** An object lives from the bar that created it until the bar that deletes it, and nothing else ends its life: dropping the last name that refers to one leaves it on the chart, because there is no collection of unreachable objects. This error is the other side of that rule. A name kept in a var outlives the object it was given, so a setter reaching a deleted object is a script that has lost track of its own state and will go on doing so. A table never arrives here, because a table is never deleted: clear(t) empties it and the grid lives as long as the study. OS8019 warns about the shape that leads here, at compile time.

**Fix.** Assign none to the name on the same path as the delete, and test isNone() on it before changing the object.

Before:

```
var top = none
if isNone(top)
    top = draw.line(time, low, time, high)
if close < open
    draw.delete(top)
draw.setTo(top, time, high)
```

After:

```
var top = none
if isNone(top)
    top = draw.line(time, low, time, high)
if close < open
    draw.delete(top)
    top = none
if not isNone(top)
    draw.setTo(top, time, high)
```

### OS4006 The array is empty

Severity error. Stage engine. Since language version 1. Reference language.md 14.1. No test in this repository names this code.

**Deferred.** Nothing raises this yet. Taking an element from an empty array raises the broader OS4004, and summarising one returns absence, which is the silent drain this entry exists to refuse. Raised when the array library tells the empty case apart from an index outside a filled array, language.md 14.1.

**Message.** `{name} cannot take an element from an empty array.`

- `{name}` is the call, one of pop, shift, min, max or avg.

**Cause.** Removing or summarising an element of an empty array has no answer. Returning absence would let a script drain an array without noticing, which is the bug this catches.

**Fix.** Test size(arr) > 0 before the call.

Before:

```
oldest = shift(window)
```

After:

```
oldest = size(window) > 0 ? shift(window) : none
```

### OS4007 Slice range is invalid

Severity error. Stage engine. Since language version 1. Reference language.md 14.1. No test in this repository names this code.

**Deferred.** Nothing raises this yet. slice takes whatever range it is given and returns a shortened or empty array, so a reversed or out of range pair produces a plausible answer instead of a refusal. Raised when the array library checks the range against the array, language.md 14.1.

**Message.** `slice({from}, {to}) is not a range inside an array of {size} elements.`

- `{from}` is the start index, inclusive.
- `{to}` is the end index, exclusive.
- `{size}` is the array's element count on this bar.

**Cause.** A slice takes from inclusive and to exclusive, so a valid range satisfies 0 <= from <= to <= size. A reversed range is not read backwards, because a slice that silently reverses is a slice nobody can read.

**Fix.** Clamp the bounds: from = max(0, from) and to = min(size(arr), to), with from at or below to.

Before:

```
tail = slice(values, size(values), 0)
```

After:

```
tail = slice(values, max(0, size(values) - 10), size(values))
```

### OS4008 Table cell is outside the table

Severity error. Stage engine. Since language version 1. Reference language.md 15.3. Test `tests/engine/tables.test.ts`.

**Message.** `Cell ({row}, {column}) is outside a table of {rows} rows and {columns} columns.`

- `{row}` is the row index that was written to.
- `{column}` is the column index that was written to.
- `{rows}` is the table's declared row count.
- `{columns}` is the table's declared column count.

**Cause.** A table's shape is declared once, with the study's fixed surface, so a write outside it has no cell to land in. Growing the table on demand would change the layout between bars and would make a saved layout meaningless.

**Fix.** Declare the table with the shape the script writes: table("Summary", {rows}, {columns}).

Before:

```
t = table("Summary", 2, 2)
cell(t, 2, 0, "Total")
```

After:

```
t = table("Summary", 3, 2)
cell(t, 2, 0, "Total")
```

### OS4009 Colour channel is out of range

Severity error. Stage engine. Since language version 1. Reference language.md 3.8. No test in this repository names this code.

**Deferred.** Nothing raises this yet. The colour calls build a colour from whatever channels they are given, so a channel outside its range reaches the chart rather than stopping the bar. Raised when the colour library checks each channel, language.md 3.8.

**Message.** `{name}'s {argument} is {found}; channels run 0 to 255 and alpha runs 0 to 1.`

- `{name}` is the colour function: rgb, rgba or fade.
- `{argument}` is the channel that was out of range.
- `{found}` is the value that reached the call.

**Cause.** A colour channel outside its range has no rendering, and clamping silently would make a study whose colours are a computation look right at the edges and wrong in between.

**Fix.** Clamp the value where it is computed: rgb(min(255, max(0, r)), g, b).

Before:

```
tint = rgb(255 * strength, 0, 0)
```

After:

```
tint = rgb(min(255, max(0, 255 * strength)), 0, 0)
```

### OS4010 Calendar field is out of range

Severity error. Stage engine. Since language version 1. Reference language.md 15.2. No test in this repository names this code.

**Deferred.** Nothing raises this yet. Building a date returns absence only when a field is not a whole number, so a month past the end of the year rolls into the next one and becomes a timestamp the script never meant. Raised when the calendar library checks each field against its range, language.md 15.2.

**Message.** `{field} is {found}; it runs {range}.`

- `{field}` is the calendar field: year, month, day, hour, minute or second.
- `{found}` is the value that reached the call.
- `{range}` is the accepted range for that field.

**Cause.** A date is built from fields that each have a range, and a month of 13 is a script bug rather than a date. Rolling over into the next year would turn an off-by-one into a silently wrong timestamp, which in a session test is a whole day of wrong signals.

**Fix.** Pass a value inside {range}, carrying the overflow into the field above it as the example does.

Before:

```
t = date.from(2026, month + 1, 1)
```

After:

```
t = date.from(2026 + floor(month / 12), mod(month, 12) + 1, 1)
```

### OS4011 String position is outside the string

Severity error. Stage engine. Since language version 1. Reference language.md 15.2. No test in this repository names this code.

**Deferred.** Nothing raises this yet. Taking part of a string slices the code points it holds, so a position outside the string returns a shorter string or an empty one, which is the plausible empty result this entry refuses. Raised when the string library checks the position against the string, language.md 15.2.

**Message.** `Position {index} is outside a string of {length} characters.`

- `{index}` is the position that was requested.
- `{length}` is the string's length in characters.

**Cause.** A string position addresses an existing character, counted in Unicode code points. Returning an empty string instead would let a parsing loop run off the end and produce a plausible empty result.

**Fix.** Guard with str.length(s), or clamp the position with min() before the call.

Before:

```
c = str.substring(sym, 10, 11)
```

After:

```
c = str.length(sym) > 10 ? str.substring(sym, 10, 11) : ""
```

### OS4012 That value is not one of the accepted names

Severity error. Stage engine. Since language version 1. Reference language.md 14.1. No test in this repository names this code.

**Deferred.** Nothing raises this yet. A computed name outside the accepted set produces absence on every bar rather than stopping, and only a name written as a literal is refused, at compile time, with OS3008. Raised when the engine checks a computed name on the bar that produced it, language.md 14.1.

**Message.** `{argument} accepts {values}; {found} was computed on this bar.`

- `{argument}` is the parameter name.
- `{values}` is every accepted value, quoted and comma separated.
- `{found}` is the value that reached the call.

**Cause.** The compile-time form of this is OS3008. Where the value is computed, the check happens on the bar that produced it, because a name that selects an engine rule cannot be guessed at and cannot be defaulted without changing what the script does.

**Fix.** Produce the value from an input() with an options list, so only accepted names can reach the call.

Before:

```
sortOrder = up ? "ascending" : "desc"
sort(values, sortOrder)
```

After:

```
sortOrder = up ? "asc" : "desc"
sort(values, sortOrder)
```

### OS4013 A loop bound is absent

Severity error. Stage engine. Since language version 1. Reference language.md 10.3. Test `tests/engine/machine.test.ts`.

**Message.** `This loop's {bound} is absent on this bar.`

- `{bound}` is the bound that was absent: start, limit or step.

**Cause.** A counted loop needs three numbers before it can begin. Absence propagates through arithmetic and comparison, but a loop cannot propagate it: it either runs or it does not. Treating an absent bound as zero iterations would skip work the script asked for and leave a plot that looks computed, so the bar stops instead.

**Fix.** Give the bound a value with orElse(), or guard the loop with isNone() so a warmup bar skips it deliberately.

Before:

```
for i = 0 to lookback
    total += close[i]
```

After:

```
if not isNone(lookback)
    for i = 0 to lookback
        total += close[i]
```

---

## 8.5 OS5xxx Limits

### OS5001 Loop budget exhausted

Severity error. Stage engine. Since language version 1. Reference language.md 10.7. Test `tests/engine/budget.test.ts`.

**Message.** `This bar used its {budget} loop iterations, and the loop at line {line} was still running.`

- `{budget}` is the per-bar iteration budget in force.
- `{line}` is the line of the loop that was running when the budget ran out.
- `{suggested}` is a budget that would have completed this bar, rounded up.

**Cause.** Every iteration of every loop counts against one per-bar budget, so a script with one nested loop is treated like a script with ten sequential ones, and the budget resets each bar so a long dataset is not itself a reason to fail. The bar stops rather than breaking out of the loop, because a loop that ran two million times and then stopped produces a plausible wrong number, which is worse than no number.

**Fix.** Fix the exit condition, or raise the budget in one line: limits(loops = {suggested}).

Before:

```
while close[i] > close[i + 1]
    total += close[i]
```

After:

```
while i < 500 and close[i] > close[i + 1]
    total += close[i]
    i += 1
```

### OS5002 The array is too large

Severity error. Stage engine. Since language version 1. Reference language.md 14.1. Test `tests/engine/budget.test.ts`.

**Not exercised.** The ceiling is the engine's own and it is a large one, so an example that reached it would be a run long enough to fill it rather than a script anybody would read. The before block shows the window that is never trimmed, which is the shape that gets there, and not the bar it stops on.

**Message.** `An array holds at most {max} elements; {name} reached {size}.`

- `{max}` is the element ceiling.
- `{name}` is the array's name.
- `{size}` is the size the array reached.

**Cause.** The ceiling exists so that one script cannot exhaust a browser tab's memory and take the chart with it. It is not raised by limits() in version 1, because an array that large is almost always a window that is never trimmed.

**Fix.** Drop the oldest element as you append: if size(arr) > 500, shift(arr).

Before:

```
var window = [0.0]
push(window, close)
```

After:

```
var window = [0.0]
push(window, close)
if size(window) > 500
    shift(window)
```

### OS5003 The host refused this limits() value

Severity error. Stage host. Since language version 1. Reference language.md 10.7; host-interface.md 10.1. Test `tests/engine/verify.test.ts`.

**Message.** `This host allows {option} up to {max}; the file asks for {found}.`

- `{option}` is the limits option.
- `{max}` is the host's ceiling.
- `{found}` is the value the file asked for.

**Cause.** A host that will not run a budget says so instead of quietly capping it, because a script that silently ran under a smaller budget would produce numbers its author never asked for and could not reproduce.

**Fix.** Lower {option} to {max} or below, or run the file on a host that allows more.

Before:

```
limits(loops = 500_000_000)
```

After:

```
limits(loops = 50_000_000)
```

### OS5004 The program needs more state regions than the engine allows

Severity error. Stage host. Since language version 1. Reference compiled-program.md, state regions. Test `tests/engine/verify.test.ts`.

**Message.** `This program needs {found} state regions and the engine allows {max}; {first} calls {second} on several paths.`

- `{found}` is the number of state regions the compiler would allocate.
- `{max}` is the engine's declared region count.
- `{first}` is the outer function in the nesting that caused it.
- `{second}` is the function it calls more than once.

**Cause.** State is allocated per call path, which is what lets one function body serve many independent pieces of state. The number of paths grows multiplicatively when several functions each call the next more than once. The compiler reports it rather than emitting a program no engine will load.

**Fix.** Call the inner function once at the top level, give its result a name, and pass that name down.

Before:

```
fn inner(src) => ema(src, 20)
fn outer(src) => inner(src) - inner(src[1])
v = outer(close) + outer(hlc3)
```

After:

```
fn inner(src) => ema(src, 20)
base = inner(close)
v = base - base[1]
```

### OS5005 Nesting is too deep

Severity error. Stage parser. Since language version 1. Reference language.md 19. Test `tests/unit/parse-diagnostics.test.ts`.

**Not exercised.** The ceiling is far above anything written by hand, which is the whole point of it: generated source is how a file reaches it. The before block shows the shape at four levels, where a reader can see it, and nothing that short can raise the code.

**Message.** `{construct} is nested {found} deep and the ceiling is {max}.`

- `{construct}` is the construct that nested too deeply: an expression, a block or a call.
- `{found}` is the nesting depth reached.
- `{max}` is the nesting ceiling.

**Cause.** The ceiling keeps the parser, the checker and the engine inside a bounded stack, so no input can stop a tab. It applies to source nesting at compile time and to call depth at run time, and it is far above anything a person writes by hand: generated source is the usual way to reach it.

**Fix.** Flatten it: give the inner expression a name at the top level and use the name.

Before:

```
z = a ? b ? c ? d ? 1 : 2 : 3 : 4 : 5
```

After:

```
inner = c ? (d ? 1 : 2) : 3
z = a ? (b ? inner : 4) : 5
```

### OS5006 Too many outstanding data requests

Severity error. Stage host. Since language version 1. Reference language.md 15.2. Test `tests/engine/requests-load.test.ts`.

**Message.** `This file makes {found} data requests and the host allows {max}.`

- `{found}` is the number of distinct requests in the file.
- `{max}` is the host's ceiling on concurrent requests.

**Cause.** Each higher timeframe or other-instrument read is a separate series the host fetches and keeps in step with the chart. The ceiling is the host's, and it is reported rather than silently dropping the requests past it, because a dropped request is a plot that quietly turns absent.

**Fix.** Keep one request per symbol and timeframe, reuse the name it assigns, and delete the requests whose results are unused.

Before:

```
dayHigh = req.timeframe("1D", high)
prevHigh = req.timeframe("1D", high)[1]
weekHigh = req.timeframe("1W", high)
```

After:

```
dayHigh = req.timeframe("1D", high)
prevHigh = dayHigh[1]
weekHigh = req.timeframe("1W", high)
```

### OS5007 The bar took too long

Severity error. Stage host. Since language version 1. Reference language.md 7.1. Test `tests/engine/budget.test.ts`.

**Message.** `Bar {bar} ran for {ms} ms and the host allows {max} ms.`

- `{bar}` is the bar index that exceeded the budget.
- `{ms}` is the time the bar took.
- `{max}` is the host's per-bar time budget.

**Cause.** A server running many strategies gives each bar a wall-clock budget, so one script cannot starve the rest. Work that does not change from bar to bar is the usual cause: recomputing over the whole history on every bar turns a linear study into a quadratic one.

**Fix.** Keep a running value in a var and update it per bar instead of recomputing over the whole history.

Before:

```
total = 0.0
for i = 0 to bar.index
    total += close[i]
```

After:

```
var total = 0.0
total += close
```

### OS5008 The string is too long

Severity error. Stage engine. Since language version 1. Reference language.md 5.1. Test `tests/engine/budget.test.ts`.

**Not exercised.** The ceiling is the engine's own and a bar appends a few characters, so reaching it takes a run of thousands of bars rather than an example. The before block shows the log that is never trimmed, which is the shape that gets there.

**Message.** `A string holds at most {max} characters; this one reached {found}.`

- `{max}` is the character ceiling.
- `{found}` is the length that was reached.

**Cause.** The ceiling catches the one shape that grows without bound by accident: text appended to a persistent string on every bar, which is a log that nothing ever trims.

**Fix.** Keep the pieces in an array, trim it to the rows you display, and join only those.

Before:

```
var logLines = ""
logLines += text(close) + "\n"
```

After:

```
var logLines: array<string> = []
push(logLines, text(close))
if size(logLines) > 50
    shift(logLines)
```

### OS5009 The program is too large

Severity error. Stage host. Since language version 1. Reference language.md 10.7. Test `tests/engine/verify.test.ts`.

**Message.** `This file compiles to {found} instructions and the ceiling is {max}.`

- `{found}` is the instruction count the compiler produced.
- `{max}` is the instruction ceiling.

**Cause.** The compiled program is held in memory per chart and per running strategy, so it has a size the host is willing to hold. A file at this size is nearly always repeated blocks that a function would collapse.

**Fix.** Move the repeated block into a fn and call it, and delete branches the script no longer uses.

Before:

```
a1 = sma(close, 10)
a2 = sma(close, 20)
a3 = sma(close, 30)
```

After:

```
fn avgOf(len) => sma(close, len)
a1 = avgOf(10)
a2 = avgOf(20)
a3 = avgOf(30)
```

### OS5010 Too many drawing objects

Severity error. Stage engine. Since language version 1. Reference stdlib.md 14.4. Test `tests/engine/objects.test.ts`.

**Not exercised.** The ceiling is the host's and a bar creates one object, so reaching it takes a run of thousands of bars rather than an example. The before block shows the script that creates on every bar and deletes on none, which is the shape that gets there.

**Message.** `A script holds at most {max} drawing objects; this one would be number {found}.`

- `{max}` is the number of drawing objects the host will hold at once.
- `{found}` is the count the object being created would have reached.

**Cause.** An object lives until the script deletes it, so a script that creates one on every bar and deletes none grows for as long as the chart is open, and nothing can reclaim it: an undeleted object is held by the chart whether or not the script still names it. The ceiling is the host's, and reaching it stops the bar and names the number. The oldest object is never dropped to make room, because a study that is correct on the right of the chart and quietly wrong on the left is worse than one that stops.

**Fix.** Delete each object when it stops being wanted, and bound the set: keep the objects in an array, and when it is longer than you want, delete the oldest object and remove the element.

Before:

```
var zones: array<box> = []
push(zones, draw.box(time, low, time, high))
```

After:

```
var zones: array<box> = []
push(zones, draw.box(time, low, time, high))
if size(zones) > 50
    draw.delete(element(zones, 0))
    shift(zones)
```

---

## 8.6 OS6xxx Data

### OS6001 Unknown timeframe

Severity error. Stage checker. Since language version 1. Reference language.md 15.2. Test `tests/unit/check-repaint.test.ts`.

**Message.** `{value} is not a timeframe.`

- `{value}` is the string that was passed as a timeframe.

**Cause.** A timeframe is a count and a unit, written as a string: m for minutes, h for hours, D for days, W for weeks and M for months. The unit letters are case sensitive, so "1M" is one month and "1m" is one minute. A bare number is read as minutes, because that is the form an interval input supplies, so "60" and "1h" are the same timeframe.

**Fix.** Write a count and a unit, or a bare number of minutes: "5m", "1h", "1D", "1W", "60".

Before:

```
d = req.timeframe("hourly", high)
```

After:

```
d = req.timeframe("1h", high)
```

### OS6002 The requested timeframe is lower than the chart's

Severity error. Stage host. Since language version 1. Reference language.md 15.2. Test `tests/engine/requests-load.test.ts`.

**Message.** `The chart is {chart} and the request asks for {requested}.`

- `{chart}` is the chart's interval.
- `{requested}` is the interval that was requested.

**Cause.** Folding a lower timeframe into a higher bar needs data from inside the bar, which the chart was not given. Inventing it is the definition of a repainting study, so the request is refused rather than approximated.

**Fix.** Request {chart} or higher, or change the chart's interval to the lower one and fold upwards instead.

Before:

```
m5 = req.timeframe("5", close)
```

After:

```
h1 = req.timeframe("60", close)
```

### OS6003 A per-bar name inside a request expression

Severity error. Stage checker. Since language version 1. Reference language.md 15.2. Test `tests/unit/check-repaint.test.ts`.

**Message.** `{name} is computed on this chart's bars, so it has no meaning on the requested ones.`

- `{name}` is the file-scope name that was read inside the expression.

**Cause.** The expression passed to a request is evaluated on the requested instrument's bars, in its own time. A name from this file may be read there only when it is a compile-time constant: a literal, arithmetic over literals, or an input(). A value computed on this chart's bars has no counterpart on the requested ones, and there is no honest answer for what it would mean there.

**Fix.** Move the calculation inside the request expression, or pass a constant: a literal or an input().

Before:

```
m = sma(close, 20)
d = req.timeframe("1D", close > m)
```

After:

```
d = req.timeframe("1D", close > sma(close, 20))
```

### OS6004 The library manifest disagrees with the program

Severity error. Stage host. Since language version 1. Reference compiled-program.md, the function table. Test `tests/engine/verify.test.ts`.

**Host input.** The example below is the input that fails and the input that passes rather than a script, because this code is about what the engine was handed and not about what anybody wrote.

**Message.** `Entry {index} of the program names {name} with {arity} arguments; this engine's manifest has {manifest}.`

- `{index}` is the entry's index in the program's function table.
- `{name}` is the function name the program carries.
- `{arity}` is the argument count the program carries.
- `{manifest}` is what the engine's manifest says about that name.

**Cause.** A compiled program carries its own function table, and the engine checks every entry against its manifest at load: the name must exist, the argument count must match, and the state and effect facts must agree. The entries carry facts the engine already knows precisely so that they can be disagreed with, which catches a program compiled against a different library before it computes a single wrong number.

**Fix.** Recompile the script against this engine's library, or run the program on an engine with the library version it was compiled against.

Before:

```
program: library 5, entry 12 name "stdev" arity 3
engine:  library 4, entry "stdev" arity 2
```

After:

```
program: library 4, entry 12 name "stdev" arity 2
engine:  library 4, entry "stdev" arity 2
```

### OS6005 Unknown timezone

Severity error. Stage host. Since language version 1. Reference language.md 15.2. Test `tests/stdlib/calendar.test.ts`.

**Message.** `{value} is not a timezone this host knows.`

- `{value}` is the timezone name that was given.

**Cause.** Timezone names come from the host's timezone database, and an abbreviation is not one of them: several abbreviations mean two different offsets in different parts of the world, which is the kind of ambiguity a session test cannot carry.

**Fix.** Use a full area and location name from the host's list, or leave the argument out to use the chart's own timezone.

Before:

```
h = date.hour(time, "IST")
```

After:

```
h = date.hour(time, "Asia/Kolkata")
```

### OS6006 The engine lacks a capability the program requires

Severity error. Stage host. Since language version 1. Reference compiled-program.md, capability tags. Test `tests/engine/verify.test.ts`.

**Host input.** The example below is the input that fails and the input that passes rather than a script, because this code is about what the engine was handed and not about what anybody wrote.

**Message.** `This program requires {tag} and this engine does not have it.`

- `{tag}` is the first required capability tag the engine does not have.

**Cause.** A compiled program lists the capability tags it needs, and the engine compares the list against its own at load. Tags are the real compatibility mechanism and the format version is the coarse one. Refusing at load is better than meeting an instruction the engine cannot execute halfway through a bar, with half a chart already drawn.

**Fix.** Run the program on an engine that has {tag}, or remove the feature that needs it: the tag names it.

Before:

```
program requires: core.1, arrays, orders
engine has:       core.1, arrays
```

After:

```
program requires: core.1, arrays
engine has:       core.1, arrays
```

### OS6007 Unknown symbol or exchange

Severity error. Stage host. Since language version 1. Reference language.md 15.2. Test `tests/hosts/host.ts`.

**Message.** `The host does not know {symbol} on {exchange}.`

- `{symbol}` is the symbol that was requested.
- `{exchange}` is the exchange that was requested, or the chart's when none was given.

**Cause.** A symbol is resolved by the host against the instruments it can serve. An unknown one is reported rather than returning an empty series, because an empty series looks exactly like an instrument that did not trade.

**Fix.** Correct the symbol, and name the exchange it trades on when it is not the chart's: req.symbol("SYMBOL", "1D", close, exchange = "EXCHANGE").

Before:

```
other = req.symbol("SYMBL", "1D", close)
```

After:

```
other = req.symbol("SYMBOL", "1D", close, exchange = "EXCHANGE")
```

### OS6008 The request returned no bars

Severity error. Stage host. Since language version 1. Reference language.md 15.2. Test `tests/hosts/host.ts`.

**Message.** `{symbol} at {timeframe} returned no bars over the range this chart covers.`

- `{symbol}` is the symbol that was requested.
- `{timeframe}` is the interval that was requested.

**Cause.** The host resolved the instrument and had nothing to send for the range. An instrument that had not listed yet, a contract that has expired and a range before the stored history begins all arrive here.

**Fix.** Move the chart's range into the period the instrument traded, or request a symbol that covers it.

Before:

```
fut = req.symbol("EXPIRED_CONTRACT", "1D", close)
```

After:

```
fut = req.symbol("CURRENT_CONTRACT", "1D", close)
```

### OS6009 The request failed

Severity error. Stage host. Since language version 1. Reference language.md 15.2. Test `tests/engine/requests-host.test.ts`.

**Message.** `The host could not fetch {symbol} at {timeframe}: {reason}.`

- `{symbol}` is the symbol that was requested.
- `{timeframe}` is the interval that was requested.
- `{reason}` is the host's own description of the failure.

**Cause.** The host reached its data source and the source refused or did not answer. A connection that is down, a subscription that does not cover the instrument and a rate limit all arrive here, carrying the reason the host gave.

**Fix.** Act on {reason} in the host: it is a connection, permission or quota problem. Where the value can be derived from the chart's own bars, derive it and drop the request.

Before:

```
dayHigh = req.timeframe("1D", high)
```

After:

```
var dayHigh = none
if session.isFirstBar
    dayHigh = high
else
    dayHigh = max(dayHigh, high)
```

### OS6010 The engine was given no bars

Severity error. Stage host. Since language version 1. Reference language.md 7.1. Test `tests/engine/series.test.ts`.

**Host input.** The example below is the input that fails and the input that passes rather than a script, because this code is about what the engine was handed and not about what anybody wrote.

**Message.** `There are no bars for {symbol} at {timeframe}, so the script cannot run.`

- `{symbol}` is the chart's symbol.
- `{timeframe}` is the chart's interval.

**Cause.** The script is the body of the per-bar loop, and a loop over zero bars produces nothing to plot and nothing to report. Saying so is better than an empty pane, which looks like a script that computed nothing.

**Fix.** Choose an instrument and interval that have history, or widen the chart's date range until bars exist.

Before:

```
host input: symbol SYMBOL, interval 5, bars 0
```

After:

```
host input: symbol SYMBOL, interval 5, bars 1240
```

### OS6011 The bars are not in order

Severity error. Stage host. Since language version 1. Reference language.md 7.1. Test `tests/engine/series.test.ts`.

**Host input.** The example below is the input that fails and the input that passes rather than a script, because this code is about what the engine was handed and not about what anybody wrote.

**Message.** `Bar {index} is dated {time}, which is not after bar {previous}.`

- `{index}` is the index of the offending bar.
- `{time}` is that bar's timestamp.
- `{previous}` is the index of the bar before it.

**Cause.** Every engine assumes strictly increasing bar times: the history operator, warmup and every session test are defined against that order. Running on duplicated or reversed bars would make every one of those meaningless, quietly.

**Fix.** Reload the history; if the same bar repeats, the feed is sending duplicates and the host has to sort and deduplicate the bars before the engine runs.

Before:

```
host input:
  bar 41  09:15
  bar 42  09:15
  bar 43  09:10
```

After:

```
host input:
  bar 41  09:10
  bar 42  09:15
  bar 43  09:20
```

### OS6012 An instrument fact is not known

Severity error. Stage host. Since language version 1. Reference host-interface.md 4.5. Test `tests/engine/requests-host.test.ts`.

**Host input.** The example below is the input that fails and the input that passes rather than a script, because this code is about what the engine was handed and not about what anybody wrote.

**Message.** `The host did not supply {fact} for {symbol}.`

- `{fact}` is what the instrument record lacks for something that cannot default it: a timezone for the session it states, a timezone the calendar can read, a session spelled HH:MM, or session days numbered 1 to 7.
- `{symbol}` is the instrument it is missing for.

**Cause.** An instrument fact the host did not state is absent, and a bare read of one, chart.tickSize or chart.lotSize among them, returns the absent value a script can test with isNone (stdlib.md 3.4). This error is the other case: something that needs the fact and has no way to proceed without it. A session with no timezone is a window with no clock to read it in, so every session test on that host would answer absence on every bar and every session study would draw nothing with nothing said. The engine refuses the record at load instead, before any bar runs, because the fact comes from the instrument record (host-interface.md 4.1) and not from the bars, and a guessed zone is silently wrong for half the year anywhere a clock changes with the season.

**Fix.** Supply {fact} in the host's instrument record for {symbol}, or leave the session out of the record, which makes every session read absent rather than wrong.

Before:

```
host instrument record:
  session   09:15 to 15:30, days 1 to 5
  timezone  not stated
```

After:

```
host instrument record:
  session   09:15 to 15:30, days 1 to 5
  timezone  UTC
```

### OS6013 The request changed after the first bar

Severity error. Stage engine. Since language version 1. Reference language.md 15.2. No test in this repository names this code.

**Deferred.** Nothing raises this yet. A read's identity is settled once before bar 0 and nothing asks again, so there is no second identity for the engine to compare the first one against. Raised when the engine resolves a read's identity per bar, language.md 15.2.

**Message.** `This request asked for {first} on bar 0 and for {found} on bar {bar}.`

- `{first}` is the symbol and timeframe requested on the first bar.
- `{found}` is the symbol and timeframe requested on this bar.
- `{bar}` is the bar index where it changed.

**Cause.** The host fetches a requested series once, keyed by symbol and timeframe, and keeps it in step with the chart. A request whose identity changes mid-run would need a second fetch on a bar that has already been drawn, so the identity is fixed before the run.

**Fix.** Compute the symbol and the timeframe from literals or inputs, not from bar data.

Before:

```
tf = close > open ? "60" : "1D"
h = req.timeframe(tf, high)
```

After:

```
tf = input("60", "Higher timeframe", kind = "interval")
h = req.timeframe(tf, high)
```

### OS6014 The feed does not offer this timeframe

Severity error. Stage host. Since language version 1. Reference language.md 15.2. Test `tests/hosts/reads.ts`.

**Message.** `The host has no {timeframe} data for {symbol}; it offers {available}.`

- `{timeframe}` is the interval that was requested.
- `{symbol}` is the instrument it was requested for.
- `{available}` is the intervals the host can serve for it.

**Cause.** A timeframe can be well formed and still be one the feed does not store for this instrument. Building it from a lower one is the host's decision to offer or not, and the script is told which intervals exist rather than receiving a silently empty series.

**Fix.** Request one of {available}, or derive the interval you want from a lower one the host does serve.

Before:

```
r = req.timeframe("3", close)
```

After:

```
r = req.timeframe("5", close)
```

### OS6015 The requested timeframe does not fold into the chart's

Severity error. Stage host. Since language version 1. Reference language.md 15.2. Test `tests/engine/requests-load.test.ts`.

**Message.** `{requested} is not a whole multiple of {chart}.`

- `{requested}` is the interval that was requested.
- `{chart}` is the chart's interval.
- `{suggestion}` is the nearest interval above the requested one that is a whole multiple of the chart's.

**Cause.** An intraday request is folded by counting chart bars, so its interval must be a whole multiple of the chart's. Day, week and month requests are folded by the calendar instead, keyed by the civil date in the instrument's timezone, so they are exempt from this rule.

**Fix.** Request a multiple of {chart}, for example {suggestion}.

Before:

```
r = req.timeframe("45", close)
```

After:

```
r = req.timeframe("60", close)
```

### OS6016 The compiled format version is not one this engine implements

Severity error. Stage host. Since language version 1. Reference compiled-program.md, loading a program. Test `tests/engine/verify.test.ts`.

**Host input.** The example below is the input that fails and the input that passes rather than a script, because this code is about what the engine was handed and not about what anybody wrote.

**Message.** `This program is in compiled format {found} and this engine implements format {max}; a different major number is a different format, whether it is higher or lower.`

- `{found}` is the format version the program declares.
- `{max}` is the format version this engine implements.

**Cause.** The compiled program is a versioned data format, and an engine refuses a format it cannot read rather than guessing at instructions it does not know. Only the major number decides. A higher minor loads, because a minor addition whose absence would change a number has to announce itself as a tag in the program's requires list, and an older minor loads because it carries a subset of the fields this engine already reads. A major number that is not this engine's is a different format wearing the same name, so it is refused in both directions: a program older than this engine is refused for the same reason as one newer, and neither is run approximately. Refusing at load, with both numbers named, is the whole reason the version is carried.

**Fix.** Run the program on an engine that implements format {found}, or recompile the source with a compiler that emits format {max}.

Before:

```
program: compiled format 0.9
engine:  compiled format 1.0
```

After:

```
program: compiled format 1.0
engine:  compiled format 1.0
```

### OS6017 The program's language version is not one this engine implements

Severity error. Stage host. Since language version 1. Reference language.md 4.1. Test `tests/engine/verify.test.ts`.

**Host input.** The example below is the input that fails and the input that passes rather than a script, because this code is about what the engine was handed and not about what anybody wrote.

**Message.** `This program was compiled from language version {found}, and this engine implements {versions}.`

- `{found}` is the language version the program declares.
- `{versions}` is the language versions the engine implements.

**Cause.** Every past front end is kept, so a program may name a language version older than the engine and still run exactly as it did. A version the engine does not have is one it cannot run correctly, and running it approximately would break the promise that a saved script keeps producing the same numbers.

**Fix.** Upgrade the engine to one that implements language version {found}, or recompile the source against a version it has.

Before:

```
program: language version 2
engine:  language version 1
```

After:

```
program: language version 1
engine:  language version 1
```

### OS6018 The compiled program is malformed

Severity error. Stage host. Since language version 1. Reference compiled-program.md 3.5, 9.4. Test `tests/engine/verify.test.ts`.

**Host input.** The example below is the input that fails and the input that passes rather than a script, because this code is about what the engine was handed and not about what anybody wrote.

**Message.** `The program failed verification at {location}: {reason}.`

- `{location}` is where the failure is: the word instruction followed by the index of the first instruction that failed, or, when the failure is not in an instruction list, the path of the field that failed, such as outputs[3].color.
- `{reason}` is what the verifier found wrong there.

**Cause.** An engine verifies a program before it runs it: the encoding parses, every jump lands inside the program, every slot is in range, and every instruction's operands are the shape the format requires. A program that fails is refused whole, because one that is verified as it goes can fail halfway through a bar with half a chart already drawn. Not every check is about an instruction: the structure checks read the program's own fields, and the input-reference check fails on a declaration field that names an input the program never declares, so a failure is located either at the first instruction that failed or at the field holding it, and the message carries whichever of the two applies.

**Fix.** Recompile the script from its source; a program that fails verification came from a broken compiler or was edited after it was written, and neither is repairable by hand.

Before:

```
instruction 402: JUMP target 9911, program holds 812 instructions
```

After:

```
instruction 402: JUMP target 411, program holds 812 instructions
```

### OS6019 A host setting fails the input's validation

Severity error. Stage host. Since language version 1. Reference language.md 13.4. Test `tests/engine/verify.test.ts`.

**Host input.** The example below is the input that fails and the input that passes rather than a script, because this code is about what the engine was handed and not about what anybody wrote.

**Message.** `The host supplied {value} for {key}, and {validation}.`

- `{value}` is the value the host supplied.
- `{key}` is the input's settings key.
- `{validation}` is the rule it broke, such as the minimum being 1.

**Cause.** An input validates exactly what the host supplies: the type, a number's min and max, and membership of an options list. A value that fails is refused and the program does not run, rather than falling back to the default, because a settings dialog that silently ignores what a user typed is worse than one that says the value is out of range. A declaration field that the compiled program carries as a reference to an input arrives here on the same ground: the engine resolves inputs at load and substitutes the value before it builds the descriptor, so a resolved value the field refuses is a setting from outside the source that the program cannot run with.

**Fix.** Correct the value in the settings dialog, or widen the input's own min, max or options so the value is allowed.

Before:

```
input len: min 1, max 500
host setting: len = 0
```

After:

```
input len: min 1, max 500
host setting: len = 14
```

### OS6020 The report window holds no bars

Severity error. Stage host. Since language version 1. Reference language.md 7.1. Test `tests/backtest/range.test.ts`.

**Host input.** The example below is the input that fails and the input that passes rather than a script, because this code is about what the engine was handed and not about what anybody wrote.

**Message.** `The window from {from} to {to} holds none of the {count} bars supplied.`

- `{from}` is the first moment the window covers, or the first bar supplied where the host named none.
- `{to}` is the last moment it covers.
- `{count}` is how many bars were supplied.

**Cause.** A report is about the bars inside the window the host chose, and a window holding none of them has nothing to report: no equity point, no trade and no summary. The bars outside it are warmup, which execute and whose orders are real, so an empty window is not an empty run, and reporting one as a flat curve would tell a reader that nothing happened when something did.

**Fix.** Widen the window until it covers bars, or supply the bars it covers. Both bounds are inclusive and are compared against the times of the bars supplied rather than against a calendar, so a window that falls inside a gap in the data is empty however wide it looks.

Before:

```
bars supplied: 1240, first day 1, last day 1240
report window: day 1300 to day 1400, bars inside 0
```

After:

```
bars supplied: 1240, first day 1, last day 1240
report window: day 1100 to day 1240, bars inside 141
```

### OS6021 A run setting cannot be applied as stated

Severity error. Stage host. Since language version 1. Reference stdlib.md 17.1. Test `tests/accounting/schedules.test.ts`.

**Host input.** The example below is the input that fails and the input that passes rather than a script, because this code is about what the engine was handed and not about what anybody wrote.

**Message.** `{setting} cannot be applied: {problem}.`

- `{setting}` is the setting that cannot be applied, such as the charge schedule or the comparison tolerance.
- `{problem}` is what makes it unusable, such as a charge line levied on a line declared after it.

**Cause.** A run states the settings it is carried out under before its first bar, and a setting that cannot be carried out is refused there rather than quietly producing a figure. A charge line levied on lines not declared before it has no single evaluation order, so two engines would charge two different amounts and both would be defensible. A slippage stated in ticks with no tick size to measure a tick in would charge nothing at all, which is a backtest that lies in the strategy's favour. A comparison tolerance carrying a bound and no reason is a failed comparison somebody switched off, and one past the cap conformance.md section 6 puts on a declared tolerance is a comparison the suite will not accept, so a run that declared one is refused a case rather than written into one that fails every runner it meets.

**Fix.** State the setting so it can be carried out: declare a charge line after every line it is levied on, supply the tick size a slippage in ticks is measured in, write down the reason a tolerance needs a bound, or bring a bound past the cap back inside it. Nothing has been computed at the point this is refused, so correcting the setting and running again costs one run.

Before:

```
charge lines: tax on levy, levy
slippage: 2 ticks, tick size not supplied
```

After:

```
charge lines: levy, tax on levy
slippage: 2 ticks, tick size 0.05
```

### OS6022 The bars are not the bars the record was made from

Severity error. Stage host. Since language version 1. Reference conformance.md 3. Test `tests/backtest/record.test.ts`.

**Host input.** The example below is the input that fails and the input that passes rather than a script, because this code is about what the engine was handed and not about what anybody wrote.

**Message.** `The bars supplied hash to {found}, and the record was made from {expected}.`

- `{found}` is the hash of the bars supplied now.
- `{expected}` is the hash the record names.

**Cause.** A record names the bars it was made from by a hash over their canonical form, so a replay can prove it is replaying the same run rather than producing a different study under the same name. Bars are revised: a feed corrects a print, a session is extended, a split is applied to history. A replay over revised bars that reported the original figures would be the most convincing wrong answer this system can produce.

**Fix.** Replay against the bars the record names. Where the revision is the point, make a second record over the revised bars and compare the two runs, rather than overwriting one run with the other under one name.

Before:

```
record: bars 1240, hash 9f2c4e...
supplied: bars 1240, hash 4ab70d...
```

After:

```
record: bars 1240, hash 9f2c4e...
supplied: bars 1240, hash 9f2c4e...
```

### OS6023 Two cost models are stated at once

Severity error. Stage host. Since language version 1. Reference language.md 13.3; stdlib.md 17.1. Test `tests/backtest/settings.test.ts`.

**Host input.** The example below is the input that fails and the input that passes rather than a script, because this code is about what the engine was handed and not about what anybody wrote.

**Message.** `A charge schedule was supplied, and the declaration states a commission of {commission} in {commissionType}.`

- `{commission}` is the commission the declaration states.
- `{commissionType}` is the unit that commission is stated in.

**Cause.** The declaration's commission is the script's own statement of what trading costs and a supplied schedule is the platform's, and the two describe the same money. Applied together they charge it twice; applied one at a time they charge whichever an engine happened to prefer, which is a rule nobody wrote down and a figure nobody can explain afterwards. So exactly one of the two is stated for a run, and stating both is refused before the first bar rather than reconciled behind the reader.

**Fix.** Supply the schedule and leave the declaration's commission at its default of zero, or state the commission in the declaration and supply no schedule. A schedule is the one of the two that can carry a floor, a cap, a charge levied on a charge, and a cost that falls on one side of the trade only.

Before:

```
declaration: commission 20, per trade
host: charge schedule supplied, 4 lines
```

After:

```
declaration: commission 0, per trade
host: charge schedule supplied, 4 lines
```


### OS6024 The host cannot draw something this study declares

Severity error. Stage host. Since language version 1. Reference compiled-program.md 11. Test `tests/adapters/charts/undrawable.test.ts`.

**Host input.** The example below is the input that fails and the input that passes rather than a script, because this code is about what the engine was handed and not about what anybody wrote.

**Message.** `This host cannot draw {what}: {limit}.`

- `{what}` is the declaration that will not be drawn, named by its title where it has one.
- `{limit}` is the host's own sentence for why, which is the only part a host writes.

**Cause.** A compiled program carries every output the language can express, and a host draws what its own surface has room for. The two are allowed to differ, and what is not allowed is the difference being invisible: a study whose second panel never appears looks like a study with a bug in its cells, and a band drawn in a colour the script did not choose looks like a script that chose it. So a host states its limit before any bar runs, rather than drawing part of the study and saying nothing. The compiled program carries no source position for a declaration, which is why the refusal names the declaration by its title rather than pointing at a line.

**Fix.** Declare what this host draws, or run the study on a host that draws {what}.

Before:

```
study declares:
  table "Summary", 2 rows, 2 columns
  table "Detail", 4 rows, 2 columns
host draws: one grid per pane
```

After:

```
study declares:
  table "Summary", 6 rows, 2 columns
host draws: one grid per pane
```

### OS6025 A bar has no time

Severity error. Stage host. Since language version 1. Reference host-interface.md 3.5. Test `tests/engine/series.test.ts`.

**Host input.** The example below is the input that fails and the input that passes rather than a script, because this code is about what the engine was handed and not about what anybody wrote.

**Message.** `Bar {index} was handed over with no time.`

- `{index}` is the index of the bar that carries no time.

**Cause.** Every bar states its open instant (host-interface.md 3.1), and the order rule, the history operator, warmup and every calendar fold are built on it. A bar dated nothing cannot be put in order against the bar before it, so it is not OS6011, which is about two stated instants in the wrong order: it is a bar of the wrong shape. Reading it as the absent value would step it over every calendar fold and make every session fact absent for a bar that is on the chart, which draws a gap where the host has data.

**Fix.** State the bar's open instant in whole milliseconds since the Unix epoch, UTC, and leave out a bar the host cannot date rather than handing it over without a time.

Before:

```
host input:
  bar 41  09:10
  bar 42  (no time)
  bar 43  09:20
```

After:

```
host input:
  bar 41  09:10
  bar 42  09:15
  bar 43  09:20
```


### OS6026 Two slippages are stated at once

Severity error. Stage host. Since language version 1. Reference language.md 13.3; stdlib.md 17.1. Test `tests/backtest/settings.test.ts`.

**Host input.** The example below is the input that fails and the input that passes rather than a script, because this code is about what the engine was handed and not about what anybody wrote.

**Message.** `A charge schedule was supplied with a slippage of {supplied} ticks, and the declaration states a slippage of {declared} ticks.`

- `{supplied}` is the slippage the supplied schedule carries, in ticks.
- `{declared}` is the slippage the declaration states, in ticks.

**Cause.** The declaration's slippage is the script's own statement of how much worse than the bar every fill is, and a supplied schedule carries the platform's. A backtest worsens a fill by one of them, and where a schedule is supplied it is the schedule's, so a declared slippage that differs from the schedule's would simply not happen and nothing would say so. The same figure stated in both is one statement, and a declaration that states none leaves the schedule's to stand; two different figures are refused before the first bar rather than reconciled behind the reader.

**Fix.** Carry the declaration's slippage in the schedule, or leave the declaration's slippage at its default of zero and let the schedule carry the figure, or supply no schedule and let the declaration's commission and slippage stand.

Before:

```
declaration: slippage 2 ticks
host: charge schedule supplied, slippage 1 tick
```

After:

```
declaration: slippage 2 ticks
host: charge schedule supplied, slippage 2 ticks
```
---

## 8.7 OS7xxx Orders

### OS7001 Only a strategy can do that

Severity error. Stage checker. Since language version 1. Reference language.md 13.1, 13.3. Test `tests/unit/check-names.test.ts`.

**Message.** `{name} is available only in a file declared with strategy().`

- `{name}` is the order function or position name that was used.
- `{line}` is the line of the study declaration.

**Cause.** Order functions and the pos namespace need a position to act on and a report to write to, both of which a study does not have. The check is at compile time so a study can never place an order at all.

**Fix.** Change study(...) on line {line} to strategy(...), or replace {name} with signal("...") to mark the bar without trading.

Before:

```
study("EMA cross", overlay = true)

if crossUp(fast, slow)
    buy(qty = 1)
```

After:

```
strategy("EMA cross", overlay = true)

if crossUp(fast, slow)
    buy(qty = 1)
```

### OS7002 An order argument is absent

Severity error. Stage engine. Since language version 1. Reference language.md 6.8. Test `tests/engine/refusals.test.ts`.

**Message.** `{name}'s {argument} is absent on this bar.`

- `{name}` is the order function that was called.
- `{argument}` is the argument that was absent.

**Cause.** An order is the one place in the language where doing nothing quietly is worse than stopping loudly, so an absent price or quantity is refused rather than defaulted. Warmup is the usual source: a stop computed from a window that has not filled yet.

**Fix.** Guard the call with isNone({argument}), or supply a fallback with orElse() where one is genuinely correct.

Before:

```
buy(qty = 1, stop = lowest(low, 20))
```

After:

```
s = lowest(low, 20)
if not isNone(s)
    buy(qty = 1, stop = s)
```

### OS7003 An order function inside a request expression

Severity error. Stage checker. Since language version 1. Reference language.md 15.2. Test `tests/unit/check-repaint.test.ts`.

**Message.** `{name} inside a request expression would place an order from another instrument's bars.`

- `{name}` is the order function that was called inside the expression.

**Cause.** A request expression is evaluated on the requested instrument's bars, in that instrument's time. An order placed there has no defined instrument, no defined moment and no defined price, and it would fire once per bar of a series the chart never shows.

**Fix.** Read the value with the request, and place the order at the top level from the result.

Before:

```
d = req.timeframe("1D", buy(qty = 1))
```

After:

```
up = req.timeframe("1D", close > ema(close, 20))
if up
    buy(qty = 1)
```

### OS7004 Order quantity is zero or negative

Severity error. Stage engine. Since language version 1. Reference language.md 13.3. Test `tests/engine/refusals.test.ts`.

**Message.** `{name} was given a quantity of {qty}.`

- `{name}` is the order function that was called.
- `{qty}` is the quantity that reached it.

**Cause.** Direction is chosen by the function, not by the sign of the quantity, so a negative quantity is a calculation that went the wrong way rather than an order in the other direction. A quantity of zero is never what a script means.

**Fix.** Pass a positive quantity, guard the call with a size test, and use sell() to go the other way.

Before:

```
buy(qty = target - pos.size)
```

After:

```
delta = target - pos.size
if delta > 0
    buy(qty = delta)
```

### OS7005 Quantity is not a multiple of the lot size

Severity error. Stage engine. Since language version 1. Reference language.md 13.3. Test `tests/engine/ending.test.ts`.

**Deferred.** Nothing raises this yet. Nothing compares an order's quantity with the lot size its leg trades in, so a quantity no exchange would accept is sent and a backtest can report a trade that could not have happened. The same missing fact is what leaves two other shapes of stdlib.md 17.1 unheld, and all three are settled together. A quantity stated on a close in a declaration counting in lots, cash or an equity percent cannot be held against a position folded in units, which is the narrowing OS7017 carries. And an order that opposes what the leg holds in such a declaration cannot be divided into the half that closes the outgoing position and the half that opens its replacement, so it is sent whole. What is kept without the lot size, and kept in every unit: it is sent on a position reference of its own, whether or not anything has settled, so that it crosses nothing; and the outgoing position is named again, because a close works its own quantity out in units and is divided across the positions holding the leg's own side, oldest first, so that position returns to zero as soon as the leg's net comes back to its side. What is not kept is the instruction itself closing it. The outgoing position is left holding what it holds, and on a leg whose net never returns to that side it is carried for the life of the run with no order able to name it. Raised when order validation lands, stdlib.md 17.2, which is also when the ledger is given the lot size its leg trades in.

**Message.** `{symbol} trades in lots of {lot}, and {qty} is not a multiple of it.`

- `{symbol}` is the instrument being traded.
- `{lot}` is its lot size.
- `{qty}` is the quantity that was passed.

**Cause.** An exchange that trades in lots rejects anything else, so a backtest that filled such an order would report a trade that could not have happened. The engine refuses it for the same reason the exchange would.

**Fix.** Size in lots: declare qtyType = "lots" and pass the lot count, or round a computed size with order.roundToLot().

Before:

```
buy(qty = 100)
```

After:

```
strategy("Lots", qtyType = "lots")
buy(qty = 2)
```

### OS7006 Price is not on a tick

Severity error. Stage engine. Since language version 1. Reference language.md 13.3. Test `tests/engine/refusals.test.ts`.

**Message.** `{symbol} ticks at {tick}, and {price} does not fall on one.`

- `{symbol}` is the instrument being traded.
- `{tick}` is its tick size.
- `{price}` is the price that was passed.

**Cause.** A limit or stop price between two ticks cannot exist at the exchange. Rounding it silently would move the order away from the level the script computed, and in a backtest that difference is free money or a free stop.

**Fix.** Round to the tick before passing the price: round(price / chart.tickSize) * chart.tickSize.

Before:

```
sell(qty = 1, limit = close * 1.013)
```

After:

```
target = round(close * 1.013 / chart.tickSize) * chart.tickSize
sell(qty = 1, limit = target)
```

### OS7007 A resting order has no price

Severity error. Stage engine. Since language version 1. Reference language.md 13.3. Test `tests/engine/refusals.test.ts`.

**Message.** `A {type} order needs {argument}, and none was given.`

- `{type}` is the order type that was named.
- `{argument}` is the price argument that is missing.

**Cause.** An order that rests in the book needs the level it rests at. Filling it in from the bar's close would make the order a market order wearing another name, and the report would show a fill the script never asked for.

**Fix.** Pass {argument}, or leave the type as market and let the order fill at the next price.

Before:

```
order.place("buy", 1, type = "limit")
```

After:

```
order.place("buy", 1, type = "limit", price = close - chart.tickSize)
```

### OS7008 The entry was refused by pyramiding

Severity error. Stage engine. Since language version 1. Reference language.md 13.3. Test `tests/engine/refusals.test.ts`.

**Message.** `This strategy allows {max} entries in one direction and already holds {found}.`

- `{max}` is the pyramiding option in force.
- `{found}` is the number of entries already open in that direction.

**Cause.** Refusing rather than silently adding keeps a backtest from building a position the declaration forbade, which would report a return the stated rules never earned.

**Fix.** Raise pyramiding in the declaration, or test pos.size before entering again.

Before:

```
strategy("Add", pyramiding = 1)
if signalUp
    buy(qty = 1)
```

After:

```
strategy("Add", pyramiding = 1)
if signalUp and pos.size == 0
    buy(qty = 1)
```

### OS7009 Unknown order tag

Severity error. Stage engine. Since language version 1. Reference language.md 15.2; stdlib.md 17.3. Test `tests/engine/tags.test.ts`.

**Message.** `There is no working order tagged {tag}.`

- `{tag}` is the tag that was passed.

**Cause.** A tag names an order from the moment it is placed. Acting on a tag that names nothing is a script that has lost track of its own orders, and ignoring the call would leave it believing an order exists that does not. This code is for a call that acts on an order. The reading calls of stdlib.md section 17.3 read the ledger, which keeps a row after the order finishes, so a tag that names no row reads as the entry's documented empty value rather than raising.

**Fix.** Use the tag the order was placed with, or cancelAll() where the script means every order it has working.

Before:

```
buy(qty = 1, tag = "entry")
cancel("entries")
```

After:

```
buy(qty = 1, tag = "entry")
cancel("entry")
```

### OS7010 A bracket price is on the wrong side of the entry

Severity error. Stage engine. Since language version 1. Reference language.md 13.3. Test `tests/engine/refusals.test.ts`.

**Message.** `A {side} entry at {entry} cannot take a {leg} at {price}.`

- `{side}` is long or short.
- `{entry}` is the position's average entry price.
- `{leg}` is the bracket leg: stop or limit.
- `{price}` is the price that was passed.

**Cause.** A stop protects and a limit takes profit, so their sides are fixed by the direction of the position. A stop on the wrong side fills immediately, which in a backtest turns every trade into an instant loss that looks like a strategy result.

**Fix.** Put the stop below a long entry and the limit above it, and swap the two for a short.

Before:

```
if pos.isFlat
    buy(qty = 1)
else
    exit(limit = pos.avgPrice - atrValue, stop = pos.avgPrice + atrValue)
```

After:

```
if pos.isFlat
    buy(qty = 1)
else
    exit(limit = pos.avgPrice + atrValue, stop = pos.avgPrice - atrValue)
```

### OS7011 The order needs more capital than the strategy has

Severity error. Stage engine. Since language version 1. Reference language.md 13.3. No test in this repository names this code.

**Deferred.** Nothing raises this yet. Nothing compares an order's cost with the capital the strategy has, so a backtest can spend money it never had and report a return nobody could have earned. Raised when the ledger holds a capital figure to check against, language.md 13.3.

**Message.** `This order needs {required} and the strategy has {available}.`

- `{required}` is the capital the order would consume.
- `{available}` is the capital the strategy has left.

**Cause.** A backtest that can spend money it does not have reports a return nobody could have earned. The order is refused rather than filled on credit, and the report records the refusal so the equity curve stays honest.

**Fix.** Size from equity with qtyType = "equityPercent", or test pos.equity before entering.

Before:

```
buy(qty = 100)
```

After:

```
strategy("Sized", qtyType = "equityPercent")
buy(qty = 10)
```

### OS7012 The instrument is outside its session

Severity error. Stage engine. Since language version 1. Reference language.md 15.2. No test in this repository names this code.

**Deferred.** Nothing raises this yet. Nothing compares the bar's time with the instrument's session before an order is sent, so an order outside the session leaves the engine as though the venue were open. Raised when order validation reads the session, language.md 15.2.

**Message.** `{symbol} is outside its trading session at {time}.`

- `{symbol}` is the instrument being traded.
- `{time}` is the bar's timestamp.

**Cause.** An order placed outside the session cannot be worked by the exchange. Holding it until the open would fill it at a price the script never saw, so it is refused and the script decides what to do at the open instead.

**Fix.** Guard entries with session.isOpen, and set closeOnSessionEnd = true to flatten at the close.

Before:

```
if crossUp(fast, slow)
    buy(qty = 1)
```

After:

```
if crossUp(fast, slow) and session.isIn("0915-1530")
    buy(qty = 1)
```

### OS7013 Two opposite orders on one bar

Severity error. Stage engine. Since language version 1. Reference language.md 13.3. Test `tests/engine/refusals.test.ts`.

**Message.** `{first} and {second} were both placed on bar {bar}.`

- `{first}` is the first order call, with its line.
- `{second}` is the second order call, with its line.
- `{bar}` is the bar index.

**Cause.** Which of the two the engine should honour has no defensible answer: source order is an accident of layout, and the last one wins is a rule that silently changes when someone reorders two blocks. Neither is placed, and the bar stops.

**Fix.** Make the conditions exclusive with else if, or place the exit on this bar and the entry on the next.

Before:

```
r = rsi(close, 14)
if crossUp(fast, slow)
    buy(qty = 1)
if r > 70
    sell(qty = 1)
```

After:

```
r = rsi(close, 14)
if crossUp(fast, slow)
    buy(qty = 1)
else if r > 70
    sell(qty = 1)
```

### OS7014 The destination rejected the order

Severity error. Stage host. Since language version 1. Reference language.md 13.3. No test in this repository names this code.

**Deferred.** Nothing raises this yet. A refusal that comes back is folded into the ledger row as a status and its text, and no diagnostic is raised, so nothing reports it against the line that placed the order. Raised when a refused fold reports, stdlib.md 17.8.

**Message.** `The order destination rejected {name}: {reason}.`

- `{name}` is the order function that was called.
- `{reason}` is the destination's own rejection text.

**Cause.** The order left the engine well formed and the destination refused it. A product the account cannot trade, a margin shortfall and a symbol the account has no permission for all arrive here, carrying the destination's reason.

**Fix.** Act on {reason}: it comes from the destination, not from the script, and the same order will be rejected again until the account or the order changes.

Before:

```
strategy("Swing", product = "overnight")
buy(qty = 1)
```

After:

```
strategy("Swing", product = "intraday")
buy(qty = 1)
```

### OS7015 The strategy has no order destination

Severity error. Stage host. Since language version 1. Reference language.md 13.3. Test `tests/hosts/strategy.test.ts`.

**Deferred.** Nothing raises this yet. A strategy with nowhere to send orders is not stopped: it places intents that reach nobody, and nothing says so. Raised when the engine checks for a destination before the first order, host-interface.md 7.4.

**Message.** `This strategy placed an order and the host supplied no destination.`

**Cause.** A strategy needs somewhere for orders to go: a sandbox engine, a backtest simulator or a broker connection. Running one with no destination would compute a position nothing ever took.

**Fix.** Connect a destination in the host, or run the file as a study(): replace buy() with signal("BUY").

Before:

```
strategy("EMA cross")
if crossUp(fast, slow)
    buy(qty = 1)
```

After:

```
study("EMA cross")
if crossUp(fast, slow)
    signal("BUY")
```

### OS7016 A close names a tag nothing places

Severity error. Stage checker. Since language version 1. Reference stdlib.md 17.2. Test `tests/unit/check-tags.test.ts`.

**Message.** `No order in this file is placed with the tag {tag}.`

- `{tag}` is the tag the close was given.

**Cause.** A close names the part of a position that one tag entered. A tag no order in the file is placed with can never name a part of one, so the call sends nothing on every bar and says nothing, and the script goes on believing it has flattened. It is read from the file rather than from the run because the run cannot tell this from an ordinary bar: a tag that has never named a ledger row is also what a working script looks like before its entry has happened. A tag the script computes is not read, and neither is any close in a file where an order's tag is computed.

**Fix.** Use the tag the entry was placed with, or leave the tag out to flatten the whole leg.

Before:

```
if pos.isFlat
    buy(qty = 1, tag = "entry")
else
    close(tag = "entries")
```

After:

```
if pos.isFlat
    buy(qty = 1, tag = "entry")
else
    close(tag = "entry")
```

### OS7017 A close states more than it is closing

Severity error. Stage engine. Since language version 1. Reference stdlib.md 17.1, 17.2. Test `tests/engine/closing.test.ts`.

**Message.** `close was given a quantity of {qty}, and {part} has {held} left to close.`

- `{qty}` is the quantity the call stated.
- `{part}` is what the close is closing: the leg, or the tag it named.
- `{held}` is what is left for a close to send: what that part holds, less what is already working against it.

**Cause.** No order crosses zero, and a reducing order can never send more than is available to reduce. A close larger than what is left to close sends one order that flattens the position and opens the opposite one under the same position reference, so a leg that was long ends short and a call named close has opened a position. The quantity is an argument the script wrote, which makes it a claim about the strategy's own position, and this claim is false. Sending what is there instead would leave the script believing it closed the number it asked for, and reading it as a reversal would make close open a position, which is the most expensive naming mistake available. What is left to close is what the leg holds, or what the tag the close names holds, less everything already working against it. A position is folded from settled fills, so an order the destination has not answered has filled nothing and the leg still reads what it held before that order left: measured against that alone, two closes of two on a leg of three each pass the ceiling and the pair ends the leg one short, and a close on every bar against a destination that never answers ends the run short by the position once per bar. The scope is therefore the run and the position rather than the bar, and what is still working is read from the ledger of stdlib.md 17.7: an order neither terminal nor fully filled, counted by the part of it that has not filled. A rejection, a cancellation and an expiry release what they were holding, because nothing more is coming from an order that has ended. What is counted is every order still going on the side that reduces what the leg holds now, and not only the ones that were reductions when they left: an entry the destination has not answered, on a leg the orders after it took the other way, is a reduction now, and leaving it out offered a close the whole of a position five units of which were already on their way. A close that states no quantity is not this: the engine works out what is left and sends it, which is nothing at all once the whole of it is going, and closing a tag that holds nothing sends nothing and says nothing. The comparison is made in full only where the two numbers count the same thing, which is a declaration whose quantity type is units: elsewhere a position folded from filled quantities and a quantity stated in the declaration's own unit are two different kinds of number, and a refusal with the wrong one in it is worse than none. The half of it that needs no conversion is made whatever the declaration counts in, because nothing left to close is zero in every unit. What that leaves unheld is one shape, a quantity stated against a position that is still there in a declaration counting in lots, cash or an equity percent, and joining those two numbers needs the instrument's lot size, which is the fact OS7005 is deferred on.

**Fix.** Leave the quantity out and close() flattens what is left, or size the part from pos.size and keep the quantity at or under {held}.

Before:

```
if pos.isFlat
    buy(qty = 1)
else
    close(qty = 5)
```

After:

```
if pos.isFlat
    buy(qty = 1)
else
    close()
```

### OS7018 A frame names an order this strategy did not place

Severity error. Stage host. Since language version 1. Reference stdlib.md 17.8, 17.14. No test in this repository names this code.

**Deferred.** Nothing raises this yet. The fold refuses the frame and records the refusal as a word on the outcome it hands back, and a word is not a catalogue code, so nothing reports it against the run and a host answering for orders it was never handed stays invisible. Raised when the outcome of a fold carries a code and a bar carries a channel for a diagnostic that does not stop it, stdlib.md 17.8.

**Host input.** The example below is the input that fails and the input that passes rather than a script, because this code is about what the engine was handed and not about what anybody wrote.

**Message.** `The frame names intent {intent}, and this strategy holds no such order.`

- `{intent}` is the intent id the frame named.

**Cause.** Step 1 of the fold locates the row a frame is about, and a frame naming no row cannot be folded into anything. It is a fact about the host rather than about the strategy: a destination answering for an order another strategy placed, or answering for a run that has already ended. The frame changes nothing and is reported, because a fold that passed over it in silence would leave a host's mistake invisible to the only party who can correct it.

**Fix.** Answer with the intent id the engine sent. A destination's own reference is carried in the frame's reference field, where the engine records it and never parses it, and it is not what an answer is addressed by.

Before:

```
engine sent: intent 7, intent 8
frame: intent 11, status filled, filled qty 1
```

After:

```
engine sent: intent 7, intent 8
frame: intent 8, status filled, filled qty 1
```

### OS7019 A fill was reported with no price

Severity error. Stage host. Since language version 1. Reference stdlib.md 17.8, 17.14. No test in this repository names this code.

**Deferred.** Nothing raises this yet. The fold refuses the frame and records the refusal as a word on the outcome it hands back, and a word is not a catalogue code, so a destination reporting a fill that can be marked against nothing is refused in silence. Raised when the outcome of a fold carries a code and a bar carries a channel for a diagnostic that does not stop it, stdlib.md 17.8.

**Host input.** The example below is the input that fails and the input that passes rather than a script, because this code is about what the engine was handed and not about what anybody wrote.

**Message.** `The frame reports {qty} filled for intent {intent}, and no average fill price.`

- `{qty}` is the cumulative filled quantity the frame reports.
- `{intent}` is the intent id the frame named.

**Cause.** Step 3 of the fold takes the destination's own average over the cumulative quantity, because the engine never averages two averages of its own. A frame reporting more filled than the row holds and no price to take is a fill that can be marked against nothing: no position average, no realised profit, no equity point. It is refused whole rather than folded for its quantity alone, because a position holding a size and no price is worse than no position at all.

**Fix.** Report the average fill price the destination computed over the cumulative quantity, on every frame that reports a quantity greater than the last one. A frame carrying no new quantity needs no price.

Before:

```
frame: intent 8, status filled, filled qty 3, average fill price absent
```

After:

```
frame: intent 8, status filled, filled qty 3, average fill price 104.25
```

---

## 8.8 OS8xxx Warnings

### OS8001 A stateful call inside a branch

Severity warning. Stage checker. Since language version 1. Reference language.md 11.4. Test `tests/unit/check-conditional.test.ts`.

**Message.** `{name} advances only on the bars where this branch runs, and is absent on the rest.`

- `{name}` is the stateful call, such as ema, rma or a user function holding var.

**Cause.** A call site that does not execute on a bar leaves its series absent for that bar and its state untouched. The alternatives are worse: forcing the call would execute code the script said to skip, and carrying the previous value forward would draw a flat line that looks like data. This is almost always a mistake rather than an intent.

**Fix.** Compute it unconditionally at the top level and use the result inside the branch.

Before:

```
if trending
    e = ema(close, 20)
    plot(e, "EMA", aqua)
```

After:

```
e = ema(close, 20)
plot(trending ? e : none, "EMA", aqua)
```

### OS8002 A higher timeframe read with onUnconfirmed

Severity warning. Stage checker. Since language version 1. Reference language.md 7.5. Test `tests/unit/check-repaint.test.ts`.

**Message.** `This file sets onUnconfirmed = true and reads {timeframe}; together they repaint.`

- `{timeframe}` is the requested interval.

**Cause.** A higher timeframe bar is incomplete until it closes, and acting on an unconfirmed bar acts on that incomplete value. The chart then redraws when the higher bar closes, and the backtest and the live run disagree on the same data.

**Fix.** Drop onUnconfirmed = true, or guard every use of the read with bar.isConfirmed.

Before:

```
strategy("HTF", onUnconfirmed = true)
d = req.timeframe("1D", high)
if close > d
    buy(qty = 1)
```

After:

```
strategy("HTF")
d = req.timeframe("1D", high)
if close > d
    buy(qty = 1)
```

### OS8003 No version declaration

Severity warning. Stage checker. Since language version 1. Reference language.md 4. Test `tests/unit/diagnostics.test.ts`. The editor can apply the fix.

**Message.** `This file declares no language version; it was compiled as version {version}.`

- `{version}` is the newest language version the compiler implements.

**Cause.** A file that names its version is parsed by that version's front end for ever, and every past front end is kept. A file without one is parsed by the newest, which is the one thing that can change under it.

**Fix.** Add version {version} as the first line of the file.

Before:

```
study("EMA cross")
```

After:

```
version 1

study("EMA cross")
```

### OS8004 A branch on an absent condition changes a value used later

Severity warning. Stage checker. Since language version 1. Reference language.md 6.6. No test in this repository names this code.

**Deferred.** Nothing raises this yet. The checker does not follow which names a branch on a possibly absent condition assigns, so the warmup shape this warns about compiles silently. Raised when the checker follows assignments out of a conditional block, language.md 6.6.

**Message.** `{condition} can be absent, and this block assigns {name}, which is read at line {line}.`

- `{condition}` is the condition expression as written.
- `{name}` is the name the block assigns.
- `{line}` is the line outside the block that reads it.

**Cause.** An absent condition takes the false branch, so during warmup the block does not run and the name keeps whatever it held before. Warmup bars sit off the left edge of the screen, which is why this shape silently changes an answer and nobody notices.

**Fix.** Decide what warmup means: test isNone({condition}) explicitly, or give {name} a starting value above the if.

Before:

```
if rsi(close, 14) > 70
    zone = "high"
plot(zone == "high" ? 1 : 0, "Zone", aqua)
```

After:

```
zone = "mid"
if rsi(close, 14) > 70
    zone = "high"
plot(zone == "high" ? 1 : 0, "Zone", aqua)
```

### OS8005 A lookahead read

Severity warning. Stage checker. Since language version 1. Reference language.md 7.5. Test `tests/unit/check-repaint.test.ts`.

**Message.** `This read uses {mode}, so the study shows values the bar it is drawn on could not have known.`

- `{mode}` is the mode the read was given.

**Cause.** A lookahead read takes a higher timeframe bar's final value on chart bars that fall before that bar closed. It is the strongest form of repainting there is, which is why it has to be written out in a word a reviewer sees on the line that causes it. The compiled study is also marked as repainting, so the host can say so.

**Fix.** Drop the mode to take the default, which never repaints, unless the study is deliberately a study of what the higher bar went on to do.

Before:

```
d = req.timeframe("1D", high, mode = "lookahead")
```

After:

```
d = req.timeframe("1D", high)
```

### OS8006 A session average on a session-length bar

Severity warning. Stage checker. Since language version 1. Reference language.md 15.2. No test in this repository names this code.

**Deferred.** Nothing raises this yet. The checker does not compare a session average's call with the chart's interval, so the accumulation this warns about compiles silently. Raised when the checker reads the declared interval at the call site, language.md 15.2.

**Message.** `A session anchored average resets each session, and each bar of {interval} is a whole session, so it equals its source.`

- `{interval}` is the chart's interval.

**Cause.** The average is a within-session measure: it accumulates from the session's first bar. On a daily or longer interval each bar is its own session, so the accumulation is one bar long and the result is that bar's own price. The plot carries no information and the legend suggests it does.

**Fix.** Use an intraday interval for a session anchored average, or plot the source directly and delete the call.

Before:

```
plot(vwap(), "Session average", aqua)
```

After:

```
plot(hlc3, "Typical price", aqua)
```

### OS8007 A plot sets the price pane's own formatting

Severity warning. Stage checker. Since language version 1. Reference language.md 13.2, 15.3. Test `tests/unit/check-plot-options.test.ts`.

**Message.** `{title} sets {option} while drawing over the price pane, which reformats the instrument's own axis.`

- `{title}` is the plot's title, quoted.
- `{option}` is the option that was set, precision or format.

**Cause.** precision and format on a plot apply to the price scale that plot maps to. Over the price pane that scale is the instrument's own, so the setting changes the axis every other series on that pane is read against, which is almost never what was meant.

**Fix.** Set precision and format in the declaration, for the whole study, or drop them from a plot drawn over the price pane.

Before:

```
study("Bands", overlay = true)
plot(upper, "Upper", aqua, precision = 0)
```

After:

```
study("Bands", overlay = true, precision = 0)
plot(upper, "Upper", aqua)
```

### OS8008 An alert with no fixed id

Severity warning. Stage checker. Since language version 1. Reference language.md 15.3. Test `tests/unit/check-repaint.test.ts`.

**Message.** `This alert has no fixed id, so its identity is derived from its position at line {line}.`

- `{line}` is the line the alert is declared on.

**Cause.** A user's alert subscription is keyed by the alert's id, and an id derived from a call's position changes the moment a line is inserted above it. The subscription then belongs to an alert that no longer exists, and it stops firing without telling anybody. An id taken from an input() is not fixed either, and is derived in the same way: the key is written into the program before any setting is read, and a name that moves when somebody opens the settings dialog is not a name a subscription can be kept under.

**Fix.** Give the alert a stable id of your own: alert("text", id = "emaCross").

Before:

```
if crossUp(fast, slow)
    alert("EMA cross")
```

After:

```
if crossUp(fast, slow)
    alert("EMA cross", id = "emaCross")
```

### OS8009 This plot can never draw

Severity warning. Stage checker. Since language version 1. Reference language.md 6.7. Test `tests/unit/check-warmup.test.ts`.

**Message.** `{title} plots a value that is absent on every bar.`

- `{title}` is the plot's title, quoted.

**Cause.** A plot whose value is constantly none occupies a legend row, a settings group and an axis, and draws nothing. It is usually a placeholder that was left behind, or a name that was never assigned the value it was meant to hold.

**Fix.** Plot the value that was meant, or delete the plot and its settings row.

Before:

```
plot(none, "Reserved", aqua)
```

After:

```
plot(ema(close, 20), "EMA 20", aqua)
```

### OS8010 A name is never read

Severity warning. Stage checker. Since language version 1. Reference language.md 12.2. Test `tests/unit/diagnostics.test.ts`.

**Message.** `{name} is assigned at line {line} and never read.`

- `{name}` is the name that is never read.
- `{line}` is the line of its assignment.

**Cause.** The statement still runs on every bar, so an unread name costs time on fifty thousand bars and tells the next reader that something depends on it. It is usually the remains of a calculation that was replaced. A name bound to a declaration handle is exempt: it is a compile-time binding with nothing left in the bar loop, and naming a fill or a level result and never reading it is legal (language.md 5.4).

**Fix.** Use the value, or delete the line.

Before:

```
slow = ema(close, 21)
plot(ema(close, 9), "Fast", aqua)
```

After:

```
plot(ema(close, 9), "Fast", aqua)
```

### OS8011 live var makes live and backtest differ

Severity warning. Stage checker. Since language version 1. Reference language.md 7.5, 8.2. Test `tests/unit/check-handles.test.ts`.

**Message.** `{name} is a live var, so it keeps its value across the updates of the moving bar.`

- `{name}` is the name declared with live var.

**Cause.** An ordinary var rolls back before each re-execution of the newest bar, which is what makes a live chart and a backtest of the same data agree. A live var opts out of that, so a script using one reports different numbers in the two places by design.

**Fix.** Use var unless counting intrabar updates is the actual intent; keep live var only for that.

Before:

```
live var barCount = 0
barCount = barCount + 1
plot(barCount, "Bars", aqua)
```

After:

```
var barCount = 0
barCount = barCount + 1
plot(barCount, "Bars", aqua)
```

### OS8012 An ordered comparison against none is always absent

Severity warning. Stage checker. Since language version 1. Reference language.md 6.4, 6.5. Test `tests/unit/check-dead-code.test.ts`.

**Message.** `This {op} has none on one side, so it is absent on every bar.`

- `{op}` is the comparison operator that was written.

**Cause.** Ordered comparison propagates absence, so a comparison against none can only ever be none, and a condition of none takes the false branch. The branch is therefore dead. Equality is the operator that answers this question.

**Fix.** Test absence with isNone(x), or with x == none, both of which are always true or false.

Before:

```
if value > none
    signal("READY")
```

After:

```
if not isNone(value)
    signal("READY")
```

### OS8013 Deprecated

Severity warning. Stage checker. Since language version 1. Reference language.md 4.1. No test in this repository names this code. The editor can apply the fix.

**Deferred.** Nothing raises this yet. No name in the library is marked deprecated and there is no marker for one to carry, so the checker has nothing to warn about. Raised when the library carries a deprecation marker the checker reads, language.md 4.1.

**Message.** `{name} is deprecated since language version {version}; {replacement} does the same thing.`

- `{name}` is the deprecated function or option.
- `{version}` is the language version that deprecated it.
- `{replacement}` is the name or option that replaces it.

**Cause.** A construct that turns out to be a mistake is never removed and never changes meaning, because a saved script must keep working. It warns instead, and it will still be there in version 9.

**Fix.** Replace {name} with {replacement}; the two compute the same values.

Before:

```
plot(oldName(close, 14), "Value", aqua)
```

After:

```
plot(newName(close, 14), "Value", aqua)
```

### OS8014 A persistent value holds a bar index

Severity warning. Stage checker. Since language version 1. Reference language.md 7.2. No test in this repository names this code.

**Deferred.** Nothing raises this yet. The checker does not follow a bar index into a persistent value, so the stored position this warns about compiles silently. Raised when the checker follows a bar index into persistent state, language.md 7.2.

**Message.** `{name} keeps a bar index across bars, and every index shifts when more history loads.`

- `{name}` is the persistent name that holds bar.index.

**Cause.** bar.index is a position in the data the engine was given, not an address. Loading more history renumbers every bar, so a stored index compared later is being compared against something that moved underneath it.

**Fix.** Store time instead and compare timestamps; the bar's time does not move.

Before:

```
var entryBar = none
if enter
    entryBar = bar.index
```

After:

```
var entryTime = none
if enter
    entryTime = time
```

### OS8015 This loop never runs

Severity warning. Stage checker. Since language version 1. Reference language.md 10.3. Test `tests/unit/check-dead-code.test.ts`.

**Message.** `The loop starts at {start}, ends at {end} and steps {step}, so the body never runs.`

- `{start}` is the start value.
- `{end}` is the end value.
- `{step}` is the step value.

**Cause.** A descending range with a positive step is empty, and so is an ascending range with a negative step: the loop does not silently reverse in either direction, because a form that reverses itself is the only shape of for loop that can spin for ever by accident.

**Fix.** Add step -1 to count down, or swap the bounds to count up.

Before:

```
for i = 9 to 0
    total += close[i]
```

After:

```
for i = 9 to 0 step -1
    total += close[i]
```

### OS8016 Unreachable code

Severity warning. Stage checker. Since language version 1. Reference language.md 11.3. Test `tests/unit/check-dead-code.test.ts`.

**Message.** `Line {line} follows a return that always runs, so it never executes.`

- `{line}` is the first unreachable line.

**Cause.** A return exits the function immediately. Statements after one that always runs are dead, and the usual cause is an early exit that lost its if.

**Fix.** Delete the unreachable lines, or move them above the return.

Before:

```
fn pick(x) =>
    return x
    x * 2
```

After:

```
fn pick(x) =>
    x
```

### OS8017 The condition is constant

Severity warning. Stage checker. Since language version 1. Reference language.md 10.2. Test `tests/unit/check-dead-code.test.ts`.

**Message.** `This condition is {value} on every bar.`

- `{value}` is true or false, whichever it folds to.

**Cause.** A condition built only from literals and constant options has one answer for the whole run, so one branch is dead. It is usually a test that was pinned during debugging and left behind.

**Fix.** Restore the test that was meant, or delete the branch that never runs.

Before:

```
if true
    signal("BUY")
```

After:

```
if crossUp(fast, slow)
    signal("BUY")
```

### OS8018 An input is never used

Severity warning. Stage checker. Since language version 1. Reference language.md 13.4. Test `tests/unit/check-calls.test.ts`.

**Message.** `The input {title} is declared at line {line} and never read.`

- `{title}` is the input's title, quoted.
- `{line}` is the line it is declared on.

**Cause.** The input still builds a row in the settings dialog, so a reader can change it and nothing happens, which is worse than the setting not being there at all.

**Fix.** Use the name the input assigns, or delete the input() and its dialog row.

Before:

```
len = input(20, "Length")
plot(ema(close, 9), "EMA", aqua)
```

After:

```
len = input(20, "Length")
plot(ema(close, len), "EMA", aqua)
```

### OS8019 A deleted object is still held

Severity warning. Stage checker. Since language version 1. Reference language.md 5.4. Test `tests/unit/check-deleted.test.ts`.

**Message.** `{name} still holds the {kind} deleted at line {line}.`

- `{name}` is the name or the array that refers to the deleted object.
- `{kind}` is the object kind: line, label, box or polyline.
- `{line}` is the line the delete is written on.

**Cause.** An object lives until the script deletes it, and deleting it touches neither the name nor the array element that refers to it: there is no collection of unreachable objects, because unreachable and no longer wanted are different facts and only the script knows the second. What is left is stale rather than absent, so the next setter that reaches it stops the bar with OS4005, usually many bars after the line that caused it.

**Fix.** Assign none to the name on the same path as the delete, and where the object came out of an array, remove the element as well as deleting the object.

Before:

```
var zones: array<box> = []
push(zones, draw.box(time, low, time, high))
if size(zones) > 20
    draw.delete(element(zones, 0))
```

After:

```
var zones: array<box> = []
push(zones, draw.box(time, low, time, high))
if size(zones) > 20
    draw.delete(element(zones, 0))
    shift(zones)
```

---

## 8.9 OS9xxx Import

### OS9001 Version not read by the importer

Severity error. Stage importer. Since language version 1. Reference docs/writing/importing-a-script.md 2. Test `tests/importer/refusals.test.ts`.

**Imported source.** The before block below is a script in the source dialect, which the importer reads rather than the compiler, and the after block is the OpenScript that script becomes once the fix is applied.

**Message.** `The importer reads scripts written for version 5 or 6 of the source dialect, and this one {found}.`

- `{found}` is what the version annotation says instead: that it declares another version, naming it, or that it declares none.

**Cause.** A script in the source dialect opens with an annotation comment naming the version of the dialect it is written for. The importer's reader, its table of built-ins and every rule it applies about where the two languages differ are written for versions 5 and 6, whose built-ins live in namespaces and whose declaration is an indicator or strategy call. An earlier version names its built-ins differently and differs in rules the importer does not model, so reading one under these rules would produce a translation that compiles and means something else. Nothing is translated: the result's source is empty and this is its only finding.

**Fix.** Bring the script up to version 5 or 6 in the source dialect, or translate it by hand, and import it again.

Before:

```
//@version=4
study("Range")
plot(high - low)
```

After:

```
version 1

study("Range")
plot(high - low, "Range")
```

### OS9002 Construct with no equivalent

Severity error. Stage importer. Since language version 1. Reference docs/writing/importing-a-script.md 4. Test `tests/importer/refusals.test.ts`.

**Imported source.** The before block below is a script in the source dialect, which the importer reads rather than the compiler, and the after block is the OpenScript that script becomes once the fix is applied.

**Message.** `The importer cannot translate {construct}, so the statement holding it was kept as a comment.`

- `{construct}` is the form the importer met, named in a few words: a tuple assignment, an if used as a value, a comparison with na.

**Cause.** Some forms of the source dialect have no OpenScript spelling that keeps their meaning: a value produced by an if or a switch, a tuple, a type, a method, an import, an array literal, a loop over a collection, and an equality test against na, which the source dialect answers false on every bar while OpenScript's own test for absence answers true where the value is absent. A few more are written in forms the importer's reader does not accept. The importer keeps the whole top level statement holding one as a comment line per source line, marked not translated, so the output still compiles and the original is there to translate from.

**Fix.** Translate that statement by hand from the comment that holds it: the rest of the script was translated around it.

Before:

```
//@version=5
indicator("Side")
side = if close > open
    1
else
    -1
plot(side)
```

After:

```
version 1

study("Side")
side = close > open ? 1 : -1
plot(side, "Side")
```

### OS9003 Built-in with no mapping

Severity error. Stage importer. Since language version 1. Reference docs/writing/importing-a-script.md 3. Test `tests/importer/refusals.test.ts`.

**Imported source.** The before block below is a script in the source dialect, which the importer reads rather than the compiler, and the after block is the OpenScript that script becomes once the fix is applied.

**Message.** `{name} is not one of the built-ins the importer maps, so the statement holding it was kept as a comment.`

- `{name}` is the built-in as the source writes it, namespace included.

**Cause.** The importer translates a built-in only where it holds a row saying which OpenScript name computes the same thing and how the arguments line up. A built-in with no row, or a name the source never declares, is not guessed at: a function with a similar name can differ in its arguments, its warmup or its arithmetic, and a translation that compiled with the wrong one would draw a line that looks right and is not. The whole top level statement holding it is kept as a comment.

**Fix.** Find the OpenScript library call that does the same job, check how it treats its first bars and absent values, and write the statement by hand.

Before:

```
//@version=5
indicator("Range position")
rank = ta.percentrank(close, 20)
plot(rank)
```

After:

```
version 1

study("Range position")
rank = percentRank(close, 20)
plot(rank, "Rank")
```

### OS9004 Declaration the importer cannot place

Severity error. Stage importer. Since language version 1. Reference docs/writing/importing-a-script.md 2. Test `tests/importer/refusals.test.ts`.

**Imported source.** The before block below is a script in the source dialect, which the importer reads rather than the compiler, and the after block is the OpenScript that script becomes once the fix is applied.

**Message.** `The importer writes the declaration from one indicator or strategy call at the top level, and this script {found}.`

- `{found}` is what the importer found instead: that the script has none, that it declares a library, or that it makes a second declaration here.

**Cause.** An OpenScript file carries exactly one declaration, and it is what makes the file a study or a strategy. The importer writes it from the source's indicator or strategy call and from nothing else, because a declaration it invented would decide whether the translation may place orders. A script with none, and a library, which has no declaration an OpenScript file can carry, are not translated at all: the result's source is empty and this is its only finding. A second declaration is kept as a comment and the first one is used.

**Fix.** Give the source script exactly one indicator or strategy declaration at the top level, and import it again.

Before:

```
//@version=5
basis = ta.sma(close, 20)
plot(basis)
```

After:

```
version 1

study("Basis")
basis = sma(close, 20)
plot(basis, "Basis")
```

### OS9005 Reads a statement that was not translated

Severity error. Stage importer. Since language version 1. Reference docs/writing/importing-a-script.md 4. Test `tests/importer/refusals.test.ts`.

**Imported source.** The before block below is a script in the source dialect, which the importer reads rather than the compiler, and the after block is the OpenScript that script becomes once the fix is applied.

**Message.** `{name} is declared by the statement at line {line}, which was not translated, so this statement that reads it was kept as a comment too.`

- `{name}` is the name, as the source writes it.
- `{line}` is the line of the statement that declares it and was kept as a comment.

**Cause.** A statement that was not translated declares nothing in the output, so a later statement reading one of its names would not compile. Rather than hand back a file that fails, the importer keeps every such statement as a comment as well, in source order, so that one refusal is reported once at its cause and once at each statement that follows from it.

**Fix.** Translate the statement at line {line} by hand first, then this one, which was kept as a comment only because it reads {name}.

Before:

```
//@version=5
indicator("Rank")
rank = ta.percentrank(close, 20)
smooth = ta.sma(rank, 5)
plot(smooth)
```

After:

```
version 1

study("Rank")
rank = percentRank(close, 20)
smooth = sma(rank, 5)
plot(smooth, "Smooth")
```

### OS9006 Argument with no equivalent

Severity error. Stage importer. Since language version 1. Reference docs/writing/importing-a-script.md 4. Test `tests/importer/arguments.test.ts`.

**Imported source.** The before block below is a script in the source dialect, which the importer reads rather than the compiler, and the after block is the OpenScript that script becomes once the fix is applied.

**Message.** `{argument} changes what {call} computes or trades, and OpenScript has no equivalent the importer can write.`

- `{argument}` is the argument, as the source names it or by its position.
- `{call}` is the call it was given to, as the source writes it.

**Cause.** Some arguments change the numbers a script produces or the orders it sends: a declaration's timeframe, a strategy's margin or its pyramiding above one, a limit price on an entry, a trailing exit, a quantity on a close, and a quantity on an entry in a strategy that sizes its orders in anything but units, which the source dialect counts in contracts and OpenScript in the declaration's own unit. Leaving one out would produce a translation that compiles and computes something else. An argument to the declaration or to an input is left out of that call, because the file needs its declaration and the rest of the script reads the input; every other call carrying one is kept as a comment.

**Fix.** Translate the call by hand, deciding what OpenScript should do in place of {argument}, or remove {argument} from the source script if the script does not depend on it.

Before:

```
//@version=5
indicator("Daily basis", timeframe = "D")
plot(ta.sma(close, 20))
```

After:

```
version 1

study("Daily basis")
plot(req.timeframe("1D", sma(close, 20)), "Basis")
```

### OS9007 Warmup and absent bars follow OpenScript

Severity warning. Stage importer. Since language version 1. Reference language.md 6.7, 7.3; stdlib.md 2.4, 20.2. Test `tests/importer/differences.test.ts`.

**Imported source.** The before block below is a script in the source dialect, which the importer reads rather than the compiler, and the after block is the OpenScript that script becomes once the fix is applied.

**Message.** `{call} became {target} here and wherever else the script calls it, and {target} follows OpenScript's own warmup, arithmetic and handling of absent values, which the original is not guaranteed to share.`

- `{call}` is the built-in as the source writes it.
- `{target}` is the OpenScript call it was translated to.

**Cause.** OpenScript fixes, for every function, the first bar a value appears on, how a seeded average is seeded, the order its arithmetic is done in and what an absent value inside the window does (stdlib.md sections 2.4 and 20). The source dialect does not fix the same things to the same precision, and where it says anything it can say something else: it skips absent values in windows where OpenScript propagates them. So a translated average can be absent on a first bar where the original drew a value, or differ in the last digits. Over a source with no absent values, and after the first bars, the two compute the same quantity. The finding is given once per built-in, at its first call.

**Fix.** Compare the first bars of the translation with the original, and where the script depends on them, write the value as an explicit recurrence held in var, seeded the way the original seeds it.

Before:

```
//@version=5
indicator("Average")
plot(ta.ema(close, 20))
```

After:

```
version 1

study("Average")
plot(ema(close, 20), "Average")
```

### OS9008 Whole-number division in version 5

Severity warning. Stage importer. Since language version 1. Reference language.md 9.2. Test `tests/importer/differences.test.ts`.

**Imported source.** The before block below is a script in the source dialect, which the importer reads rather than the compiler, and the after block is the OpenScript that script becomes once the fix is applied.

**Message.** `Both sides of this division are whole-number constants, which version 5 of the source dialect divides without a fractional part, and OpenScript keeps the fraction.`

**Cause.** Version 5 of the source dialect gives the quotient of two whole-number constants as a whole number, and version 6 and OpenScript both keep the fraction (language.md 9.2). A constant here is a whole-number literal, or a name the script binds once to one and never reassigns. The importer writes the division as OpenScript writes it and says so, rather than deciding which of the two results the script's author was relying on.

**Fix.** If the script relied on the whole-number result, wrap the translated division in trunc(); otherwise leave it as it is.

Before:

```
//@version=5
indicator("Half")
half = 7 / 2
plot(close * half)
```

After:

```
version 1

study("Half")
half = trunc(7 / 2)
plot(close * half, "Half")
```

### OS9009 Presentation argument left out

Severity warning. Stage importer. Since language version 1. Reference docs/writing/importing-a-script.md 5. Test `tests/importer/arguments.test.ts`.

**Imported source.** The before block below is a script in the source dialect, which the importer reads rather than the compiler, and the after block is the OpenScript that script becomes once the fix is applied.

**Message.** `{argument} changes how {call} is displayed or what it may allocate, not what it computes, and OpenScript has no equivalent, so the translation leaves it out.`

- `{argument}` is the argument, as the source names it.
- `{call}` is the call it was given to, as the source writes it.

**Cause.** Many arguments in the source dialect are about the picture rather than the numbers: a line that tracks the price, a label size, a legend entry, a count of drawings to keep, a style the OpenScript call does not offer. Leaving one out changes what the chart looks like and nothing the script computes or trades, so the call is translated and the argument is reported rather than silently dropped.

**Fix.** Nothing needs to change unless the display mattered; where it did, restyle the translated call with the arguments OpenScript does have, such as its colour, width and style.

Before:

```
//@version=5
indicator("Close")
plot(close, "Close", trackprice = true)
```

After:

```
version 1

study("Close")
plot(close, "Close")
```

### OS9010 Order placed under OpenScript's order model

Severity warning. Stage importer. Since language version 1. Reference stdlib.md 17.1, 17.2. Test `tests/importer/orders.test.ts`.

**Imported source.** The before block below is a script in the source dialect, which the importer reads rather than the compiler, and the after block is the OpenScript that script becomes once the fix is applied.

**Message.** `{call} was translated into OpenScript's order calls here and wherever else the script uses it, and OpenScript decides when an order fills, how a reversal and a repeated entry are handled and when an exit level starts to apply by its own order model.`

- `{call}` is the order call as the source writes it.

**Cause.** The importer translates an entry into a close of any opposite position and an entry guarded so that it never adds to a position already held on its side, which is what the source dialect does with its default pyramiding, and an exit into a leg level guarded by the side of the entry it names, with profit and loss distances converted from ticks by the instrument's tick size. That is as close as the two order models come, and they are not the same model: an OpenScript exit sets the leg's level when it is called rather than when its entry fills, a repeated entry past the pyramiding limit is refused rather than ignored, and an order a script places while flat is sized and filled by the rules of stdlib.md section 17. The finding is given once per order call, at its first use.

**Fix.** Backtest the translation beside the original and compare the two trade lists before relying on it, and adjust the order calls by hand where they part.

Before:

```
//@version=5
strategy("Cross")
fast = ta.sma(close, 10)
slow = ta.sma(close, 30)
if ta.crossover(fast, slow)
    strategy.entry("Long", strategy.long)
```

After:

```
version 1

strategy("Cross", capital = 1000000)
fast = sma(close, 10)
slow = sma(close, 30)
if crossUp(fast, slow)
    if pos.size < 0
        close()
    if pos.size <= 0
        buy(tag = "Long")
```

### OS9011 Equality over two absent values

Severity warning. Stage importer. Since language version 1. Reference language.md 6.5. Test `tests/importer/differences.test.ts`.

**Imported source.** The before block below is a script in the source dialect, which the importer reads rather than the compiler, and the after block is the OpenScript that script becomes once the fix is applied.

**Message.** `Both sides of {operator} can be absent on the same bar, and OpenScript counts two absent values as equal, which the original is not guaranteed to do.`

- `{operator}` is the equality operator, == or !=.

**Cause.** OpenScript's equality is total: none == none is true and none != none is false, so that a test for absence can be written as a comparison (language.md 6.5). The source dialect does not count two absent values as equal. Where both sides of an equality can be absent together, which is every warmup bar of two averages, the translation and the original can take different branches on exactly those bars.

**Fix.** If the original relied on two absent values never comparing equal, guard the translated comparison with isNone() on either side.

Before:

```
//@version=5
indicator("Touch")
fast = ta.sma(close, 5)
slow = ta.sma(close, 20)
plot(fast == slow ? 1 : 0)
```

After:

```
version 1

study("Touch")
fast = sma(close, 5)
slow = sma(close, 20)
plot(not isNone(fast) and fast == slow ? 1 : 0, "Touch")
```

### OS9012 The translation does not compile

Severity error. Stage importer. Since language version 1. Reference docs/writing/importing-a-script.md 4. Test `tests/importer/refusals.test.ts`.

**Imported source.** The before block below is a script in the source dialect, which the importer reads rather than the compiler, and the after block is the OpenScript that script becomes once the fix is applied.

**Message.** `The OpenScript compiler refused the translation of this statement with {code}, so the statement was kept as a comment.`

- `{code}` is the catalogue code the compiler raised on the translated text.

**Cause.** The importer compiles its own output before it returns it, so that what it hands back compiles. A statement can translate construct by construct and still be refused as a whole: version 5 of the source dialect lets a number stand where a condition is expected, and the source dialect lets a name inside a block keep a history and lets two values of different types meet where OpenScript refuses. The importer does not type the source script, so it learns of these from the compiler, keeps the statement as a comment and compiles again.

**Fix.** Look up {code} in this catalogue and translate the statement by hand in the form that code's fix describes.

Before:

```
//@version=5
indicator("Traded")
traded = volume ? 1 : 0
plot(traded)
```

After:

```
version 1

study("Traded")
traded = volume > 0 ? 1 : 0
plot(traded, "Traded")
```

---
