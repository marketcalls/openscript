"""Higher timeframe and other instrument reads, folded onto the chart's bars.

A read is an expression evaluated over a **different set of bars** than the
chart's, whose value is then folded back onto the chart's. Two halves, in two
modules: ``request_body.py`` runs the expression once per requested bar, and this
decides which requested bar each chart bar is allowed to see. The second half is
where the off-by-one lives, so it is one comparison written once rather than
three rules.

**Bars in, buckets out.** Source bars are grouped by the bucket key of their open
instant (``buckets.py``); a bucket becomes one requested bar. The source is the
chart's own bars for a read of the chart's instrument, which is the read
`host-interface.md` 5.1 says an engine satisfies from what it already holds, and
the host's answer for a read of another instrument, which it never can. One fold
serves both, so the two kinds of read cannot drift apart.

**The three modes differ in one thing: how far past the chart bar the fold may
look**, which is `compiled-program.md` 2.16.2's table. ``"confirmed"`` and
``"developing"`` consume source bars opening at or before the chart bar, and
take the last bucket that closed and the bucket this bar is inside so far;
``"lookahead"`` consumes every source bar of this bar's bucket, and takes that
bucket in full. A bucket closes when a bar of a later one is folded, never by
the clock, so a confirmed read steps on the first chart bar of the next bucket.

**A re-executed chart bar restores where each fold stood when the bar began**, and
rebuilds the bucket then forming from the source as it now stands, which is
what makes a moving bar idempotent one level down: the newest chart bar may
have been revised since the last execution, and its bucket is rebuilt from the
revision rather than from the reading it replaced. ``mark`` and ``restore`` are
that position, taken into ``run.py``'s checkpoint beside the cells. What the
position does not hold is the value of a bucket that has closed and the body's
own state: a closed bucket is closed by a bar before the newest one, which no
revision touches, and a second close of it is refused below rather than undone.
"""

from dataclasses import dataclass, field, replace
from typing import Any, Callable, Dict, List, Mapping, Optional, Sequence, Tuple

from .budget import EngineLimits
from .contracts import Bar, CallContext, Library
from .inputs import ResolvedInput
from .buckets import bucket_key
from .memory import Register
from .program import LoadedProgram
from .request_body import RequestBody, body_program, carry
from .request_plan import Answered, Plan, Provider, Refusal, ask_host, reason_for, undatable, undatable_reason
from .values import ABSENT, is_number, stored

#: Where one read's fold stands: how far into the source it has read, the key of
#: the bucket forming, and where in the source that bucket began.
Mark = Tuple[int, Optional[int], int]


@dataclass(frozen=True)
class RequestParts:
    """What every read of one machine is built from."""

    program: LoadedProgram
    #: Every read of the program, nested ones included, by its own id.
    plans: Mapping[int, Plan]
    provider: Optional[Provider]
    limits: EngineLimits
    library: Library
    inputs: Sequence[ResolvedInput]


@dataclass
class Read:
    """One read: its plan, the body, the source, and where the fold stands."""

    plan: Plan
    register: int
    body: RequestBody
    #: The host's bars for this read, or nothing when the fold is the chart's.
    source: Optional[Sequence[Bar]]
    ready: bool
    reason: str
    cursor: int = 0
    open_key: Optional[int] = None
    open_from: int = 0
    open: Optional[Bar] = None
    #: The value of the most recently closed bucket, which a confirmed read takes.
    closed_value: Any = ABSENT
    #: The highest bucket key ever closed, so a re-executed bar closes none twice.
    highest_closed: Optional[int] = field(default=None)


