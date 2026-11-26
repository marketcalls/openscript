"""A range of wall clock hours, and where one reading sits inside it.

Two different things in this repository are a range of hours: the instrument's
own trading session, which a host states in its instrument record
(`host-interface.md` 4.3), and the range a script writes for ``session.isIn``
(`stdlib.md` 12.5). They are spelled differently and they mean different things,
and the arithmetic under them is one arithmetic, so it is here rather than in
each of them. A second copy would be a fact stated twice, and the two copies
would not drift over anything a reader could see: they would drift over midnight,
or over which day a list of days is read against, on the one dataset nobody
tests.

**The open is inclusive and the close is exclusive**, so two ranges written back
to back cover every minute once and no minute twice. A range whose start and end
are the same minute holds nothing, which is what writing a zero length range
says.

**A range whose end is before its start crosses midnight and is read that way**,
which is what an overnight session needs (4.3, and 12.5 for the script's own
spelling). The day list then names the day the range opened on rather than the
day the reading falls on, because a session that opens on Friday evening and
closes on Saturday morning is a Friday session: reading the list against the
reading's own day would drop half of every overnight session and keep the wrong
half.

**A session is named by the day it opened on**, which is what tells two readings
in one session from two readings in two. Naming it by an instant would be wrong
across a seasonal clock change, where a wall clock hour inside a session is not
an hour of elapsed time.
"""

import re
from dataclasses import dataclass
from typing import Optional, Sequence, Tuple

from .civil import Civil, DAY_MINUTES, day_number, minutes_of, weekday_of_day

#: 4.3: midnight at the end of the day, which is the one spelling past 23:59.
END_OF_DAY = DAY_MINUTES

#: ``"HH:MM"``, the one spelling 4.3 fixes for a bound of the record's session.
_CLOCK = re.compile(r"^([0-9]{2}):([0-9]{2})$")

#: 12.5: ``"HHMM-HHMM"`` with an optional colon and a run of day digits.
_WINDOW = re.compile(r"^([0-9]{2})([0-9]{2})-([0-9]{2})([0-9]{2})(?::([1-7]{1,7}))?$")


@dataclass(frozen=True)
class Hours:
    """Hours as minutes from midnight, and the days they open on."""

    start: int
    #: Minutes from midnight at the close, which may be at 24:00.
    end: int
    #: The days it opens on, Monday as 1, or nothing for every day.
    days: Optional[Tuple[int, ...]] = None

    @property
    def crosses_midnight(self) -> bool:
        """4.3: "an ``end`` earlier than its ``start`` crosses midnight"."""
        return self.end < self.start


@dataclass(frozen=True)
class Standing:
    """Where one reading sits in a range of hours."""

    inside: bool
    #: Minutes since the hours opened, zero on the minute they opened.
    elapsed: float = 0.0
    #: Minutes until they are scheduled to close.
    remaining: float = 0.0
    #: The day they opened on, which is the name of this one session.
    opening_day: int = 0


OUTSIDE = Standing(False)


def clock_minutes(text: object) -> Optional[int]:
    """``"HH:MM"`` as minutes from midnight, or nothing for another spelling.

    ``"9:00"`` is the spelling a host writes first and it is not a time here, so
    it has no reading rather than a generous one: a record stating a window in a
    spelling the page does not have is a record whose author believes they stated
    a session, and 4.3 refuses it instead of reading it.
    """
    if not isinstance(text, str):
        return None
    found = _CLOCK.match(text)
    if found is None:
        return None
    hour, minute = int(found.group(1)), int(found.group(2))
    if hour > 24 or minute > 59 or (hour == 24 and minute != 0):
        return None
    return hour * 60 + minute


def window_of(spec: object) -> Optional[Hours]:
    """The hours a ``session.isIn`` spec names, or nothing where it is malformed.

    12.5's grammar, and the bounds it allows: ``"2400"`` is midnight at the end
    of the day and is the one hour past 23 a spec may write. A malformed spec is
    OS3008 at compile time when it is a literal, and absence here when it is not:
    the alternative would stop a chart on a string the script built on one bar
    out of forty thousand, and absence is a value a script can test.
    """
    if not isinstance(spec, str):
        return None
    found = _WINDOW.match(spec)
    if found is None:
        return None
    from_hour, from_minute = int(found.group(1)), int(found.group(2))
    to_hour, to_minute = int(found.group(3)), int(found.group(4))
    if from_hour > 23 or from_minute > 59 or to_minute > 59:
        return None
    if to_hour > 24 or (to_hour == 24 and to_minute != 0):
        return None
    listed = found.group(5)
    days = None if listed is None else tuple(int(one) for one in listed)
    return Hours(from_hour * 60 + from_minute, to_hour * 60 + to_minute, days)


def standing_in(hours: Hours, at: Civil) -> Standing:
    """Where a wall clock reading sits in a range of hours, or outside every one."""
    minutes = minutes_of(at)
    today = day_number(at.year, at.month, at.day)

    if hours.end > hours.start:
        if minutes < hours.start or minutes >= hours.end:
            return OUTSIDE
        return _held(hours, today, minutes - hours.start, hours.end - minutes)
    if hours.end == hours.start:
        return OUTSIDE

    # Crossing midnight: the evening part belongs to today's session and the
    # morning part to yesterday's, which is the day the list is read against.
    if minutes >= hours.start:
        return _held(hours, today, minutes - hours.start, DAY_MINUTES - minutes + hours.end)
    if minutes < hours.end:
        return _held(
            hours, today - 1, DAY_MINUTES - hours.start + minutes, hours.end - minutes
        )
    return OUTSIDE


#: Midnight to midnight: the trading day of an instrument with no stated session.
WHOLE_DAY = Hours(0, DAY_MINUTES)


def placement_in(hours: Hours, at: Civil) -> Tuple[int, float]:
    """The trading day a reading belongs to and the minutes since it opened.

    `compiled-program.md` 2.16.2 counts an intraday bucket from here. Unlike
    ``standing_in`` it answers outside the hours as well: before the open is a
    negative count on the same day, and the one reading that belongs to the day
    before is the morning part of a range crossing midnight. The day list plays
    no part, because where a bucket begins is a question about the clock.
    """
    minutes = minutes_of(at)
    today = day_number(at.year, at.month, at.day)
    if hours.end < hours.start and minutes < hours.end:
        return today - 1, DAY_MINUTES - hours.start + minutes
    return today, minutes - hours.start


def trading_day_of(session: object, at: Civil) -> Tuple[int, float]:
    """``placement_in`` against the record's session, or midnight where it states none."""
    hours = WHOLE_DAY
    if isinstance(session, dict):
        start = clock_minutes(session.get("start"))
        end = clock_minutes(session.get("end"))
        if start is not None and end is not None:
            hours = Hours(start, end)
    return placement_in(hours, at)


def _held(hours: Hours, opening_day: int, elapsed: float, remaining: float) -> Standing:
    """One reading inside the hours, unless the day it opened on is not one of theirs."""
    if hours.days is not None and weekday_of_day(opening_day) not in hours.days:
        return OUTSIDE
    return Standing(True, elapsed, remaining, opening_day)


def days_numbered(days: Sequence[object]) -> bool:
    """Whether a stated day list is the numbering ``date.dayOfWeek`` uses.

    Monday is 1 through Sunday is 7, and an empty list is not a list of days: a
    host numbering Sunday as 0 states a week the instrument never opens in, which
    4.3 refuses rather than reads.
    """
    if not days:
        return False
    return all(
        isinstance(day, int) and not isinstance(day, bool) and 1 <= day <= 7 for day in days
    )
