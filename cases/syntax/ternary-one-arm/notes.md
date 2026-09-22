# syntax/ternary-one-arm

## What this case pins

The unfinished form is refused at the question mark, the token that promises two
arms, and not at the arm that is present or at the end of the line.

## What a wrong engine does differently

An engine that supplies the absent value for the missing arm compiles. The
program runs, it holds nothing on every bar the condition is false, and its
author goes looking for the fault in their data rather than in their file. This
is the expensive one, because absence is a value the language uses everywhere and
a column that is absent half the time looks like a warmup.

An engine that raises the code for a missing expression names a hole where an
expression was expected. What is wrong here is a form that was begun and not
finished, and the arm that is missing is the second one, which that code cannot
say.

An engine that reports at the arm it did find names the part of the line that is
correct.
