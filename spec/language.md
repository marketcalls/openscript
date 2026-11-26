# OpenScript language specification

Version of this document: draft, tracking language version 1.

This is the anchor document of the specification. It defines the source text, the
types, the per-bar execution model, the scope rules and the statement and
expression forms of OpenScript. The documents that make up the specification,
what each one holds, and which one wins where two disagree are listed in
`spec/README.md`.

Where a rule could reasonably go two ways, this document says which way it goes
and why in one sentence. Nothing in the language is left implementation defined.
Two engines that both pass the conformance suite must produce identical output
for identical input, to the last decimal, so an unspecified corner is a defect in
this document.

## Contents

1. [How to read this document](#1-how-to-read-this-document)
2. [A complete example](#2-a-complete-example)
3. [Lexical structure](#3-lexical-structure)
4. [The version declaration](#4-the-version-declaration)
5. [Types](#5-types)
6. [The absent value](#6-the-absent-value)
7. [The per-bar execution model](#7-the-per-bar-execution-model)
8. [Persistence](#8-persistence)
9. [Expressions and operators](#9-expressions-and-operators)
10. [Statements and control flow](#10-statements-and-control-flow)
11. [Functions](#11-functions)
12. [Scope](#12-scope)
13. [Declarations: study and strategy](#13-declarations-study-and-strategy)
14. [Collections](#14-collections)
15. [The standard library surface](#15-the-standard-library-surface)
16. [Errors](#16-errors)
17. [Differences that will surprise you](#17-differences-that-will-surprise-you)
18. [Reserved for later versions](#18-reserved-for-later-versions)
19. [Grammar summary](#19-grammar-summary)

---

## 1. How to read this document

**Must, may, never.** "Must" is a requirement on a conforming implementation.
"May" marks a genuine choice left to the host, never to the compiler or the
engine. "Never" is a prohibition the compiler enforces.

**Error codes.** A rule that the compiler enforces names the code it emits, for
example OS2002. The code, its message, its cause, its fix and a worked example
live in `errors.md`, which is authoritative. Where two documents disagree, the
precedence is the one `spec/README.md` states.

**Grammar notation.** Section 19 uses a small EBNF: `|` alternation, `[x]`
optional, `{x}` zero or more, `"x"` a literal token, lowercase names for
productions, UPPERCASE for terminal token classes.

**Examples.** Every rule carries a short example. Examples are complete enough to
compile unless they are marked as fragments.

---

## 2. A complete example

Everything in this document appears in miniature here.

```
version 1

study("Range breakout", overlay = true, precision = 2)

length  = input(20,   "Lookback", min = 2)
useStop = input(true, "Trail the stop")

hi = highest(high, length)[1]
lo = lowest(low, length)[1]

var stop = none
var long = false

if not long and close > hi
    long = true
    stop = lo
    signal("BUY")

if long and useStop
    stop = max(stop, lowest(low, 3))

if long and close < stop
    long = false
    signal("EXIT")

plot(hi, "Upper", aqua)
plot(lo, "Lower", orange)
plot(long ? stop : none, "Stop", red)
```

Read it as: this runs once per bar, top to bottom. `hi` and `lo` are recomputed
every bar. `stop` and `long` keep their values from the previous bar. The third
plot draws nothing on bars where the script is flat, because plotting the absent
value leaves a gap.

---

## 3. Lexical structure

### 3.1 Source text

A source file is UTF-8 text. A byte order mark at the start of the file is
accepted and ignored. Line endings may be LF or CRLF, and CRLF is normalised to
LF before anything else happens, so a file written on one operating system
compiles identically on another.

Outside string literals, only these characters are legal: ASCII letters, ASCII
digits, space, newline, and the punctuation listed in section 3.10. Any other
character, including a non-breaking space pasted from a web page and a typographic
quotation mark pasted from a word processor, is OS1001 with a fix naming the plain
character to use instead.

```
len = input(14)         // legal
len = input(14)         // a non-breaking space before 14 is OS1001
```

The reason for the restriction: a non-breaking space is invisible in every editor
and produces a baffling parse error three tokens later. Rejecting it at the
character with a named fix costs one rule and saves an afternoon.

### 3.2 Comments

A comment starts at `//` and runs to the end of the line. A `//` inside a string
literal is ordinary text.

```
// A comment on its own line.
len = 14            // A comment after code.
msg = "https://x"   // Not a comment: it is inside the string.
```

There are no block comments. An unterminated block comment silently swallows the
rest of a file and reports its error at the last line, which is the worst error
message a compiler can produce, so the form does not exist. Comment a region by
prefixing each line, which every editor does with one keystroke.

### 3.3 Identifiers

An identifier begins with an ASCII letter or an underscore and continues with
ASCII letters, digits and underscores. Identifiers are case sensitive.

```
fastLength = 9      // legal
_scratch   = 0      // legal
2fast      = 9      // OS1029: an identifier cannot start with a digit
längd      = 9      // OS1001: identifiers are ASCII
```

Identifiers are ASCII so that a script is byte-stable across editors, locales and
normalisation forms, and so that two names that look identical on screen can never
be different names. String literals carry the full Unicode range, which is where
non-ASCII text belongs.

The convention, not enforced, is `camelCase` for names and functions and
`UPPER_SNAKE` for values the script treats as constants.

### 3.4 Reserved words

These words are reserved in language version 1 and cannot be used as names:

```
and       array     as        bool      break     case      color
continue  default   else      false     fn        for       if
import    in        is        live      map       matrix    none
not       number    or        return    series    step      string
strategy  study     switch    to        true      type      var
while
```

`import`, `map`, `matrix`, `type` and `as` are reserved but unused in version 1.
They are reserved now so that adding them later cannot break a script that used
one as a variable name, which is the only way a language keeps the promise in
section 4.

The built-in global names (`close`, `plot`, `ema` and the rest of the standard
library) are not reserved words. They are ordinary names in the outermost scope,
and section 12 explains why assigning to one is still an error.

**No library name is a reserved word, and none ever may be.** A call is written
as a name followed by an argument list, and a reserved word is not a name, so a
library that published one would publish a call no script could make. Version 1
shipped two of those for a release: the conversions to `bool` and to `number`
were spelled with the type names, and every spelling of them was refused by the
lexer. They are `toBool` and `toNumber` (section 5.3). A reader who writes the
old spelling as a call still gets OS1019, and the fix names the spelling that
works rather than telling them to rename a variable they never declared.

**A named argument label is not a name.** In `f(label = value)` the label is
matched against the callee's parameter list and is never looked up in any scope,
so labels live in a namespace of their own and a reserved word is legal as one.
`plot(x, "X", color = aqua)` and `psar(start = 0.02, step = 0.02)` are both
correct, and neither is OS1019. A label cannot be ambiguous with an expression,
because nothing in section 19's expression grammar lets a bare reserved word be
followed by `=`, so one token of lookahead settles it. The same rule covers a
label that spells a built-in function, such as `input(14, "Length", min = 2)`:
the label is not a reference to `min`.

The rule stops at the label. A **parameter** of a user function is an ordinary
identifier, because the body refers to it, so `fn f(color = red)` is OS1019; a
library parameter may be called `color` or `step` because nothing ever refers to
it except a label. The alternative, striking `color` and `step` off the reserved
list, would make `color` both a type name and a possible variable name and would
put a name where the `for` header expects `step`, which costs more than one
sentence about labels.

### 3.5 Number literals

A number literal is decimal, optionally with a fractional part, optionally with an
exponent. Underscores may separate digit groups and carry no meaning. A
hexadecimal literal is written `0x` followed by hex digits. There is no octal form
and no binary form.

```
42
3.14
.5              // legal: a leading digit is not required
1_000_000       // one million
2.5e-4
0xFF            // 255
010             // ten, not eight: there is no octal form
```

A number literal has type `number`. There is no separate integer type; see section
5.1.

A negative number is the unary minus operator applied to a literal, not part of
the literal. This matters for one case only: `-2` in an argument list is an
expression, and it parses as you expect.

### 3.6 String literals

A string literal is delimited by double quotes or by single quotes. The two forms
mean exactly the same thing; two delimiters exist so that a string containing one
kind of quote needs no escapes.

```
"BUY"
'He said "go"'
"Line one\nLine two"
"col\tumn"          // a tab escape; the full list is below
```

Escape sequences: `\\`, `\"`, `\'`, `\n`, `\t`, `\r`, `\0`, and `\uXXXX` with
exactly four hexadecimal digits. Any other backslash sequence is OS1004.

A string literal may not span a line. An unterminated literal is OS1004, reported
at the opening quote, with the fix naming the missing delimiter.

### 3.7 Boolean literals

`true` and `false`. They are of type `bool` and are not numbers; see section 5.3.

### 3.8 Colour literals

A colour is written in one of three forms.

```
aqua                    // a named colour
#ff8800                 // hex, 24 bit
#ff880080               // hex with an alpha byte
```

The named colours are:

```
aqua     black   blue    brown   fuchsia  gray     green   lime
maroon   navy    olive   orange  pink     purple   red     silver
teal     white   yellow
```

Names are bare, with no prefix, because a colour appears in almost every line that
draws something and a prefix on a fixed vocabulary of nineteen words is pure
noise. The names are ordinary globals, so the standard library can add more
without a grammar change.

Colours are also produced by functions: `rgb(r, g, b)`, `rgba(r, g, b, a)` with
`a` from 0 to 1, and `fade(color, percent)` which sets a colour's alpha from a
percentage of transparency.

```
plot(signalLine, "Signal", rgb(255, 136, 0))
fill(upper, lower, fade(aqua, 88))
```

### 3.9 The absent literal

`none` is the absent value. It is written bare and has its own type. Section 6
defines everything it does.

```
plot(ready ? value : none, "Value", aqua)
```

### 3.10 Newlines, indentation and blocks

Newlines are significant. A statement ends at the end of its line, and a line
holds at most one statement. There is no statement separator: a `;` is OS1007 with
the fix "put the second statement on its own line".

A block is introduced by a header line (`if`, `else`, `for`, `while`, `case`,
`default`, a multi-line `fn`) and consists of the following lines that are
indented more deeply than the header. The block ends at the first line indented
the same as the header or less.

Throughout this section, **line** means a line that carries at least one token.
A line that holds none, because it is empty, because it holds only spaces, or
because its only content is a comment, is not a line for any of these rules.

```
if close > open
    body = close - open
    signal("UP")
base = 0                // outside the block: same indentation as `if`
```

Rules, all mechanical:

- **A blank line and a comment-only line carry no indentation at all.** They take
  no part in this calculation: such a line never opens a block, never ends one and
  is never OS1003, and any leading whitespace is accepted on it, including none
  and including more than the block it sits inside. The lexer emits no token for
  it, which is the whole of the rule. A commented-out statement dragged to column
  zero is why: every editor writes it that way and every reader already reads it
  that way, and a rule that closed a block on it would close blocks invisibly.
- Indentation is spaces only. A tab in leading whitespace is OS1002 with the fix
  "indent with spaces". Tabs are rejected rather than expanded because the width
  of a tab is an editor setting, so a file whose meaning depends on it is a file
  whose meaning changes when someone else opens it.
- Every line of one block must carry exactly the same leading whitespace. A line
  indented differently from its siblings is OS1003, even when the difference is
  one space.
- The block's indentation must be strictly greater than its header's. Four spaces
  is the convention and the formatter's output, but any consistent amount is
  accepted.
- A header line with no indented line after it is OS1010, with the fix "indent the
  body, or write the whole statement on one line if the form allows it". Blank and
  comment-only lines do not count as a body, so a header followed only by those
  and then a line at or left of the header is still OS1010.

```
if close > open
    body = close - open

    // Still the same block: the blank line above and this comment carry no
    // indentation, so neither one ends it.
    signal("UP")
base = 0
```

The one header with a form that fits on its own line is `fn`, which writes its
body after `=>` and opens no block (section 11.1). `if`, `else`, `for`, `while`,
`case` and `default` have no such form: there is no statement separator to end a
body with, since `;` does not exist (OS1007), so a body of one statement is
written on the next line and indented like any other.

```
fn barChange(src) => src - src[1]   // the single-line form, no block

if crossUp(fast, slow)              // one statement, still its own block
    signal("BUY")
```

There is no brace form and no `end` keyword. One layout rule means every OpenScript
file in the world looks the same, and a diff shows a logic change rather than a
formatting argument.

### 3.11 Line continuation

A statement continues onto the next line in three cases.

1. An open `(` or `[` has not yet been closed.
2. The last token on the line is a binary operator, a comma, a `?`, a `:` or `=`.
3. The line ends with a backslash.

```
total = ema(close, 9) +
        ema(close, 21) +
        ema(close, 50)

plot(macdLine, "MACD",
     color = aqua,
     width = 2)

message = "entry at " + \
          text(close)
```

A continuation line must be indented more deeply than the first line of its
statement, so a continuation can never be mistaken for the start of a new
statement. A continuation line indented the same or less is OS1028, which is a rule of its own rather than the block rule: a continuation opens no block.

A blank line or a comment-only line inside a continuation is ignored on the terms
of section 3.10: it carries no token, so it neither continues nor ends the
statement, and a comment may be written on its own line between two arguments of
a call that spans several lines.

### 3.12 Operator and punctuation tokens

```
+   -   *   /   %
==  !=  <   <=  >   >=
=   +=  -=  *=  /=  %=
(   )   [   ]   ,   .   ?   :
```

`!` alone is not an operator. `!cond` is OS1001 with the fix "write `not cond`".
`&&` and `||` do not exist; the operators are `and` and `or`. There are no
bitwise operators, no increment or decrement operators and no exponent operator;
`pow(x, y)` is the power function, because `^` reads as exclusive or to half the
people who will read this language and as power to the other half, and
`-2 ^ 2` has two defensible answers.

### 3.13 Canonical layout

A file has one canonical layout, and a formatter produces it. The rules are here
rather than in a tool's documentation for two reasons. Two implementations that
disagreed about them would produce diffs against each other for ever, which is
the argument 3.10 says one layout rule exists to end. And what a formatter may do
is a statement about the language rather than about a tool: **laying a file out
again never changes what it means.** Every rule below moves whitespace and
nothing else, and a formatter that cannot lay a file out without moving something
that is not whitespace returns the file untouched.

**Indentation** is four spaces per block, the amount 3.10 names as the
convention. A line that continues a statement under 3.11 is indented eight spaces
past the line that began the statement, so that a continuation is indented more
deeply than a body and can never be read as one. A continuation backslash is kept
where it was written.

**Line breaks inside a statement are kept where they were written.** Where to
break a long argument list is a judgement about what reads well, and the
canonical layout does not make it.

**Inside a line**, one space between two tokens, with these exceptions:

| Written | Not written |
|---|---|
| `f(a, b)` | a space inside a bracket, or before a comma |
| `chart.symbol` | a space around a dot |
| `x = -1` | a space between a sign and what it signs |
| `close[1]` | a space before the bracket of a call, a parameter list or an index |
| `var stop: series number` | a space before the colon of a type annotation |
| `fn f(a) => a + 1` | a space inside the arrow |

A ternary's `?` and `:` are spaced on both sides, like any other operator. The
row above is about the bracket of a call, a parameter list or an index; a bracket
that groups an expression is an ordinary token and takes the ordinary one space,
so `if (a)` and `x = (a + b) * c` keep theirs.

**A comment** written after code is two spaces clear of it. A comment on a line
of its own takes the indentation of the next line that carries a token. Such a
line carries no indentation of its own (3.10), so moving it can neither open nor
close a block.

**Blank lines**: at most one in a row, none before the first line that carries
anything, and the file ends with exactly one line ending. Line endings are LF,
since a file is normalised before anything reads it (3.1).

A file that does not lex and parse has no canonical layout. A formatter returns
it unchanged rather than laying out what it can: a character the lexer refused
produces no token, and a reprint from the tokens would delete it.

---

## 4. The version declaration

A file may declare the language version it was written for. The declaration is
the first line of the file that is not blank and not a comment.

```
version 1
```

It is a bare statement, not a function call, so a host can read it with a one-line
scan and pick a front end before any parsing happens.

The declaration is optional. When it is absent the file is compiled with the
newest language version the compiler implements, and the compiler emits warning
OS8003 suggesting the line to add. A host that stores scripts must record the
language version a revision compiled under, so an unpinned file that compiled
today keeps compiling the same way tomorrow even if the file itself never carries
the line.

### 4.1 The compatibility promise

**A script that compiles under language version N compiles under every later
release of the compiler, and produces the same numbers.**

This is the whole point of the declaration, so it is stated as an obligation on
the project rather than as an aspiration:

- Every past front end is kept in the compiler and selected by the declared
  version. Version 1 source is always parsed by the version 1 front end.
- A new language version may add keywords, add functions, add options to an
  existing function and add types. A word reserved in version 2 is not reserved in
  version 1, so a version 1 script that uses it as a name keeps working.
- A new language version may never change what an existing construct means, and
  may never remove one. A construct that turns out to be a mistake is deprecated:
  it keeps working, the compiler emits an OS8xxx warning naming the replacement,
  and it is still there in version 9.
- A bug fix that changes a number is a version change. If version 1 computed a
  function slightly wrong, version 1 keeps computing it that way and version 2
  computes it right, because a chart that silently redraws itself after an update
  is worse than a chart that is slightly wrong in a documented way.

One exception has been made, and it is recorded rather than folded into the rule:
intraday reads counted from the session's open instead of the epoch, decision 76
of `decisions.md`.

---

## 5. Types

### 5.1 The type list

| Type | Holds | Literal |
|---|---|---|
| `number` | An IEEE-754 binary64 value that is finite | `42`, `3.14`, `0xFF` |
| `string` | A sequence of Unicode code points | `"BUY"` |
| `bool` | `true` or `false` | `true` |
| `color` | Red, green, blue and alpha | `aqua`, `#ff8800` |
| `none` | The absent value, section 6 | `none` |
| `series T` | One `T` per bar, section 5.2 | no literal |
| `array<T>` | An ordered, mutable, resizable list of `T` | `[1, 2, 3]` |
| `plot`, `fill`, `level` | A declaration handle, section 5.4 | no literal |
| `line`, `label`, `box`, `polyline`, `table` | A runtime object, section 5.4 | no literal |

A call that draws or acts rather than computing, `signal()` or `draw.delete()`
for instance, returns **nothing**. Nothing is not a type: it is the absence of a
result, it is not `none`, no name can hold it, and it cannot be written in an
annotation. Using such a call where a value is expected is OS2003.

There is no integer type. A `number` is binary64 throughout, so a length, a bar
count and a price are the same type and no conversion exists to get wrong.
Functions that require a whole number (a lookback length, an array index) reject a
fractional argument with OS3004 rather than truncating it, because a length of
14.5 is a bug in the script and rounding it hides the bug.

A `number` is always finite. Infinity and not-a-number never appear as a value: an
arithmetic operation whose real result does not exist or is not finite produces
`none` instead. See section 6.3.

Time is carried as a `number`: milliseconds since the Unix epoch, UTC. There is no
separate time type in version 1. The library converts to and from calendar fields.

### 5.2 Series

A **series** is the per-bar history of a value. `series number` is one number per
bar, `series bool` is one boolean per bar, and so on.

Reading a series bare gives the value on the bar being executed. The history
operator `[n]` gives the value on the bar `n` bars back.

```
close           // this bar's close
close[1]        // the previous bar's close
close[0]        // identical to close
```

A value has history, and therefore accepts `[]`, in exactly four cases:

1. It is a built-in series: `open`, `high`, `low`, `close`, `volume`, `time` and
   the rest of section 15.1.
2. It is a name declared at the top level of the file.
3. It is a call to a function declared to return a series.
4. It is a parameter of a user function whose declared or inferred type is a
   series, in which case `[]` reads the history of the expression the caller
   passed.

```
diff = close - open         // top level: diff[1] is legal
if trending
    inner = close - open    // inside a block: inner[1] is OS2004
```

`[]` on anything else is OS2004, with the fix "assign it to a name at the top
level of the file first". The restriction exists because retaining history costs
memory per bar, and a language that retained it for every temporary inside every
loop body would not run fifty thousand bars in a browser tab.

A plain `T` used where a `series T` is expected is **broadcast**: it is treated as
that same value on every bar. The reverse also holds: a `series T` used where a
plain `T` is expected means that bar's value. So `ema(close, 9)` and `ema(close,
len)` both work whether `len` is a literal or a series.

```
plot(ema(close, 9), "EMA", aqua)    // 9 is broadcast to every bar
```

Passing an expression to a series parameter causes the engine to retain that
expression's per-bar values for that call site, so `[]` inside the function reads
real history:

```
fn barChange(src) => src - src[1]
plot(barChange(hlc3), "Change", aqua)  // hlc3's history is retained for this call
```

### 5.3 Conversion and coercion

**There is no implicit conversion between types.** A `bool` is not a number. A
number is not a string. `0` is not false and `""` is not false.

```
n = 1 + true            // OS2003: number and bool
s = "count: " + 5       // OS2003: string and number
if 1                    // OS2003: a condition must be bool
```

The reason: every silent coercion rule in every language is a source of bugs that
survive review, and a trading script that quietly treats a zero as a false has a
bug nobody will find until it costs money. Conversion is explicit and short:

| Function | Does |
|---|---|
| `text(x)` | Any value to a string. `text(none)` is `"none"` |
| `text(x, decimals)` | A number to a string with fixed decimals |
| `toNumber(s)` | A string to a number, or `none` if it does not parse |
| `toBool(x)` | `none` to `false`, a bool to itself. Numbers are not accepted |

Two of the three are spelled `to` and the type because `bool` and `number` are
reserved words (section 3.4) and a call needs a name in front of it. `text` is
not an exception to that: `text` is not a type name either, the string type is
spelled `string`, and the same call is the formatter as well.

```
s = "count: " + text(5)         // "count: 5"
label(close, "RSI " + text(r, 1))
```

The one automatic widening is broadcast, section 5.2, which changes no value.

### 5.4 Declaration handles and runtime objects

Some library calls return something that is not a number, a string, a bool, a
colour or an array. There are two kinds of such thing, they wear one word in
casual speech, and their rules are opposites, so the type system names both.

**A declaration handle is a compile-time value.** `plot()`, `plotCandles()`,
`fill()` and `level()` return one, of type `plot`, `plot`, `fill` and `level`.
Each of those calls is top level only (section 15.3) and each declares a fixed
part of the study: a column, a band, a horizontal line. The declaration happens once, before bar 0,
even though the call is written inside the per-bar flow. What happens per bar is
only the evaluation of the call's value argument, which is written to the channel
the declaration reserved. The compiled format splits the call the same way: the
declaration is an entry in the program's `outputs`
(`compiled-program.md` section 2.8) and the per-bar half is one `EMIT`
(section 4.11). A handle is the compile-time half, and it has no run-time
representation at all.

**A runtime object is an ordinary value.** `draw.line()`, `draw.label()`,
`draw.box()`, `draw.polyline()` and `table()` return one, of type `line`,
`label`, `box`, `polyline` and `table`. A script creates objects as bars arrive,
mutates them, keeps them and deletes them. An object is a reference, like an
array (section 14.1): assigning it to a second name gives two names for one
object, and `==` on two of them is identity.

| Operation | `plot`, `fill`, `level` | `line`, `label`, `box`, `polyline`, `table` |
|---|---|---|
| Assign to a name at the top level | yes | yes |
| Assign to a name inside a block or a function | no | yes |
| Hold in a `var` or a `live var` | no | yes |
| Hold in an array | no | yes |
| Pass to a library call that declares that type | yes, `fill` only | yes, the `draw` setters, `cell`, `clear` |
| Pass to, or return from, a user function | no | yes |
| `==`, `!=`, and comparison against `none` | no | yes |
| `[]` | no | no |
| Arithmetic, ordered comparison, a condition, a ternary arm | no | no |
| Survives the bar | it never existed during one | yes, until it is deleted |

A handle where a value is required is OS2003, naming `plot`, `fill` or `level` as
the type; a handle in an argument that does not take one is OS3011. A name bound
to a handle is a compile-time binding, not a per-bar value, so section 8.1 does
not apply to it: it is bound once, and there is nothing of it left in the bar
loop.

The two kinds differ because what they become differs. A plot and a band are
fields of a chart descriptor, fixed when the study is registered, and a fixed
field is not something a script can hold one of. A line or a box is one of an
unbounded, changing set that the script builds as bars arrive, so it has to be a
value the script can keep, put in an array and hand to a function.

`table` sits with the objects, although `table()` is a top-level call like
`plot()`. The call is top level because the grid's size and corner are part of
the study's fixed shape; the thing it returns is written to per bar by `cell()`
and emptied by `clear()`, and a value that library calls take as an argument is a
run-time value by definition. `table()` at one call site returns the same object
on every bar.

**When an object outlives its usefulness.** An object lives from the bar that
created it until the bar that deletes it. Dropping the last name that refers to
it does not delete it: the chart holds it and it keeps drawing. There is no
collection of unreachable objects, because "unreachable" and "no longer wanted"
are different facts and only the script knows the second one.

- `draw.delete(obj)` removes one and `draw.deleteAll()` removes every object the
  script created. `draw.count()` says how many are live.
- A handle to a deleted object is stale, not absent. Passing one to a setter is
  OS4005. Assign `none` to the name when you delete the object, and test with
  `isNone` before mutating it.
- Deleting an object does not remove it from an array holding it. A script that
  keeps objects in an array deletes the object and removes the element.
- A table is never deleted. `clear(t)` empties its cells and the grid lives as
  long as the study does.
- An object created while the moving bar is executing is rolled back with
  everything else when that bar executes again, so a live chart does not gain one
  object per tick (section 7.5).
- The language fixes no number for how many objects a script may hold at once.
  The budget is the host's memory, and a host that cannot hold another one says
  so, with OS5010, rather than quietly dropping the oldest. Nothing is ever
  discarded to make room.

```
upper = plot(basis + dev, "Upper", aqua)    // a declaration handle
lower = plot(basis - dev, "Lower", aqua)
fill(upper, lower, color = fade(aqua, 88))  // the only call that takes one

var zones = []                              // runtime objects
if not isNone(pivotUp)
    push(zones, draw.box(time[5], high[5], time, close, color = red))
if size(zones) > 20
    draw.delete(element(zones, 0))
    shift(zones)
```

### 5.5 How a number becomes text

One rule, wherever a number is written as text: `text(x)`, a table cell, an
alert's message, the constants of a compiled program (`compiled-program.md`
2.14), a case file and an expected column (`conformance.md` sections 2 and 4).
Two engines compare numbers as bits and text as text, so a number that two
rules could spell two ways is a disagreement with no number wrong anywhere.

**The digits.** The shortest string of decimal digits that reads back, under
round to nearest with ties to even, as the same binary64 value. Where two
strings of that length both read back, the one closer to the value; where both
are equally close, the one whose last digit is even. This is the shortest round
trip conversion every current host produces natively, and two hosts have been
measured to agree on it. Where they part company is the layout.

**The layout.** Let the digits be `d1 d2 ... dk`, the last of them not a zero,
and `n` the position of the decimal point, so that the value is `0.d1d2...dk`
times ten to the `n`. For `100`, the digits are `1` and `n` is 3; for `0.05`,
the digits are `5` and `n` is -1.

- `k <= n <= 21`: the digits followed by `n - k` zeros. A whole number below
  ten to the twenty first is written out in full: `100`, `4294967296`,
  `100000000000000000000`.
- `0 < n <= 21`: the digits with a point after the first `n` of them:
  `1234.5678`.
- `-6 < n <= 0`: `0.`, then `-n` zeros, then the digits: `0.05`, `0.000001`.
- Otherwise an exponent: `d1`, then `.` and the remaining digits when `k > 1`,
  then `e`, then `-` when `n - 1` is negative, then `n - 1` in decimal digits
  with no leading zeros and no sign otherwise: `1e21`, `1.5e-7`,
  `1.7976931348623157e308`, `5e-324`.

So the positional range runs from ten to the minus seventh, exclusive, to ten
to the twenty first, exclusive: `0.000001` and `100000000000000000000` are
positional, and `1e-7` and `1e21` are the first values on either side written
with an exponent. There is never a `+` on an exponent, never a `.0` on a whole
number, and never a leading zero before a digit other than in `0.x`.

**Zero** is `0`. A negative zero is also `0`: the language holds one zero
(`compiled-program.md` 3.1), and a rule that could spell `-0` would let the
sign of a zero reach a string. **A negative** value is `-` followed by the text
of its magnitude. A number is always finite (5.1), so there is no spelling for
anything else, and an engine handed one has a defect to report rather than a
string to write.

A host whose own conversion turns to an exponent at sixteen digits or at four
decimal places, writes `1e+21` or `1e-05`, or writes `100.0` for a whole
number, follows this rule and not its own. `spec/vectors/number-text.json`
holds the boundary cases as bit patterns, as decimals and as text, in both
directions, so that an engine in any language can hold its writer to the rule
without reading this repository's source; `tests/emit/number-text.test.ts`
holds this engine to the same file.

`text(x, decimals)` (`stdlib.md` section 10) rounds first and then writes a
positional decimal at every magnitude, never an exponent, and the digits it
writes are the digits this rule gives the rounded and scaled whole number, zero
filled: one rule for which digits a value has, and one call where the layout is
always positional.

---

## 6. The absent value

A per-bar language has to have an answer for "there is no value here": the first
thirteen bars of a fourteen-bar average, a higher timeframe bar that has not
formed, a division by zero, a lookback past the start of history. Getting this
wrong is the single most common source of silent, expensive bugs in this class of
language, so every case below is specified and none of it is left to the engine.

The value is written `none`. Its type is `none`, which is a member of every type:
a `series number` may hold `none` on any bar.

### 6.1 Testing for absence

```
isNone(x)               // true when x is absent
orElse(x, fallback)     // x when present, fallback when absent
```

```
r = rsi(close, 14)
safe = orElse(r, 50)            // 50 during warmup
if isNone(r)
    background(gray)
```

### 6.2 Absence in arithmetic: it propagates

**If any operand of an arithmetic operator is `none`, the result is `none`.**

```
none + 1        // none
none * 0        // none, not 0
-none           // none
(none + 1) * 2  // none
```

`none * 0` is `none` rather than zero, even though zero times anything is zero,
because the operand was not zero: it was unknown, and an unknown quantity
multiplied by zero is only zero if the unknown was a number at all. Propagating
uniformly means one rule to remember instead of a table of special cases, and it
means an absent value travels visibly to the plot, where it draws a gap, instead
of being silently absorbed into a number that looks right.

String concatenation follows the same rule: `"a" + none` is `none`. To print an
absent value deliberately, convert it: `"a" + text(none)` is `"anone"`.

### 6.3 Arithmetic with no answer produces absence

Division by zero produces `none`, including `0 / 0`. A built-in mathematical
function with no finite real result produces `none`: `sqrt(-1)`, `log(0)`,
`log(-1)`, an overflow to infinity.

```
ratio = up / down       // none on a bar where down is 0
```

Division by zero is absence rather than an error because a single bad bar must not
kill a study that is otherwise correct over fifty thousand bars, and it is absence
rather than infinity because infinity cannot be plotted, cannot be compared
usefully and poisons every average it enters. The script can test for it with
`isNone` and decide.

### 6.4 Absence in comparison: it propagates

**If either operand of `<`, `<=`, `>` or `>=` is `none`, the result is `none`,
not `false`.**

```
none < 5        // none
5 > none        // none
none <= none    // none
```

This is the decision that most repays stating. The alternative, returning `false`,
looks convenient and is a trap: it makes `a > b` and `a <= b` both false, so a
script that branches on one and assumes the other is the complement takes the
wrong path during warmup and nobody notices, because warmup bars are off the left
edge of the screen. Propagating absence keeps the identity `not (a > b)` equal to
`a <= b` intact for every input, including absent ones.

### 6.5 Absence in equality: it does not propagate

**`==` and `!=` are total. They always return `true` or `false`, never `none`.**

```
none == none    // true
none == 5       // false
5 != none       // true
```

Equality is the deliberate exception, because a comparison that can itself be
absent gives the script no way to ask the question at all. `x == none` and
`isNone(x)` mean the same thing, and both are usable directly in an `if`.

### 6.6 Absence in boolean operators and conditions

`and`, `or` and `not` use three-valued logic, with `none` meaning "unknown". They
short-circuit: an operand is evaluated only if it can change the result.

| `a` | `b` | `a and b` | `a or b` |
|---|---|---|---|
| `true` | `true` | `true` | `true` |
| `true` | `false` | `false` | `true` |
| `true` | `none` | `none` | `true` |
| `false` | any | `false` | `b` |
| `none` | `true` | `none` | `true` |
| `none` | `false` | `false` | `none` |
| `none` | `none` | `none` | `none` |

`not none` is `none`.

Both operators are commutative: `a and b` is `b and a` and `a or b` is `b or a`
for every pair of values in the table, so De Morgan's laws hold for absent
operands as well as present ones. Absence is absorbed exactly when the other
operand decides the answer on its own, which is a `false` under `and` and a `true`
under `or`; everywhere else the unknown operand makes the result unknown.

**A condition that evaluates to `none` takes the false branch.** This applies to
`if`, `while`, the ternary, a `switch` condition arm and an alert condition.

```
if rsi(close, 14) > 70          // during warmup: none, so the branch is skipped
    signal("OVERBOUGHT")
```

This is the one place absence is absorbed rather than propagated, and it is
unavoidable: execution has to go somewhere. It is safe here in a way that
returning `false` from a comparison is not, because the absorbing happens at the
branch, where it is visible in the source, rather than inside an expression three
lines earlier. The compiler emits warning OS8004 on an `if` whose condition can be
absent and whose block assigns to a name used outside it, since that is the shape
where warmup silently changes an answer.

**Not raised yet.** OS8004 is in the catalogue and nothing raises it: the
checker does not follow which names a branch on a possibly absent condition
assigns.

### 6.7 Absence in the standard library

Every library function that reads a window of bars propagates absence: if any bar
in the window is absent, the result for that bar is absent. Functions that
deliberately ignore absent values are named for it, and `stdlib.md` section 2.4
lists the ones version 1 has.

```
sma(close, 20)          // none until 20 bars exist, and none after any gap
avgSkip(values, 20)     // ignores absent bars and averages the rest
```

Absence reaching a drawing surface is a gap, never a zero: a plot breaks its line,
a fill stops, a bar colour leaves the bar its own colour, a table cell is blank.

### 6.8 Absence and orders

An order function given an absent price or an absent quantity does not place a
malformed order and does not silently substitute a value. It rejects with OS7002,
naming the argument that was absent. An order is the one place in the language
where doing nothing quietly is worse than stopping loudly.

**An argument the script did not write is not an absent argument.** `buy()` means
"use the size I declared" and takes the default `stdlib.md` 17.2 states for it.
`buy(qty = none)` means "I computed a size and it came out absent", and that is
the case this section is about: a sizing calculation that has not warmed up, or a
divisor that was zero, about to send an order at a size nobody chose. The two are
told apart at compile time, where the difference is visible, and
`compiled-program.md` 4.10 says how an engine is told which it was.

---

## 7. The per-bar execution model

### 7.1 What runs when

Compilation happens once. Execution happens once per bar.

```
source text
   -> tokens -> tree -> checked tree -> compiled program     (once)
   -> for each bar: run the program top to bottom            (once per bar)
```

For each bar in the dataset, in chronological order, the engine executes every
top-level statement of the script from the first line to the last. There is no
main function, no event handler and no entry point: the file is the body of the
per-bar loop.

```
study("Trace")
n = bar.index           // runs on bar 0, then bar 1, then bar 2, ...
plot(n, "Bar index")
```

The statements that declare a file's fixed shape, which are the ones section 15.3
lists as top level only, and the declaration itself, are read once, when the
program is compiled, even though they sit in the per-bar body. Their
**arguments** are still evaluated every bar, which is how a plot gets a new value
per bar. This is why those statements must appear at the top level: what a file
declares has to be fixed before the first bar runs, so that the chart can build a
legend and a settings dialog and the run's record has a stable set of names to
key on. Putting a plot inside an `if` is OS3006, with the fix "plot `none` on the
bars you want hidden".

```
plot(trending ? ema20 : none, "EMA 20", aqua)   // correct
if trending
    plot(ema20, "EMA 20", aqua)                 // OS3006
```

### 7.2 Bar index and bar facts

`bar.index` is the zero-based position of the bar being executed within the
dataset the engine was given. The oldest bar is 0.

`bar.index` is a position in the supplied data, not a universal address. Loading
more history shifts every index, so a script that stores a bar index and compares
it after more bars arrive is storing something that changed underneath it. Store
`time` for that, which does not move.

The `bar` namespace:

| Name | Type | Means |
|---|---|---|
| `bar.index` | `series number` | Position of this bar, oldest is 0 |
| `bar.count` | `series number` | `bar.index + 1`, bars seen so far |
| `bar.isFirst` | `series bool` | `bar.index == 0` |
| `bar.isLast` | `series bool` | This is the newest bar in the dataset |
| `bar.isConfirmed` | `series bool` | This bar's interval has elapsed |
| `bar.isRealtime` | `series bool` | A live feed is driving updates |
| `bar.isNew` | `series bool` | The last update appended a bar rather than replacing one |
| `bar.updates` | `series number` | How many times this bar has been executed, counting from 1 |

This table is where the bar facts are defined, and it is the only place they are
defined: every other document cites it.

The host states four of them about the execution, `bar.isNew`, `bar.isConfirmed`,
`bar.isRealtime` and `bar.updates`. The engine derives the other four from the
dataset and this bar's position in it: `bar.index` is the position, `bar.count`
is `bar.index + 1`, `bar.isFirst` is `bar.index == 0`, and `bar.isLast` is true
when `bar.index` is the greatest index the host has supplied. A fact the engine
can derive is never also stated by the host, because two sources for one number
can disagree and no rule would say which of them wins.

Bar state is one of the channels an engine reads from the host
(`compiled-program.md` section 5.2), and the duties a host carries when it
supplies one are `host-interface.md` section 6.4's.

`bar.isConfirmed` is `true` for every historical bar and for the newest bar once
its interval has elapsed. It is the flag a script uses to refuse to act on a bar
that is still moving.

### 7.3 Warmup

There is no implicit warmup phase and no bar at which the script "starts for
real". The script runs on bar 0 exactly as it runs on bar 40,000.

A function that needs `k` bars returns `none` until `k` bars exist. That is the
whole of warmup, and it is expressed entirely through the absent value.

```
study("Warmup")
e = ema(close, 20)      // none on bars 0..18, a number from bar 19
plot(e, "EMA 20", aqua) // the line simply starts at bar 19
```

Warmup lengths are exact and specified per function, because "approximately
correct after a while" is the difference between an indicator that matches a
reference implementation and one that does not. `ema(src, n)` is absent for the
first `n - 1` bars and is seeded on bar `n - 1` with the simple average of those
`n` values; `rma`-based functions state their own seeding the same way. A
conforming implementation must produce absence on exactly the same bars.

### 7.4 The history operator at bar 0

**`x[n]` where `n` is greater than `bar.index` is `none`.** It is not an error, it
is not clamped to the oldest bar, and it is not zero.

```
close[1]        // on bar 0: none. On bar 1: bar 0's close.
close[100]      // on bar 7: none.
```

Clamping would be the worst of the three options, because it invents a value that
looks like data: `close[1]` clamped to `close[0]` makes `close - close[1]` exactly
zero on bar 0, which is a plausible-looking change of zero rather than a visible
gap. Absence propagates through the subtraction and the plot draws nothing, which
is the truth.

The remaining cases:

- `n` is not a whole number: OS4001, with the fix naming `floor` or `round`.
- `n` is negative: OS4001. Reading the future is not available at any price, and
  a literal negative index is caught at compile time as OS3004.
- `n` is `none`: the result is `none`, by section 6.2.
- `n` exceeds the retained depth: OS4002, naming the current depth and the
  `limits(history = ...)` line that raises it. This is an error rather than `none`
  because the value existed and the engine threw it away, which is a different
  situation from the value never having existed, and conflating the two would hide
  a real bug behind a plausible gap.

By default the engine retains the full history of every series for the dataset it
was given, so OS4002 appears only when a host has set a depth deliberately.

### 7.5 The last, still-moving bar

The newest bar of a live chart is executed again on every update: every tick, or
every time the host pushes a new snapshot of it. `bar.updates` counts the
executions.

**The rollback rule.** Before each re-execution of a bar, the engine restores
every persistent value to what it held at the end of the last execution of the
**previous** bar. Persistent values include `var` names and the contents of arrays
those names hold. The effect is that executing the moving bar twice gives the same
answer as executing it once: the script is idempotent in the bar.

```
study("Rollback")
var barCount = 0
barCount = barCount + 1
plot(barCount, "Bars")  // counts bars, not ticks, even on a live chart
```

Without rollback that counter would climb by one per tick and the same script
would produce different numbers on a live chart than in a backtest of the same
data, which would make the whole project pointless.

A `live var` opts out of rollback when counting updates is actually the intent;
see section 8.2.

**What a script may do on a still-moving bar:** everything computational. Read
values, compute, plot, draw, colour bars, write a table, read `bar.isConfirmed`
and branch on it. All of it is recomputed from scratch on each update, so nothing
accumulates.

**What a script may not do on a still-moving bar, by default:** emit a `signal`,
fire an `alert`, or place, modify or cancel an order. Those calls are deferred
until the bar is confirmed, and if the condition that produced them is no longer
true when the bar closes, they never happen at all. A study or strategy opts in
with `onUnconfirmed = true` in its declaration, which is a deliberate choice with
a name, and the compiler then emits warning OS8002 on any higher timeframe read in
that file, because that combination is where repainting comes from.

```
strategy("Confirmed only")              // the default
if crossUp(fast, slow)
    buy(qty = 1)                        // placed when the bar closes

strategy("Intrabar", onUnconfirmed = true)
if crossUp(fast, slow) and bar.isConfirmed
    buy(qty = 1)                        // the script now guards it itself
```

A script may not assume it runs once on the newest bar. Any logic that must happen
exactly once per bar guards itself with `bar.isConfirmed`, or relies on rollback,
which handles it automatically.

### 7.6 Determinism

The same compiled program over the same bars must produce the same output on every
engine, every time. Therefore:

- All arithmetic is IEEE-754 binary64 with round-to-nearest-even, in the order the
  source writes it. An engine may not reassociate, may not fuse a multiply and an
  add, and may not use extended precision registers.
- Iteration order over an array is index order. There is no unordered collection
  in version 1.
- There is no source of randomness and no reading of the wall clock during a bar,
  except through the explicitly named `chart.now()`, whose value the host supplies
  and the conformance suite fixes.

---

## 8. Persistence

### 8.1 A plain assignment is recomputed every bar

A name assigned without `var` is computed fresh on every bar. Its previous value
is still readable through `[]`, but it is not the starting point for this bar's
computation.

```
barCount = barCount + 1     // OS2001: barCount is not defined yet on this bar
barCount = barCount[1] + 1  // legal, but none on bar 0, and none forever after
```

The second line shows why `var` exists: `barCount[1]` is `none` on bar 0, the
addition propagates absence, and the series is absent on every bar thereafter. A
per-bar language needs a way to say "keep this".

### 8.2 var

`var name = initial` declares a value that is initialised once, on the first bar
the declaration is reached, and then keeps whatever value it holds from bar to
bar.

```
var barCount = 0
barCount = barCount + 1     // 1, 2, 3, ...

var runningHigh = none
if isNone(runningHigh) or high > runningHigh
    runningHigh = high
```

Details, all of them decided rather than incidental:

- The initialiser runs **once**, on the first bar on which control reaches the
  declaration. If the declaration sits inside an `if` that is false for the first
  hundred bars, the value is absent for those bars and is initialised on bar 100.
- `var` may appear at the top level, inside a block or inside a function.
- A `var` inside a block is still scoped to that block (section 12). Persistence
  and scope are separate questions: `var` says how long the value lives, the
  block says where the name can be seen.
- `var` obeys the rollback rule of section 7.5.
- The declaration and the assignment are one statement. `var barCount` without an
  initialiser is OS1011; the fix names `var barCount = none`.

`live var` is identical except that it does not roll back, so it survives
re-execution of the moving bar. It exists for one purpose, counting or
accumulating over intrabar updates, and it is spelled with an extra word because a
script that uses it produces different numbers live than in a backtest and the
reader should see that coming.

```
live var ticks = 0
ticks = ticks + 1
plot(ticks, "Updates this session")
```

### 8.3 Series history versus persistence

These two are often confused and are unrelated. History is a read of the past.
Persistence is a value that carries forward.

```
close[1]        // history: what close was one bar ago
var x = 0       // persistence: x survives into the next bar
x[1]            // both: what the persistent x was one bar ago
```

---

## 9. Expressions and operators

### 9.1 Precedence

Highest binding first. Every level is left associative except where noted.

| Level | Operators | Notes |
|---|---|---|
| 1 | `(expr)`, `f(args)`, `a[i]`, `a.b` | Grouping, call, history or element, member |
| 2 | unary `-`, unary `+`, `not` | Right associative |
| 3 | `*`, `/`, `%` | |
| 4 | `+`, `-` | Binary |
| 5 | `<`, `<=`, `>`, `>=` | Not chainable, see 9.3 |
| 6 | `==`, `!=` | Not chainable |
| 7 | `and` | Short-circuits |
| 8 | `or` | Short-circuits |
| 9 | `cond ? a : b` | Right associative |

```
a + b * c           // a + (b * c)
-x % y              // (-x) % y
not a and b         // (not a) and b
a or b and c        // a or (b and c)
x > 0 ? "up" : x < 0 ? "down" : "flat"      // nests to the right
```

Assignment is not an operator and does not appear in the table; it is a statement,
section 10.1.

### 9.2 Arithmetic

`+`, `-`, `*`, `/` are the usual operations on `number`, with the absence rules of
section 6 and the finiteness rule of section 5.1.

`+` also concatenates two strings. It does nothing else: `"a" + 5` is OS2003.

`%` is the remainder of truncated division, so its sign follows the left operand:
`-7 % 3` is `-1` and `7 % -3` is `1`. `a % 0` is `none`, by section 6.3.

The library has the floored form, `mod(a, b) = a - b * floor(a / b)`, whose sign
follows the right operand: `mod(-7, 3)` is `2` and `mod(7, -3)` is `-2`.
`mod(a, 0)` is `none`. The two agree for every positive `b`, which is every use
that wraps an index, a bar count or a session offset. Both exist because both are
wanted about equally often and picking one leaves half of all uses writing the
correction by hand. `stdlib.md` section 8.1 is the authority for `mod`, and the
`MOD` instruction of `compiled-program.md` section 4.5 is this `%` and not that
`mod`.

### 9.3 Comparison

`<`, `<=`, `>`, `>=` compare numbers and strings. String comparison is by Unicode
code point, which is stable across locales; it is not a human-friendly alphabetical
sort and is not offered as one.

`==` and `!=` compare any two values of the same type, and a value against `none`.
Comparing two different types is OS2003, except against `none`, which is always
allowed. Two `color` values are equal when all four channels match. Two arrays are
equal when they are the same array, not when they hold equal elements; `arrayEqual`
compares contents. The same holds for every reference: two runtime objects
(section 5.4) are equal when they are the same object, and there is no operation
that compares two of them by content. A declaration handle cannot be compared at
all.

A comparison may not be chained. `a < b < c` is OS1008, with the fix
`a < b and b < c`. Chaining is rejected rather than given the mathematical meaning
because the C-family reading (`(a < b) < c`) and the mathematical reading are both
plausible to a reader, and a form with two plausible meanings has no place in a
language that places orders.

### 9.4 Boolean operators

`and`, `or`, `not`, with the three-valued table of section 6.6. `and` and `or`
short-circuit: the right operand is evaluated only when it can change the answer.
`or` therefore evaluates its right operand when the left operand is absent,
because a `true` on the right decides the answer by itself, and `and` evaluates
its right operand for the mirror reason, because a `false` on the right decides
it.

Short-circuiting interacts with stateful calls. If the right operand contains a
call that holds per-bar state and it is not evaluated on some bar, that call's
state does not advance and its series holds `none` for that bar. This is specified
behaviour, not a hazard to avoid, and section 11.4 explains it.

### 9.5 The ternary

`cond ? a : b`. Both arms must have the same type, or one arm may be `none`. Only
the taken arm is evaluated.

```
tint  = up ? lime : red
value = ready ? computed : none
```

### 9.6 The history and element operator

`a[i]` is history when `a` is a series and element access when `a` is an array.
The checker knows which from the type of `a`, so there is no ambiguity at compile
time and no run-time dispatch.

```
close[1]        // history: one bar back
prices[1]       // element: the second element, if prices is an array
```

The one case where a reader can be misled is a `var` holding an array, where `[]`
indexes the array and the reader might have expected the previous bar's array. The
explicit form covers it: `history(expr, n)` always means history, and
`element(arr, i)` always means element access. Use them where a line is doing both.

```
var prices = [0.0]
prices[0]                   // the first element
history(prices, 1)          // the array as it stood one bar ago
```

---

## 10. Statements and control flow

### 10.1 Assignment

```
name = expression
name += expression      // and -= *= /= %=
```

Assignment is a statement, never an expression, so `if x = 5` is a syntax error
(OS1006) with the fix "write `==` to compare". The compound forms are shorthand
for the obvious expansion and obey the same rules, including absence propagation:
`x += none` leaves `x` absent.

A name's type is fixed by its first assignment. Assigning a different type later
is OS2003.

```
len = 14
len = "fourteen"        // OS2003
```

**`none` is not a type-fixing value.** `none` is a member of every type
(section 6), so a first assignment of `none` carries no type information and
there is nothing for the rule above to fix. The type comes from the first
assignment in source order that gives the name a value of a definite type. Every
assignment after that one must be that type or `none`, and a second definite type
is OS2003 exactly as it is anywhere else. A name that is never given a definite
type is of type `none`: it is absent on every bar of the run, and it is legal
wherever `none` is legal, so it plots a gap, compares with `==` and propagates
through arithmetic. The language takes a type from elsewhere in the same way for
a ternary arm that is `none` and for an empty array literal (section 14.1).

```
var stop = none
stop = lo               // the type is fixed here, by the first definite value
```

### 10.2 if and else

```
if condition
    block

if condition
    block
else
    block

if condition
    block
else if condition
    block
else
    block
```

The condition must be `bool` or `none`. A `none` condition takes the false branch
(section 6.6). A condition of any other type is OS2003, with no truthiness rule to
remember.

```
if close > open and volume > sma(volume, 20)
    signal("STRONG")
else if close < open
    signal("WEAK")
```

`else if` is written as two words on one line and does not increase indentation.

### 10.3 for

Two forms. `to` is inclusive at both ends.

```
for i = 0 to 9              // ten iterations: 0,1,2,...,9
    total += close[i]

for i = 9 to 0 step -1      // ten iterations, descending
    print(close[i])

for price in prices         // over an array's elements
    total += price
```

`step` defaults to `1`. If the end is below the start and the step is positive, or
the end is above the start and the step is negative, the body does not run at all;
the range is never silently reversed in either direction. A step of `0` is OS3004.
An absent start, end or step is OS4013 and stops the bar rather than running the
loop zero times, because a loop that quietly does nothing during warmup leaves a
plot that looks computed. Making a descending loop say `step -1` costs one word and
removes the only shape of `for` loop that can spin forever by accident.
`compiled-program.md` section 4.8 carries the compiled form, where `FOR_INIT` makes
both of these decisions.

The loop variable is scoped to the loop and may not be assigned in the body
(OS2006). To leave early, use `break`.

The `in` form visits indices `0` to `size - 1` as measured when the loop is
entered. Elements appended during the loop are not visited. If the array shrinks
so the cursor is past the end, the loop stops.

### 10.4 while

```
while condition
    block
```

The condition is re-evaluated before each iteration, with the same `bool` or `none`
rule as `if`.

```
i = 0
while i < size(prices) and prices[i] < close
    i += 1
```

### 10.5 break and continue

`break` leaves the innermost `for` or `while`. `continue` skips to its next
iteration. Either one outside a loop is OS1009.

### 10.6 switch

`switch` is a statement, not an expression. Two forms.

**Value form**, which compares a subject against each case:

```
switch method
    case "fast"
        len = 9
    case "slow", "verySlow"
        len = 21
    default
        len = 14
```

**Condition form**, with no subject, which takes the first arm whose condition is
true:

```
switch
    case rsiValue > 70
        zone = "high"
    case rsiValue < 30
        zone = "low"
    default
        zone = "mid"
```

Rules:

- Arms do not fall through. Each arm's block ends at the next `case` or `default`.
- A `case` may list several values separated by commas. All must have the subject's
  type.
- `default` is optional and must be last. With no `default` and no match, nothing
  happens.
- Because a name first assigned inside a block is local to that block
  (section 12), a name that the arms set must be declared before the `switch`.
  This is deliberate: it makes the "declared in one arm only" bug impossible.

```
len = 14                    // declare it here
switch method
    case "fast"
        len = 9
plot(sma(close, len), "SMA", aqua)
```

An expression form of `switch` is not in version 1. The ternary covers choosing a
value, and a statement form that is sometimes an expression doubles the grammar for
a small gain.

### 10.7 The loop budget

A script runs inside a chart in a browser tab. A loop whose exit condition is never
met would freeze that tab, so every loop is compiled with a counter.

**Every iteration of every loop, summed over all loops executed during one bar,
counts against a per-bar budget. The default budget is 2,000,000 iterations.
Exceeding it raises OS5001, naming the line of the loop that was running when the
budget ran out.**

OS5001 stops that bar and marks the study as errored, with the message on the
chart. It does not silently break out of the loop, because a loop that ran 2
million times and then stopped produces a plausible wrong number, and a plausible
wrong number is worse than no number.

The budget is per bar rather than per loop so that a script with one nested loop is
treated the same as a script with ten sequential loops, and it resets each bar so
that a long dataset is not itself a reason to fail.

The budget is a default, not a ceiling. A script that genuinely needs more raises
it, deliberately, in one place:

```
study("Heavy")
limits(loops = 50_000_000)
```

`limits()` is optional, appears at most once, and must be the statement
immediately after the declaration. Its options are `loops` (per-bar iteration
budget) and `history` (retained series depth, section 7.4). Arguments must be
literal numbers. A host may reject a `limits()` call that exceeds what it is
willing to run and must say so with OS5003 rather than quietly capping it.

---

## 11. Functions

### 11.1 Declaration

```
fn name(parameters) => expression                   // single line

fn name(parameters) =>
    statements
    finalExpression                                  // multi line
```

```
fn typicalPrice() => (high + low + close) / 3

fn zscore(src, len) =>
    m = sma(src, len)
    s = stdev(src, len)
    (src - m) / s
```

A function is declared at the top level of a file. Functions may not be nested and
may not be assigned to variables; there are no function values in version 1.

### 11.2 Parameters and arguments

Parameters may carry type annotations and default values. Annotations are optional
and are checked when present; without one, the type is inferred from use and from
the call sites.

```
fn band(src: series number, len: number = 20, mult: number = 2) =>
    basis = sma(src, len)
    dev = mult * stdev(src, len)
    basis + dev
```

At a call site, arguments may be positional, named, or positional followed by
named. A named argument may not repeat a positional one.

```
band(close)
band(close, 50)
band(close, mult = 3)
band(src = close, len = 50, mult = 3)
band(close, len = 20, 3)        // OS3005: positional after named
```

Wrong argument count is OS3001. An unknown named argument is OS3002, and the
message lists the names that exist.

### 11.3 Return

A `return expression` statement exits the function immediately with that value. A
bare `return` exits with `none`.

If the last statement of a function body is a bare expression, that expression is
the return value. A function whose body ends in something other than an expression
and which never executes a `return` returns `none`.

```
fn clampTo(x, lo, hi) =>
    if x < lo
        return lo
    if x > hi
        return hi
    x                       // the final expression is the return value
```

Both forms exist because the one-line form needs the implicit version and an early
exit needs the explicit one. A function that mixes them is legal and reads fine.

### 11.4 A function that holds per-bar state

A function body may contain `var`, and may call library functions that hold state
of their own such as `ema` or `rma`.

**State is allocated per call site, not per function.** Two calls in two places are
two independent pieces of state. This is the rule that makes a stateful helper
reusable at all.

```
fn sinceTrue(cond) =>
    var n = none
    if cond
        n = 0
    else if not isNone(n)
        n = n + 1
    n

sinceUp   = sinceTrue(close > open)     // its own counter
sinceHigh = sinceTrue(high > high[1])   // a separate counter
```

The consequences, all stated rather than discovered:

- **A call inside a loop shares one state slot across every iteration of that
  loop**, because the call site is one site. That is what a running accumulation
  inside a loop wants. For state per iteration, keep an array and index it.
- **Recursion is not allowed.** A function may not call itself, directly or through
  a cycle, and the compiler reports OS2005 naming the cycle. State slots are
  allocated statically per call site, and recursion would need a dynamic stack of
  them; the cost of that is paid on every bar of every script, to support a form
  that a per-bar language almost never needs. Write a loop.
- **A call site that does not execute on a bar leaves its series absent for that
  bar and its state untouched.** The state does not advance, and the previous
  value is not carried forward.

```
if trending
    e = ema(close, 20)      // the ema advances only on trending bars
```

This last rule is the honest answer to a question every per-bar language has to
face, and the alternatives are worse. Forcing the call to run anyway would mean
executing code the script said not to execute. Carrying the previous value forward
would produce a flat line that looks like data. Absence is visible: the plot breaks,
and the reader can see exactly which bars the call skipped. Because this is almost
always a mistake rather than an intent, the compiler emits warning OS8001 on a
stateful call inside a conditional branch, naming the call and suggesting the fix,
which is to compute it unconditionally at the top level and use the result inside
the branch.

```
e = ema(close, 20)          // computed on every bar
if trending
    plot(e, "EMA", aqua)    // used only where it matters
```

---

## 12. Scope

### 12.1 Scopes

There are three kinds of scope, nested:

1. The **global scope**, holding the standard library and the built-in series.
2. The **file scope**, holding every name assigned at the top level of the file and
   every `fn` declared in it.
3. A **block scope**, created by each `if` block, each `else` block, each `for` or
   `while` body, each `case` or `default` arm, and each function body. A function's
   parameters are in its body's scope.

### 12.2 Declaration and update

**A name is declared by its first assignment in a scope. An assignment to a name
that already exists in an enclosing scope updates that name and does not create a
new one.**

```
threshold = 70                  // declared in file scope
if volatile
    threshold = 80              // updates the file-scope name
plot(threshold, "Threshold")    // 80 on volatile bars
```

```
if volatile
    scratch = high - low        // declared in the block scope
plot(scratch, "Scratch")        // OS2001: scratch is not visible here
```

This pair of rules is the whole of scoping, and together they mean a reader never
has to ask which of two variables a line is writing to. There is exactly one
`threshold`, and there is exactly one place `scratch` can be read.

### 12.3 No shadowing

**Declaring a name in an inner scope when the same name exists in an enclosing
scope is an error: OS2002.**

Since an assignment to an existing outer name updates it, shadowing could only be
requested by some explicit syntax, and no such syntax exists. Attempting it is
therefore always a mistake, and the compiler says so with the line of the outer
declaration in the message.

```
len = 20
fn helper(src) =>
    len = 9                     // OS2002: len is declared at line 1
    sma(src, len)
```

Shadowing is banned rather than allowed because the most expensive class of bug in
per-bar scripts is a value that is right in one place and stale in another, and
two different variables with one name is the shortest path to it. The fix is to
rename, which the error message suggests.

A function parameter is subject to the same rule: a parameter named after a
file-scope name is OS2002, and so is a parameter named after a standard library
function.

### 12.4 Assigning to a built-in

A built-in name (`close`, `ema`, `aqua`, `plot`) lives in the global scope, so
assigning to one is a shadowing attempt and is OS2002. The message says which
built-in and suggests a name.

```
close = 5       // OS2002: close is a built-in series
ema = 9         // OS2002: ema is a built-in function
```

### 12.5 Order of declaration

Within the file scope, a name must be assigned before it is read, reading top to
bottom, because the file is the body of a per-bar loop and the loop runs in source
order. Reading a name before its assignment is OS2001, not an absent value.

Functions are the exception: a `fn` may be called before its declaration appears,
because a function declaration is not a per-bar statement and the checker collects
all of them before checking bodies.

```
plot(helper(close), "H", aqua)      // legal: helper is declared below
fn helper(src) => sma(src, 9)
```

---

## 13. Declarations: study and strategy

### 13.1 The declaration statement

Every file carries exactly one declaration, and it is the first statement after the
optional `version` line and any leading comments.

```
study("Name", options...)
strategy("Name", options...)
```

`strategy()` accepts every option `study()` accepts and adds the trading options of
section 13.3. A strategy is a study that can also place orders, so the same file
plots and trades and the numbers cannot disagree.

A file carries one declaration rather than allowing both, because two declarations
would need a rule for which one's `overlay` or `precision` wins, and the answer to
that question is always "there should only have been one".

Missing declaration: OS2007. Two declarations: OS2008.

Sections 13.2 and 13.3 are where every option of both declarations and its
default value is defined, and they are the only place either is defined. Every
option is optional except `title`, and an option a script leaves out takes the
default in its own row. What a compiled program writes them as is
`compiled-program.md` section 2.3.

### 13.2 study options

All option values must be compile-time constants: literals, arithmetic over
literals, or a call to `input()`. An option that depends on a bar's data is OS3003,
because a settings dialog and a legend are built before the first bar runs. An
`input()` is a constant for this purpose, because it is resolved before bar 0.

**An `input()` counts as the whole of the value and not as a term inside a larger
one.** `precision = input(2, "Decimals")` and `precision = decimals`, where
`decimals` holds an input, are admissible. `precision = decimals + 1` and
`opacity = shade ? 1 : 0` are not, and are OS3025: the compiled program carries a
field fixed before bar 0 as its value or as a reference to one input
(`compiled-program.md` 2.3), and an expression over a setting is neither. The
resolved value then has to be one the field accepts, which is checked at load
(OS6019). A script that wants a tunable field declares the setting as that field:
a slider for the opacity rather than a switch computed into one. The same holds
for every field fixed before bar 0, wherever it is written, and more tightly for
an input's own default, bounds and step, which read no setting at all.

| Option | Type | Default | Means |
|---|---|---|---|
| `title` | `string` | required | The name in the legend and the picker. First positional argument |
| `short` | `string` | `title` | A shorter legend name |
| `overlay` | `bool` | `false` | `true` draws on the price pane, `false` gives the study its own pane |
| `precision` | `number` | `4` | Decimals on this study's axis and legend, 0 to 10 |
| `format` | `string` | `"price"` | `"price"`, `"percent"` or `"volume"`. Axis and crosshair formatting |
| `range` | `array<number>` | `none` | `[min, max]` to fix the study pane's scale, as in `[0, 100]` |
| `scale` | `string` | `"right"` | `"right"`, `"left"` or `"none"` |
| `group` | `string` | `""` | Category in a picker |
| `onUnconfirmed` | `bool` | `false` | Allow signals and alerts on a bar that is still moving, section 7.5 |

```
study("RSI", precision = 2, range = [0, 100])
level(70, "Overbought", red)
level(30, "Oversold", lime)
plot(rsi(close, 14), "RSI", purple)
```

### 13.3 strategy options

Every `study()` option, plus:

| Option | Type | Default | Means |
|---|---|---|---|
| `capital` | `number` | `100000` | Starting equity for the backtest |
| `currency` | `string` | `""` | Display label for money in the report |
| `qty` | `number` | `1` | Default order size when an order names none |
| `qtyType` | `string` | `"units"` | `"units"`, `"lots"`, `"cash"` or `"equityPercent"` |
| `product` | `string` | `"intraday"` | `"intraday"` or `"overnight"` |
| `fillOn` | `string` | `"nextOpen"` | `"nextOpen"` or `"close"`. Where a signalled order is filled |
| `slippage` | `number` | `0` | Ticks of adverse slippage applied to every fill |
| `commission` | `number` | `0` | Cost per the `commissionType` unit |
| `commissionType` | `string` | `"perTrade"` | `"perTrade"`, `"perUnit"` or `"percent"` |
| `pyramiding` | `number` | `1` | Maximum entries in one direction before entries are refused |
| `closeOnSessionEnd` | `bool` | `false` | Flatten at the session close |

`fillOn` defaults to `"nextOpen"` rather than `"close"` because a decision made
from a bar's close cannot be filled at that same close in the real market, and a
backtest whose default is optimistic is a backtest that lies.

```
strategy("EMA cross", overlay = true,
         capital = 500000, qty = 1, qtyType = "lots",
         slippage = 1, commissionType = "perTrade", commission = 20)

fast = ema(close, 9)
slow = ema(close, 21)

if crossUp(fast, slow)
    buy(qty = 1)

if crossDown(fast, slow)
    close()
```

### 13.4 input

`input()` declares a tunable value and builds one row of the settings dialog. It
may appear only at the top level of a file, never inside a block or a function,
because the dialog is built once, before the first bar.

```
len   = input(14,      "Length", min = 1, max = 500)
src   = input(close,   "Source")
on    = input(true,    "Show the band")
tint  = input(aqua,    "Colour")
mode  = input("fast",  "Mode", options = ["fast", "slow"])
tf    = input("60",    "Higher timeframe", kind = "interval")
```

The value's type follows the default's type, which is why the default comes first.
An `input()` inside a block is OS3007.

**Where it may be written.** Anywhere at the top level that a value belongs: as
the whole of an assignment, inside a larger expression, as an option of the
declaration statement, and inside the expression argument of a read
(`stdlib.md` section 15.4). The two places it may not go are a block and a
function body, and each is OS3007, because the dialog is built once and a row
that appeared or vanished with the data would have nothing for a saved setting to
attach to. A read's expression is neither of those: it is compiled over another
instrument's bars, and a setting is the one thing from this file that has a
meaning there, because it resolves before bar 0 and holds for the whole run. The
compiled program carries it as one entry of the read's `inputs`
(`compiled-program.md` section 2.16), which is the same machinery a name bound to
an input already used.

**A name in front of it.** `len = input(14, "Length")` makes the name another
spelling of the setting: it reads the input's own slot, and it is a compile-time
constant, so a declaration option may be written from it. `var len = input(14,
"Length")` is an ordinary `var` whose initial value is the setting: the cell is
initialised once, on the first bar, and keeps whatever the bar puts in it after
that, which is how a running total starts from a setting. A setting cannot change
mid-run (`host-interface.md` section 8.2), so a `var` nothing assigns to holds
exactly what the plain form holds; what the word buys is the assignment. A `var`
is therefore not a compile-time constant: it is OS3003 in a declaration option
and OS6003 inside a read's expression, like any other per-bar name.

**One option it cannot reach.** A plot's `style` is carried in the compiled
program as a plain string rather than as a value or an input reference
(`compiled-program.md` section 2.3), so an input written into it has nowhere to
go: it is OS3026, and the style is written out. Every other declaration option
takes a setting as the whole of its value (section 13.2).

**Its title names it.** The title is the row's label in the settings dialog and,
for an input written where a value belongs, its settings key
(`host-interface.md` section 8.1). It is written as a string literal on the line
that declares the input, and is not folded from an expression, because a label
and a key are both fixed before anything is computed. An input with no name and
no such title is OS3021, and one whose title is the empty string literal is
OS3024: both leave the row with nothing to be keyed by, and they carry two codes
because the second reader has written a title as a string literal and OS3021
would tell them to write one. A title spelling another input's name is OS3022,
because two rows on one key means one of them silently takes the other's stored
value; and two inputs carrying one title are OS3017, for the same reason.

**An input assigned to a name takes the name as its title where it gives none,
and an empty title is giving none.** The name is already the key, so a title
there is the label and nothing else, and the empty string is not a label: it
would draw a row with nothing written on it. `len = input(14, "")` and
`len = input(14)` are therefore the same row, labelled `len`, and neither is
refused. A title that has something in it is the label the reader wrote, a
single space included, because trimming one would be this document deciding what
somebody meant rather than reading it.

---

## 14. Collections

### 14.1 Arrays

An `array<T>` is ordered, mutable, resizable and homogeneous. Literals use square
brackets; an empty literal needs its type from context or from an annotation.

```
levels = [20.0, 50.0, 80.0]
names  = ["a", "b"]
var hits: array<number> = []
```

`T` is `number`, `string`, `bool`, `color`, or one of the runtime object types of
section 5.4. `array<box>` and `array<line>` are ordinary arrays and are how a
study keeps the drawings it will come back to. `T` is never a declaration handle
and never a `series`.

An empty literal takes its element type from an annotation when there is one, and
otherwise from the first call in the file, in source order, that puts an element
into it: `push`, `unshift`, `insert` or `set`. With neither, the element type is
unknown and the literal is OS2015. A name initialised to `none` takes its type
the same way, from the first assignment that gives it a definite one
(section 10.1).

An array value is a reference. Assigning one name to another gives two names for
one array; `copy(arr)` makes an independent one. This is stated because the
alternative, copying on assignment, would make passing a large array to a function
quietly expensive on every bar.

The core operations, all bare names:

| Call | Does |
|---|---|
| `size(arr)` | Element count |
| `arr[i]`, `element(arr, i)` | Read element `i` |
| `set(arr, i, v)` | Write element `i` |
| `push(arr, v)` | Append |
| `pop(arr)` | Remove and return the last element |
| `shift(arr)` | Remove and return the first element |
| `unshift(arr, v)` | Insert at the front |
| `insert(arr, i, v)` | Insert before index `i` |
| `remove(arr, i)` | Remove and return element `i` |
| `clear(arr)` | Remove everything |
| `slice(arr, from, to)` | A new array, `from` inclusive, `to` exclusive |
| `copy(arr)` | An independent copy |
| `indexOf(arr, v)` | First index of `v`, or `-1` |
| `arrayEqual(a, b)` | Whether two arrays hold equal elements in the same order, as against `==`, which is identity |
| `sort(arr, order)` | In place, `"asc"` or `"desc"` |
| `reverse(arr)` | In place |
| `sum(arr)`, `avg(arr)`, `min(arr)`, `max(arr)`, `stdev(arr)` | Statistics over the whole array |

An index outside `0` to `size - 1` is OS4004, naming the index and the size. It is
an error rather than absence because an array has a known extent the script chose,
so an out-of-range index is a mistake rather than a missing measurement, which is
the opposite of the `[]` case in section 7.4.

Arrays are limited to 1,000,000 elements by default; exceeding that is OS5002, and
`limits()` does not raise it in version 1.

```
var closes = []
push(closes, close)
if size(closes) > 100
    shift(closes)
plot(avg(closes), "Rolling mean", aqua)
```

An array held in a `var` is persistent, and the rollback rule of section 7.5
restores its contents as well as the reference, so a strategy that pushes to an
array on the moving bar does not accumulate duplicates as ticks arrive.

### 14.2 Maps and matrices: statement of intent

`map` and `matrix` are reserved words in version 1 and are not implemented.

The intent for a later version: `map<K, V>` with `string` and `number` keys, with
iteration order defined as insertion order so that a script using one stays
deterministic across engines, which is the property an unordered hash map would
cost. `matrix<T>` as a two-dimensional numeric container with the element access,
row and column operations and the small set of linear algebra that correlation and
regression studies need.

They are reserved now, and specified only this far, because reserving a word costs
nothing today and adding one later would break every script that used it as a
name. They will arrive with a language version bump, and section 4.1 says what that
does and does not permit.

---

## 15. The standard library surface

The complete per-function reference, with each function's exact warmup length and
absence behaviour, is generated from the library manifest and is not reproduced
here. What this section fixes is the shape of the library, which is part of the
language.

### 15.1 Built-in series

Available in every script, one value per bar:

```
open  high  low  close  volume
hl2   hlc3  ohlc4  hlcc4
time                    // bar open, UTC milliseconds
```

### 15.2 Bare names and namespaces

**Everyday functions are bare.** `ema(close, 9)`, not a prefix and a dot. The
functions a script reaches for on most days (the moving averages, the oscillators,
the band builders, the crossover tests, the maths, the array operations, the plot
family) live directly in the global scope.

**A namespace holds the long tail.** Rarely used or domain-specific facilities are
grouped behind a name, which keeps the bare global scope small enough to memorise
and keeps autocomplete useful.

The table below is the closed list of namespaces, and it is the only place that
list is written down. A name with a dot in it that is not one of these is not a
namespace in version 1.

| Namespace | Holds |
|---|---|
| `bar` | Per-bar facts, section 7.2 |
| `chart` | The instrument record (`host-interface.md` section 4.1), and `chart.now()` |
| `session` | Session start and end tests, the day's first and last bar |
| `date` | Calendar fields and construction from a timestamp |
| `str` | String operations beyond concatenation |
| `math` | Mathematics beyond the common functions, which are bare |
| `pos` | Open position facts in a strategy: size, average price, unrealised profit |
| `order` | Order facts and placement beyond the bare order functions |
| `leg` | The contract each leg trades, and each leg's own position and protective levels, in a strategy |
| `book` | Every declared leg taken together: the combined rules, the entry filters and the book's own profit, in a strategy |
| `draw` | Line, label, box and polyline objects a script creates and mutates |
| `req` | Higher timeframe and other-instrument reads |

`leg` and `book` exist only in a `strategy()` file, and calling one from a
`study()` file is OS7001.

```
if session.isFirstBar
    openPrice = open

if date.dayOfWeek(time) == 5 and bar.isConfirmed
    close()

hi = req.timeframe("1D", high)
```

### 15.3 Where a call may appear

These two lists are the whole of the rule, and they are the only place either
list is written down.

Top level only, because they declare the fixed shape of the file: `plot`,
`plotCandles`, `fill`, `level`, `table`, `leg.fixed` and `leg.relative` (OS3006),
and `input` (OS3007). The two leg declarations exist only in a `strategy()` file,
and the set of contracts a strategy trades is part of its fixed shape for the
same reason the set of columns is (`stdlib.md` section 17.6).

Anywhere, because they are per-bar events, per-bar paint or per-bar decisions:
`signal`, `alert`, `background`, `barColor`, `cell`, `clear`, `print`, the `draw`
namespace, every order function, and every protective level and strategy shape
call of `stdlib.md` section 17.

```
upper = plot(hi, "Upper", color = aqua, width = 2, style = "line")
lower = plot(lo, "Lower", color = aqua, width = 2)
fill(upper, lower, color = fade(aqua, 88))
level(0, "Zero", gray)

signal("BUY")                       // a named marker on this bar
background(risky ? fade(red, 92) : none)
barColor(trend > 0 ? lime : red)
```

**`fill` names two plots, not two expressions.** Its first two arguments are the
declaration handles of section 5.4, and a band is a field of the chart descriptor
holding two plot keys (`compiled-program.md` section 2.8), so there is no key for
a column that was never declared and nothing for a bare expression to compile
into. Plot the two edges, name them, and pass the names. `stdlib.md` section 14.2
carries the full signature, the colour arguments and the opacity.

`signal(text)` is the whole of shape plotting. One call, one named marker on the
bar, in place of a plot call with six positional arguments choosing a shape, a
location, a size and an offset. Where a script needs geometry rather than a marker,
it uses the `draw` namespace, which creates objects it can move and delete later.

---

## 16. Errors

Every diagnostic the compiler or an engine emits carries a stable code, a line, a
column, a message, and a fix. A diagnostic that cannot state a fix is a defect in
the diagnostic.

| Range | Kind | Example |
|---|---|---|
| OS1xxx | Syntax | OS1002, a tab in indentation |
| OS2xxx | Names and types | OS2002, a shadowed name |
| OS3xxx | Arguments | OS3002, an unknown named argument |
| OS4xxx | Runtime | OS4002, a history index past the retained depth |
| OS5xxx | Limits | OS5001, the loop budget |
| OS6xxx | Data | OS6001, an unknown timeframe |
| OS7xxx | Orders | OS7002, an absent order argument |
| OS8xxx | Warnings | OS8001, a stateful call inside a branch |

Codes OS1xxx to OS7xxx stop compilation or stop the bar. OS8xxx warnings never
stop anything; they are reported on the line and in the editor's gutter.

One more range, OS9xxx, is not about an OpenScript file at all. It is the
importer's, which reads a script written in another chart language and writes
it as OpenScript, and its findings point into the script it read. The language
defines nothing there; `errors.md` part 8.9 catalogues the codes.

`errors.md` is the catalogue and the authority. The build fails if the compiler can
emit a code with no catalogue entry, or if an entry has no test that produces it,
so the documentation cannot drift from the compiler.

---

## 17. Differences that will surprise you

If you have written scripts in another per-bar chart language, these are the places
OpenScript will not do what your fingers expect. Each one is a decision, with the
section that explains it.

1. **An absent value is not zero and does not become false.** `none + 1` is `none`
   and `none > 5` is `none`, not `false`. Both propagate all the way to the plot,
   where they draw a gap. If you want the old behaviour on a line, ask for it:
   `orElse(x, 0)`. (Section 6.)

2. **A comparison can be absent, so `a > b` being false does not mean `a <= b` is
   true.** During warmup both are absent and both branches are skipped. (Section
   6.4.)

3. **`==` against `none` works and is the normal way to test.** Equality is the one
   operator that never returns `none`. (Section 6.5.)

4. **`close[1]` on bar 0 is absent, not `close[0]`.** Nothing is clamped to the
   start of history. (Section 7.4.)

5. **A name first assigned inside a block does not escape the block, and a name
   from outside is updated rather than shadowed.** There is never a second variable
   with the same name. Trying to create one is an error, not a warning. (Section
   12.)

6. **A stateful call inside an `if` advances only on the bars where the branch is
   taken, and is absent on the others.** The state is not frozen and carried
   forward. You get a warning the first time you do it. (Section 11.4.)

7. **`var` rolls back on the moving bar.** Executing the newest bar ten times gives
   the same answer as executing it once, so a live chart and a backtest of the same
   data agree. Use `live var` when counting ticks is the actual intent. (Section
   7.5.)

8. **Signals, alerts and orders do not fire on an unconfirmed bar by default.** Set
   `onUnconfirmed = true` if you mean it, and note that the compiler then warns
   about every higher timeframe read in the file. (Section 7.5.)

9. **`plot` must be at the top level.** Hide a plot by plotting `none`, not by
   wrapping it in an `if`. The set of columns is fixed before bar 0 so the legend
   and the settings dialog can exist. (Section 7.1.)

10. **There is no truthiness and no implicit conversion.** `if 1` is an error,
    `"x" + 5` is an error. `text()` and `toNumber()` are short. (Section 5.3.)

11. **Comparisons cannot be chained** and there is no `^`, no `!`, no `&&`, no
    `||`, no `;` and no braces. The words are `and`, `or`, `not`, and the power
    function is `pow`. (Sections 3.12, 9.3.)

12. **Recursion is not allowed**, because function state is allocated per call
    site. Write a loop. (Section 11.4.)

13. **`for i = 9 to 0` runs zero times.** A descending loop says `step -1`.
    (Section 10.3.)

14. **Loops have a budget, and it is yours to raise.** 2,000,000 iterations per bar
    by default, changed in one line with `limits(loops = ...)`. There is no
    platform ceiling you cannot see. (Section 10.7.)

15. **`switch` is a statement, and arms do not leak names.** Declare the variable
    before the `switch`. (Section 10.6.)

16. **`[]` means history on a series and element access on an array**, decided at
    compile time from the type. `history(x, n)` and `element(a, i)` are the explicit
    forms. (Section 9.6.)

17. **Colours are bare names and functions are mostly bare names.** No prefix on
    `aqua`, none on `ema`. The namespaces exist for the long tail. (Sections 3.8,
    15.2.)

18. **One file is both a study and a strategy.** `strategy()` takes every
    `study()` option, so the plotted numbers and the traded numbers are the same
    numbers, computed once. (Section 13.1.)

19. **`fill` takes two plots, not two series.** Name the plots and pass the
    names. A plot handle is a compile-time value and goes nowhere else: not into
    a `var`, not into an array, not into a function. A line, a label, a box, a
    polyline and a table are the opposite, ordinary values that persist until
    the script deletes them. (Sections 5.4, 15.3.)

20. **A reserved word is legal as a named argument label.** `color = aqua` and
    `step = 0.02` are labels, not names, and a label is never looked up in a
    scope. It is still not legal as a variable or as a parameter of a user
    function. (Section 3.4.)

21. **`and` and `or` are three-valued and commutative.** `none` means unknown,
    and an operand is evaluated whenever it can still decide the answer, so
    `none or true` is `true` and `none and false` is `false`, while
    `none or false` and `none and true` are both `none`. Writing the two operands
    the other way round never changes an answer. (Section 6.6.)

---

## 18. Reserved for later versions

These are named so that nobody designs around their absence, and so that adding
them cannot break an existing script.

- `map` and `matrix` types, section 14.2.
- `import` of a user library file, and `as` for naming the import.
- `type` for user-declared record types, and the field access that goes with it.
- Function values and passing a function as an argument.
- An expression form of `switch`.
- A `series` keyword in a position other than a type annotation.

Every word above is already reserved in version 1 (section 3.4), which is the whole
reason the list exists.

---

## 19. Grammar summary

Informative. Where this summary and the prose disagree, the prose wins.

```
file            = [ version ] declaration [ limits ] { statement | function } ;

version         = "version" NUMBER NEWLINE ;
declaration     = ( "study" | "strategy" ) "(" [ arguments ] ")" NEWLINE ;
limits          = "limits" "(" arguments ")" NEWLINE ;

function        = "fn" IDENT "(" [ parameters ] ")" "=>"
                  ( expression NEWLINE | NEWLINE block ) ;
parameters      = parameter { "," parameter } ;
parameter       = IDENT [ ":" type ] [ "=" expression ] ;

block           = INDENT statement { statement } DEDENT ;

statement       = assignment
                | varDecl
                | ifStatement
                | forStatement
                | whileStatement
                | switchStatement
                | "break" NEWLINE
                | "continue" NEWLINE
                | "return" [ expression ] NEWLINE
                | expression NEWLINE ;

assignment      = IDENT assignOp expression NEWLINE ;
assignOp        = "=" | "+=" | "-=" | "*=" | "/=" | "%=" ;
varDecl         = [ "live" ] "var" IDENT [ ":" type ] "=" expression NEWLINE ;

ifStatement     = "if" expression NEWLINE block
                  { "else" "if" expression NEWLINE block }
                  [ "else" NEWLINE block ] ;

forStatement    = "for" IDENT "=" expression "to" expression
                    [ "step" expression ] NEWLINE block
                | "for" IDENT "in" expression NEWLINE block ;

whileStatement  = "while" expression NEWLINE block ;

switchStatement = "switch" [ expression ] NEWLINE
                  INDENT { caseArm } [ defaultArm ] DEDENT ;
caseArm         = "case" expression { "," expression } NEWLINE block ;
defaultArm      = "default" NEWLINE block ;

expression      = ternary ;
ternary         = orExpr [ "?" expression ":" ternary ] ;
orExpr          = andExpr { "or" andExpr } ;
andExpr         = equality { "and" equality } ;
equality        = comparison [ ( "==" | "!=" ) comparison ] ;
comparison      = additive [ ( "<" | "<=" | ">" | ">=" ) additive ] ;
additive        = multiplicative { ( "+" | "-" ) multiplicative } ;
multiplicative  = unary { ( "*" | "/" | "%" ) unary } ;
unary           = [ "-" | "+" | "not" ] postfix ;
postfix         = primary { "(" [ arguments ] ")" | "[" expression "]" | "." IDENT } ;
primary         = NUMBER | STRING | "true" | "false" | "none" | COLOR
                | IDENT | "(" expression ")" | arrayLiteral ;
arrayLiteral    = "[" [ expression { "," expression } ] "]" ;

arguments       = argument { "," argument } ;
argument        = [ label "=" ] expression ;
label           = IDENT | RESERVED ;

type            = [ "series" ] valueType
                | "array" "<" ( valueType | objectType ) ">"
                | objectType ;
valueType       = "number" | "string" | "bool" | "color" ;
objectType      = "line" | "label" | "box" | "polyline" | "table" ;
```

`equality` and `comparison` take at most one operator, which is how section 9.3's
ban on chaining is expressed in the grammar rather than in a later check.

`label` admits a reserved word because a named argument label is not a name,
section 3.4. `RESERVED` is any word in section 3.4's list.

`objectType` names the runtime object types of section 5.4. The type names
`line`, `label`, `box`, `polyline` and `table` are recognised in a type position
only, and are ordinary global function names everywhere else, exactly as `color`
is both a type name and the name of an argument label.

The declaration handle types `plot`, `fill` and `level` are deliberately absent
from `type`. A handle can never be annotated, because it can never be a `var`, a
parameter, a return value or an array element, so those three names exist in the
checker and in diagnostics and nowhere in the grammar.

A blank line and a comment-only line produce no token at all (section 3.10), so
no production above can match one and none needs to mention them.
