# syntax/chained-comparison

## What this case pins

The parser refuses the chain at the second comparison operator, which is the
operator that cannot be there.

The operands are chosen so that a left to right reading is well typed: both sides
of the second operator are then bool, so nothing later in the compiler raises
anything on its own account. An engine that accepts the chain therefore produces
a complete program and no diagnostic at all, which is what the case is written
against. A chain the author meant as a range then compiles into a question about
whether the outcome of one comparison equals a value, and nobody writes a chain
to mean that.

## What a wrong engine does differently

An engine that associates comparison the way arithmetic associates compiles the
file silently, as above.

An engine that reports at the first operator names the one that is correct, and
the reader deletes the wrong half of the line.
