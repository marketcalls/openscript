version 1

study("A subscript on a value with no history", overlay = true)

trending = close > open

if trending
    body = close - open
    signal(text(body[1]))
