"""Timeframe strings, and the bucket a read folds a bar into.

`stdlib.md` section 15.2 fixes the spelling: a count and a unit, with the unit
letters case sensitive so ``"1M"`` is one month and ``"1m"`` one minute, and a
bare number read as minutes because that is the form an interval input
supplies. This module is that grammar and the arithmetic that follows from it,
which is `compiled-program.md` section 2.16.2's table of keys, and nothing else.

**A bucket is named by a key rather than by a range**, because a key is one
integer per bar and a range is two comparisons and an edge case. Two bars
belong to the same requested bar exactly when their open instants give the same
key, and a bucket has begun on the first bar whose key is new. Every boundary
question in ``requests.py`` reduces to that one comparison.

**The two families are keyed differently, and the specification says why.** An
intraday request is folded by counting from the open of the trading day the bar
belongs to: the session's open where the host stated a session, midnight in the
instrument's zone where it stated none, and midnight UTC where it stated no zone.
That is what makes a sixty minute bucket on a market opening at a quarter past
the hour begin at a quarter past, as the venue's candles do. A day, week or month
request is folded by the calendar, so its key is a civil date read in the
instrument's zone.

**A calendar bucket with no zone has no key**, and neither has one in a zone this
engine cannot read (``zones.py`` says which it can and why). The first is the
page's own rule and every engine gives it; the second is this engine's limit,
and a caller that meets it reports the case ``unsupported`` rather than
answering absence where the first engine folds.

**The count is a binary64, as the first engine's is.** A count is read as that
engine reads a number out of text, so a count too large for one is no count at
all, and every division below is the same floating point division on both
engines rather than an exact one on this side only.
"""

import math
import re
from typing import Any, NamedTuple, Optional, Tuple

from .canonical import canonical_number
from .civil import MINUTE_MS, day_number
from . import dates as _calendar
from .hours import trading_day_of

#: Minutes in a day: the longest period counted from a trading day's open.
_DAY_MINUTES = 1440

#: 15.2's grammar. A bare number is minutes, which is the interval form a host
#: supplies, and the letters are case sensitive.
_WRITTEN = re.compile(r"([0-9]+)(m|h|D|W|M)?")

#: The nominal length of one unit in minutes. It orders two timeframes, which is
#: OS6002, and sizes a bar slot; where a calendar bucket begins is the calendar's.
NOMINAL = {"m": 1, "h": 60, "D": 1440, "W": 10080, "M": 43200}

#: What the first engine's reader trims from either end of a timeframe string:
#: that language's white space and line terminators, which are not this one's.
#: An interval written with a byte one of the two trims and the other keeps
#: would be a timeframe on one engine and OS6001 on the other.
_TRIMMED = (
    "\t\n\v\f\r           "
    "       　﻿"
)


class Timeframe(NamedTuple):
    """A count and a unit, and the string as the script wrote it."""

    count: float
    unit: str
    #: What a diagnostic and a request name it as, untrimmed.
    text: str


def parse_timeframe(text: Any) -> Optional[Timeframe]:
    """15.2's grammar, or nothing for a string it does not hold."""
    if not isinstance(text, str):
        return None
    found = _WRITTEN.fullmatch(text.strip(_TRIMMED))
    if found is None:
        return None
    try:
        count = float(int(found.group(1)))
    except OverflowError:
        # Past the largest binary64, which the first engine reads as infinity
        # and refuses as not a whole number: no timeframe either way.
        return None
    if count < 1:
        return None
    return Timeframe(count, found.group(2) or "m", text)


def is_intraday(timeframe: Timeframe) -> bool:
    """Whether this timeframe is folded by counting rather than by the calendar."""
    return timeframe.unit in ("m", "h")


def minutes_of(timeframe: Timeframe) -> Optional[float]:
    """Minutes one bar covers, for an intraday timeframe only."""
    return timeframe.count * NOMINAL[timeframe.unit] if is_intraday(timeframe) else None


