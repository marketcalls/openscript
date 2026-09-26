# OpenScript decision record

Version of this document: draft, tracking language version 1.

This file is the record of every cross-document question that has been settled.
It exists because the reasoning is worth more later than the answer alone: a
second implementer, reading four specification documents that each say something
slightly different, will ask exactly the questions below, and an answer with no
reason behind it invites the next reader to answer it again the other way.

Each entry states the question in one sentence, the decision, why it went that
way, and the exact edits that carry it into the specification. The specification
documents remain the authority once the edits land. This file is the minutes,
not a fifth source of truth, so a rule that appears here and nowhere else is an
edit that has not been applied yet.

Two standing notes for whoever applies these changes:

- **Part 8 of `errors.md` is rendered from `errors.json`.** Every change below to
  a per-code section of `errors.md` is the same change to the matching field of
  the same entry in `errors.json`. Applying one without the other breaks the
  claim the catalogue's preamble makes about itself.
- **A `feature-matrix.md` row must satisfy the five rules in that file's
  preamble.** Every citation named below resolves to a real heading, and every
  test identifier named below is unused elsewhere in that file. Do not invent a
  second identifier for a row that already has one.

The three repository checks must pass after every one of these edits:
`node scripts/check-names.mjs`, `node scripts/check-error-codes.mjs`,
`node scripts/check-examples.mjs`.

---

## 1. (B1) A name initialised to the absent value has no type rule

**Question.** What type does a name have when its first assignment is `none`, given
that `language.md` 10.1 fixes a name's type at its first assignment and
`language.md` 6 makes `none` a member of every type?

**Decision.** An initialiser of `none` fixes no type. A name whose first
assignment is the absent value takes its type from the first later assignment to
it, in source order, that gives it a value of a definite type; every assignment
after that one must be that type or `none`, and a second definite type is OS2003
as it is anywhere else. A name that is never given a definite type is of type
`none`: it is absent on every bar, and it is legal wherever `none` is legal, so
it plots a gap, compares with `==` and propagates through arithmetic. No new
error code, and `var x = none` stays the documented way to start a persistent
value empty.

**Why.** `none` is a member of every type, so an initialiser of `none` carries no
type information at all and there is nothing for the first-assignment rule to
fix. The language already takes a type from elsewhere in exactly this situation
twice, for the ternary arm that is `none` (OS2012) and for the empty array
literal (OS2015, `language.md` 14.1), so this is the third case of one rule
rather than a new rule.

**Changes required.**

- `language.md` 10.1: after the sentence "A name's type is fixed by its first
  assignment. Assigning a different type later is OS2003.", add a paragraph
  saying that `none` is not a type-fixing value, that the type is taken from the
  first assignment in source order that gives a definite type, that every later
  assignment must be that type or `none`, and that a name never given a definite
  type is of type `none` and absent for the whole run. Add a two-line example
  under the existing one, in the same style: `var stop = none` followed by
  `stop = lo`, with a comment saying the type is fixed by the second line.
- `language.md` 14.1: in the paragraph beginning "An empty literal takes its
  element type", add a half sentence noting that a name initialised to `none`
  takes its type the same way, with a pointer to 10.1. No other change.
- `errors.md` OS2003, in **Cause**: add one sentence, "A first assignment of
  `none` fixes no type, because `none` is a member of every type; the type comes
  from the first assignment that gives a definite one, and this code names the
  second definite type rather than the first." Make the same change to the
  `cause` field of entry OS2003 in `errors.json`. No other entry is involved.
- `feature-matrix.md` section 3, immediately after the row "Type fixed by first
  assignment": add the row
  `| A name initialised to none | none fixes no type: the type comes from the first assignment in source order that gives a definite one, and a name never given one is absent for the whole run | `specified` | `language.md` 10.1, `language.md` 6 | `type/none-initialised` |`.
- No example file changes. All twenty-one `var x = none` declarations in the
  examples, and the one in `language.md` section 2, are correct under this rule.

---

## 2. (B2) Four files name OS3011 for a bare expression in fill

**Question.** Which code does a bare expression in `fill`'s first two arguments
raise, OS3011 or OS3020?

**Decision.** OS3020. The catalogue is authoritative by `language.md` 1 and 16, it
carries an entry titled "fill needs two declared plots" whose fix names the plots
to declare, and its section 6 refinement table already records OS3020 as taking
this case from OS3011. The four files that say OS3011 are wrong and change.
OS3011 keeps its general meaning, an argument of the wrong type, and stays
correct everywhere else it is quoted.

**Why.** A refinement exists so that the fix can be specific, and this fix is
specific: plot both edges and pass the names. Quoting the family code sends the
reader to "argument has the wrong type", which is true but tells them nothing
they can act on.

**Changes required.**

- `stdlib.md` 14.2, the paragraph beginning "**`fill`'s first two arguments are
  plot handles, not series.**": change "An expression in either position is
  OS3011, with the fix naming the plot to declare." to name OS3020 instead.
- `feature-matrix.md` section 24, the row "An expression as a fill edge": change
  the What-it-is cell to say OS3020, and change the Section cell from
  `` `errors.md` OS3011 `` to `` `errors.md` OS3020 ``. Leave the test identifier
  `unit:fill/expression-rejected` alone. This row is also what gives OS3020 a
  matrix row, so defect 18 needs no second row for it.
- `examples/01-ema-cross.oscript`, the comment ending on line 32: change
  "expression in either position is OS3011" to OS3020.
- `examples/README.md`, the bullet "**`fill` names two plots, not two
  expressions.**": change OS3011 to OS3020 in the same sentence.

---

## 3. (B3) signal's at = "auto" is not implementable

**Question.** Where does a marker sit when `at` is `"auto"`, and how do `"auto"`
and `"price"` reach a compiled `markers[].position` that admits only `"above"`,
`"below"` and `"at"`?

**Decision.** `"auto"` is removed. `at` takes `"above"`, `"below"` or `"price"`,
and its default is `"above"`, which is what the old rule did for every text it
could not classify. The compiled field takes the same three spellings: what 2.8
calls `"at"` is renamed `"price"`, so source and format use one vocabulary and
there is no mapping table to keep in step. `at`, `shape` and `color` on `signal`
are part of the marker's declaration, which is fixed before bar 0, so each must
be a compile-time constant: a literal, arithmetic over literals, or an `input()`.
A bar-dependent one is OS3003. The marker's `text` is unaffected and stays
per bar on its channel.

**Why.** "The text suggests a sell" is not a rule an engine can implement, so two
conforming engines would place the same marker differently, and determinism wins.
The position cannot be folded at compile time either, because the text is a
per-bar expression in two of the twelve examples, so the choice is between
inventing a per-bar position channel for a fixed field and deleting the value
that needed it. Deleting it costs one default and no script in the repository.

**Changes required.**

- `stdlib.md` 14.3, the `signal` row of the table: the signature becomes
  `signal(text, color = none, at = "above", shape = "label")`. The removal of
  `size` is decision 4.
- `stdlib.md` 14.3, the paragraph beginning "`signal` is the whole of shape
  plotting": replace the sentence listing `at`'s four values with one naming
  `"above"`, `"below"` and `"price"`, and delete the sentence beginning "With
  `at = "auto"`". Add one sentence: "`at`, `shape` and `color` are part of the
  marker's declaration and are fixed before bar 0, so each must be a compile-time
  constant, a literal or an `input()`; a bar-dependent one is OS3003. Only the
  text is read per bar."
- `compiled-program.md` 2.8, `markers[]` table, the `position` row: the accepted
  values become `"above"`, `"below"` or `"price"`.
- `compiled-program.md` 12.2: no change. The worked example's `"position":
  "above"` is now the declared default rather than a folded `"auto"`.
- `feature-matrix.md` section 23, the row "Signal placement and shape": rewrite
  the What-it-is cell as "`at` takes `"above"`, `"below"` or `"price"` and
  `shape` takes ten values; both are compile-time constants, because the marker's
  declaration is fixed before bar 0", and add `` `compiled-program.md` 2.8 `` to
  the Section cell.
- `errors.md` OS3003: see decision 9, which broadens this entry's cause once for
  defects 3, 4 and 9 together.
- No example file changes. No `signal` call in the twelve examples passes `at`.

---

## 4. (S1) signal's shape and size have no compiled home

**Question.** Where do `signal`'s ten shapes and its `size` argument live in the
compiled program, which admits five shapes and has no size field at all?

**Decision.** The compiled format widens to the library's ten shapes: `"label"`,
`"arrowUp"`, `"arrowDown"`, `"triangleUp"`, `"triangleDown"`, `"circle"`,
`"square"`, `"diamond"`, `"cross"` and `"flag"`. `size` leaves the signature. A
one-value enumeration is not a feature, nothing stores it, and inventing a
five-step size vocabulary plus a field to carry it would be inventing machinery
to carry a value no script in the repository writes. A later language version may
add it with the field that holds it, which `language.md` 4.1 permits.

**Why.** `stdlib.md` is the authority about a function's arguments, and the chart
contract already carries the wider shape set, so the format widens rather than
the library shrinking. The opposite is true of `size`: the source says a word the
contract has no room for, and the honest repair is to stop saying it.

**Changes required.**

- `compiled-program.md` 2.8, `markers[]` table, the `shape` row: replace the five
  values with the ten above, in that order.
- `stdlib.md` 14.3, the `signal` row: drop `size = "normal"` from the signature.
  The result, with decision 3, is
  `signal(text, color = none, at = "above", shape = "label")`.
- `feature-matrix.md`, the preamble section "Two documents that disagree, and
  which one is right": delete the whole "**The marker enumeration.**" paragraph.
  It is settled here and the documents no longer disagree. Leave the "**Object
  lifetime.**" paragraph in place: it is a different disagreement and is still
  open.
- `feature-matrix.md` section 23, the three-line note after the table beginning
  "`compiled-program.md` section 2.8 still carries the narrower marker
  enumeration": delete it.

---

## 5. (S2) Three different lists of the bar state the host supplies

**Question.** Which bar facts does the host state and which does the engine
derive, given three lists of four, four and five?

**Decision.** The host states four facts about the execution: `bar.isNew`,
`bar.isConfirmed`, `bar.isRealtime` and `bar.updates`. The engine derives four
from the dataset and the position in it: `bar.index` is the position, `bar.count`
is `bar.index + 1`, `bar.isFirst` is `bar.index == 0`, and `bar.isLast` is true
when `bar.index` is the greatest index the host has supplied. `compiled-program.md`
5.2 is already right and does not change; the other two lists change to match it.

**Why.** A fact the engine can compute must not also be stated by the host, or
the two can disagree and no rule says which wins. `bar.isFirst` is defined as a
derivation in `language.md` 7.2, and `bar.isLast` is a property of the bar array
rather than of the update, so both belong on the derived side.

**Changes required.**

- `compiled-program.md` 5.2: no change to the row "Bar state: is this bar new,
  confirmed, realtime, and the update count". Do not "fix" it.
- `compiled-program.md` 2.10, the `"bar"` register field table: replace the row
  `| `bar.isFirst`, `bar.isLast`, `bar.isConfirmed`, `bar.isRealtime`, `bar.isNew` | Booleans the host states |`
  with two rows:
  `| `bar.isConfirmed`, `bar.isRealtime`, `bar.isNew` | Booleans the host states for this execution |`
  and
  `| `bar.isFirst`, `bar.isLast` | Derived by the engine: `bar.index == 0`, and `bar.index` is the greatest index the host has supplied |`.
  Leave the `bar.updates` row as it is.
- `stdlib.md` 3.3, the closing sentence beginning "These land in the contract's
  calculation context": replace "the host supplies the same four facts (new,
  confirmed, realtime, last index)" with "the host supplies four facts about the
  execution (new, confirmed, realtime and the update count) and the engine
  derives the other four from the dataset and the bar's position in it".
- `stdlib.md` 18, the contract map row that reads
  `| `bar.isNew`, `bar.isConfirmed`, `bar.isRealtime`, `bar.isLast` | the calculation context's bar state |`:
  replace `bar.isLast` with `bar.updates`.
- `language.md` 7.2, under the `bar` namespace table: add one sentence naming the
  four the host states and the four the engine derives, with a pointer to
  `compiled-program.md` 5.2.

---

## 6. (S3) Four chart facts have no source

**Question.** Where do `chart.pointValue`, `chart.currency`, `chart.instrumentType`
and `chart.hasVolume` come from, when the engine reads everything from the host
and the host's list holds six instrument facts?

**Decision.** The host's instrument record supplies ten facts: symbol, exchange,
interval, timezone, tick size, lot size, point value, currency, instrument type
and whether the instrument has volume. The engine derives two from the interval:
`chart.intervalMinutes` and `chart.isIntraday`. Each supplied fact is absent when
the host does not state it, on the same ground as tick size, except
`chart.hasVolume`, which is a boolean the host must state because
`stdlib.md` 3.1 makes an absent volume and a zero volume different facts and no
derivation can tell them apart.

**Why.** A script cannot read a fact nobody supplies, so the host list is what has
to widen. Deriving the interval's two conveniences rather than supplying them
keeps them from disagreeing with the interval string they describe.

**Changes required.**

- `compiled-program.md` 5.2, the row "Instrument facts: symbol, exchange,
  interval, timezone, tick size, lot size": extend the list with point value,
  currency, instrument type and whether the instrument has volume.
- `compiled-program.md` 5.2, after the table: add one sentence saying that
  `chart.intervalMinutes` and `chart.isIntraday` are derived from the interval
  string rather than supplied, and that every supplied fact except the volume
  flag is absent when the host does not state it.
- `stdlib.md` 3.4, after the sentence about `chart.tickSize`: add one sentence
  naming the ten facts the host supplies and the two the engine derives, with a
  pointer to `compiled-program.md` 5.2.
- No change to `errors.md` OS6012. It covers a fact a call needs and cannot
  default, which is a different question from what a bare read returns. The
  tension between the two is recorded at the end of this file.

---

## 7. (S4) A colour's alpha has two representations and no conversion rule

**Question.** How does an alpha of 0 to 1 become one of the four integer channels
that `conformance.md` 6 compares, and what rounds the fractional channels that
`mix()` produces?

**Decision.** The machine value is unchanged: red, green and blue are whole
numbers from 0 to 255 and alpha is a binary64 number from 0 to 1. Two rules close
the gap.

1. **Every library call that computes a colour rounds red, green and blue to a
   whole number before returning**, with the language's own rounding, halves away
   from zero (`stdlib.md` 8.1). The invariant in `compiled-program.md` 3.1 then
   holds of every colour anywhere, not only of literals.
2. **At the contract boundary the alpha becomes a byte as
   `round(alpha * 255)`**, the same rounding. That byte is the `aa` of the
   `#rrggbbaa` spelling, and that spelling is what the conformance suite
   compares.

The conversion is one way and is not a round trip: `#ff880080` parses to
128 divided by 255, and `fade(aqua, 88)` is an alpha of 0.12 which serialises to
`1f`, which reads back as a different number. Nothing in the language observes
the difference, because a script reads alpha with `alpha()` from the machine
value and never from the wire form.

**Why.** Two engines could otherwise land on 30 and 31 for the same colour and
both be conforming, which is the definition of a rule that is wrong. Rounding at
the call rather than only at the boundary means the value model has one
invariant instead of an exception for everything `mix()` returns.

**Changes required.**

- `stdlib.md` 11.2, after the construction table: add a paragraph stating rule 1
  above, naming `round` and `mix` explicitly, and stating rule 2 with the worked
  numbers for `fade(aqua, 88)`.
- `compiled-program.md` 3.1, the `color` row's rules: add a bullet stating the
  invariant (whole channels, binary64 alpha) and the byte conversion of rule 2,
  and that the conversion is one way.
- `conformance.md` section 6, the Colour row of the "Everything that is not a
  number" table: change the cell to read "Four integer channels 0 to 255, each
  exactly, after the alpha has been converted to a byte by the rule in
  `compiled-program.md` 3.1. A colour is stored as `#rrggbbaa` so there is one
  spelling of any colour".
- `conformance.md` section 4, the sentence in the `expected.csv` description
  reading "A colour is written `#rrggbbaa`, always eight hex digits, always lower
  case": add "after the alpha conversion of `compiled-program.md` 3.1".
- `feature-matrix.md` section 19, after the row "`mix(a, b, weight)`": add
  `| Channel rounding | Colour-producing calls round red, green and blue with the language's own rounding, and the alpha becomes a byte as round(alpha * 255) at the contract boundary | `specified` | `stdlib.md` 11.2, `compiled-program.md` 3.1, `conformance.md` 6 | `color/channel-rounding` |`.

---

## 8. (S5) The worked "for x in arr" listing does not terminate

**Question.** Where should the two `JUMP_FALSE` instructions of the `for x in arr`
listing jump to?

**Decision.** To instruction 25, the instruction after the loop. Both currently
target 24, which is the backward `JUMP` to the top of the loop, so the listing as
printed is an infinite loop. Nothing else in the listing changes: 24 stays
`["JUMP", 5]`, which lands on the `TICK` at 5 and satisfies the verifier's rule
that the target of every backward jump is a `TICK`.

**Why.** It is a transcription error in a listing a compiler writer will copy, and
the rest of the section is right: `break` is described as a forward jump to the
instruction after the loop, which is 25.

**Changes required.**

- `compiled-program.md` 4.8, the `for price in prices` listing: instruction 9
  becomes `["JUMP_FALSE", 25]` and instruction 14 becomes `["JUMP_FALSE", 25]`.
  No other line of the listing changes.

---

## 9. (S6) An input used as a fixed-shape option value has nowhere to go

**Question.** How does `study("Range", precision = input(2, ...))`, which
`language.md` 13.2 and the OS3003 entry both admit, reach a `meta` that carries
every option as its effective value?

**Decision.** A field of `meta`, or of any declaration in `outputs`, may hold
either a literal value as today or the object `{ "input": "<key>" }`, naming an
entry of `inputs[]` by its `key`. The engine resolves inputs once at load, in the
order of section 2.6, and substitutes the resolved value for every such reference
before it builds the descriptor. The referenced key must exist and its resolved
value must satisfy the field it lands in; a failure is OS6019, the same code as
any other unusable setting, because the value came from outside the source.

**Why.** The source document wins on what a script may express, and three places
already say a script may express this: `language.md` 13.2, the OS3003 entry whose
whole fix is "make it an input", and `stdlib.md` 13.4, which tells a script to
declare a colour input and pass it to a plot. A settings value is fixed for the
whole run, so the reference costs one substitution at load and nothing per bar.
The alternative, forbidding it, would delete a tunable precision, a tunable table
corner and a tunable plot colour, and would leave OS3003 with no fix to name.

**Changes required.**

- `compiled-program.md` 2.3, after the paragraph beginning "A study program
  carries no `strategy` object": add a paragraph defining the
  `{ "input": "<key>" }` form, saying which fields may hold it (every field of
  `meta`, of `meta.strategy`, and of every declaration in `outputs`, other than
  `kind`), and saying it is resolved at load after inputs and never per bar.
- `compiled-program.md` 2.8, after the `tables[]` table: add one sentence saying
  that a declaration field which a script wrote from an `input()` carries the
  reference form of 2.3, naming `tables[].position` and `plots[].color` as the
  two a script reaches for.
- `compiled-program.md` 3.5, the list of load-time checks: add a check that every
  `{ "input": ... }` reference names a declared input whose resolved value is
  admissible in that field, failing with OS6018 for a key that does not exist and
  OS6019 for a value the field refuses.
- `compiled-program.md` 5.1: no change to the eleven steps. Add one sentence
  after the list saying that input resolution and reference substitution happen
  at load, before step 1 of bar 0, so the descriptor exists before the first bar.
- `errors.md` OS3003 (and the `cause` and `spec` fields of the entry in
  `errors.json`): broaden **Cause** to say that the rule covers not only the
  declaration's options but every argument that lands in a declaration fixed
  before bar 0, naming `signal`'s `at`, `shape` and `color`, `table`'s
  `position`, `rows` and `cols`, and a plot's style arguments; and that an
  `input()` is a constant for this purpose because it is resolved before bar 0.
  Add `language.md` 15.3 to the **Reference** list. Do not change the message,
  the placeholders, the fix or the example.
- `feature-matrix.md` section 13, after the row "Non-constant default": add
  `| An input as an option value | A fixed-shape option may be written with an input(), and the compiled program carries the reference until the engine resolves inputs at load | `specified` | `language.md` 13.2, `compiled-program.md` 2.3, `errors.md` OS3003 | `input/option-from-input` |`.
- No example file changes. `examples/08-dashboard-table.oscript` line 23,
  `table(position = corner)` with `corner` an input, is correct under this rule.

---

## 10. (S7) An input's default has two encodings and one type it cannot express

**Question.** Is an input's compiled `default` a constant pool value form or a
bare value, and what form does a source input's default take when the pool has no
tag for a series?

**Decision.** The `[tag, value]` form of 2.6 is the rule and the worked example is
wrong. For a `"source"` input the default is `["s", "<field>"]`, naming one of the
eight built-in series a source input may select: `open`, `high`, `low`, `close`,
`hl2`, `hlc3`, `ohlc4`, `volume`. The `kind` field is what says the string names a
series rather than holding one, so no new pool tag is added. The engine resolves
the name to the matching `"bar"` register and writes that register's current value
into the input's slot at step 5 of every bar; where the program reads the input's
history it gets a `"computed"` register like any other top-level name.

**Why.** One encoding beats two, and the compiled format's own rule is the one
that already covers every other kind. A new tag for the one kind whose default is
a name rather than a value would put a value in the pool that no instruction can
push.

**Changes required.**

- `compiled-program.md` 12.2, the `inputs` array of the worked program: change
  `"default": 2` to `"default": ["n", 2]`.
- `compiled-program.md` 2.6, after the field table: add a paragraph stating the
  source case above, listing the eight admissible names, and stating how the slot
  is filled per bar and where history comes from.
- `compiled-program.md` 2.9: no change. No tag is added.
- `feature-matrix.md` section 13, the row "Source input": add
  `` `compiled-program.md` 2.6 `` to the Section cell.

---

## 11. (M1) Plot style token drift

**Question.** Is the style with markers spelled `"lineWithMarkers"` or
`"line-markers"`?

**Decision.** `"lineWithMarkers"`, in both documents. The compiled format changes.
No mapping table: a mapping is a second thing to keep in step, and the other five
values in the same enumeration are already identical in both places.

**Why.** The hyphenated spelling is the odd one out in the compiled format itself,
which writes `"topLeft"` and `"bottomRight"` elsewhere, so the format loses
nothing by matching the library, and the library is the spelling a script author
types.

**Changes required.**

- `compiled-program.md` 2.8, `plots[]` table, the `type` row: change
  `"line-markers"` to `"lineWithMarkers"`.
- `feature-matrix.md` section 23, the row "Plot styles": no change. Its claim that
  both documents carry the same closed set becomes true.

---

## 12. (M2) Input kind token drift

**Question.** Is a boolean input's kind `"boolean"` or `"bool"`, and is a free
text input's kind `"text"` or `"string"`?

**Decision.** `"bool"` and `"string"`, in both documents. `stdlib.md` changes. The
`kind` string is the contract a host reads to build a settings row, the compiled
format is where that contract is written down, and its other seven values already
match the library's own words.

**Why.** Same reason as decision 11, pointing the other way: whichever document
owns the token that crosses the boundary keeps its spelling, and here that is the
compiled format.

**Changes required.**

- `stdlib.md` 13.1, the "Lands in" column: in the `bool` row change "a `boolean`
  input" to "a `bool` input"; in the free text row, the `"symbol"` row and the
  `"session"` row change "a `text` input" to "a `string` input". Four cells, no
  other change.
- `feature-matrix.md` section 13: no change. The rows "Bool input" and "String
  input" already use these words.

---

## 13. (M3) errors.md renders a stage vocabulary that errors.json does not hold

**Question.** How can part 8 be rendered from `errors.json` when it prints
"lexer", "parser", "checker" and "engine" where the file holds `lex`, `parse`,
`check` and `runtime`?

**Decision.** The rendered words are a label, not a second vocabulary, so the
label moves into the file the render reads. `errors.json` gains a `stageLabels`
object mapping each stage to the word part 8 prints: `lex` to "lexer", `parse` to
"parser", `check` to "checker", `runtime` to "engine", `host` to "host". The 136
per-code sections keep the words they print. This is a new field rather than a
change to the existing `stages` object, so `schemaVersion` does not move, by that
field's own rule.

**Why.** The alternative, printing the raw token in 136 places, reads badly in
prose ("Stage lex.") and buys nothing. A mapping is acceptable here, and not in
decisions 11 and 12, because this one is a rendering of a single stored value
rather than two stored spellings of the same token: there is still exactly one
place a stage is recorded.

**Changes required.**

- `errors.json`: add a top-level `stageLabels` object with the five pairs above,
  immediately after `stages`. Change nothing else.
- `errors.md` 1, the field table of the file's shape: add a row
  `| `stageLabels` | object | The word each stage is printed as in part 8 |`
  after the `stages` row.
- `errors.md` 8, in the preamble sentence before the catalogue begins: add one
  sentence saying that each section prints the stage's label from `stageLabels`,
  with the five pairs written out, and that the entries themselves carry the
  token.

---

## 14. (M4) plot's colour default is unspecified while the compiled field is required

**Question.** What colour does a plot have when the script names none, given that
`stdlib.md` 14.2 writes the default as `color = ...` and `compiled-program.md` 2.8
makes `plots[].color` required and non-nullable?

**Decision.** The default is `none`, and `plots[].color` becomes nullable. Null
means the script named no colour, and the host assigns one from the same palette
it already uses to fill the generated style rows of `stdlib.md` 13.4. Passing
`none` explicitly is the same thing as omitting the argument.

**Why.** Naming a fixed colour such as `aqua` as the default would draw every
undecorated plot of a three plot study in one colour, and the host already owns
the style row for exactly this reason, so this is a host choice the language
permits rather than an unspecified corner: no computed value depends on it, and
the conformance suite asserts columns, markers, fills, levels and paint, never a
plot's default style colour.

**Changes required.**

- `stdlib.md` 14.2, the `plot` row: write the default as `color = none` in the
  signature, and add one sentence after the paragraph "**A constant colour and a
  per-bar colour are the same argument.**" saying that an omitted or absent
  colour leaves the plot's colour to the host's palette, the same palette that
  fills the style row of 13.4.
- `compiled-program.md` 2.8, `plots[]` table, the `color` row: change the type to
  `color?` and the meaning to "Default colour, or null when the script named
  none, in which case the host assigns one from its own palette".
- `feature-matrix.md` section 23, the row "Width and colour": extend the
  What-it-is cell with "and an omitted colour is null in the compiled program,
  which hands the choice to the host's palette", and add
  `` `compiled-program.md` 2.8 `` to the Section cell.

---

## 15. (M5) language.md is silent on a negative step and on an absent bound

**Question.** What does `for i = 5 to 9 step -1` do, and what happens when a bound
is absent, in a document that says nothing is left implementation defined?

**Decision.** The body does not run when the step is positive and the start is
above the end, or when the step is negative and the start is below the end. The
range is never silently reversed in either direction. An absent start, end or
step is OS4013 and stops the bar; it is not zero iterations.
`compiled-program.md` 4.8 already settles both correctly, and `language.md` 10.3
is the document that is missing them.

**Why.** Example 09 walks a descending loop over an empty array on every bar
before the first zone exists, so the negative-step case is not a corner: it is the
first bar of a shipped example. An absent bound is an error rather than zero
iterations because a loop that silently does nothing during warmup leaves a plot
that looks computed.

**Changes required.**

- `language.md` 10.3, the paragraph beginning "`step` defaults to `1`": extend
  the sentence about a positive step to cover the negative one in the same
  breath, and add a sentence saying an absent start, end or step is OS4013 rather
  than a loop that does not run. Cite `compiled-program.md` 4.8 for the compiled
  form.
- `feature-matrix.md` section 9, the row "Non-reversing loop": change the
  What-it-is cell to cover both signs, and add `` `compiled-program.md` 4.8 `` to
  the Section cell. The row "Absent loop bound" needs no change once
  `language.md` 10.3 names OS4013.

---

## 16. (M6) "or" is not commutative

**Question.** Should `none or true` be `none`, as both documents say, or `true`?

**Decision.** `true`. The single cell is wrong and changes; `or` becomes
commutative and De Morgan's laws hold again. `language.md` 6.6 defines the
three-valued logic with `none` meaning "unknown", and under that meaning
`none or true` has exactly one answer: whichever value the unknown operand turns
out to hold, the result is true. Every other cell of both tables is already
right. The consequence for the machine is that `or` mirrors `and` exactly:
`OR_SHORT` jumps only when the left operand is `true`, and a new `OR` instruction
combines the two values otherwise. The instruction set becomes forty-one
instructions.

**Why.** The table contradicts its own document's stated reading of `none`, and
the surprise is not one a reader can predict: `if isNone(x) or x > 5` and
`if x > 5 or isNone(x)` are the same sentence to a reader and, today, different
programs. The language argues in 6.4 that it propagates absence through
comparison precisely to keep `not (a > b)` equal to `a <= b` for every input;
keeping that identity and losing De Morgan's is not a position the document can
hold. The cost is one opcode in a format that has not shipped, and no example in
the repository relies on the old cell.

**Changes required.**

- `language.md` 6.6, the truth table: in the row where `a` is `none` and `b` is
  `true`, change `a or b` from `none` to `true`. No other cell changes. Add a
  sentence after the table saying that both operators are commutative and that
  absence is absorbed exactly when the other operand decides the answer alone.
- `language.md` 9.4: add one sentence saying that `or` evaluates its right
  operand when the left is absent, because a `true` on the right decides the
  answer, and that `and` does so for the mirror reason.
- `language.md` 17: append an entry to the end of the surprises list, as entry 21,
  so no existing number moves. It reads that `and` and `or` are three-valued with
  `none` meaning unknown, that an operand is evaluated whenever it can still
  decide the answer, and that both operators are commutative. (Section 6.6.)
- `compiled-program.md` 4.7: add an `OR` row to the opcode table with stack
  `a b -> v`; change `OR_SHORT`'s effect to "If the top value is `true`, jump to
  `t` leaving it in place"; add the disjunction table beside the conjunction one;
  replace the `a or b` listing with the mirror of the `a and b` listing
  (`<a>`, `["OR_SHORT", 4]`, `<b>`, `["OR"]`), so the `POP` is no longer part of
  it; and replace the paragraph beginning "There is no `OR` instruction" with one
  explaining that the two operators are symmetric because absence on either side
  still lets the other side decide.
- `compiled-program.md` 4.13: add the `OR` row after `AND`, with depth `-1`,
  group Logic; change "Forty instructions" to "Forty-one instructions".
- `compiled-program.md` 13, the machine checklist: change "Implements all forty
  instructions of section 4" to forty-one.
- `feature-matrix.md` section 5, the row "Three-valued logic": extend the
  What-it-is cell with "both operators commutative", and add
  `` `compiled-program.md` 4.7 `` to the Section cell. The row "Short circuit"
  needs no change.
