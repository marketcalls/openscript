version 1

study("A word that is not a type", overlay = false)

fn band(src: series number, len: int = 20) =>
    sma(src, len)

plot(band(close), "Band", aqua)
