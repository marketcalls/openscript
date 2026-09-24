"""The three objects ``conformance.md`` section 9 says an adapter writes.

    adapter --describe                  the engine's identity
    adapter <case-directory>            one case result
    adapter --actual <case-directory>   the channels the case asserts, no comparison

The third exists so that two engines can be compared with each other rather than
each with an expected file: a case result carries an outcome and a first
difference rather than the values, so two adapters reporting ``pass`` prove only
that both matched a file, which section 10 says is not enough. In that mode this
adapter makes no comparison, reads no tolerance and reports no outcome.

**This engine implements no compiler, and the program arrives compiled.** Section
1 covers it: "An implementation that only has an engine (it reads compiled
programs produced elsewhere) runs the engine half and says so". So the compiled
program is handed to this process, as the canonical text a host sends it in
production, and the invocation that carries it is described in ``__main__.py``.
Two consequences are reported rather than hidden. A case whose assertion is the
compiler's own diagnostics is ``unsupported``, because those diagnostics are not
this engine's to claim. And the text goes in through ``load_text``, so the
canonicity check at the text boundary is exercised on every case rather than
skipped by handing the engine an object.

**The profile claimed is the page's lowest**, and every case this engine cannot
run is named on the case with the ``unsupported`` outcome. Section 8 offers
``engine-only`` for an implementation with no compiler and the runner's own
vocabulary is the profile table, which does not list it, so the identity carries
both: the profile the table names, and the flag that says what section 8 would
have it say. The stage's report records that as a defect of the page rather than
leaving it to be discovered.
"""

import email.parser
import json
import sys
import tomllib
from pathlib import Path
from typing import Any, Callable, Dict, Mapping, Optional

from ..version import FORMAT, LANGUAGE_VERSIONS
from .expectations import expected_channels
from .matching import compare_channels, tolerance_from
from .page import PROFILES
from .reading import read_case
from .running import run_case
from .spellings import Malformed

#: The distribution file beside the package, which states the version once.
_PROJECT = "pyproject.toml"

#: The distribution this engine is, as the build and the installer name it. It is
#: named for its top package, so the name is read from where this module sits
#: rather than written out a second time beside the one in pyproject.toml.
_NAME = __name__.split(".", 1)[0]

#: Section 8: what this implementation claims. The profile that covers the cases
#: it runs, which is the one a case it would report ``unsupported`` is not in.
#:
#: The claim is read against the runner rather than against the table's own
#: sentence, and the two do not say the same thing. Section 8 makes a profile
#: cumulative, so ``strategy`` reads as "everything ``chart`` covers, and orders
#: as well", and this engine draws nothing: a surface case would be answered
#: ``unsupported`` naming the channel. The runner's vocabulary is that table, so
#: the honest alternatives are to claim this and report every channel it cannot
#: answer by name, or to claim ``core`` and have every strategy case skipped,
#: which is a suite that proves nothing about the engine that runs the money.
#: The first is chosen, the shortfall is named on the case rather than in a
#: footnote, and the stage's report records the page's missing profile as a
#: defect of the page.
PROFILE = PROFILES[2]


def _distribution() -> Dict[str, Any]:
    """The engine's name and version, from wherever this copy of it was built.

    The version is a fact of the release, stated once in the distribution file,
    and ``scripts/check-python.mjs`` holds that file and the package manifest
    equal, so nothing read here is a third copy.
    """
    return _identity(Path(__file__).resolve().parent.parent.parent / _PROJECT, _installed)


def _installed(name: str, site: Optional[Path] = None) -> Optional[Mapping[str, str]]:
    """The metadata an installer wrote beside this package, or ``None`` if none did.

    Every installer records a distribution in ``<name>-<version>.dist-info``
    beside the package it installed, and ``METADATA`` there holds the name and
    version the build wrote. It is read directly, with the standard library's
    own header parser, rather than through the import system's metadata finder:
    this project refuses anything that loads modules by a name computed at run
    time, and reading two headers out of one file does not need it.

    Two records beside one package is a broken upgrade, and there is no telling
    which of them describes the files actually installed, so that is refused
    by name rather than resolved by picking one.
    """
    if site is None:
        site = Path(__file__).resolve().parent.parent.parent
    records = sorted(site.glob(f"{name}-*.dist-info/METADATA"))
    if not records:
        return None
    if len(records) > 1:
        raise Malformed(
            f"{len(records)} installed records for {name!r} sit beside this package "
            f"({', '.join(record.parent.name for record in records)}), so its version cannot "
            "be told. Reinstall it so that one remains."
        )
    with records[0].open(encoding="utf-8") as file:
        return email.parser.Parser().parse(file, headersonly=True)


