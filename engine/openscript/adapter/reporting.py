"""What a strategy case's report was folded under, out of the case's own files.

``conformance.md`` section 3 splits the facts across three files and says why:
``instrument.json`` is what the engine read about the instrument,
``settings.json`` is what the script's inputs were set to, and ``backtest.json``
is "the rest of what the host decided, the part the money and the report depend
on". The declaration is the script's own and arrives in the compiled program's
meta. Nothing here is a default: a digit count nobody stated is a figure two
engines round differently, and this module would rather refuse than choose one.

**The window is compared against the bars' own times and never against a
calendar.** Both bounds are inclusive, and a bar outside them executes and is not
reported: its orders are real and a position opened on it is carried into the
window. That is section 3's paragraph, and a mark carries the answer per bar so
that the fold reads it rather than recomputing it.
"""

from typing import Any, Dict, Optional, Sequence

from ..accounting import (
    BarMark,
    ChargeLine,
    ChargeSchedule,
    Contract,
    schedule_from_declaration,
    schedule_problem,
)
from ..diagnostics import Diagnostic, failure
from .reading import Bar, Case
from .spellings import Malformed

#: Section 3: the file a strategy case is required to carry, and what it holds.
BACKTEST = "backtest.json"

#: What a schedule the host stated is marked with, which is the one of the two
#: sources that cannot stand beside a commission the declaration states.
SUPPLIED = "supplied"


def backtest_of(case: Case) -> Dict[str, Any]:
    """``backtest.json``, or the refusal section 3 promises a case without one.

    Read rather than assumed, and refused rather than defaulted: this engine once
    could not run a strategy case at all, and the first one that ran under a
    digit count nobody stated would have agreed with the engine next door by
    coincidence.
    """
    if case.backtest is None:
        raise Malformed(
            f"{BACKTEST} is missing, and section 3 requires it of a strategy case: a digit count "
            "nobody stated is a figure two engines round differently, so the case is not run "
            "under a default"
        )
    return case.backtest


def contract_for(case: Case) -> Contract:
    """The instrument facts a run was carried out under, plus the run's own digits.

    Two files and no default, which is why section 3 puts the record in one and
    the digit count in the other: ``host-interface.md`` 4.1 defines the record as
    twelve facts and a rounding count is not among them.
    """
    instrument = case.instrument
    return Contract(
        currency=instrument.get("currency", ""),
        symbol=instrument.get("symbol"),
        exchange=instrument.get("exchange"),
        tick_size=instrument.get("tickSize"),
        lot_size=instrument.get("lotSize"),
        point_value=instrument.get("pointValue", 1.0),
        digits=backtest_of(case)["digits"],
    )


def line_of(stated: Dict[str, Any]) -> ChargeLine:
    """One line of a supplied schedule, as the host stated it.

    `conformance.md` section 3 says `costs` is the schedule the host supplied
    "whole and as the host stated it", and whole is the word that matters: the
    lines ARE the schedule. Dropping them leaves a currency and a digit count
    charging nothing, which is not a cheaper run, it is a different one, and it
    is wrong in the direction nobody checks because it flatters the strategy.

    Read by name and not by position, and the optional bounds stay absent when
    the host stated none: a floor of zero and no floor are different rules, and
    a line that invented one would charge a fill the host meant to leave alone.
    """
    return ChargeLine(
        name=stated["name"],
        base=stated["base"],
        side=stated.get("side", "both"),
        rate=stated.get("rate", 0.0),
        min=stated.get("min"),
        max=stated.get("max"),
        of=tuple(stated.get("of", ())),
    )


def schedule_lines(supplied: Dict[str, Any]) -> tuple:
    """Every line of a supplied schedule, in the order the host stated them.

    Order is part of the result: a charge whose base is `charges` is a fraction
    of the lines named before it, so reordering them changes the money.
    """
    return tuple(line_of(one) for one in supplied.get("lines", ()))


def schedule_for(case: Case, declared: Dict[str, Any]) -> Optional[ChargeSchedule]:
    """The charge schedule the run was carried out under.

    The host's where it supplied one, and otherwise the declaration's own
    commission and slippage, which an engine derives from the script the same
    way. A supplied schedule's currency and digit count are the contract's,
    because a run under a schedule that disagrees with its contract is refused
    before its first bar, so the two cannot differ inside one case.
    """
    supplied = backtest_of(case)["costs"]
    contract = contract_for(case)
    if supplied is not None:
        return ChargeSchedule(
            currency=supplied["currency"],
            digits=supplied["digits"],
            slippage_ticks=supplied.get("slippageTicks", 0.0),
            lines=schedule_lines(supplied),
            source=SUPPLIED,
        )
    return schedule_from_declaration(
        declared["commission"],
        declared["commissionType"],
        declared["slippage"],
        contract.currency,
        contract.digits,
    )


