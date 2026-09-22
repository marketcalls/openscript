version 1

study("A read older than the retained depth")
limits(history = 4)

// One read inside the declared depth on every bar, and on one bar a read of a
// bar that existed and was thrown away. The second is an error and not absence,
// because absence would say the value never existed.
recent = close[3]
older = bar.index == 8 ? close[8] : close[0]

plot(recent + older, "A kept close and an older one")
