# lexical/string-unterminated

## What this case pins

The refusal is reported at the opening quote, the character a reader has to go
back to, and not at the place the tokeniser was standing when it noticed.

## What a wrong engine does differently

An engine that runs the literal past the end of the line closes it at the next
quote in the file, or at the end of the file. Here there is neither, so it
reports at the last line; on a longer script it swallows whole statements and
then complains about something unrelated a long way down.

An engine that reports at the end of the line names the position where the
delimiter is missing. That is where the failure was detected and it is not where
the fix goes, and on a wrapped line it is off the side of the editor.

An engine that closes the literal at the line break raises nothing and compiles a
program holding a string its author never finished writing.
