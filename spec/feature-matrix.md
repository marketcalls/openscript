# Feature matrix

One row per language feature. Each row says what the feature is, whether it is
specified, implemented or planned, which specification section defines it, and
which test proves it.

**There is no completion percentage in this file.** The percentage is computed and
printed by continuous integration, which reads these tables, counts the rows,
counts the rows marked `implemented`, confirms that each of those rows names a
test that exists and passes, and prints the ratio. Nobody types a number, so
nobody can be optimistic about one.

---

## The rule continuous integration enforces

The checker, `scripts/check-matrix.mjs`, reads this file and takes every table
row that sits under a numbered `##` section heading below the horizontal rule
after this preamble. Each such row is a feature row with five cells, in order:
Feature, What it is, Status, Section, Test. Tables above that rule are prose and
are not read.

**A row is valid when all six of these hold.**

1. **Status** is exactly one of `specified`, `implemented`, `planned`,
   `deferred`, in backticks.
2. **Section** is either the literal `none`, in backticks, or a comma-separated
   list of one or more citations. A citation is a document name in backticks,
   optionally followed by one space and a locator. The document must be a
   Markdown file that exists in `spec/`. The locator is either a section number,
   digits separated by dots, or an error code matching `OS[0-9]{4}`, and it must
   exist as a heading in that document: a section number matches the regular
   expression `^#{2,4} <locator>[. ]` and an error code matches `^### <code> `.
   A citation with no locator names the document as a whole and resolves when
   the file exists.
3. A row whose Status is `specified`, `implemented` or `deferred` has a Section
   that is not `none`. A row whose Status is `planned` may have either, and cites
   a section only when that section names the feature without defining it.
4. **Test** is exactly one identifier in backticks, of the form `<area>/<name>` or
   `unit:<area>/<name>`, where `<area>` is one of the areas listed below and
   `<name>` is lowercase letters, digits and hyphens. No two rows in this file
   carry the same identifier.
5. A row whose Status is `implemented` names a test that exists and passed in this
   run: a `unit:` identifier is a compiler unit test, and any other is the
   directory `cases/<identifier>` of the conformance suite. A unit test exists
   when a file under `tests/` writes the identifier, and a case exists when its
   directory holds the `case.json` that `conformance.md` section 2 requires; the
   checker proves existence, and the unit runner and the suite prove passing.
6. A row whose Feature or What it is cell names an error code that
   `spec/errors.json` defers has Status `deferred`, and a `deferred` row names
   such a code. `scripts/check-raises.mjs` enforces both halves on every run, so
   neither this file nor the catalogue can move without the other.

**The build fails when any of these is true.**

1. A feature row is invalid under any of the six rules above. The message names
   the section, the feature and the rule.
2. A citation does not resolve: the document is absent from `spec/`, or the
   locator is not a heading in it. This is the failure that this file was rebuilt
   to remove, and it is the reason the checker resolves every citation on every
   run rather than trusting the text.
3. A conformance case directory exists that no row names. Coverage that no feature
   claims is coverage that proves nothing.
4. Two rows name the same test identifier.

**What it prints on success:** the row count, the count per status, and the
implemented ratio.

### One thing conformance.md says too broadly

`conformance.md` section 2 says both that a case with no matching matrix row fails
the build and that a matrix row naming a case that does not exist fails the build.
Only the first half holds unconditionally, and rule 5 above is the whole of the
second half: the Test cell of a `specified` or `planned` row reserves an
identifier, it does not claim the case is written. The reason is that this matrix
is written before the suite, so under the broader reading no row could be added
until its case existed, which would make the matrix a record of the suite rather
than a plan for it, while the half that matters, that no case exists which no
feature claims, is untouched.

## Status values

| Status | Means |
|---|---|
| `specified` | A section of a document that exists defines the behaviour completely. No implementation yet. |
| `implemented` | Specified, implemented, and the named test passes in the last CI run. |
| `planned` | Agreed as in scope for language version 1, and not yet defined completely by any section. |
| `deferred` | Specified completely, and the implementation deliberately does not do it yet. The row names an error code that `spec/errors.json` defers, and that entry says in a sentence what happens instead today and what has to exist before the code is raised. |

An `implemented` row appears when a compiler stage passes the test that row
names, and not before. How many there are is what the checker prints on every
run, never a number typed here.

`deferred` exists because `specified` was doing two jobs and only saying one of
them. It is true of a refusal that no code path can produce, and nearly every row
in this file says it, so the word had become this file's way of saying "this is
how it works". A reader consults this matrix to decide what they can rely on, and
a whole range of the error catalogue was documented here, and in five other
documents, as behaviour they could rely on while nothing anywhere raised it. A
row that promises a refusal the implementation cannot make now says so in the
column the reader is already looking at, and `scripts/check-raises.mjs` will not
let this file and the catalogue disagree again.

`planned` is not a soft form of `specified`. A `planned` row means the design
question is still open in at least one detail, and that detail has to be decided
and written down before any code is written for it, because a rule that is decided
in code is a rule that two engines will decide differently.

**A library entry that `stdlib.md` marks `(planned)` is `planned` here.** Such an
entry names a call and its shape so the surface is legible, as `stdlib.md` section
1 says, and does not define its behaviour; calling one is OS2001. Those entries
are collected into one row per library section rather than one row per name, so
the planned count stays readable.

## Documents a row may cite

A row may cite any document `spec/README.md` lists. There is no planned
document, and a citation to a document that does not exist is a build failure,
not a promise.

Which documents there are, what each one holds, and which of them wins where two
disagree are `spec/README.md`'s. Nothing about that list is repeated here,
because a list kept in two places is a list that goes stale in one of them.

## Where two documents disagree

Both are recorded here because a matrix that hid them would be measuring a
specification that does not exist. Neither is a row: a row states one settled
behaviour, and each of these needs an entry in `issues/` against the stale
document. Where the answer is settled the paragraph says which document is
right; where it is not, it names the issue that will settle it.

**Object lifetime.** `language.md` section 5.4 says a runtime object lives until
the script deletes it, that dropping the last name referring to it does not delete
it, and that there is no collection of unreachable objects.
`compiled-program.md` section 3.2 says the object heap keeps what is reachable
from cells and from strategy state. `language.md` is right and that line of
`compiled-program.md` is stale, because when a drawing stops drawing is a rule of
the language, and a reachability test would erase a line the moment a script
reused the variable holding it.

**A fact the host did not supply.** `errors.md` OS6012 says that reading an
instrument fact the host cannot supply, naming tick size and lot size among them,
is an error, while `stdlib.md` section 3.4 says a bare read of `chart.tickSize`
is absent and section 8.1 says `roundToTick` returns absence on the strength of
it. Both cannot be true of one read. Which of them is right is not settled here:
it is `issues/0002`. Until that issue closes the row `chart/tick-and-lot` in
section 16 states both halves, and the row `math/round-to-tick` in section 17
rests on the absent one.

## Test identifiers

A test identifier is `<area>/<name>`. That is also the path of the conformance
case directory, relative to the suite root, so a row in this table and a directory
on disk are the same string. `conformance.md` section 2 defines the case layout.

An identifier prefixed `unit:` is a compiler unit test rather than a conformance
case, used where the thing being proved is a diagnostic or a compiler-internal
invariant and there are no bars to run.

Areas: `lex`, `lexical`, `syntax`, `static`, `version`, `type`, `obj`,
`absent`, `bar`, `chart`, `persist`, `expr`, `flow`, `fn`, `scope`, `decl`,
`input`, `array`, `lib`, `str`, `math`, `color`, `ta`, `series`, `time`,
`session`, `plot`, `fill`, `level`, `barcolor`, `background`, `table`, `draw`,
`req`, `alert`, `order`, `pos`, `perf`, `err`, `log`, `prog`, `conf`.

`lex` and `lexical` are both here and are not a duplication. A `unit:lex/...`
identifier names a test inside this implementation; a bare `lexical/...` one
names a conformance case directory, which is the category name
`conformance.md` section 7 gives it and is what any engine runs. The same
diagnostic may be proved both ways, and rule 4 forbids two rows sharing one
identifier rather than one diagnostic having two proofs.

---

