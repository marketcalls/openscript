"""One cost model per run, and the refusal when a run states two.

``errors.md`` OS6023: the declaration's commission is the script's own statement
of what trading costs and a supplied schedule is the platform's, and the two
describe the same money. Applied together they charge it twice; applied one at a
time they charge whichever an engine happened to prefer, which is a rule nobody
wrote down and a figure nobody can explain afterwards.

**This was a disagreement between the two engines and not a missing tidiness
rule.** A case stating ``costs`` in ``backtest.json`` whose script declares a
commission was refused by the first engine and run to a full report by this one:
one answered a diagnostic on the channel both engines answer, the other answered
six trades and a summary, and ``conformance.md`` section 10 calls that a release
blocker. The two now answer the same thing.

It matters more than it did the week before. Until a supplied schedule's lines
were carried, such a run charged nothing at all, so the report was merely wrong
by the schedule; now the schedule is applied whole, and a run that also charged
the declaration's commission would charge the same money twice.

Every test below names the wrong implementation it catches, and each asserts a
value rather than an outcome: an engine that answered an empty ledger for every
case would pass a test that asserted only a refusal.
"""

import json
import unittest

from tests.strategy_support import BACKTEST, CASE, Cases, buying, envelope

from openscript.adapter.answers import answer_for
from openscript.adapter.reporting import settings_problem
from openscript.accounting import ChargeLine, ChargeSchedule, Contract

#: A schedule a host supplied: one flat charge per order, which is the same money
#: a declared commission of the same shape states.
SUPPLIED = {
    "currency": "CUR",
    "digits": 2,
    "slippageTicks": 0.0,
    "lines": [{"name": "fee", "base": "order", "side": "both", "rate": 50}],
}

#: The same schedule with a line no run can be carried out under, for the one
#: test about which of the two refusals comes first.
UNUSABLE = {**SUPPLIED, "lines": [{"name": "fee", "base": "order", "rate": -1}]}

#: What the declaration states when it states a cost model of its own.
COMMISSION = 20


def backtest(costs) -> str:
    """``backtest.json`` with a charge schedule in it, or with none.

    Built from the file ``strategy_support`` already writes, so the digit count
    and the window are stated in one place and a run here is the run every other
    strategy test makes but for the schedule.
    """
    return json.dumps({**json.loads(BACKTEST), "costs": costs})


def asserting(*channels: str) -> str:
    """``case.json`` asserting these channels, and otherwise the shared case."""
    return json.dumps({**CASE, "asserts": list(channels)})


class TwoCostModelsAtOnce(Cases):
    def answer_under(self, costs, channels, **declared):
        """One run, under a stated schedule and a stated declaration."""
        return answer_for(
            self.case(**{"case.json": asserting(*channels), "backtest.json": backtest(costs)}),
            envelope(buying(**declared)),
        )

    def test_a_supplied_schedule_beside_a_declared_commission_is_refused(self):
        # The defect: this engine ran the case and answered a full report where
        # the first engine answered this code. Catches an engine that reconciles
        # the two behind the reader, in either direction, because either way the
        # channel both engines answer holds nothing here.
        found = self.answer_under(SUPPLIED, ("diagnostics", "orders"), commission=COMMISSION)

        self.assertEqual(found["unsupported"], [])
        self.assertEqual([row["code"] for row in found["channels"]["diagnostics"]], ["OS6023"])
        self.assertEqual(found["channels"]["orders"], [])

    def test_the_refusal_points_at_no_line_of_the_script_and_at_no_bar(self):
        # A run setting is what the host stated before the first bar, so a caret
        # under a line of the strategy would blame the one party that did not
        # choose it. Catches a refusal raised part way through a bar, which would
        # carry that bar's index and a position, and would mean the report was
        # half computed before anybody said no.
        found = self.answer_under(SUPPLIED, ("diagnostics",), commission=COMMISSION)

        row = found["channels"]["diagnostics"][0]
        self.assertEqual((row["line"], row["column"]), (0, 0))
        self.assertIsNone(row["barIndex"])
        self.assertEqual(row["severity"], "error")

    def test_a_supplied_schedule_alone_charges_the_schedule(self):
        # The other side of the refusal, and the reason it cannot simply refuse
        # every supplied schedule: with the declaration's commission left at its
        # default the host's schedule is the one cost model and the run stands.
        # The charge is asserted rather than the outcome, because an engine that
        # dropped the schedule would also answer no diagnostic here.
        found = self.answer_under(SUPPLIED, ("diagnostics", "trades"))

        self.assertEqual(found["channels"]["diagnostics"], [])
        self.assertEqual(found["channels"]["trades"][0]["charges"], 50.0)

    def test_a_declared_commission_alone_charges_the_declaration(self):
        # And the other one model: the path almost every run takes. Catches a
        # refusal written against the declaration rather than against the pair,
        # which would refuse every strategy that states a commission at all.
        found = self.answer_under(None, ("diagnostics", "trades"), commission=COMMISSION)

        self.assertEqual(found["channels"]["diagnostics"], [])
        self.assertEqual(found["channels"]["trades"][0]["charges"], float(COMMISSION))

    def test_two_models_are_refused_before_the_schedule_own_problem(self):
        # Order, which is not arbitrary: a schedule that is also unusable in some
        # second way would otherwise be reported as OS6021, and the reader would
        # correct the rate and run into the refusal they were never told about.
        # Catches the two questions asked the other way round.
        found = self.answer_under(UNUSABLE, ("diagnostics",), commission=COMMISSION)

        self.assertEqual([row["code"] for row in found["channels"]["diagnostics"]], ["OS6023"])

    def test_a_schedule_that_cannot_be_evaluated_is_still_refused(self):
        # The second question still gets asked when the first one passes.
        found = self.answer_under(UNUSABLE, ("diagnostics",))

        self.assertEqual([row["code"] for row in found["channels"]["diagnostics"]], ["OS6021"])


