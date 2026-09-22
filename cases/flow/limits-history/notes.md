# flow/limits-history

A read of a bar older than the depth the script declared it keeps.

## What it pins

`language.md` 7.4: a history read past the retained depth is OS4002 and not
absence, because the value existed and the engine threw it away, which is a
different situation from a value that never existed. Both readings appear in
this one script. `close[3]` is read on every bar: on bars 0, 1 and 2 it reaches
past the oldest bar there is and is absent, and from bar 3 on it is a bar inside
the declared depth. `close[8]` is read on bar 8 alone, where it names a bar that
existed and that a depth of 4 does not keep.

The case does not pin where the edge of the depth falls. A depth stated in bars
and an index counted from this bar can be read as meeting at either 3 or 4, and
8 is past the depth and 3 is inside it under both readings, so what is asserted
is the code, the span and the bar, which every reading agrees on.

## What a wrong engine does differently

- Ignoring `limits(history = ...)` and keeping the whole dataset: `close[8]` on
  bar 8 answers bar 0's close and nothing is raised.
- Answering absence for a bar it dropped: nothing is raised either, and the two
  situations 7.4 separates are conflated in the direction it warns about.
- Raising OS4002 for a bar that never existed: `close[3]` on bar 0 stops the run
  and the diagnostic carries bar index 0.
