"""The eleven steps of section 5.1, and the checkpoint that makes a moving bar idempotent.

Everything else in this package is a detail of one of these steps. They run in
this order, on every execution of every bar, and the order is not an
implementation's choice: steps 1 and 2 are what make a still-moving bar
idempotent, and steps 8 and 9 are what separate what a script may do on a moving
bar from what it may not.

**The checkpoint is taken before a bar rather than after one.** Section 6.1
describes it as taken at the end of bar ``i - 1``, and the state at the start of
the first execution of bar ``i`` *is* that state, so taking it there is the same
checkpoint reached by the cheaper road: nothing is copied for a bar that is
executed once, and a re-execution restores what the bar began with. Section 6.2
says outright that an engine may implement a checkpoint however it likes, and
that the specification requires the semantics rather than the representation.

**A live cell is written into the checkpoint and is not rolled back.** That is
the whole of ``live var``, and it has one consequence worth stating rather than
discovering: where a live cell and an ordinary cell held the same array, the
restore gives the ordinary cell the copy it recorded and leaves the live cell
holding what it has now, so the two stop being the same array. That follows from
the exception rather than from this implementation of it, and a script using
``live var`` is not reproducible by design.

**An error during step 6 stops the bar.** Steps 7 to 11 do not run, the bar's
columns keep whatever the previous execution published or stay absent, and the
engine reports the diagnostic. It does not carry a half executed state into the
next bar.
"""

import copy
import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

from .bars import BarFacts, bar_field, facts_for
from .budget import Budget, DEFAULT_LIMITS, EngineLimits, step_bound
from .canonical import parse
from .contracts import Bar, BarState, CallContext, Library, NoLibrary
from .diagnostics import Diagnostic, ScriptError, failure
from .inputs import ResolvedInput, TimeReader, field_value, resolve_inputs
from .machine import Machine, PendingEffect
from .memory import Cells, Channels, Register, States
from .objects import Grid, Objects
from .program import LoadedProgram, loaded
from .request_plan import Plan, Provider, plan_requests
from .requests import RequestParts, RequestSet
from .values import ABSENT
from .verify import MACHINE_CAPABILITIES, REQ_SYMBOL, VerifyOptions, verify


@dataclass
class Checkpoint:
    """What section 6.1 holds, in the one form a mechanical copy can restore."""

    kept: Tuple[Any, Any, Any]
    lengths: Sequence[int]
    bar: int
    #: The drawing roster as it stood (``objects.py``), restored beside the cells.
    objects: Any = None
    #: Where each read's fold stood (``requests.py``), restored beside them too.
    requests: Any = None


@dataclass
class Alert:
    """What a raised alert carries, section 5.4, and nothing else.

    Fixed there rather than left to a host, because a host cannot compose a
    notification out of fields that differ between engines. The message is
    whatever the channel held, absence included: one built out of a value that
    was absent during warmup is absent, and an engine that substituted an empty
    string would hide the one thing the author needs to see.
    """

    key: str
    title: Any
    message: Any
    bar: int
    time: Any


@dataclass
class BarResult:
    """What one execution of one bar produced."""

    index: int
    columns: List[Any] = field(default_factory=list)
    #: The deferred channels step 9 applied, by index, and empty where it
    #: discarded them. The columns carry every channel either way: step 8
    #: publishes the drawing and step 9 decides the marker and the alert, which
    #: is the whole difference between what a script may do on a moving bar and
    #: what it may not.
    applied_channels: List[int] = field(default_factory=list)
    applied: List[PendingEffect] = field(default_factory=list)
    alerts: List[Alert] = field(default_factory=list)
    diagnostic: Optional[Diagnostic] = None

    @property
    def ok(self) -> bool:
        return self.diagnostic is None


