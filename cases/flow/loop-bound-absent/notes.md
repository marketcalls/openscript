# flow/loop-bound-absent

A `for` loop whose end bound is absent on one bar.

## What it pins

`language.md` 10.3: an absent start, end or step is OS4013 and stops the bar,
rather than running the loop zero times. The bound here is the bar's own volume,
and `conformance.md` 3 allows a bars file to state none, which is what bar 2
does. Bars 0, 1 and 3 state one and run the loop.

The bar index is half the assertion. The bound is absent on one bar and stated
on the three around it, so an engine that decided this loop could not run before
reaching the bar that has no bound would carry a different index.

## What a wrong engine does differently

- Treating an absent bound as zero iterations, or as a loop that does not run:
  nothing is raised and the case fails on an empty diagnostics list. That is the
  reading 10.3 rejects by name, because a loop that quietly does nothing leaves
  a plot that looks computed.
- Reading an absent volume as zero: the same empty list.
- Refusing the program at load, before any bar: the diagnostic carries no bar
  index rather than bar 2.