- No example file changes. No example in the repository depends on the old cell.

---

## 17. (M7) A third placement list

**Question.** Which calls are top level only, and where does `clear` belong?

**Decision.** Five calls are top level only: `plot`, `plotCandles`, `fill`,
`level` and `table`, which is what `errors.md` OS3006 already says. `plotCandles`
declares a column and returns a `plot` handle, so it can be nowhere else, and the
two lists that omit it are wrong. `clear` goes on the anywhere list, in both its
forms: `clear(t)` empties a grid per bar and `clear(arr)` is an array operation.

**Why.** Three lists of the same fact is two lists too many, and the one attached
to the error code is the one a reader arrives at holding a diagnostic.

**Changes required.**

- `language.md` 15.3, the top-level-only sentence: add `plotCandles` to the list,
  keeping OS3006 and OS3007 as they are. In the anywhere sentence, add `clear`
  after `cell`.
- `stdlib.md` 14.1, the first sentence: add `plotCandles` to the list of four.
  In the second paragraph, add `clear` to the list that begins "`signal`,
  `alert`, `barColor`, `background`, `cell`, `print`".
- `errors.md` OS3006: no change. It is right as written.

---

## 18. (M8) Seven catalogue entries have no feature-matrix row

**Question.** Which rows are missing, and where do they go?

**Decision.** Six rows are added. OS3020 needs no row of its own: decision 2
changes the existing fill row to cite it, which is the citation whose absence
caused the defect. Each row below is `specified`, cites a heading that exists, and
carries an identifier that appears nowhere else in the file.

**Why.** A code with no row is a code no test is planned for, and OS3020 was the
case that proved it: the matrix could not cite a code no row named, so the stale
citation survived.

**Changes required.**

- `feature-matrix.md` section 1, after the row "Continuation by trailing token":
  `| A continuation with nothing after it | OS1022, naming the token the statement ended on, because a trailing operator promised a right-hand side | `specified` | `language.md` 3.11, `errors.md` OS1022 | `unit:lex/continuation-incomplete` |`
- `feature-matrix.md` section 14, after the row "Element types":
  `| A type that cannot be an array element | OS2019, the refinement of OS2016 for a declaration handle, a series or an array of arrays | `specified` | `language.md` 14.1, `language.md` 5.4, `errors.md` OS2019 | `unit:array/element-type-rejected` |`
- `feature-matrix.md` section 4, after the row "Handle in an argument that does
  not take one":
  `| A handle where a runtime object belongs | OS3019, the refinement of OS3011 for an argument that takes a line, label, box, polyline or table | `specified` | `language.md` 5.4, `errors.md` OS3019 | `unit:obj/handle-in-object-argument` |`
- `feature-matrix.md` section 33, after the row "What the host supplies":
  `| No bars supplied | OS6010, because a script cannot run over nothing and an empty pane with no message is indistinguishable from a study that drew nothing | `specified` | `compiled-program.md` 5.2, `errors.md` OS6010 | `unit:prog/no-bars` |`
  and
  `| Bars out of order | OS6011 naming the first bar whose time does not follow the one before it, because an engine may not reorder what it is given | `specified` | `compiled-program.md` 5.2, `errors.md` OS6011 | `unit:prog/bars-out-of-order` |`
- `feature-matrix.md` section 26, after the row "Deletion and counting":
  `| A deleted object still held | OS8019, warning that a name or an array still refers to an object deleted earlier, because a stale handle in a setter is OS4005 one bar later | `specified` | `language.md` 5.4, `errors.md` OS8019 | `unit:draw/deleted-still-held` |`

  When this was decided nothing raised OS8019, because the checker did not
  follow a reference to a deleted object. It does since issue 0006's two
  neighbours were closed, and the row is `implemented`.

---

## 19. (M9) The README credits a script that does not write "color ="

**Question.** Which example scripts demonstrate a reserved word as a named
argument label?

**Decision.** Scripts 4 and 9. Script 8's named arguments are `overlay`, `min`,
`max`, `options`, `rows`, `cols`, `position`, `textColor` and `bgColor`, none of
which is a reserved word. Fix the sentence rather than the script: script 8 is
about a grid, and adding a colour argument to make a sentence true would be
writing the example to fit the prose.

**Why.** A claim about which file demonstrates a rule is checkable by reading the
file, and a reader who checks and finds nothing stops trusting the rest of the
page.

**Changes required.**

- `examples/README.md`, the bullet "**`color` is a reserved word and also an
  argument name.**": change "Scripts 4, 8 and 9 write `color =` on that rule" to
  "Scripts 4 and 9 write `color =` on that rule". Leave the rest of the sentence,
  including the clause about `min =` and `max =`, as it is.

---

## 20. (M10) Two library citations are in the wrong order

**Question.** In "vwap and variance are library names (stdlib 6 and 7)", which
name goes with which section?

**Decision.** `variance` is `stdlib.md` section 6 and `vwap` is section 7, so the
names are reordered to match the citations rather than the other way round, which
keeps the ascending section numbers the reader expects to scan.

**Why.** It is a comment in an example whose whole subject is that a script may
not take a name the library owns, so a reader who follows the citation to check
lands in the wrong section.

**Changes required.**

- `examples/03-anchored-vwap.oscript`, the comment on line 40: change "vwap and
  variance are library names (stdlib 6 and 7)" to "variance and vwap are library
  names (stdlib 6 and 7)". No other change to the comment or the script.

---

## 21. (M11) fade does not say whether it sets alpha or multiplies it

**Question.** Is `fade(fade(aqua, 50), 50)` the same as `fade(aqua, 50)` or
`fade(aqua, 75)`?

**Decision.** The same as `fade(aqua, 50)`. `fade` sets the alpha absolutely:
`fade(c, p)` is `withAlpha(c, (100 - p) / 100)`, exactly, whatever alpha `c`
already carried. The entry's own words, "the same colour at `percent`
transparency", are the rule; the prose that calls it "lowers a colour's alpha" is
a loose description and changes.

**Why.** `fade` and `withAlpha` are two spellings of one operation in two
conventions, and the identity above is the whole of the difference. A
multiplicative `fade` would break that identity, would make `fade(c, 0)` a call
that does nothing rather than a call that makes the colour opaque, and would make
the value of a faded colour depend on how many times it had been through the
function.

**Changes required.**

- `stdlib.md` 11.2, the paragraph beginning "`fade` takes transparency, not
  opacity": add the identity `fade(c, p)` is `withAlpha(c, (100 - p) / 100)` and
  say in the same sentence that the alpha is set rather than scaled, so nesting
  two fades is the inner call's alpha replaced by the outer one's.
- `language.md` 3.8, the sentence listing the colour functions: change "`fade(color, percent)`
  which lowers a colour's alpha" to "`fade(color, percent)` which sets a colour's
  alpha from a percentage of transparency".
- `feature-matrix.md` section 19, the row "`fade(color, percent)`": extend the
  What-it-is cell with "and it sets the alpha rather than scaling it, so nesting
  two fades is the outer one".

---

## 22. (M12) Examples in the specification declare names the library owns

**Question.** Should the specification's own examples be renamed to obey OS2002,
or should the rule bend for them?

**Decision.** Rename the examples. Option 1 of `issues/0001` is taken as it
stands: the library keeps the short name and the example takes a longer one. The
issue lists four sites; the check finds seven in `language.md`, and the three it
did not list are the same defect. It also finds thirteen more in `errors.md`,
which is a second file and a second edit, because each of those examples lives in
`errors.json` as well. The `spec` entry is added to `SOURCES` in
`scripts/check-examples.mjs` only after both files are done, and that edit is the
last one of this defect.

**Why.** These are the examples a reader meets first, and a reader who copies one
meets OS2002 on the first compile with the specification's own line named as the
mistake. Renaming the library instead would move `change`, `count` and `highest`
out of the scope that should hold the short name, and allowing shadowing is the
bug 12.3 exists to prevent.

**Changes required.**

- `language.md` 3.10, both fenced examples that end with `low = 0`: rename that
  name to `base` in both. `low` is a built-in series.
- `language.md` 3.10, the fenced example containing
  `fn change(src) => src - src[1]`: rename the function to `barChange`.
- `language.md` 5.2, the fenced example containing `fn change(src) => src - src[1]`
  and `plot(change(hlc3), "Change", aqua)`: rename the function to `barChange` in
  both lines. Leave the plot title "Change" as it is: a title is a string, not a
  name.
- `language.md` 8.1, the fenced example whose two lines are `count = count + 1`
  and `count = count[1] + 1`: rename to `barCount` throughout, including the
  sentence below the block that reads "`count[1]` is `none` on bar 0".
- `language.md` 7.5, the "Rollback" example: rename `count` to `barCount` in all
  three lines.
- `language.md` 8.2, the first `var` example: rename `count` to `barCount` in both
  lines, and rename `highest` to `runningHigh` in all three lines of the second
  half of the same block.
- `language.md` 11.4, the `barsSince` example: rename the function to `sinceTrue`
  in the declaration and in both call sites. `barsSince` is `stdlib.md` 9.
- `errors.md` and `errors.json`, eight entries, each in both files and in both
  `before` and `after` where the name appears: OS1009 renames the parameter
  `level` to `mark`; OS1011 renames `highest` to `runningHigh`; OS2005 renames the
  local `sum` to `runningTotal`; OS4012 renames `order` to `sortOrder`; OS5008
  renames `log` to `logLines`; OS8011 renames `count` to `barCount`. Where the
  entry's **Cause** or **Fix** prose repeats the name, rename it there too.
- `issues/0001-spec-examples-shadow-builtins.md`: record this decision, replace
  the four-row table with the full list above, and set Status to closed once the
  three edits below have landed.
- `scripts/check-examples.mjs`: add `'spec'` to `SOURCES` and delete the comment
  block above it that explains why `spec` is absent. **This edit comes last**, after
  the `language.md` and `errors.md` renames, or the build fails in between.
- None of the replacement names above is in the global scope: they were checked
  against the same list the checker builds from `stdlib.md` and `language.md`.

  **Not raised yet.** OS4012 is in the catalogue and nothing raises it: a
  computed name outside the accepted set produces absence on every bar, and only
  a name written as a literal is refused, with OS3008.

---

## What the verifier got wrong or did not reach

- **B3, the example 12 citation.** Line 92 of
  `examples/12-strategy-short-premium.oscript` passes a per-bar ternary as
  `signal`'s **text**, not as its `at`. The conclusion stands and is the reason
  `"auto"` cannot be folded, since `"auto"` reads the text, but the line does not
  show a per-bar `at`. Example 02 line 65 is the same shape.
- **M6 is not a documentation defect.** The verifier filed it as a missing
  warning in the surprises list. The table itself is wrong: it contradicts its own
  document's definition of `none` as "unknown", and decision 16 changes the cell
  and adds an instruction rather than documenting the anomaly.
- **M12 is larger than the issue says.** The shadowing check, pointed at `spec/`,
  reports 27 declarations: seven in `language.md` against the issue's four, and
  thirteen in `errors.md`, which the issue does not mention at all and which carry
  into `errors.json`. The remaining seven reports are in blocks the checker
  already treats as deliberate.
- **Not on the list: OS6012 against `stdlib.md` 3.4.** The catalogue says that a
  fact the host did not supply, naming tick size and lot size among them, is an
  error, while `stdlib.md` 3.4 says a bare read of `chart.tickSize` is absent and
  `stdlib.md` 8.1 says `roundToTick` returns absence on the strength of it. Both
  cannot be true of the same read. The likely settlement is that OS6012 belongs to
  a call that cannot default the fact, such as a session or calendar call missing
  a timezone, and never to a bare read, but it is a separate question from S3 and
  belongs in an issue of its own rather than being decided here in passing.
- **Not on the list: the object lifetime disagreement** recorded in
  `feature-matrix.md`'s preamble is still open, and decision 4 deliberately leaves
  that paragraph in place while deleting the marker one beside it.

---

## Change index by file

Each file, and the decisions that touch it. The decisions hold the detail.

| File | Decisions |
|---|---|
| `spec/language.md` | 1, 5, 15, 16, 17, 21, 22 |
| `spec/stdlib.md` | 2, 3, 4, 5, 6, 7, 12, 14, 17, 21 |
| `spec/compiled-program.md` | 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 16 |
| `spec/conformance.md` | 7 |
| `spec/errors.md` and `spec/errors.json` | 1, 9, 13, 22 |
| `spec/feature-matrix.md` | 1, 2, 3, 4, 7, 9, 10, 14, 15, 16, 18, 21 |
| `examples/01-ema-cross.oscript` | 2 |
| `examples/03-anchored-vwap.oscript` | 20 |
| `examples/README.md` | 2, 19 |
| `issues/0001-spec-examples-shadow-builtins.md` | 22 |
| `scripts/check-examples.mjs` | 22, last edit of all |

---

# Single sourcing

Decisions 1 to 22 each fixed a contradiction and left the copy that produced it
in place. The count did not fall, because synchronising two copies is not a fix:
two readable copies of one fact drift again the moment either is edited, and
round three proved it twice over when two agents, each obeying its file ownership
exactly, wrote an order status vocabulary and a fill fold independently.

This part does something different. It does not reconcile copies. It assigns each
duplicated fact one home and turns every other appearance into a citation.

**The test.** If a fact changed, would the specification stay true only if two
files were edited? Then one of those two is a copy, and it becomes a citation.

**What a citation is.** A citation names a document and a section and says
nothing about what is in it: "the order status vocabulary of `stdlib.md` section
17.7". A sentence that summarises what it cites is still a copy, because a
summary can be wrong on its own. "the six status words of `stdlib.md` section
17.7" is a copy: it states a count, and the count can go stale.

**How a home is chosen.** Three rules, in this order.

1. `language.md` fixes the shape of the language, so a list of what a script may
   write, and where it may write it, lives there.
2. `compiled-program.md` is the contract a second engine reads, so a
   representation, a field name, a wire value and an encoding live there.
3. Where a fact is about the boundary and nothing else, and never appears in a
   compiled program, `host-interface.md` owns it.

Two clauses that keep the rules workable:

- **The catalogue clause.** `stdlib.md` is the catalogue of callable names, and
  `errors.md` is the catalogue of codes. A catalogue may carry a one-line gloss
  per entry so that it is usable as a catalogue. A gloss is never where a rule is
  stated, it never carries a count or a value set, and where a gloss and its home
  disagree the home wins and the gloss is the defect.
- **The checklist clause.** A conformance checklist (`host-interface.md` 10,
  `compiled-program.md` 13, `conformance.md` 12) may name a duty and cite its
  section. It may not restate the duty's content in different words, because a
  checklist written in different words is the copy that drifts first.

Part one below is the home register. Part two settles the questions that were
hiding inside the duplications, as decisions 23 to 37.

---

## Part one: the home register

Every fact that currently appears in more than one specification document, its
one home, the exact citation every other document uses, and why the home is
where it is.

### H1. The order lifecycle status vocabulary

**Fact.** The words an order's status may take, which of them are terminal, and
which of them a host may send in a frame.

**Home.** `stdlib.md` 17.7.

**Why.** The vocabulary is what `order.status(tag)` returns, and by
`feature-matrix.md`'s own precedence rule `stdlib.md` is authoritative about a
function. The set a script sees is the larger of the two sets (decision 23), so
it is the set that has to be written out once; the host's set is that set with
one word removed, which a column states without a second table.

**Copies to replace.** `host-interface.md` 7.3, the six-row table.

**Citation.** "The status words, and which of them are terminal, are the
vocabulary of `stdlib.md` section 17.7."

### H2. The fold of an order frame

**Fact.** The algorithm that turns a frame into a change to a ledger row and a
settled fill.

**Home.** `stdlib.md` 17.8.

**Why.** The fold can only be written in the field names of the ledger row, which
`stdlib.md` 17.7 owns, and its result is what every `pos`, `leg` and `book` read
reports, which are library functions. It is also declared a conformance area with
vectors of its own, and a conformance area needs its steps numbered in one place.

**Copies to replace.** `host-interface.md` 7.4, the five numbered steps and the
paragraph after them.

**Citation.** "An engine folds a frame exactly as `stdlib.md` section 17.8 folds
one."

### H3. A frame is cumulative, not a delta

**Fact.** Every frame restates the whole life of the order rather than what
changed since the last frame.

**Home.** `host-interface.md` 7.2.

**Why.** It is a duty on the host, about what a host must put in a frame, and it
is about the boundary and nothing else. The fold depends on it but does not
decide it.

**Copies to replace.** `stdlib.md` 17.8, the opening bold sentence;
`host-interface.md` 10.2, the bullet beginning "That a frame may be a partial
restatement" (checklist clause).

**Citation.** "A frame is cumulative, under `host-interface.md` section 7.2."

### H4. The order frame's field set

**Fact.** The named facts a frame carries, and their types.

**Home.** `host-interface.md` 7.2.

**Why.** A frame never appears in a compiled program and never appears in a
script. It is the boundary shape and nothing else.

**Copies to replace.** None today. `conformance.md` 3 acquires one under decision
31 and cites rather than restates.

**Citation.** "The fields of a frame are the ones `host-interface.md` section 7.2
names."

### H5. The order intent's field set

**Fact.** The named facts an intent carries, and their types.

**Home.** `host-interface.md` 7.1.

**Why.** Same as H4, in the other direction.

**Copies to replace.** None, once the `side` and `type` rows cite H13 for their
value sets.

**Citation.** "The fields of an intent are the ones `host-interface.md` section
7.1 names."

### H6. The ledger row's field set

**Fact.** The fields of one row of a strategy's order and fill ledger.

**Home.** `stdlib.md` 17.7.

**Why.** The ledger is the strategy's own state, five library calls read it by
name, and it is not a wire shape. The catalogue of what a script can read is
`stdlib.md`'s.

**Copies to replace.** `host-interface.md` 7.5, the first paragraph, which lists
the row's contents in prose.

**Citation.** "The run keeps the ledger of `stdlib.md` section 17.7."

### H7. The position reference

**Fact.** That every order carries a reference to the position it settles
against, when one is minted, when it ends, and why a late fill settles its own
position rather than the current one.

**Home.** `stdlib.md` 17.7.

**Why.** It is a ledger field and a rule about how fills fold into a position,
both of which live with the ledger. `host-interface.md` carries `positionRef` as
an intent field, which is H5, not this.

**Copies to replace.** `host-interface.md` 7.1, the note beginning "`positionRef`
exists because a flip holds two positions at once".

**Citation.** "`positionRef` is the position reference of `stdlib.md` section
17.7."

### H8. No position is computed against an account position

**Fact.** That a strategy folds its position from its own settled fills only,
that an account position is per instrument and shared, that it is reported as
shared and never divided, and why.

**Home.** `stdlib.md` 17.1.

**Why.** It is the position model of the language, and it is the rule that
`pos.isShared` and the whole of 17.4 rest on.

**Copies to replace.** `host-interface.md` 7.5, the second and third paragraphs;
`host-interface.md` 10.2, the bullet beginning "That the engine tracks an account
position" (checklist clause); `stdlib.md` 17.4, the `pos.isShared` paragraph,
which keeps the entry and cites the rule rather than restating it.

**Citation.** "The engine does not read the account's position, under
`stdlib.md` section 17.1."

### H9. What a strategy trades

**Fact.** One position per leg; a file that declares no leg has exactly one leg,
the instrument its chart is showing; every order names a leg and no order
function takes a symbol.

**Home.** `stdlib.md` 17.1.

**Why.** It is the position model, and `stdlib.md` is authoritative about the
functions that act on it.

**Copies to replace.** `host-interface.md` 9.3, the paragraph "Where version 1
stands"; `feature-matrix.md` 29, the rows "One net position" and "No order takes
a symbol"; `examples/12-strategy-short-premium.oscript` lines 29 to 35;
`examples/README.md` entry 12; `docs/reference/functions/strategy.md` 15 to 22;
`docs/first-strategy.md` 90 and 100; `docs/faq.md` 287. Every one of them is
stale as well as duplicated; decision 25 says what replaces the claim.

**Citation.** "A strategy trades the legs of `stdlib.md` section 17.1."

### H10. The leg declarations and the relative description

**Fact.** `leg.fixed` and `leg.relative`, their arguments, and what each field of
a relative description means.

**Home.** `stdlib.md` 17.6.

**Why.** The description's field names are argument names a script writes, so a
host refusing a resolution has to be able to name the argument the author typed.
One set of words, and the words are the ones in the source.

**Copies to replace.** `host-interface.md` 9.3, the seven-row table.

**Citation.** "A relative contract is described by the fields of `stdlib.md`
section 17.6."

### H11. A relative contract resolves once

**Fact.** That resolution happens once before bar 0, that the resolved identity
is persisted with the run, that a restart re-attaches rather than re-resolves,
that a new expiry is a new run, and that a host which cannot resolve refuses the
run.

**Home.** `host-interface.md` 9.4.

**Why.** Every clause is a duty on the host, about identity at the boundary, and
none of it appears in a compiled program.

**Copies to replace.** `stdlib.md` 17.6, the bold paragraph beginning "A relative
contract resolves exactly once" and the paragraph after it.

**Citation.** "A relative contract resolves once, under `host-interface.md`
section 9.4."

### H12. The trail

**Fact.** That a trail exists, how it is spelled, its arming, its ratchet, and
how it combines with a stop.

**Home.** `stdlib.md` 17.9.

**Why.** A trail is a rule evaluated every bar rather than a price an order rests
at, so it belongs with the protective levels and their evaluation order, not with
the order functions and not in the intent shape.

**Copies to replace.** `host-interface.md` 7.1, the words "its trail and the
trail offset"; `feature-matrix.md` 29, the row "`exit(...)` brackets";
`docs/reference/functions/strategy.md` 111, 177 and the worked call at 186;
`docs/first-strategy.md` 97 and 220.

**Citation.** "A trailing stop is `leg.trail` of `stdlib.md` section 17.9."

### H13. The `side` and `type` value sets

**Fact.** What `side` may be, what `type` may be, and how `type` follows the
prices given.

**Home.** `stdlib.md` 17.2.

**Why.** They are argument value sets of the order functions, written where a
script author reads. 17.2 already fixes the correspondence between the prices
given and the order produced, so the sets belong beside it.

**Copies to replace.** `host-interface.md` 7.1, the `side` and `type` rows and
the note "type follows the prices"; `docs/reference/functions/strategy.md`, the
`order.place` entry.

**Citation.** "`side` and `type` take the values of `stdlib.md` section 17.2."

### H14. Which calls are top level only, and which may appear anywhere

**Fact.** The two placement lists.

**Home.** `language.md` 15.3.

**Why.** Where a script may write a call is a rule of the language's shape, which
is what `language.md` fixes. Decision 17 put it there once already, and a third
list appeared because two other documents kept their own copies.

**Copies to replace.** `stdlib.md` 14.1, both lists and the sentence "This is the
same split as `language.md` section 15.3, stated with both lists complete";
`errors.md` and `errors.json` OS3006, the `{name}` placeholder gloss, which is a
value set and therefore not covered by the catalogue clause.

**Citation.** "The calls that are top level only are the ones `language.md`
section 15.3 lists."

### H15. The namespace list

**Fact.** Which namespaces the library has.

**Home.** `language.md` 15.2.

**Why.** `language.md` 15 states in its own preamble that what it fixes is the
shape of the library, and a closed list of namespaces is that shape.

**Copies to replace.** `stdlib.md` 2.1, the sentence listing twelve namespaces,
which keeps only the rule about when a name is bare and the note that `leg` and
`book` exist only in a `strategy()` file.

**Citation.** "The namespaces are the ones `language.md` section 15.2 lists."

### H16. The instrument record

**Fact.** The facts a host states about the instrument, their types, which is
required, and what a script sees when one is absent.

**Home.** `host-interface.md` 4.1.

**Why.** The record is handed over at the boundary, it never appears in a
compiled program, and 4.1 already carries four columns of per-fact detail that no
other copy carries. This supersedes the placement in decision 6; the substance of
decision 6 is unchanged.

**Copies to replace.** `compiled-program.md` 5.2, the row beginning "Instrument
facts", which becomes one citation and stops enumerating; `conformance.md` 3, the
lead-in to `instrument.json`; `conformance.md` 2, the `instrument.json` row of
the file table; `host-interface.md` 2, the duty 2 row (same document, cites its
own 4.1); `stdlib.md` 3.4, the sentence decision 6 added, which stops naming the
ten and cites 4.1 instead.

**Citation.** "The instrument record is the one `host-interface.md` section 4.1
defines."

### H17. The session

**Fact.** That the session is the host's, its shape, and that the scheduled close
is what `session.isLastBar` rests on.

**Home.** `host-interface.md` 4.3.

**Why.** It is part of the instrument record, so it goes where the record goes.
`stdlib.md` 12.4 keeps the calls that read it, which is the catalogue clause.

**Copies to replace.** `conformance.md` 3, the session line of the defaults,
which keeps the default value and cites 4.3 for the shape; `stdlib.md` 12.4, the
opening sentence, which cites rather than restating where a session comes from.

**Citation.** "The session is the instrument record's session, `host-interface.md`
section 4.3."

### H18. The bar state the host states, and what each fact means

**Fact.** The four facts the host states, the four the engine derives, and the
meaning of each.

**Home.** `language.md` 7.2.

**Why.** It is the per-bar execution model, which `language.md` owns, and
decision 5 already settled the split there. `host-interface.md` 6.4 keeps the
host's obligations, which are duties and not meanings.

**Copies to replace.** `host-interface.md` 6.1, the two tables, which become a
citation plus the host's own obligations; `host-interface.md` 6.2, the phrase
"how many times the bar has been handed over"; `stdlib.md` 3.3, the sentence
"Defined in `language.md` section 7.2 and repeated here so the catalogue is
complete", which becomes a plain citation under the catalogue clause.

**Citation.** "The bar facts, and which of them the host states, are
`language.md` section 7.2's."

### H19. What an engine reads from the host

**Fact.** The closed list of what an engine reads, and that it reads nothing
else.

**Home.** `compiled-program.md` 5.2.

**Why.** It is what a second engine implementer needs in one closed list. The
list stays; what changes is that its instrument facts row cites H16 rather than
enumerating, which is what let the session go homeless.

**Copies to replace.** `feature-matrix.md` 33, the row "What the host supplies",
whose "and nothing else" turns a gloss into a closed list; `host-interface.md` 2,
the duties table, which is the same list cut a different way and cites it.

**Citation.** "An engine reads what `compiled-program.md` section 5.2 lists and
nothing else."

### H20. The documents that make up the specification

**Fact.** Which documents there are, what each holds, and which wins where two
disagree.

**Home.** `spec/README.md`.

**Why.** It is the page a reader lands on when they open `spec/`, and listing the
documents is its whole job. Three lists of the documents is how a whole document
became unreachable.

**Copies to replace.** `feature-matrix.md`, the section "Documents a row may
cite", which keeps only its own rule (a row may cite any document in that list,
and a citation to a document that does not exist fails the build) and the
precedence paragraph moves out; `docs/README.md`, the specification table;
`language.md` 1 and `host-interface.md` 1, the sentences about the catalogue
winning.

**Citation.** "The specification's documents are the ones `spec/README.md`
lists."

### H21. An error code's message, cause, fix and placeholders

**Fact.** The text of a code.

**Home.** `errors.md`, with `errors.json` as the same entry in machine form.

**Why.** Already the rule, by `language.md` 1 and 16. It is listed here because
two sections now state a code's scope in their own words, which is the same
failure with a different shape.

**Copies to replace.** `stdlib.md` 17.3, the sentence "An unknown tag in any of
them is OS7009, on the same ground as `cancel`", which states a code's scope;
`stdlib.md` 17.14, which lists four refusals with no code and is correct as a
list of rules, and gains one line saying it states rules and never text.

**Citation.** "OS7009, whose scope is the one `errors.md` gives it."

### H22. A conformance case's file set

**Fact.** Which files a case directory may hold and what each supplies.

**Home.** `conformance.md` 2.

**Why.** The suite's layout is the suite document's, and a runner reads exactly
one list.

**Copies to replace.** `feature-matrix.md` 34, the rows that describe file
contents rather than naming them; `stdlib.md` 17, the conformance-area paragraph,
which cites rather than promising vectors in its own words.

**Citation.** "A case supplies it from the case directory, `conformance.md`
section 2."

### H23. The declaration's options and their defaults

**Fact.** The options a `study()` or `strategy()` declaration takes and each
one's default value.

**Home.** `language.md` 13.2 and 13.3.

**Why.** A declaration is a statement of the language. `compiled-program.md` 2.3
owns the field names, their types and the rule that the compiler writes every
option with its effective value, which is the representation.

**Copies to replace.** `compiled-program.md` 2.3, the `"strategy"` JSON sample,
which gains a lead-in naming it an illustration of the defaults of `language.md`
13.3; `stdlib.md` 17.1, the sentence that names `fillOn`'s default value.

**Citation.** "The declaration's options are the ones `language.md` section 13.3
lists, with the defaults it gives them."

### H24. A declared default's effective value in the compiled program

**Fact.** That every option and every declaration field is written with its
effective value, defaults included.

**Home.** `compiled-program.md` 2.3.

**Why.** It is a rule about the representation.

**Copies to replace.** None, but two places break it: `compiled-program.md` 2.8's
`plots[].scale` has no default column at all and 12.2 writes `"scale": null` for
a plot whose argument default is `"right"`. Decision 36 rules on it.

**Citation.** "Written with its effective value, under `compiled-program.md`
section 2.3."

---

## Part two: the questions inside the duplications

## 23. (D1) Are the script-facing and host-facing status vocabularies one set or two?

**Question.** `host-interface.md` 7.3 fixes six words and `stdlib.md` 17.7 fixes
six different ones, one of which does not exist on the other side and two of
which are the same state spelled differently. Is there one vocabulary or two, and
if two, who owns the mapping?

**Decision.** **One vocabulary of seven words, with one home, and no mapping
table anywhere.** The words are:

| Word | Means | Terminal | A host may send it |
|---|---|---|---|
| `placed` | Sent, and the destination has not answered yet | No | No |
| `working` | Live at the destination and not completely filled | No | Yes |
| `triggerPending` | Accepted and waiting for its trigger price | No | Yes |
| `filled` | The whole quantity is filled | Yes | Yes |
| `cancelled` | Ended by a cancellation | Yes | Yes |
| `rejected` | Refused, carrying the destination's own text | Yes | Yes |
| `expired` | Ended without filling, by the destination's own rule | Yes | Yes |

The script-facing set and the host-facing set are not the same set, and the
difference is exactly one word. `placed` is a fact only the engine holds: it
means an intent has left and nothing has come back, and a host cannot report a
state the destination has not described. Every other word is a state the
destination reports and a script reads, with one spelling on both sides.

There is a mapping, and it has one owner: **a destination's own words are mapped
onto these seven by the host's adapter**, which is where `host-interface.md` 7.3
already puts it and where `stdlib.md` 17.7 also says it belongs. There is no
second mapping between the language and the boundary, because there is nothing
left to map.