class Run:
    """One program, loaded, with the memory a run of it holds."""

    def __init__(
        self,
        program: LoadedProgram,
        inputs: Sequence[ResolvedInput],
        library: Library,
        limits: EngineLimits = DEFAULT_LIMITS,
        plans: Sequence[Plan] = (),
        provider: Optional[Provider] = None,
    ) -> None:
        self.program = program
        self.inputs = inputs
        self.limits = limits
        self.plans = tuple(plans)
        raw = program.raw
        self.cells = Cells(len(raw["cells"]))
        self.states = States(len(raw["states"]))
        self.registers = [Register() for _ in raw["series"]]
        self.channels = Channels(len(raw["channels"]))
        self.budget = Budget(step_bound(raw), program.loop_budget, limits.string_length)
        self.machine = Machine(
            program, self.cells, self.states, self.registers, self.channels, self.budget, library
        )
        self.objects = Objects(limits.drawing_objects, self._grids(raw))
        parts = RequestParts(program, {one.query.id: one for one in plans}, provider, limits, library, inputs)
        self.requests = RequestSet(parts, raw["requests"])
        #: The bars this run has been handed, which a read of the chart's own
        #: instrument folds. Held only by a run that makes a read.
        self._known: List[Any] = []
        self._live = [at for at, one in enumerate(raw["cells"]) if one["kind"] == "live"]
        self._columns: Dict[int, List[Any]] = {}
        self._checkpoint: Optional[Checkpoint] = None
        self._fired_ever: set = set()
        self._fired_on: Dict[str, int] = {}
        self._supplied = 0
        #: The time each of the last two bars was handed over with, by index,
        #: which is all the order rule of ``host-interface.md`` 3.2 compares.
        self._times: Dict[int, float] = {}

    # -- the declared shape, with every input reference resolved ------------

    def declaration(self, path: Sequence[str]) -> Any:
        """A declaration field, with its input reference substituted, section 2.3."""
        held: Any = self.program.raw
        for step in path:
            held = held[step]
        return field_value(held, self.inputs)

    # -- the checkpoint -----------------------------------------------------

    def checkpoint(self, bar: int = -1) -> Checkpoint:
        """Every cell with its flag, every state region, and the heap under both.

        One mechanical copy over the three together, so that two cells holding
        one array still hold one array after a restore: a copy taken cell by cell
        would turn one array into two and change what the script computes.

        ``bar`` is the bar this state is the start of, which is what makes a
        re-execution recognisable; a caller keeping one for its own reasons, a
        debugger stepping backwards, leaves it alone.
        """
        kept = copy.deepcopy((self.cells.values, self.cells.ready, self.states.regions))
        lengths = [one.length for one in self.registers]
        return Checkpoint(kept, lengths, bar, self.objects.mark(), self.requests.mark())

    def restore(self, mark: Checkpoint) -> None:
        """Section 6.3: everything goes back, except that live cells keep theirs."""
        was = [self.cells.values[at] for at in self._live]
        ready = [self.cells.ready[at] for at in self._live]
        values, flags, regions = copy.deepcopy(mark.kept)
        self.cells.values[:] = values
        self.cells.ready[:] = flags
        self.states.regions = regions
        for at, value, flag in zip(self._live, was, ready):
            self.cells.values[at] = value
            self.cells.ready[at] = flag
        for register, length in zip(self.registers, mark.lengths):
            register.truncate(length)
        if mark.objects is not None:
            self.objects.restore(mark.objects)
        if mark.requests is not None:
            self.requests.restore(mark.requests, self._known)

    def history(self, bars: Sequence[Bar]) -> None:
        """The whole dataset, handed to the fold before bar 0 of a run over it.

        Nothing about a confirmed or a developing read changes, because both
        stop at the bar being executed. A ``"lookahead"`` read is the one that
        differs, and the difference is the mode: over settled history it reads
        the bucket a bar is inside in full, which a live feed cannot supply
        (`compiled-program.md` 2.16.2). Each bar still executes when it is
        handed over, and its first execution leaves what is held here as it
        was; a revision of it, executed again, replaces it.
        """
        if self._checkpoint is None and not self.requests.empty:
            self._known = list(bars)

    # -- the bar ------------------------------------------------------------

    def execute_bar(
        self,
        index: int,
        bar: Bar,
        state: BarState = BarState(),
        supplied: Optional[int] = None,
        instrument: Optional[Mapping[str, Any]] = None,
        now: Any = ABSENT,
    ) -> BarResult:
        """The eleven steps, in order, for one execution of bar ``index``."""
        refused = self._hand_over(index, bar)
        if refused is not None:
            return BarResult(index, self._columns.get(index, []), [], [], [], refused)
        held = index + 1 if supplied is None else supplied
        self._supplied = held
        again = self._checkpoint is not None and self._checkpoint.bar == index
        self._hold(index, bar, again)

        # Step 1. On the first execution of this bar the state already is the
        # checkpoint, so nothing is copied; it is recorded instead, because the
        # next execution of the same bar is what needs it.
        if again:
            self.restore(self._checkpoint)
        else:
            self._checkpoint = self.checkpoint(index)

        # Step 2.
        for register in self.registers:
            register.truncate(index)

        # Step 3.
        self.channels.clear()
        self.objects.clear_grids()
        for register in self.registers:
            register.current = ABSENT
        context = CallContext(
            bar_index=index,
            instrument={} if instrument is None else instrument,
            now=now,
            objects=self.objects,
            requests=self.requests,
        )
        self.machine.begin(index, context)

        # Step 4, the reads' registers included: a body that fails stops the bar.
        facts = facts_for(index, held, state)
        self._fill_registers(bar, facts)
        try:
            if not self.requests.empty:
                self.requests.fill(self.registers, self._known, index, context)
        except ScriptError as stopped:
            return BarResult(index, self._columns.get(index, []), [], [], [], stopped.diagnostic)

        # Step 5.
        self._fill_inputs()

        # Step 6.
        try:
            self.machine.execute()
        except ScriptError as stopped:
            return BarResult(index, self._columns.get(index, []), [], [], [], stopped.diagnostic)

        # Step 7.
        for register in self.registers:
            register.close()

        # Step 8.
        columns = list(self.channels.values)
        self._columns[index] = columns

        # Step 9.
        decided = state.is_confirmed or self.program.on_unconfirmed
        applied: List[PendingEffect] = []
        alerts: List[Alert] = []
        channels: List[int] = []
        if decided:
            applied = list(self.machine.pending)
            channels = [at for at, held in enumerate(self.program.defer) if held]
            alerts = self._raise_alerts(index, bar, state)

        # Step 10.
        retained = self.program.retained
        if retained is not None:
            for register in self.registers:
                register.trim(retained)

        # Step 11 is the record taken at the top of the next bar: see the note
        # at the head of this module.
        return BarResult(index, columns, channels, applied, alerts, None)

    def _hand_over(self, index: int, bar: Bar) -> Optional[Diagnostic]:
        """``host-interface.md`` 3.5: a bar with no time, and one out of order.

        Checked as the bar is handed over and before any step runs, so a refused
        bar leaves nothing behind it. A bar dated nothing is OS6025 rather than
        OS6011, because it is a bar of the wrong shape and not two instants in
        the wrong order; a bar whose time does not follow the one before it is
        OS6011, naming the first such bar. A revision of the newest bar is held
        to the same rule against the bar before it.
        """
        time = bar.time
        if isinstance(time, bool) or not isinstance(time, (int, float)) or not math.isfinite(time):
            return failure("OS6025", index=index)
        before = self._times.get(index - 1)
        if before is not None and not time > before:
            return failure("OS6011", index=index, time=time, previous=index - 1)
        self._times[index] = time
        self._times.pop(index - 2, None)
        return None

    def _hold(self, index: int, bar: Bar, again: bool) -> None:
        """The bar the fold reads at ``index``: a revision replaces it, a first execution adds it."""
        if self.requests.empty:
            return
        while len(self._known) < index:
            self._known.append(None)
        if index == len(self._known):
            self._known.append(bar)
        elif again:
            self._known[index] = bar

    def _fill_registers(self, bar: Bar, facts: BarFacts) -> None:
        for at, declared in enumerate(self.program.raw["series"]):
            if declared["kind"] == "bar":
                self.registers[at].current = bar_field(declared["field"], bar, facts)

    def _fill_inputs(self) -> None:
        """Step 5: the effective values, already resolved, written into slots.

        A ``"source"`` input is the one that reads something here: its value is
        the register it named, for the bar about to run, rather than a value
        settled at load.
        """
        for slot, grid in self.objects.grids:
            self.machine.write_slot(slot, grid)
        for one in self.inputs:
            if one.field is None:
                self.machine.write_slot(one.slot, one.value)
                continue
            self.machine.write_slot(one.slot, self._register_named(one.field))

    def _grids(self, raw: Dict[str, Any]) -> List[Tuple[int, Grid]]:
        """Each declared grid with its slot, its shape settled before bar 0 (section 2.8)."""
        grids = []
        for one in raw["outputs"]["tables"]:
            rows = field_value(one["rows"], self.inputs)
            cols = field_value(one["cols"], self.inputs)
            shape = [int(value) if isinstance(value, (int, float)) else 0 for value in (rows, cols)]
            grids.append((one["slot"], Grid(one["key"], one["title"], shape[0], shape[1])))
        return grids

    def _register_named(self, field: str) -> Any:
        for at, declared in enumerate(self.program.raw["series"]):
            if declared["kind"] == "bar" and declared["field"] == field:
                return self.registers[at].current
        return ABSENT

    def _raise_alerts(self, index: int, bar: Bar, state: BarState) -> List[Alert]:
        """Section 5.4: on a bar this engine decided and the host is driving live.

        Deferral covers half of when an alert fires. The other half is that
        adding a study to a chart that already holds history fires nothing for
        those bars, and the fact that separates a bar of history from the bar in
        front of you is ``isRealtime``, which the host states and no engine can
        derive. An engine that only backtests is handed it false throughout and
        raises none, which is the same answer reached from the other side.
        """
        if not state.is_realtime:
            return []
        raised: List[Alert] = []
        for declared in self.program.raw["outputs"]["alerts"]:
            if self.channels.read(declared["condChannel"]) is not True:
                continue
            key = declared["key"]
            frequency = field_value(declared["frequency"], self.inputs)
            if frequency == "once" and key in self._fired_ever:
                continue
            if frequency == "oncePerBar" and self._fired_on.get(key) == index:
                continue
            message = ABSENT
            if declared.get("messageChannel") is not None:
                message = self.channels.read(declared["messageChannel"])
            raised.append(
                Alert(
                    key=key,
                    title=field_value(declared["title"], self.inputs),
                    message=message,
                    bar=index,
                    time=bar.time,
                )
            )
            self._fired_ever.add(key)
            self._fired_on[key] = index
        return raised


