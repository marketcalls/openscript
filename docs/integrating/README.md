# Integrating OpenScript

For a platform that wants its traders writing scripts: a broker, an exchange, a
terminal, anything with a chart and a price feed.

By the end of this page you will know which of three routes fits you, what each
costs, and what you get that you would otherwise build yourself.

---

## The one thing to understand first

**OpenScript owns anything that produces a number. You own anything that produces
a pixel, a database row, or a process.**

Indicator values, order fills, position, profit and loss, stops and targets and
trailing, the equity curve, drawdown, win rate: all of that is language
semantics, and it is identical everywhere the language runs.

Bars, your symbology, your market's costs, your storage, your job scheduling,
your report page: all yours, and all of them should be, because a platform on
another continent has different answers to every one.

That line is what makes the next sentence true, and it is the only reason to
adopt a language rather than write one: **a script backtested in a trader's
browser produces the same trades as the same script backtested on your servers.**
A backend backtester whose numbers disagree with what the trader saw on their own
chart is worse than none, because now there are two answers and no way to tell
which is wrong.

## Three routes

Pick the row that matches your constraints. Each is usable on its own and nobody
has to climb to the next.

| Route | You write | Roughly |
|---|---|---|
| **Run the reference engine** on a server | The host adapter | Days |
| **Run the second engine**, for a platform whose servers are Python | The host adapter | Days |
| **Write your own engine** in your own language | The instruction set and the strategy runtime | Weeks |

The third row exists because a platform at scale will not run somebody else's
interpreter in its hot path, and should not have to. See
[your-own-engine.md](./your-own-engine.md).

## What you supply, either way

Six things, and you already have all of them:

1. Bars
2. What the instrument is
3. More bars on request
4. Somewhere to draw
5. Somewhere to send orders, if scripts may trade
6. Somewhere to save settings

The exact shape of each, what happens when you cannot answer, and what an engine
does with a refusal, are in [`spec/host-interface.md`](../../spec/host-interface.md).
That document is written to be implementable without reading any of our code, and
if you find a place where it is not, that is a defect worth reporting.

## What never crosses the boundary

**A symbol is opaque to the language.** The engine never parses one. A script
names a contract by what the contract is and you resolve it to whatever your
symbology calls it.

This is not politeness. A naming scheme built around one market's derivatives
means nothing on a crypto exchange, and portability is the entire objective. It
also means a relative contract, such as the at-the-money call of the nearest
expiry, resolves **once** at the start of a run and the resolved identity is what
every later action uses. Re-resolving at exit names a different contract than the
one entered, so you would close a position you do not hold and keep the one you
do.

## Where to go next

- [running-the-engine.md](./running-the-engine.md), for routes one and two
- [your-own-engine.md](./your-own-engine.md), for route three
- [running-a-strategy.md](./running-a-strategy.md), for driving the second
  engine from your own host, bar by bar
- [backtesting.md](./backtesting.md), for what a backtest engine gives you and
  what you fill in
- [the-editor-half.md](./the-editor-half.md), for putting a script editor in
  front of traders: what the language gives it and what stays yours
- [library-vectors.md](./library-vectors.md), for checking a library written in
  another language against this engine, bit for bit, before the suite
- [`spec/host-interface.md`](../../spec/host-interface.md), the contract
- [`spec/conformance.md`](../../spec/conformance.md), how you prove an
  implementation is correct

## An honest status note

The conformance suite is specified, and it now holds cases in the narrowest
profile as well as the widest. That matters more than the count: until it did,
an engine claiming `core` was handed no case at all, every case was skipped, and
the runner printed a pass. An engine that implemented nothing passed the bar
this project sets for engines, and the repository's own test asserted that
outcome. It now fails, because there are cases for it to be handed.

**What the suite reaches today.** The compiler's diagnostics from tokenising,
parsing and checking; the runtime errors; and behaviour at a declared limit.

**What it does not reach yet, and this is the larger half.** The per-bar values,
which are the categories `semantics` and `numerics` and the reason section 1
gives for the suite existing at all: every engine produces the same numbers.
No case asserts one, because this engine's own projection has no channel for
them: `caseFilesFrom` writes diagnostics, orders, trades and performance, and a
case asserting per-bar values is answered `unsupported` by the reference
implementation. Until that channel exists, two engines can agree on every case
in the tree and still disagree on what a moving average is.

The suite has also not yet run against an engine written by somebody who did not
write the specification. Until that happens, the claim that this format travels
is reasoned rather than demonstrated.

We will say so plainly here until it changes, because a standard that overstates
its maturity costs its first adopter more than one that admits where it is.
