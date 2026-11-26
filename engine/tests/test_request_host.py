"""The half of a read that is settled before bar 0, and the half only a host answers.

``test_requests.py`` is the fold. This file is everything around it that no
case can reach: the load-time refusals (a case's host is a record that states
one interval), the answers a host gives other than bars (a case's host is its
files, which answer at once and never refuse), the status of a read as the two
library calls report it, the sentences those calls hand a script held to the
catalogue, the timeframe grammar at its edges, and the adapter's own host for a
case. Each test names the wrong implementation it failed against before it was
kept.
"""

import re
import tempfile
import unittest
from pathlib import Path

from tests.request_support import CHART, body, columns, five_minutes, loaded, read, reading
from tests.support import RESERVED, SPEC, catalogue

from openscript.adapter.ordering import Desk
from openscript.adapter.reading import read_case
from openscript.adapter.secondary import provider_for
from openscript.adapter.serving import Serving
from openscript.adapter.spellings import Malformed
from openscript.buckets import bucket_key, fold_plan, multiple_above, parse_timeframe
from openscript.reasons import TEMPLATES, reason
from openscript.request_plan import Answered, Pending, Refusal
from openscript.values import ABSENT

#: The two status calls, as a program's own library table names them.
STATUS = [
    {"name": "req.isReady", "arity": 1, "state": False, "effect": "none"},
    {"name": "req.error", "arity": 1, "state": False, "effect": "none"},
]


def with_status(requests, record=None, provider=None, bars=8):
    """The reads' values, then ``req.isReady`` and ``req.error`` of read 0, per bar."""
    tail = [["CONST", 3], ["CALL_LIB", 0, 1, -1], ["EMIT", len(requests)],
            ["CONST", 3], ["CALL_LIB", 1, 1, -1], ["EMIT", len(requests) + 1]]
    made = reading(requests, lib=STATUS, tail=tail, consts=RESERVED + [["n", 0]])
    library = Serving(Desk(()))
    return columns(made, five_minutes(bars), library=library, record=record, provider=provider)


def other(query):
    """A host holding four hourly bars of one other instrument, and nothing else."""
    if query.read != "symbol":
        return None
    return Answered(five_minutes(4, start=0)[:1] + [one for one in five_minutes(48)[12::12]])


class RefusedAtLoad(unittest.TestCase):
    """OS6001, OS6002 and OS6015: facts about the program and the chart, known before bar 0."""

    def refused(self, timeframe, record=None, nested=None):
        inner = body("close", requests=[] if nested is None else [nested], extra=0 if nested is None else 1)
        found = loaded(reading([read(0, timeframe, "confirmed", 0, inner)]), record=record)
        self.assertFalse(found.ok)
        return found.diagnostic

    def test_a_timeframe_the_grammar_does_not_hold_is_os6001_naming_it(self):
        found = self.refused("2x")
        self.assertEqual((found.code, found.values["value"]), ("OS6001", "2x"))

    def test_a_timeframe_finer_than_the_chart_is_os6002(self):
        found = self.refused("1m")
        self.assertEqual(found.code, "OS6002")
        self.assertEqual((found.values["chart"], found.values["requested"]), ("5", "1m"))

    def test_an_intraday_timeframe_that_is_no_whole_multiple_is_os6015_with_the_next_one(self):
        # Against a suggestion rounded down rather than up, this named 5, which
        # is the chart's own interval and a multiple the read did not ask for.
        found = self.refused("7")
        self.assertEqual(found.code, "OS6015")
        self.assertEqual(found.values["suggestion"], "10")

    def test_a_read_inside_a_read_is_compared_with_the_read_around_it(self):
        # Against a plan that compared every read with the chart, an hourly read
        # inside a four hour one loaded: it is coarser than the chart's five
        # minutes and finer than the bars it is actually handed.
        found = self.refused("4h", nested=read(1, "1h", "confirmed", 1, body("close")))
        self.assertEqual(found.code, "OS6002")
        self.assertEqual((found.values["chart"], found.values["requested"]), ("4h", "1h"))

    def test_a_chart_that_states_no_interval_is_compared_with_nothing(self):
        record = {"symbol": "AAA", "timezone": "UTC"}
        made = reading([read(0, "1m", "confirmed", 0, body("close"))])
        self.assertTrue(loaded(made, record=record).ok)

    def test_a_read_of_another_instrument_needs_a_provider_and_names_the_tag(self):
        # Against a run that served req.symbol whatever it was handed, this
        # program loaded and drew an absent line with nothing to say why.
        made = reading([read(0, "1h", "confirmed", 0, body("close"), kind="symbol", symbol="BBB")])
        refused = loaded(made)
        self.assertEqual((refused.diagnostic.code, refused.diagnostic.values["tag"]), ("OS6006", "req.symbol"))
        self.assertTrue(loaded(made, provider=other).ok)


