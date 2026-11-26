"""Reads whose requested bars are not whole chart bars, on the second engine.

`stdlib.md` 15.2 and `compiled-program.md` 2.16.2: counted from the session's
open, and folded from a finer base the host serves. The numbers are the first
engine's in ``tests/engine/requests-base.test.ts``, on a session that opens at
09:15 read in UTC, the one zone this engine reads on its own. Each test names
the wrong implementation it fails against: buckets counted from the epoch, a
base read that stops at the chart bar's open, and a developing read that keeps
showing a bucket the chart bar has left.
"""

import unittest

from openscript.contracts import Bar
from openscript.request_plan import Answered, Pending

from tests.request_support import body, columns, read, reading

MINUTE = 60_000.0
#: 2025-01-06 09:15 UTC, a Monday.
OPEN = 1_736_154_900_000.0
SESSION = {"start": "09:15", "end": "15:30", "days": [1, 2, 3, 4, 5]}
CHART = {"symbol": "AAA", "exchange": "XX", "interval": "10m", "timezone": "UTC", "session": SESSION}


def every(minutes, count, base, start=OPEN):
    """Bars every ``minutes`` from the open, priced ``base + i`` so a value names its bar."""
    return [
        Bar(
            time=start + i * minutes * MINUTE,
            open=base + i,
            high=base + i + 0.5,
            low=base + i - 0.5,
            close=base + i,
            volume=1.0,
        )
        for i in range(count)
    ]


def both(timeframe):
    """A confirmed and a developing read of ``close`` at ``timeframe``."""
    return reading(
        [
            read(0, timeframe, "confirmed", 0, body("close")),
            read(1, timeframe, "developing", 1, body("close")),
        ]
    )


class Asked:
    """A provider that records what it was asked and answers ``answer(query)``."""

    def __init__(self, answer):
        self.answer = answer
        self.queries = []

    def __call__(self, query):
        self.queries.append(query)
        return self.answer(query)


class CountedFromTheOpen(unittest.TestCase):
    """2.16.2: an intraday key counts from the trading day's open, not the epoch."""

    def test_a_whole_multiple_is_counted_from_the_session_open(self):
        # [09:15, 09:45) holds chart bars 0 to 2. From the epoch it would have
        # been [09:00, 09:30), and bar 2 would already read 101.
        asked = Asked(lambda query: None)
        confirmed, developing = columns(both("30"), every(10, 7, 100), record=CHART, provider=asked)
        self.assertEqual(confirmed[:7], [None, None, None, 102, 102, 102, 105])
        self.assertEqual(developing[:7], [100, 101, 102, 103, 104, 105, 106])
        self.assertEqual(asked.queries[0].interval, "30")

    def test_without_a_session_a_bucket_is_counted_from_midnight_in_the_zone(self):
        start = 1_736_157_600_000.0  # 2025-01-06 10:00 UTC
        record = {"symbol": "AAA", "exchange": "XX", "interval": "5", "timezone": "UTC"}
        confirmed, _ = columns(both("25"), every(5, 11, 100, start), record=record)
        self.assertEqual(confirmed[:11], [None, None, None, None, None, 104, 104, 104, 104, 104, 109])


class FoldedFromABase(unittest.TestCase):
    """15.2: an interval that is not a whole multiple is folded from bars the host serves."""

    def test_fifteen_on_a_ten_minute_chart_reads_five_minute_bars(self):
        base = every(5, 12, 1000)
        asked = Asked(lambda query: Answered(base) if query.interval == "5m" else None)
        confirmed, developing = columns(both("15"), every(10, 5, 100), record=CHART, provider=asked)
        self.assertEqual(asked.queries[0].timeframe, "15")
        self.assertEqual(asked.queries[0].interval, "5m")
        self.assertEqual(confirmed[:5], [None, 1002, 1002, 1005, 1008])
        self.assertEqual(developing[:5], [1001, 1003, 1005, 1007, 1009])

    def test_three_on_a_ten_minute_chart_is_the_last_three_minute_bar_closed(self):
        base = every(1, 40, 5000)
        asked = Asked(lambda query: Answered(base) if query.interval == "1m" else None)
        confirmed, developing = columns(both("3"), every(10, 3, 100), record=CHART, provider=asked)
        self.assertEqual(asked.queries[0].interval, "1m")
        self.assertEqual(confirmed[:3], [5008, 5017, 5026])
        self.assertEqual(developing[:3], [5009, 5019, 5029])

    def test_a_developing_read_is_absent_where_the_chart_bar_ends_in_a_bucket_it_holds_nothing_of(self):
        base = [bar for j, bar in enumerate(every(5, 12, 1000)) if j not in (6, 7)]
        confirmed, developing = columns(
            both("15"), every(10, 5, 100), record=CHART, provider=Asked(lambda query: Answered(base))
        )
        self.assertEqual(confirmed[:5], [None, 1002, 1002, 1002, 1008])
        self.assertEqual(developing[:5], [1001, 1003, 1005, None, 1009])

    def test_the_same_numbers_arrive_one_bar_at_a_time(self):
        base = every(5, 12, 1000)
        asked = Asked(lambda query: Answered(base))
        confirmed, developing = columns(
            both("15"), every(10, 5, 100), record=CHART, provider=asked, history=False
        )
        self.assertEqual(confirmed[:5], [None, 1002, 1002, 1005, 1008])
        self.assertEqual(developing[:5], [1001, 1003, 1005, 1007, 1009])

    def test_a_host_still_fetching_leaves_the_read_absent(self):
        confirmed, _ = columns(both("15"), every(10, 4, 100), record=CHART, provider=Asked(lambda query: Pending()))
        self.assertEqual(confirmed[:4], [None, None, None, None])


if __name__ == "__main__":
    unittest.main()
