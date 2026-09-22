version 1

study("A string and a number added", overlay = false)

shown = "count: " + 5

if close > open
    signal(shown)
