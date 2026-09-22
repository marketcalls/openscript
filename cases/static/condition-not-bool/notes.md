# static/condition-not-bool

## What this case pins

A condition is a bool or absent and nothing else, and the refusal lands on the
condition expression rather than on the keyword in front of it.

## What a wrong engine does differently

An engine written in a language with truthiness gets this wrong for free: the
zero takes the false branch, the file compiles, and the script behaves the way
its author hoped on every bar where the count is zero. The failure arrives on
the first bar where a count that was meant to be compared against a threshold is
merely not zero, and by then there are backtests behind it.

An engine that reports the refusal at the keyword tells the reader the branch is
at fault when the expression inside it is, which is why the asserted column is
at the condition and not at the start of the line.
