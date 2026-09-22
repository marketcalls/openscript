# static/type-mismatch

## What this case pins

Nothing converts implicitly, anywhere in the language. A number on the right of
a string addition is refused before any bar runs rather than rendered as text.

## What a wrong engine does differently

An engine whose host language already concatenates a string with a number
inherits that behaviour for free, produces a string, and compiles the file. It
is the cheapest wrong answer available to a second implementation, because it
costs no code at all to arrive at. What follows it is the rest of the coercion
rules: a zero that is also a false, an empty string that is also a false, and a
script that treats a count as a flag and runs to the end of a backtest without
complaining.

This is a compiler case and not a runtime one on purpose. An engine that accepts
the file and only fails on a bar has already let the program onto a chart, and
its failure then carries a bar index, which sends the reader to look at their
data rather than at the line they wrote.
