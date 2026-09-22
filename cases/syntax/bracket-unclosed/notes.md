# syntax/bracket-unclosed

## What this case pins

The diagnostic names the bracket that was left open, which here is the outer
call's. The inner call opens and closes a bracket of its own on the same line, so
the file can tell an engine that names the unclosed bracket from one that names
the last bracket it happened to see. A file with a single bracket in it could
not.

## What a wrong engine does differently

An engine that reports at the end of the file may even carry the right code, and
the position tells a reader nothing: every unclosed bracket in a long file is
then reported in the same place, and the reader searches the file by hand.

An engine that names the inner bracket advises closing something that is already
closed.

An engine that closes the bracket at the end of the line compiles the call with
the arguments it found. It raises nothing, it runs, and it disagrees with every
engine that refuses the file.