def nominal_minutes(timeframe: Timeframe) -> float:
    """One timeframe's length in minutes, with a month treated as thirty days.

    Two uses and neither of them folds anything: ordering two timeframes, and
    the length of a bar slot the session facts measure against.
    """
    return timeframe.count * NOMINAL[timeframe.unit]


def bucket_key(instant: Any, timeframe: Timeframe, zone: Any, session: Any = None) -> Optional[int]:
    """The bucket an instant falls in, or nothing when no key can be worked out.

    The four rows of section 2.16.2's table, in its order. A week is counted
    from a Monday: 1970-01-01 was a Thursday, so shifting the day number by
    three puts a Monday at the start of week zero, which is the week start
    `stdlib.md` 12.2 fixes.
    """
    if isinstance(instant, bool) or not isinstance(instant, (int, float)):
        return None
    if not math.isfinite(instant):
        return None
    minutes = minutes_of(timeframe)
    if minutes is not None:
        return _intraday_key(instant, minutes, zone, session)
    if zone is None:
        return None
    civil = _calendar.fields_in(instant, zone)
    if civil is None:
        return None
    if timeframe.unit == "M":
        return math.floor((civil.year * 12 + (civil.month - 1)) / timeframe.count)
    days = day_number(civil.year, civil.month, civil.day)
    if timeframe.unit == "D":
        return math.floor(days / timeframe.count)
    return math.floor(math.floor((days + 3) / 7) / timeframe.count)


def _intraday_key(instant: float, minutes: float, zone: Any, session: Any) -> Optional[int]:
    """The trading day and the period within it counted from the day's open, as one key.

    Each day owns ``2 * slots`` consecutive keys, so keys keep their time order
    across days. A period of a day or longer keeps the count from the epoch.
    """
    if minutes >= _DAY_MINUTES:
        return math.floor(instant / (minutes * MINUTE_MS))
    # Looked up on the calendar module at the call rather than imported, because
    # that function is where a host that reads other zones puts its reader
    # (`zones.py`), and a copy bound at import would never see it.
    civil = _calendar.fields_in(instant, "UTC" if zone is None else zone)
    if civil is None:
        return None
    day, elapsed = trading_day_of(None if zone is None else session, civil)
    slots = math.ceil(_DAY_MINUTES / minutes) + 1
    return day * 2 * slots + slots + math.floor(elapsed / minutes)


def fold_plan(requested: Timeframe, chart: Optional[Timeframe]) -> Tuple[str, Optional[Timeframe]]:
    """Where a read's requested bars are folded from, `stdlib.md` 15.2.

    ``("chart", None)`` for the chart's own bars: a whole multiple of an intraday
    chart's interval, a day, week or month, or a chart with no interval.
    ``("base", base)`` for bars at the longest interval dividing both, which the
    host serves: an intraday request that is not a whole multiple of an intraday
    chart's interval, finer than it included. ``("OS6002", None)`` for a request
    finer than a chart of a day or longer.
    """
    if chart is None:
        return ("chart", None)
    wanted = minutes_of(requested)
    have = minutes_of(chart)
    if wanted is not None and have is not None:
        if math.fmod(wanted, have) == 0:
            return ("chart", None)
        base = float(math.gcd(int(wanted), int(have)))
        return ("base", Timeframe(base, "m", canonical_number(base) + "m"))
    if nominal_minutes(requested) < nominal_minutes(chart):
        return ("OS6002", None)
    return ("chart", None)


def multiple_above(requested: Timeframe, chart: Timeframe) -> str:
    """The whole multiple of the chart's interval at or above the requested one, for OS6015's fix."""
    wanted = minutes_of(requested)
    have = minutes_of(chart)
    wanted = nominal_minutes(requested) if wanted is None else wanted
    have = nominal_minutes(chart) if have is None else have
    return canonical_number(max(1, math.ceil(wanted / have)) * have)