def settings_problem(
    schedule: Optional[ChargeSchedule], declared: Dict[str, Any], contract: Contract
) -> Optional[Diagnostic]:
    """What this run cannot be carried out under, asked before its first bar.

    Four questions, in this order, and each of them is a figure nobody could
    explain afterwards rather than a tidiness rule.

    **Two cost models at once, OS6023.** The declaration's commission is the
    script's own statement of what trading costs and a supplied schedule is the
    platform's, and the two describe the same money. Applied together they charge
    it twice; applied one at a time they charge whichever an engine happened to
    prefer, which is a rule nobody wrote down and a figure nobody can explain
    afterwards. So exactly one of the two is stated for a run, and stating both
    is refused here rather than reconciled behind the reader. Asked first,
    because a schedule that is also unusable in some second way would otherwise
    be reported as that, and the reader would correct the wrong half.

    **Two slippages at once, OS6026.** A backtest worsens a fill by the
    schedule's slippage where a schedule is supplied, so a declared slippage that
    differs from it was dropped with nothing said. Asked after OS6023, because a
    run stating both a commission and a slippage beside a schedule is first of
    all two cost models.

    **A schedule that cannot be evaluated, OS6021**, which ``schedule_problem``
    decides, because the schedule is the money layer's and the rule for it is
    written once, there. Whichever schedule the run will be charged under, the
    declaration's own included: asking only about a supplied one would leave
    every refusal in the money layer unreachable on the path almost every run
    takes.

    **A quantity in a unit this destination cannot fill, OS6021.** A backtest
    fills in units. A quantity in lots converts when the instrument states a lot
    size and cannot when it does not, and a quantity in any other unit would have
    to be sized against a running equity a backtest works out nothing of. Refused
    rather than guessed, because a guess here is a position size.

    The first engine asks a fourth question here, about the comparison
    tolerance. This engine asks it in ``matching.tolerance_from``, where the
    tolerance is read, and asks it more strictly: a bound with no reason, a bound
    below zero, and a bound past section 6's cap. Asking again here would be the
    same rule in two places, and the two would drift.

    Nothing has been computed when this is asked, so a refusal costs one run
    rather than a report a reader has to be told to distrust.
    """
    # A run with no schedule at all still has a quantity to fill, so the sizing
    # question is asked whatever the cost model is. Returning here when there was
    # no schedule is how the check came to be skipped on the path most runs take.
    if schedule is None:
        return _sizing_problem(declared, contract)
    if schedule.source == SUPPLIED and declared["commission"] != 0:
        return failure(
            "OS6023",
            commission=declared["commission"],
            commissionType=declared["commissionType"],
        )
    # The venue worsens a fill by the schedule's slippage where one is supplied,
    # so a declared slippage that differs from it would simply not happen. The
    # same figure in both is one statement, and a declaration stating none leaves
    # the schedule's to stand.
    stated = declared.get("slippage", 0)
    if schedule.source == SUPPLIED and stated != 0 and schedule.slippage_ticks != stated:
        return failure("OS6026", supplied=schedule.slippage_ticks, declared=stated)
    problem = schedule_problem(schedule, contract)
    if problem is not None:
        setting, reason = problem
        return failure("OS6021", setting=setting, problem=reason)
    return _sizing_problem(declared, contract)


def _sizing_problem(declared: Dict[str, Any], contract: Contract) -> Optional[Diagnostic]:
    """A quantity in a unit this destination cannot fill.

    A backtest fills in units. Lots convert when the instrument states a lot
    size; without one there is nothing to convert a lot into. Any other unit
    would have to be sized against a running equity a backtest works out none
    of. Both are refused rather than guessed, because the guess is a position
    size and nobody could explain the figure afterwards.
    """
    # No strategy test: this is reached only on the trading path, where the
    # declaration was read, and a study has no declaration to read.
    stated = declared.get("qtyType", "")
    if stated in ("units", ""):
        return None
    if stated == "lots":
        lot = contract.lot_size
        if lot is not None and lot > 0:
            return None
        return failure(
            "OS6021",
            setting="A quantity stated in lots",
            problem="this instrument states no lot size, so there is nothing to convert a lot into",
        )
    return failure(
        "OS6021",
        setting="A quantity stated in " + stated,
        problem=(
            "a backtest fills in units and works out no running equity to size against, so it "
            "cannot convert one. State the quantity in units or in lots"
        ),
    )


def marks_for(case: Case, bars: Sequence[Bar]) -> tuple:
    """One mark per bar supplied, warmup included, with the window's own answer."""
    window = backtest_of(case)["range"]
    lower = window["from"]
    upper = window["to"]

    def inside(bar: Bar) -> bool:
        if lower is not None and bar.time < lower:
            return False
        if upper is not None and bar.time > upper:
            return False
        return True

    return tuple(
        BarMark(bar_index=at, time=float(bar.time), close=bar.close, in_report=inside(bar))
        for at, bar in enumerate(bars)
    )
