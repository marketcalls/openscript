version 1

study("A name declared twice", overlay = false)

len = 20

fn smooth(src) =>
    len = 9
    sma(src, len)

plot(smooth(close), "Smoothed", aqua)
