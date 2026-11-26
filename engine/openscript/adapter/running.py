"""One case, run on this engine, and the channels that come out of it.

This is the half of the adapter that is about the engine rather than about the
command line. It takes a case directory already read and the compiled program
the invocation was handed, loads the program, executes every bar of ``bars.csv``
and projects what it computed into the channels the case asserts, in the
encoding ``conformance.md`` section 4 gives each of them. It compares nothing.

**What this engine cannot do is named rather than guessed at, and the engine is
what names it.** ``compiled-program.md`` section 9.4 has a load refuse a program
whose capability tag the engine does not serve (OS6006), whose library entry its
manifest does not hold (OS6004), and whose format or language version it does not
implement (OS6016, OS6017). Each of those refusals carries the thing it refused,
by name, so the ``unsupported`` outcome section 9 asks for is read out of the
engine's own answer instead of being decided by a list kept here. A list kept
here would say what somebody believed this engine cannot do; the refusal says
what it actually refused.

**Every other refusal is a diagnostic and not an absence of support.** A
malformed program, a stored setting the engine will not run with, a budget
overrun, a division the script wrote: those are things this engine did, they
carry a code and a position, and they go into the ``diagnostics`` channel where a
case can assert them.

**The bars are confirmed and are not live.** A case is a run over a dataset, so
every execution is a new, confirmed, non-realtime bar with one update, and the
count supplied is the whole file: that is what makes ``bar.isLast`` true on the
last row and false everywhere else. The whole file is also handed to the fold
before bar 0, as a history is, which a ``"lookahead"`` read is the one reading
to notice; a read of another instrument is answered from the case's own file
(``secondary.py``). An engine that only backtests is handed
``isRealtime`` false throughout, which is why no alert is raised here, and
``run.py`` reaches the same answer from the other side.

**A strategy case is the same loop with a desk beside it.** The frames are the
case's, delivered after the bar ``frames.csv`` names and folded before the next
execution; the orders are the calls step 9 applied, in the order the bar made
them; and the trades and the summary are folded after the last bar from the
fills, under the three facts ``backtest.json`` states. Nothing in that sentence
is this module's decision: ``ordering`` holds the boundary, ``reporting`` holds
what the report was folded under, and ``accounting`` holds the arithmetic. What
is here is the order the three are asked in.
"""

from typing import Any, Dict, List, Optional, Sequence, Tuple

from ..accounting import report_of
from ..buckets import is_intraday
from ..contracts import BarState
from ..dates import BAR_TIME, NAMES as DATE_NAMES
from ..inputs import utc_time
from ..logbook import Logbook
from ..run import load_text
from ..strategy import IntentBar
from ..values import ABSENT
from ..verify import capabilities
from .channels import orders_channel, performance_channel, trade_row
from .ordering import ORDER_ENTRIES, Desk, options_for, unfoldable
from .reading import Case
from .reporting import contract_for, marks_for, schedule_for, settings_problem
from .secondary import engine_bar, provider_for
from .serving import Serving, is_reference
from .sessions import (
    READABLE_ZONE,
    SESSION_FACTS,
    SESSION_FIRST,
    SESSION_LAST,
    first_bars,
    last_bars,
    session_from,
)
from .spellings import Malformed, as_reported
from .surface import DRAWINGS, SURFACE_TAGS, TABLE, drawings_channel, table_channel

#: The codes a load raises when the program needs something this engine does not
#: have, each with the field naming what it was.
_UNSUPPORTED_CODES = {
    "OS6006": ("tag", "the capability {value}"),
    "OS6004": ("name", "the library function {value}"),
    "OS6016": ("found", "the compiled format {value}"),
    "OS6017": ("found", "language version {value}"),
}

#: Section 4: the channels this engine answers today. Everything else a case may
#: assert is named ``unsupported`` on the case rather than answered emptily,
#: because an empty channel compares equal to an empty expectation and would be a
#: pass nobody earned.
ANSWERED = ("diagnostics", "values", "orders", "trades", "performance", "log", DRAWINGS, TABLE)

#: ``compiled-program.md`` 2.2's tag for a program that places orders, and the
#: word the meta uses for a program that is one. This engine serves the tag
#: because it has a ledger: what it cannot serve is refused by name at load.
ORDERS = "orders"
STRATEGY = "strategy"

#: What this engine reads out of the declaration: the five the ledger sizes an
#: order from, and the three the money charges a fill under, plus the capital
#: every figure in the report is a fraction of.
DECLARED: Tuple[str, ...] = (
    "qty",
    "qtyType",
    "product",
    "pyramiding",
    "capital",
    "commission",
    "commissionType",
    "slippage",
)


