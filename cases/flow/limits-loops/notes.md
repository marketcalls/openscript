# flow/limits-loops

A per-bar loop budget the script lowered, at it and one iteration past it.

## What it pins

`language.md` 10.7: `limits(loops = ...)` replaces the default budget, and the
replacement is exact. The loop runs 1000 iterations on every bar but one, which
is the whole declared budget and raises nothing, and 1001 on bar 2, which is one
past it.

The loop is a `for` and not a `while`. A `for` runs exactly as many iterations
as the bound states, so the iteration count in 10.7 and the `TICK` count that
`compiled-program.md` 5.5 charges are the same number here, and the case pins
the budget rather than a reading of where a loop's tick falls.

## What a wrong engine does differently

- Ignoring `limits()` and running under the default 2,000,000: nothing is raised
  on any bar, and the case fails on an empty diagnostics list.
- Refusing at the declared budget rather than past it: every bar exceeds it and
  the diagnostic carries bar index 0.
- Taking the declared number as a ceiling on something other than iterations,
  a count of statements for instance: the bar it stops is not bar 2.
