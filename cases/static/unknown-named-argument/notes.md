# static/unknown-named-argument

## What this case pins

A call takes the arguments its signature names and no others, and a named
argument outside that set is refused at the argument's own name.

## What a wrong engine does differently

An engine that collects named arguments into a bag and reads out of it only the
ones it recognises accepts this file and drops the rest. The author asked for
something and got silence: the call runs on its defaults, the output is
plausible, and nothing anywhere says the option was ignored. Every system that
carries options as a bag has this failure, and a misspelled option name is how a
reader meets it.

An engine that instead refuses the call for the number of arguments it was given
points the reader at the count when the word is what is wrong, which is a
different entry of the catalogue and a different fix.