class WhatAHostAnswers(unittest.TestCase):
    """Bars, a host still fetching, a refusal, and nothing at all."""

    def symbol(self, provider, record=None):
        made = [read(0, "1h", "confirmed", 0, body("close"), kind="symbol", symbol="BBB")]
        return with_status(made, record=record, provider=provider, bars=14)

    def test_bars_are_folded_by_time_and_the_read_is_ready_with_no_reason(self):
        # The host's hourly bars open at 10:00, 11:00 and later; the 10:00 one
        # closes when the 11:00 one is folded, on the chart's bar at 11:00.
        values, ready, why = self.symbol(other)
        self.assertEqual(values[11], ABSENT)
        self.assertEqual((values[12], values[13]), (100.0, 100.0))
        self.assertEqual((ready[0], why[0]), (True, ""))

    def test_a_host_still_fetching_leaves_the_read_absent_not_ready_and_without_a_reason(self):
        # Against a read that took a pending answer for an empty one, the read
        # reported a reason: a study waiting would have said it had failed.
        values, ready, why = self.symbol(lambda query: Pending())
        self.assertEqual((values[13], ready[13], why[13]), (ABSENT, False, ""))

    def test_a_refusal_is_absent_never_ready_and_carries_the_host_s_own_words(self):
        # Against a reason built without the host's words, the sentence said
        # the host gave none: "the request failed" is what a trader cannot act on.
        said = "the account's data subscription does not cover it"
        values, ready, why = self.symbol(lambda query: Refusal("OS6009", reason=said))
        self.assertEqual((values[13], ready[13]), (ABSENT, False))
        self.assertIn(said, why[13])
        self.assertEqual(why[13], reason("OS6009", symbol="BBB", timeframe="1h", reason=said))

    def test_nothing_served_for_another_instrument_is_the_host_not_knowing_it(self):
        # Against an ask that took nothing served as nothing to report, the read
        # was absent with an empty reason: a blank line nobody could explain.
        values, ready, why = self.symbol(lambda query: None)
        self.assertEqual((values[13], ready[13]), (ABSENT, False))
        self.assertEqual(why[13], reason("OS6007", symbol="BBB", exchange="XX"))

    def test_nothing_served_for_the_chart_s_own_instrument_is_the_fold_and_asks_nothing_more(self):
        asked = []
        made = [read(0, "1h", "confirmed", 0, body("close"))]
        values, ready, why = with_status(made, provider=lambda query: asked.append(query), bars=14)
        self.assertEqual((values[12], ready[0], why[0]), (111.0, True, ""))
        # Every field resolved: the chart's own identity, its exchange by default.
        query = asked[0]
        self.assertEqual((query.read, query.instrument, query.exchange, query.timeframe), ("timeframe", "AAA", "XX", "1h"))

    def test_a_calendar_read_with_no_zone_is_finished_rather_than_waiting_and_says_why(self):
        # Against a read left absent with nothing said, isReady answered true and
        # error the empty string over a study that would never draw.
        record = {"symbol": "AAA", "exchange": "XX", "interval": "5"}
        made = [read(0, "1D", "confirmed", 0, body("close"))]
        values, ready, why = with_status(made, record=record)
        self.assertEqual((values[7], ready[7]), (ABSENT, False))
        self.assertEqual(why[7], reason("OS6012", fact="a timezone", symbol="AAA"))

    def test_an_intraday_read_needs_no_zone(self):
        record = {"symbol": "AAA", "exchange": "XX", "interval": "5"}
        values, ready, why = with_status([read(0, "1h", "confirmed", 0, body("close"))], record=record, bars=14)
        self.assertEqual((values[12], ready[0], why[0]), (111.0, True, ""))

    def test_a_handle_no_read_holds_has_not_answered_and_has_no_reason(self):
        made = reading([], lib=STATUS, consts=RESERVED + [["n", 7]], tail=[
            ["CONST", 3], ["CALL_LIB", 0, 1, -1], ["EMIT", 0], ["CONST", 3], ["CALL_LIB", 1, 1, -1], ["EMIT", 1]])
        ready, why = columns(made, five_minutes(1), library=Serving(Desk(())))
        self.assertEqual((ready[0], why[0]), (False, ""))