class Answer:
    """What one case run produced: channels, and what could not be answered.

    ``column_types`` is the declared type of the channel behind each column of
    ``expected.csv`` that this program resolved, which is what lets a cell of
    that file be read as the value it is rather than as the shape of its text.
    """

    def __init__(self) -> None:
        self.channels: Dict[str, Any] = {}
        self.unsupported: List[str] = []
        self.column_types: Dict[str, str] = {}

    def cannot(self, feature: str) -> None:
        if feature not in self.unsupported:
            self.unsupported.append(feature)


def _diagnostic_row(code: str, line: int, column: int, bar: Optional[int]) -> Dict[str, Any]:
    """A diagnostic in the columns section 4 compares one on, and the bar it was on."""
    return {"code": code, "line": line, "column": column, "severity": "error", "barIndex": bar}


def _refusal_row(refused: Any) -> Dict[str, Any]:
    """A setting refusal, as a run refused before its first bar records it.

    A setting the run cannot be carried out under is refused while nothing has
    been computed, so it carries no position in the source: the defect is in what
    the host stated rather than in a line of the script. The message's own values
    are not in the row, because section 4 compares a diagnostic on its code, its
    line, its column and its severity and deliberately not on its wording.
    """
    return _diagnostic_row(refused.code, refused.line, refused.column, None)


def _unsupported_from(diagnostic: Any) -> Optional[str]:
    """The feature a load refusal names, or nothing when it is a real diagnostic."""
    held = _UNSUPPORTED_CODES.get(diagnostic.code)
    if held is None:
        return None
    field, sentence = held
    value = diagnostic.values.get(field)
    return sentence.format(value=value)


def _plot_channels(program: Dict[str, Any]) -> Dict[str, int]:
    """Every plot's legend title and its stable key, against its channel.

    ``compiled-program.md`` section 11 maps ``outputs.plots[]`` and their
    channels to one column per plot, which is what a column of ``expected.csv``
    is. The title is what a legend shows and what an expected file names; the key
    is accepted beside it because it is the plot's stable identity and a case may
    reasonably have been written against either.
    """
    found: Dict[str, int] = {}
    for plot in program["outputs"]["plots"]:
        for name in (plot["title"], plot["key"]):
            if isinstance(name, str) and name not in found:
                found[name] = plot["channel"]
    return found


def _values_channel(
    columns: Sequence[str], program: Dict[str, Any], rows: Sequence[List[Any]], answer: Answer
) -> List[Dict[str, Any]]:
    """One object per bar, holding the asserted columns and nothing else.

    A column names a plot, and a plot names a channel. A column this program has
    no plot for is not answered as absence, because absence is a value a case can
    assert and a column nobody can resolve is a case this engine cannot run.
    """
    channels = _plot_channels(program)
    resolved: List[Tuple[str, int]] = []
    for name in columns:
        if name not in channels:
            answer.cannot(
                f"the column {name}: this program declares no plot with that title or key, so "
                "there is no channel for it to be read from"
            )
            continue
        resolved.append((name, channels[name]))
        answer.column_types[name] = program["channels"][channels[name]]["type"]
    out: List[Dict[str, Any]] = []
    for row in rows:
        held: Dict[str, Any] = {}
        for name, channel in resolved:
            value = row[channel] if channel < len(row) else ABSENT
            held[name] = None if is_reference(value) else as_reported(value)
        out.append(held)
    return out


def _unreadable_zone(run: Any, instrument: Dict[str, Any]) -> Optional[str]:
    """What this program reads in a calendar this engine cannot read, or nothing.

    ``stdlib.md`` section 12.1 reads a calendar field in the chart's timezone,
    which the host states; this engine carries a reader for one zone and a host
    with any other supplies its own. A case in another zone whose script takes a
    written time, asks where a session begins or folds a read by the calendar
    (``buckets.py``) is therefore a case this engine would answer under the wrong
    calendar, and it says so instead.
    """
    if instrument.get("timezone") == READABLE_ZONE:
        return None
    program = run.program.raw
    # A day, week or month read is dated in the zone as well. With no zone at
    # all it is the read neither engine can date, which both answer alike.
    zoned = instrument.get("timezone") is not None
    if zoned and any(not is_intraday(one.timeframe) for one in run.plans):
        return "a day, week or month read"
    # An intraday read is counted from the trading day's open, which is a wall
    # clock reading in the zone as well (`compiled-program.md` 2.16.2).
    if zoned and run.plans:
        return "an intraday read counted from the trading day's open"
    if any(one["kind"] == "time" for one in program["inputs"]):
        return "a time input"
    if any(one["name"] in SESSION_FACTS for one in program["lib"]["functions"]):
        return "a session boundary"
    if any(one["name"] in DATE_NAMES for one in program["lib"]["functions"]):
        return "a calendar call"
    return None


