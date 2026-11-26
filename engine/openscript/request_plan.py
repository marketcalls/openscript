"""What is settled about a read before bar 0, `compiled-program.md` 2.16.

**A request's identity is fixed before bar 0.** That is what lets the whole set be
known at load, what lets a host fetch in parallel and cache by instrument and
timeframe, and what makes a request that changed afterwards OS6013. So the three
identity fields are resolved here, once, from the value the script wrote, the
setting it named or the chart fact it named, and nothing below bar 0 asks again.

**Where the requested bars come from is settled here too** (``fold_plan``): the
chart's own bars, or bars at a finer base interval the host serves, for an
intraday request that is not a whole multiple of an intraday chart's interval,
finer than it included. The query carries that interval as ``interval``.

**Three refusals belong at load and the rest belong to the host.** A timeframe
the language does not know (OS6001), one finer than a chart of a day or longer
(OS6002), and a read that needs a host's bars on a run with no provider (OS6015
for a coarser one, OS6002 for a finer one) are facts about the program, the
chart and the host, all known before a bar runs, so they stop the load. An unknown
instrument (OS6007), a range with no bars (OS6008), a source that refused
(OS6009) and an interval the feed does not carry (OS6014) are the host's
answers: they leave the read absent, put the reason in ``req.error(read)`` and
let the study keep drawing everything else, which is `stdlib.md` 15.5.

**A provider is a function from a query to an answer**, `host-interface.md` 5.2
and 5.3: the bars at the requested timeframe, a refusal, a host still fetching,
or nothing at all. Nothing on a read of the chart's own instrument is the
ordinary case and the run folds its own bars; nothing on a read of another
instrument is OS6007, because the run holds none of that instrument's bars.
"""

from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Mapping, Optional, Sequence, Tuple, Union

from .buckets import Timeframe, fold_plan, is_intraday, minutes_of, multiple_above, nominal_minutes, parse_timeframe
from .contracts import Bar
from .diagnostics import Diagnostic, failure
from .inputs import ResolvedInput
from .reasons import reason


@dataclass(frozen=True)
class RequestQuery:
    """One read as a host is asked about it, `host-interface.md` 5.2, every field resolved."""

    id: int
    read: str
    #: The instrument asked for, or nothing where a setting behind a ``"symbol"``
    #: read held no identity: the chart's own is never substituted there.
    instrument: Optional[str]
    #: Where it trades: the one the script named, or the chart's.
    exchange: Optional[str]
    timeframe: str
    mode: str
    warmup: Optional[int]
    #: The interval of the bars an answer holds, `host-interface.md` 5.2: the
    #: timeframe itself, or the base a read is folded from when the requested
    #: interval does not fold into the chart's. A host may send any interval
    #: that divides it.
    interval: str = ""


@dataclass(frozen=True)
class Answered:
    """The host's own bars at the requested timeframe, oldest first."""

    bars: Sequence[Bar]


@dataclass(frozen=True)
class Pending:
    """A host still fetching: the read is absent and not ready, and says no reason."""


@dataclass(frozen=True)
class Refusal:
    """Why a host cannot answer, `host-interface.md` 5.4, with its own words."""

    code: str
    reason: Optional[str] = None
    #: The intervals it does serve, for OS6014.
    available: Optional[str] = None


Answer = Union[Answered, Pending, Refusal]

#: What a run asks for another instrument's or another interval's bars.
Provider = Callable[[RequestQuery], Optional[Answer]]


@dataclass(frozen=True)
class Plan:
    """A read once its identity, its timeframe and its zone are fixed."""

    request: Dict[str, Any]
    query: RequestQuery
    timeframe: Timeframe
    #: The zone a calendar bucket is dated in, or nothing when none was stated.
    zone: Any
    #: The session an intraday bucket is counted from, when the host stated one.
    session: Any = None
    #: The base interval the requested bars are folded from, or nothing.
    base: Optional[Timeframe] = None
    #: One chart bar's length in milliseconds, for a read with a base.
    chart_span: Optional[float] = None


def identity_of(field: Any, inputs: Sequence[ResolvedInput], instrument: Mapping[str, Any]) -> Optional[str]:
    """One of the three identity fields, resolved: a value, a setting, or a chart fact."""
    if isinstance(field, str):
        return field
    if not isinstance(field, dict):
        return None
    named = field.get("input")
    if isinstance(named, str):
        found = next((one for one in inputs if one.key == named), None)
        return found.value if found is not None and isinstance(found.value, str) else None
    if field.get("chart") in ("symbol", "exchange", "interval"):
        held = instrument.get(field["chart"])
        return held if isinstance(held, str) else None
    return None


def plan_requests(
    requests: Sequence[Any],
    inputs: Sequence[ResolvedInput],
    instrument: Mapping[str, Any],
    served: bool = False,
) -> Tuple[List[Plan], Optional[Diagnostic]]:
    """Every read the program makes, nested ones included, or the load refusal.

    A read written inside another is compared against the timeframe of the one
    it is written in, because those are the bars it folds.
    """
    chart = parse_timeframe(instrument.get("interval"))
    plans: List[Plan] = []
    return plans, _collect(requests, inputs, instrument, chart, plans, served, True)