Where the spellings conflicted, `host-interface.md`'s win: `working` over `open`
and `filled` over `complete`. Not for seniority. `stdlib.md` 17.3 already
publishes `order.working(tag)` for "live and unfilled" and `order.filled(tag)`
for the filled quantity, so choosing `open` and `complete` would have made
`order.working()` true on a status called `"open"` and `order.filled()` a
quantity on a status called `"complete"`, in one document, about one order.

`expired` is one of the seven rather than something mapped onto cancellation. A
day order that reached the close without filling and an order a person cancelled
are different events, the report has to name which, and a vocabulary that cannot
tell them apart makes the adapter throw away the only copy of that fact.

**Why one set rather than two.** The argument for two is real: what a script
observes and what a host reports need not coincide, and here they genuinely do
not, by one word. But a second set of *spellings* buys nothing and costs a
mapping table that two documents would then both have to hold, which is the
defect this part exists to end. One set with a column saying who may send each
word carries the same information in one place.

**Changes required.**

- `stdlib.md` 17.7, the paragraph headed **Statuses**: replace it with the table
  above, four columns as written, and keep the sentence that a destination with
  words of its own maps them in its adapter. Delete the sentence naming `expired`
  as an example of a word to be mapped. Delete the two sentences beginning "A
  status is terminal when it is one of the last three" and "The engine sends no
  further frame of a terminal order to the fold"; the first is the table's
  Terminal column and the second is decided by decision 24.
- `stdlib.md` 17.3, the `order.status(tag)` row: no change, it already cites
  17.7.
- `host-interface.md` 7.3: delete the six-row table and replace the section body
  with the citation of H1, followed by the two host rules it already carries, in
  their existing words: a partial fill is a quantity and not a status, and a
  status the host cannot map is reported as the nearest non-terminal word with
  the destination's own words in `text`, never as a terminal one. Delete the
  bullet "Terminal is one way", which is decision 24's step 4.
- `host-interface.md` 7.2, the `status` row: "One word the host may send, from
  the vocabulary of `stdlib.md` section 17.7."
- `host-interface.md` 10.1, duty 7: replace "uses the vocabulary of section 7.3
  or maps its own onto it" with "uses the vocabulary of `stdlib.md` section 17.7
  or maps its own onto it".
- `feature-matrix.md` 29: add one row after "`order.working`, `order.pending`":
  `| The status vocabulary | Seven words, one spelling each, of which six are ones a host may send and one is the engine's own | `specified` | `stdlib.md` 17.7 | `order/status-vocabulary` |`

---

## 24. (D2) The match key, the field name, and a fill that arrives after a terminal status

**Question.** `host-interface.md` 7.4 matches a frame by intent id and
`stdlib.md` 17.8 locates the row by the destination's own order id; one calls the
average `avgPrice` and the other `avgFillPrice`; and they disagree about whether
a frame that arrives after a terminal status is folded at all.

**Decision, in three parts.**

**The match key is `intentId`.** A frame is located by the intent it names, and
the destination's own reference is recorded and never used as a key. The
destination's order id cannot be the key: a row sits at `placed` from the moment
the intent leaves until the destination first answers, and during that window the
row has no destination id, so the first frame of every order would find no row
and be refused. `intentId` exists on both sides from the beginning, is unique
within the run, and `host-interface.md` 7.2 already requires it on every frame.

To make that unambiguous in the ledger, the row's field named `id` is renamed
`orderRef`, which is the name the frame already uses for the same thing, and the
row gains `intentId` as its key. `order.id(tag)` keeps its name and returns
`orderRef`, because "the order id" is what a trader calls the destination's
reference and renaming a published call to tidy a field would cost more than it
buys. A row with `id` beside `intentId` is the ambiguity that produced this
defect, and the rename removes it.

**The field name is `avgFillPrice`, in the frame and in the row.** One name.
`avgPrice` is the wrong survivor: `pos.avgPrice` and `leg.avgPrice()` are already
the average price of an open position, which is a different number computed a
different way, and a name that already means something else in the same document
set will be read as that other thing.

**A frame that arrives after a terminal status is folded for its quantity, and
the status stays terminal.** `host-interface.md` is right and `stdlib.md` is
wrong, and this is the part that costs money.

A venue reports a fill after a cancellation acknowledgement whenever a cancel
races a fill: the order filled at the exchange, the cancel arrived afterwards and
was acknowledged against nothing, and the fill report follows. It is not an
exotic case; it is what a cancel sent near the touch does on a busy instrument.
An engine that refuses that frame has lost a real fill. The account holds a
position the strategy cannot see, every later `pos.size`, `leg.size()` and
`book.profit` is computed against the wrong quantity, the protective levels of
17.9 defend a position of the wrong size, and the end-of-day square off flattens
a quantity that does not match what is there. None of it is visible from inside
the script, because the script's own ledger says the order died before it filled.

Exactly what the engine does, stated so there is nothing to infer: a frame naming
a terminal row still runs steps 1, 2, 3, 5 and 6 of the fold, and does not run
step 4. The status keeps the terminal word it reached. `filledQty` rises,
`avgFillPrice` takes the frame's, `orderRef`, `sentProduct` and the rejection
text take the newest frame's, and the delta settles against the row's
`positionRef` like any other fill. A `cancelled` row whose cumulative quantity
has reached the order's full quantity stays `cancelled`: the status records how
the order ended and the quantity records what traded, and the two are both true.
The run's record says so out loud, with a named event, because a fill arriving
after the order was dead is precisely the thing a trader must be told.

**Why this way round.** The two failures are not symmetric. Folding a late fill
that was not real would require a destination to report a cumulative quantity it
never traded, which is a broken destination and a broken destination is visible.
Refusing a late fill that was real is invisible by construction, and it is
invisible on exactly the day a cancel raced a fill, which is a fast day.

**Changes required.**

- `stdlib.md` 17.7, the ledger table: rename the `id` row to `orderRef` with its
  existing gloss, and add above it a row
  `| `intentId` | The engine's own key for this order, unique within the run, carried on the intent and on every frame about it |`.
  Add to the `orderRef` gloss: `""` until the destination has answered.
- `stdlib.md` 17.7, the `avgFillPrice` row: no change, this is the surviving
  name.
- `stdlib.md` 17.8, step 1: replace with
  "**Locate.** `f` names a row by `intentId`. A frame that names no row in this
  strategy's ledger is refused and recorded, and nothing is folded. It is not an
  order this strategy placed. The destination's own reference is recorded from
  the frame and is never used to find a row, because a row has none while it is
  `placed`."
- `stdlib.md` 17.8, step 4: replace the last sentence "A terminal status is never
  left" with "A terminal status is never left, and a frame arriving at a terminal
  row does not run this step at all: see below."
- `stdlib.md` 17.8, after step 7: add a paragraph headed **A fill after a
  terminal status** carrying the four sentences of the decision above, beginning
  "A frame naming a terminal row still runs steps 1, 2, 3, 5 and 6" and ending
  with the `cancelled` row that stays `cancelled`, and one sentence naming the
  event.
- `stdlib.md` 17.11, the event table: add
  `| `fillAfterTerminal` | A frame increased an order's filled quantity after the order had reached a terminal status, carrying the tag, the added quantity and the terminal word it arrived after |`.
  Add one sentence after the table: this one is not a rule's transition, and it is
  in the list because a fill the strategy could not have expected is the event a
  trader most needs named.
- `stdlib.md` 17.14: the first two bullets keep their wording; add a third for a
  frame naming no row at all, which is the same refusal reached by `intentId`.
- `host-interface.md` 7.4: delete the five numbered steps and the two paragraphs
  after them. The section becomes the citation of H2, plus the host duties it
  alone states: a host must report at least every frame that changes an order's
  `status` or its `filledQty`, a host that reports only terminal frames is
  conforming and much less useful, and the paragraph headed "When a frame is
  folded" about the bar boundary, which stays here because it is about timing at
  the boundary.
- `host-interface.md` 7.2, the `avgPrice` row: rename to `avgFillPrice`, same
  gloss. The `intentId` row gains: it is the key the fold matches on
  (`stdlib.md` section 17.8).
- `host-interface.md` 7.6, the row "A frame arrives for an intent the engine does
  not know": change the citation from "section 7.4 rule 1" to `stdlib.md` 17.8
  step 1.
- `host-interface.md` 10.1, duty 7: no change beyond decision 23's.
- `feature-matrix.md` 29: add three rows after "`order.working`,
  `order.pending`":
  `| Folding an order frame | Cumulative frames folded once, whatever order they arrive in and however many times | `specified` | `stdlib.md` 17.8 | `order/fold-frame` |`
  `| A repeated or stale frame | Folds to no change: no fill, no event, no report row | `specified` | `stdlib.md` 17.8 | `order/fold-repeat` |`
  `| A fill after a terminal status | Folded for its quantity with the status left terminal, because a cancel can race a fill and dropping it leaves the account holding a position the strategy cannot see | `specified` | `stdlib.md` 17.8 | `order/fold-after-terminal` |`

---

## 25. (D3) Version 1 does name a contract

**Question.** `host-interface.md` 9.3 says no order function takes a symbol so a
version 1 strategy trades the instrument its chart is showing, and cites
`stdlib.md` 17.1 for it, while `stdlib.md` 17.6 defines `leg.fixed` and
`leg.relative` as version 1 calls. What replaces the claim?

**Decision.** The claim is wrong and is deleted everywhere. Half of it is still
true and the two halves must not be confused again:

- **True, and stays:** no order function takes a symbol. An order names a leg.
  The engine never parses a symbol and never builds one.
- **False, and goes:** that a strategy therefore trades only the instrument its
  chart is showing.

The replacement sentence, which is the one every stale site adopts, is:

> A strategy trades the legs it declared. A leg names a contract outright with
> `leg.fixed` or describes one with `leg.relative`, and the host resolves the
> description before bar 0; a file that declares no leg has exactly one leg, the
> instrument its chart is showing, and every order acts on it with no leg named
> (`stdlib.md` sections 17.1 and 17.6).

What is still planned, and what `host-interface.md` 9.3 keeps saying, is the
*chart-side* surface for describing a contract: `chart.expiry`, `chart.strike`
and `chart.optionType` are planned (`stdlib.md` 3.4), and a `symbol` input kind
is planned (`stdlib.md` 13.1). Those are not the leg calls and their being
planned says nothing about the leg calls.

**Why.** There is no judgement here. Two sections of one specification describe
the same version, one of them says a facility does not exist, and the facility is
defined three sections later in the same file. The only decision is which way the
correction runs, and a defined call outranks a sentence about what is absent.

**Changes required.**

- `host-interface.md` 9.3, the paragraph "Where version 1 stands": delete the
  clause "and no order function takes a symbol, so a version 1 strategy trades
  the instrument its chart is showing (`stdlib.md` section 17.1)". Replace with
  "and a strategy names its contracts with the leg declarations of `stdlib.md`
  section 17.6, which this section's resolution shape is what a host answers."
  Keep the sentence about `chart.expiry`, `chart.strike`, `chart.optionType` and
  the `symbol` input unchanged.
- `feature-matrix.md` 29, the row "One net position": retitle to "One position
  per leg" and rewrite the What-it-is cell as "A strategy holds one position per
  declared leg, no order crosses zero, and a file that declares no leg has one
  leg, the chart's instrument". Section cell `stdlib.md` 17.1. Test identifier
  unchanged (`order/net-position`).
- `feature-matrix.md` 29, the row "No order takes a symbol": rewrite the
  What-it-is cell as "An order names a leg, never a symbol; the engine neither
  parses nor builds one". Section cell `stdlib.md` 17.1, `stdlib.md` 17.6. Test
  identifier unchanged (`order/no-symbol`).
- `feature-matrix.md` 29: add two rows after them:
  `| `leg.fixed`, `leg.relative` | Declare the contract a leg trades, outright or by description, top level only and resolved before bar 0 | `specified` | `stdlib.md` 17.6 | `order/leg-declaration` |`
  `| A description the host cannot resolve | OS6007 before the first bar, and the strategy does not start | `specified` | `stdlib.md` 17.6, `errors.md` OS6007 | `unit:order/leg-unresolvable` |`
- `docs/reference/functions/strategy.md` 15 to 22: replace the "one net position"
  paragraph with the replacement sentence above, and add a short section for the
  leg calls citing `stdlib.md` 17.6.
- `docs/first-strategy.md` 90 and 100: the same replacement sentence, once.
- `docs/faq.md` 287: the answer to "Can I hold a long and a short at the same
  time?" becomes yes, on two legs, and no, on one: a leg holds one position and
  no order crosses zero, and two opposite positions are two legs. Cite
  `stdlib.md` 17.1.
- `examples/README.md` entry 12: delete the sentence beginning "This is the
  script that found the version 1 boundary on orders" and the sentence after it.
  Replace with: this script trades one leg on its chart and routes the other from
  an alert, which is one of two shapes; a strategy that wants both legs in its own
  ledger declares them with `leg.relative` and enters them as a unit
  (`stdlib.md` sections 17.6 and 17.12).
- `examples/12-strategy-short-premium.oscript` lines 28 to 35: replace the
  comment with one that states the script's own reason and claims no boundary:
  a leg the chart does not show has no bar series of its own, so a backtest of it
  has to be given one, and this script therefore trades the chart's leg and routes
  the other from an alert; a strategy that wants both legs in its own ledger
  declares them with `leg.relative` (`stdlib.md` section 17.6). Change the
  "Exercises" line at the top of the file in the same way: delete "the single
  instrument order model at its limit" and write "a one-leg strategy whose signal
  is computed from a second instrument". No code in the file changes.
- No change to `docs/strategies/*.md` under this decision beyond what the same
  sentence requires; whoever owns `docs/` greps for "one net position" and for
  "no order function takes a symbol" and applies the replacement sentence at
  every hit.

---

## 26. (D4) One trail, one spelling, one home

**Question.** `stdlib.md` 17.2 says there is no trail on an order, while five
other places give `trail` and `trailOffset` as bracket arguments and one gives a
trail as a field of a bracket intent.

**Decision.** **There is one trailing stop in the language and it is
`leg.trail(name, distance, activateAt = none)` of `stdlib.md` 17.9.** `trail` and
`trailOffset` are deleted from `exit()` and from `order.bracket()`, and a trail
is not a field of an order intent.

The old two arguments map onto the new two exactly: `trail` is `distance`, the
amount the level follows behind the best price, and `trailOffset` is `arm`, the
profit at which the trail starts following. A worked call written
`exit(trail = 20, trailOffset = 5)` is written `leg.trail(distance = 20, arm = 5)`
in a file with one leg.

**Why it lives there.** A stop and a target are prices an order can rest at, so a
destination can hold them and a host can implement a bracket with resting orders.
A trail is not a price; it is a rule that recomputes a price on every bar from
the best price seen since arming. It cannot be handed to a destination as a
number, the engine has to evaluate it, and section 17.10 already fixes exactly
when in the bar it is evaluated and in what order against the other rules. A
trail listed as a bracket argument promises a host something the host cannot
implement and the engine will do anyway.

**Changes required.**

- `stdlib.md` 17.2: no change. It already states the rule and points at 17.9.
- `stdlib.md` 17.9, the `leg.trail` row: no change.
- `host-interface.md` 7.1, the note "A bracket is an instruction, not an
  implementation": replace "carrying its target, its stop, its trail and the
  trail offset (`stdlib.md` sections 17.2 and 17.3)" with "carrying its target
  and its stop (`stdlib.md` section 17.2)". Add one sentence: a trailing stop is
  never part of a bracket intent, because it is a rule the engine evaluates every
  bar rather than a price an order can rest at (`stdlib.md` section 17.9); what
  reaches the host when a trail is hit is an ordinary exit order.
- `feature-matrix.md` 29, the row "`exit(...)` brackets": rewrite the What-it-is
  cell as "A target or a stop, as absolute prices or as distances from the entry"
  and delete "or a trailing stop".
- `feature-matrix.md` 29: add one row after it:
  `| Trailing stop | `leg.trail`, armed at a profit and ratcheting in the leg's favour only, evaluated every bar rather than resting at a destination | `specified` | `stdlib.md` 17.9, `stdlib.md` 17.10 | `order/trailing-stop` |`
- `docs/reference/functions/strategy.md` 111: the `exit` signature loses `trail`
  and `trailOffset`, and its parameter list loses the two lines.
- `docs/reference/functions/strategy.md` 177 and the worked call at 186: the
  `order.bracket` signature loses `trail` and `trailOffset`; the worked call
  `order.bracket(trail = atr(14) * 2, trailOffset = chart.tickSize)` becomes
  `leg.trail(distance = atr(14) * 2)`. Add a `leg.trail` entry to the page citing
  `stdlib.md` 17.9 for the ratchet.
- `docs/first-strategy.md` 97: delete the `trail, trailOffset` cell from the
  `exit` row of the call table.
- `docs/first-strategy.md` 220: delete the `trail`, `trailOffset` row from the
  bracket argument table and add a sentence naming `leg.trail` with its two
  arguments.

---

## 27. (D5) Which calls are top level only

**Question.** Three lists again, and OS3006's placeholder says the name it prints
can only be one of five, so an engine raising OS3006 on a leg prints a name the
catalogue says cannot occur and offers a fix that is not a fix for a leg.

**Decision.** `language.md` 15.3 owns both placement lists (H14). The top level
only list is **seven** calls under OS3006: `plot`, `plotCandles`, `fill`,
`level`, `table`, `leg.fixed` and `leg.relative`. `input` remains top level only
under OS3007. The anywhere list gains the protective levels: `signal`, `alert`,
`barColor`, `background`, `cell`, `clear`, `print`, the `draw` namespace, every
order function, every protective level of `stdlib.md` 17.9 and every strategy
shape call of `stdlib.md` 17.12.

OS3006's `{name}` gloss is a value set, not a gloss, so it is not covered by the
catalogue clause: it must list the same seven. Its cause gains the leg case and
its fix gains the leg's fix, which is not the plot's fix. You cannot hide a leg by
passing `none`: a leg is a contract the strategy trades, and the way to trade it
on some bars and not others is to declare it at the top level and decide per bar
whether to send it an order.

**Why `language.md`.** The catalogue is authoritative by `language.md` 1 and 16,
which means the catalogue's text wins over another document's text about a code.
It does not mean the catalogue decides the rule: a rule about where a script may
write a call is the language's shape. The right relationship is that
`language.md` 15.3 states the rule, and OS3006's text is edited to match it, in
one place, when the rule changes.

**Changes required.**

- `language.md` 15.3, the top-level-only sentence: the list becomes `plot`,
  `plotCandles`, `fill`, `level`, `table`, `leg.fixed` and `leg.relative`
  (OS3006), and `input` (OS3007). Add one clause: the two leg declarations exist
  only in a `strategy()` file, and the set of contracts a strategy trades is part
  of its fixed shape for the same reason the set of columns is
  (`stdlib.md` section 17.6).
- `language.md` 15.3, the anywhere sentence: add "every protective level and
  every strategy shape call of `stdlib.md` section 17" after "every order
  function".
- `stdlib.md` 14.1: delete both lists and the sentence "This is the same split as
  `language.md` section 15.3, stated with both lists complete". Replace the whole
  opening with the H14 citation and one sentence saying why a leg is on the top
  level list, which is 17.6's reason and is `stdlib.md`'s own. Keep the paragraph
  about declaration handles and runtime objects unchanged.
- `errors.md` OS3006, the `{name}` bullet: "one of plot, plotCandles, fill,
  level, table, leg.fixed or leg.relative".
- `errors.md` OS3006, cause: add one sentence. "A leg declaration is on the list
  for the same reason: the set of contracts a strategy trades is fixed before bar
  0, and a leg that existed on some bars and not others would leave the run's
  record with nothing to key on."
- `errors.md` OS3006, fix: add one sentence. "A leg is not hidden by passing
  none: declare it at the top level and decide per bar whether to send it an
  order."
- `errors.md` OS3006, Reference line: add `stdlib.md` 17.6.
- `errors.json`, entry OS3006: the same three edits to `placeholders.name`,
  `cause` and `fix`, and `spec` becomes "language.md 7.1, 15.3; stdlib.md 17.6".
- `feature-matrix.md` 15: add one row:
  `| A leg declared inside a block | OS3006, because the set of contracts a strategy trades is part of its fixed shape | `specified` | `language.md` 15.3, `stdlib.md` 17.6, `errors.md` OS3006 | `unit:order/leg-in-block` |`

---

## 28. (D6) The namespace list

**Question.** `language.md` 15.2 lists ten namespaces and `stdlib.md` 17 adds two
more with twenty-six entries between them.

**Decision.** `language.md` 15.2 is the closed list (H15) and it gains `leg` and
`book`, each marked as existing only in a `strategy()` file. `stdlib.md` 2.1
stops listing them.

**Why.** `language.md` 15 says in its own words that what it fixes is the shape
of the library. A namespace is that shape. A namespace that exists in the
catalogue and not in the shape is a namespace no second implementer knows to
build.

**Changes required.**

- `language.md` 15.2, the namespace table: add two rows in the order the table
  already uses, after `order`:
  `| `leg` | The contract each leg trades, and each leg's own position and protective levels, in a strategy |`
  `| `book` | Every declared leg taken together: the combined rules, the entry filters and the book's own profit, in a strategy |`
  Add one sentence after the table: `leg` and `book` exist only in a `strategy()`
  file, and calling one from a `study()` file is OS7001.
- `language.md` 15.2, the fenced example: no change.
- `stdlib.md` 2.1: replace the sentence listing twelve namespaces with the H15
  citation, keeping the rule that decides bare from namespaced and keeping the
  sentence that `leg` and `book` exist only in a `strategy()` file, which is
  `stdlib.md`'s own and is cited from `language.md` rather than repeated in it.
- `feature-matrix.md` 15, the row about namespaces if one exists, otherwise add:
  `| The namespace list | The closed list of namespaces, two of which exist only in a strategy file | `specified` | `language.md` 15.2 | `lib/namespaces` |`

---

## 29. (D7) The session's home

**Question.** `compiled-program.md` 5.2 says an engine reads all of a list from
the host and none of it from anywhere else, and the session is not on the list
and the word does not appear in the document; three other documents are built on
the session coming from the host.

**Decision.** The session is part of the instrument record, and the instrument
record's home is `host-interface.md` 4.1 (H16). `compiled-program.md` 5.2's list
stays closed and stays where it is, and its instrument facts row becomes a
citation of 4.1 rather than an enumeration, which is what left the session with
nowhere to be listed.

**Why not the other way round.** `compiled-program.md` 5.2's job is the closed
list of *channels* an engine reads: bars, bar state, settings, the instrument
record, the chart clock, more bars on request, a drawing surface, an order route.
That list is the engine contract and it belongs there. The *contents* of the
record, eleven facts with types, required-ness and absence behaviour, never
appear in a compiled program at all: they are handed over at the boundary, which
is what `host-interface.md` is for, and 4.1 is the only copy with the detail.
This supersedes the placement decision 6 made, not its substance.

**Changes required.**

- `compiled-program.md` 5.2, the table row beginning "Instrument facts": replace
  the whole cell with "The instrument record (`host-interface.md` section 4.1)",
  keeping the Used-by cell as it is.
- `compiled-program.md` 5.2, the paragraph after the table: keep the sentence
  about `chart.intervalMinutes` and `chart.isIntraday` being derived, and delete
  the clause that restates which facts are absent when the host does not state
  them, which is 4.1's Required column.
- `host-interface.md` 4.1, the lead sentence: replace "Ten facts, plus the
  session. The ten are the list in `compiled-program.md` section 5.2; the session
  is the fact `stdlib.md` section 12.4 reads and OS6012 names" with "Eleven
  facts. This table is where they are defined; `compiled-program.md` section 5.2
  names the record as one of the things an engine reads from the host."
- `host-interface.md` 2, the duties table, duty 2: "The instrument record,
  section 4.1" in place of "Ten facts about the instrument, plus its session".
- `stdlib.md` 3.4, the sentence decision 6 added: replace with "Every fact here
  comes from the instrument record (`host-interface.md` section 4.1);
  `chart.intervalMinutes` and `chart.isIntraday` are derived by the engine from
  the interval string rather than supplied."
- `stdlib.md` 12.4, the opening sentence: "The session is the instrument record's
  session (`host-interface.md` section 4.3), not a window the script invents."
- `conformance.md` 2, the `instrument.json` row: "Instrument facts: the record of
  `host-interface.md` 4.1. Defaults in section 3."
- `conformance.md` 3, the lead-in to `instrument.json`: keep the default block
  exactly as it is, and replace the sentence that explains which facts the block
  holds with the H16 citation. The defaults themselves are `conformance.md`'s own
  and stay.
- `errors.md` OS6012, cause: replace "come from the host's instrument record, not
  from the bars" with "come from the instrument record (`host-interface.md` 4.1),
  not from the bars". `errors.json` the same.
- `feature-matrix.md` 33, the row "What the host supplies": see decision 36.

---

## 30. (D8) OS7009 against the ledger reads

**Question.** OS7009 says there is no working order tagged `{tag}` and its cause
says a tag names an order from placement until it fills, cancels or expires,
while `stdlib.md` 17.3 makes `order.rejection` and `order.avgFill` reads of a
finished order, which is the only time they have anything to say.

**Decision.** **Acting on a tag that names nothing is an error. Reading a tag
that names nothing is not.** OS7009 applies to a call that acts on an order:
`cancel(tag)`, and the planned `order.modify` and `order.oco`. It does not apply
to the seven reading calls.

A row stays in the ledger after it finishes. That is what the ledger is for: it
is append-only, it is the audit trail, and `order.rejection` and `order.avgFill`
exist to be read from a finished row. The reads therefore read a row at any
status, terminal included, and a tag naming no row at all returns the value each
entry already documents for "nothing yet": `order.working` false,
`order.id` `""`, `order.status` `""`, `order.filled` `0`, `order.avgFill` absent,
`order.rejection` `""`.

**Why the line falls there.** Acting on a tag that names nothing is a script that
believes an order exists when it does not, and it will keep believing it. Reading
is how a script finds out; a read that raised would mean a script could not ask
the question without already knowing the answer, and `order.working(tag)` would
be unusable as the guard that OS7009's own fix tells the author to write.

Where a tag names more than one row, because the same tag was used for a later
order, the reads read the most recently placed row carrying that tag. A tag is a
label a script reuses, not a key, and the most recent one is the only answer a
script can act on.

**Changes required.**

- `errors.md` OS7009, cause: replace the first sentence with "A tag names an
  order from the moment it is placed. Acting on a tag that names nothing is a
  script that has lost track of its own orders, and ignoring the call would leave
  it believing an order exists that does not." Add: "This code is for a call that
  acts on an order. The reading calls of `stdlib.md` section 17.3 read the
  ledger, which keeps a row after the order finishes, so a tag that names no row
  reads as the entry's documented empty value rather than raising."
  `errors.json` the same.
- `errors.md` OS7009, Reference line: add `stdlib.md` 17.3. `errors.json`'s
  `spec` the same.
- `stdlib.md` 17.3, the paragraph beginning "The five reading calls": it is seven
  calls, not five (`order.id`, `order.status`, `order.filled`, `order.avgFill`,
  `order.rejection`, `order.working`, `order.pending`). Replace the sentence "An
  unknown tag in any of them is OS7009, on the same ground as `cancel`" with:
  "They read the ledger at any status, terminal included, which is when
  `order.rejection` and `order.avgFill` have something to say. A tag that names
  no row reads as the entry's documented empty value; OS7009 is for a call that
  acts on an order, which is `cancel` and the two planned calls. Where a tag
  names more than one row, the reads read the most recently placed one."
- `stdlib.md` 17.3, the `order.id` row: the gloss becomes "The destination's own
  reference for that tag, `""` before the destination has answered", which is
  decision 24's rename.
- `feature-matrix.md` 29, the row "`cancel`, `cancelAll`": no change. Add one
  row:
  `| Reading a finished order | The ledger keeps a row after the order ends, so the reading calls read a terminal row and an unknown tag reads empty rather than raising | `specified` | `stdlib.md` 17.3, `errors.md` OS7009 | `order/ledger-reads` |`

---

## 31. (D9) Order frames in a conformance case

**Question.** `stdlib.md` 17 promises that 17.8 to 17.11 are a conformance area
with vectors of their own, and a case directory has no file that supplies order
frames, so there is no way to hand an engine a repeated frame, an out-of-order
frame or a fill after a terminal status.

**Decision.** A case directory gains an optional file, **`frames.csv`**, which
supplies order frames the way `bars.csv` supplies bars and `ticks.csv` supplies
intrabar updates. Its home is `conformance.md` 2 and 3 (H22).

```text
afterBar,intent,status,filledQty,avgFillPrice,orderRef,text
0,1,working,0,none,R1,
1,1,filled,25,101.5,R1,
1,1,filled,25,101.5,R1,
2,1,filled,40,101.75,R1,
```

- `afterBar` is the zero-based index of the bar after whose execution the frame
  is delivered, so the fold happens at a bar boundary before the next execution
  (`host-interface.md` section 7.2). Several rows may name one bar and are
  delivered in file order, which is how a case orders two frames that cross.
- `intent` is an ordinal, not an id: 1 is the first intent the run placed, 2 the
  second. A case cannot know the id an engine minted and must not depend on its
  spelling, so the runner maps the ordinal to the engine's own `intentId`. An
  ordinal greater than the number of intents the run placed is how a case
  exercises a frame naming an order the ledger does not hold.
- `status` is one word a host may send, from the vocabulary of `stdlib.md`
  section 17.7.
- `filledQty` is cumulative. `avgFillPrice` is absent as `none`, written as
  `bars.csv` writes an absent field.
- `orderRef` and `text` are optional columns; an omitted column is absent on
  every row. Extra columns are an error, as in `bars.csv`.

The four rows above are the whole of what was missing: a working frame, a fill,
the same fill repeated, and a frame whose cumulative quantity rose after the row
had gone terminal. A case asserts the result through the `orders` channel of
`expected.json`, whose elements are ledger rows of `stdlib.md` 17.7 compared on
the fields the case names.

**Why a file rather than a script call.** Every byte of a case's input lives in
the case directory, and a frame is input. A case that produced its own frames
from a script would be testing the script, and the fold is exactly the thing that
has to be provable against input the engine did not choose.

**Changes required.**

- `conformance.md` 2, the file table: add a row after `ticks.csv`:
  `| `frames.csv` | no | Order frames delivered between bars, for a strategy case that asserts the fold |`
- `conformance.md` 3: add a subsection `### frames.csv` after "Intrabar updates",
  carrying the fenced sample above and the six bullets above, with the citation
  of H4 for the frame's fields.
- `conformance.md` 4, under `expected.json`: add one sentence naming the `orders`
  channel's element as a ledger row of `stdlib.md` section 17.7, compared on the
  fields the case names and no others.
- `stdlib.md` 17, the paragraph promising a conformance area: keep it and add the
  citation "a case supplies frames from its case directory (`conformance.md`
  section 3)", so the promise names the mechanism that keeps it.