class TheReasonsAreTheCatalogue(unittest.TestCase):
    """Wrong: a sentence ``req.error`` hands a script that is not the catalogue's message."""

    def test_each_template_is_the_message_spec_errors_json_gives_its_code(self):
        # Against a template with one word changed, the two engines hand a
        # script two different strings for one failed read.
        messages = {one["code"]: one["message"] for one in catalogue()["entries"]}
        for code, template in TEMPLATES.items():
            with self.subTest(code=code):
                self.assertEqual(template, messages[code])

    def test_every_code_a_host_may_refuse_a_read_with_has_a_template(self):
        # Read from host-interface.md 5.4's table, less OS5006, which refuses a
        # program at load rather than a read. Against a table missing one, a
        # read the host refused with it raised at load instead of reporting it.
        page = (SPEC / "host-interface.md").read_text(encoding="utf-8")
        section = page[page.index("### 5.4 Refusal"):page.index("### 5.5 ")]
        codes = set(re.findall(r"^\| (OS\d{4}) \|", section, re.MULTILINE)) - {"OS5006"}
        self.assertGreater(len(codes), 3)
        self.assertEqual(codes - set(TEMPLATES), set())
        self.assertIn("OS6012", TEMPLATES)

    def test_a_slot_with_no_value_is_left_written_out(self):
        self.assertEqual(reason("OS6012", symbol="AAA"), "The host did not supply {fact} for AAA.")


