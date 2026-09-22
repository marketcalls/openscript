version 1

study("Tab in indentation")

gapUp = close > open
if gapUp
	bodySpan = high - low