- `feature-matrix.md` 34: add one row:
  `| Order frames | `frames.csv` in the case directory, delivered between bars, so a repeated frame, a crossed frame and a fill after a terminal status can each be handed to an engine | `specified` | `conformance.md` 2, `conformance.md` 3 | `conf/frames` |`
- `feature-matrix.md` 29: the three rows decision 24 adds carry test identifiers
  `order/fold-frame`, `order/fold-repeat` and `order/fold-after-terminal`, each
  of which is a case directory holding a `frames.csv`.

---

## 32. (D10) The `side` and `type` value sets

**Question.** `order.place` takes `side` and `type` and no section says what
either may be; `"stopLimit"` is spelled only in `host-interface.md` 7.1, as a
wire field rather than as an argument's value set.

**Decision.** Both sets are written in `stdlib.md` 17.2 (H13), where a script
author reads, and every other appearance cites them.

- `side` is `"buy"` or `"sell"`.
- `type` is `"market"`, `"limit"`, `"stop"` or `"stopLimit"`.

`type` and the prices agree or the call is refused: `"limit"` needs `price`,
`"stop"` needs `trigger`, `"stopLimit"` needs both, `"market"` takes neither. A
type that names a price it was not given is OS7007, which already exists for
exactly that. A value outside either set is OS3008, which is the code for a value
outside a fixed set and already names the accepted values in its message.

`order.place(side, ...)` is the only place a script writes a side as a value,
because `buy` and `sell` write it as a name. That is why the set has to be
written down: a script computing `side` has nothing else to check its string
against.

**Why `stdlib.md` 17.2 and not 17.3.** 17.2 already fixes the correspondence
between the prices given and the order produced, in the paragraph beginning "With
neither `limit` nor `stop`". Putting the value sets anywhere else would split one
fact across two sections of one document, which is the same defect at a smaller
scale.

**Changes required.**

- `stdlib.md` 17.2, after the paragraph beginning "With neither `limit` nor
  `stop`": add one short paragraph giving both sets, the agreement rule between
  `type` and the prices, and the two codes. Word it as a value set and not as a
  gloss: the accepted values, spelled, and nothing about what an engine does with
  them.
- `stdlib.md` 17.3, the `order.place` row: no change. Add to the paragraph after
  the table: "`side` and `type` take the values of section 17.2."
- `host-interface.md` 7.1, the `side` row: "The order's side
  (`stdlib.md` section 17.2)." The `type` row: "The order's type
  (`stdlib.md` section 17.2)."
- `host-interface.md` 7.1, the note "`type` follows the prices": replace the
  first sentence with the H13 citation and keep the second, which is the boundary
  fact: the field is stated anyway, so a host never has to infer it.
- `docs/reference/functions/strategy.md`, the `order.place` entry: name both
  value sets and cite `stdlib.md` 17.2.
- `feature-matrix.md` 29, the row "Limit, stop and stop-limit": add "`side` is
  buy or sell and `type` is market, limit, stop or stopLimit" to the What-it-is
  cell, or add one row:
  `| The side and type value sets | What `order.place` accepts, written where a script author reads; a value outside either is OS3008 | `specified` | `stdlib.md` 17.2, `errors.md` OS3008 | `order/side-and-type` |`

---

## 33. (D11) One shape for a relative contract

**Question.** `host-interface.md` 9.3 names seven fields and `stdlib.md` 17.6
takes nine arguments; some of the difference is spelling drift of one fact, three
fields exist on one side only, and the `right` enum genuinely differs.

**Decision.** One shape, one set of words, home `stdlib.md` 17.6 (H10). The
signature becomes:

```text
leg.relative(name, underlying, kind, expiryRank = 0, expiryCycle = none,
             strikeOffset = 0, right = none, reference = none,
             exchange = chart.exchange, product = the declaration's,
             qty = the declaration's, side = "buy")
```

Field by field, with the ruling and its reason:

| Field | Ruling | Why |
|---|---|---|
| `underlying` | Kept, an identity, opaque | Agreed on both sides |
| `kind` | Kept, required, `"future"` or `"option"` | It decides which of the other fields apply, so it is required and has no default, exactly as `meta.kind` is in a compiled program. Encoding it as `right = "none"` made a value of one field mean "a different kind of contract", which is how `right` ended up with three values on one side and two on the other |
| `expiryRank` | `expiry` is renamed to it | `leg.expiry(name)` already reads back the resolved contract's expiry, which is a date. One document cannot have `expiry` meaning a rank in one section and a date in another |
| `expiryCycle` | Kept, optional, absent means the venue's default series | A venue listing a weekly and a monthly series cannot be addressed by rank alone, and a script that must say which could not say it at all |
| `strikeOffset` | `strike` is renamed to it | Same reason as `expiryRank`: `leg.strike(name)` reads back a price |
| `right` | `"call"` or `"put"`, absent for a future | With `kind` explicit, `"none"` has nothing left to say |
| `reference` | Kept, optional, absent means the underlying's price at the moment of resolution | An offset measured from nothing is not an offset, and a script measuring from a settlement or a session open has no way to say so otherwise |
| `name`, `exchange`, `product`, `qty`, `side` | Kept, `stdlib.md`'s own | They are the leg's bookkeeping, not part of the contract's description, and no host field corresponds to them |

Giving `right` or `strikeOffset` with `kind = "future"` is OS3010, which is
already the code for two arguments that cannot both be given.

**Why the source's words and not the boundary's.** The description's fields are
argument names a script author types. When a host refuses a resolution with
OS6007 the message has to be able to name the argument the author wrote, and a
host that had its own seven words for the author's seven would be describing a
call nobody made. Where the two sides differed on spelling, the boundary's word
won every time except `name`, because in each case `stdlib.md`'s word was already
taken by a read of the resolved contract in the same section.

**Changes required.**

- `stdlib.md` 17.6, the `leg.relative` row: the signature above.
- `stdlib.md` 17.6, the paragraph beginning "`leg.fixed` names a contract the
  host already knows": rewrite the second half as the field-by-field meanings,
  using the words above, and keep the sentence about the engine never parsing or
  building a symbol.
- `stdlib.md` 17.6: add one sentence: `right` or `strikeOffset` with
  `kind = "future"` is OS3010.
- `stdlib.md` 17.6, the bold paragraph "A relative contract resolves exactly
  once" and the paragraph after it: replace with the H11 citation. The rule does
  not change; its home does.
- `host-interface.md` 9.3, the seven-row table: delete it and replace with the
  H10 citation, plus the sentence that already follows about what the host
  answers with and OS6007, and the paragraph beginning "Every field is stated in
  the contract's own terms", which is `host-interface.md`'s own argument for why
  the description is portable.
- `errors.md` OS3010, cause: add one sentence naming the third pair: a relative
  leg described as a future and given a right or a strike offset, which are
  fields of an option. `errors.json` the same.
- `feature-matrix.md` 29, the `leg.relative` row decision 25 adds: Section cell
  `stdlib.md` 17.6, `host-interface.md` 9.3, 9.4.

---

## 34. (D12) Reaching `host-interface.md`

**Question.** Nothing links to `host-interface.md`. `spec/README.md` says three
documents make up the specification, `docs/README.md` lists six spec files
without it, and `feature-matrix.md` says all five exist and names five. A reader
never learns it exists.

**Decision.** `spec/README.md` is the home for what the specification is (H20):
the documents, what each holds, and which wins where two disagree. Six documents
are the specification, `decisions.md` is the minutes and `feature-matrix.md` is
the index, and the README says which is which rather than counting to three.

Precedence, stated once and cited from everywhere else: `errors.md` wins about
the text of a code, `language.md` wins about a rule of the language, `stdlib.md`
wins about a function, `compiled-program.md` wins about a representation,
`host-interface.md` wins about the boundary, and `conformance.md` wins about the
suite. Where none of those settles it, the home register in `decisions.md` names
the owner.

**Why the README and not the matrix.** The matrix's table exists to support a
build check on citations, which is a rule about rows, and it acquired a count as
a side effect. The README's whole job is the list. A list whose job is something
else is the list that goes stale.

**Changes required.**

