version 1

study("A named argument a call does not take", overlay = false)

plot(ema(close, 20, smooth = true), "EMA", aqua)