def run_case(case: Case, program_text: str) -> Answer:
    """Load the program, run every bar, and project the asserted channels."""
    answer = Answer()
    unanswered = [channel for channel in case.asserts if channel not in ANSWERED]
    if unanswered:
        answer.cannot(
            f"the {', '.join(unanswered)} channel{'' if len(unanswered) == 1 else 's'} "
            "of section 2: this engine answers "
            f"{' and '.join(ANSWERED)}, and every other channel belongs to a stage that is not "
            "wired into it yet"
        )
    if case.ticks:
        answer.cannot(
            "ticks.csv (section 3): the machine re-executes a bar and rolls its state back, and "
            "how a tick row becomes the newest bar's four prices is not written down anywhere, so "
            "a replay here would be this adapter's invention"
        )
    if case.frames is not None and case.bars is not None:
        beyond = unfoldable(case.frames, len(case.bars))
        if beyond:
            answer.cannot(
                f"frames.csv: {len(beyond)} frame{'' if len(beyond) == 1 else 's'} delivered after "
                f"bar {beyond[0].after_bar} of {len(case.bars)} (section 3): a frame is delivered "
                "after a bar and folded before the next execution, and the last bar has none, so "
                "what becomes of it is not written down anywhere"
            )
    if "expectedExitCode" in case.declared:
        answer.cannot(
            "case.json's expectedExitCode: section 2 names the field and fixes no shape for it, so "
            "a reading here would be one no other engine has to share"
        )

    if answer.unsupported:
        return answer

    desk = Desk(case.frames or ())
    serving = Serving(desk)
    loaded = load_text(
        program_text,
        dict(case.settings),
        serving,
        capabilities=capabilities(ORDERS, *SURFACE_TAGS),
        read_time=utc_time,
        instrument=case.instrument,
        provider=provider_for(case),
    )
    if loaded.diagnostic is not None:
        feature = _unsupported_from(loaded.diagnostic)
        if feature is not None:
            answer.cannot(feature)
            return answer
        found = loaded.diagnostic
        answer.channels = _with_empty(
            case, {"diagnostics": [_diagnostic_row(found.code, found.line, found.column, None)]}
        )
        return answer

    run = loaded.run
    raw = run.program.raw
    unreadable = _unreadable_zone(run, case.instrument)
    if unreadable is not None:
        answer.cannot(
            f"{unreadable} under the timezone {case.instrument.get('timezone')}: this engine reads "
            f"a calendar as {READABLE_ZONE} and a host with another zone supplies its own reader"
        )
    if answer.unsupported:
        return answer

    if case.bars is None:
        needed = [one for one in case.asserts if one != "diagnostics"]
        if needed:
            raise Malformed(
                f"the case asserts {', '.join(needed)} and holds no bars.csv, which section 2 "
                "requires of an engine case"
            )
        answer.channels = {"diagnostics": []}
        return answer

    trading = raw["meta"]["kind"] == STRATEGY
    if not trading and any((one["name"], one["arity"]) in ORDER_ENTRIES for one in raw["lib"]["functions"]):
        # The ledger is sized by the declaration a strategy carries and a study
        # has none, so an order sent from one would be an order sized by this
        # adapter's defaults. The compiler does not emit such a program; a file
        # that arrives as one is refused rather than run under numbers nobody
        # wrote.
        raise Malformed(
            "the program declares itself a study and calls an order function, which is a program "
            "with orders to place and no declaration to size them from"
        )
    declared = _declaration(run) if trading else {}
    schedule = None
    if trading:
        # Every one of the three arrives before a bar runs, and each from the file
        # section 3 puts it in: a run under a digit count nobody stated is a run
        # that agrees with the engine next door by coincidence.
        desk.begin(options_for(declared, case.instrument))
        contract = contract_for(case)
        schedule = schedule_for(case, declared)
        refused = settings_problem(schedule, declared, contract)
        if refused is not None:
            answer.channels = _with_empty(case, {"diagnostics": [_refusal_row(refused)]})
            return answer

    logbook = Logbook()
    rows, diagnostics = _every_bar(run, serving, desk, case, logbook)
    answered: Dict[str, Any] = {"diagnostics": diagnostics}
    if "values" in case.asserts:
        if not case.expected_columns:
            raise Malformed(
                "the case asserts values and holds no expected.csv, which section 4 says is where "
                "one column per asserted channel and one row per bar are written"
            )
        answered["values"] = _values_channel(case.expected_columns, raw, rows, answer)
    if "orders" in case.asserts:
        answered["orders"] = orders_channel(desk.rows(), desk.intents)
    if "log" in case.asserts:
        # conformance.md section 4: the bar, its time, and the value spelled as a
        # cell of the values channel is, absence included.
        answered["log"] = [dict(one, value=as_reported(one["value"])) for one in logbook.rows()]
    if DRAWINGS in case.asserts:
        answered[DRAWINGS] = drawings_channel(run.objects)
    if TABLE in case.asserts:
        answered[TABLE] = table_channel(run.objects)
    if "trades" in case.asserts or "performance" in case.asserts:
        report = report_of(
            desk.fills.settled(),
            marks_for(case, case.bars),
            schedule,
            contract_for(case),
            declared.get("capital", 0.0),
        )
        answered["trades"] = [trade_row(one) for one in report.trades]
        answered["performance"] = performance_channel(report.summary)
    answer.channels = _empty_but(case, answered)
    return answer