- `spec/README.md`: rewrite. The opening sentence names six documents and does
  not count to three in prose. The table gains a `host-interface.md` row
  ("Everything a platform supplies so an engine can run, and everything the
  engine hands back: the boundary") and a `stdlib.md` row, which is also missing
  today. Add two rows below the table for `decisions.md` (the minutes of every
  settled cross-document question, and the home register) and `feature-matrix.md`
  (what is specified, implemented or planned, one row per feature). Add the
  precedence paragraph. Note that `errors.json` is `errors.md` in machine form
  and not a document of its own.
- `feature-matrix.md`, the section "Documents a row may cite": delete "All five
  exist" and the six-row table. Keep the rule, rewritten: a row may cite any
  document `spec/README.md` lists, and a citation to a document that does not
  exist is a build failure. Replace the precedence paragraph with the H20
  citation.
- `docs/README.md`, the specification table near line 402: add a
  `host-interface.md` row, and replace whatever counts the files with the H20
  citation.
- `docs/README.md` line 416: the pointer to `spec/README.md` stays and is now
  the pointer that carries the list.
- `language.md` 1, "Error codes": keep the sentence that the catalogue is
  authoritative and replace the general precedence clause with the H20 citation.
- `host-interface.md` 1, "Error codes": the same.
- `CONTRIBUTING.md`: whoever owns the root files greps for a count of
  specification documents and applies the H20 citation at each hit.

---

## 35. (D13) `signal`'s colour in the colour guide

**Question.** `docs/visuals/colors.md` line 178 still gives
`signal(text, color)` a colour computed for that bar, which decision 3 removed.

**Decision.** The cell is wrong and is replaced. `signal`'s `color`, `at` and
`shape` are part of the marker's declaration and are fixed before bar 0; only the
text is read per bar. The per-bar column for that row reads "Not per bar: the
colour is part of the declaration (`stdlib.md` section 14.3)".

**Why.** It is not a judgement call: decision 3 settled it, the edit landed in
`stdlib.md` 14.3 and not in the documentation page, and a page that contradicts
the specification is a page with a bug by `docs/README.md`'s own rule.

**Changes required.**

- `docs/visuals/colors.md` 178, the `signal(text, color)` row: the Per bar cell
  becomes "Not per bar: `at`, `shape` and `color` are fixed before bar 0
  (`stdlib.md` section 14.3)". The Constant cell keeps "Marker plate".
- `docs/visuals/colors.md`: whoever owns `docs/` greps the page for any other
  sentence that offers a per-bar signal colour and applies the same correction.

---

## 36. (D14) Seven one-line rulings

**1. OS3012 cited for an omitted leg, but its cause names a study title and an
indicator source.** OS3012 is the right code, because a `leg` argument in a file
with more than one leg is a parameter with no default and no value the engine
could invent; its cause gains one sentence naming the leg as a third common case,
and `errors.json` the same.

**2. OS3017 cited for two legs sharing a name, but it is titled "two of these
share a title" and its cause is about legend rows.** OS3017 is the right code and
its wording is the defect: the heading becomes "Two of these share a name", the
message becomes `{kind} names must be unique in a file; {name} is also used at
line {line}`, the `{title}` placeholder is renamed `{name}`, `{kind}` gains
`leg`, and the cause gains one sentence: a leg's name is what every later call
keys on, so two legs with one name leave every `leg.` call with no answer. "Name"
is true of a plot's title and "title" is false of a leg, so one word covers both
and the other does not. `errors.json` the same, and `stdlib.md` 17.6's sentence
citing OS3017 keeps its wording.

**3. `plots[].scale` writes `null` while its stdlib default is `"right"` and 2.3
says defaults are written with their effective value.** The rule wins: the field
is `string` rather than `string?`, its default is `"right"`, and
`compiled-program.md` 12.2's worked example writes `"scale": "right"`. `overlay`
stays `bool?` with `null`, because `plot`'s `overlay` argument's default really is
`none` and `null` is its effective value.

**4. `feature-matrix.md` 33's "and nothing else" turns a short list into a closed
one.** The row's What-it-is cell becomes "The closed list of what an engine reads
from the host", with no enumeration and no "and nothing else", citing
`compiled-program.md` 5.2, which is where the closure is stated (H19).

**5. `host-interface.md` 10.1 cites OS5003 for a host duty when OS5003 is about a
script's limits budget.** The citation is correct and stays: OS5003 fires when a
host's ceiling is below what a file asked for, which is a host duty declared at
load. What is missing is which code covers which ceiling, so duty 5 gains one
clause: OS6006 for a capability tag, OS5003 for a `limits()` option above the
host's ceiling, OS5006 for outstanding requests above it. OS5003's Reference line
in `errors.md` gains `host-interface.md` 10.1, and `errors.json` the same.

**6. `bar.updates` is "handed over" in one place and "executed" in two others.**
"Executed" is the word, everywhere, because `bar.updates` is read from inside an
execution and a script can only count what it ran. `host-interface.md` 6.1's row
and 6.2's sentence adopt it, and 6.4 gains the obligation that makes the two
counts one number: the host increments `updates` once per hand-over, the engine
executes once per hand-over, and a host that hands a bar over without it being
executed does not increment it. The meaning's home is `language.md` 7.2 (H18).

**7. `spec/README.md` says three documents and `spec/` holds nine.** Decision 34
rewrites that page; this is the same edit and not a second one.

---

## 37. What the sweep turned up beyond D1 to D14

Five more, each already carried in the home register above, listed here so that
nobody has to rediscover them: the ledger row restated in prose in
`host-interface.md` 7.5 (H6), the position reference defined twice (H7), the
account-position rule argued at length in two documents (H8), the four stated bar
facts listed in three (H18), and the strategy option defaults written out in the
compiled format's sample (H23).

One thing the sweep exposed that this part does not settle, because it is a new
question rather than a duplicated fact: **a leg on a contract the chart does not
show has no bar series of its own.** `stdlib.md` 17.6 lets a strategy declare it,
`stdlib.md` 17.10 tests its stop against a bar's range, and nothing says where
that bar comes from in a backtest. It is not a contradiction between two
documents, so it is not a defect this part can close by assigning a home. It
needs an issue of its own and a decision after it, and until then nothing should
be written that assumes either answer.

---

## 38. Where a position comes from, and how a frame gets in

**Question.** `stdlib.md` 17's preamble said five position facts are read from
the host's own position row; `stdlib.md` 17.1 says a strategy folds its position
from its own settled fills and from nothing else; `host-interface.md` 7.5 says
the engine is neither handed an account position nor asks for one; and
`compiled-program.md` 5.2 lists what an engine reads from a host, does not list a
position, and says it reads none of it from anywhere else. One engine resolved
the disagreement by reading a position row off its host type, so on a host built
from the specification every position fact read absent, a guard written
`flat = pos.size == 0` was absent rather than true, and a strategy shipped in
`examples/` placed nothing and said nothing.

**Decision. The preamble was the defect, and the ledger is the answer.** A run
folds a minimal ledger from the intents it routes and the frames a host reports
for them, and the five position facts read it. No position is read from a host,
and there is nowhere on the host interface to hand one over.

**Why this way round rather than marking the five planned.** The specification's
precedence gives the boundary to `host-interface.md`, and that document already
says the run keeps the ledger of `stdlib.md` 17.7 (H6); the fold is already a
conformance area with vectors of its own (H2, decision 31); and a case directory
already supplies frames and maps its ordinals onto the engine's own `intentId`,
which presumes an engine that mints one. Marking the five planned would refuse
three of the twelve target scripts, and it would leave the nine order functions
unmarked with no way for a script to know it is already in the market, which is a
worse shape than the one being fixed: the order functions would still run.

**What this is not.** The ledger is the rows, the fold and the position folded
from it. The legs and the book of 17.6 and 17.9 to 17.11, and every figure that
needs a cost model, stay planned and stay marked.

**Two things the boundary had to settle to make it work.**

**A quantity travels with its unit.** An intent carries the strategy's own
`qtyType` beside `qty`, untranslated, on the same ground `product` is: a lot is
the venue's own fact, the host owns symbology, and an engine that multiplied by a
lot size the host never stated would send a quantity nobody asked for. The one
quantity stated in units is the one the engine worked out itself from filled
quantities.

**A bracket's distance travels as a distance.** The entry a distance is measured
from is the fill of the order the bracket's tag names, and that fill reaches the
destination before it reaches the engine: on the bar a script writes `buy()` and
its bracket together, nothing has filled. An engine resolving a distance at the
call site would measure from a position it does not hold.

**The second defect, in the same area.** `host-interface.md` 10.1 makes sending
cumulative frames a conformance duty and 7.2 specifies the frame in ten fields,
and no engine exposed anywhere to deliver one. A duty that cannot be discharged
is not a duty. The intake is now an obligation on the engine, stated in 7.4 where
the timing already is.

**Changes required.**

- `host-interface.md` 7.1: `side` and `qty` become absent on the kinds that state
  neither; a `qtyType` row is added, and `profit` and `loss` rows for a bracket's
  distances; a note is added beside the `product` note for the quantity's unit,
  and one under the bracket note for the distance.
- `host-interface.md` 7.4: the paragraph headed **How a frame reaches the
  engine**, with the three things the intake fixes.
- `host-interface.md` 7.5: "The run keeps the ledger of `stdlib.md` section
  17.7, and every position a script reads is folded from it."
- `host-interface.md` 10.1, duty 7: the frames are sent through the intake of
  7.4.
- `compiled-program.md` 5.2: one row for the frames, and a paragraph saying the
  position is not on the list and is not read from anywhere else. 5.3's kept list
  names the ledger and what is folded from it.
- `stdlib.md` 17, the preamble: the five position facts are folded from the
  ledger, not read from a host's position row, and what stays planned is the
  rules and the money figures rather than the ledger itself.
- `stdlib.md` 17.1: the party that applies `fillOn`, the slippage and the
  commission is the destination, and the engine folds the price it is told.
- `feature-matrix.md` 29: three rows, `order/frame-intake`, `order/qty-unit` and
  `order/bracket-distance`.

**Still open, and deliberately not settled here.** A bracket carries a level and
the rule that tests it is planned, so a host decides today what a bracket does
between the moment it is sent and the moment 17.9's standing levels exist. That
is a question about the levels rather than about where a position comes from, and
it needs its own decision.

---

## 39. What a tag argument means, and where a close that can never close anything is refused

**Question.** Three statements in this repository, two answers. `stdlib.md` 17.3
says OS7009 "is for a call that acts on an order, which is `cancel` and the two
planned calls". `errors.md` OS7009's worked example is an `order.bracket` whose
tag names no order, presented as a refusal. `src/core/engine/ledger/place.ts`
said `exit` and `order.bracket` "attach a protective level to a tag", which reads
as a tag that has to name one. And separately, in the same area: `close(tag)`
with a tag no ledger row ever carried sends nothing and says nothing, so the
position stays open and the script believes it has flattened.

**What was measured**, against the built engine, before any of this was decided:

- `order.bracket(tag = "entries", loss = 10)` after `buy(qty = 1, tag = "entry")`:
  no diagnostic, and the intent leaves carrying the tag `"entries"`.
- `order.bracket(loss = 10)` with no tag written: no diagnostic, and the intent
  leaves carrying the empty tag.
- `exit` behaves as `order.bracket` does, on both counts.
- `cancel` with a tag naming no working order: OS7009, and nothing is sent.
- `close(tag)` twice on a tag that has flattened: one order, no diagnostic.
- `close(tag)` on a tag no row ever carried: nothing sent, nothing said.

**Decision, part one. What a tag argument means is written in its default.** A
tag that defaults to the empty string is a **label**: the call carries it to the
destination and to the report, it names nothing that has to exist, and an empty
one is an ordinary order. A tag that is required, or that defaults to absence, is
a **reference**: it names something the strategy already has, and naming nothing
is a mistake rather than a no-op.

Every call on the order surface that acts obeys it. The calls that place an
order, and both spellings of a bracket, default their tag to the empty string and
take a label. `cancel` requires its tag and `close` defaults its to absence, and
both take a reference. The planned `order.modify` and `order.oco` require theirs,
and are references, which is what decision 30 already said.

**The one exception is the reading calls of 17.3**, and it is in the rule's
second half rather than its first: each of them requires its tag, so each takes a
reference, and a tag naming no row is answered with the entry's documented empty
value instead of being refused. Decision 30 settled that and gave the reason,
which is that reading is how a script finds out. The exception is now stated in
17.3 as an exception rather than left to be noticed.

**So `errors.md` is the document that moves.** Its OS7009 example contradicted
the implementation, `stdlib.md` 17.3, and decision 30, and the reading that saves
it is not available: a reference defaulting to the empty string would be
nonsense, a leg carries at most one stop and at most one target at a time (17.2)
so a bracket cannot be attached to an individual order, and the engine already
measures a bracket from the leg's own average entry price. The example is now a
cancellation, which is a call that really does raise the code.

**A second defect in the same entry.** OS7009's fix told the reader to test
`order.working(tag)` before acting, and its after block was written around that
call. `order.working` is marked planned, so the fix the catalogue handed a reader
was itself a refusal, OS2020. Both now say something that compiles today: use the
tag the order was placed with, or `cancelAll()`, which acts on whatever is
working and refuses nothing.

**Decision, part two. A `close` naming a tag no order in the file is placed with
is OS7016, at the call, before any bar runs.** A close names the part of a
position that one tag entered. A tag nothing places can never name a part of one,
so the call could only send nothing on every bar while the position stayed open.
A tag the script computes is not read, and neither is any close in a file where
an order's tag is computed: nothing there is provable.

**Why the checker rather than the engine, which is where the defect was found.**
The engine cannot tell the mistake from an ordinary bar. A tag that has never
named a ledger row is also what a working script looks like before its entry has
fired: an exit signal that is true on the bar before the entry signal ever was is
an ordinary chart, not a defect, and a strategy that scales into a position and
exits the added part on a separate condition meets it on the first such bar. A
refusal there would stop that script, and no guard against it can be written
today, because every call that reads the ledger is planned. It would be a
refusal that refuses a script for doing exactly what its own fix asks, which is
the reason `refuse.ts` already gives for not counting an unfilled order as an
open entry under OS7008.

The file does not have that problem. What a file can place is all of what it will
ever place, so the question is settled once, for every bar and every data set,
and the fix always applies. `cancel` stays with the engine for the mirror reason:
what it asks is whether an order is live now, and only a run knows that.

**Why a code of its own rather than OS7009.** OS7009's message is "There is no
working order tagged {tag}", and a close does not act on a working order: it acts
on the part of a position a tag entered. One message covering both would be
vaguer than either, and the two are refused at different stages by different
evidence, so a reader meeting one code in two places would have to work out which
of the two rules had fired.

**What is not refused, and must not become so.** A close on a tag that is placed
somewhere in the file and holds nothing right now sends nothing and says nothing.
That is idempotence, it is how a strategy is ordinarily written, and it covers
both the tag that has already flattened and the tag whose entry has not fired
yet.

**Changes required.**

- `errors.md` OS7009, fix: "Use the tag the order was placed with, or cancelAll()
  where the script means every order it has working." `errors.json` the same.
- `errors.md` OS7009, example: before is `buy(qty = 1, tag = "entry")` followed by
  `cancel("entries")`; after is the same pair with the tag spelled as it was
  placed. `errors.json` the same.
- `errors.md` and `errors.json`: a new entry, OS7016, stage `check`.
- `errors.md` 4, the ranges table: the OS7xxx count and the total.
- `stdlib.md` 17.2: the paragraph stating the rule, and the paragraph on what a
  close's tag names and when it is OS7016.
- `stdlib.md` 17.3: the reading calls take a reference and are the one place the
  rule's second half does not follow.
- `feature-matrix.md` 29: three rows, `order/tag-label-or-reference`,
  `unit:order/close-unplaceable-tag` and `order/close-idempotent`.
- `docs/strategies/orders.md`: the rule in the order identity section, OS7016 in
  the refusal table, the OS7009 row corrected (a read does not raise it), and the
  sentence advising a planned call replaced with one that compiles today.
- `docs/strategies/reading-the-books.md`: the rule beside the reading calls, and
  both codes in the pitfalls table.
- `src/core/engine/ledger/place.ts`, the header: a bracket sets the leg's level
  and its tag is a label; a close's tag is a reference.

---

## 40. A quantity stated on a close, and the bar's rows that outlived their orders

**Question.** `stdlib.md` 17.1 says no order crosses zero, and `close(qty)`
crossed it. Measured against the built engine, on a leg holding one unit long,
`close(qty = 5)` sent one sell of five: the leg ended the bar four short, under
one position reference, with no diagnostic anywhere. Every other quantity a
close sends is one the engine works out from the leg's own settled fills and is
bounded by them; a quantity the script stated was passed through as written.
Issue 0013 laid out three answers and declined to pick between them, correctly,
because they are three different languages rather than three implementations of
one. (Two sentences of this paragraph were too broad and decision 42 corrects
them: a quantity the engine works out is bounded by the position only one call
at a time, and two of them on one bar cross zero between them.)

**Decision. A `qty` written on a close may not be larger than what that close is
closing, and larger is OS7017, at the call, with the call sending nothing.** What
it is closing is the whole leg where no tag is named and the part one tag
entered where one is, which is the same number the engine already computes to
size a close that states none.

**Why not the first answer, sending what is there.** Clamping sends a quantity
the script did not ask for and leaves the script believing it closed the one it
did. That is the wrong-belief class this repository has now refused three times
in a row, at OS7002 for an argument written as absent, at OS7004 for a sign that
came out backwards, and at OS7016 for a tag no order places. Adding a fourth
instance of it in the same release that removed the third would be incoherent.

**Why not the third answer, reading it as a reversal.** It would make `close`
able to open a position. `docs/strategies/orders.md` already calls that the most
expensive naming mistake available, in its own paragraph about why `cancelAll`
does not liquidate, and the language has `order.reverse` for scripts that mean
it.

**The rule underneath, which is the one that keeps being the answer.** An
argument the script wrote is a claim, and a false claim is refused; an argument
it did not write is the engine's to work out. That is why `buy(qty = none)` is
OS7002 while `buy()` takes the declared size, and why `close(tag = "typo")` is
OS7016 while `close(tag = "entry")` on an already flat tag stays silent. A
quantity on a close is a claim about the strategy's own position, and the engine
holds the ledger that settles it.

**The consequence, which is deliberate.** `close(tag = "entry", qty = 1)` on a
tag that has already flattened is now refused, while `close(tag = "entry")` on
the same tag stays silent and idempotent. Those two look inconsistent side by
side and are not, for exactly the reason above. The place a reader is stopped
from tripping on it is `stdlib.md` 17.2's own close paragraph, and the same
sentence is on the two documentation pages that teach the call.

**What the refusal is, in full.** The ledger asks about the call before it maps
it, so the call reaches no destination; and a bar that places a good order and
then meets this refusal sends nothing at all, the good order included, because
every call on a bar is mapped before any of them is routed.

**Where it is not evaluated, and why that is stated rather than hidden.** The
comparison is made only where the stated quantity and the folded position count
the same thing, which is a declaration whose `qtyType` is `"units"`. A position
is folded from filled quantities and a stated quantity is in the declaration's
own unit (`host-interface.md` 7.1), so in lots, cash or equity percent the two
are different kinds of number and the lot size that would join them is the fact
OS7005 has been deferred on since the beginning. `refuse.ts` already refuses to
evaluate a rule it cannot evaluate truthfully, and this is the fourth entry on
that list rather than a new kind of exemption. A close that crosses zero is not
refused there, and it is better named than answered with a number nobody can
defend.

**The second defect, found in the same place.** `engine.orders()` reported a row
for an order no destination was ever handed. A bar that placed an order tagged
`"good2"` and then called `cancel("nosuch")` left the destination with zero
intents from that bar, which is right, and left the ledger reporting `good2` at
`placed` with an empty `orderRef`. `stdlib.md` 17.7 says a row is appended when
the order is sent, and `refuse.ts`'s own header says a refused call reaches no
destination rather than being sent and then reported: both were true of the
refused call and false of the good ones before it on the same bar. A host
reconciling against that record after a stopped run reads an order it never
received.

**Decision, part two. A bar's rows and a bar's orders are the same set.** A
refusal anywhere on a bar takes back every row that bar appended.

**Why taken back rather than never written.** A row has to be there while the
rest of the bar is mapped, because the calls after one are measured against the
rows before it: `cancel` asks whether a tag names a working order, pyramiding
counts the entries a position already holds, and a close measures what one tag
entered. Deferring the append would turn an entry and a cancellation of it on one
bar into OS7009. So the bar writes its rows and a refused bar undoes them, which
is the shape the moving bar already uses on the cells, one scope up from the
sentence the ledger already keeps for a single call.

**Changes required.**

- `errors.md` and `errors.json`: a new entry, OS7017, stage `runtime`.
- `errors.md` 4, the ranges table: the OS7xxx count and the total.
- `stdlib.md` 17.2: the paragraph on what a `qty` on a close may be, and the
  paragraph on why the call with one is not idempotent while the call without
  one is.
- `stdlib.md` 17.7: a bar's rows and a bar's orders are the same set.
- `feature-matrix.md` 29: three rows, `order/close-beyond-position`,
  `order/close-qty-unit` and `order/bar-rows-and-intents`.
- `docs/strategies/orders.md`: the ceiling in the exiting section, the pair of
  calls that look inconsistent, and OS7017 in the refusal table.
- `docs/strategies/reading-the-books.md`: the same pair beside the tag rules, and
  OS7017 in the pitfalls table.
- `docs/troubleshooting.md`: OS7017 in the refused-order table, and what to do.
- `docs/reference/functions/strategy.md`: the ceiling and the idempotence note in
  the `close` entry.
- `src/core/engine/ledger/place.ts`: `closableUnits` exported, so the mapping and
  the refusal read one number.
- `src/core/engine/ledger/refuse.ts`: the refusal, and the unit narrowing added to
  the header's list of what it will not evaluate.
- `src/core/engine/ledger/ledger.ts` and `src/core/engine/orders.ts`: the bar's
  rows taken back with the bar.

**Still open, and deliberately not settled here.** `docs/strategies/orders.md`
teaches `sell(qty = abs(pos.size) + newQty)` as "one instruction the engine
splits into two orders, because no order crosses zero", and the engine splits
nothing: `buy` and `sell` map to one order at the quantity written. Either the
page is wrong or `entering` is, and that is a question about what an entry means
rather than about what a close means. It needs its own issue and its own
decision. (Settled in decision 42: the page was right and `entering` was wrong.)

---

## 41. A specification sentence that could not be violated

**Question.** `stdlib.md` 20.3's `ema` paragraph said "The new value is
multiplied first and the running value second, and the two products are added in
that order". Section 20 is the manifest a second engine implements from, and
every sentence in it is meant to be a constraint an implementer can fail.

**Decision. The sentence constrained nothing and is replaced by one that names
the arrangement that actually varies.** Binary64 multiplication and addition are
both commutative, so the swapped arrangement is not a second implementation at
all: run over the eighty bar fixture the release gate compares bit for bit, it
gives 0 differences out of the 164 values the three gate lengths produce. The
arrangement that does vary is `running + (value - running) * weight`, which
differs on 142 of those 164: 70 of 72 at length 9, 42 of 61 at length 20 and 30
of 31 at length 50. It is also the one an implementer is most likely to reach
for, because it is one multiplication rather than two, and it is the arrangement
the same section already refuses for `rma` in the same words.

**Why this matters more than a wording fix.** A sentence that cannot bite sends
an implementer to check the half that does not matter, which costs them exactly
the time section 20 exists to save. Two sentences beside it, on the seeding and
on associativity, are correct and measured, and a reader who finds one sentence
in a paragraph that cannot be wrong has no way to tell which of the others can.

**Changes required.**

- `stdlib.md` 20.3: the `ema` arrangement paragraph, naming
  `running + (value - running) * weight` and the measured differences, and a
  second paragraph saying what is deliberately not fixed and why.
- `tests/gate/ema.test.ts`: two tests, one asserting that the refused
  arrangement gives different numbers on the gate fixture and one asserting that
  writing the two products in the other order gives the same ones. The second is
  a statement about `compiled-program.md` 8.1's arithmetic rather than about this
  library, and it is the measurement that justifies the silence.

---

## 42. What a reducing order is measured against, and the entry that crosses zero

**Question.** `stdlib.md` 17.1 states it with no qualification: no order crosses
zero. Decision 40 closed the half a script reaches by writing a quantity on a
close. Measured against the built engine, three paths were still open, and none
of them needed a quantity larger than the leg:

```
if bar.index == 2
    close()
    close()
```

on a leg holding three long sent two sells of three under one position
reference. The destination netted three short, the ledger folded to minus three,
and nothing was said. Five bare closes in a loop ended the leg twelve short.
`close(qty = 2)` twice on a leg of three ended it one short with each order
inside OS7017's ceiling. Second, OS7017 was narrowed to a declaration counting in
units, so `buy(qty = 1)` and then `close(qty = 5)` under lots, cash or an equity
percent sent one sell of five against a leg holding one, with no refusal on any
of the three. Third, `docs/strategies/orders.md` taught
`sell(qty = abs(pos.size) + newQty)` as one instruction the engine splits into
two orders, and `entering` mapped one order at the quantity written.

The cause of the first is not a defect in `ctx.size()`. A position is folded from
settled fills and from nothing else, which is right and is what 17.8 says. A row
appended earlier on the same bar has filled nothing, so the second close measured
against the same position the first one did. The ceiling was the right ceiling
applied to the wrong number: what the leg held when the bar began rather than
what is left to close after the orders the bar has already committed to.

**Decision, part one. A reducing order is measured against what is left to
reduce on this bar.** What is left is what the part holds, less what this bar's
own orders have already committed to closing, and the invariant it keeps is
written into 17.1: **the orders one bar sends can never sum past the position
they are reducing.** (Decision 44 replaced the scope of this with the run and
the position, which subsumes the bar. The reasoning below stands; only the word
"bar" moved.)

**The tension, which is the real content of this decision.** Issue 0016 named
two acceptable answers and declined to pick: size the second close against what
is left, or refuse it. Neither is free. Sizing it silently is the engine
deciding a quantity, which is the thing this repository has refused three times.
Refusing a bare `close()` refuses a call that wrote no claim at all, which cuts
against the rule that keeps being the answer here: an argument the script wrote
is a claim, and a false claim is refused; an argument it did not write is the
engine's to work out.

**It is resolved by reading the rule, not by choosing between the two halves.**
A bare `close()` writes no quantity, so the quantity is the engine's to work out,
and the right number to work out was never "what the leg held when the bar
began": it is what is left to close. Sizing it is not the engine deciding a
quantity, it is the engine correcting the one it was already deciding. The
second of two bare closes then sends nothing, which is exactly the idempotence
17.2 already describes for a tag that holds nothing, rather than a new silence.
A `qty` on a close is still a claim, it is still refused when false, and the only
thing that changed is that it is now held against the true number: on a leg of
three, `close(qty = 2)` twice is one order and then OS7017 naming one left.

So neither answer was picked over the other. The bare call is sized because
sizing it was always the engine's job, and the stated call is refused because
refusing a false claim was always the language's.

**The scope is the bar, and the bar includes its re-executions.** A file
declared `onUnconfirmed` applies its effects on every execution of the moving
bar, and the orders of the earlier executions really were handed over, so the
record is keyed on the bar rather than on the execution. A close on a bar
executed three times sends one position, not three.

**Decision, part two. What the engine cannot count, it counts as everything.**
The count is in units, because a position is. A quantity the engine worked out is
in units already; a quantity the script stated is in the declaration's own unit
(`host-interface.md` 7.1). Where that unit is not units the engine cannot read
its own order as a number of units, and it has two readings to choose from.
Counted as nothing, `close(qty = 1)` in lots followed by a bare close on the same
bar sends the position a second time and the leg ends short: measured, on a leg
holding two units, it ended one short. Counted as everything, the second close
sends nothing and the strategy may be left holding a position it believes it
closed.

**The second is chosen, because 17.1 is the sentence with no qualification in
it.** A close that sends nothing is the idempotence the same section already
describes, and it leaves the position the script had. An order that crosses zero
leaves the opposite position, which is the failure the rule exists for. Between a
silence and a wrong sign, the wrong sign is worse, and it is worse in the
direction that costs money without bound.

**Decision, part three. OS7017 is evaluated in every unit, for the half that
needs no lot size.** The narrowing was sound and was disclosed honestly in six
places, and it remains where it belongs: a stated quantity held against a
position that is still there is a comparison between two kinds of number, and
the lot size that would join them is the fact OS7005 has been deferred on from
the beginning. But nothing left to close is zero in units, in lots, in cash and
in an equity percent alike, and a close that states a quantity against a part
holding nothing is a false claim whatever the declaration counts in. That half is
now refused everywhere, which is how a strategy declaring lots gets the part of
17.1 that can be held for it rather than none of it.

**What is not held, stated where a reader meets it rather than in a comment.**
One shape: a quantity stated against a position that is still there, in a
declaration counting in lots, cash or an equity percent. That order may cross
zero and is not refused. OS7017's own catalogue entry says so, 17.2 says so, and
the feature matrix has a row for it. What would have to exist first is the
instrument's lot size reaching the ledger, which is one field on the host's
instrument record that the engine already carries the tick size from; cash and an
equity percent need the money figures of 17.4 as well, and those are planned.
No quantity the engine works out after such an order adds to what it may have
crossed, because of part two: a `close()` after it on the same part sends
nothing. A second stated quantity on the same bar is another order of this same
shape rather than a consequence of the first, and the refusal stays silent on it
because an assumed zero is not a number it may name.

**Decision, part four. An entry that would cross zero is sent as two orders.**
Here the specification had already decided and the engine disagreed with it:
17.1 says an instruction that would take a leg from long to short is sent as two
orders, one closing the outgoing position and one opening the replacement, each
carrying its own position reference. The page taught what the specification says.
`entering` now sends the closing half at what is left to close, with the position
reference the leg is attached to, and the opening half at the remainder, with a
reference minted for it. `order.reverse` was already this pair and is now the
same code path's neighbour rather than its exception.

The reason 17.1 gives for the split is the one that matters: a single order that
crossed zero would leave a late fill with no way to say which of the two
positions it settled, and during a flip a leg holds both at once.

**Two consequences of the split, both deliberate.** An order opposing a position
this bar has already committed to closing in full is opening a replacement rather
than reducing anything, so it is minted a position of its own: `close()` and then
`sell(qty = 4)` on one bar sends the close and then an entry under a new
reference, instead of attaching a short to the position that is going. And a
second crossing entry on the same bar opens a second replacement rather than
joining the first, because nothing has settled and the engine cannot tell one
from the other; the sum is right, no position crosses zero, and the shape is a
script mistake either way.

**The split is arithmetic on the order's own quantity**, so it happens where the
declaration counts in units, for the reason part three gives. Elsewhere the order
is sent as written and the page says so.

**What is deliberately not settled here, and has an issue rather than a
sentence.** The bar is the scope. A close sent on one bar and still working when
the next bar closes again is measured against a position that has not moved, so
two closes on two bars can still sum past it: measured, a leg holding three long
with the first close unacknowledged ended three short after both filled. That is
a different question, about what a working order means to a later bar rather than
about what a bar may send, and answering it wrongly would break the strategy that
closes again because the first close was never acknowledged. It cannot be
answered in lots at all, because a ledger row does not carry the unit its
quantity is counted in. Issue 0017.

**Changes required.**

- `stdlib.md` 17.1: the paragraph on what the orders of one bar may sum to, and
  the paragraph on counting in units and what is done with an order the engine
  cannot read.
- `stdlib.md` 17.2: the close paragraph, measured against what is left; the
  paragraph on where the comparison is made in full and where only half of it
  is; and the sentence on why the second bare close is silent rather than
  refused.
- `errors.md` and `errors.json`: OS7017's message, its `held` placeholder, its
  cause, and its fix.
- `feature-matrix.md` 29: five rows, `order/bar-reducing-budget`,
  `order/close-twice-one-bar`, `order/entry-crosses-zero`,
  `order/reducing-qty-unreadable`, and the two rows already there reworded.
- `docs/strategies/orders.md`: what a close is measured against, and the
  qualification on the reversing table.
- `docs/strategies/reading-the-books.md`, `docs/troubleshooting.md`,
  `docs/reference/functions/strategy.md`: the same sentence where each of them
  teaches the ceiling.
- `src/core/engine/ledger/closable.ts`: a new file, holding what is left to
  close, the bar's own record of what it has sent, and why an order the engine
  cannot read counts as all of it.
- `src/core/engine/ledger/place.ts`: `entering` splits; `flattening` and
  `order.reverse` measure against what is left; every mapped order says what it
  takes out of the leg.
- `src/core/engine/ledger/refuse.ts`: OS7017 against what is left, and in every
  unit where what is left is a measured zero.
- `src/core/engine/ledger/ledger.ts`: the bar's record carries what each order
  reduces, one entry per row appended, so a refused bar takes both back together.
- `tests/engine/crossing.test.ts`: the invariant, asserted on the destination.
- `tests/engine/closing.test.ts`: the half of OS7017 that holds in every unit.

---

## 43. What a settings row is, once an `input()` may be written anywhere

**Question.** Issue 0014 let an `input()` be written everywhere the specification
allows one: as a declaration option, inside a larger expression, as the whole of
an assignment. That was right and is not reopened here. It left three edges, and
each of them is the same question asked from a different side: what is a settings
row, when it is not a name on a line?

Measured on the built compiler, in that order:

```
study("B", precision = input(2, "Decimals"))
a = input(14, "Length") + 0
b = input(3, "Width") + 0
```

carried the keys `input0`, `input1`, `input2`. Inserting one tunable in the
middle and renaming nothing made them `input0` to `input3`, and the value a user
had stored for Width arrived on Smoothing, silently, because section 8.3 of
`host-interface.md` validates a number against a number and both are numbers.

```
d = req.timeframe("1D", high + input(1, "K"))
```

produced exactly one diagnostic, OS6018, whose message ends "if nothing else was
reported about this script that is a defect in the compiler rather than in the
script: please report it".

```
var len = input(14, "Length")
```

compiled with no diagnostic at all and read absent on every bar: the name was
given a slot, the input was given another, and nothing joined them. The user got
a row in the dialog they could move that did nothing.

**Decision, part one. A row is named by what the user sees, never by where it
sits.** The key is the name the input was assigned to, and where it was assigned
to none, its title. `host-interface.md` 8.1 promises a key that "survives every
edit that does not rename it", and a positional key keeps that promise for no
edit at all: an insert, a delete and a reorder each move it, and each of those is
an ordinary edit somebody makes without thinking about the dialog at all. The
title is the one thing about an unassigned row that a user can see, so changing
it is the rename the promise excepts, and every other edit leaves it alone.

**Why not a position with a suffix to disambiguate.** Because a suffix is a
position wearing a different hat, and it would break on exactly the edits a key
exists to survive. Uniqueness is held by refusing instead: two inputs carrying
one title were already OS3017, a title spelling another input's name is OS3022,
and an input with neither a name nor a title is OS3021. The last of those is also
a row with no label, which is a defect on its own.

**The title is read from the line as a string literal** rather than folded from
an expression over literals, because a key and a label are both fixed before
anything is computed, and because a row a reader is looking for should be named
on the line that declares it. `input(2, "Off" + "set")` is OS3021 rather than an
unlabelled row, which is what it silently produced before.

**This changes every stored key of every unassigned input, and there were
none.** Across the 101 gate studies, the 6 gate scripts and `examples/`, 0 of 241
inputs carried a generated key, because until issue 0014 closed, an `input()`
written anywhere but the whole of an assignment did not compile at all. The
scheme therefore changes before anything depends on it, which is the only moment
it could.

**Decision, part two. An `input()` inside a read's expression is permitted, and
the emitter carries it.** `stdlib.md` 15.4 already let the expression read a
**name** bound to an input, for a reason that is about the input and not about
the name: a setting resolves before bar 0 and holds for the run, while a per-bar
name has no counterpart on the requested bars. OS6003's own cause in the
catalogue says it in the same words, listing "a literal, arithmetic over
literals, or an `input()`". `language.md` 13.4 forbids a block and a function,
and a read's expression is neither. Every document already said yes.

The mechanism was already in the format as well. `compiled-program.md` 2.16
gives a read's body an `inputs` list precisely so that a setting can cross into
it: the engine resolves the key in the enclosing program before the body runs and
fills a register of the body's own table with it. The call now resolves through
the same scope the name does, so two reads of one setting inside one body share
one register rather than asking the engine for the same value twice.

**The alternative was defensible and is not what the documents say.** Forbidding
it would have meant 13.4 naming a third place, and the checker refusing it at the
span of the `input()` with a code about the script. That would be a rule the
language gained in order to keep an emitter's limitation, and the limitation was
one function call wide.

**Decision, part three. `var name = input(...)` is an ordinary `var`.** An
`input()` is the one declaration call that also has a value, so the initialiser
is that value: the cell is initialised once, on the first bar, and keeps whatever
the file puts in it afterwards. A setting cannot change mid-run
(`host-interface.md` 8.2), so a `var` nothing assigns to holds exactly what the
plain form holds, and what the word buys is the assignment: a running total that
starts from a setting, which the language could otherwise only say in two lines.

**It is not refused, because it is not meaningless.** The other reading was a new
code telling the author to drop the `var`, and the case against it is that the
combination says something the plain form cannot. What had to be settled
alongside it is the half that makes the two spellings different: the name is not
the input. `len = input(...)` makes the name another spelling of the setting, so
it reads the input's own slot and is a compile-time constant; a `var` is a cell a
later assignment may change, so it is a per-bar name, OS3003 in a declaration
option and OS6003 inside a read's expression. One accessor answers that question,
`inputHeldBy`, and three passes ask it rather than each deciding it. Leaving any
one of them asking the old question was measured: the option case became a lone
OS6018 and the read case accepted a per-bar name into another instrument's bars.

**The row is keyed by the name either way**, so adding or removing the word `var`
in a file somebody is already using does not move what they stored. That is part
one applied to part three, and it is why the two belong in one decision.

**And the check that should have caught all of this.** `compiled-program.md` 3.5
check 5 is three sentences: the depth agrees on every path, it never goes below
zero, and it is zero at the terminator. The compiler's own copy walked the first
two. The third is not a restatement of the second: a `RET` reaches nothing after
it, so a body one value short is at minus one exactly at the `RET`, where the
walk asked nothing, and the walk finished clean. That is how a read's expression
with an `input()` in it came to be emitted as a body whose stack does not add up,
and it was found by an engine rather than by the compiler that wrote it. The walk
now checks every `RET` and every `HALT` rather than the last instruction, because
an early `return` is a terminator too and owes the same debt. The engine's own
copy always checked it, and the two disagreeing is the whole reason the third
sentence is written down.

**Changes required.**

- `host-interface.md` 8.1: what the key is, that it is never a position, and the
  three refusals that keep two inputs off one key.
- `compiled-program.md` 2.6: the `key` field's description.
- `language.md` 13.4: where an `input()` may be written, what a name and a `var`
  in front of it each mean, and that the title names the row.
- `stdlib.md` 15.4: the call written inside a read's expression, and the `var`
  that is not a setting. `stdlib.md` 13.2: the title is a literal, and is the key
  of a row assigned to no name.
- `errors.md` and `errors.json`: OS3021 and OS3022, and OS3022's row in the
  refinement table of section 6.
- `feature-matrix.md` 13, 22 and 26: the new rows.
- `docs/inputs.md`, `docs/reference/functions/input.md`,
  `docs/language/persistence.md`: the pages that teach what a row is called and
  where an input may be written.
- `src/core/emit/context.ts`: `inputKey`, and why it is never a position.
- `src/core/check/check.ts`: OS3021 and OS3022.
- `src/core/check/checked.ts`: `inputHeldBy`, the one place that separates the
  input a name holds from the input it was given; `constant.ts` and
  `expressions.ts` ask it.
- `src/core/emit/request-scope.ts`: a new file, holding the settings one read's
  expression reads, keyed by the input rather than by the binding.
- `src/core/emit/inputs.ts`: a call inside a read's expression resolves through
  that scope; `statements.ts` and `registers.ts`: a `var` over an input.
- `src/core/emit/code.ts`: check 5's third sentence.
- `tests/engine/settings.test.ts`: the promise of 8.1, held to an insert, a
  delete, a reorder and a rename.
- `tests/engine/request-settings.test.ts`: a setting inside a read's expression.
- `tests/emit/depths.test.ts`: the three sentences of check 5.

---

## 44. What is available to reduce, and three sentences that were not true

**Question.** Decision 42 scoped a rule to the bar, and one bar later the same
defect was still there. Measured against the built engine, with the entry
acknowledged and the closes not acknowledged, on the plainest exit a strategy
can write:

```
strategy("P", qty = 3)
if bar.index == 0
    buy(qty = 3)
if bar.index > 0 and pos.size > 0
    close()
```

six bars sent `buy 3` and then `sell 3` five times, all under position reference
1, and netted twelve short. Ten bars netted twenty four short. It grows with the
run. No diagnostic anywhere, on a leg that opened long three, and a destination
slower than the chart is all it takes. With the closes filling one of three at a
time it sent `sell 3`, `sell 2`, `sell 1` and ended three short.

The script is not wrong. `pos.size` is folded from settled fills and correctly
still read three, so the guard was true and the script re-issued. This is the
shape every trading script has in it.

**The lesson is not that the last fix was too small.** It is that the invariant
was scoped to whatever the fix happened to cover. Round two tested one close per
bar and two crossed; round three tested one bar and two bars crossed. A rule
whose scope is "the thing I just fixed" gets broken by the next case out, every
time, and three rounds of that is enough to stop guessing at the scope.

**Decision, part one. What is available to reduce is the settled position less
everything already working against it. The scope is the run and the position,
not the bar.**

A bar-scoped rule is the special case of this one in which nothing has been
answered yet, so this subsumes what `closable.ts` did rather than sitting beside
it, and the bar keeps no record of its own any more. What is working is read
from the ledger, which already knew: a row carries a status and a filled
quantity, and an order the destination still has is exactly a row that is
neither terminal nor fully filled. The reduction a row's order was measured for
now rides on the row, because the row is the thing that outlives the bar.

Four cases decide the shape, and each was settled before the code was written:

- **A partial fill.** Three sold with one filled leaves two working, not three
  and not none. The one that filled has already moved the leg.
- **A rejection.** The row ends, the working quantity is released, and the
  script may close again. That is correct and it is why frames matter.
- **A destination that never answers.** The strategy cannot close again, which
  is right: it already has a close working, and a second one would sell a
  position it is already selling. `cancel()` is the way out, and it works
  because the cancellation comes back as a frame that ends the row. That is
  asserted end to end rather than assumed, because a rule that held the units
  for ever would make the documented escape no escape at all.
- **An entry working against the same leg.** An unsettled `buy` adds nothing to
  what a close may reduce. Nothing has settled, so there is nothing extra to
  close, and counting it would send a close for a position that may never exist.

One thing the run scope needs that the bar scope did not: **only an order on the
side that reduces what the leg holds now.** A row's reduction was measured when
it was sent, and a leg that has changed sign since is reduced from the other
side. Subtracting a sell that is now adding to a short leg would leave the
strategy unable to close a position it is carrying, which is the opposite
failure and just as expensive.

**Decision, part two. A crossing entry is minted a position of its own in every
unit.** `entering` sent the whole instruction on `ctx.reference()`, the outgoing
position's reference, whenever the declaration counted in anything but units. At
a lot size of twenty five, `buy(qty = 3)` then `sell(qty = 9)` had the
destination take reference 1 from seventy five units to minus one hundred and
fifty: exactly the harm 17.1 says the split exists to prevent, with a late fill
on the entry settling against a book that had already gone the other way, and a
reference that could never return to zero.

The two halves of the split need different things and they are now kept apart.
Dividing the instruction into a closing half and an opening half subtracts a
position folded from filled quantities from a quantity the script stated, and
those are the same kind of number only in units. **Minting a reference needs no
arithmetic at all**, so it is done in every unit. What does not hold, and is
written where a reader meets it in `stdlib.md` 17.1 and in the deferral on
OS7005, which nothing raises yet: the outgoing position is not closed by an order
of its own, so its reference does not return to zero, and the fact that would
settle it is the instrument's lot size.

That left a number wrong, and the cost of the change was paying for it. A leg
then holds two positions at once for good rather than for the length of a flip,
and `pos.avgPrice` summed cost and size across both: three hundred bought at one
hundred beside two hundred and twenty five sold at one hundred and ten reported
an entry at seventy, and every level a script measures from the entry would have
been measured from that. **The average is now taken over the positions on the
side of the leg's net**, which is the same sentence `positions.ts` already
keeps inside one position, read across a leg: reducing does not move an average.
It corrects a second wrong number nobody had noticed, during a flip in units,
where the two open halves blended the same way.

**Decision, part three. Two sentences in 17.1 that were false or unscoped.**

The first said an engine holds every order to "no order crosses zero" that it
can read as a number of units, "which is all of them but one, and that one is
named two paragraphs below". The across-bars case above is entirely in units and
was not the named exception, so the sentence was false. It is made true by the
engine rather than by editing the claim down, and then says what is now true: the
rule is kept on the bar an order was sent and on every bar after it, a crossing
entry the engine cannot size carries a reference of its own, and the one shape
left is a quantity stated on a close in a declaration counting in lots, cash or
an equity percent.

The second said "a bar declared `onUnconfirmed` is one bar however many times it
is executed". True of the reducing count the paragraph is about, and it reads as
a general rule about the bar. Measured: on such a bar executed four times a close
sends one order as promised, and `buy(qty = 3)` sends **four**, leaving the leg
holding twelve where the script wrote one entry. The engine is right, because
`language.md` 7.5 says a script may not assume it runs once and must guard with
`bar.isConfirmed`. The sentence now carries its scope, and the entry case is
asserted in a test beside the close case, so a second engine implementing 17.1
alone cannot read it as holding entries too.

**Decision, part four. A documented refusal nothing raised: OS3023.**

`stdlib.md` said "a `leg` that is not one of the declared names is OS3008, whose
message lists the names that are", and nothing raised it: `buy(qty = 3,
leg = "nosuchleg")` placed the order on the only leg with no diagnostic, and a
computed name was ignored too. The sharp case is that `buy(leg = "a")` then
`close(leg = "b")` flattens the position, so a script that names one leg and
closes another trades the leg it did not name and is told nothing.
`check-raises.mjs` cannot see this, because OS3008 is raised elsewhere for values
outside a set.

**It is raised now rather than deferred, and under a code of its own.** The two
were weighed. Deferring is defensible: 17.6's declarations are planned, so a
multi-leg file cannot be written today and the damage is a typo rather than a
wrong leg. But the deferral could not be recorded the way the others are, because
a `deferred` field belongs to a code nothing raises and OS3008 is raised; it
would have had to live somewhere a reader of the catalogue does not look, which
is the exemption-list shape `check-raises.mjs` exists to refuse.

Raising it as OS3008 was the other thing considered and it does not work, for a
reason worth writing down: **OS3008's fix sentence is "Use one of {values}", and
here the set of values is empty.** A fix a reader cannot act on is worse than no
fix, and this repository already says so. So the refusal is its own code, it
refines OS3008, and its message and its fix are both true of the program in front
of the reader: this file declares no leg, and the fix is to take the argument
out. It is also refused whether the name was written or computed, because the
value is not what is wrong, which is the whole difference from a set check and is
why a computed leg no longer slips through. The day a file can declare a leg,
OS3008 takes over for a name outside the declared set and OS3023 stays for a file
that declares none.

**What was tried against all of this, because the last three rounds were broken
by the case the fix had not tried.** Across bars rather than within one: a close
working for ten bars; partial fills in sequence and a partial fill that leaves
part of the leg unspoken for; a rejection, a cancellation, an expiry; a close
working while an entry is working, and a position that grows while a close is
working; two tags closed on every bar; a bare close working and then a tagged
one, and the reverse; a leg that flips sign while the old reducing order is still
working; a destination that fills more than it was asked for; a destination that
fills an order it had already reported cancelled; repeated and overtaken frames;
a frame for an order nobody placed; an `onUnconfirmed` bar re-executed four times
with a close working, and the entry beside it; a crossing entry and an
`order.reverse` while a close is working; `cancelAll`; a refused bar's rows
being taken back; each of the four `qtyType` values, with a host filling in units
at a lot size of twenty five; and four thousand bars of alternating entry and
close, which the ledger scan costs sixty seven milliseconds. Ten mutations were
made to the code and every one of them failed a test.

**What is still not held**, and it is the same fact in two places: a quantity
stated on a close in lots, cash or an equity percent may take the position it is
closing past zero, and a crossing entry in those declarations leaves the outgoing
position open because the engine cannot divide the quantity. Both wait on the
instrument's lot size reaching the ledger, which is what the deferral on OS7005
now says, that code being one nothing raises yet, and the money figures of 17.4
for `"cash"` and `"equityPercent"`.

**Files.**

- `src/core/engine/ledger/row.ts`: `Reduction` and `reduces` on the row,
  `workingUnits`.
- `src/core/engine/ledger/closable.ts`: the run-scoped reading, and `closingSide`
  moved here as the one fact two files read.
- `src/core/engine/ledger/ledger.ts`: the reduction rides on the row; the bar's
  own record keeps only the question that is a bar's, OS7013.
- `src/core/engine/ledger/refuse.ts`: `SentOnBar`, which is now OS7013's alone.
- `src/core/engine/ledger/place.ts`: the crossing entry mints in every unit.
- `src/core/engine/ledger/positions.ts`: the average over the side of the net.
- `src/core/check/library.ts`, `library-orders.ts`, `calls.ts`: OS3023.
- `tests/engine/orders-support.ts`: the destination recording both order suites
  assert against.
- `tests/engine/working.test.ts`: the run-scoped invariant, across bars.
- `tests/engine/crossing.test.ts`: the split, in each of the four units.
- `tests/unit/check-calls.test.ts`: OS3023, written and computed.

---

## 45. An input whose title says nothing

**Question.** `input(14, "")` raises OS3021, whose message ends "this one has no
title written as a string literal" and whose fix says "Give it a title written
as a string literal". The reader did. It is empty. CLAUDE.md requires the
message and the fix to be true of the actual program, and both of these tell
somebody to do the thing they have just done. Beside it, a named input with the
same empty title is silently labelled by its name, which may or may not be right
and was decided by nobody.

**Decision, part one. The empty title is its own code, OS3024, refining
OS3021.** Three programs reached OS3021: an `input()` with no title argument, one
whose title is not a string literal, and one whose title is `""`. The first two
are what the sentence describes. The third is not, and widening OS3021's wording
to cover all three would have produced a sentence vague enough to be true of each
and specific enough to help none: the fix for the first two is to write a title,
and the fix for the third is to put something in the one that is already there.
Two fixes are two codes, which is what `refines` is for, and it is how OS3022
sits beside OS3017 and OS3023 beside OS3008.

Both halves of the separation are held: OS3021's two programs still raise
OS3021, asserted in the same test as OS3024's, because a refinement that quietly
swallowed the broader case would be a rename rather than a split.

**Decision, part two. A named input's empty title is no title, and the row takes
the name.** This is the behaviour that was already there, and it is now written
down rather than left to be discovered. The reason it is right, and not merely
convenient, is that the two cases fail for different reasons. An input written
in place has no key but its title, so an empty one leaves a stored value with
nowhere to live and a second such input would collide with it. An input assigned
to a name has its key already; what an empty title costs there is a label, and
`language.md` 13.4 already says a named input with no title takes the name as
its title. The empty string is giving none, so `len = input(14, "")` and
`len = input(14)` are one row, labelled `len`.

**What was considered and refused: trimming.** A title of two spaces is drawn as
a blank row. Reading it as empty would be the specification deciding what
somebody meant rather than reading what they wrote, and the language trims no
other string. It is the label the reader wrote, and 13.4 says so in the open.

**Changes required.**

- `spec/errors.json` and `spec/errors.md`: the OS3024 entry, the part 4 count
  and total, and the part 6 refinements row.
- `spec/language.md` 13.4: the two codes, and the named case stated.
- `src/core/check/checked.ts`, `call-sites.ts`, `check.ts`: `titleWritten` on
  the checked input, and the two reports.
- `spec/feature-matrix.md`: `unit:input/empty-title`.
- `docs/inputs.md`: the three lines side by side, the named case, and the
  troubleshooting row.
- `tests/unit/check-calls.test.ts`: OS3024 written in place and on the
  declaration line, the two programs that are still OS3021, and the named case
  raising nothing.

---

## 46. When a chart descriptor resolves a declaration option

**Question.** `docs/inputs.md` teaches
`study("Oscillator", precision = input(2, "Decimals"))` as "how a reader gets to
change something the declaration decides". Measured through this repository's own
chart adapter, it was not: `descriptorFor(program, options)` took no settings at
all, built every declaration field against an empty map, and gave
`plots[0].priceFormat.precision` the declared default for every settings map in
the world. The engine beside it, handed the same stored value, resolved it. The
last round made the two agree on the settings **key**. They disagreed on the
value.

**Decision. The host states the settings the declared shape is built from, and
the record says which parts follow a later change.** `ChartAdapterOptions` gains
`settings`, and `descriptorFor` resolves every `{ "input": key }` field against
it. A host that keeps one descriptor per study instance passes that instance's
stored settings and builds again when a user changes one.

The honest half is that this cannot be the whole answer. The chart reads `name`,
`placement`, `plots`, `fills` and `alerts` once, off the descriptor, as values
rather than as calls, so those answer the settings the descriptor was built with
and nothing later. `levels`, `range`, the painting hooks and the calculation are
calls, and each resolves against the settings the chart hands it at the moment it
asks. A colour is a third case again: the plot carries the settings key and the
chart reads the colour itself.

**Why the record gains a section rather than a narrowing.**
`spec/chart-narrowings.json` records fields the descriptor **drops**, and nothing
is dropped here: every declared field reaches the chart. What is worth recording
is when each one resolves, which is a different kind of fact, so it is a section
of its own. It is enforced rather than stated:
`scripts/check-chart-surface.mjs` builds two descriptors, moves a plot width
through `options.settings` and a level colour through a call, refuses a
descriptor member that neither list classifies, and names the recorded members
the fixture does not reach instead of passing over them.

**Changes required.**

- `src/adapters/charts/run.ts` and `descriptor.ts`: the option, and the lookup
  built from it.
- `spec/chart-narrowings.json`: the `resolution` record.
- `scripts/check-chart-surface.mjs`: the third question, and the fixture fields
  it moves.
- `tests/adapters/charts/settings.test.ts`: the documented example end to end,
  the engine and the descriptor agreeing on the value, and the half that does
  not follow a later map.

---

## 47. What section 20 fixes, and three sentences that fixed nothing

**Question.** Decision 41 found one sentence in `stdlib.md` section 20 that
constrained nothing, because commutativity made it vacuous. Section 20 is the
manifest a second engine implements from. Is it the only one?

**Decision, part one. No, and the general rule goes in 20.1 so that the next one
is caught by reading.** An arrangement is the order the operations run in, and
nothing else. Three things therefore fix nothing and are never constrained:
naming a subexpression and reading it back, forming the same subexpression
twice, and reordering or regrouping across a commutative operation or across a
power of two. All three were measured rather than argued, and the third carries
its one edge, the subnormal range, in the same bullet.

**Decision, part two. The three sentences.**

- **20.4, `rsi`.** "Rounding the ratio into a named intermediate first and then
  writing `100 - (100 / (1 + ratio))` is the same expression with an extra
  rounding in it" is false. There is no extra rounding: every operation already
  rounds its result and `compiled-program.md` 8.1 leaves no wider register for an
  unnamed intermediate to be kept in. The two spellings are bit identical on
  every value at all three gate lengths. The arrangement that does vary,
  `100 * up / (up + down)`, differs on 31 of 73 values at length 7, 31 of 66 at
  length 14 and 29 of 59 at length 21.
- **20.3, `alma`.** "The denominator of the exponent is formed as
  `2 * spread * spread`, left to right" fixed a grouping that cannot differ: one
  factor is 2, and scaling by a power of two is exact wherever the result is
  normal. Over the kernels built at eight lengths, seven sigmas and six offsets,
  0 of 17598 exponents differ between the two groupings. What does vary is the
  chain of divisions, on 4529 of them, and that is what the entry names now.
- **20.5, `bollinger`.** "The span in `bbPercent` is formed once" is the naming
  case again, standing alone with no second clause doing any work.

**Decision, part three. Two figures that were overstated rather than vacuous.**
20.9's `fade` said its refused arrangement was "a different number at most
percentages": it is 40 of the 101 whole percentages, two in five, which is well
worth refusing and is not "most". 20.7's `toDegrees` and `toRadians` said "a
different number at most arguments": 26 and 29 in every hundred. Both now print
the measured figure, and both figures are asserted by a test.

**What was checked, and how.** Every sentence in section 20 that names a second
arrangement and refuses it was implemented both ways and run over price shaped
data: the window sum against a carried total, `ema`'s three steps, `rma`'s
three, `wma`'s per-term division, `swma`'s grouping, `vwma`'s two extra
divisions, `tema`'s factoring, `psar`'s step, the directional index against the
stochastic association, `cci`'s two divisions, `ultimateOsc`'s addition order,
`variance`'s one pass, `ad` and `eom`'s term order, `round` against
`floor(x + 0.5)`, `correlation`'s two square roots, `mix`, `fade`, `toDegrees`
and `toRadians`. Everything not named above differs on between a quarter and
four fifths of its arguments and is left exactly as it was.

Two sentences are the naming case and are deliberately left: "the span is formed
once" in `stoch` and "the denominator is formed once" in `cmo`. In both the
clause is naming which quantity the absence test is about rather than fixing an
arrangement, and the sentence it sits in says so.

**Changes required.**

- `spec/stdlib.md`: the 20.1 bullet, and the `rsi`, `alma`, `bollinger`, `fade`,
  `toDegrees` and `toRadians` sentences.
- `tests/gate/rsi.test.ts`: both halves of the corrected `rsi` paragraph,
  measured against the gate fixture and against the engine's own column.
- `tests/stdlib/maths.test.ts`: the three figures section 20 now prints.
- `tests/stdlib/section-20.ts`: the figures are **read out of the page** rather
  than typed into the test beside it, on the shape `tests/gate/gaps.test.ts`
  already uses for 20.11's table. Rewording a claim, moving its figure or
  changing its population fails a test instead of going on being quoted, and a
  pattern loose enough to match two sentences is refused by name, because the
  first draft of that helper read the `ema` figures into the `rsi` test.

---

## 48. What a number outside every declared block is, and what a check may claim

**Question.** `scripts/check-error-codes.mjs` walked `.md` files under a
docstring saying "nothing else in the repository gets to invent one". Source
comments cite codes heavily, and changing one in a comment to a code the
catalogue does not define passed the whole of `npm test`. Widening the walk to
the tree runs into the four checks that name a fabricated code on purpose, so
that their own self tests cannot be disarmed by a correction to the catalogue.

**Decision, part one. The walk is the whole tree, and a citation outside every
declared block is not a code.** `errors.json` declares which thousand blocks
exist and no entry is ever numbered outside them, so a fabricated number in an
unused block is not a code that has gone missing. Those citations are counted,
and the files holding them are named in the passing line, because the
alternative is a list of exemptions inside the checker, which this repository
refuses for the reason `check-raises.mjs` gives at length: a list there is read
by nobody and grows by a line whenever somebody is in a hurry. The rule stays
derived from the catalogue rather than written beside it, and the check attacks
its own two rules on every run.

**Decision, part two. A check says what it covers, in its output as well as in
its docstring.** `scripts/check-names.mjs` enforces CLAUDE.md rule 5 with a
fixed list of eighteen products and thirteen indices and instruments. Proved
both ways: a name on the list is caught in any file, a name that is not on it
passes. That is the only mechanizable form of "name nobody", so the defect is
not the check: it is the rule being written as though a check covered it.
CLAUDE.md now says what is mechanical and what is attention, and the check's
passing line says the same, because the failure mode here is not a missed name
but a green build read as proof of something wider.

**Changes required.**

- `scripts/check-error-codes.mjs`: the widened walk, the declared blocks read
  from `errors.json`, the self test, and the counted citations outside them.
- `scripts/check-names.mjs`: the reach in the docstring and in the passing line.
- `CLAUDE.md` rule 5: what the check covers and what remains attention.

---

## 49. Which position an order is sent against

**Question.** Three rounds corrected how much a reducing order may send: against
the call, against the bar, then against the run. None asked which position an
order carries. `entering` decided whether an order crossed by comparing its side
against `ctx.size()`, which is folded from settled fills, and attached it with
`ctx.reference()`, which is whichever position is current. With a silent
destination `buy(qty = 6)` and then `sell(qty = 9)` a bar later put both orders on
position 1, which opened six long and settled three short: one reference holding
both signs, which is the one failure 17.1 names, because a fill arriving late can
no longer say which position it settled. Three more shapes reach the same root,
and none of them is a regression: the branches are at `cc79ff9` and earlier and
were never run, because every fixture for an opposing order spelled it `close()`
and a close takes the reducing path.

**Decision, part one. A position is measured by what is on it, settled and
working together.** A reference with six units of buy still to come is a long
position whether or not any of it has settled, and an opposing order takes those
six off it before it opens anything: otherwise nothing can bring that reference
back to zero, which is 17.7's sentence about how a position ends. The consequence
worth stating is a property rather than a fix: **the orders a bar sends do not
depend on how fast the destination answers.** Measured from the settled net, the
same two lines of a script send two orders on a fast day and one crossing order
on a slow one, and only the slow one is wrong.

**Decision, part two. What an opposing entry may take and what a close may send
are two different numbers.** An entry is sent at the size the script wrote
whatever the leg holds, so the only thing being decided is where its units land,
and it may be divided against a position that has not settled. A close works its
own quantity out, so it may only work out one that has settled: a close counting
an entry still working would sell units that may never exist, which is
`closable.ts`'s rule, and this is that rule read per position. Both numbers live
on the same `Holding`, so neither can be reached by accident.

**Decision, part three. An order that spans more than one position is that many
orders.** The reason is 17.1's own, the reason the flip is two orders: one order
against two positions leaves a late fill unable to say which it settled. A leg
holds more than one position whenever an order that opposes it is outstanding, so
`flattening` divides across the positions holding the leg's own side, oldest
first, bounded by what has settled on each.

**Decision, part four. What is a reduction is decided by direction, not by
record.** A row records what it reduced at the moment it was sent, and a position
that has moved since is being reduced from the other side: an order recorded as
adding is a reduction now. `closable.ts` already made half of that correction, on
the side an order is on; it counted only the rows carrying a reduction, so an
unanswered entry on a leg the orders after it took the other way was not held
back and a close was offered twelve units, five of which were already on their
way. The same reading per position is what keeps a close off a reference whose
settled quantity is already spoken for.

**Decision, part five. Whether an order adds or reduces is the mapping's
answer.** `isEntry` read the leg's net, which is flat while an entry is unanswered
and therefore calls every order an entry, and long while a leg is being flipped
and therefore calls neither half of the flip one. The mapping has already divided
the call into what comes off a position and what opens one, so OS7008 reads that.
And what pyramiding counts is the entries the leg holds **in a direction**, which
`language.md` 13.3 says and which used to be the same number as the entries on one
reference. It is not any more: an entry placed while the whole of a position is
already going opens one of its own, so a count keyed to a single reference reports
none and lets a declaration of one entry hold two.

**What is not kept, stated rather than left to be found.** A reference settles on
the side it did not open on only when an order on it was never answered in full:
still going, or ended rejected, cancelled or expired with part of its quantity
unfilled. An entry divided against an unanswered entry is placed against units
that may not arrive. The alternative is holding an order back until the
destination answers, which is an engine that stops trading when a destination is
slow, and 17.1's own reason is kept either way. Six thousand generated runs over a
destination that answers late, out of order, partially, with a rejection and not
at all: every reference all of whose orders were answered in full ended on the
side it opened on, and every reference that did not had an order that was never
answered in full.

**And the half outside units.** Dividing a stated quantity into a closing half
and an opening half needs the lot size, which is what OS7005 is deferred on, so
an opposing entry in lots, cash or an equity percent is still one order. Two
things are now held without it. The reference is minted whether or not anything
has settled, which is this decision's own defect wearing another unit and was not
held before: with the destination silent, both orders went on the outgoing
reference in all three of those units. And the outgoing position is named again,
because a close works its own quantity out in units and is divided across the
positions holding the leg's side, so it returns to zero as soon as the leg's net
comes back to that side. What is not held is the instruction closing it, and a
leg whose net never returns there carries the position for the life of the run.
That sentence is in OS7005's deferral, in 17.1 and in 17.7, and both halves of it
are asserted in `tests/engine/ending.test.ts` rather than described.

**Changes required.**

- `src/core/engine/ledger/holdings.ts`: new. What a leg holds per position
  reference, the two numbers, and the division.
- `src/core/engine/ledger/sizing.ts`: new, split out of `place.ts`, which reached
  the 500 line limit and was two subjects by then: what a call means, and how much
  each of its orders sends and against which position.
- `src/core/engine/ledger/row.ts`: `units` on the row, the order's own quantity in
  units where the engine can read it, which is what makes a position being opened
  visible before any of it has settled.
- `src/core/engine/ledger/positions.ts`: `sizeOf`, and `reference` left to the one
  caller that sends no order.
- `src/core/engine/ledger/closable.ts`: `committed` counts every order still going
  on the side that reduces what the leg holds now.
- `src/core/engine/ledger/refuse.ts`: OS7008 reads the mapping's answer and counts
  the entries the leg holds in a direction.
- `spec/stdlib.md` 17.1 and 17.7; `spec/errors.json` and `spec/errors.md` OS7005's
  deferral and OS7017's cause; `spec/feature-matrix.md`, six rows.
- `tests/engine/attaching.test.ts` and `tests/engine/ending.test.ts`, and
  `reversed`, `settledBook` and `sentOn` in `tests/engine/orders-support.ts`.
- `docs/strategies/orders.md` and `docs/strategies/reading-the-books.md`.

---

## 50. What a stored setting the engine will refuse is worth to the chart

**Question.** Decision 46 made the chart's declared shape resolve a declaration
option against the settings the host states. It did not ask what happens when the
host states a value the input's own declaration forbids. Measured: on
`study("S", precision = input(2, "Places", min = 0, max = 8))`, a settings map of
`{ Places: 99 }` gave `plots[0].priceFormat.precision` of 99, and `{ Places: -4 }`
gave -4. The engine refuses that map with OS6019 and nothing is drawn, so the
number never reaches a column; but the descriptor was handed over first, and a
host can put a precision in a legend or on a price scale before it asks for a
bar. Beside it the adapter kept a second answer to the same question: `null` and
an object were nothing stored and read as the declared default, while
`engineSettings` passed both through for the engine to refuse, and a stored `"7"`
read as neither, landing on the chart's own fallback of 4. Four answers to one
question.

**Decision, part one. One question, and the engine's own check answers it.**
`src/core/engine/inputs.ts` gains `checkSetting`, which is what `resolveInputs`
refuses with, and the adapter asks it before a load exists. A second copy of the
types and the bounds inside the adapter would be the same fact in two files,
which is CLAUDE.md's sixth rule, and the failure above is what that rule
predicts: two copies, each read as authoritative, answering differently.

One answer is narrowed, and it is narrowed where the fact does not exist yet. A
`"time"` input's stored string is read by the host's own conversion, which
`run.ts` holds and `settings.ts` does not, so a caller with no resolver takes a
string on trust and the load decides it. Every other kind is decided in one
place.

**Decision, part two. A value the engine will refuse reads as the declared
default in the declared shape, and travels to the engine unchanged.** Three
answers were possible and the other two are worse.

- **Carrying the stored value into the shape** is what was there. It hands a host
  a number the language will not produce, in a member whose whole purpose is to
  say what the study is, at the one moment the host has nothing else to go on.
- **Repairing the value on the way to the engine** is the trap `2.6` and this
  module's own first paragraph are written against: a settings dialog that
  silently ignores what a reader typed. Nothing is repaired. The stored value
  reaches the engine exactly as the host holds it, and OS6019 names the key and
  the bound.
- **Refusing to build the shape at all** reads as the strictest answer and is the
  one that traps a reader. The settings dialog is built from the descriptor's
  `inputs`, so a study that refuses to describe itself is a study whose bad
  setting cannot be reached: the reader is left with an error, no rows, and no
  way to put the value back in range.

What is left is the declared default, which is not invented. It is what the
script declares, it is what the shape showed before any of this existed, and it
is what the study draws the moment a settings map the engine takes arrives.

**Decision, part three. The signature the incremental path compares is taken from
what the engine is handed.** It was taken from the effective value, and under
part two every refused value shows the same declared default, so a change from a
setting that runs to one that cannot would read as no change at all: the held
engine would be kept and the study would go on drawing the old numbers instead of
reporting OS6019. The kind is spelled beside the value for the same reason,
because a stored `7` and a stored `"7"` spell one string and the engine takes one
of them.

**How it is checked.** `scripts/check-chart-surface.mjs` gains a fourth question,
on the field question 3 already moves: a plot width declared `min = 1, max = 10`
is stored as 99, as `"wide"` and as `null`, and both halves are read each time,
the shape holding the declared default and the run stopping with OS6019. Either
half alone is half a rule, which is how this defect arrived: the half recorded
last round was the value reaching the engine.

**Changes required.**

- `src/core/engine/inputs.ts`: `checkSetting` and `SettingCheck`, with
  `resolveOne` reduced to what it does with the answer; `src/core/engine/index.ts`
  exports both.
- `src/adapters/charts/settings.ts`: `effectiveValue` asks `checkSetting`, and
  `signatureOf` spells the stored value and its kind.
- `scripts/check-chart-surface.mjs`: the fourth question, and `min` and `max` on
  the fixture's width input.
- `spec/chart-narrowings.json`: `resolution.unusable`.
- `docs/inputs.md`: what the study shows while a saved value is refused.
- `tests/adapters/charts/settings.test.ts`: both answers for eight stored values,
  a colour of the same shape, and the two incremental cases.

---

## 51. What kind of sentence section 20 keeps writing, and the test it has to pass

**Question.** Decision 41 found one sentence in `stdlib.md` section 20 that
constrained nothing. Decision 47 found three more and wrote the general rule into
20.1 as a list of three instances. A fourth has now been found in the same
section, `swma`'s "the two middle terms are formed as `2 * value`", where
`value * 2` and `value + value` are bit identical on every finite value. Four in
three rounds is a pattern, and a list of instances has now failed twice to catch
the next one.

**Decision, part one. State the rule, and keep the instances under it.** An
arrangement is **where one rounding falls relative to another**, and nothing
else. Two things follow, and they are what the four instances have in common:
only an operation that rounds can be part of an arrangement, and two operations
that do not read each other have no order between them. The list stays, because
an implementer reading one entry wants the case in front of them named, but it is
now four items under the rule rather than standing in for it, and the fourth item
is the one no list had: the exact respelling of a step that does not round, a
doubling written `2 * v`, `v * 2` or `v + v`, a halving written `v / 2` or
`v * 0.5`.

**Decision, part two. The test a sentence has to pass to go in section 20.** Name
the second arrangement it refuses, and count where the two differ. A clause with
no second arrangement to name is not a constraint; a clause whose count is zero
is one of the four items in a new spelling. Every withdrawn sentence fails that
test and fails it the same way: it fixed something about one operation on its
own, which way round its operands sat, whether its result was named, which of two
exact spellings produced it.

**Decision, part three. `swma`, both halves, with the figures.** The addition
order is real and is now measured: over twenty thousand four bar windows of
ordinary prices, pairing the four terms differs on 5281, adding them right to
left on 7230, and dividing each term by 6 as it is added on 9564. The doubling is
not: over 25176 values covering every binade of the double range in both signs,
the subnormals included, the three spellings never differ.

**Decision, part four. The sweep, and the two more it found.** Every sentence in
section 20 was read against the test. Two fixed the order of accumulations that
do not read each other, which is the fourth item: `linreg`'s "the two
accumulations run in one pass over the window" and `covariance`'s "the three
accumulations run in one pass over the window, in that order". Neither total
reads another, so each adds its own terms in its own order whatever the structure
around it, and an implementer sent to reproduce the interleaving was sent to
reproduce nothing. Both entries now fix what is real, that each total runs oldest
first, and `covariance` says what its two passes do fix, which is that both means
are finished before any deviation is taken. `variance`'s two passes are the
opposite case and are untouched: its second pass reads the first one's mean.

Three more were read closely and left, each for a stated reason. `stoch`'s "the
span is formed once" and `cmo`'s "the denominator is formed once" are the naming
case, and decision 47 left them because in both the clause names which quantity
the absence test beside it is about; that is still true. `bollinger`'s and
`psar`'s "one rounding of the product and one of the sum" pass the test only
because the arrangement they refuse is the fused multiply and add, which 20.1's
first bullet already refuses for the whole section: they are restatements rather
than constraints of their own, and they are left because the restatement is true
and is worth meeting twice by an implementer reaching for an FMA.

**What a check can and cannot do here.** It cannot decide whether a new sentence
is vacuous. Deciding that means implementing the two readings of it and running
them, and the sentences that fail are exactly the ones that name no second
reading to implement, so there is nothing for a checker to read. What the test in
part two does is turn an undecidable property into a decidable one: a sentence
that names its second arrangement and prints a count is a sentence a test can run
both ways, and `tests/stdlib/section-20.ts` reads the counts out of the page
rather than from a constant typed beside the test, so rewording a claim, moving a
figure or changing its population fails. A check that scanned the prose for the
withdrawn phrasings would catch a sentence coming back word for word, which is
not how any of these four arrived, and would state a reach it does not have.

**Changes required.**

- `spec/stdlib.md` 20.1: the rule, the four items, and the test.
- `spec/stdlib.md` 20.3: `swma`'s two halves with their figures, and `linreg`'s
  accumulations.
- `spec/stdlib.md` 20.8: `covariance`'s accumulations, and what its two passes
  fix.
- `tests/stdlib/section-20.ts`: `differingOver`, `everyBinade` and
  `priceWindows`, the two populations the figures above are measured over.
- `tests/stdlib/maths.test.ts`: `swma`'s three refused arrangements and its three
  dead spellings, read out of the page, and the fourth item measured directly,
  three accumulations interleaved and taken apart.

---

## 52. The side of a close, and the two numbers a reference is read from

**Question.** Issue 0018 corrected which position an order is sent against. Two
shapes were scoped out of that correction, one by unit and one by direction, and
each is reachable from an ordinary script. `place.ts` took the direction of a
tagged close from the leg's net rather than from the part the tag names, so a
leg holding ten long under tag A and four short under tag B answered
`close(tag = "B")` with a sell of four: tag B went to eight short, tag A's long
was cut to six, and a call named close had opened position. And `holdings.ts`
read a reference's side from what had settled plus what a reduction claimed of
the leg when it was sent, two numbers that drift: a second stated close claims
nothing, because the first already spoke for the whole leg, and it still fills
and still reduces what has settled, so the sum went negative, the reference read
as the side it is not on, and an opposing entry was handed it as an order that
adds. Under a declaration counting in lots, `buy(qty = 10)`, two closes of one
and a `sell(qty = 9)`, every order answered in full, left reference 1 having
opened ten long and settled one short. Neither behaviour was pinned by any of
the 1414 tests: a mutation fixing each one left the whole suite green.

**Decision, part one. The side of a close comes from the part it is
flattening.** A tag names a part of the position and a part has a sign of its
own, so the side that reduces it is a question about the part and not about the
leg. The two agree on every leg holding one sign and disagree on the one shape a
hedge is written in. 17.2 already said of the reading that takes the leg's net,
for a stated quantity, that it would let `close` open a position; this is the
same sentence for the side, and `closable.ts` had the signed holding in hand
already.

**Decision, part two. A part is measured on its own side, and the leg bounds it
only where they are on one side.** Both halves are the first decision read once
more. What is already working against a short part is a buy, which the leg's net
calls an addition, so a count taken from the leg does not see it and the second
`close(tag)` sends the part again: four short became eight short one bar later
than the headline and by the same reading. And bounding a part by the leg is
right only where closing it takes the leg towards zero: on the other side it
moves away from zero, so a part ten short under a leg two long is closed by ten,
and under a leg netting nothing it is still closed by ten rather than by nothing
at all. What bounds that order is each position's own settled quantity, so a
part whose position has returned to zero sends nothing rather than opening it.

**Decision, part three. A claim is not a size, and the reader that needs a size
gets one.** A reduction carries what it claimed of the part when it was sent,
which on an order the engine cannot count in units is the whole of what was left
to close, and that is the only reading 17.1 allows there. That number answers
one question, how much of a part is already spoken for, and `closable.ts` is its
one reader. `holdings.ts` asks a different question, which side a reference is
on, and it compares against what has settled there, so it reads the order's own
quantity in units, which the row already carries and which falls as a fill
arrives. The two halves of that sum now cannot drift, because they are the same
kind of number about the same order. The field is called `claimed` rather than
`units` so that the next reader cannot make the same mistake by autocompletion.

**Decision, part four. The position a close the engine cannot size is sent
against.** The book of what a leg holds leaves out a reference whose whole
settled quantity is already inside an order the destination still has, which is
right for a close that works its own quantity out: there is nothing left there
for it to send. A close whose quantity the engine cannot read is not choosing a
number, so that exclusion is not about it, and taking the book's answer alone
handed it the reference an entry was opening on the other side: with the leg's
long entirely inside a working close, `close(qty = 1)` in cash was a sell on the
reference a short entry had just opened. It goes on the oldest position holding
the side it reduces, and where the leg holds none it sends nothing, because a
close is never minted a position of its own. This one was found by the property
fuzz rather than by reading.

**Decision, part five. A bracket names the position it protects, and no position
where there is none.** `bracketing` labelled its intent with a reference that
was minted when the leg was flat, so a script whose first order call is `exit()`
or `order.bracket()` burned reference 1 on an instruction that appends no row
and moves nothing: the buy after it opened on reference 2, and the bracket
carried a reference no order ever shared, which a host reconciling the two
cannot find on the other side. A bracket carries the position the leg is holding
or opening, and `0` otherwise, which is what a cancellation already carried for
the same reason: neither is an order and neither has a position of its own.
`host-interface.md` 7.1 says it, because a host is the party that has to read it.

**Decision, part six. `order.reverse`'s opening half mints unconditionally, and
that is correct by construction.** It is the one entry that never passes the
division issue 0018 installed, which is worth an answer rather than a shrug. A
reference minted there has nothing on it, so that order cannot cross it and
cannot settle it on a side it did not open on. Routing it through `entering`
instead is not merely unnecessary, it is a defect, and a run says so rather than
an argument: the orders of a call are all mapped before any of them appends a
row, so the closing half is not in the ledger yet and the opening half is
divided against the very position the closing half is flattening. `buy(qty =
10)` and then `order.reverse()` became two sells of ten on reference 1 with
nothing at all opening the replacement, and reference 1 opened ten long and
settled ten short. Three existing tests fail on it, and `parts.test.ts` now pins
the reference as well as the quantities. What the opening half does depart from
is 17.7's "joins the position on its own side": it mints even where the leg
holds a position on that side already. That costs an extra reference and no
correctness, every reference it makes can still be closed, and it is recorded
here as decided rather than left to be discovered.

**What is not pinned, stated rather than left to be found.** `workingUnits` no
longer subtracts a fill from a claim the engine could not count in units, which
is the same unit mixing one scope out: the claim stands whole until the order
ends, which is what 17.1's sentence says in the first place. No test fails when
that is put back, and the reason is worth writing down rather than leaving for
somebody to find. `holdings.ts` blocks a reference carrying an unreadable
reduction, so the difference between the two readings is invisible at the
destination in every shape that could be built for it, and a test asserting it
would be asserting a number rather than a behaviour.

**How it was tested.** Nine examples on the destination's own inbox, one of
them measuring what the destination's answers come to rather than what the
engine kept, and a property fuzz over two thousand generated scripts of ten bars
each, against a destination that answers late, partially, out of order, with
rejections, with more than was asked, with a frame repeated, with a stale
cumulative quantity restated after a later one, and not at all. The oracle is
folded from what the host sent and what it answered and reads nothing the engine
kept, on purpose: an oracle folded from the ledger agrees with the engine by
construction, which is how both of these defects passed 1414 tests. It holds
three sentences: no order takes a reference from one sign to the other, a
reference that opened on one sign never ends on the other, and an order sent to
flatten a part is on the side that reduces that part. What 17.1 does not answer
for is written into the walk rather than into each property, and it is narrow on
purpose: excluding every reference a close in lots was ever sent against also
excludes this issue's own measured script, where not one order was larger than
what the reference held.

Every fix was then mutated back, one at a time, and the suite run against each:
the examples and the fuzz between them catch all of them, and the fuzz alone
catches the two the issue was opened for. Twenty thousand runs of fourteen bars
on seeds no committed test uses found nothing further.

**Changes required.**

- `src/core/engine/ledger/closable.ts`: `closingFor`, the part's own holding as
  one function, `committed` on the part's own side, and the leg bounding a part
  only where the two are on one side.
- `src/core/engine/ledger/place.ts`: the close's side from the part, and the
  bracket's reference.
- `src/core/engine/ledger/row.ts`: `Reduction.claimed`, and `workingUnits`
  holding a claim it could not count whole until the order ends.
- `src/core/engine/ledger/holdings.ts`: every row read by its own quantity in
  units, and `outgoingFor`.
- `src/core/engine/ledger/sizing.ts`: the unsizable close's attachment, and the
  call sending nothing where the leg holds no position on that side.
- `src/core/engine/ledger/positions.ts`: `attached`, which mints nothing.
- `spec/stdlib.md` 17.1, 17.2 and 17.7; `spec/host-interface.md` 7.1;
  `spec/feature-matrix.md`, six rows.
- `tests/engine/parts.test.ts`, `tests/engine/fuzz.test.ts` and
  `tests/engine/fuzz-support.ts`, all new.
- `docs/strategies/orders.md`, `docs/strategies/reading-the-books.md` and
  `docs/reference/functions/strategy.md`.

## 53. What a zero in section 20 means, and the half of 20.1 a check can carry

**Question.** Decision 51 wrote the test a sentence in `stdlib.md` section 20
has to pass: name the second arrangement it refuses, and count where the two
differ. It also left `linreg`'s "the sums over `x` are constants of `len` and
are formed as written" in place, judged borderline, on the grounds that editing
it would need a measured refusal nobody had. There is one, and a sweep of the
section for the same shape found a second sentence of it and a third sentence
that was simply false.

**Decision, part one. `linreg`, with the figures.** The blanket covered two
halves and only one of them can be failed. The half that can: the sum of squares
is one product divided once by 6, and splitting the divisor into the 2 and the 3
it is made of, `(((len - 1) * len) / 2) * ((2 * len - 1) / 3)`, is a different
number on 3716 of the whole lengths from 1 to 100000, the first at a length of
15, where it gives 1014.9999999999999 against 1015. The half that cannot: the
grouping of the products. Every pairwise product there is a whole number below 2
to the 53rd at any length a window can have, so whichever pair is multiplied
first is exact and the second multiplication rounds the same true product once.
Both halves are now written out with what they were measured over.

**Decision, part two. A zero is not always one of the four.** 20.1 said a clause
whose count is zero is one of its four items in a new spelling. `linreg`'s
product regrouping is not: both spellings are roundings, and what makes them
agree is the size of the operands rather than the shape of the step. So the
sentence in 20.1 now says a zero fixes nothing whatever the reason, that most
zeros are one of the four, and that a zero is written down with the population
it was measured over and with the edge where it stops being one: for the sum of
squares that edge is a length of 67108869, where a pairwise product stops being
exact.

**Decision, part three. `wma`'s divisor, which is the fifth vacuous sentence.**
"The divisor is computed as written" reads as a constraint and is not one.
`(len * (len + 1)) / 2`, `len * ((len + 1) / 2)` and `(len / 2) * (len + 1)`
differ only in where a halving falls, which is exact, and adding the weights 1
to `len` up reaches the same whole number. Over the lengths 1 to 100000 none of
them differ. The entry now says so, and keeps the sentence beside it that does
bite: the divisor meets the finished total rather than each term as it is added.

**Decision, part four. 20.2.1 said something false, not merely empty.** "It is
not bit-identical to a fresh sum on any bar" is wrong: a carried total agrees
with a fresh sum wherever the roundings happen to cancel, which over a walk of
twenty thousand bars is 236 of the 19981 windows at length 20. A reader who
checked the claim on one of those windows would have concluded the two
arrangements were the same one. What is true is measured and now printed: it
differs on 19745 of those 19981 windows, and the gap grows with the history, 4.5
ulps at worst over the first thousand windows and 40.3 over the last thousand.
`compiled-program.md` 8.3 is untouched, because what it says is that the
algorithm is not bit-identical to a fresh sum, which is a statement about the
two algorithms rather than about every bar.

**Decision, part five. The mechanical half of 20.1, as a check.** Deciding
whether a sentence is vacuous cannot be mechanised, for the reason decision 51
gives. Keeping its figure honest can be: `scripts/check-section-20.mjs` reads
every count section 20 prints and requires each one to sit inside the span of
the page that some test's own `figuresIn` pattern matches. A figure quoted in
the section and measured nowhere is now a red build. The check states what it
does not reach, as `check-names.mjs` does: a count is recognised by a list of
written shapes, coverage is positional rather than by value so that a new
"differs on 31" cannot ride on an unrelated sentence's 31, and whether the
sentence beside the figure is worth making stays attention. It found the three
figures `ema` prints, which were quoted in a test comment and asserted by
nothing: that test now reads them out of the page and asserts the counts
exactly, where it used to ask only that some bar differed.

**What the sweep measured.** Forty-one arrangements across 20.2 to 20.9, each
implemented both ways and run. Thirty-four constrain on the values the function
carries. Two constrain only outside it: `2 * a - b` against `a + (a - b)`, in
`hma`'s `raw` and in `dema`, never differs while the two averages are within a
factor of two of each other, which is where two averages of one series always
are, and differs on 5773 of 20000 pairs spread across nine decades. Neither
entry names that second arrangement, so neither sentence changes. Five fix
nothing at any length a chart can have, and all five are the two sentences above.

**The sweep, entry by entry, so the next reader starts from the map rather than
from the section.** Each was implemented both ways and run; the figures are this
round's measurement rather than normative text, which is why they are here and
not in the page: a count printed in section 20 has to be measured by a test, and
writing twenty of those was not this round's job. The sentences all constrain,
which is what the page claims of them.

- 20.2.1 a carried total, 20.3 `wma`'s per term division, `rma` against the
  exponential shape and against `running + (value - running) / len`, `vwma`'s
  two means, `tema` regrouped, `psar`'s step as
  `(1 - a) * stop + a * extreme`, `ichimoku`'s third element recomputed, and
  `adx`'s association of the hundred: every one differs on between a quarter and
  all of its population.
- 20.2.2's seeding from bar 0 is the one whose count looks small and is not: at
  length 20 over a four thousand bar walk it differs on about three hundred
  bars, and every one of them is early, from bar 19 to bar 321 and none after,
  because the seed decays and the two lines converge. The entry claims it is
  materially wrong until it does, which is what the shape of the difference says
  rather than what its count says.
- 20.4 `stoch`, `roc`, `trix` and `tsi`'s association the other way, `cci`'s
  numerator as two divisions, `ultimateOsc`'s three terms regrouped and divided
  term by term: 4301 to 9883 of 20000 each.
- 20.5 `variance` in one pass differs on all 3981 windows measured, the two band
  readings recomputed from the basis and the width on about 19450 of 20000 each,
  `chop`'s association on 7286, `hv` annualised inside the root on 7031.
- 20.6 the `ad` term with the volume divided into the span first, `pvt` with the
  volume met before the division, `eom` with the division taken first: about
  1380 of 4000 bars each.
- 20.7 `round` against `floor(x + 0.5)` differs on every exact half below zero
  and on 2456 of 5000 values just below a half, and `round(x, decimals)` scaled
  by the reciprocal on 4337 of 20000.
- 20.8 `percentile` interpolated as a weighted pair on 5200 of 20000,
  `percentRank` with the division first on 31405 of 125250 rank and length
  pairs, `correlation` by the root of a product on 7468 of 20000, `avgSkip`
  divided by `len` on all of them.
- 20.9 `mix` as a weighted pair on 5290 of 20000 channels and 5987 of 20000
  alphas. The alpha is not rounded, so that difference reaches the chart
  outright, and the rounded channels are reachable too: from 4 toward 214 at a
  weight of 0.35 is 77.5 written as the page writes it and 77.49999999999999
  written the other way, which is 78 against 77 after 11.2's rounding.

**Changes required.**

- `spec/stdlib.md` 20.1: what a zero means, and what the check does and does not
  reach.
- `spec/stdlib.md` 20.2.1: the carried total's real counts and its drift.
- `spec/stdlib.md` 20.3: `linreg`'s two halves, and `wma`'s divisor.
- `scripts/check-section-20.mjs`, new, and `package.json`'s `test` script.
- `tests/stdlib/arrangements.test.ts`, new, and `walk` in
  `tests/stdlib/section-20.ts`.
- `tests/gate/ema.test.ts`: the three figures read out of the page.
- `tests/stdlib/maths.test.ts`: `alma`'s second population read as well.
- `CLAUDE.md`: fourteen checks.

---

## 54. Which position a bracket names, and why it cannot be a stored slot

**Question.** Decision 52 part five settled that a bracket carries the position
the leg is holding or opening and `0` where the leg holds none, and stopped
minting one. It left the answer where it found it: a field on the position book
holding the reference minted most recently, set by `mint` and cleared when that
one reference returned to zero. Is that field an answer to the question the
sentence asks?

**It is not, and it is wrong in both directions.** The field records which
reference was minted last, and the sentence asks what the leg holds. The two
part company the moment a leg holds more than one position, which it does
whenever an order that opposes it is outstanding, and that is the ordinary shape
this section has spent five rounds on rather than an exotic one.

**Reported as holding none while holding something.** `buy(qty = 10)` filled,
`sell(qty = 15)` divided into ten against the first position and five opening a
second, an ordinary partial fill of four on the first order, and `buy(qty = 5)`
closing the second. The second reference returns to zero, the field it set is
cleared, and the leg is still holding six of the first. An `exit()` on the next
bar went out with `positionRef` of `0`, which `host-interface.md` 7.1 tells a
host means there is no position to look up. A host resting protective orders
against it has nothing to rest them against, and the reading is not recoverable
from anything else on the intent.

**Naming a position that never opened.** The same field read the other way. A
reference minted for an order the destination then refuses is never cleared,
because nothing settles on it, so it stays the answer for every bracket after
it. `buy(qty = 10)` filled and `sell(qty = 15)` refused in both halves leaves
the leg holding ten on reference 1, and the bracket carried reference 2, which
holds nothing and never will. That is the same defect decision 52 part five
removed at the mint, arriving through the field instead.

**Decision. The reference is derived from the leg's own book, holding first and
opening second**, which is the order 17.7 states them in, and the newest where
the leg holds more than one. The newest is the reference an entry on that side
would join, so a bracket set after an entry names the position that entry is in.
Nothing is stored: `holdings.ts`'s `protecting` reads the rows and the position
book, which is the same pair every other question in this file is answered from,
and `Positions` loses the field and the `opened` flag that existed only to clear
it. Two properties follow and a host may rely on both: the reference on a
bracket is one some order of the same run also carries, and where it is not `0`
the strategy holds something on it.

**How it was found.** Not by reading. A host written from `host-interface.md`
alone, driving the engine and folding every property from the intents it was
handed and the frames it sent back, over fifteen hundred generated scripts: five
brackets carried `0` while the leg held a position. The two shapes above are
those runs reduced by hand. Nothing in the suite failed: 1427 tests passed over
a bracket naming nothing while the strategy carried six units, which is what
happens when a fix is scoped to the sentence that was wrong rather than to the
question underneath it.

**Changes required.**

- `src/core/engine/ledger/holdings.ts`: `protecting`, new.
- `src/core/engine/ledger/place.ts`: `bracketing` asks it.
- `src/core/engine/ledger/positions.ts`: the stored slot and the `opened` flag go.
- `src/core/engine/ledger/sizing.ts`, `ledger.ts`: the context loses `attached`.
- `spec/stdlib.md` 17.7 and `spec/host-interface.md` 7.1: which position is
  named where a leg holds more than one.
- `tests/engine/parts.test.ts`: the two shapes above.

---

---

## Applier index

Seven appliers, each owning its own files and nobody else's. A decision touching
two owners is listed under both, and the text to write is in the decision.

| Applier | Files | Decisions and register entries |
|---|---|---|
| 1 | `spec/stdlib.md` | H1, H2, H6, H7, H8, H9, H10, H12, H13, H15, H16, H17, H18, H21, H22, H23; 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33 |
| 2 | `spec/host-interface.md` | H1 to H13, H16, H17, H18, H19, H20; 23, 24, 25, 26, 29, 32, 33, 34, 36.5, 36.6 |
| 3 | `spec/language.md`, `spec/compiled-program.md` | H14, H15, H18, H19, H20, H23, H24; 27, 28, 29, 34, 36.3, 36.6 |
| 4 | `spec/errors.md`, `spec/errors.json` | H14, H21; 27, 29, 30, 33, 36.1, 36.2, 36.5 |
| 5 | `spec/README.md`, `spec/feature-matrix.md`, `spec/conformance.md` | H16, H17, H19, H20, H22; 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 36.4 |
| 6 | `docs/` | H9, H12, H13, H20; 25, 26, 32, 34, 35 |
| 7 | `examples/` | H9; 25 |

Two standing reminders, the same ones this file opens with: every change to a
per-code section of `errors.md` is the same change to the matching field of the
same entry in `errors.json`, and every `feature-matrix.md` row added here must
satisfy the five rules in that file's preamble, with a test identifier that
appears nowhere else. `npm test` passes after every edit.

## 55. (P6) Whether the engine learns the destination's mode

**Question.** Should the engine be told whether the destination it sends orders
to is sandbox or live, and compare a token at load so that a script can only run
against a live destination when the host has deliberately switched it?

**Decision.** No. The engine does not learn the destination's mode, compares no
token, and raises nothing about it. `stdlib.md` 17.13 stands as written:

> Switching it to live is a separate, deliberate act performed on that one
> strategy in the host, and **nothing in a script can perform it**: there is no
> call, no option and no input that switches anything.

**Why.** The proposal was made to give the engine something to enforce, on the
argument that a boundary the engine cannot see is a boundary this repository
cannot test. That is true and it is the weaker concern. A token the engine
compares is a token a script can be written to satisfy, and the moment the mode
is a value the engine holds, it is a value some path can be found to read. The
guarantee 17.13 makes is stronger precisely because the engine holds nothing:
a misconfigured script found after the fact cannot have been placing real
orders, because there is no state inside the program's execution that decides
where an order goes. The boundary lives in the host, where the switch is a
deliberate act on one strategy, and the host is the thing with a user in front
of it. What this repository can test is that no such call, option or input
exists, which the library manifest already fixes; the host tests its switch.

**Edits.** None to the specification. This minute is the record, so that the
question is not answered again the other way by somebody reading the engine
alone. One note for the first host, outside this repository's remit: its
interface names the two modes *Live* and *Sandbox*, whatever this document
calls the act of moving between them.

## 56. A lower minor of the same format major loads

**Question.** `compiled-program.md` 9.4 step 3 said a higher minor continues
and said nothing about a lower one, and the engine's check 1 required every
table of its own minor to be present, so a program stamped `1.0` was refused
by the `1.1` engine at load, at `requests`, with OS6018 and a message about a
malformed program. 9.5's first line promises that a program that ran yesterday
runs today. Which of the two is the rule?

**Decision.** 9.5 is. A program at a lower minor of the same format major
loads, and a table a later minor added and the program lacks reads as empty,
never as a refusal. The compiler always stamps the minor it emits, the current
one, and never a lower one, so a lower minor is an older program and nothing
else. The other direction stands: a program at the engine's own minor or a
later one that omits a table is still refused, because section 2 says an empty
table is written as an empty array and never omitted, and the version is what
tells an older program from a malformed one.

**Why.** 9.2's whole design is that a minor is additive and that anything whose
absence would change a number is announced by a tag in `requires`. That rule
was written to let an older engine load a newer program, and it says the same
thing read the other way round: a newer engine handed an older program meets
fewer fields, every one of which means what it meant, and the ones added since
are absent rather than wrong. `requests` is the case in hand. A `1.0` program
carries no read, so its `requests` table is empty by construction, and refusing
it for not writing `[]` was a refusal of the one program the format's
compatibility promise is about. The refusal was also the wrong message: OS6018
says the compiler that wrote the program is broken, and nothing was.

**Edits.** 9.4 step 3 carries the sentence. `src/core/engine/verify-tables.ts`
holds the tables a later minor added, with the minor, and writes the empty
table into a program below it before check 1 reads it. `spec/format-history.json`
is new and records, per released format version, the field paths, opcodes and
tags it defined and the sentence of section 9 that justified the bump;
`scripts/check-format-additive.mjs` holds the compiler to it in both directions.
`tests/engine/format-minors.test.ts` is driven from that file rather than from
a list of its own, so a version the history gains is a case the test gains.

## 57. Canonicity is required of text, not of an object

**Question.** Section 13's first line said a conforming engine parses the
canonical encoding and rejects anything that is not it. `load()` took a parsed
object and asked nothing about canonicity, because a host that compiled in the
same process never serialised and there was nothing to ask about. Which is
right?

**Decision.** Both, about different boundaries, and the page now says so.
Canonicity is required of the text an engine reads from outside its process;
an object built in the same process is the post-parse half of 9.4 step 1 and
enters at step 2. `loadText(text, options)` in `src/core/engine/load.ts` is the
text entry: it parses, writes the result out again through the one canonical
writer, and refuses any difference with OS6018 naming the character the two
part at, then hands the object to `load` so every later refusal applies in the
same order. The adapter's reading path was the other candidate and was not
chosen: the engine is what a second implementation is measured against, and a
rule enforced in an adapter is one every other adapter re-implements or
forgets.

**Why.** A hash is taken over canonical bytes and a host records it against a
run. Text that parses to a program but is spelled some other way is text that
hash does not name, and an engine that accepted it would report a run under a
name that identifies different bytes. Refusing at the text boundary and nowhere
else keeps the in-process case free of a rule it cannot break: an object has no
whitespace and no key order until it is written.

**Edits.** 9.4 step 1 and the first line under Loading in section 13.
`tests/engine/load-text.test.ts` holds the entry to both halves. The entry is
not yet exported through `src/core/engine/index.ts` and `src/core/index.ts`,
which were outside this stage's ownership; the two export lines are the wire
stage's, and the test reaches the function by its file until then.

## 58. Where the named colours' channels live, and what the corpus compares

Two smaller questions the same stage settled, recorded together.

**The channels.** `stdlib.md` 11.1 says the exact channel values of the named
colours are fixed in the library manifest and are part of the conformance
suite. There is no manifest document, and the values lived in two source
files, the compiler's table and the engine's, held to each other by a test and
to nothing else. **Decision.** `spec/colours.json` is that part of the manifest
in machine form and the home of the values; `scripts/check-colour-channels.mjs`
holds both source tables to it and states no value of its own. Beside `errors.json`
rather than in a page, because a value table is what a second engine reads and
what a check compares, and prose around it would be a second place to be wrong.
Owed by `stdlib.md`'s owner: 11.1's sentence names the file. Two things found
on the way, outside this stage's files: the comment at the head of
`src/core/engine/library/colours.ts` names `tests/engine/colours.test.ts`, which
does not exist (`tests/engine/library.test.ts` is the test that holds the two
tables to each other), and `scripts/check-examples.mjs` reads 11.1's block of
names with a pattern that a checkout carrying carriage returns does not match,
so on such a checkout the colour names are not in the global set that check
reads.

**The corpus.** `spec/corpus/` holds the canonical encoding and `programHash` of
every shipped example, and `scripts/check-format-corpus.mjs` recompiles each
one and compares the bytes. A program carries `compiler.version`, which is the
package's and moves on every release, so compared whole the golden would fail
on a package bump alone, which is the one failure that is not a defect.
**Decision.** The recompiled program is given the corpus's own `compiler`
object before it is canonicalised. `compiler` is never read by an engine and a
minor may add anything under it (section 2's table and 9.2), so the comparison
is over everything an engine reads, and the stored hash is a real hash of a
real program, the one the corpus holds. A change to the stamp's shape is a
field gained or lost, which the additive check reports.

## 59. (P6) What the library vectors are, and why a gap-reaching case is written and marked

**Question.** `conformance.md` section 8 admits no case whose value reaches a
gap of `stdlib.md` 20.11, and the harvest refuses a script by that rule. The
vector files under `spec/vectors/library/` drive every arithmetic function of
the manifest, twenty of which reach gap 1 or gap 2 by name or, for `ma` and
`keltner`, by the string that selects an average. Are those cases refused the
way a conformance case is, or written?

**Decision. Written, and marked, in the case and in the index.** A conformance
case is an assertion an engine is held to, and section 8 is right to refuse one
whose arithmetic no document fixes. A vector is a record of what this engine
produced, offered to the author of the next one as the fastest way to find a
disagreement, and a record that left out `log` would leave them nothing to
compare their `log` against at all. So the case is written, its `gaps` field
names the gaps its call reaches, the index carries the union per function, and
`docs/integrating/library-vectors.md` says in the open that a difference there
is not a defect. Which calls reach which gap is not decided again here: the
case's call is spelled the way a script would write it and read by the gate's
own reading of the table, `tests/gate/gaps-derivation.ts`, the same one the
harvest refuses by.

**Three further things this settles.**

- **The unit is the manifest entry**, a name and an argument count, driven
  through the manifest's own binding rather than through the numeric library
  directly. A second engine implements the manifest, and the binding is where
  an absent length becomes absence, a bool becomes a flag and a string becomes
  a type; a vector taken below it would be one the engine's own call sites do
  not reproduce.
- **The directory is held to the engine by regeneration**, the way a harvested
  case is, and a byte that differs fails the build. Regenerating is therefore a
  deliberate act: it is committed with the change to the arithmetic, the
  fixture or the generator that caused it, and the changelog says which.
- **The six groups with no vector are named with the reason** in the index and
  on every run of the check, never passed over, and an entry in a group the
  generator does not list fails the run.

**Edits.** `scripts/generate-library-vectors.mjs`, `scripts/check-library-vectors.mjs`,
`spec/vectors/library/`, `tests/stdlib/library-vectors.test.ts`,
`docs/integrating/library-vectors.md`, and the link from
`docs/integrating/README.md`. `conformance.md` section 8 stands as written: it
is about cases, and a vector is not one.

---

## 60. How a number becomes text, and the two string rules

**Question.** Two engines compare numbers as bits (`conformance.md` section 6)
and compare text in `expected.csv`, in a case file and in a table cell, so how
a number becomes text has to be one rule both implement. Three pages each said
part of one: `compiled-program.md` 2.14 that a number in the canonical form is
the shortest decimal that reads back, with an exponent written as `e` and an
optional `-`; `conformance.md` section 4 the same shortest form for an expected
column; `stdlib.md` section 10 that `text(x)` turns any value into a string.
None said when an exponent is used instead of positional notation or how zero
is written, and the implementation was the host's own conversion in four
places, one of them removing the `+` the host writes on a positive exponent and
three not. Beside it, three smaller questions the same survey turned up:
`str.trim` was documented as removing spaces and implemented as the host's
trim; strings were documented as ordered by code point (`language.md` 9.3,
`compiled-program.md` 3.1 and 4.6) and ordered by the host's sixteen bit unit;
and 20.7 fixed the scale of `round(x, decimals)` as `pow(10, decimals)`, which
on this engine's host is an ulp from the nearest binary64 at one count.

**Decision, part one: the layout is written down, and it is the first host's
layout minus the plus.** `language.md` 5.5 now states the whole rule: the
shortest round trip digits, positional from ten to the minus seventh exclusive
up to ten to the twenty first exclusive, an exponent outside that range spelled
`d.ddde-N` with never a `+`, `0` for both zeros, and no spelling for a value
that is not finite. Chosen over the second engine's host's thresholds (sixteen
digits, four places) because neither pair is better than the other and one of
the two engines gets this pair natively, so a defect in the first engine's
writer shows on the first run rather than hiding behind a host that agrees by
accident. `spec/vectors/number-text.json` holds fifty one boundary cases as bit
patterns, decimals and text, in both directions, so a second engine checks its
writer against the file rather than against this source.

**Part two: one writer, and a check that it is the only one.**
`canonicalNumber` in `src/core/emit/canonical.ts` writes every number:
`text(x)`, `text(x, d)` and the canonical encoding go through it, and it takes
only the digits from the host, laying them out itself from the page.
`scripts/check-number-writer.mjs` reads every file under `src` through the
type checker and refuses `String(n)`, `n.toString()`, the three digit count
methods, `${n}`, `s + n`, and `JSON.stringify` or `join` over anything holding
a number, outside that module. It asks the compiler for types because a text
scan cannot tell `${count}` from `${name}`, and it says what that leaves: an
operand typed `unknown` is counted and printed, not refused.
`spec/number-text-exceptions.json` records the forty four files that still
convert outside the writer, each with the exact count found and the reason: a
diagnostic printing a value for a human, a colour byte in hex, an internal key,
the chart's own CSS, and the files the wire stage switches. The count is
exact, not a ceiling, and the list only shrinks.

**Part three: `text(x, decimals)` writes the shortest digits at every
magnitude.** It wrote the exact binary expansion of the rounded whole inside
the scaling range and the shortest form past it, so `text(1152921504606846976,
0)` gave `1152921504606846976` while `text(1e21, 0)` gave a one and twenty one
zeros: two rules for which digits a value has, with a threshold between them.
There is one now, the writer's, zero filled. Observable only for a scaled whole
at or above 2 ** 53, so no price shaped value moves by a digit. `stdlib.md`
section 10's paragraph on `text(x, decimals)` was outside this stage's remit
and still does not say which digits; `language.md` 5.5 does, and the wire stage
adds one sentence to section 10 pointing at it.

**Part four: the trimmed set is written down.** The twenty five code points
with the Unicode White_Space property, listed in `stdlib.md` section 10 and
implemented from the list in `src/core/engine/library/code-points.ts`, with
`toNumber` ignoring the same set at either end. Neither host's trim is that
set: this engine's host also removes the byte order mark, and the second
engine's host also removes the four information separators and keeps the next
line character. `tests/engine/strings.test.ts` reads the list out of the page
and walks every code point of the basic plane against the engine.

**Part five: strings order by code point, and `<` does not yet.**
`compareStrings` in the same file orders by code point, `sort` uses it, and a
symbol above the basic plane is proved to sort after U+FFFF through the whole
pipeline. `compare` in `src/core/engine/arithmetic.ts`, which implements `<`
and its companions on two strings, still uses the host's `<` and was outside
this stage's ownership. **The wire stage** imports `compareStrings` from
`./library/index.js` there and, for two strings, returns the sign of
`compareStrings(a, b)` tested against zero in place of the four host
operators, with a pipeline test that `"！" < "\u{1F600}"` is `true` in a
script. Until then `<` and `sort` disagree on a pair of strings holding a
symbol above the plane and a code point from U+E000 upward, which is the
disagreement that existed before between both of them and the page.

**Part six: the scale of 20.7 is the nearest binary64 to the power of ten.**
Measured on this engine's host: `pow(10, d)` misses it for 1 of the 309 counts
from 0 to 308, at 23, and over the 5000 bars of section 20's price walk and
those counts `round(x, d)` differs on 814 of the 1545000 pairs. 20.7 prints
both figures and `tests/engine/rounding-scale.test.ts` reads them back.
`text(x, d)` now scales by a table of the 309 powers built from exact integer
arithmetic. `roundTo` in `src/core/stdlib/maths/rounding.ts` still multiplies
by `Math.pow(10, decimals)` and was outside this stage's ownership: **the wire
stage** moves `POWERS_OF_TEN` and `scaleOf` from `text.ts` into
`src/core/stdlib/maths/rounding.ts`, exports `scaleOf` through the stdlib
index, uses it in `roundTo`, and has `text.ts` import it rather than hold a
copy; a test then asserts that `round(3.0627e-8, 23)` is the value the nearest
binary64 scale gives and not the one the host power gives, which is one unit
in the last place away.

**Changes required.**

- `spec/language.md`: 5.5, new.
- `spec/stdlib.md`: section 10's `str.trim` row, the whitespace table and the
  ordering paragraph; 20.7's scale and its two figures; 20.11's sentence about
  `pow`.
- `spec/vectors/number-text.json` and `spec/number-text-exceptions.json`: new.
- `src/core/emit/canonical.ts`: the writer lays the digits out itself.
- `src/core/engine/library/code-points.ts`: new; `text.ts`, `arrays.ts` and
  the library index use it.
- `scripts/check-number-writer.mjs`: new, to be wired into `npm test`.
- `tests/emit/number-text.test.ts`, `tests/engine/strings.test.ts` and
  `tests/engine/rounding-scale.test.ts`: new; `tests/emit/canonical.test.ts`
  no longer states the number facts a second time.
- Left to the wire stage, as above: `src/core/backtest/case.ts` (`shortest`
  and the three frame cells become `canonicalNumber`, and the file's row in
  the exceptions file goes with them), `src/core/engine/arithmetic.ts`,
  `src/core/stdlib/maths/rounding.ts`, and one sentence in `stdlib.md`
  section 10.

---

## 61. Where a run's money rounding, charge schedule and report window live in a case

**Question.** `conformance.md` section 2 gave a case eleven file names and
`caseFilesFrom` wrote seven of them from a record, and three facts the report
was folded under had no file at all: the contract's rounding digit count, a
charge schedule the host supplied in place of the declaration's, and a narrowed
report window. A run under any of them harvested to a case that stated none,
and a second engine handed that case ran under other values (the fixture's two
digits, the declaration's commission, the whole of the bars) and took the blame
for a disagreement that was in the case all along. Does the digit count belong
in `instrument.json`, and where do the other two go?

**Decision.** None of the three goes in `instrument.json` or `settings.json`.
All three go in one new file, `backtest.json`, required of a strategy case and
always written by the projection.

- `host-interface.md` 4.1 defines the instrument record as twelve facts and a
  rounding digit count is not among them, so a file carrying one would not be
  the record section 2 says `instrument.json` is. The previous stage's test
  that the file holds no `digits` stands.
- `settings.json` is the script's inputs, keyed by input name, and the language
  calls those settings (decision 43). A digit count or a window beside them
  would be a key an input could also be named, and giving the file two shapes
  would make every reader decide which it was holding.
- One file rather than three because the three are one thing: what the host
  decided about the run that the script does not state and the instrument is
  not. `BacktestSettings` has seven fields and every one now has a place in a
  case: the contract in `instrument.json` (its six instrument facts) and
  `backtest.json` (`digits`); `costs` and `range` in `backtest.json`; `inputs`
  in `settings.json`; `now` and `tolerance` in `case.json`; and `fill` as the
  frames in `frames.csv`, because the fill policy is the simulated destination's
  and what it decided is input.
- The file is always written. Every run rounds to some digit count, `costs` is
  `null` for the declaration's own schedule and `range` carries `null` for a
  bound nobody stated, so the file says what the run ran under in every case
  rather than leaving a default to a runner. A supplied schedule's currency and
  digits are the contract's because the run refuses a disagreeing pair before
  its first bar (OS6021), so the file states each once.

**The refusal that stays.** `case.ts` carries a table naming the file each
settings field is carried in, typed over `keyof BacktestSettings` so a field the
type gains without a row does not compile, and `caseFilesFrom` refuses a record
whose settings carry a field the table does not know, naming the field. That is
the defect this minute closes made into a check: a setting with no place in a
case is a refusal, never a case that silently ran under something else.

**The tolerance cap.** Section 6 caps a declared tolerance at `rel = 1e-9` and
`abs = 1e-12`, and a runner refused a case past it while nothing refused a
record past it, so a harvest could write a directory that failed every runner.
`caseFilesFrom` refuses such a record with OS6021, the code the run itself
refuses a setting with, and makes no file. OS6021 rather than a new code because
the refusal is the same kind, a run setting that cannot be applied as stated;
the entry's cause sentence does not yet name the cap, and its owner should add
the clause. The two figures are in `case.ts` because core reads no page, and
`tests/backtest/case-settings.test.ts` reads them out of section 6 and holds the
constants to the page, as section 20's figures are held. `CaseRefusal` gains
`code`, the catalogue code a refusal is filed under or `null` for the refusals
about what a record holds, which no entry is about.

**What this does not settle.** This engine's adapter
(`scripts/lib/adapter-case.mjs`) does not read `backtest.json` yet: it takes the
digit count from the fixture, no schedule and the whole window, which is what
every harvested case ran under, so the suite passes by that coincidence and not
by reading the file. Its owner reads the file next, and until then a hand
written strategy case under other values would be answered wrongly by this
adapter rather than by the page. `docs/integrating/running-the-suite.md`'s last
bullet says no case file carries the digit count, which is no longer so.

**Edits.** `conformance.md` sections 2, 3, 4 and 6; `src/core/backtest/case.ts`;
`tests/backtest/case-settings.test.ts`; the two harvested cases gain
`backtest.json` by re-harvest and nothing else in them changes.

---

## 62. Whether a case states a frame's own instant, and where the column goes

**Question.** `host-interface.md` 7.2 gives an order frame a `time`, the
destination's own instant for it, and `stdlib.md` 17.7 folds a ledger row's
`updatedAt` from it: when a frame last changed the row. `frames.csv` had no
column for one, so an engine folding a case's frames left that field at
`placedAt` while an engine answering its own frames carried the instant it
spoke, and `conformance.md` section 3 recorded the gap in two paragraphs
without settling it. Is a `time` required of a case, and where does the column
go among fields that are read by position?

**Decision.** `frames.csv` gains a `time` column, last, after `text`. It is
optional in the same sense `orderRef` and `text` are, absent as `none`, and it
is written on every row by whatever projects a run into a case. Record version 4
carries a frame's instant, because a projection can only write what the record
kept.

- **Optional, because 7.2 lets a destination state none.** A frame carries an
  instant where its destination stated one, so a file that required a number
  would make a case invent what nobody said, and the invented figure would then
  be asserted through the `orders` channel as though a destination had reported
  it. An absent column and a `none` in it mean the same thing, which is the rule
  already stated for the two optional columns beside it, so there is nothing new
  to learn.
- **Last, because the fields are read by position.** A required `time` would
  have to sit before `orderRef`, which re-spells every case file already
  harvested and leaves the rule "an omitted column is absent on every row"
  saying nothing about which column was omitted. With it last, an optional
  column is dropped from the right and a header is a prefix of the full list,
  which is what both readers already do with the two before it. Section 3 now
  says that in the open rather than leaving it to a reader to infer.
- **What closes the gap is the writing, not the requirement.** The failure was a
  harvested case whose run had instants and whose file did not: the case
  asserted an `updatedAt` that its own input could not reproduce. A projection
  that writes the column on every row removes that case, whether or not a
  hand-written one may leave the column out. A hand-written case that leaves it
  out is asserting a row whose `updatedAt` stayed where the placement put it,
  and its own input reproduces that.
- **Not a fallback to the bar boundary.** The alternative was to leave the file
  alone and have an engine move `updatedAt` to the time of the bar the frame
  arrived after. That is an engine reporting an instant no destination stated,
  in a field whose whole content is what the destination said, and both engines
  already move the field only when the frame carries one. It would also make the
  field unfalsifiable: every reading would agree with every other, because the
  number would come from the bars rather than from the case.

**What this does not settle.** This engine's own adapter re-runs a case on its
own destination and holds the frames its run answered to `frames.csv` byte for
byte, so it is not yet an engine driven from the file, and the column does not
change what it folds. The second engine is driven from the file and now reads
the instant, and the one line that puts it on the frame it delivers belongs to
the file that owns that delivery. Both are the adapters' owners' to close, and
until the suite's cases are harvested again they carry the seven columns they
were harvested with.

**Edits.** `conformance.md` section 3, the `frames.csv` example block, its
column list and the prose under it; `src/core/backtest/record.ts` (record
version 4 and a frame's `time`), `drive.ts` and `case.ts`;
`scripts/lib/case-reading.mjs`; `engine/openscript/adapter/page.py` and
`reading.py`.

---

## 63. Whether an engine folds the frames a case supplies or answers its own

**Question.** `conformance.md` section 3 says `frames.csv` supplies order frames
the way `bars.csv` supplies bars, so that a case asserts the fold against input
the engine did not choose. This engine's adapter re-ran every case on its own
simulated destination and held the frames that run answered to `frames.csv` byte
for byte, reporting the case `unsupported` when the two differed. Two documents
answered one question two ways: the page said the file is input, and the adapter
said it is an assertion about what this engine's destination would have done. It
could therefore only ever answer a case whose frames this engine would have
produced anyway, which is why the suite held 204 frames of which every one was
an order working and then filling whole. Which reading is right, and what
becomes of a row naming an order the run never placed?

**Decision.** The page. A second driver, `backtestSupplied`, delivers the rows a
case supplies and answers none of its own, and the adapter runs a case that
holds the file through it. A case that holds no file runs through `backtest`
against the simulated destination, because section 3 ends that a case with no
`frames.csv` is handed no frames at all.

- **A destination is chosen once, before the first bar, and the loop never
  learns which it got.** The two drivers are one function: the same window, the
  same load, the same refusals, the same walk of the bars and the same record.
  What differs is one call that returns a destination, so a rule about delivery
  or about a boundary cannot come to mean one thing for a case and another for a
  study, which is the failure a second loop would have invited.
- **The record carries the rows it was handed, not a second spelling of them.**
  The frames of a run over supplied input are that input, so the record repeats
  it rather than writing back what the fold made of it. A driver that wrote them
  back out would spell a row naming no intent of the run as ordinal zero, and
  the record of the run would then name a different order than the case the run
  came from.
- **A row naming an ordinal the run never placed is delivered and refused, never
  dropped.** Section 3 hands an engine that row on purpose, and `stdlib.md` 17.8
  step 1 is where a frame naming no row of the ledger is refused. A destination
  that dropped it would leave the engine with nothing to refuse, and two engines
  would then agree about a frame neither of them ever saw. The row travels under
  an id no ledger mints, which is what makes step 1 the one that answers it.
- **A row no boundary of the run delivers is named rather than passed over.** A
  frame is delivered after the bar it names and folded before the next
  execution, so a row naming the last bar has no fold left and a row naming no
  bar of the run has no delivery. Neither is written down anywhere, so the
  adapter reports the case `unsupported` naming the row, which is what the
  second engine already did for the first of the two. Running the case anyway
  would be a pass over a ledger that never saw part of its own input.
- **What the byte comparison did that is still worth doing is the header.**
  Section 3 reads the fields by position and drops the optional ones from the
  right, so a case whose header is not a prefix of the whole list names its
  fields in an order nothing reads. That is now held against the header the
  projection writes, which is where this engine states the columns once, and it
  is reported `error` as the malformed case it is rather than as a difference in
  the frames.

**What this does not settle.** Four things, each measured rather than supposed.

- The second engine reads the `time` column and folds `updatedAt` from a frame
  that carries one, and the driver between them, `Desk.fold` in
  `engine/openscript/adapter/ordering.py`, builds the frame it delivers without
  that field. So a case whose destination answered later than the bar that
  placed the order is answered differently by the two engines, by that one
  field, which is the gap decision 62 left to the file that owns the delivery.
  Measured on a case harvested here: every other field of the ledger, the
  trades and the whole performance summary agree exactly.
- `BacktestSettings` still states no schedule of its own: the simulated
  destination's schedule rides on the fill policy as `VenuePolicy`, which is
  structural rather than declared. The field cannot be added without a row in
  `case.ts`'s `CARRIED`, whose type requires one per setting, and that file
  belongs to another stage.
- `docs/integrating/running-the-suite.md` still describes the reading this
  minute replaces, under what the reference adapter does not reach.
- The three cases a destination behaving badly was built to harvest are not
  landed here. `cases/` and the harvest are not this stage's, and the suite's
  five cases carry the seven columns they were harvested with.

**Edits.** `spec/conformance.md` section 3; `src/core/backtest/deliver.ts` (new),
`drive.ts` and `index.ts`; `src/core/index.ts`; `scripts/lib/adapter-case.mjs`;
`tests/backtest/deliver.test.ts` and `tests/suite/supplied-frames.test.ts`.

---

## 64. What a report says about the run's best stretch, and where a streak's order comes from

**Question.** The summary answers what a run did in twenty six figures, and a
reader deciding whether to trade a strategy cannot get three things out of any
of them. How much the run climbed before it gave anything back, which separates
a strategy that made ten and returned nine from one that made one and kept it,
and which reports the same net either way. Which side made the money, which no
figure can show because every one of them is folded over long and short at once.
And how many times in a row the strategy was wrong, which is the number that
actually stops somebody and which is not derivable from the win rate, the
drawdown or the trade count. What is added, and what is each figure measured
against?

**Decision.** Run-up beside drawdown on the curve and in the summary, and a
trade analysis beside the summary rather than inside it.

- **Run-up is measured from a running trough anchored at the capital**, which is
  the peak's rule and not its mirror image. A trough anchored at the first
  reported point would call that bar the bottom, so a run already ahead at its
  first bar would report the gain it arrived with as having come from nowhere.
- **The fraction is guarded differently from the drawdown fraction, and the
  asymmetry is the point.** A peak starts at the capital and only rises, so it
  is above zero throughout any run that was given money. A trough starts there
  and only falls, and an open position can lose more than the account holds, so
  it reaches zero and goes past it. Against a negative basis a positive climb
  divides to a negative fraction, which is the shape that once reported a profit
  factor of minus a half: a number nobody can act on is worse than no number. So
  the fraction is zero wherever the trough is not above zero, which is the wrong
  answer for a run that recovered, and is reported anyway because the money
  figure beside it is unaffected and is the one to read on such a run.
- **The height and the depth name different bars, each the first to reach it.**
  The earliest bar wins a tie on both, because two figures in one summary picked
  by opposite tie rules cannot be checked against each other by the reader who
  notices they disagree.
- **A streak is counted over the closed trades in the order they closed.** Not
  the order they opened, which is the order the list arrives in and the order
  the equity fold needs: the two differ whenever a trade is held across another
  one's whole life, which is every strategy that scales in. The account
  experienced the closes, so the closes are what a streak is a fact about. Two
  trades closing on one bar are ordered by the order they opened, so the answer
  does not depend on the order the list arrived in; both engines sort stably, so
  without that tie-break the streak would silently have become a fact about the
  input rather than about the run, which is a disagreement no assertion in a
  single fold would have caught.
- **A scratch breaks a streak and extends neither half.** A run that went right,
  flat, right was not right twice. Skipping the flat trade instead would join
  the wins either side of it, making the reported best run depend on a rounding
  at the last digit of a trade that made nothing.
- **The analysis is not in the `performance` channel, and is therefore not
  compared by the suite.** The channel holds one flat object and the side split
  is nested. Flattening it or giving it a channel of its own is a question left
  open rather than answered in passing, so the analysis is proved by unit tests
  on each engine and the matrix rows say so. Run-up is in the channel, so all
  five cases compare it between the two engines, which was checked by removing
  it from one engine and watching every case fail.

**What this does not settle.** The other twenty six summary figures still have
no formula written down anywhere: the two engines agree on them because one was
translated from the other, not because a sentence says what they are, and a
third engine has nothing to be written against. That is now stated in
`conformance.md` section 4 instead of being invisible, and it is the reason the
trade list, equity curve, drawdown and win rate rows of `feature-matrix.md`
section 30 read `planned` while the code that computes them ships.

**Edits.** `spec/conformance.md` section 4; `spec/feature-matrix.md` section 30;
`src/core/accounting/analysis.ts` (new), `equity.ts`, `statistics.ts`,
`report.ts` and `index.ts`; `src/core/index.ts`; `src/core/backtest/compare.ts`;
`engine/openscript/accounting/analysis.py` (new), `equity.py`, `statistics.py`,
`report.py` and `__init__.py`; `engine/openscript/adapter/channels.py`;
`tests/accounting/analysis.test.ts` and `drawdown.test.ts`;
`engine/tests/test_analysis_and_runup.py`; `engine/tests/replaying.py`, whose
copy of the channel encoder became the encoder itself.

## 65. A chart may draw a strategy, against the venue a backtest uses

**The question.** A chart tier had two ways to treat a program that places
orders and neither was usable. Refuse it, which is what `load` does without a
route, and a strategy cannot be drawn at all: no plots, no legend row, no
settings dialog, none of the affordances a study gets, although it has exactly
the same plots and the same declared inputs. Or hand it a route that accepts
intents and answers nothing, and it runs while never learning it holds a
position, because a position is folded from frames and no frame ever arrives.

**Why the second is worse than the first.** It looks like it works. Every
`close()` closes nothing, so every entry is allowed again on the next signal,
and anything plotted from `pos` is wrong. Measured on a stop and reverse script:
five buys, no sells, and a chart that reads as an ordinary strategy.

**The decision.** `descriptorFor` takes `simulateOrders`. With it, a program
requiring `orders` runs against a `Simulator`, the same one `backtest()` runs
against, and the chart run is walked bar by bar so the venue's frames reach the
engine between them. `run()` hands over every bar in one call and has nowhere to
put them, which is why the walk exists and not merely because it is tidier.

**It is the backtest's venue and not a second one.** A venue written for charts
would be a second answer to what a bar would have filled at, and the two would
disagree the first time either changed: the chart would draw one set of trades
and a report of the same script would list another, with nothing saying which
was right. The agreement is asserted rather than assumed: a test compares the
position a chart run ends on against the open size the report states.

**Off unless asked for.** A strategy with no route is still refused with OS6006.
That refusal is what a host which meant to wire a destination and forgot has to
see, and filling one in for them would turn the mistake into a chart that draws
convincingly and routes nothing. A host that supplies `orders` keeps it:
somewhere real to send an order is a better destination than a simulated one.

**What this does not settle.** A strategy's fills are not markers. The chart's
marker channel carries what `marker()` and `signal()` declared, and an order is
neither, so a host drawing entries and exits still builds them from the report
itself. Whether the language should give an order call a caption of its own is
open: `tag` names a position and a close is required to repeat its entry's tag,
so it distinguishes nothing between the two orders of a round trip and is not a
label. That is a language question and is not answered here.

**Edits.** `src/adapters/charts/venue.ts` (new), `run.ts`;
`tests/adapters/charts/calc.test.ts`; `CHANGELOG.md`.

## 66. A bare read of an instrument fact the host did not state is absent, and never OS6012

**The question.** `stdlib.md` 3.4 says `chart.tickSize` is `none` when the host
has not said, and the catalogue's OS6012 said a bare read of a fact the host did
not supply stops the bar, with `qty = lots * chart.lotSize` as its example. Both
cannot be true of one read (issue 0002).

**The decision.** The first. A bare read of an instrument fact the host did not
state returns the absent value, a script may test it with `isNone` or give it a
fallback with `orElse`, and nothing stops the bar. OS6012 belongs only to
something that needs a fact and cannot default it, which in version 1 is the
instrument record refused at load: a session stated with no timezone, a timezone
the calendar cannot read, a session whose clock times are not `HH:MM`, or session
days outside one to seven. A request that dates its buckets by a timezone the host
did not state is not refused either: it is absent, and `req.error` carries
OS6012's sentence as its reason.

**Why.** It is the reading that leaves every sentence of `stdlib.md` standing,
including `roundToTick`'s absence rule, which the other reading made
unobservable. It is what the engine already did: nothing raised OS6012 on a
bare read, and the load refusal was the only site. And it is the one under which
a script can degrade: a study that sizes in lots guards the read and still draws
on a host that leaves the lot size out, where the other reading turns the guard
into dead code and the study into an error on every such host.

**Edits.** `errors.md` and `errors.json` OS6012: the `fact` gloss names what the
record lacks for something that cannot default it, the cause says a bare read is
absent, the fix names the record, the example is the host input that fails and
the one that passes, and the reference is `host-interface.md` 4.5.
`host-interface.md` 4.5 states the settlement. `feature-matrix.md`: the preamble
paragraph and the row `chart/tick-and-lot` state one behaviour.
`docs/data/other-instruments.md` stops teaching the refusal.
`examples/06-combined-premium.oscript` says what its bare read does on a host
that states no lot size. `tests/engine/instrument-facts.test.ts` holds the read.

## 67. An input in a field fixed before bar 0 is the whole of the value or nothing

**The question.** `language.md` 13.2 admitted "a call to `input()`" in an option
without saying whether that meant the whole value or a term inside one, and the
compiled format carries only the value or `{ "input": "<key>" }` (issue 0003).

**What was found.** It was not a gap in prose alone. The checker accepted
`precision = input(2, "Decimals") + 1`, `opacity = shade ? 1 : 0` over a
checkbox, `fade(aqua, t)` with `t` a setting in a level's colour, and an input
whose default or bound was another input. The emitter then had nothing to write
for the first three and refused the program with OS6018, which tells the reader
the compiler is broken; for the last it wrote the default as absent and said
nothing.

**The decision.** Option 1 of the issue. An `input()`, or a name holding one, is
admissible as the whole of a field fixed before bar 0 and never as a term inside a
larger expression; an input's own default, bounds and step read no setting at
all. The refusal is a code of its own, OS3025, rather than OS3003, whose message
says the value depends on bar data, which is untrue of a setting.

**Why not the fourth form.** An expression folded at load is what a reader
expects to write, and it is a second evaluator outside the machine with its own
admissible calls, its own errors and its own place in the load sequence. Two
engines that implement that subset differently disagree before the first bar.
It is a language change with a compiled home to design, and belongs to a language
version rather than to a repair.

**Edits.** `errors.md` and `errors.json`: OS3025, and OS3003's cause names it.
`language.md` 13.2 says the rule. `docs/inputs.md` teaches it in the section on
options and in both tables. `feature-matrix.md` row `input/option-from-input`.
`src/core/check/constant.ts` holds the predicate; `calls.ts` and
`call-sites.ts` report it. `tests/unit/check-plot-options.test.ts`.

## 68. A host refuses what it cannot draw, with OS6024, before any bar runs

**The question.** A compiled program carries every output the language can
express and a host's surface can be narrower. The chart adapter drew the first
of two declared grids and dropped the second, and drew a band whose colour the
script computes per bar in the first plot's colour faded, both with nothing
said, because the catalogue had no code for a host that cannot draw something a
program declares (issue 0011).

**The decision.** OS6024, "The host cannot draw something this study declares",
host stage, with the message `This host cannot draw {what}: {limit}.`, where
`limit` is the only part a host writes. A host that cannot draw a declaration
refuses the program before any bar runs, naming the declaration, rather than
drawing part of the study. `compiled-program.md` section 11 states the rule.

**Where the caret goes.** Nowhere in the source. The issue asked for the
declaration's own call as the span, and the compiled program carries no source
position for a declaration: `debug.pos` maps instructions, and a grid is a
declaration rather than an instruction. So the refusal names the declaration by
its title, which is what a reader sees in the legend, and its span is the load's
own, like every other refusal at load. Giving declarations positions is a format
change and is not made for this.

**Why a refusal and not a warning.** Every OS6xxx code is an error, and a study
drawn with its second panel missing is exactly the failure a warning beside a
drawn chart would be read past.

**Edits.** `errors.md` and `errors.json` OS6024; `compiled-program.md` 11;
`src/adapters/charts/undrawable.ts` (new) and `run.ts`; `tables.ts`' header;
`spec/chart-narrowings.json` replaces its `counts` entry with `refused`;
`scripts/check-chart-surface.mjs` and `scripts/lib/chart-refusals.mjs` (new)
prove each refusal with a study that declares it; `docs/visuals/tables.md` and
`fills.md`; `tests/adapters/charts/undrawable.test.ts`.

## 69. A bar handed over with no time is OS6025, in both engines

**The question.** `host-interface.md` 3.1 states `time` for every bar, and the
two refusals of section 3.5 did not cover a bar with none: OS6011 compares two
instants, so a bar dated nothing passed it, read its time as absent, stepped over
every calendar fold and made every session fact absent for a bar that was on the
chart (issue 0012). Whether a fact the host did not state is an error or an
absence is the question decision 66 answered for instrument facts, and it has the
other answer here.

**The decision.** A code of its own, OS6025, "A bar has no time", raised as the
bar is handed over and before any step runs, naming the bar. Not the absent
value, because `time` is the one field of 3.1 with no absent case and the order
rule is built on it; an instrument fact is optional by the table that lists it
and a bar's time is not. Not OS6011, whose sentence is about an order nobody
violated.

**Both engines.** The second engine did not raise OS6011 either: its
`execute_bar` ran whatever it was handed, so the two engines disagreed about a
series no conformance case supplies. It now refuses both, with the same values,
at the same point. OS6010 has no counterpart there, because it has no entry point
that is handed a whole dataset: a host that has no bars never calls it.

**Edits.** `errors.md` and `errors.json` OS6025; `host-interface.md` 3.5;
`src/core/engine/series.ts` and `engine.ts`; `engine/openscript/run.py`;
`docs/integrating/running-the-engine.md` and `running-a-strategy.md`;
`tests/engine/series.test.ts` and `engine/tests/test_hand_over.py`.

## 70. A plot's style written from an input is OS3026, and the format is not widened

**The question.** `language.md` 13.4 lets an `input()` be written as a
declaration option, and every plot option carries the reference into the
compiled program except `style`: `Plot.type` is a plain string, so the emitter
folded the input to its default, the settings row it declared moved nothing, and
a select whose options were not styles at all was accepted (issue 0018).

**The decision.** The issue's second answer: a refusal where it is written,
OS3026, "This option cannot be a setting", with a fix that tells the reader to
write the style out. The library entry names the one argument the format carries
as a plain value, so the rule is a fact about `plot` stated where `plot` is
declared rather than a list in the checker.

**Why not widen the field.** Section 9.2 of `compiled-program.md` lets a minor
bump add a field and forbids everything else it does not list, and turning
`plots[].type` from a string into a `Field` changes a field's type rather than
adding one. An engine written against format 1.1 would read an object where it
expects a string and refuse the program at verification, which is a major bump
wearing a minor number. A style a reader can choose is a feature worth a format
change, and it is worth one made on purpose, recorded in
`spec/format-history.json` and landed in both engines and the chart adapter at
once, rather than inside a repair. Every other plot option, and every option of
every other declaration, was measured and keeps its reference.

**Edits.** `errors.md` and `errors.json` OS3026; `language.md` 13.4;
`src/core/check/library.ts` (`written`), `library-output.ts` and `calls.ts`;
`docs/inputs.md`; `tests/unit/check-plot-options.test.ts`.

## 71. The `AND` and `OR` tables are total

**The question.** `compiled-program.md` 4.7 gave each logic instruction only the
rows its short-circuit leaves to it, on the ground that a `false` left operand
under `and` and a `true` one under `or` never reach the instruction. The compiler
emits a bare `OR` for the values of a `switch` case, with no `OR_SHORT` before it,
because neither operand can have an effect. So a `true` left operand did reach
`OR`, on a row the page did not have.

**How it was found.** The first `values` case written for `switch`,
`cases/flow/switch-value`, with `case 1, 2`. The first engine answered the row the
only way `language.md` 6.6 allows and took the arm; the second answered absence,
as its table said a row the page never wrote should be answered, and took the
default. Two engines each faithful to a page disagreed because the page and the
compiler disagreed.

**The decision.** The tables are total. Every pair of two booleans or absences
has a row, and the rows a short-circuit decides carry the answers `language.md`
6.6 gives, so a program that took the short-circuit and one that did not compute
the same value. The compiler is unchanged, so no stored program's bytes or hash
move, and no program's value changes on the first engine, which already answered
these rows this way.

**Why not change the compiler instead.** Emitting `OR_SHORT` for a `switch` case
would make every program with a multi-value case a different program, change the
hash of every stored run of one, and leave the second engine's reading of the
page one compiler change away from the same disagreement. The page was the thing
that was partial.

**Edits.** `compiled-program.md` 4.7; `engine/openscript/values.py` and its test;
`cases/flow/switch-value`.

## 72. The `drawings` and `table` channels, and what names a grid in them

**The question.** `conformance.md` section 2 listed `drawings` and `table` among
the channels a case may assert and section 4 put both in `expected.json`, and
nothing said what one element of either holds. No engine answered them, so the
second engine's drawing objects and grids (issue 0021) had nothing to be
measured against, and a third engine would have had to guess.

**The decision.** An element of `drawings` is one object the script holds after
the last bar, oldest first: its `kind`, its `anchors` as a list of `time` and
`price` objects, and every other property under the name of the argument that
set it. An element of `table` is one cell the last bar wrote, in write order:
the grid's `title`, then one field per argument `cell` takes after the grid,
under that argument's name. Every value is spelled as a cell of the `values`
channel is.

**Why anchors are a list, when every other element is flat.** It is what
`compiled-program.md` section 11 already hands a host: a line and a box have two
points, a label one, and a polyline as many as its path. Flattening them into
`t1`, `p1` and the rest would give a polyline no spelling at all, or a second
shape for one kind.

**Why the title and not the key.** The declaration's `key` is the compiler's
choice, so an expected file written from the script alone could not know it,
and a case whose expected output needs the compiler that made it is not a case
a hand can check. The title is the script's own first argument to `table()`.

**Why no identity.** An engine gives each object an identity it keeps while the
object lives, and nothing outside that engine can name it, so a channel carrying
it would be a channel two correct engines disagree on.

**Edits.** `conformance.md` section 4; `scripts/lib/case-surface.mjs` and the
first engine's backtest (`surface`); `engine/openscript/objects.py` and
`adapter/surface.py`; twenty eight cases under `cases/draw`, `cases/obj` and
`cases/table`.

## 73. A read of another instrument is served from `bars.<SYMBOL>.csv`, and a read of the chart's own from `bars.csv`

**The question.** `conformance.md` section 3 said a higher timeframe or other
instrument read is served from a file "matched by the name the script asks
for", with `bars.60.csv` and `bars.1D.csv` beside `bars.OTHER.csv`, and neither
adapter served one. When the second engine gained the fold (issue 0021) the
section had to say what a file is named after, which timeframe it holds, what a
missing one does, and whether a read of the chart's own instrument reads a file
at all.

**The decision.** A read of the chart's own instrument reads no file: the engine
folds `bars.csv`, and the whole of it is the history the fold is handed before
bar 0. A read of another instrument is answered from `bars.<SYMBOL>.csv`, named
after the instrument the read resolves to whatever exchange it names, with the
columns of `bars.csv`, holding that instrument's bars at the timeframe the read
requests. One file answers every read of its instrument. A read whose file is
missing is the `error` outcome, naming the file. A read whose instrument did not
resolve at all names no file and is refused with OS6007, as a host refuses it.

**Why a read of the chart's own instrument reads no file.** `host-interface.md`
5.1 and `compiled-program.md` 2.16.2 have an engine fold the chart's own bars for
it, and both engines do, whether or not a host serves one. A file for it would
test a host path neither adapter takes, and a case holding `bars.1D.csv` beside
`bars.csv` could say two different things about one day with nothing to say
which of them the engine read.

**Why the symbol alone names the file.** Every read the suite holds names one
venue per instrument, most of them the chart's by default, so a name carrying
the exchange as well would be a second word to get right for a fact the case
already states. A case that needs two venues for one symbol is a case nobody
has written, and the rule can grow when one is.

**Why the whole dataset is handed over first.** `compiled-program.md` 2.16.2
makes a `"lookahead"` read the one place an engine's answer depends on how much
it has been given, and a case is settled history, where `stdlib.md` 15.3 says
that mode reads a bucket's final value from its first bar. The first engine's
backtest appended bars one at a time, which answered a lookahead read with the
bucket so far, the live chart's reading, on history; it now hands the fold the
dataset before bar 0 as `Engine.run` does, and the second engine's run takes it
the same way. Confirmed and developing reads stop at the chart bar, so nothing
else moves.

**Why a missing file is an error and not a refusal.** A refusal is something a
study draws around, so a suite that turned missing input into one would pass a
case whose expected column is absent for a reason nobody wrote down: the
silently empty series the section already refused, arriving by another door.

**And a sentence that said the opposite.** `host-interface.md` 5.1 said a host
that serves no requests gives its engine neither read tag, while 5.2,
`compiled-program.md` 2.16.2 and both engines serve `req.timeframe` always,
because the engine folds the chart's own bars. The engines were right and the
sentence was not: a host withholds `req.symbol` only.

**Edits.** `host-interface.md` 5.1; `conformance.md` sections 2 and 3; the
`conf/secondary-series` row of `feature-matrix.md`; `scripts/lib/case-reads.mjs` and `adapter-case.mjs`; the
first engine's backtest drive (`requestBars`) and walk (`Engine.history`);
`engine/openscript/adapter/secondary.py` and `running.py`; the cases under
`cases/req`.

## 74. What the importer translates, and where its findings live

**The question.** Phase 7 asks for an importer for scripts written in other
chart languages. A translation can be close in spelling and far in meaning, and
the two languages differ exactly where a reader does not look: comparing an
absent value, the order `and` evaluates in, which way a loop counts, how an
order is sized, and the capital a strategy starts with.

**The decision.** The importer reads one language, the version-annotated chart
dialect at versions 5 and 6, and a top-level statement is translated with the
source's meaning, or translated with a warning that states how the meaning
differs, or kept as comment lines with an error saying why. The unit is the
whole top-level statement, because a block with one line missing means
something else. The output is compiled before it is returned, and a statement
the compiler refuses is kept as a comment with OS9012, so what a host is handed
always compiles.

**A range of its own, OS9xxx, holding both severities.** Its findings are about
a script in another language, not an OpenScript file, so a bare code in a log
has to say which part of the system produced it, which is what section 4 of
`errors.md` says a range is for. Errors are statements not translated; warnings
are translations with a stated difference. A sixth stage, `import`, is checked
against `src/core/importer` by `check-raises.mjs`.

**Worked examples.** A new example kind, `import`: the before block is proved by
the importer and the after block is compiled like every other. It is required
on the stage and refused elsewhere, because neither existing state was honest:
a transcript's after block must fail to compile, and `unexercised` says the code
cannot be reached. Each section prints one fixed sentence saying the before
block is source dialect, and the whole-section comparison of `catalogue-page.mjs`
renders it, so it cannot drift.

**What this does not settle.** No number is compared with the source platform,
because nothing here can run the source dialect, so windowed built-ins and
orders warn rather than claim equality, and the facts about the source dialect
the importer relies on are listed in its page rather than proved.

**Edits.** `src/core/importer/` (new), `src/core/index.ts`,
`src/core/catalogue/types.ts`, `spec/errors.json` and `spec/errors.md`,
`scripts/check-raises.mjs`, `scripts/check-examples-compile.mjs`,
`scripts/lib/example-import.mjs`, `scripts/lib/catalogue-page.mjs`,
`tests/importer/`, `docs/writing/importing-a-script.md`.

## 75. The chart adapter draws a band's colour per bar and every declared grid, on a chart the host states has the hooks

**The question.** Decision 68 refused two things with OS6024 because the chart
had no place for them: a second grid and a band whose colour is computed per
bar. The chart library has since added both places, a list of grids with a
stable id each and a per-bar colour callback on a band, in the same version,
2.5.4. The adapter's peer range starts at 2.4.0, and a chart ignores a hook it
does not know, so drawing through either on an older chart is the silent drop
decision 68 ended. The adapter does not import the library, so it cannot ask
which one it is handed.

**The decision.** `ChartAdapterOptions.chartVersion`, which a host sets to the
library's own exported `VERSION`. From 2.5.4 on, the descriptor carries a
band's computed colours through the band's colour callback and every declared
grid through the list, keyed by the declaration's key, with the single `table`
hook kept for the first grid. Below it, and when nothing is stated or what is
stated cannot be read as a version, both are refused with OS6024 exactly as
before, and the refusal's own sentence says which version the host stated.
`src/adapters/charts/capabilities.ts` holds the versions and the rule.

**Why a version and not a switch per hook.** A switch is a fact about the chart
the host has to look up and keep true through every upgrade and downgrade; the
version is the chart the host installed, it is already in hand, and a hook the
adapter learns to read later needs nothing new from any host. A prerelease
orders before its release, so `2.5.4-rc.1` reads as a chart without what 2.5.4
added.

**How a bar's band colour is chosen.** The side is decided as the chart decides
it, the first plot at or above the second, so the colour answered is the colour
of the run the chart draws that bar in. An absent computed colour is a
transparent colour rather than no answer, because no answer hands the bar to
the chart's default for that side, and an absent colour is how
`docs/visuals/fills.md` teaches a band to switch itself off. A side the script
did not compute answers nothing, so the chart draws the colour declared for it.
The band's `opacity` is applied once, by the chart, to a computed colour as to
a constant one, and the twelve percent fade of a band with no colour does not
apply to a band whose colour is computed.

**What this does not settle.** A band that computes one side and names no colour
for the other draws that side in the chart's own default, which is also what a
band with one constant side does. Whether such a side should be unpainted
instead is the question the second engine's fills channel reports without
deciding, and it is left open for both.

**Edits.** `src/adapters/charts/capabilities.ts` (new), `undrawable.ts`,
`fills.ts`, `columns.ts`, `tables.ts`, `descriptor.ts`, `produced.ts`,
`contract.ts`, `surfaces.ts`, `run.ts` and `index.ts`, with `columns.ts`'s row
of `spec/number-text-exceptions.json` counting the band colour key beside the
level key; `spec/chart-narrowings.json`, where the
band's two channels become carried and each refusal names the version it is
drawn from; `scripts/check-chart-surface.mjs`, `scripts/lib/chart-refusals.mjs`
and `scripts/lib/declared-fields.mjs` (new), which prove each refusal on both
sides of that version; `compiled-program.md` 11; `docs/visuals/fills.md`,
`tables.md` and `colors.md`; `tests/adapters/charts/bands.test.ts` and
`grids.test.ts` (new) and `undrawable.test.ts`.