def _collect(
    requests: Sequence[Any],
    inputs: Sequence[ResolvedInput],
    instrument: Mapping[str, Any],
    chart: Optional[Timeframe],
    into: List[Plan],
    served: bool,
    outermost: bool,
) -> Optional[Diagnostic]:
    for request in requests:
        written = identity_of(request["timeframe"], inputs, instrument)
        timeframe = None if written is None else parse_timeframe(written)
        if timeframe is None:
            return failure("OS6001", value="nothing" if written is None else written)
        # The chart's interval is a host fact and a host may state none; then
        # the chart's own bars are folded as they come.
        kind, base = fold_plan(timeframe, chart)
        if kind == "OS6002" and chart is not None:
            return failure("OS6002", chart=chart.text, requested=timeframe.text)
        # A base is bars a host serves: a run with no provider has none, and a
        # read written inside another folds that read's buckets. Both keep the
        # refusal a request that does not fold into its chart always had.
        if base is not None and chart is not None and (not served or not outermost):
            if nominal_minutes(timeframe) < nominal_minutes(chart):
                return failure("OS6002", chart=chart.text, requested=timeframe.text)
            return failure(
                "OS6015",
                requested=timeframe.text,
                chart=chart.text,
                suggestion=multiple_above(timeframe, chart),
            )
        chart_minutes = None if chart is None else minutes_of(chart)
        query = RequestQuery(
            id=request["id"],
            read=request["read"],
            instrument=_instrument_of(request, inputs, instrument),
            exchange=_exchange_of(request, inputs, instrument),
            timeframe=timeframe.text,
            mode=request["mode"],
            warmup=request["warmup"],
            interval=timeframe.text if base is None else base.text,
        )
        into.append(
            Plan(
                request,
                query,
                timeframe,
                instrument.get("timezone"),
                instrument.get("session"),
                base,
                None if base is None or chart_minutes is None else chart_minutes * 60000.0,
            )
        )
        nested = _collect(request["body"]["requests"], inputs, instrument, timeframe, into, served, False)
        if nested is not None:
            return nested
    return None


def _instrument_of(request: Any, inputs: Sequence[ResolvedInput], instrument: Mapping[str, Any]) -> Optional[str]:
    """The instrument a read asks about, with the format's default applied to a timeframe read only.

    A ``"symbol"`` read whose setting held no instrument stays without one:
    falling back there would turn a read of another instrument into a second
    read of this one, and nothing would say so.
    """
    named = identity_of(request["symbol"], inputs, instrument)
    if named is not None:
        return named
    held = instrument.get("symbol")
    return held if request["read"] == "timeframe" and isinstance(held, str) else None


def _exchange_of(request: Any, inputs: Sequence[ResolvedInput], instrument: Mapping[str, Any]) -> Optional[str]:
    """Where a read's instrument trades, with `stdlib.md` 15.1's default of the chart's."""
    named = identity_of(request["exchange"], inputs, instrument)
    if named is not None:
        return named
    held = instrument.get("exchange")
    return held if isinstance(held, str) else None


def ask_host(plan: Plan, provider: Optional[Provider]) -> Optional[Answer]:
    """What the host says about one read, or nothing where the run folds its own bars."""
    answer = None if provider is None else provider(plan.query)
    if answer is not None:
        return answer
    # A base has no chart bars to fall back on: nothing served is a feed that
    # does not carry that interval for this instrument.
    if plan.base is not None:
        return Refusal("OS6014")
    if plan.query.read == "timeframe":
        return None
    return Refusal("OS6007")


def undatable(plan: Plan) -> bool:
    """A day, week or month read with no zone to date a bucket in: absent on every bar.

    Nothing arriving later supplies a fact the instrument record does not hold,
    so the read is not waiting for anything, and it says why rather than
    leaving a blank pane nobody can explain.
    """
    return not is_intraday(plan.timeframe) and plan.zone is None


def _named(query: RequestQuery) -> str:
    """The instrument a reason names: the one the read asked for, or the chart's."""
    return "the chart's instrument" if query.instrument is None else query.instrument


def undatable_reason(query: RequestQuery) -> str:
    """OS6012's sentence for a read with no zone, which ``req.error`` reports."""
    return reason("OS6012", fact="a timezone", symbol=_named(query))


def reason_for(refusal: Refusal, query: RequestQuery) -> str:
    """The sentence a refusal reads as through ``req.error``, with the host's own words carried."""
    symbol = _named(query)
    if refusal.code == "OS6007":
        exchange = "the chart's exchange" if query.exchange is None else query.exchange
        return reason("OS6007", symbol=symbol, exchange=exchange)
    if refusal.code == "OS6008":
        return reason("OS6008", symbol=symbol, timeframe=_fetched(query))
    if refusal.code == "OS6014":
        available = "nothing it named" if refusal.available is None else refusal.available
        return reason("OS6014", timeframe=_fetched(query), symbol=symbol, available=available)
    if refusal.code == "OS6015":
        suggestion = "a whole multiple of it" if refusal.available is None else refusal.available
        return reason(
            "OS6015", requested=query.timeframe, chart="the chart's interval", suggestion=suggestion
        )
    said = "the host gave no reason" if refusal.reason is None else refusal.reason
    return reason("OS6009", symbol=symbol, timeframe=_fetched(query), reason=said)


def _fetched(query: RequestQuery) -> str:
    """The interval the host was asked for: the base where there is one."""
    return query.interval or query.timeframe
