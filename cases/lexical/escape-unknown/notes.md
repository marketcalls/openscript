# lexical/escape-unknown

## What this case pins

The two characters of the sequence are refused, and the diagnostic sits on the
backslash that opens it rather than on the letter after it or on the quote that
opened the literal.

## What a wrong engine does differently

An engine that drops the backslash and keeps the letter takes the permissive
reading several languages take. It compiles, it raises nothing, and the string it
holds is one character shorter than the text in the file. An engine that keeps
both characters as themselves also compiles and also raises nothing, and now two
engines hold different text for one literal, which is the disagreement the suite
exists to catch.

An engine that reports at the letter misses the character that has to be deleted
or doubled, which is the one part of the sequence the author has a choice about.
