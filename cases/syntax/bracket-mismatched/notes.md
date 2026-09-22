# syntax/bracket-mismatched

## What this case pins

A closer of the wrong kind is refused on its own account, at the closer. There is
a closing bracket on the line, so what is wrong is not that something was left
open.

## What a wrong engine does differently

An engine that raises the code for a bracket that is never closed points at the
opening bracket, and tells the reader to add a closer to a line that has one. The
character that has to change is then not the one under the caret, which is the
whole difference between the two codes.

An engine that accepts either closer for either opener treats the two shapes as
one delimiter. It compiles, and what it compiles no other engine will take.

An engine that reads the closer as the start of an index and carries on turns one
mistake in the shape of the line into a run of name and type errors further down,
none of which mentions a bracket.
