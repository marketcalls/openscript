# static/not-a-function

## What this case pins

A built-in series is read bare. An argument list written after one is refused
for what it is, a call of something that is not callable, and the position
reported is the name rather than the argument list.

## What a wrong engine does differently

An engine that decides what a call site means from the parentheses alone has
nothing to refuse here. It looks for a function under that spelling, does not
find one, and reports a name that does not exist, so the reader is told that a
built-in they can see in the library manifest is missing and goes hunting for a
spelling instead of for the argument list they wrote by mistake.

The other way to get it wrong is to answer the call with the series and pass
over the arguments. That engine compiles a script that reads as a smoothed
volume and draws a raw one, which is a disagreement no diagnostic reports and
only a chart shows.

The catalogue records this code as having no test writing it, so until this case
nothing in the repository held any engine to it.