def _identity(
    project_file: Path, installed: Callable[[str], Optional[Mapping[str, str]]]
) -> Dict[str, Any]:
    """Read the identity from ``project_file``, else from the installed distribution.

    **Two places, because a copy of this engine lives in one of two.** A checkout
    has ``pyproject.toml`` beside the package, which is what the conformance suite
    runs. An installed copy does not: the build reads that file and records what
    it says in the distribution's own metadata, and the file itself is never
    installed. This used to read only the first, so ``python -m openscript
    --describe`` failed on every installed copy, 0.5.0 from the index included,
    and no host could run the suite against the engine it had actually installed.

    The installed metadata is not an invented version. It is the one the wheel
    was built with, written by the same build from the same file, and it is what
    the installer, the index and ``pip show`` all report for this copy.

    **A file that names some other project is not this one's.** Beside an
    installed package, the directory above is ``site-packages``, where a stray
    ``pyproject.toml`` from anything else would otherwise be read as this
    engine's identity. The name is checked, and a mismatch falls through.

    Neither available is still a refusal that names both, because an identity
    with a guessed version in it is worse than an adapter saying what it could
    not find.
    """
    reasons = []
    try:
        with project_file.open("rb") as file:
            project = tomllib.load(file)["project"]
        if project.get("name") == _NAME:
            return project
        reasons.append(f"{project_file} names {project.get('name')!r}, not {_NAME!r}")
    except (OSError, KeyError, ValueError) as reason:
        reasons.append(f"{project_file} could not be read: {reason}")

    recorded = installed(_NAME)
    if recorded is not None and recorded.get("Name") and recorded.get("Version"):
        return {"name": recorded["Name"], "version": recorded["Version"]}
    reasons.append(f"no installed distribution named {_NAME!r} was found")

    raise Malformed(
        "section 9 has an adapter answer with the engine's own name and version, and "
        + "; ".join(reasons)
    )


def describe() -> Dict[str, Any]:
    """The identity section 9's table asks for, and the one flag section 8 adds."""
    project = _distribution()
    return {
        "name": project["name"],
        "version": project["version"],
        "profile": PROFILE,
        "languageVersions": list(LANGUAGE_VERSIONS),
        # The compiled program format this engine implements
        # (``compiled-program.md`` section 9). Section 9 of the conformance page
        # names the field and fixes no meaning for it.
        "schemaVersion": FORMAT,
        # Section 8: an implementation that runs compiled programs and implements
        # no compiler reports engine-only, and its report says so.
        "engineOnly": True,
    }


def _program_from(envelope: Any) -> Any:
    """The compiled program the invocation carried, or what it carried instead."""
    if not isinstance(envelope, dict):
        raise Malformed(
            "this adapter is handed the compiled program on standard input, as one JSON object, "
            "and nothing readable arrived"
        )
    held = envelope.get("program")
    if isinstance(held, str):
        return held
    if "diagnostics" in envelope:
        return None
    raise Malformed(
        f"the invocation carried neither a program nor the diagnostics of a compile: "
        f"{sorted(envelope)}"
    )


def answer_for(directory: str, envelope: Any) -> Dict[str, Any]:
    """``--actual``: what this engine computed, and what it could not compute.

    ``{id, channels, unsupported}``, or ``{id, error}`` for a case that cannot be
    run at all. No comparison is made and no tolerance is read.
    """
    try:
        case = read_case(directory)
    except Malformed as reason:
        return {"id": None, "error": str(reason)}
    try:
        program = _program_from(envelope)
        if program is None:
            return {
                "id": case.identity,
                "channels": {},
                "unsupported": [
                    "the compiler (section 1): the case's script did not compile, this engine "
                    "implements none, and a diagnostic another compiler raised is not this "
                    "engine's to assert"
                ],
            }
        found = run_case(case, program)
    except Malformed as reason:
        return {"id": case.identity, "error": str(reason)}
    return {
        "id": case.identity,
        "channels": found.channels,
        "unsupported": found.unsupported,
        "columnTypes": found.column_types,
    }


def result_for(directory: str, envelope: Any) -> Dict[str, Any]:
    """The plain invocation: the answer above, compared with the case's own files.

    One of section 9's outcomes, with the first difference on a failure. A case
    this engine cannot run is ``unsupported`` with the feature named, which
    section 9 says is neither a pass nor a failure and is counted separately.
    """
    try:
        case = read_case(directory)
    except Malformed as reason:
        return {"id": None, "outcome": "error", "reason": str(reason)}
    answer = answer_for(directory, envelope)
    if "error" in answer:
        return {"id": answer["id"], "outcome": "error", "reason": answer["error"]}
    if answer["unsupported"]:
        return {
            "id": answer["id"],
            "outcome": "unsupported",
            "feature": "; ".join(answer["unsupported"]),
        }
    tolerance, refused = tolerance_from(case.declared.get("tolerance"))
    if tolerance is None:
        return {"id": case.identity, "outcome": "error", "reason": f"case.json: {refused}"}
    expected, missing = expected_channels(case, answer["columnTypes"])
    if expected is None:
        return {"id": case.identity, "outcome": "error", "reason": missing}
    compared = compare_channels(case.asserts, answer["channels"], expected, tolerance)
    return {"id": case.identity, **compared}


def read_envelope(text: str) -> Any:
    """The JSON object the invocation carried, or a refusal naming what arrived."""
    try:
        return json.loads(text) if text.strip() != "" else {}
    except ValueError as reason:
        raise Malformed(f"the invocation's standard input is not JSON: {reason}") from None


def stdin_text() -> str:
    """Everything the caller wrote, as text. Empty when nothing was piped in."""
    if sys.stdin is None or sys.stdin.isatty():
        return ""
    return sys.stdin.read()


def invoke(arguments: Any) -> Optional[Dict[str, Any]]:
    """One of the three invocations, to the one object it writes, or nothing.

    Nothing means the argument list is not one of the three, which
    ``__main__.py`` refuses with a non-zero exit: no object it could write would
    be a case result, and section 9 keeps a non-zero exit meaning a crash.
    """
    if list(arguments) == ["--describe"]:
        return describe()
    if len(arguments) == 2 and arguments[0] == "--actual":
        return answer_for(arguments[1], read_envelope(stdin_text()))
    if len(arguments) == 1 and not arguments[0].startswith("--"):
        return result_for(arguments[0], read_envelope(stdin_text()))
    return None
