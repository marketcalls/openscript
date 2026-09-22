# syntax/expression-expected

## What this case pins

The operand the operator was promised is missing, and the diagnostic sits in the
empty position where that operand should have been, one line past the last line
of the file. The position covers no characters, which is the point: a caret drawn
under a neighbouring token would accuse a token that is correct.

## What a wrong engine does differently

An engine that points at the operator names a character that is present and
spelled correctly, and a reader told the operator is wrong deletes it.

An engine that reads the operator as applying to whatever the next line holds
finds no next line here. On a file that has one, that same engine joins two
statements into one and compiles a program nobody wrote, and this case is where
that reading is caught before it gets the chance.

An engine that drops the trailing operator compiles the assignment without it and
raises nothing.
