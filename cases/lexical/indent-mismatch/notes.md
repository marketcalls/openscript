# lexical/indent-mismatch

## What this case pins

The first line of a block fixes the leading whitespace every line of that block
carries, and the line carrying one space more is refused at its own first
column. The header and the first body line are both accepted, so the diagnostic
is about the third of the three lines and not about the construct.

## What a wrong engine does differently

An engine that treats any deeper indentation as still inside the block compiles
a ragged body. That is the reading which makes indentation advisory rather than
structural, and it is the one an implementer reaches for when the second line is
only a space out.

An engine that opens a nested block on the extra space compiles as well, and the
program it compiles is a different one: the second assignment is then conditional
on something the author never wrote.

An engine that reports against the header or against the line that set the
indentation sends the reader to a line that is correct, to work out for
themselves which line was actually refused.
