# static/unknown-namespace-member

## What this case pins

A namespace holds a fixed set of members, published in the library manifest an
editor completes from, and a name outside that set is refused. The namespace
itself resolves, so the position the checker reports has to be past the dot.

## What a wrong engine does differently

An engine that looks a member up in a map and answers absence on a miss compiles
this file and draws a column that is absent on every bar. The author sees an
empty pane and goes looking at their data for a reason.

An engine that reports the failure at the namespace sends the reader to a name
that is spelled correctly. The asserted column is what separates that engine
from a correct one: it is the position of the member, not of the namespace and
not of the whole expression.
