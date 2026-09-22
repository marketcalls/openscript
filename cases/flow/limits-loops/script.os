version 1

study("A loop budget the script lowered")
limits(loops = 1000)

// The declared budget, not the default one. The loop runs exactly the budget on
// every bar but one, and one iteration more on that one.
total = 0.0
steps = bar.index == 2 ? 1001 : 1000
for i = 1 to steps
    total += close

plot(total, "This bar's close, added once per iteration")