def _empty_but(case: Case, answered: Dict[str, Any]) -> Dict[str, Any]:
    """The asserted channels this engine answers, and nothing it does not."""
    return {channel: answered[channel] for channel in case.asserts if channel in answered}


def _with_empty(case: Case, answered: Dict[str, Any]) -> Dict[str, Any]:
    """The asserted channels a run that did not happen has nothing for, as empty lists.

    A refusal before the first bar leaves every channel with nothing in it, and
    nothing is an empty list rather than a channel left out: a case comparing an
    absent channel and one comparing an empty one are different reports, and the
    second is the one that says how far the run got.
    """
    return {channel: answered.get(channel, []) for channel in case.asserts}


def _declaration(run: Any) -> Dict[str, Any]:
    """The strategy declaration, with every input reference behind it resolved.

    Read field by field through the run's own reader rather than off the program,
    because ``language.md`` 13 lets a declaration state a quantity, a commission
    or a capital from an input, and a ledger handed the reference rather than the
    value would size every order from a shape.

    The eight names below are what this engine reads out of the declaration, and
    a program of kind strategy that states none of them is refused here rather
    than part way through a bar: a ledger sizing an order from a field that was
    not there would be an order nobody wrote.
    """
    block = run.program.raw["meta"].get(STRATEGY)
    if not isinstance(block, dict):
        raise Malformed(
            "the program declares itself a strategy and its meta holds no strategy declaration, "
            "which compiled-program.md 2.3 says every one of them carries"
        )
    missing = [name for name in DECLARED if name not in block]
    if missing:
        raise Malformed(
            f"the strategy declaration states no {', '.join(missing)}, which this engine reads to "
            "size an order and to charge a fill"
        )
    return {name: run.declaration(("meta", STRATEGY, name)) for name in block}


def _every_bar(
    run: Any, serving: Serving, desk: Desk, case: Case, logbook: Logbook
) -> Tuple[List[List[Any]], List[Dict[str, Any]]]:
    """Every bar of the file, in order, stopping at the first that fails.

    A study stops at the bar that failed and reports the diagnostic: the columns
    of the bars before it stand, and there are no columns after it. That is the
    engine's own behaviour and not a decision here, and it is what makes a length
    difference in the values channel the first thing a reader of a failed case
    sees.

    **The fold is before the execution and the orders are after it**, which is
    ``host-interface.md`` 7.4: a driver that folded after the bar would let a
    script react within the bar its own order was sent in, and one that folded
    during it would give two executions of a moving bar two different positions
    to read. An order call refused stops the run the same way a failed bar does,
    and takes back every row that bar had appended.
    """
    bars = case.bars or []
    supplied = len(bars)
    when = case.declared.get("now", ABSENT)
    times = [bar.time for bar in bars]
    session = session_from(case.instrument)
    opens = first_bars(times, session)
    closes = last_bars(times, session, case.instrument.get("interval"))
    rows: List[List[Any]] = []
    run.history([engine_bar(one) for one in bars])
    for index, bar in enumerate(bars):
        desk.fold(index, float(bar.time))
        previous = bars[index - 1].close if index > 0 else ABSENT
        serving.at_bar(
            {
                "high": bar.high,
                "low": bar.low,
                "close": bar.close,
                "previousClose": previous,
                "volume": bar.volume,
                SESSION_FIRST: opens[index],
                SESSION_LAST: closes[index],
                BAR_TIME: bar.time,
            },
            index == 0,
        )
        result = run.execute_bar(
            index,
            engine_bar(bar),
            BarState(is_new=True, is_confirmed=True, is_realtime=False, updates=1.0),
            supplied=supplied,
            instrument=case.instrument,
            now=when,
        )
        if result.diagnostic is not None:
            found = result.diagnostic
            return rows, [_diagnostic_row(found.code, found.line, found.column, index)]
        # Step 9's records, each to the side of the run that owns it: an order
        # to the desk, a log line to the book. Nothing else carries an effect.
        logbook.write(result.applied, index, bar.time)
        orders = [one for one in result.applied if one.effect == "order"]
        sent = desk.apply(orders, IntentBar(index=index, time=float(bar.time)))
        if sent is not None:
            return rows, [_diagnostic_row(sent.code, sent.line, sent.column, index)]
        rows.append(list(result.columns))
        desk.deliver_after(index)
    return rows, []
