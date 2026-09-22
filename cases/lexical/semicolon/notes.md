# lexical/semicolon

## What this case pins

A semicolon carries a refusal of its own, reported at the semicolon. A statement
ends at the line break and the language has no separator at all, so the character
is not merely redundant punctuation.

## What a wrong engine does differently

An engine that accepts it as a separator compiles both assignments. That is what
an implementer carrying habits from another language writes first, and it makes
one file mean something in one engine and be refused by another.

An engine that raises the code for more than one statement on a line points at
the second statement instead. That code belongs to this line written with no
separator at all, and its fix is to split the line, where this one is fixed by
deleting a character: a reader handed the wrong one of the two rewrites a line
that needed a keystroke.

An engine that skips the semicolon as though it were whitespace compiles and
leaves its author believing the language has a separator, until the day they
write two statements on one line without one.
