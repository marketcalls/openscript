version 1

study("A loop whose end bound the feed left absent")

// The end bound is this bar's volume, and the feed states no volume on one bar.
// A loop that cannot say how many times it runs stops the bar rather than
// running zero times, which would leave a plot that looks computed.
total = 0.0
for i = 1 to volume
    total += close

plot(total, "This bar's close, added once per unit of volume")