class WhatTheRefusalCarries(unittest.TestCase):
    """The message's own values, which the row deliberately does not compare.

    Section 4 compares a diagnostic on its code, its line, its column and its
    severity, so nothing above would notice a refusal that named the wrong
    figure. A reader is handed the figure and acts on it, so it is asserted here.
    """

    def schedule(self, source: str) -> ChargeSchedule:
        return ChargeSchedule(
            currency="CUR",
            digits=2,
            lines=(ChargeLine(name="fee", base="order", rate=50),),
            source=source,
        )

    def test_it_names_the_commission_the_declaration_states(self):
        declared = {"commission": COMMISSION, "commissionType": "perTrade"}

        refused = settings_problem(self.schedule("supplied"), declared, Contract())

        self.assertEqual(refused.code, "OS6023")
        self.assertEqual(refused.values["commission"], COMMISSION)
        self.assertEqual(refused.values["commissionType"], "perTrade")

    def test_a_schedule_derived_from_the_declaration_is_not_a_second_model(self):
        # The declaration's own commission is where a derived schedule comes
        # from, so a refusal that looked at the schedule alone would refuse every
        # run that states a commission. Catches exactly that: this schedule holds
        # the same line and is the declaration's, and the two are one model.
        declared = {"commission": COMMISSION, "commissionType": "perTrade"}

        self.assertIsNone(settings_problem(self.schedule("declaration"), declared, Contract()))


class TwoSlippagesAtOnce(Cases):
    """A supplied schedule's slippage and the declaration's own, ``errors.md`` OS6026.

    The venue worsens a fill by one slippage, and where a schedule is supplied
    it is the schedule's. A declaration stating two ticks beside a schedule
    carrying one was filled at one with nothing said, so the script's own
    statement of how bad its fills are did not happen. Both engines refuse it,
    after OS6023 and before the schedule's own problems.
    """

    def answer_under(self, costs, channels, **declared):
        return answer_for(
            self.case(**{"case.json": asserting(*channels), "backtest.json": backtest(costs)}),
            envelope(buying(**declared)),
        )

    def test_a_supplied_slippage_that_replaces_a_different_declared_one_is_refused(self):
        # Catches an engine that applies the schedule's figure silently, which is
        # the defect, one that applies the declaration's silently, and one that
        # adds the two.
        found = self.answer_under({**SUPPLIED, "slippageTicks": 1.0}, ("diagnostics", "orders"), slippage=2)

        self.assertEqual([row["code"] for row in found["channels"]["diagnostics"]], ["OS6026"])
        self.assertEqual(found["channels"]["orders"], [])

    def test_a_schedule_carrying_no_slippage_still_replaces_a_declared_one(self):
        # Zero ticks is a statement that fills cost nothing extra, which is a
        # different number from the declaration's two.
        found = self.answer_under(SUPPLIED, ("diagnostics",), slippage=2)

        self.assertEqual([row["code"] for row in found["channels"]["diagnostics"]], ["OS6026"])

    def test_the_same_number_stated_twice_is_one_statement(self):
        # The other side, and the reason the rule cannot refuse every schedule
        # beside a declared slippage: a host supplying the rest of the costs for a
        # script that states its own slippage carries the same figure and runs.
        found = self.answer_under({**SUPPLIED, "slippageTicks": 2.0}, ("diagnostics", "trades"), slippage=2)

        self.assertEqual(found["channels"]["diagnostics"], [])
        self.assertEqual(found["channels"]["trades"][0]["charges"], 50.0)

    def test_a_declaration_stating_none_leaves_the_schedule_to_stand(self):
        found = self.answer_under({**SUPPLIED, "slippageTicks": 3.0}, ("diagnostics",))

        self.assertEqual(found["channels"]["diagnostics"], [])

    def test_two_cost_models_are_named_before_two_slippages(self):
        # A run stating a commission and a slippage beside a schedule is first of
        # all two cost models; a reader told only about the slippage would correct
        # it and meet OS6023 next.
        found = self.answer_under(SUPPLIED, ("diagnostics",), commission=COMMISSION, slippage=2)

        self.assertEqual([row["code"] for row in found["channels"]["diagnostics"]], ["OS6023"])

    def test_the_refusal_names_both_figures(self):
        declared = {"commission": 0, "commissionType": "perTrade", "slippage": 2}
        schedule = ChargeSchedule(
            currency="CUR",
            digits=2,
            slippage_ticks=1.0,
            lines=(ChargeLine(name="fee", base="order", rate=50),),
            source="supplied",
        )

        refused = settings_problem(schedule, declared, Contract())

        self.assertEqual(refused.code, "OS6026")
        self.assertEqual(refused.values["supplied"], 1.0)
        self.assertEqual(refused.values["declared"], 2)


if __name__ == "__main__":
    unittest.main()
