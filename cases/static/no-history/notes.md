# static/no-history

## What this case pins

A past value is retained for four kinds of value, and a name first assigned
inside a block is none of them. The subscript is refused where it is written,
inside the branch.

## What a wrong engine does differently

An engine that retains a past value for every name it meets compiles this and
answers the subscript. It is right about this file and wrong about the next one:
what it holds then grows with the number of temporaries a script writes rather
than with the number of series it declares, which is the difference between an
engine that runs fifty thousand bars inside a page and one that does not.

An engine that retains nothing inside a block and answers the subscript with
absence rather than refusing it is the worse of the two. The script then carries
a value that is absent on the bars the branch skipped and present on the rest,
and absence is a legal value here, so nothing downstream can tell it from data.