class RequestSet:
    """The reads one machine makes, in the order its ``requests`` table lists them."""

    def __init__(self, parts: RequestParts, requests: Sequence[Any]) -> None:
        self.reads: List[Read] = []
        self._by_id: Dict[int, Read] = {}
        for request in requests:
            plan = parts.plans.get(request["id"])
            if plan is None:
                continue
            read = _build(parts, request, plan)
            self.reads.append(read)
            self._by_id[request["id"]] = read

    @property
    def empty(self) -> bool:
        return not self.reads

    # -- the checkpoint --------------------------------------------------------

    def mark(self) -> Tuple[Mark, ...]:
        return tuple((one.cursor, one.open_key, one.open_from) for one in self.reads)

    def restore(self, mark: Sequence[Mark], bars: Sequence[Any]) -> None:
        """Each fold as it stood, and the bucket then forming rebuilt from its source."""
        for read, (cursor, open_key, open_from) in zip(self.reads, mark):
            read.cursor, read.open_key, read.open_from = cursor, open_key, open_from
            read.open = None
            if open_key is None:
                continue
            source = bars if read.source is None else read.source
            for at in range(open_from, cursor):
                bar = _at(source, at)
                if bar is None or _key(read, bar.time) != open_key:
                    continue
                read.open = _start(bar) if read.open is None else _extend(read.open, bar)

    # -- step 4 ----------------------------------------------------------------

    def fill(self, registers: List[Register], bars: Sequence[Any], index: int, context: CallContext) -> None:
        """Each read's value for the chart bar at ``index``, into its register."""
        for read in self.reads:
            registers[read.register].current = stored(carry(_value_of(read, bars, index, context)))

    # -- req.isReady and req.error ----------------------------------------------

    def answered(self, handle: Any) -> bool:
        """Whether the host has answered this read, which a read with a reason never is."""
        read = self._by_id.get(handle) if is_number(handle) else None
        return read is not None and read.ready

    def failure(self, handle: Any) -> str:
        """The reason this read will never answer, or the empty string when none has."""
        read = self._by_id.get(handle) if is_number(handle) else None
        return "" if read is None else read.reason


def _build(parts: RequestParts, request: Dict[str, Any], plan: Plan) -> Read:
    view = body_program(parts.program, request)
    answer = ask_host(plan, parts.provider)
    nested = RequestSet(replace(parts, program=view), request["body"]["requests"])
    # A setting a body reads is the enclosing program's, resolved once at load.
    settings = {one.key: one.value for one in parts.inputs if one.value is not None}
    inputs = [(one["series"], settings.get(one["input"], ABSENT)) for one in request["body"]["inputs"]]
    body = RequestBody(view, plan, parts.limits, parts.library, inputs, nested)
    # A reason is the read saying why it will never answer. The host's own words
    # win where both hold: a source that refused is the fix a user can act on first.
    if isinstance(answer, Refusal):
        why = reason_for(answer, plan.query)
    else:
        why = undatable_reason(plan.query) if undatable(plan) else ""
    # A fold of the chart's own bars needs nothing from the host, so it is
    # answered the moment it is planned; a read the host is still fetching is not.
    if answer is None:
        answered = plan.query.read == "timeframe" and plan.base is None
    else:
        answered = isinstance(answer, Answered)
    return Read(
        plan=plan,
        register=request["series"],
        body=body,
        source=list(answer.bars) if isinstance(answer, Answered) else None,
        ready=why == "" and answered,
        reason=why,
    )


def _at(source: Sequence[Any], index: int) -> Any:
    return source[index] if 0 <= index < len(source) else None


def _key(read: Read, instant: Any) -> Optional[int]:
    return bucket_key(instant, read.plan.timeframe, read.plan.zone, read.plan.session)


def _through_end(read: Read, bars: Sequence[Any], index: int, at: float, context: CallContext) -> Any:
    """A read with a base: the source bars that open before this chart bar ends.

    The end is the next chart bar's open, or one chart interval past this one's
    where that comes first or there is no next bar, so a source running ahead of
    the chart is never read past the bar the chart is on. A developing read takes
    the bucket the chart bar's last instant is in, absent where none of it has
    been folded.
    """
    span = read.plan.chart_span or 0.0
    after = _at(bars, index + 1)
    following = None if after is None else after.time
    end = at + span if following is None else min(following, at + span)
    source = read.source
    if source is None:
        return ABSENT
    while True:
        bar = _at(source, read.cursor)
        if bar is None:
            break
        if bar.time is not None and bar.time >= end:
            break
        read.cursor += 1
        found = None if bar.time is None else _key(read, bar.time)
        if found is not None:
            _feed(read, bar, found, context)
    if read.plan.request["mode"] == "confirmed":
        return read.closed_value
    last = _key(read, end - 1)
    if last is None or read.open_key != last or read.open is None:
        return ABSENT
    return read.body.peek(read.open, context)


