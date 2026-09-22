# static/shadowed-name

## What this case pins

There is no shadowing. An assignment to a name that already exists in an
enclosing scope updates that name, so a function body cannot introduce a second
one under the same spelling, and the checker refuses the inner declaration
rather than picking a meaning for it. The built-in names live in the global
scope too, so the same refusal covers a script that assigns to one of them.

## What a wrong engine does differently

Most languages a reader has written in before make the inner name a fresh
binding, and an engine that inherits that from its host language compiles this
file and runs it. Nothing looks wrong afterwards: the column is drawn, the
numbers are plausible, and they are the numbers of a different script.

The opposite mistake is an engine that reads the inner line as an assignment to
the outer name. It compiles as well, and the outer name then changes under every
call, on the bars where the call happens and not on the rest.
