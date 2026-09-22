# static/unknown-annotation-type

## What this case pins

The set of type words is closed, and a word outside it is refused where it is
written rather than carried along as a type to be worked out later. There is no
integer type in particular: a length, a bar count and a price are all the one
number type, so the short spelling a reader brings from another language has
nothing to resolve to.

## What a wrong engine does differently

An engine that accepts any word in an annotation and checks nothing against it
compiles this file, and the annotation then states a constraint the engine never
applies. That is worse than no annotation at all, because the next reader
believes it and writes code against it.

An engine that maps an unrecognised annotation onto the nearest type it does
have accepts the file and quietly narrows the parameter. The script then fails
at a call site whose author never wrote a type anywhere, over a rule no line of
their file states.