@dataclass
class LoadResult:
    run: Optional[Run] = None
    diagnostic: Optional[Diagnostic] = None

    @property
    def ok(self) -> bool:
        return self.diagnostic is None


def load(
    raw: Any,
    settings: Optional[Mapping[str, Any]] = None,
    library: Optional[Library] = None,
    limits: EngineLimits = DEFAULT_LIMITS,
    capabilities: Sequence[str] = MACHINE_CAPABILITIES,
    read_time: Optional[TimeReader] = None,
    instrument: Optional[Mapping[str, Any]] = None,
    provider: Optional[Provider] = None,
) -> LoadResult:
    """Steps 2 to 8 of section 9.4, then check 10's value half, then the reads, then a run.

    An object built in the same process enters here: it was never text and has
    nothing to be canonical about, which is section 9.4 step 1's other half and
    the minute that settled it.

    ``instrument`` is the record the reads are planned against: the chart's
    interval they are compared with, the zone a calendar read is dated in and
    the identity a read of the chart's own instrument names. ``provider``
    answers a read of another instrument, and a run given one serves the
    ``req.symbol`` tag, which is the only way it does: a read of bars the run
    does not hold, with nobody to ask for them, is refused at load naming the
    tag rather than drawn as an empty line.
    """
    served = library if library is not None else NoLibrary()
    tags = tuple(capabilities) + ((REQ_SYMBOL,) if provider is not None else ())
    checked = verify(raw, VerifyOptions(capabilities=tags, limits=limits, library=served))
    if not checked.ok:
        return LoadResult(None, checked.diagnostic)
    resolved = resolve_inputs(checked.program, {} if settings is None else settings, read_time)
    if not resolved.ok:
        return LoadResult(None, resolved.diagnostic)
    record = {} if instrument is None else instrument
    plans, refused = plan_requests(checked.program["requests"], resolved.inputs, record, provider is not None)
    if refused is not None:
        return LoadResult(None, refused)
    entries = _entries_for(checked.program, served)
    program = loaded(checked.program, entries)
    return LoadResult(Run(program, resolved.inputs, served, limits, plans, provider), None)


def load_text(
    text: str,
    settings: Optional[Mapping[str, Any]] = None,
    library: Optional[Library] = None,
    limits: EngineLimits = DEFAULT_LIMITS,
    capabilities: Sequence[str] = MACHINE_CAPABILITIES,
    read_time: Optional[TimeReader] = None,
    instrument: Optional[Mapping[str, Any]] = None,
    provider: Optional[Provider] = None,
) -> LoadResult:
    """The text boundary: step 1 of section 9.4, then everything ``load`` does.

    Text an engine reads from outside its process arrives as the canonical
    encoding and its hash was taken over those bytes, so text that parses to a
    program but is spelled some other way is text that hash does not name.
    """
    parsed, refusal = parse(text)
    if refusal is not None:
        return LoadResult(None, refusal)
    return load(parsed, settings, library, limits, capabilities, read_time, instrument, provider)


def _entries_for(raw: Any, library: Library) -> List[Any]:
    """The manifest entry for each function the program calls, in its own order.

    Verification has already held every one of them to this engine's manifest, so
    reading them here is reading facts that agree rather than trusting the
    program's copy.
    """
    return [library.entry(one["name"], one["arity"]) for one in raw["lib"]["functions"]]
