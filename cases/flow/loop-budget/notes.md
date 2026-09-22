# flow/loop-budget

The default per-bar loop budget, at it and one iteration past it.

## What it pins

`language.md` 10.7 states four things about the budget and this case asserts all
four at once: the default is 2,000,000 iterations, it is summed over every loop
a bar executes rather than counted per loop, it is reset at the start of each
bar, and exceeding it raises OS5001 naming the loop that was running.

The two loops at the top run a million iterations each, so every bar spends the
whole budget and none of it is carried anywhere. Bar 2 runs a third loop of a
single iteration, and that iteration is the one past.

## What a wrong engine does differently

- A budget above 2,000,000, or no budget: nothing is raised on any bar, and the
  case fails on an empty diagnostics list.
- A budget counted per loop rather than per bar: neither million reaches the
  ceiling on its own and nothing is raised.
- A budget that is not reset at each bar: the second bar's first loop exhausts
  it and the diagnostic carries bar index 1.
- A budget that refuses at the ceiling rather than past it: the two loops alone
  exhaust it and the diagnostic carries bar index 0.
- A diagnostic that names the first loop instead of the loop that was running:
  the line is 10 rather than 15, which `conformance.md` 4 compares.

## Why the dataset runs one bar longer than it needs to

Bar 3 exists so that the case asserts one diagnostic rather than a number of
bars. What a run does with the bars after a bar it stopped is fixed nowhere, and
bar 3 raises nothing whichever way an engine reads that, because the third loop
is guarded by the bar index.