## 1. Lexical structure

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| Source encoding | UTF-8 text, a leading byte order mark accepted and ignored | `specified` | `language.md` 3.1 | `unit:lex/encoding-bom` |
| Line ending normalisation | CRLF folded to LF before anything else, so one file compiles identically on any operating system | `specified` | `language.md` 3.1 | `unit:lex/line-endings` |
| Illegal character rejection | Anything outside the permitted set, including a non-breaking space or a typographic quote, is OS1001 at the character | `specified` | `language.md` 3.1, `errors.md` OS1001 | `unit:lex/illegal-character` |
| Line comment | `//` to end of line, and not inside a string literal | `specified` | `language.md` 3.2 | `unit:lex/comment` |
| No block comment | The form does not exist, so an unterminated one cannot swallow a file; a marker written anyway is OS1026 at the marker, rather than arithmetic errors on the operators it is made of | `specified` | `language.md` 3.2, `errors.md` OS1026 | `unit:lex/no-block-comment` |
| Identifiers | ASCII letter or underscore, then letters, digits, underscores; case sensitive | `specified` | `language.md` 3.3 | `unit:lex/identifier` |
| Reserved words | The version 1 reserved list, including words reserved but unused | `specified` | `language.md` 3.4, `errors.md` OS1019 | `unit:lex/reserved-words` |
| Decimal number literal | Integer, fractional, and a leading `.` with no digit before it | `specified` | `language.md` 3.5 | `lex/number-decimal` |
| Digit group separator | `_` between digits, carrying no meaning | `specified` | `language.md` 3.5 | `lex/number-underscore` |
| Exponent form | `2.5e-4` | `specified` | `language.md` 3.5 | `lex/number-exponent` |
| Hexadecimal literal | `0xFF`, with no octal and no binary form, so `010` is ten | `specified` | `language.md` 3.5 | `lex/number-hex` |
| Unary minus on a literal | A negative number is an operator applied to a literal, not part of it | `specified` | `language.md` 3.5 | `lex/number-negative` |
| A name written against a number | A run such as a binary prefix or a literal ending in an underscore is neither a number nor a name, and the whole run is OS1029: naming its first character, which the language accepts, and advising its deletion would leave a valid name and a different program | `specified` | `language.md` 3.3, `language.md` 3.5, `errors.md` OS1029 | `unit:lex/number-then-name` |
| String literal | Double or single quoted, the two forms identical | `specified` | `language.md` 3.6 | `lex/string-literal` |
| String escapes | `\\ \" \' \n \t \r \0 \uXXXX`, any other backslash sequence OS1005 | `specified` | `language.md` 3.6, `errors.md` OS1005 | `lex/string-escapes` |
| Unterminated string | OS1004 reported at the opening quote, naming the missing delimiter | `specified` | `language.md` 3.6, `errors.md` OS1004 | `unit:lex/string-unterminated` |
| Boolean literals | `true` and `false`, of type `bool`, never numbers | `specified` | `language.md` 3.7 | `lex/bool-literal` |
| Named colour literal | Nineteen bare names, no prefix | `specified` | `language.md` 3.8, `stdlib.md` 11.1 | `lex/color-named` |
| Hex colour literal | `#rrggbb` and `#rrggbbaa` | `specified` | `language.md` 3.8 | `lex/color-hex` |
| Malformed colour literal | A run of hexadecimal digits that is not six or eight long is OS1027, which names the form, rather than OS1001 on the `#`, whose advice is to delete it | `specified` | `language.md` 3.8, `errors.md` OS1027 | `unit:lex/color-malformed` |
| Absent literal | `none`, written bare, with its own type | `specified` | `language.md` 3.9 | `lex/none-literal` |
| Newline terminates a statement | One statement per line, no separator; a `;` is OS1007 | `specified` | `language.md` 3.10, `errors.md` OS1007 | `unit:lex/no-semicolon` |
| One statement per line | Two statements on one line is OS1018, since there is no separator that would join them | `specified` | `language.md` 3.10, `errors.md` OS1018 | `unit:lex/one-statement-per-line` |
| Indentation blocks | A header line and the more deeply indented lines under it | `specified` | `language.md` 3.10 | `lex/block-indent` |
| Spaces only | A tab in leading whitespace is OS1002, because a tab's width is an editor setting | `specified` | `language.md` 3.10, `errors.md` OS1002 | `unit:lex/tab-indent` |
| Sibling indentation equality | Every line of one block carries identical leading whitespace, or OS1003 | `specified` | `language.md` 3.10, `errors.md` OS1003 | `unit:lex/indent-mismatch` |
| Blank and comment-only lines carry no indentation | Such a line emits no token: it never opens or closes a block, is never OS1003, and accepts any indentation | `specified` | `language.md` 3.10 | `lex/blank-and-comment-lines` |
| A commented-out line at column zero | Does not close the block it sits in, because every editor writes it that way and a rule that closed a block there would close it invisibly | `specified` | `language.md` 3.10 | `lex/comment-column-zero` |
| Empty block | A header with no indented body is OS1010, and blank or comment-only lines do not count as a body | `specified` | `language.md` 3.10, `errors.md` OS1010 | `unit:lex/empty-block` |
| One single-line form only | `fn` writes its body after `=>` and opens no block; `if`, `else`, `for`, `while`, `case` and `default` have no such form | `specified` | `language.md` 3.10, `language.md` 11.1 | `unit:lex/single-line-forms` |
| Continuation by open bracket | An unclosed `(` or `[` continues the statement | `specified` | `language.md` 3.11 | `lex/continuation-bracket` |
| Continuation by trailing token | A trailing binary operator, comma, `?`, `:` or `=` continues the statement | `specified` | `language.md` 3.11 | `lex/continuation-operator` |
| A continuation with nothing after it | OS1022, naming the token the statement ended on, because a trailing operator promised a right-hand side | `specified` | `language.md` 3.11, `errors.md` OS1022 | `unit:lex/continuation-incomplete` |
| Continuation by backslash | A trailing `\` continues the statement | `specified` | `language.md` 3.11 | `lex/continuation-backslash` |
| Continuation indentation | A continuation line must be indented past the line its statement began on, or OS1028, which is its own code because a continuation opens no block and OS1003's message is written about one | `specified` | `language.md` 3.11, `errors.md` OS1028 | `unit:lex/continuation-indent` |
| Bracket never closed | OS1012 at the opening bracket, and a mismatched closer is OS1013 | `specified` | `language.md` 3.11, `errors.md` OS1012, `errors.md` OS1013 | `unit:lex/bracket-unclosed` |
| Operator token set | The exact punctuation list of section 3.12 | `specified` | `language.md` 3.12 | `unit:lex/operator-tokens` |
| Rejected operator spellings | The C-style spellings of not, and, or and power do not exist, nor do `;` and the increment operators, and each has a named fix | `specified` | `language.md` 3.12 | `unit:lex/rejected-operators` |
| Canonical layout | The one layout a formatter produces: four spaces a block, eight for a continuation line, one space inside a line, and a comment on its own line taking the indentation of the line below it | `specified` | `language.md` 3.13 | `unit:lex/canonical-layout` |
| Laying a file out again preserves its meaning | A formatter moves whitespace and nothing else, so the program a file compiles to is the same before and after | `specified` | `language.md` 3.13 | `unit:lex/format-preserves-meaning` |
| A file that does not parse has no canonical layout | It comes back unchanged rather than laid out as far as it could be, because a character the lexer refused produces no token and a reprint from the tokens would delete it | `specified` | `language.md` 3.13 | `unit:lex/format-refuses-unread` |

## 2. Version declaration and compatibility

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| `version` statement | A bare first line naming the language version, readable by a one-line scan | `specified` | `language.md` 4 | `version/declared` |
| The version line is first | Anything before it except comments is OS1021 | `specified` | `language.md` 4, `errors.md` OS1021 | `unit:version/not-first` |
| Absent version declaration | Compiled at the newest version, with warning OS8003 naming the line to add | `specified` | `language.md` 4, `errors.md` OS8003 | `version/undeclared-warns` |
| Front end selection | Version 1 source is always parsed by the version 1 front end, which is kept forever | `specified` | `language.md` 4.1 | `version/front-end-pinned` |
| Compatibility promise | A script that compiles under version N compiles under every later release and produces the same numbers | `specified` | `language.md` 4.1 | `version/promise-corpus` |
| Deprecation instead of removal | A construct that was a mistake keeps working and gains OS8013 naming its replacement | `deferred` | `language.md` 4.1, `errors.md` OS8013 | `version/deprecation-warns` |

## 3. Types and conversion

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| `number` | Binary64, always finite; infinity and not-a-number never appear as values | `specified` | `language.md` 5.1 | `type/number-finite` |
| No integer type | One numeric type, so no conversion exists to get wrong | `specified` | `language.md` 5.1 | `type/no-integer-type` |
| Whole-number arguments | A fractional length or index is OS3004 at compile time and OS4003 at run time, rejected rather than truncated | `specified` | `language.md` 5.1, `errors.md` OS3004, `errors.md` OS4003 | `type/whole-number-required` |
| `string` | A sequence of Unicode code points | `specified` | `language.md` 5.1 | `type/string` |
| `bool` | `true` or `false`, not a number | `specified` | `language.md` 5.1 | `type/bool` |
| `color` | Red, green, blue and alpha | `specified` | `language.md` 5.1, `stdlib.md` 11 | `type/color` |
| `none` type | The absent value, a member of every type | `specified` | `language.md` 5.1, `language.md` 6 | `type/none` |
| `series T` | One `T` per bar | `specified` | `language.md` 5.2 | `type/series` |
| `array<T>` | Ordered, mutable, resizable, homogeneous | `specified` | `language.md` 5.1, `language.md` 14.1 | `type/array` |
| Time as a number | Milliseconds since the epoch, UTC; no separate time type in version 1 | `specified` | `language.md` 5.1 | `type/time-is-number` |
| No implicit conversion | `0` is not false, `""` is not false, `1 + true` is OS2003 | `specified` | `language.md` 5.3, `errors.md` OS2003 | `type/no-coercion` |
| `text(x)` | Any value to a string; `text(none)` is `"none"` | `specified` | `language.md` 5.3, `stdlib.md` 10 | `type/text` |
| `text(x, decimals)` | A number to a string with fixed decimals, halves away from zero | `specified` | `language.md` 5.3, `stdlib.md` 10 | `type/text-decimals` |
| `toNumber(s)` | A string to a number, or absence when it does not parse | `specified` | `language.md` 5.3, `stdlib.md` 10 | `type/number-parse` |
| `toBool(x)` | Absence to `false`, a bool to itself; numbers rejected | `specified` | `language.md` 5.3, `stdlib.md` 8.1 | `type/bool-convert` |
| Broadcast | A plain `T` used where `series T` is expected is that value on every bar | `specified` | `language.md` 5.2 | `type/broadcast` |
| Type fixed by first assignment | Assigning a different type to a name later is OS2003 | `specified` | `language.md` 10.1, `errors.md` OS2003 | `type/first-assignment-fixes` |
| A name initialised to none | none fixes no type: the type comes from the first assignment in source order that gives a definite one, and a name never given one is absent for the whole run | `specified` | `language.md` 10.1, `language.md` 6 | `type/none-initialised` |
| Type annotations | `series number`, `array<number>` and the rest, checked when present | `specified` | `language.md` 11.2, `language.md` 19 | `type/annotation` |
| Unknown type in an annotation | OS2016, listing the type names that exist | `specified` | `language.md` 19, `errors.md` OS2016 | `unit:type/unknown-annotation` |

## 4. Declaration handles and runtime objects

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| Declaration handle | `plot`, `plotCandles`, `fill` and `level` return a compile-time value of type `plot`, `plot`, `fill` and `level`, with no run-time representation at all | `specified` | `language.md` 5.4, `stdlib.md` 14.2 | `obj/handle-kind` |
| Runtime object | `draw.line`, `draw.label`, `draw.box`, `draw.polyline` and `table` return an ordinary reference value of type `line`, `label`, `box`, `polyline` and `table` | `specified` | `language.md` 5.4, `stdlib.md` 14.4 | `obj/object-kind` |
| Why the split | A plot is one field of a fixed descriptor and a drawing is one of an unbounded set, so only the second can be a value the script holds | `specified` | `language.md` 5.4 | `obj/split-rationale` |
| Handle where a value is required | OS2003, naming `plot`, `fill` or `level` as the type | `specified` | `language.md` 5.4, `errors.md` OS2003 | `unit:obj/handle-as-value` |
| Handle in an argument that does not take one | OS3011 | `specified` | `language.md` 5.4, `errors.md` OS3011 | `unit:obj/handle-wrong-argument` |
| A handle where a runtime object belongs | OS3019, the refinement of OS3011 for an argument that takes a line, label, box, polyline or table | `specified` | `language.md` 5.4, `errors.md` OS3019 | `unit:obj/handle-in-object-argument` |
| `fill` is the only call taking a handle | A handle may be named at the top level and passed to a declaration call that takes one, and nothing else; naming a `fill` or `level` result is legal and does nothing | `specified` | `language.md` 5.4, `stdlib.md` 14.2 | `obj/handle-to-fill` |
| A handle is a compile-time binding | Section 8.1's per-bar recomputation does not apply to a name bound to a handle: it is bound once and nothing of it is left in the bar loop | `specified` | `language.md` 5.4 | `obj/handle-binding` |
| `table` is an object with a top-level call site | The call is top level because the grid's shape is fixed, and what it returns is written to per bar, so it is a run-time value | `specified` | `language.md` 5.4, `stdlib.md` 14.3 | `obj/table-is-object` |
| One table per call site | One `table()` call site returns the same object on every bar | `specified` | `language.md` 5.4, `stdlib.md` 14.3 | `obj/table-same-object` |
| Objects are references | Two names for one object, and `==` between two of them is identity | `specified` | `language.md` 5.4, `language.md` 9.3 | `obj/identity-equality` |
| Objects in arrays and functions | An object may be held in a `var`, kept in an `array<box>`, passed to a user function and compared against `none`; a handle may do none of that | `specified` | `language.md` 5.4, `language.md` 14.1 | `obj/array-of-objects` |
| Neither kind takes `[]` | No history operator on a handle or on an object | `specified` | `language.md` 5.4, `errors.md` OS2004 | `unit:obj/no-history` |
| Object lifetime | An object lives from the bar that created it until the bar that deletes it | `specified` | `language.md` 5.4, `stdlib.md` 14.4 | `obj/lifetime` |
| No collection of unreachable objects | Dropping the last name referring to an object does not delete it; the chart holds it and it keeps drawing | `specified` | `language.md` 5.4 | `obj/no-collection` |
| Stale handle in a setter | Passing a deleted object to a setter is OS4005, not a silent no operation | `specified` | `language.md` 5.4, `stdlib.md` 14.4, `errors.md` OS4005 | `unit:obj/stale-handle` |
| Deleting does not remove the array element | A script holding objects in an array deletes the object and then removes the element | `specified` | `language.md` 5.4 | `obj/delete-keeps-element` |
| A table is never deleted | `clear(t)` empties its cells and the grid lives as long as the study | `specified` | `language.md` 5.4, `stdlib.md` 14.3 | `obj/table-cleared-not-deleted` |
| Rollback of objects created on a moving bar | The object set is restored to the end of the previous bar before the bar runs again, so a live chart does not gain one object per tick | `specified` | `language.md` 5.4, `language.md` 7.5, `stdlib.md` 14.4 | `obj/rollback` |
| No object cap in the language | The language fixes no number; the budget is the host's memory, and a host that cannot hold another one says so with OS5010 rather than dropping the oldest | `specified` | `language.md` 5.4, `stdlib.md` 14.4, `errors.md` OS5010 | `obj/no-cap` |
| Object types in the grammar | `type` admits the object types and `array<objectType>` | `specified` | `language.md` 19, `language.md` 14.1 | `obj/grammar-object-types` |
| Handle types are not in the grammar | They are deliberately absent because a handle type can never be annotated | `specified` | `language.md` 5.4, `language.md` 19 | `unit:obj/no-handle-annotation` |

## 5. The absent value

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| `isNone(x)` | True when absent | `specified` | `language.md` 6.1, `stdlib.md` 8.1 | `absent/is-none` |
| `orElse(x, fallback)` | The value when present, the fallback when absent | `specified` | `language.md` 6.1, `stdlib.md` 8.1 | `absent/or-else` |
| Arithmetic propagation | Any absent operand makes the result absent | `specified` | `language.md` 6.2 | `absent/arithmetic` |
| `none * 0` is absent | Zero times unknown is unknown, because the operand was not a number at all | `specified` | `language.md` 6.2 | `absent/times-zero` |
| Concatenation propagation | `"a" + none` is absent; print it deliberately with `text(none)` | `specified` | `language.md` 6.2 | `absent/concat` |
| Division by zero | Absence, including `0 / 0`, so one bad bar does not kill a correct study | `specified` | `language.md` 6.3 | `absent/divide-by-zero` |
| Non-finite maths | `sqrt(-1)`, `log(0)`, overflow: absence, never infinity | `specified` | `language.md` 6.3, `stdlib.md` 2.4 | `absent/non-finite` |
| Ordering propagation | `<`, `<=`, `>`, `>=` return absence when either operand is absent, never `false`, and comparing against `none` warns with OS8012 | `specified` | `language.md` 6.4, `errors.md` OS8012 | `absent/ordering` |
| Equality is total | `==` and `!=` always return a bool, so a script can ask the question | `specified` | `language.md` 6.5 | `absent/equality` |
| Three-valued logic | The `and`, `or`, `not` table with absence meaning unknown, both operators commutative | `specified` | `language.md` 6.6, `compiled-program.md` 4.7 | `absent/three-valued-logic` |
| Short circuit | An operand is evaluated only when it can change the result | `specified` | `language.md` 6.6, `language.md` 9.4 | `absent/short-circuit` |
| Absent condition | An absent condition takes the false branch, in `if`, `while`, the ternary, a switch arm and an alert | `specified` | `language.md` 6.6 | `absent/condition-false-branch` |
| OS8004 warning | Warns on an `if` whose condition can be absent and whose block assigns a name read outside it | `deferred` | `language.md` 6.6, `errors.md` OS8004 | `unit:absent/os8004-warning` |
| Library propagation | A window function is absent if any bar in its window is absent | `specified` | `language.md` 6.7, `stdlib.md` 2.4 | `absent/window-propagation` |
| The three skipping functions | `sumSkip`, `avgSkip`, `countPresent`, named for what they do | `specified` | `language.md` 6.7, `stdlib.md` 9 | `absent/skip-functions` |
| The one exception in the library | `trueRange()` on bar 0 is `high - low` rather than absent, written down here rather than left to the engine | `specified` | `stdlib.md` 6 | `absent/true-range-bar-zero` |
| Absence on a drawing surface | A gap, never a zero: a broken line, a stopped fill, an unpainted bar, a blank cell | `specified` | `language.md` 6.7, `stdlib.md` 18 | `absent/surface-gap` |
| Absence in an order | An absent price or quantity is OS7002 naming the argument, never a substituted value | `specified` | `language.md` 6.8, `stdlib.md` 17.1, `errors.md` OS7002 | `absent/order-rejected` |
| Absence in memory is a tag | An engine must not represent absence as a number, because a not-a-number sentinel gets four operators right and six wrong | `specified` | `compiled-program.md` 3.4 | `prog/absent-tag` |

## 6. The per-bar execution model

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| One pass per bar | Every top-level statement runs, first line to last, once per bar, oldest first | `specified` | `language.md` 7.1, `compiled-program.md` 5.1 | `bar/one-pass-per-bar` |
| No entry point | The file is the body of the per-bar loop; there is no main and no event handler | `specified` | `language.md` 7.1 | `bar/no-entry-point` |
| Fixed-shape statements | The calls `language.md` 15.3 puts at the top level, and the declaration, are read once; their value arguments run every bar | `specified` | `language.md` 7.1, `language.md` 15.3, `stdlib.md` 14.1 | `bar/fixed-shape-once` |
| Fixed-shape call in a block | A call that may only appear at the top level, written inside a conditional, is OS3006, with the fix the catalogue gives for that call | `specified` | `language.md` 15.3, `errors.md` OS3006 | `unit:bar/os3006-in-block` |
| `bar.index` | Zero-based position in the supplied dataset, oldest bar 0 | `specified` | `language.md` 7.2, `stdlib.md` 3.3 | `bar/index` |
| `bar.count` | `bar.index + 1` | `specified` | `language.md` 7.2, `stdlib.md` 3.3 | `bar/count` |
| `bar.isFirst` | This is bar 0 | `specified` | `language.md` 7.2, `stdlib.md` 3.3 | `bar/is-first` |
| `bar.isLast` | This is the newest bar in the dataset | `specified` | `language.md` 7.2, `stdlib.md` 3.3 | `bar/is-last` |
| `bar.isConfirmed` | This bar's interval has elapsed; true for every historical bar | `specified` | `language.md` 7.2, `stdlib.md` 3.3 | `bar/is-confirmed` |
| `bar.isRealtime` | A live feed is driving updates | `specified` | `language.md` 7.2, `stdlib.md` 3.3 | `bar/is-realtime` |
| `bar.isNew` | The last update appended a bar rather than replacing one | `specified` | `language.md` 7.2, `stdlib.md` 3.3 | `bar/is-new` |
| `bar.updates` | How many times this bar has been executed | `specified` | `language.md` 7.2, `stdlib.md` 3.3 | `bar/updates` |
| Warmup as absence | No warmup phase exists: a function needing `k` bars is absent until `k` bars exist | `specified` | `language.md` 7.3, `compiled-program.md` 7 | `bar/warmup-is-absence` |
| History past the start | `x[n]` with `n > bar.index` is absent: not clamped, not zero, not an error | `specified` | `language.md` 7.4 | `bar/history-before-start` |
| Fractional history index | OS4001, with the fix naming `floor` or `round` | `specified` | `language.md` 7.4, `errors.md` OS4001 | `bar/history-fractional` |
| Negative history index | OS3004 for a literal, OS4001 at runtime; reading the future is not available | `specified` | `language.md` 7.4, `errors.md` OS3004, `errors.md` OS4001 | `bar/history-negative` |
| History past retained depth | OS4002 naming the depth and the `limits(history = ...)` line, distinct from a value that never existed | `specified` | `language.md` 7.4, `errors.md` OS4002 | `bar/history-past-depth` |
| Default retained depth | The full history of the supplied dataset, so OS4002 appears only when a host set a depth | `specified` | `language.md` 7.4 | `bar/history-default-depth` |
| Rollback on the moving bar | Persistent values are restored to the end of the previous bar before each re-execution | `specified` | `language.md` 7.5, `compiled-program.md` 6.3 | `bar/rollback` |
| Rollback covers array contents | Not only the reference, so an intrabar push does not accumulate duplicates | `specified` | `language.md` 7.5, `language.md` 14.1, `compiled-program.md` 6.1 | `bar/rollback-array` |
| Deferred effects | Signals, alerts and orders wait for bar confirmation and never happen if the condition goes away | `specified` | `language.md` 7.5, `compiled-program.md` 5.4 | `bar/deferred-effects` |
| `onUnconfirmed` opt-in | A declaration option, with OS8002 on any higher timeframe read that develops in that file | `specified` | `language.md` 7.5, `language.md` 13.2, `errors.md` OS8002 | `bar/on-unconfirmed` |
| Determinism of arithmetic | Binary64, round-to-nearest-even, source order; no reassociation, no fused multiply-add, no extended precision | `specified` | `language.md` 7.6, `compiled-program.md` 8.1 | `bar/determinism-arithmetic` |
| Determinism of iteration | Array iteration is index order; no unordered collection exists in version 1 | `specified` | `language.md` 7.6, `compiled-program.md` 8.2 | `bar/determinism-iteration` |
| No hidden clock or randomness | The only clock is `chart.now()`, whose value the host supplies and a case fixes | `specified` | `language.md` 7.6, `compiled-program.md` 8.4 | `bar/no-clock-no-random` |
| Nothing outside the program | An engine reads no file, no network and no environment during a bar | `specified` | `compiled-program.md` 8.4 | `bar/no-outside-input` |

## 7. Series history and persistence

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| Bare series read | Reading a series gives the value on the bar being executed | `specified` | `language.md` 5.2 | `persist/series-read` |
| History operator | `x[n]` gives the value `n` bars back; `x[0]` is `x` | `specified` | `language.md` 5.2, `language.md` 9.6 | `persist/history-read` |
| History eligibility | Only built-in series, top-level names, series-returning calls and series parameters accept `[]`; anything else is OS2004 | `specified` | `language.md` 5.2, `errors.md` OS2004 | `persist/history-eligibility` |
| Call-site series retention | Passing an expression to a series parameter retains that expression's per-bar values for that call site | `specified` | `language.md` 5.2, `compiled-program.md` 2.10 | `persist/call-site-retention` |
| Plain assignment | Recomputed fresh every bar; the previous value is readable only through `[]` | `specified` | `language.md` 8.1 | `persist/plain-assignment` |
| `var` | Initialised once, then carried from bar to bar | `specified` | `language.md` 8.2, `compiled-program.md` 4.3 | `persist/var` |
| `var` first reached late | The initialiser runs on the first bar control reaches it, and the value is absent before that | `specified` | `language.md` 8.2 | `persist/var-late-init` |
| `var` in a function | Allowed, and scoped to the function body while persisting across bars | `specified` | `language.md` 8.2, `language.md` 11.4 | `persist/var-in-function` |
| `var` with no initialiser | OS1011, with the fix naming `var name = none` | `specified` | `language.md` 8.2, `errors.md` OS1011 | `unit:persist/var-no-initialiser` |
| `live var` | Identical to `var` but exempt from rollback, spelled longer because it makes live and backtest numbers differ, and warned with OS8011 | `specified` | `language.md` 8.2, `errors.md` OS8011 | `persist/live-var` |
| History versus persistence | Two unrelated ideas that share a syntax; `x[1]` on a `var` reads the persistent value one bar ago | `specified` | `language.md` 8.3 | `persist/history-vs-persistence` |
| `history(expr, n)` | The explicit form, always history, for lines where `[]` would read ambiguously | `specified` | `language.md` 9.6, `stdlib.md` 9 | `persist/history-explicit` |
| `element(arr, i)` | The explicit form, always element access | `specified` | `language.md` 9.6, `language.md` 14.1 | `array/element-explicit` |
| A persistent value holding a bar index | OS8014, because a bar index is not stable when history is paged in | `deferred` | `errors.md` OS8014 | `unit:persist/bar-index-warning` |

## 8. Expressions and operators

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| Precedence | The nine-level table, left associative except unary and the ternary | `specified` | `language.md` 9.1 | `expr/precedence` |
| Arithmetic operators | `+ - * /` on numbers, with absence and finiteness rules | `specified` | `language.md` 9.2 | `expr/arithmetic` |
| Remainder | `%` is truncated division's remainder, so its sign follows the left operand | `specified` | `language.md` 9.2, `compiled-program.md` 4.5 | `expr/remainder` |
| `mod(a, b)` | `a - b * floor(a / b)`, the floored remainder, whose sign follows `b`; `mod(a, 0)` is `none` | `specified` | `language.md` 9.2, `stdlib.md` 8.1 | `math/mod` |
| `MOD` is the operator, not the function | The `MOD` instruction is `%`, truncated and signed like `a`; the library's `mod` compiles to a library call | `specified` | `compiled-program.md` 4.5, `stdlib.md` 8.1 | `prog/mod-is-operator` |
| String concatenation | `+` joins two strings and does nothing else; `"a" + 5` is OS2003 | `specified` | `language.md` 9.2, `errors.md` OS2003 | `expr/concat` |
| Numeric ordering | `< <= > >=` on numbers | `specified` | `language.md` 9.3 | `expr/ordering-number` |
| String ordering | By Unicode code point, stable across locales, and not offered as an alphabetical sort | `specified` | `language.md` 9.3 | `expr/ordering-string` |
| Equality | Same type, or any value against `none`; mixed types are OS2003 | `specified` | `language.md` 9.3, `errors.md` OS2003 | `expr/equality` |
| Colour equality | Equal when all four channels match | `specified` | `language.md` 9.3 | `color/equality` |
| Reference identity | Two references are equal when they are the same array or the same object | `specified` | `language.md` 9.3, `language.md` 5.4 | `array/identity-equality` |
| `arrayEqual` | Compares contents rather than identity | `specified` | `language.md` 9.3, `language.md` 14.1 | `array/array-equal` |
| No chained comparison | `a < b < c` is OS1008, because the two plausible readings disagree | `specified` | `language.md` 9.3, `errors.md` OS1008 | `unit:expr/chained-comparison` |
| Ternary | `cond ? a : b`, right associative, only the taken arm evaluated, arms same type or one absent, else OS2012 | `specified` | `language.md` 9.5, `errors.md` OS2012 | `expr/ternary` |
| Ternary with one arm | OS1015, naming the missing `:` | `specified` | `language.md` 9.5, `errors.md` OS1015 | `unit:expr/ternary-one-arm` |
| Subscript disambiguation | `[]` is history on a series and element access on an array, decided at compile time | `specified` | `language.md` 9.6 | `expr/subscript-dispatch` |
| Assignment is a statement | `if x = 5` is OS1006 with the fix "write `==`" | `specified` | `language.md` 10.1, `errors.md` OS1006 | `unit:expr/assignment-not-expression` |
| Compound assignment | `+= -= *= /= %=`, expanding to the obvious form and obeying absence propagation | `specified` | `language.md` 10.1 | `expr/compound-assignment` |
| An assignment target is a name | An indexed target is OS1024, whose fix names `set(arr, i, v)`, because `[]` reads an array element or a computed past bar and neither is written through an assignment | `specified` | `language.md` 14.1, `language.md` 19, `errors.md` OS1024 | `unit:expr/assign-to-index` |
| No member assignment | A dotted target is OS1025: every member a script can reach is a fact or a function the library or the host supplies, and version 1 has no user-declared type that could add a writable one | `specified` | `language.md` 15.2, `language.md` 19, `errors.md` OS1025 | `unit:expr/assign-to-member` |

## 9. Control flow

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| `if` / `else if` / `else` | The three forms, with `else if` on one line and no extra indentation | `specified` | `language.md` 10.2 | `flow/if-else` |
| `else` with no `if` | OS1016, naming the indentation that separated them | `specified` | `language.md` 10.2, `errors.md` OS1016 | `unit:flow/else-without-if` |
| Condition typing | A condition must be `bool` or absent; anything else is OS2011, with no truthiness rule | `specified` | `language.md` 10.2, `errors.md` OS2011 | `flow/condition-type` |
| `for x = a to b` | Inclusive at both ends | `specified` | `language.md` 10.3 | `flow/for-to` |
| `step` | Defaults to 1; a descending loop must say `step -1` | `specified` | `language.md` 10.3 | `flow/for-step` |
| Non-reversing loop | The body does not run when the step is positive and the end is below the start, nor when the step is negative and the end is above it; the range is reversed in neither direction | `specified` | `language.md` 10.3, `compiled-program.md` 4.8 | `flow/for-no-reverse` |
| Zero step | OS3004, removing the only accidental infinite `for` | `specified` | `language.md` 10.3, `errors.md` OS3004 | `unit:flow/for-zero-step` |
| Incomplete `for` header | OS1020, naming the part that is missing | `specified` | `language.md` 10.3, `errors.md` OS1020 | `unit:flow/for-header` |
| `for x in arr` | Visits indices 0 to size-1 as measured on entry | `specified` | `language.md` 10.3 | `flow/for-in` |
| Mutation during `for in` | Appended elements are not visited; a shrink past the cursor ends the loop | `specified` | `language.md` 10.3 | `flow/for-in-mutation` |
| Loop variable is read-only | Assigning to it is OS2006; leave early with `break` | `specified` | `language.md` 10.3, `errors.md` OS2006 | `unit:flow/loop-var-readonly` |
| Absent loop bound | A bound that is absent at run time is OS4013 rather than a loop that silently does not run | `specified` | `language.md` 10.3, `errors.md` OS4013 | `flow/loop-bound-absent` |
| `while` | Condition re-evaluated before each iteration, same typing rule as `if` | `specified` | `language.md` 10.4 | `flow/while` |
| `break` and `continue` | Leave or skip the innermost loop; outside a loop either is OS1009 | `specified` | `language.md` 10.5, `errors.md` OS1009 | `flow/break-continue` |
| `switch` value form | Compares a subject against each case | `specified` | `language.md` 10.6 | `flow/switch-value` |
| `switch` condition form | No subject; takes the first true arm | `specified` | `language.md` 10.6 | `flow/switch-condition` |
| Multiple values per case | Comma separated, all of the subject's type | `specified` | `language.md` 10.6 | `flow/switch-multi-value` |
| No fall-through | Each arm's block ends at the next `case` or `default` | `specified` | `language.md` 10.6 | `flow/switch-no-fallthrough` |
| `default` | Optional, last; with no match and no default, nothing happens | `specified` | `language.md` 10.6 | `flow/switch-default` |
| `case` or `default` out of place | OS1017 | `specified` | `language.md` 10.6, `errors.md` OS1017 | `unit:flow/case-out-of-place` |
| Names set by arms | Must be declared before the `switch`, which makes the "declared in one arm only" bug impossible | `specified` | `language.md` 10.6, `language.md` 12.2 | `flow/switch-name-scope` |
| Per-bar loop budget | Iterations summed over all loops in one bar, default 2,000,000, exceeding it is OS5001 | `specified` | `language.md` 10.7, `compiled-program.md` 5.5, `errors.md` OS5001 | `flow/loop-budget` |
| Budget failure stops the bar | It does not break out of the loop, because a truncated loop produces a plausible wrong number | `specified` | `language.md` 10.7, `compiled-program.md` 8.5 | `flow/loop-budget-stops-bar` |
| `limits(loops = ...)` | Raises the budget deliberately, in one place | `specified` | `language.md` 10.7, `compiled-program.md` 2.4 | `flow/limits-loops` |
| `limits(history = ...)` | Sets the retained series depth | `specified` | `language.md` 10.7, `language.md` 7.4 | `flow/limits-history` |
| `limits()` placement | At most once, immediately after the declaration, literal arguments only: OS3014 and OS3015 | `specified` | `language.md` 10.7, `errors.md` OS3014, `errors.md` OS3015 | `unit:flow/limits-placement` |
| Host refusal of a limit | A host unwilling to run a requested limit says so with OS5003 rather than capping quietly | `specified` | `language.md` 10.7, `errors.md` OS5003 | `flow/limits-refused` |
| Warnings about dead control flow | OS8015 on a loop that never runs, OS8016 on unreachable code, OS8017 on a constant condition | `specified` | `errors.md` OS8015, `errors.md` OS8016, `errors.md` OS8017 | `unit:flow/dead-code-warnings` |

## 10. User functions

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| Single-line `fn` | `fn name(params) => expression` | `specified` | `language.md` 11.1 | `fn/single-line` |
| Multi-line `fn` | A block whose final expression is the value | `specified` | `language.md` 11.1 | `fn/multi-line` |
| Top level only | Functions may not be nested; one declared inside a block is OS1023, naming the move, rather than a declaration the parser discards without a word | `specified` | `language.md` 11.1, `errors.md` OS1023 | `unit:fn/no-nesting` |
| A function is not a value | Naming one without calling it is OS2014, and there are no function values in version 1 | `specified` | `language.md` 11.1, `errors.md` OS2014 | `unit:fn/not-a-value` |
| A name that is not a function | Calling a name that holds a value is OS2010 | `specified` | `language.md` 11.1, `errors.md` OS2010 | `unit:fn/not-callable` |
| Two functions of one name | OS2017, naming the earlier declaration | `specified` | `language.md` 11.1, `errors.md` OS2017 | `unit:fn/duplicate-name` |
| Parameter annotations | Optional, checked when present, inferred otherwise | `specified` | `language.md` 11.2 | `fn/parameter-annotation` |
| Parameter defaults | A default expression per parameter | `specified` | `language.md` 11.2 | `fn/parameter-default` |
| Duplicate parameter name | OS2018 | `specified` | `language.md` 11.2, `errors.md` OS2018 | `unit:fn/duplicate-parameter` |
| Positional arguments | In declared order | `specified` | `language.md` 11.2 | `fn/positional-arguments` |
| Named arguments | By parameter name, not repeating a positional one | `specified` | `language.md` 11.2 | `fn/named-arguments` |
| An argument label is not a name | A label is matched against the callee's parameter list and never looked up in a scope, so a reserved word or a type name is legal there and OS1019 does not fire | `specified` | `language.md` 11.2, `language.md` 3.4 | `fn/label-not-a-name` |
| A parameter is an identifier | `fn f(color = red)` is OS1019, because a parameter is a name in a scope and `color` is a type name | `specified` | `language.md` 11.2, `errors.md` OS1019 | `unit:fn/parameter-reserved-word` |
| Positional after named | OS3005 | `specified` | `language.md` 11.2, `errors.md` OS3005 | `unit:fn/positional-after-named` |
| Argument given twice | OS3013 | `specified` | `language.md` 11.2, `errors.md` OS3013 | `unit:fn/argument-twice` |
| Wrong argument count | OS3001 | `specified` | `language.md` 11.2, `errors.md` OS3001 | `unit:fn/argument-count` |
| Unknown named argument | OS3002, whose message lists the names that exist | `specified` | `language.md` 11.2, `errors.md` OS3002 | `unit:fn/unknown-named-argument` |
| Missing required argument | OS3012 | `specified` | `language.md` 11.2, `errors.md` OS3012 | `unit:fn/missing-argument` |
| Missing comma between arguments | OS1014 | `specified` | `language.md` 11.2, `errors.md` OS1014 | `unit:fn/missing-comma` |
| `return expression` | Exits immediately with that value | `specified` | `language.md` 11.3 | `fn/return` |
| Bare `return` | Exits with absence | `specified` | `language.md` 11.3 | `fn/return-bare` |
| Implicit return | A trailing bare expression is the return value | `specified` | `language.md` 11.3 | `fn/implicit-return` |
| A call that returns no value | The grammar has a `nothing` rule for a call whose result cannot be used, such as `signal` or a `draw` setter | `specified` | `language.md` 19, `stdlib.md` 14.3 | `fn/nothing-returned` |
| State per call site | Two calls in two places are two independent pieces of state | `specified` | `language.md` 11.4, `compiled-program.md` 2.12 | `fn/state-per-call-site` |
| One slot per loop call site | A call inside a loop shares one slot across iterations, which is what an accumulation wants | `specified` | `language.md` 11.4 | `fn/state-in-loop` |
| No recursion | Direct or cyclic self-call is OS2005 naming the cycle, because slots are allocated statically | `specified` | `language.md` 11.4, `errors.md` OS2005 | `unit:fn/recursion-rejected` |
| Unexecuted call site | Its series is absent for that bar and its state does not advance | `specified` | `language.md` 11.4 | `fn/unexecuted-call-site` |
| OS8001 warning | Warns on a stateful call inside a conditional branch and names the fix | `specified` | `language.md` 11.4, `errors.md` OS8001 | `unit:fn/os8001-warning` |
| Forward reference | A function may be called before its declaration appears | `specified` | `language.md` 12.5 | `fn/forward-reference` |

## 11. Scope

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| Three scopes | Global (library), file (top-level names and functions), block (every block and function body) | `specified` | `language.md` 12.1 | `scope/three-scopes` |
| First assignment declares | A name is declared by its first assignment in a scope | `specified` | `language.md` 12.2 | `scope/first-assignment-declares` |
| Assignment updates an outer name | An assignment to a name from an enclosing scope updates it and creates nothing | `specified` | `language.md` 12.2 | `scope/outer-update` |
| Block-local names | A name first assigned in a block is invisible outside it, which is OS2001 when read | `specified` | `language.md` 12.2, `errors.md` OS2001 | `scope/block-local` |
| No shadowing | Declaring an inner name that exists outside is OS2002, naming the outer line | `specified` | `language.md` 12.3, `errors.md` OS2002 | `unit:scope/no-shadowing` |
| Parameter shadowing | A parameter named after a file-scope name or a library function is OS2002 | `specified` | `language.md` 12.3, `errors.md` OS2002 | `unit:scope/parameter-shadowing` |
| Assigning to a built-in | `close = 5` is OS2002, with a suggested name; every library name is a global | `specified` | `language.md` 12.4, `stdlib.md` 2.1, `errors.md` OS2002 | `unit:scope/builtin-assignment` |
| Use before assignment | Reading a file-scope name above its assignment is OS2001, not absence | `specified` | `language.md` 12.5, `errors.md` OS2001 | `unit:scope/use-before-assignment` |
| Unknown member of a namespace | OS2009, listing the members that exist | `specified` | `language.md` 15.2, `errors.md` OS2009 | `unit:scope/unknown-member` |
| A name never read | OS8010, so a misspelled name is a warning rather than a silent nothing | `specified` | `errors.md` OS8010 | `unit:scope/name-never-read` |
| Lifetime versus visibility | `var` sets how long a value lives; the block sets where the name is seen | `specified` | `language.md` 8.2, `language.md` 12.1 | `scope/lifetime-vs-visibility` |

## 12. Declarations: study and strategy

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| `study()` | Declares a study; first statement after any `version` line and leading comments | `specified` | `language.md` 13.1 | `decl/study` |
| `strategy()` | Every study option plus the trading options, so one file plots and trades | `specified` | `language.md` 13.1, `language.md` 13.3 | `decl/strategy` |
| Exactly one declaration | Missing is OS2007, two is OS2008 | `specified` | `language.md` 13.1, `errors.md` OS2007, `errors.md` OS2008 | `unit:decl/one-declaration` |
| Compile-time constant options | Literals, arithmetic over literals or an `input()` call; anything bar-dependent is OS3003 | `specified` | `language.md` 13.2, `errors.md` OS3003 | `unit:decl/constant-options` |
| `title` | The legend and picker name, first positional argument | `specified` | `language.md` 13.2, `compiled-program.md` 2.3 | `decl/option-title` |
| `short` | A shorter legend name, defaulting to the title | `specified` | `language.md` 13.2, `compiled-program.md` 2.3 | `decl/option-short` |
| `overlay` | Price pane when true, own pane when false | `specified` | `language.md` 13.2, `compiled-program.md` 2.3 | `decl/option-overlay` |
| `precision` | Decimals on this study's axis and legend, 0 to 10 | `specified` | `language.md` 13.2, `compiled-program.md` 2.3 | `decl/option-precision` |
| `format` | `"price"`, `"percent"` or `"volume"` axis and crosshair formatting | `specified` | `language.md` 13.2, `compiled-program.md` 2.3 | `decl/option-format` |
| `range` | `[min, max]` fixing the study pane's scale; a malformed pair is OS3016 | `specified` | `language.md` 13.2, `errors.md` OS3016 | `decl/option-range` |
| `scale` | `"right"`, `"left"` or `"none"` | `specified` | `language.md` 13.2 | `decl/option-scale` |
| `group` | Category in a picker | `specified` | `language.md` 13.2 | `decl/option-group` |
| `onUnconfirmed` | Allows signals, alerts and orders on a moving bar | `specified` | `language.md` 13.2, `language.md` 7.5 | `decl/option-on-unconfirmed` |
| An option that requires another | OS3009, naming the option that has to be set with it | `specified` | `language.md` 13.2, `errors.md` OS3009 | `unit:decl/option-needs-option` |
| An option value that is not an accepted name | OS3008 at compile time, OS4012 at run time | `deferred` | `language.md` 13.2, `errors.md` OS3008, `errors.md` OS4012 | `unit:decl/option-unknown-value` |
| Two outputs sharing a title | OS3017, because a legend with two identical rows cannot be read | `specified` | `errors.md` OS3017 | `unit:decl/duplicate-title` |
| `capital` | Starting equity for the backtest | `specified` | `language.md` 13.3 | `decl/option-capital` |
| `currency` | Display label for money in the report | `specified` | `language.md` 13.3, `stdlib.md` 3.4 | `decl/option-currency` |
| `qty` | Default order size when an order names none | `specified` | `language.md` 13.3 | `decl/option-qty` |
| `qtyType` | `"units"`, `"lots"`, `"cash"` or `"equityPercent"` | `specified` | `language.md` 13.3 | `decl/option-qty-type` |
| `product` | `"intraday"` or `"overnight"` | `specified` | `language.md` 13.3 | `decl/option-product` |
| `fillOn` | `"nextOpen"` (the default, because a close cannot fill at that same close) or `"close"` | `specified` | `language.md` 13.3, `stdlib.md` 17.1 | `decl/option-fill-on` |
| `slippage` | Ticks of adverse slippage on every fill | `specified` | `language.md` 13.3 | `decl/option-slippage` |
| `commission` | Cost per the commission unit | `specified` | `language.md` 13.3 | `decl/option-commission` |
| `commissionType` | `"perTrade"`, `"perUnit"` or `"percent"` | `specified` | `language.md` 13.3 | `decl/option-commission-type` |
| `pyramiding` | Maximum entries in one direction before entries are refused | `specified` | `language.md` 13.3 | `decl/option-pyramiding` |
| `closeOnSessionEnd` | Flatten at the session close | `specified` | `language.md` 13.3 | `decl/option-close-on-session-end` |

## 13. Inputs

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| `input(default, title)` | Declares a tunable value and one row of the settings dialog | `specified` | `language.md` 13.4, `stdlib.md` 13.1 | `input/basic` |
| Type from the default | The input's type follows the default's type, which is why the default comes first | `specified` | `language.md` 13.4, `stdlib.md` 13.2 | `input/type-from-default` |
| Number input | With `min`, `max` and `step` bounds | `specified` | `stdlib.md` 13.1, `stdlib.md` 13.3 | `input/number` |
| Bool input | A checkbox row | `specified` | `stdlib.md` 13.1 | `input/bool` |
| String input | A text row | `specified` | `stdlib.md` 13.1 | `input/string` |
| Select input | `options = [...]` makes the row a fixed choice, and a default outside the list is OS3018 | `specified` | `stdlib.md` 13.3, `errors.md` OS3018 | `input/options` |
| Colour input | A colour row | `specified` | `stdlib.md` 13.1 | `input/color` |
| Source input | A built-in series chosen from the price fields | `specified` | `stdlib.md` 13.1, `compiled-program.md` 2.6 | `input/source` |
| `kind = "interval"` | A timeframe row, validated against the timeframe strings | `specified` | `stdlib.md` 13.1, `stdlib.md` 15.2 | `input/interval` |
| `kind = "time"` | Stored as a wall clock string in the chart's zone, returned as a timestamp, converted once before bar 0 | `specified` | `stdlib.md` 13.1, `stdlib.md` 13.3 | `input/time` |
| `group` and `tooltip` | A heading the dialog groups rows under, and help text beside the label | `specified` | `stdlib.md` 13.2 | `input/group-tooltip` |
| Style rows the host generates | A colour, opacity, thickness, line style and plot style row per `plot`, which a declared `color` input takes over rather than duplicating | `specified` | `stdlib.md` 13.4 | `input/host-style-rows` |
| Top level only | An `input()` inside a block or a function is OS3007 | `specified` | `language.md` 13.4, `stdlib.md` 14.1, `errors.md` OS3007 | `unit:input/top-level-only` |
| Where an input may be written | Anywhere at the top level a value belongs, including a declaration option, a larger expression and the expression argument of a read; a block and a function body are the two exceptions | `specified` | `language.md` 13.4, `stdlib.md` 15.4 | `input/where-written` |
| The settings key | The name the input was assigned to, or its title where it was assigned to none, and never its position, so an insert, a delete or a reorder leaves a stored value on its own row | `specified` | `host-interface.md` 8.1, `compiled-program.md` 2.6 | `input/settings-key` |
| A value the host stored for an input | Reaches the run keyed by the input's own name, so the same program over the same bars decides differently under it | `implemented` | `host-interface.md` 8.1, `conformance.md` 2 | `input/host-values` |
| A row nothing can name | An input assigned to no name and given no title written as a string literal is OS3021, because the title is the row's key and its label both | `specified` | `language.md` 13.4, `errors.md` OS3021 | `unit:input/no-name-no-title` |
| A row whose title says nothing | An input assigned to no name whose title is an empty string literal is OS3024 rather than OS3021, because the reader did write a title and a fix telling them to write one is a fix they have already applied; assigned to a name, an empty title is read as no title and the row is labelled by the name | `specified` | `language.md` 13.4, `errors.md` OS3024 | `unit:input/empty-title` |
| Two rows on one key | A title spelling another input's name is OS3022, and two inputs carrying one title are OS3017, because a host stores one value per key | `specified` | `host-interface.md` 8.1, `errors.md` OS3022, `errors.md` OS3017 | `unit:input/key-taken` |
| `var` in front of an input | An ordinary `var` initialised from the setting on the first bar, which is how a running total starts from one; the row is keyed by the name either way, and the name is not a compile-time constant | `specified` | `language.md` 13.4, `language.md` 8.2 | `input/var-from-input` |
| Non-constant default | OS3003, because the dialog is built before bar 0 | `specified` | `stdlib.md` 13.2, `errors.md` OS3003 | `unit:input/non-constant-default` |
| An input as an option value | A fixed-shape option may be written with an input(), and the compiled program carries the reference until the engine resolves inputs at load | `specified` | `language.md` 13.2, `compiled-program.md` 2.3, `errors.md` OS3003 | `input/option-from-input` |
| A reference the field refuses | Check 10 at load: a key no input declares is OS6018, and a resolved value the field will not take is OS6019, because that value came from the host's settings rather than from the program | `specified` | `compiled-program.md` 3.5, `errors.md` OS6018, `errors.md` OS6019 | `input/option-reference-checked` |
| An expression over an input as an option value | Has no form as the documents stand: a field fixed before bar 0 carries a literal or a reference to one input, and a value computed from an input is neither. What refuses it, and whether the language should carry it at all, is open in `issues/0003` | `planned` | `none` | `unit:input/option-expression-rejected` |
| Out-of-range value | A supplied value outside `min` and `max` is refused before the first bar: OS3004 for a literal, OS6019 for a host setting | `specified` | `stdlib.md` 13.3, `errors.md` OS3004, `errors.md` OS6019 | `input/out-of-range` |
| An input never used | OS8018, so a dialog row that does nothing is visible to its author | `specified` | `errors.md` OS8018 | `unit:input/never-used` |
| `inline` and `confirm` | Rows sharing a line, and a value asked for when the study is added | `planned` | `stdlib.md` 13.2 | `input/dialog-layout` |
| Planned input kinds | `"symbol"`, `"price"` and `"session"` are named so the surface is legible and are not defined | `planned` | `stdlib.md` 13.1 | `input/planned-kinds` |
| Settings round trip | Saved settings reload to the same values and produce the same output, for every kind rather than only `"time"` | `planned` | `none` | `input/settings-round-trip` |

## 14. Collections

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| Array literal | `[1, 2, 3]`, homogeneous; a literal mixing types is OS2013 | `specified` | `language.md` 14.1, `errors.md` OS2013 | `array/literal` |
| Empty literal element type | From an annotation when there is one, otherwise from the first `push`, `unshift`, `insert` or `set` in source order; with neither it is OS2015 | `specified` | `language.md` 14.1, `language.md` 19, `errors.md` OS2015 | `array/empty-literal` |
| Element types | `number`, `string`, `bool`, `color` or a runtime object type; never a declaration handle and never a `series` | `specified` | `language.md` 14.1, `language.md` 5.4 | `array/element-types` |
| A type that cannot be an array element | OS2019, the refinement of OS2016 for a declaration handle, a series or an array of arrays | `specified` | `language.md` 14.1, `language.md` 5.4, `errors.md` OS2019 | `unit:array/element-type-rejected` |
| Reference semantics | Assignment shares the array; `copy` makes an independent one, so passing is never quietly expensive | `specified` | `language.md` 14.1 | `array/reference-semantics` |
| `size(arr)` | Element count | `specified` | `language.md` 14.1 | `array/size` |
| Element read and write | `arr[i]`, `element(arr, i)`, `set(arr, i, v)` | `specified` | `language.md` 14.1 | `array/element-access` |
| `push` and `pop` | Append, and remove and return the last | `specified` | `language.md` 14.1 | `array/push-pop` |
| `shift` and `unshift` | Remove and return the first, and insert at the front | `specified` | `language.md` 14.1 | `array/shift-unshift` |
| `insert` and `remove` | Insert before an index, and remove and return an index | `specified` | `language.md` 14.1 | `array/insert-remove` |
| `clear(arr)` | Remove everything | `specified` | `language.md` 14.1 | `array/clear` |
| `slice(arr, from, to)` | A new array, `from` inclusive, `to` exclusive; an invalid range is OS4007 | `deferred` | `language.md` 14.1, `errors.md` OS4007 | `array/slice` |
| `copy(arr)` | An independent copy | `specified` | `language.md` 14.1 | `array/copy` |
| `indexOf(arr, v)` | First index, or -1 | `specified` | `language.md` 14.1 | `array/index-of` |
| `sort(arr, order)` | In place, ascending or descending, and stable so two engines agree on ties | `specified` | `language.md` 14.1 | `array/sort` |
| `reverse(arr)` | In place | `specified` | `language.md` 14.1 | `array/reverse` |
| Array statistics | `sum`, `avg`, `min`, `max`, `stdev` over the whole array | `specified` | `language.md` 14.1 | `array/statistics` |
| An operation on an empty array | OS4006, rather than an invented value | `deferred` | `language.md` 14.1, `errors.md` OS4006 | `array/empty-operation` |
| Out-of-range index | OS4004 naming the index and the size, because an array has an extent the script chose | `specified` | `language.md` 14.1, `errors.md` OS4004 | `array/out-of-range` |
| Element limit | 1,000,000 by default; exceeding it is OS5002 and `limits()` does not raise it in version 1 | `specified` | `language.md` 14.1, `errors.md` OS5002 | `array/element-limit` |
| Persistent array | An array in a `var` persists, and rollback restores its contents | `specified` | `language.md` 14.1, `language.md` 7.5 | `array/persistent` |
| Arrays in the object heap | An array is a reference into the same heap that holds tables and drawing objects | `specified` | `compiled-program.md` 3.2, `compiled-program.md` 4.9 | `array/heap` |
| `map<K, V>` | Reserved word, not implemented; insertion-order iteration when it arrives, for determinism | `specified` | `language.md` 14.2 | `unit:array/map-reserved` |
| `matrix<T>` | Reserved word, not implemented; two-dimensional numeric container when it arrives | `specified` | `language.md` 14.2 | `unit:array/matrix-reserved` |

## 15. Standard library rules

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| The shape of an entry | Call, Returns, Warmup, For, and a Lands in column for anything the host draws | `specified` | `stdlib.md` 1, `stdlib.md` 2.7 | `lib/entry-shape` |
| Warmup is a promise | A warmup of bar `n - 1` means `none` on bars 0 to `n - 2` and a value from `n - 1` on, on exactly those bars and no others | `specified` | `stdlib.md` 1, `language.md` 7.3 | `lib/warmup-promise` |
| Warmups compose | A call whose source is absent is absent, so nested calls add their warmups | `specified` | `stdlib.md` 1, `language.md` 6.7 | `lib/warmup-composes` |
| Bare names and namespaces | Everyday functions are bare and the long tail is namespaced, settled per function rather than by a rule | `specified` | `language.md` 15.2, `stdlib.md` 2.1 | `lib/bare-and-namespaced` |
| The namespace list | The closed list of namespaces the library has, and which of them exist only in a `strategy()` file | `specified` | `language.md` 15.2 | `lib/namespaces` |
| Overloads | One bare name may carry several signatures differing in arity or argument type, resolved at compile time with no run-time dispatch | `specified` | `stdlib.md` 2.2, `errors.md` OS3001 | `lib/overloads` |
| Multi-output calls | A function with more than one output returns an `array<number>` holding this bar's outputs in the documented order | `specified` | `stdlib.md` 2.3 | `lib/multi-output` |
| A multi-output array is never absent | It never changes length either, so an early bar gives an absent element rather than an out-of-range error | `specified` | `stdlib.md` 2.3 | `lib/multi-output-length` |
| History of a multi-output call | `m[0]` is element 0 of this bar's array and `history(m, 1)` is the whole array one bar ago | `specified` | `stdlib.md` 2.3, `language.md` 9.6 | `lib/multi-output-history` |
| Length arguments | A whole number of 1 or more: fractional or zero is OS3004 as a literal and OS4003 at run time | `specified` | `stdlib.md` 2.5, `errors.md` OS3004, `errors.md` OS4003 | `lib/length-argument` |
| A series length | Read per bar, with warmup measured against the largest value the length has taken since the start of the dataset | `specified` | `stdlib.md` 2.5 | `lib/series-length` |
| Exact arithmetic recipes | Every function is an exact recipe over binary64 in source order, with seeds stated and no "usual definition" anywhere | `specified` | `stdlib.md` 2.6, `compiled-program.md` 8.3 | `lib/exact-recipe` |
| Where a call lands | Sections 13 to 17 name the contract field per call and section 18 collects the map | `specified` | `stdlib.md` 2.7, `stdlib.md` 18, `compiled-program.md` 11 | `lib/lands-in` |
| Calling a planned entry | OS2001 with a message saying the name is planned, rather than a message saying it does not exist | `specified` | `stdlib.md` 1, `errors.md` OS2001 | `lib/planned-entry` |
| The library manifest | The program names the functions it calls and the manifest it was compiled against; a mismatch is OS6004 | `specified` | `compiled-program.md` 2.5, `errors.md` OS6004 | `prog/lib-manifest` |
| A leg declared inside a block | OS3006, because the set of contracts a strategy trades is part of its fixed shape | `specified` | `language.md` 15.3, `stdlib.md` 17.6, `errors.md` OS3006 | `unit:order/leg-in-block` |

## 16. Bar data and instrument facts

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| Built-in series | `open`, `high`, `low`, `close`, `volume` and `time`, bare in every script with history through `[]` | `specified` | `language.md` 15.1, `stdlib.md` 3.1 | `bar/built-in-series` |
| Derived price series | `hl2`, `hlc3`, `ohlc4`, `hlcc4`, each with its formula written down | `specified` | `language.md` 15.1, `stdlib.md` 3.1 | `bar/derived-series` |
| Volume absent, never zero | An instrument the host has no volume for gives absence, because zero is a real reading that means nobody traded | `specified` | `stdlib.md` 3.1 | `bar/volume-absent` |
| Open interest | `oi`, bare like `volume`, absent where the host supplies none, tested with `chart.hasOpenInterest` | `specified` | `stdlib.md` 3.1 | `bar/open-interest` |
| Open interest is a level | A coarser bar takes the last reading and never the sum, unlike volume, because it is a position as at the bar rather than a quantity traded during it | `specified` | `stdlib.md` 3.1 | `bar/open-interest-folds-last` |
| `close` has two roles | `close` bare is the price and `close(...)` is the order function, told apart by syntax; in a study file the call is OS7001 | `specified` | `stdlib.md` 3.2, `errors.md` OS7001 | `bar/close-two-roles` |
| `chart.symbol`, `chart.exchange` | The instrument being charted | `specified` | `stdlib.md` 3.4 | `chart/instrument-identity` |
| `chart.interval` and friends | The canonical interval string, `chart.intervalMinutes` and `chart.isIntraday` | `specified` | `stdlib.md` 3.4, `stdlib.md` 15.2 | `chart/interval` |
| `chart.timezone` | The chart's IANA zone, which every calendar conversion uses | `specified` | `stdlib.md` 3.4, `stdlib.md` 12.1 | `chart/timezone` |
| `chart.tickSize`, `chart.lotSize`, `chart.pointValue` | Instrument facts a strategy needs for rounding and sizing, absent rather than guessed when the host has not said; reading one the host cannot supply is OS6012 | `specified` | `stdlib.md` 3.4, `errors.md` OS6012 | `chart/tick-and-lot` |
| `chart.currency`, `chart.instrumentType`, `chart.hasVolume` | The remaining constant facts a script reads from the instrument record | `specified` | `stdlib.md` 3.4, `host-interface.md` 4.1 | `chart/instrument-facts` |
| `chart.now()` | The only wall clock, supplied by the host and fixed by a conformance case | `specified` | `language.md` 7.6, `stdlib.md` 3.4 | `chart/now` |
| `timeClose` | The instant a bar's interval ends | `planned` | `stdlib.md` 3.1 | `bar/time-close` |
| Planned chart facts | `chart.isReplay`, `chart.expiry`, `chart.strike` and `chart.optionType` are named and not defined | `planned` | `stdlib.md` 3.4 | `chart/planned-facts` |

## 17. Mathematics and rounding

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| `abs`, `sign` | Magnitude, and -1, 0 or 1 | `specified` | `stdlib.md` 8.1 | `math/abs-sign` |
| `min`, `max`, `clamp` | The two-argument forms, bare, and a value held inside a range | `specified` | `stdlib.md` 8.1 | `math/min-max-clamp` |
| `floor`, `ceil`, `trunc` | Toward negative infinity, toward positive infinity, toward zero | `specified` | `stdlib.md` 8.1 | `math/truncation` |
| `round(x)` | To the nearest whole number, halves away from zero, stated so two engines cannot differ on a tick | `specified` | `stdlib.md` 8.1 | `math/rounding` |
| `round(x, decimals)` | To a fixed number of decimals on the same rule | `specified` | `stdlib.md` 8.1 | `math/round-decimals` |
| `roundToStep`, `roundToTick` | To a multiple of a step, and to the instrument's tick, which is `none` when the host supplied no tick size | `specified` | `stdlib.md` 8.1, `stdlib.md` 3.4 | `math/round-to-tick` |
| `sqrt`, `pow`, `exp`, `log`, `log10` | With absence rather than an error where the result is not a finite real | `specified` | `stdlib.md` 8.1 | `math/exp-log` |
| `math.pi`, `math.e` | The two constants | `specified` | `stdlib.md` 8.2 | `math/constants` |
| `math.log2`, `math.hypot` | Base two logarithm, and a hypotenuse without intermediate overflow | `specified` | `stdlib.md` 8.2 | `math/log2-hypot` |
| `math.toDegrees`, `math.toRadians` | Angle conversion | `specified` | `stdlib.md` 8.2 | `math/angle-conversion` |
| Trigonometry | `math.sin`, `math.cos`, `math.tan`, the three inverses and `math.atan2` | `specified` | `stdlib.md` 8.2 | `math/trigonometry` |
| No random source | There is no random function anywhere, because a script that plots differently twice cannot be conformance tested | `specified` | `language.md` 7.6, `stdlib.md` 8.2 | `math/no-random` |
| Hyperbolic functions | `math.sinh`, `math.cosh` and `math.tanh` are named and not defined | `planned` | `stdlib.md` 8.2 | `math/hyperbolic` |

## 18. Strings and formatting

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| `str.length` | Count of Unicode code points, not bytes and not UTF-16 units | `specified` | `stdlib.md` 10 | `str/length` |
| Code point semantics | Length, indexing and slicing all count code points, so one engine cannot disagree with another; a position outside the string is OS4011 | `deferred` | `stdlib.md` 10, `errors.md` OS4011 | `str/code-points` |
| `str.upper`, `str.lower` | Case conversion, invariant rather than locale aware, so a result never depends on a machine setting | `specified` | `stdlib.md` 10 | `str/case` |
| `str.trim` | Leading and trailing spaces removed | `specified` | `stdlib.md` 10 | `str/trim` |
| `str.contains` | Substring test | `specified` | `stdlib.md` 10 | `str/contains` |
| `str.startsWith`, `str.endsWith` | Prefix and suffix tests | `specified` | `stdlib.md` 10 | `str/prefix-suffix` |
| `str.indexOf` | First position of a substring, or -1 | `specified` | `stdlib.md` 10 | `str/index-of` |
| `str.substring` | `from` inclusive, `to` exclusive, to the end when `to` is absent | `specified` | `stdlib.md` 10 | `str/substring` |
| `str.replace`, `str.replaceAll` | First and every occurrence | `specified` | `stdlib.md` 10 | `str/replace` |
| `str.split` | To an `array<string>` | `specified` | `stdlib.md` 10 | `str/split` |
| `str.join` | From an `array<string>` | `specified` | `stdlib.md` 10 | `str/join` |
| `str.padLeft`, `str.padRight` | Pad to a width, for a table column that must line up | `specified` | `stdlib.md` 10 | `str/pad` |
| `str.repeat` | A whole number of copies, for a bar drawn out of characters in a cell | `specified` | `stdlib.md` 10 | `str/repeat` |
| No warmup on a string operation | A string operation on a present string produces a value on bar 0 | `specified` | `stdlib.md` 10 | `str/no-warmup` |
| String length limit | A string past the engine's limit is OS5008 rather than a truncation | `specified` | `errors.md` OS5008 | `str/length-limit` |
| `str.format` | A template with placeholders, which arrives with the variadic call form and not before | `planned` | `stdlib.md` 10 | `str/format` |
| `str.match` | Pattern matching, once a pattern syntax is specified | `planned` | `stdlib.md` 10 | `str/match` |

## 19. Colours

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| Named colours | The nineteen bare names, ordinary globals so more can be added without a grammar change | `specified` | `language.md` 3.8, `stdlib.md` 11.1 | `color/named` |
| Channel values fixed by the manifest | Their exact channels are part of the conformance suite, so a study looks the same on every engine | `specified` | `stdlib.md` 11.1 | `color/manifest-channels` |
| Hex colours | 24 bit, and 32 bit with an alpha byte | `specified` | `language.md` 3.8 | `color/hex` |
| `rgb(r, g, b)` | Construct from channels, fully opaque | `specified` | `stdlib.md` 11.2 | `color/rgb` |
| `rgba(r, g, b, a)` | Construct with alpha from 0 to 1, where 1 is opaque | `specified` | `stdlib.md` 11.2 | `color/rgba` |
| `fade(color, percent)` | Transparency as a percentage, where 100 is invisible, which is the convention a chart's own style controls use, and it sets the alpha rather than scaling it, so nesting two fades is the outer one | `specified` | `stdlib.md` 11.2 | `color/fade` |
| `alpha`, `withAlpha` | Read a colour's alpha, and set it on the 0 to 1 convention | `specified` | `stdlib.md` 11.2 | `color/alpha` |
| `mix(a, b, weight)` | Blend of two colours | `specified` | `stdlib.md` 11.2 | `color/mix` |
| Channel rounding | Colour-producing calls round red, green and blue with the language's own rounding, and the alpha becomes a byte as round(alpha * 255) at the contract boundary | `specified` | `stdlib.md` 11.2, `compiled-program.md` 3.1, `conformance.md` 6 | `color/channel-rounding` |
| Channel out of range | OS3004 as a literal and OS4009 at run time, not a clamp, because a colour computed from data and landing at 300 is a bug | `deferred` | `stdlib.md` 11.2, `errors.md` OS4009 | `color/channel-range` |
| Absent colour | An absent colour paints nothing and is not an error, which is how a conditional paint switches itself off | `specified` | `stdlib.md` 14.3, `language.md` 6.7 | `color/absent` |
| One alpha convention | A colour carries its own alpha everywhere, so a band, a box fill and a background are all dimmed the same way | `specified` | `stdlib.md` 11.2, `stdlib.md` 14.2 | `color/one-alpha-convention` |
| `hsl`, `gradient` | Hue-saturation-lightness construction and positioning a value between two colours, named and not defined | `planned` | `stdlib.md` 11.2 | `color/planned-construction` |

## 20. Technical analysis library

The library is roughly two hundred entries. One row per family here, and one
conformance case per function inside the family's directory, because two hundred
rows would drown the rest of this file without proving anything a family row does
not. The function count itself is printed by continuous integration from the
library manifest, alongside the count of manifest entries that have a case.

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| Simple and weighted averages | `sma`, `wma`, `swma`, `alma`, each with its stated weighting | `specified` | `stdlib.md` 4 | `ta/average-simple` |
| Exponential and running averages | `ema`, `rma`, `dema`, `tema`, each with its stated seeding | `specified` | `stdlib.md` 4 | `ta/average-exponential` |
| Adaptive and volume averages | `hma`, `vwma`, `linreg` | `specified` | `stdlib.md` 4 | `ta/average-adaptive` |
| `ma(src, len, type)` | One call whose shape a select input can switch between the six named types | `specified` | `stdlib.md` 4 | `ta/ma-selector` |
| Trend systems that return a direction | `supertrend` and `psar` return the line and a direction together, because deriving the flip would double the work | `specified` | `stdlib.md` 4 | `ta/trend-direction` |
| Trend frames and strength | `adx`, `aroon`, `ichimoku`, with the spans returned undisplaced and drawn forward by the plot's offset | `specified` | `stdlib.md` 4 | `ta/trend` |
| Momentum oscillators | `rsi`, `stoch`, `stochRsi`, `macd`, `ppo`, `cci`, `mom`, `roc`, `williamsR`, `tsi`, `trix`, `cmo`, `dpo`, `ultimateOsc`, `awesomeOsc` | `specified` | `stdlib.md` 5 | `ta/momentum` |
| A function over changes costs one bar | An oscillator that consumes changes rather than levels warms up one bar later, and the warmup column says so per entry | `specified` | `stdlib.md` 5 | `ta/change-warmup` |
| Volatility and bands | `trueRange`, `atr`, `natr`, `stdev`, `variance`, `bollinger`, `bbWidth`, `bbPercent`, `keltner`, `donchian`, `chop`, `hv` | `specified` | `stdlib.md` 6 | `ta/volatility` |
| Population by default | `stdev` and `variance` divide by `len`, with `sample = true` for the other divisor, so neither camp writes the correction by hand | `specified` | `stdlib.md` 6 | `ta/stdev-population` |
| Volume studies | `vwap`, `vwapAnchor`, `obv`, `ad`, `adOsc`, `mfi`, `cmf`, `pvt`, `eom`, `forceIndex`, `relativeVolume` | `specified` | `stdlib.md` 7 | `ta/volume` |
| `vwap` resets on the session | Not at midnight, because the session is what the number means; on a session-length bar it equals its source and warns with OS8006 | `deferred` | `stdlib.md` 7, `errors.md` OS8006 | `ta/vwap-session` |
| A volume study with no volume | Every function of the volume family returns absence on every bar when the host supplies no volume | `specified` | `stdlib.md` 7, `stdlib.md` 3.1 | `ta/volume-absent` |
| Exact warmup per function | Each function's first present bar is fixed by the entry and asserted per function | `specified` | `language.md` 7.3, `stdlib.md` 1 | `ta/warmup-exact` |
| Absence behaviour per function | Window propagation, or the named skipping behaviour, asserted per function | `specified` | `language.md` 6.7, `stdlib.md` 2.4 | `ta/absence-behaviour` |
| Independent reference agreement | Every library function matches an independently written reference, which is what the `numerics` category exists for | `specified` | `conformance.md` 4, `conformance.md` 7 | `ta/reference-agreement` |
| Planned entries in the calculation families | `kama`, `zlema`, `vidya`, `zigzag`, `fisher`, `rvi`, `coppock`, `massIndex`, `nvi`, `pvi`, `klinger`, `volumeProfile` and `cvd` are named and not defined | `planned` | `stdlib.md` 4, `stdlib.md` 5, `stdlib.md` 6, `stdlib.md` 7 | `ta/planned-entries` |

## 21. Series helpers

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| Extremes over a window | `highest`, `lowest`, `highestBars`, `lowestBars` | `specified` | `stdlib.md` 9 | `series/extremes` |
| `change` | Over one bar, and over a stated distance | `specified` | `stdlib.md` 9 | `series/change` |
| `rising`, `falling` | Every change in the window positive, or every one negative | `specified` | `stdlib.md` 9 | `series/rising-falling` |
| Crossover tests | `crossUp`, `crossDown`, `cross` | `specified` | `stdlib.md` 9 | `series/crossover` |
| A touch counts as a cross | "At or below, then above" rather than "strictly below, then above", so two series that touch and separate report one cross | `specified` | `stdlib.md` 9 | `series/cross-touch` |
| `barsSince`, `valueWhen` | Bars since a condition last held, and a value as it stood then, with an occurrence argument | `specified` | `stdlib.md` 9 | `series/bars-since` |
| Absent before the condition first holds | Absent rather than zero, because zero would read as "it happened on this bar" | `specified` | `stdlib.md` 9 | `series/bars-since-absent` |
| Accumulation | `cum`, `sum` over a window, `count` over a window | `specified` | `stdlib.md` 9 | `series/accumulation` |
| Pivots | `pivotHigh` and `pivotLow` report `right` bars after the pivot, the first bar on which it is knowable, so history carries no lookahead | `specified` | `stdlib.md` 9 | `series/pivots` |
| Rank and distribution | `median`, `percentile`, `percentRank` | `specified` | `stdlib.md` 9 | `series/rank` |
| Correlation and covariance | Over a window, population form, -1 to 1 for the correlation | `specified` | `stdlib.md` 9 | `series/regression` |

## 22. Time, session and calendar

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| `time` | The bar's open time, UTC milliseconds | `specified` | `language.md` 15.1, `stdlib.md` 3.1 | `time/bar-time` |
| The zone a calendar field is read in | The chart's timezone unless a `zone` argument names another, because a study that disagreed with the chart's own axis would be wrong invisibly | `specified` | `stdlib.md` 12.1 | `time/zone-default` |
| A zone is an IANA name | Never a fixed offset, which is silently wrong for half the year wherever daylight saving is observed; an unknown zone is OS6005 | `specified` | `stdlib.md` 12.1, `errors.md` OS6005 | `time/zone-iana` |
| Calendar fields | `date.year`, `date.month`, `date.day`, `date.dayOfYear` | `specified` | `stdlib.md` 12.2 | `time/date-fields` |
| Clock fields | `date.hour`, `date.minute`, `date.second` | `specified` | `stdlib.md` 12.2 | `time/clock-fields` |
| `date.dayOfWeek` | 1 for Monday through 7 for Sunday, so a trading week is a contiguous range | `specified` | `stdlib.md` 12.2 | `time/day-of-week` |
| `date.weekOfYear` | Week number, weeks starting Monday | `specified` | `stdlib.md` 12.2 | `time/week-of-year` |
| `date.from` | Build a timestamp from calendar and clock fields plus a zone; a field outside its range is OS4010 | `deferred` | `stdlib.md` 12.2, `errors.md` OS4010 | `time/construct` |
| Calendar boundaries | `date.startOfDay`, `date.startOfWeek`, `date.startOfMonth`, `date.isSameDay` | `specified` | `stdlib.md` 12.2 | `time/boundaries` |
| `date.format` | A closed set of placeholders, with English invariant month and weekday abbreviations, never a locale default | `specified` | `stdlib.md` 12.3 | `time/format` |
| Session flags | `session.isOpen`, `session.isFirstBar`, `session.isLastBar`, the last known from the session's scheduled close rather than from a bar arriving | `specified` | `stdlib.md` 12.4, `host-interface.md` 4.3 | `session/flags` |
| Session times | `session.startTime`, `session.endTime`, `session.barIndex` | `specified` | `stdlib.md` 12.4 | `session/times` |
| `session.isIn` and the window spec | `"HHMM-HHMM"` with an optional day list, an end before a start crossing midnight, a malformed literal OS3008 | `specified` | `stdlib.md` 12.5, `errors.md` OS3008 | `session/window-spec` |
| `date.add` | Calendar arithmetic that respects month lengths and daylight saving, named and not defined | `planned` | `stdlib.md` 12.2 | `time/calendar-add` |
| `session.isHoliday`, `session.nextOpen` | Named and not defined; the first waits on a supplied calendar | `planned` | `stdlib.md` 12.4 | `session/planned` |
| Session day boundary | Which calendar day a bar belongs to when a session crosses midnight | `planned` | `none` | `session/day-boundary` |

## 23. The plot family

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| `plot(value, title, ...)` | One column of one value per bar, returning a declaration handle and landing in one entry of the contract's plotted columns | `specified` | `language.md` 15.3, `stdlib.md` 14.2, `compiled-program.md` 2.8 | `plot/basic` |
| Plot styles | `"line"`, `"lineWithMarkers"`, `"step"`, `"area"`, `"histogram"` and `"column"`, the same closed set the host's own style menu offers | `specified` | `stdlib.md` 14.2, `compiled-program.md` 2.8 | `plot/styles` |
| `plotCandles` | Four series drawn as bar-shaped output, carried as one plotted column naming four source columns | `specified` | `stdlib.md` 14.2, `compiled-program.md` 2.8 | `plot/candles` |
| A band drawn to a candle plot | Follows the `close` column, which is the column the contract keeps as that plot's identity | `specified` | `stdlib.md` 14.2 | `plot/candles-identity` |
| Width and colour | A width, and a colour argument that is also how the per-bar colour is given, and an omitted colour is null in the compiled program, which hands the choice to the host's palette | `specified` | `stdlib.md` 14.2, `compiled-program.md` 2.8 | `plot/appearance` |
| Per-bar plot colour | A constant colour lands on the plot's style and a `series color` lands on the contract's per-bar colour channel, from the same argument | `specified` | `stdlib.md` 14.2, `compiled-program.md` 2.8 | `plot/per-bar-color` |
| Plot offset | Shifts where the column is drawn and never what it contains, which is what a displaced cloud or a projected channel wants | `specified` | `stdlib.md` 14.2, `compiled-program.md` 2.8 | `plot/offset` |
| Price scale selection | `"right"`, `"left"` or `"none"`, per plot | `specified` | `stdlib.md` 14.2, `compiled-program.md` 2.8 | `plot/price-scale` |
| Precision and format per plot | They set the formatting of the price scale the plot maps to, which is almost never wanted over the price pane, so OS8007 warns | `specified` | `stdlib.md` 14.2, `errors.md` OS8007 | `plot/precision-format` |
| Fixed column set | The set of plots is fixed before bar 0, which is what lets a legend and a settings dialog exist | `specified` | `language.md` 7.1, `language.md` 5.4, `compiled-program.md` 2.8 | `plot/fixed-column-set` |
| Hiding by absence | A plot is hidden on a bar by plotting `none`, never by wrapping it in an `if` | `specified` | `language.md` 7.1, `stdlib.md` 14.1 | `plot/hide-by-absence` |
| A plot that can never draw | OS8009, because a column that is absent on every bar is a mistake rather than a hidden plot | `specified` | `errors.md` OS8009 | `unit:plot/never-draws` |
| `signal(text)` | The whole of shape plotting: one call, one named marker on the bar, landing in the contract's markers | `specified` | `language.md` 15.3, `stdlib.md` 14.3 | `plot/signal` |
| Signal placement and shape | `at` takes `"above"`, `"below"` or `"price"` and `shape` takes ten values; both are compile-time constants, because the marker's declaration is fixed before bar 0 | `specified` | `stdlib.md` 14.3, `compiled-program.md` 2.8 | `plot/signal-shapes` |
| One marker per call site per bar | A call site that fires more than once on a bar leaves the last text written | `specified` | `stdlib.md` 14.3, `compiled-program.md` 2.8 | `plot/signal-once` |
| A signal on a moving bar | Does not fire unless the declaration sets `onUnconfirmed = true` | `specified` | `stdlib.md` 14.3, `language.md` 7.5 | `plot/signal-confirmed` |

## 24. Fills, levels, bar colour and background

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| `fill(plotA, plotB, ...)` | A shaded band between two declared plots, carried as two plot keys in the contract's bands | `specified` | `language.md` 15.3, `stdlib.md` 14.2, `compiled-program.md` 2.8 | `fill/handles` |
| An expression as a fill edge | OS3020, with the fix naming the plots to declare, because there is no contract key for a column that was never declared | `specified` | `stdlib.md` 14.2, `errors.md` OS3020 | `unit:fill/expression-rejected` |
| `color` on a band | Sets both sides | `specified` | `stdlib.md` 14.2 | `fill/color` |
| Two-sided fill colour | `colorUp` is the side where `plotA` leads and `colorDown` the side where `plotB` leads, because which side leads is itself the signal | `specified` | `stdlib.md` 14.2, `compiled-program.md` 2.8 | `fill/two-sided` |
| `color` with either two-sided colour | OS3010, because reconciling them would need a rule and every rule for it surprises somebody | `specified` | `stdlib.md` 14.2, `errors.md` OS3010 | `unit:fill/color-conflict` |
| No colour given at all | The band is `plotA`'s colour faded to twelve percent, the chart's own default for a band | `specified` | `stdlib.md` 14.2 | `fill/default-color` |
| `opacity` multiplies the colour's alpha | Default 1, a dimmer over whatever the colours already are rather than a second way to say `fade` | `specified` | `stdlib.md` 14.2, `compiled-program.md` 2.8 | `fill/opacity` |
| Fill across absence | The band stops on a bar where either plot is absent | `specified` | `language.md` 6.7, `stdlib.md` 18 | `fill/absence-gap` |
| `level(price, title, ...)` | A horizontal reference line in the study's pane | `specified` | `stdlib.md` 14.2, `compiled-program.md` 2.8 | `level/basic` |
| Computed level | A level's price arrives through a channel and is evaluated every bar; the level drawn is the one from the last bar executed | `specified` | `stdlib.md` 14.2, `compiled-program.md` 2.8 | `level/computed` |
| Level appearance | Colour, width, and solid or dashed | `specified` | `stdlib.md` 14.2, `compiled-program.md` 2.8 | `level/appearance` |
| `barColor(color)` | Recolours the instrument's own candles, one colour per bar | `specified` | `stdlib.md` 14.3, `compiled-program.md` 2.8 | `barcolor/basic` |
| Bar colour absence | An absent colour leaves the bar its own colour and is not an error | `specified` | `stdlib.md` 14.3, `language.md` 6.7 | `barcolor/absence` |
| One paint channel per program | Three `barColor()` calls write one channel and the last write on the bar wins, which is the ordinary channel rule | `specified` | `compiled-program.md` 2.8 | `barcolor/last-write` |
| `background(color)` | Per-bar shading behind the pane, a full-height column | `specified` | `stdlib.md` 14.3, `compiled-program.md` 2.8 | `background/basic` |
| Background absence | An absent colour clears that bar's shading | `specified` | `stdlib.md` 14.3, `language.md` 6.7 | `background/absence` |
| Single publisher rule | The study latest in the host's own study order that paints owns the instrument's candles, and every other study's bar colouring is not drawn; the order is the one a legend shows and a user reorders, so it does not move between frames | `specified` | `compiled-program.md` 11, `stdlib.md` 14.3 | `unit:barcolor/single-publisher` |

## 25. Tables

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| `table(...)` declaration | Declared at the top level because the grid's size and corner are part of the study's fixed shape | `specified` | `stdlib.md` 14.3, `language.md` 5.4, `errors.md` OS3006 | `table/declaration` |
| Fixed rows, columns and corner | Registered in the contract with its rows, columns, corner and options, so its shape is declaration-time even though its cells are written per bar | `specified` | `compiled-program.md` 2.8, `stdlib.md` 14.3 | `table/fixed-shape` |
| `cell(t, row, col, text, ...)` | Text, text colour and background colour per cell, written on any bar and from anywhere | `specified` | `stdlib.md` 14.3 | `table/cell-content` |
| Cell alignment | Per cell, through the `align` argument, which takes `"left"`, `"center"` or `"right"` | `specified` | `stdlib.md` 14.3 | `table/cell-alignment` |
| A cell outside the grid | OS4008, naming the cell and the grid's size | `deferred` | `errors.md` OS4008 | `unit:table/cell-out-of-range` |
| `clear(t)` | Empties every cell, so a table can be rebuilt from scratch and a "show table" input can switch it off | `specified` | `stdlib.md` 14.3, `language.md` 5.4 | `table/clear` |
| `clear` is one overloaded name | `clear(arr)` is the array operation and `clear(t)` is the table one, told apart by the argument's type | `specified` | `stdlib.md` 14.3, `stdlib.md` 2.2, `language.md` 14.1 | `table/clear-overload` |
| Per-bar update | Cells go to an output buffer cleared at the start of each execution of a bar and committed with the rest, so the last write of the last bar is what is shown | `specified` | `compiled-program.md` 2.8, `compiled-program.md` 5.1 | `table/per-bar-update` |
| Cells are not channels | A grid of two hundred cells would otherwise need two hundred channels, almost all absent on almost every bar | `specified` | `compiled-program.md` 2.8 | `table/cells-not-channels` |
| Absent cell | An absent value renders a blank cell, never a zero | `specified` | `language.md` 6.7, `stdlib.md` 18 | `table/absent-cell` |
| Row and column sizing | Widths and heights, or automatic; no argument carries them today | `planned` | `none` | `table/sizing` |

## 26. Mutable drawing objects

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| `draw.line` | A line between two anchors, with optional extension | `specified` | `stdlib.md` 14.4 | `draw/line` |
| `draw.label` | A text plate at one anchor | `specified` | `stdlib.md` 14.4 | `draw/label` |
| `draw.box` | A rectangle between two anchors, with an optional fill and caption | `specified` | `stdlib.md` 14.4 | `draw/box` |
| `draw.polyline` | A path through several anchors, optionally closed and filled | `specified` | `stdlib.md` 14.4 | `draw/polyline` |
| Two parallel arrays for a path | `draw.polyline` takes times and prices separately because version 1 has no record type, and gets its natural shape when one arrives | `specified` | `stdlib.md` 14.4 | `draw/polyline-arrays` |
| Time and price anchoring | An anchor is a time and a price, not a bar index, so a shape stays put when history is paged in | `specified` | `stdlib.md` 14.4 | `draw/time-anchored` |
| Mutation after creation | The setters move, recolour, retext and restyle an object on a later bar | `specified` | `stdlib.md` 14.4 | `draw/mutation` |
| Line extension | `draw.setExtend` continues a line to the pane edge, left or right | `specified` | `stdlib.md` 14.4 | `draw/extend` |
| Tooltip | Detail shown while the pointer rests on an object | `specified` | `stdlib.md` 14.4 | `draw/tooltip` |
| Deletion and counting | `draw.delete`, `draw.deleteAll` and `draw.count` | `specified` | `stdlib.md` 14.4, `language.md` 5.4 | `draw/delete` |
| A deleted object still held | OS8019, warning that a name or an array still refers to an object deleted earlier, because a stale handle in a setter is OS4005 one bar later | `deferred` | `language.md` 5.4, `errors.md` OS8019 | `unit:draw/deleted-still-held` |
| Identity across bars | An object held in a `var` is the same object next bar | `specified` | `language.md` 5.4, `stdlib.md` 14.4 | `draw/identity` |
| Engine capability | A program that creates objects declares the `objects` capability, and an engine without it refuses at load with OS6006 | `specified` | `compiled-program.md` 2.2, `errors.md` OS6006 | `draw/capability` |
| Hit identity | A click identity on a box or a label, beyond the tooltip | `planned` | `none` | `draw/hit-identity` |
| Layer replacement | The whole live object set is handed over after every execution and replaces what was handed over before, so a deletion needs no instruction and a re-executed bar leaves no duplicate; the compiled format carries no field for the set because the engine is asked for it | `specified` | `compiled-program.md` 11 | `draw/layer-replacement` |

## 27. Higher timeframe and other instrument reads

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| `req.timeframe(tf, expr, mode)` | An expression computed on a coarser interval and folded onto this chart's bars | `specified` | `stdlib.md` 15.1, `language.md` 15.2 | `req/timeframe` |
| `req.symbol(...)` | An expression computed on another instrument, with its own request and attach lifecycle in the contract | `specified` | `stdlib.md` 15.1 | `req/symbol` |
| Timeframe strings | A count and a unit, case sensitive so `"1M"` is a month and `"1m"` a minute, with a bare number read as minutes; an unrecognised one is OS6001 | `specified` | `stdlib.md` 15.2, `errors.md` OS6001 | `req/timeframe-strings` |
| A timeframe finer than the chart's | OS6002, and a timeframe that does not fold into the chart's is OS6015, since folding cannot invent bars that were never loaded | `specified` | `stdlib.md` 15.2, `errors.md` OS6002, `errors.md` OS6015 | `req/finer-timeframe` |
| The mode is part of the call | `"confirmed"`, `"developing"` or `"lookahead"`, written on the line that causes the behaviour rather than set somewhere else | `specified` | `stdlib.md` 15.3 | `req/mode` |
| The default never repaints | `"confirmed"` is the default and the other two must be written out, so a script that says nothing cannot repaint | `specified` | `stdlib.md` 15.3 | `req/default-non-repainting` |
| Warning on a developing read | OS8002, naming the line and what the study will now do | `specified` | `stdlib.md` 15.3, `errors.md` OS8002 | `unit:req/os8002-warning` |
| Warning on a lookahead read | OS8005, and the compiled study is marked repainting so the host shows it in the legend | `specified` | `stdlib.md` 15.3, `errors.md` OS8005 | `unit:req/os8005-warning` |
| Warmup per mode | Each mode's first present bar is stated, so alignment is not left to the engine | `specified` | `stdlib.md` 15.3 | `req/warmup` |
| What an expression means inside a read | Compiled as a separate program over the requested bars, where the built-in series are the requested instrument's at the requested timeframe, and evaluated once per requested bar | `specified` | `stdlib.md` 15.4, `compiled-program.md` 2.16.1 | `req/expression` |
| A per-bar name inside a read | OS6003, because a value computed on this chart's bars has no counterpart on the requested bars | `specified` | `stdlib.md` 15.4, `errors.md` OS6003 | `unit:req/per-bar-name` |
| A setting inside a read | An `input()` read there, written in place or behind a name, resolved in the enclosing program before the body runs and filled into a register of the body's own table | `specified` | `stdlib.md` 15.4, `compiled-program.md` 2.16 | `req/setting-in-expression` |
| A `var` holding a setting inside a read | OS6003, because the cell is the setting only until something assigns to it | `specified` | `stdlib.md` 15.4, `errors.md` OS6003 | `unit:req/var-setting-in-read` |
| An order or a surface call inside a read | OS7003 for an order function, OS3006 for a drawing or alert call | `specified` | `stdlib.md` 15.4, `errors.md` OS7003, `errors.md` OS3006 | `unit:req/order-in-read` |
| Waiting for the host | The read is absent until the answer arrives, the study reports itself loading, and the rest of it keeps drawing | `specified` | `stdlib.md` 15.5 | `req/waiting` |
| `req.isReady`, `req.error` | Whether the host has answered, and the reason a read failed | `specified` | `stdlib.md` 15.1 | `req/status` |
| A refused or empty request | OS6007 for an unknown symbol or exchange, OS6008 for no bars, OS6009 for a failure, each with a reason the script can read | `specified` | `stdlib.md` 15.5, `errors.md` OS6007, `errors.md` OS6008, `errors.md` OS6009 | `req/failed-request` |
| A request that changes after bar 0 | OS6013, because the set of requests is part of the program's shape | `deferred` | `errors.md` OS6013 | `unit:req/request-stable` |
| Too many outstanding requests | OS5006, with the count named rather than a quiet cap | `specified` | `errors.md` OS5006 | `req/request-budget` |
| A feed that does not offer a timeframe | OS6014, distinct from a timeframe the language does not know | `specified` | `errors.md` OS6014 | `req/feed-timeframe` |
| Alignment onto the chart's bars | Which chart bar each higher timeframe value first appears on: a bucket is keyed by a bar's open instant, and a confirmed read steps on the first chart bar of the next bucket | `specified` | `compiled-program.md` 2.16.2 | `req/alignment` |
| Calendar mismatch | How bars align when two instruments have different sessions or holidays | `planned` | `none` | `req/calendar-mismatch` |
| `req.candle`, `req.events` | A whole higher timeframe bar at once, and scheduled events; named and not defined | `planned` | `stdlib.md` 15.1 | `req/planned-reads` |

## 28. Alerts

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| `alert(message, ...)` | A message raised on this bar, landing in one entry of the contract's watched conditions | `specified` | `language.md` 15.3, `stdlib.md` 16, `compiled-program.md` 2.8 | `alert/basic` |
| A call site becomes a declared condition | The compiler lifts each call site into one entry whose predicate is the chain of guards reaching it, so the runtime watches the study rather than the script polling | `specified` | `stdlib.md` 16.1, `compiled-program.md` 2.8 | `alert/declared-condition` |
| `id` is the stable name | A subscription survives an edit; with no `id` the compiler derives one from position and warns with OS8008 | `specified` | `stdlib.md` 16.1, `errors.md` OS8008 | `alert/id` |
| Message from per-bar values | The message is evaluated for the bar the predicate accepted and reaches the host on its own channel | `specified` | `stdlib.md` 16.1, `compiled-program.md` 2.8 | `alert/message-template` |
| `frequency` | `"oncePerBar"`, `"once"` or `"everyUpdate"`, the last requiring `onUnconfirmed = true` or OS3009 | `specified` | `stdlib.md` 16.2, `errors.md` OS3009 | `alert/frequency` |
| Confirmed bar only | An alert does not fire on a moving bar unless the declaration opts in, and never fires if the condition has gone by the close | `specified` | `language.md` 7.5, `stdlib.md` 16.2 | `alert/confirmed-only` |
| Absent condition | An absent condition does not fire, by the false-branch rule | `specified` | `language.md` 6.6 | `alert/absent-condition` |
| Nothing fires for history | Adding a study to a chart that already holds history fires nothing for those bars: an alert is raised only on a bar the host states it is driving live, which is the fact that separates the two | `specified` | `stdlib.md` 16.2, `compiled-program.md` 5.4 | `alert/no-history` |
| `notify(message, channel)` | Sending an alert somewhere the host has configured; named and not defined | `planned` | `stdlib.md` 16 | `alert/notify` |
| Payload contract | The entry's key, its title, the value the message channel held for that bar, the bar's index in the run and the bar's open time, and nothing else | `specified` | `compiled-program.md` 5.4 | `alert/payload` |

## 29. Strategy: orders

Everything in this section is available only in a `strategy()` file. Calling one
from a `study()` file is OS7001.

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| One position per leg | A strategy holds one position per declared leg, no order crosses zero, and a file that declares no leg has one leg, the chart's instrument | `specified` | `stdlib.md` 17.1 | `order/net-position` |
| No order takes a symbol | An order names a leg, never a symbol; the engine neither parses nor builds one | `specified` | `stdlib.md` 17.1, `stdlib.md` 17.6 | `order/no-symbol` |
| `leg.fixed`, `leg.relative` | Declare the contract a leg trades, outright or by description, top level only and resolved before bar 0 | `specified` | `stdlib.md` 17.6, `host-interface.md` 9.3, `host-interface.md` 9.4 | `order/leg-declaration` |
| A description the host cannot resolve | OS6007 before the first bar, and the strategy does not start | `specified` | `stdlib.md` 17.6, `errors.md` OS6007 | `unit:order/leg-unresolvable` |
| The account's own position | A strategy folds its position from its own settled fills, and no call returns the account's quantity as a number | `specified` | `stdlib.md` 17.1 | `order/account-position` |
| An order in a study file | OS7001, with the fix naming the declaration to change | `specified` | `stdlib.md` 17.1, `errors.md` OS7001 | `unit:order/study-file` |
| `buy(...)` | Enter or add to a long position | `implemented` | `stdlib.md` 17.2 | `order/buy` |
| `sell(...)` | Enter or add to a short position | `implemented` | `stdlib.md` 17.2 | `order/sell` |
| `close(...)` | Flatten the position, or the part carrying one tag | `specified` | `stdlib.md` 17.2 | `order/close` |
| What a tag argument means | A tag that defaults to the empty string is a label the destination carries; a tag that is required, or defaults to absence, is a reference to something that has to exist | `specified` | `stdlib.md` 17.2 | `order/tag-label-or-reference` |
| A close naming a tag nothing places | OS7016 at the call, before any bar runs: the call could only send nothing on every bar and say nothing, and the file can prove it where the run cannot | `specified` | `stdlib.md` 17.2, `errors.md` OS7016 | `unit:order/close-unplaceable-tag` |
| Closing a tag that holds nothing | Sends nothing and says nothing, whether the tag has already flattened or has not entered yet; a refusal here would break the shape a strategy is written in | `specified` | `stdlib.md` 17.2 | `order/close-idempotent` |
| A close that states more than it is closing | OS7017, naming what was asked for and what is left to close: no order crosses zero, and a quantity the script wrote is a claim about its own position rather than a number the engine may quietly reduce | `specified` | `stdlib.md` 17.1, `stdlib.md` 17.2, `errors.md` OS7017 | `order/close-beyond-position` |
| What is available to reduce a position | The settled position less everything already working against it: a position moves only when a fill settles, so a reducing order measured against the leg alone sends the whole of it again, on the same bar and on every bar after it | `specified` | `stdlib.md` 17.1, `stdlib.md` 17.2 | `order/reducing-budget` |
| What counts as working against a position | A ledger row neither terminal nor fully filled, counted by the part of it that has not filled: a partial fill releases what settled, a rejection, a cancellation or an expiry releases the rest, and an order that adds to a position holds nothing | `specified` | `stdlib.md` 17.1, `stdlib.md` 17.7 | `order/working-against-position` |
| A close still working when the next bar closes | Sends nothing, because the whole of the leg is already going; `cancel()` is the way out, and it works because the cancellation comes back as a frame that ends the row | `specified` | `stdlib.md` 17.1, `stdlib.md` 17.2 | `order/close-still-working` |
| Two closes on one bar | The first sends the position and the second sends nothing, which is the same idempotence as closing a tag twice; with a stated quantity the second is held against what the first left | `specified` | `stdlib.md` 17.1, `stdlib.md` 17.2 | `order/close-twice-one-bar` |
| What a bar declared `onUnconfirmed` is one bar for | The count of what is working, and no other rule: an entry is not a reducing order, so `buy()` on a bar executed four times sends four orders and a script guards with `bar.isConfirmed` | `specified` | `stdlib.md` 17.1, `language.md` 7.5 | `order/unconfirmed-scope` |
| An entry that would cross zero | Two orders with two position references, one closing the outgoing position at what is left of it and one opening the replacement, which is `order.reverse` with the arithmetic written out | `specified` | `stdlib.md` 17.1 | `order/entry-crosses-zero` |
| Which position an order is sent against | What the leg holds including what is working, never its settled net alone: a position with units still to come is a position holding them, and an order that opposes an unanswered entry is divided against it rather than joining it | `specified` | `stdlib.md` 17.1, `stdlib.md` 17.7 | `order/position-attachment` |
| The same instruction against a slower destination | The same orders on the same positions whether the entry has settled, is in flight or has partly arrived; only the position changing changes them, so an order that ended having filled part of itself leaves that part to take | `specified` | `stdlib.md` 17.1 | `order/attachment-unanswered` |
| A reducing order that spans two positions | One order per position, oldest first, bounded by what has settled on each: a leg holds more than one position whenever an order that opposes it is outstanding, and one order against two leaves a late fill unable to say which it settled | `specified` | `stdlib.md` 17.1, `stdlib.md` 17.7 | `order/reducing-spans-positions` |
| The side a close is sent on | The side that reduces what the call is flattening: the part a tag names, or the leg where none does, and a leg long under one tag and short under another is where the two disagree; taken from the leg's net, closing the short part adds to it | `specified` | `stdlib.md` 17.2 | `order/close-side-of-the-part` |
| What is working against a part | Counted on the part's own side, which is the side the leg's net calls an addition where the two are opposed: counted from the leg, a second `close(tag)` does not see the close already on its way and sends the part again | `specified` | `stdlib.md` 17.1, `stdlib.md` 17.2 | `order/close-part-idempotent` |
| A part on the side its leg is not on | Closed by what it holds, with the leg no bound on it: closing it moves the leg away from zero rather than towards it, so a part ten short under a leg two long is closed by ten, and by ten again under a leg netting nothing | `specified` | `stdlib.md` 17.2 | `order/close-part-against-the-leg` |
| The position a close the engine cannot size is sent against | The oldest position holding the side it reduces, whether or not what settled there is already spoken for: a close that works its own quantity out is not offered such a position, and one that states a quantity in lots is not choosing a number. Where the leg holds none on that side the call sends nothing | `specified` | `stdlib.md` 17.1, `errors.md` OS7005 | `order/close-unsizable-attachment` |
| A reference's side while an order is working | Read from what has settled on it and the orders' own sizes, which fall together as a fill arrives. Read instead from what a reduction claimed of the leg when it was sent, the two drift: a second stated close claims nothing, still reduces what settled, and the reference reads as the side it is not on | `specified` | `stdlib.md` 17.1, `stdlib.md` 17.7 | `order/reference-side-drift` |
| An instruction that places no order | Carries the position it is about and never mints one: a bracket names the position the leg holds or is opening, and no position where the leg holds none, which is what a cancellation carries too | `specified` | `stdlib.md` 17.7, `host-interface.md` 7.1 | `order/bracket-position-reference` |
| An entry beside a close that covers the position | Opens a position of its own, because the one it would join will reach zero and end, and a position that has ended cannot take a fill | `specified` | `stdlib.md` 17.7 | `order/entry-beside-full-close` |
| Every position a leg holds can return to zero | An order on the side that reduces a position, at the size that position holds, ends it, and an engine-sized reducing order reaches them in turn; the one shape not kept is an instruction the engine cannot divide | `specified` | `stdlib.md` 17.7, `errors.md` OS7005 | `order/every-position-ends` |
| Whether an order adds or reduces | The mapping's own answer rather than the leg's net, which reads flat while an entry is unanswered and calls every order an entry: what pyramiding counts is the entries the leg holds in that direction, across every position on that side | `specified` | `stdlib.md` 17.1, `language.md` 13.3, `errors.md` OS7008 | `order/adds-or-reduces` |
| An opposing entry the engine cannot size | Still carries a position reference of its own rather than the outgoing one, in every unit, because minting a reference needs no lot size; only the division of the quantity into a closing half and an opening half waits on it | `specified` | `stdlib.md` 17.1, `errors.md` OS7005 | `order/opposing-entry-reference` |
| Where the stated-quantity comparison is made | In full only where the stated quantity and the folded position count the same thing, which is a declaration in units; in lots, cash or equity percent only the half that needs no lot size is made, which is that a close stating a quantity against a part holding nothing is refused in every unit | `specified` | `stdlib.md` 17.2, `host-interface.md` 7.1 | `order/close-qty-unit` |
| An order the engine cannot read in units | Counted as having closed the whole of what was left, so that no quantity the engine works out after it adds to a crossing; the order itself is sent as written and is the one shape 17.1 is not held on | `specified` | `stdlib.md` 17.1, `errors.md` OS7017 | `order/reducing-qty-unreadable` |
| The average price of a leg holding two positions | Averaged over the positions on the side of the leg's net, so a position on its way out does not move the entry price of the one on its way in | `specified` | `stdlib.md` 17.1, `stdlib.md` 17.4 | `order/avg-price-two-positions` |
| A bar's rows and a bar's orders | The same set: a refusal anywhere on a bar places none of that bar's orders and leaves none of their rows, so a host reconciling a stopped run never reads an order it was not handed | `specified` | `stdlib.md` 17.7 | `order/bar-rows-and-intents` |
| Limit, stop and stop-limit | `limit` alone, `stop` alone, both together, and neither for a market order: one function with optional prices rather than six names | `specified` | `stdlib.md` 17.2 | `order/price-qualifiers` |
| A resting order with no price | OS7007 | `specified` | `stdlib.md` 17.2, `errors.md` OS7007 | `unit:order/resting-no-price` |
| The side and type value sets | What `order.place` accepts, written where a script author reads; a value outside either is OS3008 | `specified` | `stdlib.md` 17.2, `errors.md` OS3008 | `order/side-and-type` |
| A `leg` argument in a file that declares none | OS3023 at the call, whatever it names and whether the name was written or computed: the set of accepted names is empty while 17.6's declarations are planned, so the value is not what is wrong and the fix is to take the argument out | `specified` | `stdlib.md` 17.2, `errors.md` OS3023 | `unit:order/leg-undeclared` |
| `exit(...)` brackets | A target or a stop, as absolute prices or as distances from the entry | `specified` | `stdlib.md` 17.2 | `order/bracket` |
| Trailing stop | `leg.trail`, armed at a profit and ratcheting in the leg's favour only, evaluated every bar rather than resting at a destination | `specified` | `stdlib.md` 17.9, `stdlib.md` 17.10 | `order/trailing-stop` |
| An absolute and a distance for one side | OS3010, because the two would have to be reconciled and any rule for it surprises somebody | `specified` | `stdlib.md` 17.2, `errors.md` OS3010 | `unit:order/bracket-conflict` |
| A bracket price on the wrong side | OS7010 | `specified` | `errors.md` OS7010 | `unit:order/bracket-side` |
| `cancel`, `cancelAll` | Cancel a working order, or every one this strategy placed; an unknown tag is OS7009 | `specified` | `stdlib.md` 17.2, `errors.md` OS7009 | `order/cancel` |
| `order.place` | The general form, for a script that computes its side | `specified` | `stdlib.md` 17.3 | `order/place` |
| `order.reverse` | Flatten and open the same size the other way, in one decision | `specified` | `stdlib.md` 17.3 | `order/reversal` |
| `order.bracket` | Attach or replace a bracket on the open position | `specified` | `stdlib.md` 17.3 | `order/bracket-namespace` |
| `order.working`, `order.pending` | Whether a tag is live and unfilled, and how many orders are | `specified` | `stdlib.md` 17.3 | `order/working` |
| The order and fill ledger | The strategy's own record of what it sent and what filled, which every position figure is folded from | `specified` | `stdlib.md` 17.7 | `order/ledger` |
| The frame intake | An engine that takes orders exposes a way for its host to deliver one frame, at any moment between bars; without it a host holding cumulative frames has nowhere to put them and the ledger never leaves `placed` | `specified` | `host-interface.md` 7.4 | `order/frame-intake` |
| The quantity's unit | An intent states the unit its quantity is counted in and the engine translates none of it, on the same ground a product is passed untranslated: a lot is the venue's fact and the host owns symbology | `specified` | `host-interface.md` 7.1, `language.md` 13.3 | `order/qty-unit` |
| A bracket's distance | A target or a stop stated as a distance travels as a distance, because the entry it is measured from is a fill the destination knows before the engine does | `specified` | `host-interface.md` 7.1, `stdlib.md` 17.2 | `order/bracket-distance` |
| The status vocabulary | The words an order's status may take, which of them are terminal, and which of them a host may send | `specified` | `stdlib.md` 17.7 | `order/status-vocabulary` |
| The position reference | Every order settles against the position its own order names, which is why a flip is two orders and a late fill finds the position it belonged to | `specified` | `stdlib.md` 17.7 | `order/position-reference` |
| Folding an order frame | Cumulative frames folded once, whatever order they arrive in and however many times | `specified` | `stdlib.md` 17.8 | `order/fold-frame` |
| A repeated or stale frame | Folds to no change: no fill, no event, no report row | `specified` | `stdlib.md` 17.8 | `order/fold-repeat` |
| An order that fills in pieces | Every frame restates the cumulative quantity and the destination's average over it, so what is new in one is the delta that settles as a fill, and an order filled over several bars is one ledger row and several fills | `implemented` | `stdlib.md` 17.8 | `order/partial-fill` |
| A fill after a terminal status | Folded for its quantity with the status left terminal, because a cancel can race a fill and dropping it leaves the account holding a position the strategy cannot see | `implemented` | `stdlib.md` 17.8 | `order/fold-after-terminal` |
| An order that ends carrying less than it asked for | Cancelled, rejected or expired with part of its quantity filled or none of it: the row keeps the terminal word and the quantity records what traded, and the rejection text is the destination's own | `implemented` | `stdlib.md` 17.7, `stdlib.md` 17.8 | `order/ended-unfilled` |
| A frame naming no row | Refused and recorded, and nothing is folded, because it is not an order this strategy placed | `specified` | `stdlib.md` 17.8, `stdlib.md` 17.14 | `order/fold-unknown-row` |
| Reading a finished order | The ledger keeps a row after the order ends, so the reading calls read a terminal row and an unknown tag reads empty rather than raising | `specified` | `stdlib.md` 17.3, `errors.md` OS7009 | `order/ledger-reads` |
| Sizing helpers | `order.qtyForCash`, `order.qtyForRisk`, `order.qtyForEquityPercent`, rounding down by default because a size rounded up compounds with every entry | `specified` | `stdlib.md` 17.3 | `order/sizing-helpers` |
| `order.qtyForRisk` with no distance | Returns `none` rather than raising, and the order function refuses the absent quantity with OS7002 naming the argument | `specified` | `stdlib.md` 17.3, `errors.md` OS7002 | `order/qty-for-risk-absent` |
| `order.roundToLot` | To a whole multiple of the lot size, down unless told otherwise; a quantity that is not a multiple is OS7005 | `deferred` | `stdlib.md` 17.3, `errors.md` OS7005 | `order/round-to-lot` |
| Quantity types | Units, lots, cash and equity percent, from the declaration | `specified` | `language.md` 13.3 | `order/qty-types` |
| Default quantity | Taken from the declaration when an order names none | `specified` | `language.md` 13.3, `stdlib.md` 17.2 | `order/default-qty` |
| Zero or negative quantity | OS7004 | `specified` | `errors.md` OS7004 | `unit:order/qty-non-positive` |
| A price that is not on a tick | OS7006, rather than a fill at a price the instrument cannot trade | `specified` | `errors.md` OS7006 | `order/tick-price` |
| Pyramiding limit | Entries beyond the limit are refused with OS7008, and the refusal is reported | `specified` | `language.md` 13.3, `errors.md` OS7008 | `order/pyramiding` |
| Fill timing | `nextOpen` or `close`, applied consistently in backtest and live | `specified` | `language.md` 13.3, `stdlib.md` 17.1 | `order/fill-timing` |
| Slippage | Ticks of adverse slippage applied to every fill | `specified` | `language.md` 13.3, `stdlib.md` 17.1 | `order/slippage` |
| Commission models | Per trade, per unit and percent | `specified` | `language.md` 13.3, `stdlib.md` 17.1 | `order/commission` |
| Product type | Intraday versus overnight, and what each implies for carrying a position | `specified` | `language.md` 13.3 | `order/product-type` |
| Session flattening | `closeOnSessionEnd` flattens at the session close, and an order outside the session is OS7012 | `deferred` | `language.md` 13.3, `errors.md` OS7012 | `order/session-flatten` |
| Absent argument | An absent price or quantity is OS7002 naming the argument, and places nothing | `specified` | `language.md` 6.8, `errors.md` OS7002 | `order/absent-argument` |
| Deferral on a moving bar | An order decided intrabar is placed when the bar confirms, or not at all, and returns absent while deferred rather than inventing an id | `specified` | `language.md` 7.5, `compiled-program.md` 5.4 | `order/deferred` |
| Not enough capital | OS7011, naming what the order needed | `deferred` | `errors.md` OS7011 | `order/insufficient-capital` |
| Two opposite orders on one bar | OS7013, because the pair has no honest fill order | `specified` | `errors.md` OS7013 | `unit:order/opposite-orders` |
| Rejection reporting | Every refused order reports an OS7xxx code and a reason: OS7014 from the destination, OS7015 when there is no destination at all | `deferred` | `errors.md` OS7014, `errors.md` OS7015 | `order/rejection-reported` |
| Orders reach no contract field | They go to the host's order interface; what reaches the chart is their consequence, one marker per fill | `specified` | `stdlib.md` 17.5 | `order/no-contract-field` |
| Market-specific costs | Taxes, exchange and regulator charges and duties for the market being traded | `planned` | `none` | `order/market-costs` |
| `order.modify`, `order.oco` | Changing a working order in place, and cancelling one when the other fills; named and not defined | `planned` | `stdlib.md` 17.3 | `order/planned` |

## 30. Strategy: position and performance

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| `pos.size` | Net position in units, positive long and negative short, `0` when flat | `specified` | `stdlib.md` 17.4 | `pos/size` |
| `pos.isLong`, `pos.isShort`, `pos.isFlat` | The three direction tests | `specified` | `stdlib.md` 17.4 | `pos/direction` |
| `pos.avgPrice` | Average price of the open position, absent while flat because zero is a price a script would compare against | `specified` | `stdlib.md` 17.4 | `pos/avg-price` |
| `pos.entryTime`, `pos.barsHeld` | When the position opened, and how long it has been open | `specified` | `stdlib.md` 17.4 | `pos/held` |
| `pos.entries` | How many entries make up the current position, for a pyramiding rule | `specified` | `stdlib.md` 17.4 | `pos/entries` |
| `pos.openProfit`, `pos.openProfitPercent` | Unrealised profit at this bar's close, in money and as a percentage of cost | `specified` | `stdlib.md` 17.4 | `pos/open-profit` |
| `pos.maxProfit`, `pos.maxLoss` | Best and worst unrealised excursion this position has seen | `specified` | `stdlib.md` 17.4 | `pos/excursion` |
| `pos.equity`, `pos.netProfit`, `pos.tradeCount` | Capital plus realised and unrealised profit, realised profit since the run began, and closed trades so far | `specified` | `stdlib.md` 17.4 | `pos/equity` |
| Marked to the close | Open profit is marked to this bar's close, and marking to anything else is not expressible in version 1 | `specified` | `stdlib.md` 17.4 | `pos/marked-to-close` |
| Position facts reflect fills | An order placed on this bar and filled on the next bar's open changes nothing here until that fill happens | `specified` | `stdlib.md` 17.4 | `pos/reflects-fills` |
| `pos.winRate`, `pos.profitFactor`, `pos.maxDrawdown` | Named and not defined; each needs its formula written down before an engine computes it | `planned` | `stdlib.md` 17.4 | `pos/planned-statistics` |
| Long, short and flat transitions | The exact state machine, including partial closes | `planned` | `none` | `pos/transitions` |
| Trade list | One row per closed trade: entry, exit, size, cost, profit | `planned` | `none` | `perf/trade-list` |
| Equity curve | Equity per bar, including open profit: the basis the curve figures are folded from, marked to each reported bar's close | `specified` | `conformance.md` 4 | `perf/equity-curve` |
| Drawdown | Peak-to-trough decline, on a stated basis, with the running peak anchored at the capital and the deepest point naming the first bar that reached it | `specified` | `conformance.md` 4 | `perf/drawdown` |
| Run-up | The distance above the running trough, per bar and at its deepest, which is drawdown's mirror and is read against it: a run that made ten and gave back nine reports the same net as one that made one and kept it | `implemented` | `conformance.md` 4 | `unit:perf/run-up` |
| Trades by side, extreme and streak | The closed trades split long against short, the largest win and loss, and the longest run of each: three questions the summary cannot answer because it folds both sides, every trade and their order together | `implemented` | `conformance.md` 4 | `unit:perf/trade-analysis` |
| Win rate and expectancy | The two headline statistics, each with its formula written down, including which trades each counts over and where each is absent rather than zero | `specified` | `conformance.md` 4 | `perf/win-rate-expectancy` |
| Monthly return table | Returns grouped by calendar month | `planned` | `none` | `perf/monthly-table` |
| Trade markers | Every trade marked on the chart at its fill bar | `planned` | `none` | `perf/trade-markers` |
| The report window | Which of the bars supplied a run is reported over: every bar executes, a bar outside the window is warmup whose orders are real and whose position is carried in, and only a bar inside it gets a point of the report | `implemented` | `conformance.md` 3 | `perf/report-window` |
| The money rounding digit count | The count the run was folded under, which rounds the total of one fill's charges half to even and is a fact of the run rather than of the instrument | `implemented` | `conformance.md` 3 | `perf/money-digits` |
| Run reproducibility | A run records its script revision, inputs, date range and cost settings and reruns identically; only the program hash half of that is fixed today | `planned` | `compiled-program.md` 2.14 | `perf/reproducible-run` |
| Run comparison | Two runs compared well enough to tell a real improvement from noise | `planned` | `none` | `perf/run-comparison` |
| Account-level drawdown halt | Stop taking entries for the rest of the run once equity has fallen a stated amount or fraction from its peak, whatever the strategy asks for | `planned` | `none` | `pos/risk-drawdown-halt` |
| Position size cap | Refuse an entry that would take the position past a stated size, rather than trusting every call site to size correctly | `planned` | `none` | `pos/risk-position-cap` |
| Orders per session cap | Refuse further entries once a stated number of orders has been filled in one session, which is what stops a loop that is placing orders it should not | `planned` | `none` | `pos/risk-order-cap` |
| Consecutive losing sessions halt | Stop entering after a stated number of sessions that each closed down | `planned` | `none` | `pos/risk-losing-sessions` |
| Indexed access to past trades | Read a closed or open trade by index: its entry, its exit, its size and its excursions, so a strategy can reason about what it has already done | `planned` | `none` | `perf/trade-access` |
| Intrabar recalculation choice | Whether a strategy is evaluated on every update, on each fill, or only on a bar that has closed, stated by the script rather than decided by the host | `planned` | `none` | `decl/calc-timing` |

## 31. Errors, warnings and diagnostics

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| Code ranges | OS1xxx syntax, OS2xxx names and types, OS3xxx arguments, OS4xxx runtime, OS5xxx limits, OS6xxx data, OS7xxx orders, OS8xxx warnings | `specified` | `language.md` 16, `errors.md` 4 | `err/code-ranges` |
| Diagnostic shape | Every diagnostic carries a code, a line, a column, a message and a fix | `specified` | `language.md` 16, `errors.md` 2 | `err/diagnostic-shape` |
| Caret under the text | The reported column points at the offending characters | `specified` | `errors.md` 2 | `unit:err/caret` |
| Warnings do not stop | OS8xxx never halts compilation or a bar; it is reported on the line | `specified` | `language.md` 16, `errors.md` 4 | `err/warning-does-not-stop` |
| A runtime error stops the bar | The study is marked errored and the message is shown on the chart, rather than producing a plausible wrong number | `specified` | `language.md` 16, `errors.md` 4 | `err/runtime-stops-bar` |
| Catalogue authority | `errors.md` wins over any other document quoting a code | `specified` | `language.md` 1, `language.md` 16, `errors.md` 3 | `unit:err/catalogue-authority` |
| No undocumented code | The build fails if the compiler can emit a code with no catalogue entry | `specified` | `errors.md` 5 | `unit:err/no-undocumented-code` |
| Every pointer resolves | The build fails on an entry whose `test` names a file that does not exist or does not write the code, and the codes no test names are printed rather than filled in | `specified` | `errors.md` 5 | `unit:err/test-pointer-resolves` |
| Every fix compiles | The build fails on a worked example whose `after` block the compiler would refuse, because that block is what a stuck reader pastes | `specified` | `errors.md` 5 | `unit:err/after-block-compiles` |
| Every mistake raises its own code | The build fails on a `before` block that does not raise the code it is filed under, by compiling it or, for a runtime code, by running it | `specified` | `errors.md` 5 | `unit:err/before-block-raises` |
| Every error names a fix | A diagnostic that cannot state a fix is a defect in the diagnostic | `specified` | `language.md` 16, `errors.md` 3 | `unit:err/fix-present` |
| `errors.json` is the machine copy | The catalogue is generated to a data file the compiler and the editor read, so the prose cannot drift from the codes | `specified` | `errors.md` 1 | `err/json-shape` |
| Substitutions for OS1001 | The characters a source is most likely to carry by accident, each with the character to write instead | `specified` | `errors.md` 7 | `unit:err/os1001-substitutions` |
| Codes that refine another code | Where a narrower code replaces one quoted elsewhere, recorded in one place rather than argued per site | `specified` | `errors.md` 6 | `unit:err/refining-codes` |
| Engine-raised codes | The codes an engine rather than a compiler produces, and which of them the format introduces | `specified` | `compiled-program.md` 10, `errors.md` 4 | `err/engine-codes` |
| Program-shaped limits | OS5009 when the program is too large, OS5007 when one bar took too long | `specified` | `errors.md` OS5009, `errors.md` OS5007 | `unit:err/program-limits` |
| Nesting depth | OS5005, raised at load because the call graph is statically bounded, rather than halfway through a bar | `specified` | `errors.md` OS5005, `compiled-program.md` 3.3 | `err/nesting-depth` |

## 32. Logging

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| `print(value)` | Write a value to the script's log for the bar being executed, from anywhere in the file | `specified` | `stdlib.md` 14.3, `language.md` 15.3 | `log/print` |
| Bar context | Every entry carries the bar's time, so a log line can be matched to a bar | `specified` | `stdlib.md` 14.3 | `log/bar-context` |
| Rate limited by the host | The host rate limits rather than the language, and a host that drops lines says how many rather than truncating silently | `specified` | `stdlib.md` 14.3 | `log/rate-limit` |
| Logging changes no value | `print` draws nothing and lands in no contract field, so a case's numeric output is identical with logging on or off | `specified` | `stdlib.md` 14.3, `stdlib.md` 18 | `log/no-side-effect` |
| Log as an assertable output | A conformance case may assert the log stream, which is how logging itself is proved | `specified` | `conformance.md` 7 | `log/assertable` |
| Levels | `log.info`, `log.warn`, `log.error`, so a live script's log can be filtered | `planned` | `none` | `log/levels` |
| Rollback of log output | Whether lines written during a re-executed moving bar replace the previous execution's lines or are deferred like an order | `planned` | `none` | `log/rollback` |

## 33. Compiled program and engines

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| Compiled program is data | A plain instruction list against a versioned schema, never generated source | `specified` | `compiled-program.md` 2 | `prog/is-data` |
| No dynamic code | Nothing calls `eval` or builds a function from text, so a strict content security policy is enough | `specified` | `compiled-program.md` 2.14, `compiled-program.md` 3.5 | `unit:prog/no-eval` |
| Canonical encoding | One text encoding with sorted object keys and a fixed number form, so the same program encodes the same way everywhere | `specified` | `compiled-program.md` 2.14 | `prog/canonical-encoding` |
| Schema round trip | Serialise, deserialise and run, with identical output | `specified` | `compiled-program.md` 2.14 | `prog/round-trip` |
| Program hash stability | The same source under the same language version compiles to the same program and the same hash, and the source hash identifies the source | `specified` | `compiled-program.md` 2.14, `compiled-program.md` 2.3 | `prog/hash-stability` |
| Two versions, two jobs | A format version and a language version, each with its own compatibility promise | `specified` | `compiled-program.md` 2.1, `compiled-program.md` 9.1 | `prog/versions` |
| What a minor bump may do | The list of changes an engine written today must survive | `specified` | `compiled-program.md` 9.2 | `prog/minor-bump` |
| What a major bump may do | The list of changes that require an engine to be updated | `specified` | `compiled-program.md` 9.3 | `prog/major-bump` |
| How an engine refuses | OS6016 for a format version it does not implement, OS6017 for a language version, at load and never halfway | `specified` | `compiled-program.md` 9.4, `errors.md` OS6016, `errors.md` OS6017 | `prog/engine-refusal` |
| What never changes | The guarantees no version bump may withdraw | `specified` | `compiled-program.md` 9.5 | `prog/stable-guarantees` |
| Capability negotiation | A program declares what it requires, and an engine lacking one refuses with OS6006 rather than running most of it | `specified` | `compiled-program.md` 2.2, `errors.md` OS6006 | `prog/capabilities` |
| Load-time verification | A malformed program is OS6018 at load, never half executed | `specified` | `compiled-program.md` 3.5, `errors.md` OS6018 | `prog/load-verification` |
| The stack is empty at every terminator | Check 5's third sentence, walked by the compiler as well as by the engine and at every `RET` rather than the last instruction, because a `RET` reaches nothing after it and a body one value short underflows exactly there | `specified` | `compiled-program.md` 3.5 | `unit:prog/depth-at-terminator` |
| Memory regions | Stack, slots, frames, cells, library state, series registers, the object heap, channels, pending effects, the loop counter and strategy state, each with its lifetime | `specified` | `compiled-program.md` 3.2 | `prog/memory-regions` |
| Values in the machine | The value kinds an engine holds and how a reference differs from a scalar | `specified` | `compiled-program.md` 3.1 | `prog/value-kinds` |
| The instruction set | The whole opcode list, stable and numbered so a format that adds one does not renumber the rest | `specified` | `compiled-program.md` 4.13 | `prog/instruction-set` |
| Channels and `EMIT` | One channel per output value, written by `EMIT`, with `defer` marking the ones held back on a moving bar | `specified` | `compiled-program.md` 2.7, `compiled-program.md` 4.11 | `prog/channels` |
| Cells and series registers | Values that persist across bars, and registers that hold one value per bar plus the bar being executed | `specified` | `compiled-program.md` 4.3, `compiled-program.md` 4.4 | `prog/cells-and-registers` |
| Call sites and state regions | One state region per call site, with a base added per frame; a program needing more regions than the engine allows is OS5004 | `specified` | `compiled-program.md` 2.12, `errors.md` OS5004 | `prog/call-sites` |
| The bar cycle | The numbered steps of one execution of one bar, which is where rollback, channels and effects meet | `specified` | `compiled-program.md` 5.1 | `prog/bar-cycle` |
| What the host supplies | The closed list of what an engine reads from the host | `specified` | `compiled-program.md` 5.2 | `prog/host-inputs` |
| No bars supplied | OS6010, because a script cannot run over nothing and an empty pane with no message is indistinguishable from a study that drew nothing | `specified` | `compiled-program.md` 5.2, `errors.md` OS6010 | `unit:prog/no-bars` |
| Bars out of order | OS6011 naming the first bar whose time does not follow the one before it, because an engine may not reorder what it is given | `specified` | `compiled-program.md` 5.2, `errors.md` OS6011 | `unit:prog/bars-out-of-order` |
| Checkpoints | What a checkpoint holds and how one is restored | `specified` | `compiled-program.md` 6.1, `compiled-program.md` 6.2 | `prog/checkpoint` |
| The rollback rule | Stated once, in terms of the memory regions, so an engine does not have to infer it per feature | `specified` | `compiled-program.md` 6.3 | `prog/rollback-rule` |
| The replay invariant | Re-executing a bar from its checkpoint produces the same state and the same output as the first execution did | `specified` | `compiled-program.md` 6.4 | `prog/replay-invariant` |
| Stepping | Running a program one bar at a time, for an editor and for a debugger | `specified` | `compiled-program.md` 6.5 | `prog/stepping` |
| Debug information | Source positions and names by index, so a diagnostic can point at the line that produced an instruction | `specified` | `compiled-program.md` 2.15 | `prog/debug-info` |
| Becoming a chart | The mapping from program fields to chart descriptor fields, listed so an engine knows what its output is for | `specified` | `compiled-program.md` 11 | `prog/becoming-a-chart` |
| A worked example | A whole program with a bar by bar trace including a re-executed moving bar | `specified` | `compiled-program.md` 12 | `prog/worked-example` |
| Engine conformance checklist | What an engine must do to claim it implements the format | `specified` | `compiled-program.md` 13 | `prog/engine-checklist` |

## 34. Conformance suite and cross-engine equality

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| A case on disk | One directory, whose path relative to the suite root is the case identifier and the string in this file's Test column | `specified` | `conformance.md` 2 | `conf/case-layout` |
| `case.json` | The file a case declares itself in, from the case's file set | `specified` | `conformance.md` 2 | `conf/case-json` |
| How bars are supplied | `bars.csv`, which is how a case supplies the bars a program runs over | `specified` | `conformance.md` 3 | `conf/bars` |
| Instrument facts | `instrument.json`, which is how a case supplies the instrument record | `specified` | `conformance.md` 3, `host-interface.md` 4.1 | `conf/instrument-facts` |
| Secondary series and intrabar updates | `bars.<name>.csv` for another instrument or timeframe, `ticks.csv` for a moving bar | `specified` | `conformance.md` 3 | `conf/secondary-series` |
| Order frames | `frames.csv` in the case directory, delivered between bars, so a repeated frame, a crossed frame and a fill after a terminal status can each be handed to an engine | `specified` | `conformance.md` 2, `conformance.md` 3 | `conf/frames` |
| Expected output | `expected.csv` for a columnar assertion and `expected.json` for everything else a case may assert | `specified` | `conformance.md` 4 | `conf/expected` |
| Runner determinism | What a runner may not do if its results are to mean anything | `specified` | `conformance.md` 5 | `conf/runner-determinism` |
| Comparing numbers | Exact by default, with the comparison function written out | `specified` | `conformance.md` 6 | `conf/comparison` |
| Declaring a tolerance | Per case, in the case file, rather than globally in a runner | `specified` | `conformance.md` 6 | `conf/tolerance` |
| Categories of case | The categories a case may belong to, and which of them run on an engine rather than a compiler | `specified` | `conformance.md` 7 | `conf/categories` |
| Profiles | `core`, `chart` and `strategy`, cumulative, with `unsupported` counted and printed separately | `specified` | `conformance.md` 8 | `conf/profiles` |
| The adapter and the result document | What an implementation ships and what it reports | `specified` | `conformance.md` 9 | `conf/result-document` |
| Cross-engine equality | Every engine produces identical output on every case, and a disagreement blocks the release | `specified` | `conformance.md` 10 | `prog/cross-engine-equality` |
| Suite versioning | How the suite itself is versioned, so a result names what it was run against | `specified` | `conformance.md` 11 | `conf/suite-versioning` |
| What a passing result means | What it does and does not entitle an implementation to claim, and the badge | `specified` | `conformance.md` 12 | `conf/claim` |

## 35. Strategy: legs, protective levels and the book

The rest of what a `strategy()` file can call: the legs it declares, the levels
it puts in force, the book those legs make up, and the two shapes it may be
written in. Section 29's note about a `study()` file applies to every row here.

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| What a leg reports about its contract | `leg.symbol`, `leg.exchange`, `leg.product`, `leg.expiry`, `leg.strike`, fixed for the run and reporting the contract the orders carried | `specified` | `stdlib.md` 17.6 | `order/leg-resolved-reads` |
| A leg's own position | `leg.size`, `leg.avgPrice`, `leg.entryTime`, `leg.profit`, `leg.isOpen`, per leg rather than per strategy | `specified` | `stdlib.md` 17.6, `stdlib.md` 17.1 | `pos/leg-position` |
| The level actually in force | `leg.stopPrice` and `leg.targetPrice` report the level in force, not the one the script last wrote | `specified` | `stdlib.md` 17.6, `stdlib.md` 17.9 | `order/level-in-force` |
| Two legs sharing a name | OS3017, because a leg's name is what every later call keys on | `specified` | `stdlib.md` 17.6, `errors.md` OS3017 | `unit:order/leg-duplicate-name` |
| A bar-dependent leg argument | OS3003, because a leg declaration is fixed before bar 0 | `specified` | `stdlib.md` 17.6, `errors.md` OS3003 | `unit:order/leg-not-constant` |
| Per-leg protective levels | `leg.stop`, `leg.target` and `leg.trail`, each in force until it is replaced, and removed rather than refused when the level is absent | `specified` | `stdlib.md` 17.9 | `order/leg-levels` |
| Combined rules | `book.stop`, `book.target`, `book.lockProfit` and `book.trailStopsToEntry`, which act on every declared leg at once | `specified` | `stdlib.md` 17.9 | `order/book-levels` |
| Entry filters | `book.direction`, `book.entryWindow` and `book.dailyLoss`, which decide whether a new entry is taken at all | `specified` | `stdlib.md` 17.9 | `order/entry-filters` |
| Timed square off | `book.exitAt` and `book.squareOffAtExpiry`, with the session close staying the declaration's option rather than a second call | `specified` | `stdlib.md` 17.9, `language.md` 13.3 | `order/timed-square-off` |
| What the book reports | `book.profit`, `book.dayProfit` and `book.isOpen` | `specified` | `stdlib.md` 17.9 | `pos/book-reads` |
| A value outside a rule's set | OS3008 for a direction filter, an entry window or a time that is not four digits | `specified` | `stdlib.md` 17.9, `errors.md` OS3008 | `unit:order/rule-value-set` |
| `book.lockProfit` given half a step | OS3009, because `step` and `advance` are given together or not at all | `specified` | `stdlib.md` 17.9, `errors.md` OS3009 | `unit:order/lock-profit-step` |
| The order the levels are tested in | Once per bar, after the script's own statements, in the order section 17.10 fixes, because two engines testing a combined stop before a leg stop close different positions from one script | `specified` | `stdlib.md` 17.10 | `order/level-order` |
| How a level is tested | Against the bar's range on a confirmed bar and the last price on a moving one, with the stop taken where one bar holds both | `specified` | `stdlib.md` 17.10 | `order/level-test` |
| Where a level's exit fills | At the level rather than the next bar's open, at the open when the bar opened beyond it, and slippage on a stop and not on a target | `specified` | `stdlib.md` 17.10 | `order/level-fill` |
| Named events | One named event per transition a rule causes, carrying the bar's time, the leg, the rule's level and the value that crossed it | `specified` | `stdlib.md` 17.11 | `order/named-events` |
| An event is a record | No call reads one, so a script cannot branch on its own rule having fired | `specified` | `stdlib.md` 17.11 | `order/events-not-values` |
| Entering as a unit | `book.enter` and `book.exit`, one decision for every declared leg, which is what gives the combined rules a starting point | `specified` | `stdlib.md` 17.12 | `order/book-entry` |
| Entering per leg | `leg.enter` and `leg.exit`, one leg at a time on that leg's own signal | `specified` | `stdlib.md` 17.12 | `order/leg-entry` |
| Mixing the two shapes | Refused at compile time, because a leg entered outside the unit leaves the book holding a position it did not enter as a unit | `specified` | `stdlib.md` 17.12, `stdlib.md` 17.14 | `unit:order/mixed-shapes` |
| A combined rule with no book entry | Refused at compile time, with the fix naming the per-leg levels | `specified` | `stdlib.md` 17.12, `stdlib.md` 17.14 | `unit:order/combined-rule-no-entry` |
| A single-position read in a multi-leg file | Refused, because the twelve entries of section 17.4 name one position and the file holds several | `specified` | `stdlib.md` 17.14, `stdlib.md` 17.4 | `unit:pos/single-read-multi-leg` |
| Switching to live is the host's | A strategy is born in sandbox mode, switching it to live is a deliberate act in the host, and no call switches one or reports that it is live | `specified` | `stdlib.md` 17.13 | `order/switch-to-live` |

## Proved by a conformance case

Every row above cites a test inside this implementation. These cite a
conformance case, which is the same fact proved in the form any engine runs:
`cases/<identifier>/` holds the case, and `conformance.md` section 7 gives the
category its directory is named for. A row here is `implemented` because the
case exists and passes; what it proves about another engine is that engine's
suite run and not this page.

| Feature | What it is | Status | Section | Test |
|---|---|---|---|---|
| A tab in leading whitespace | A tab anywhere in the leading whitespace of a block body is OS1002 at the tab, so how deep a body sits never depends on an editor setting | `implemented` | `language.md` 3.2, `errors.md` OS1002 | `lexical/tab-indent` |
| Sibling lines agree on their indentation | A line whose leading whitespace differs from its sibling's is OS1003 at the start of that line, so a ragged body is refused rather than read as a nested one | `implemented` | `language.md` 3.2, `errors.md` OS1003 | `lexical/indent-mismatch` |
| A string literal closes on its own line | A line that ends before the closing quote is OS1004 at the opening quote, and never a literal run on to the next line | `implemented` | `language.md` 3.5, `errors.md` OS1004 | `lexical/string-unterminated` |
| Only the defined escapes | A backslash sequence the language does not define is OS1005 at the backslash, so two engines cannot hold different text for one literal | `implemented` | `language.md` 3.5, `errors.md` OS1005 | `lexical/escape-unknown` |
| No statement separator | A semicolon between two statements on one line is OS1007 at the semicolon, rather than being read as a separator or skipped as whitespace | `implemented` | `language.md` 3.6, `errors.md` OS1007 | `lexical/semicolon` |
| Comparison does not chain | A comparison written against a second comparison is OS1008 at the second operator, rather than associating the way arithmetic does | `implemented` | `language.md` 5.4, `errors.md` OS1008 | `syntax/chained-comparison` |
| A bracket is closed | A bracket never closed is OS1012 at the bracket left open, named rather than the last bracket seen | `implemented` | `language.md` 5.2, `errors.md` OS1012 | `syntax/bracket-unclosed` |
| A bracket is closed by its own kind | A bracket closed by a different kind is OS1013 at the closing bracket, rather than either closer accepted for either opener | `implemented` | `language.md` 5.2, `errors.md` OS1013 | `syntax/bracket-mismatched` |
| A ternary has both arms | A conditional with no second arm is OS1015 at the question mark, rather than the absent value supplied for the arm that is missing | `implemented` | `language.md` 9.5, `errors.md` OS1015 | `syntax/ternary-one-arm` |
| A statement does not end on its operator | An operator with no operand after it is OS1022 at the empty position, rather than joined to the next line or dropped | `implemented` | `language.md` 5.1, `errors.md` OS1022 | `syntax/expression-expected` |
| A name is read after it is assigned | A name read above its own assignment is OS2001 at the read, not at the assignment | `implemented` | `language.md` 6.1, `errors.md` OS2001 | `static/unknown-name` |
| An inner scope does not shadow | A function body declaring a name the file already declares is OS2002 at the inner declaration, rather than a second variable | `implemented` | `language.md` 6.4, `errors.md` OS2002 | `static/shadowed-name` |
| Nothing converts implicitly | A string added to a number is OS2003, because the language converts nothing on its own | `implemented` | `language.md` 4.1, `errors.md` OS2003 | `static/type-mismatch` |
| A block-local name keeps no past | A subscript on a name assigned inside a block is OS2004, because such a name retains no value from an earlier bar | `implemented` | `language.md` 7.3, `errors.md` OS2004 | `static/no-history` |
| A namespace member exists | A member a namespace does not have is OS2009 at the member, not at the namespace | `implemented` | `language.md` 6.2, `errors.md` OS2009 | `static/unknown-namespace-member` |
| A built-in series is read bare | An argument list after a built-in series is OS2010, because a series is not called | `implemented` | `language.md` 8.1, `errors.md` OS2010 | `static/not-a-function` |
| No truthiness | A number written where a condition is expected is OS2011, because nothing but a boolean is a condition | `implemented` | `language.md` 5.3, `errors.md` OS2011 | `static/condition-not-bool` |
| A type annotation names a type | A word that is not a type, written where an annotation is expected, is OS2016 | `implemented` | `language.md` 5.1, `errors.md` OS2016 | `static/unknown-annotation-type` |
| A call takes only its own named arguments | A named argument a call does not take is OS3002 at the argument, rather than ignored | `implemented` | `language.md` 9.2, `errors.md` OS3002 | `static/unknown-named-argument` |
