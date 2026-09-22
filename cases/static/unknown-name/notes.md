# static/unknown-name

## What this case pins

The checker resolves a name against what is in scope at that point in the file,
not against the file as a whole. The file is the body of the per-bar loop and
runs top to bottom, so the read here has nothing to resolve to even though the
assignment sits below it, and the refusal is reported at the read.

## What a wrong engine does differently

An engine that gathers every top-level name in one pass and then resolves reads
against that set compiles this file without a word. It is an easy shape to
arrive at, because it is what a language with hoisting does and because it makes
a one-pass checker simpler. It silently changes the meaning of every script
whose author moved a line: the name resolves to a value this bar has not
computed yet.

An engine that reports the refusal at the assignment instead sends the reader to
the line that is correct. The asserted line and column are what separate the
two, and they are the reason a case here asserts a position and not only a code.
