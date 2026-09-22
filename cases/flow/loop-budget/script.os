version 1

study("The per-bar loop budget, at it and past it")

// Two loops of a million iterations each. The budget is summed over every loop
// a bar runs, so these two together are exactly the default budget and neither
// bar 0 nor bar 1 has any of it left over. The third loop runs on one bar only,
// and asks for one iteration more than the bar is allowed.
var counted = 0.0
for i = 1 to 1_000_000
    counted += 1
for i = 1 to 1_000_000
    counted += 1
if bar.index == 2
    for i = 1 to 1
        counted += 1

plot(counted, "Iterations this bar ran")