def _value_of(read: Read, bars: Sequence[Any], index: int, context: CallContext) -> Any:
    """The read's value for one chart bar, and the fold that gets there."""
    if not read.ready:
        return ABSENT
    bar = _at(bars, index)
    at = None if bar is None else bar.time
    key = None if at is None else _key(read, at)
    if key is None:
        return ABSENT
    if read.plan.base is not None and read.plan.request["mode"] != "lookahead":
        return _through_end(read, bars, index, at, context)
    source = bars if read.source is None else read.source
    lookahead = read.plan.request["mode"] == "lookahead"
    while True:
        after = _at(source, read.cursor)
        if after is None:
            break
        found = _key(read, after.time)
        if found is None:
            # A source bar this calendar cannot date belongs to no bucket, and is
            # stepped over rather than folded into whichever one is open.
            read.cursor += 1
            continue
        # The one line the three modes differ in.
        if (found > key) if lookahead else (after.time > at):
            break
        read.cursor += 1
        _feed(read, after, found, context)
    if read.plan.request["mode"] == "confirmed":
        return read.closed_value
    if read.open_key != key or read.open is None:
        return ABSENT
    return read.body.peek(read.open, context)


def _feed(read: Read, bar: Bar, key: int, context: CallContext) -> None:
    """One source bar folded in: it extends the bucket forming, or closes it and begins the next."""
    if read.open_key == key and read.open is not None:
        read.open = _extend(read.open, bar)
        return
    if read.open_key is not None and read.open is not None:
        if read.highest_closed is None or read.open_key > read.highest_closed:
            read.closed_value = read.body.settle(read.open, context)
            read.highest_closed = read.open_key
    read.open_key = key
    read.open_from = read.cursor - 1
    read.open = _start(bar)


def _price(value: Any) -> Any:
    return float(value) if is_number(value) else ABSENT


def _start(bar: Bar) -> Bar:
    """The first source bar of a bucket, as a bar of its own, dated by its own open.

    The bucket's time is this bar's open instant rather than the boundary the
    key names: the two differ whenever trading begins after the boundary, and
    the first is a reading from the data while the second is a number the
    engine chose.
    """
    return Bar(
        time=bar.time,
        open=_price(bar.open),
        high=_price(bar.high),
        low=_price(bar.low),
        close=_price(bar.close),
        volume=_price(bar.volume),
        oi=_price(bar.oi),
    )


def _extend(into: Bar, bar: Bar) -> Bar:
    """One more source bar in the same bucket.

    **Absence propagates through every field** (`host-interface.md` 3.1): a
    bucket missing one bar's high has no high, rather than the highest of the
    bars that did report one. Open is the first bar's, close the last one's, and
    open interest is a level, so the coarser bar takes the last and not the sum.
    """
    return Bar(
        time=into.time,
        open=into.open,
        high=_either(into.high, bar.high, lambda a, b: b if b > a else a),
        low=_either(into.low, bar.low, lambda a, b: b if b < a else a),
        close=_price(bar.close),
        volume=_either(into.volume, bar.volume, lambda a, b: a + b),
        oi=_price(bar.oi),
    )


def _either(held: Any, more: Any, combine: Callable[[float, float], float]) -> Any:
    if held is ABSENT or not is_number(more):
        return ABSENT
    return combine(held, float(more))


#: ``req.isReady`` and ``req.error``, by name and argument count as the manifest
#: keys them. Each takes the reads of the machine the call is in and the
#: arguments; a machine with none has answered nothing and reported no reason.
CALLS: Dict[Tuple[str, int], Callable[[Any, Sequence[Any]], Any]] = {
    ("req.isReady", 1): lambda reads, arguments: False if reads is None else reads.answered(arguments[0]),
    ("req.error", 1): lambda reads, arguments: "" if reads is None else reads.failure(arguments[0]),
}