class TheGrammar(unittest.TestCase):
    """`stdlib.md` 15.2 at its edges, where two engines' readers could part."""

    def test_the_count_and_the_unit(self):
        self.assertEqual(parse_timeframe("60")[:2], (60.0, "m"))
        self.assertEqual(parse_timeframe("1M")[:2], (1.0, "M"))
        self.assertEqual(parse_timeframe("1m")[:2], (1.0, "m"))
        for written in ("0", "5s", "1e3", "", "m", "1 h", "01d"):
            with self.subTest(written=written):
                self.assertIsNone(parse_timeframe(written))

    def test_the_first_engine_s_white_space_is_trimmed_and_nothing_else(self):
        # Against the interpreter's own strip, a file separator was trimmed and a
        # byte order mark was not: two timeframes the first engine reads the
        # other way round.
        self.assertEqual(parse_timeframe("﻿15 ")[:3], (15.0, "m", "﻿15 "))
        self.assertIsNone(parse_timeframe("\x1c15"))

    def test_a_week_begins_on_a_monday_and_a_month_on_its_first(self):
        # Against a week counted as 10,080 minutes from the epoch, the Sunday
        # and the Monday after it were one week and the Monday before another.
        week = parse_timeframe("1W")
        sunday, monday, before = 1736640000000, 1736726400000, 1736121600000
        self.assertEqual(bucket_key(sunday, week, "UTC"), bucket_key(before, week, "UTC"))
        self.assertEqual(bucket_key(monday, week, "UTC"), bucket_key(sunday, week, "UTC") + 1)
        month = parse_timeframe("1M")
        self.assertEqual(bucket_key(1735689599999, month, "UTC") + 1, bucket_key(1735689600000, month, "UTC"))

    def test_a_calendar_key_needs_a_zone_this_engine_reads(self):
        day = parse_timeframe("1D")
        self.assertIsNone(bucket_key(1735689600000, day, None))
        self.assertIsNone(bucket_key(1735689600000, day, "Area/Location"))
        self.assertIsNotNone(bucket_key(1735689600000, parse_timeframe("1h"), None))

    def test_a_request_that_is_not_a_whole_multiple_is_folded_from_a_base(self):
        """`stdlib.md` 15.2: the base is the longest interval dividing both."""
        kind, base = fold_plan(parse_timeframe("90"), parse_timeframe("60"))
        self.assertEqual((kind, base.text), ("base", "30m"))
        kind, base = fold_plan(parse_timeframe("3"), parse_timeframe("10"))
        self.assertEqual((kind, base.text), ("base", "1m"))
        self.assertEqual(fold_plan(parse_timeframe("120"), parse_timeframe("60")), ("chart", None))
        self.assertEqual(fold_plan(parse_timeframe("1D"), parse_timeframe("7")), ("chart", None))
        self.assertEqual(fold_plan(parse_timeframe("1W"), parse_timeframe("1D")), ("chart", None))
        self.assertEqual(fold_plan(parse_timeframe("15"), parse_timeframe("1D")), ("OS6002", None))
        self.assertEqual(multiple_above(parse_timeframe("90"), parse_timeframe("60")), "120")

    def test_an_intraday_key_counts_from_the_session_open(self):
        """`compiled-program.md` 2.16.2: 09:15 opens the first sixty minute bucket, not 09:00."""
        hour = parse_timeframe("60")
        session = {"start": "09:15", "end": "15:30", "days": [1, 2, 3, 4, 5]}
        zone = "UTC"
        at_0915 = 1736154900000  # 2025-01-06 09:15 UTC
        # Counted from the epoch, 09:15 and 10:14 would fall in two buckets.
        self.assertNotEqual(bucket_key(at_0915, hour, zone), bucket_key(at_0915 + 59 * 60000, hour, zone))
        self.assertEqual(
            bucket_key(at_0915, hour, zone, session), bucket_key(at_0915 + 59 * 60000, hour, zone, session)
        )
        self.assertEqual(
            bucket_key(at_0915, hour, zone, session) + 1, bucket_key(at_0915 + 60 * 60000, hour, zone, session)
        )


class ACaseIsItsOwnHost(unittest.TestCase):
    """`conformance.md` section 3: another instrument's bars are the case's file, or the case is broken."""

    def case(self, **files):
        root = Path(tempfile.mkdtemp())
        here = root / "req" / "made"
        here.mkdir(parents=True)
        held = {"case.json": '{"asserts":["values"],"category":"external","description":"d","id":"req/made",'
                             '"languageVersion":1,"profile":"chart"}', "script.os": "x\n", **files}
        for name, text in held.items():
            (here / name).write_text(text, encoding="utf-8")
        return provider_for(read_case(str(here)))

    def query(self, instrument, kind="symbol"):
        from openscript.request_plan import RequestQuery

        return RequestQuery(0, kind, instrument, "XX", "1h", "confirmed", None)

    def test_the_file_named_after_the_instrument_answers_its_read(self):
        bars = "time,open,high,low,close,volume\n0,1,2,0.5,1.5,none\n3600000,1.5,2,1,1.75,10\n"
        answer = self.case(**{"bars.OTHER.csv": bars})(self.query("OTHER"))
        self.assertEqual([one.close for one in answer.bars], [1.5, 1.75])

    def test_a_missing_file_is_a_malformed_case_and_not_a_refusal(self):
        # Against a provider that answered a missing file with OS6007, the read
        # was absent, the study drew around it, and the case compared an absent
        # column against whatever was expected of one.
        with self.assertRaises(Malformed):
            self.case()(self.query("OTHER"))

    def test_a_read_that_named_no_instrument_is_refused_as_a_host_refuses_it(self):
        self.assertEqual(self.case()(self.query(None)), Refusal("OS6007"))

    def test_a_read_of_the_chart_s_own_instrument_is_not_a_file(self):
        self.assertIsNone(self.case()(self.query("AAA", kind="timeframe")))


if __name__ == "__main__":
    unittest.main()
