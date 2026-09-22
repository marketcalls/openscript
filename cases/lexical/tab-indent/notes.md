# lexical/tab-indent

## What this case pins

The tokeniser refuses the tab, and the diagnostic sits on the tab itself, at the
first column of the line it indents, rather than on the statement the tab pushed
to the right. Nothing else in the file is wrong, so a second diagnostic out of it
is as much a failure as a missing one.

## What a wrong engine does differently

An engine that expands a tab to some column width accepts the file. It compiles
a program, it raises nothing, and the depth of the body depends on a width its
author chose, which is the editor setting the rule exists to keep out of the
language.

An engine that raises the code but points at the first token of the line draws
the caret under a name that is spelled correctly, and the reader deletes
whitespace by guess.

The near miss is the code for a block whose lines disagree about their
indentation. That is a different mistake with a different fix: here the block has
one body line, so nothing disagrees with anything, and the only thing wrong with
the whitespace is what it is made of.
