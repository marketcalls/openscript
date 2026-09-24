"""What a release of the Python engine must be, checked before and after it goes out.

Two commands, one on each side of the upload::

    python engine/tools/check_release.py dist <dist-dir> --tag v0.6.0
    python engine/tools/check_release.py installed --tag v0.6.0 \\
        --program <probe.program.json> --describe-output <describe.json>

``dist`` reads the built distributions without installing anything. ``installed``
runs inside an interpreter the distribution was installed into, and uses the
engine the way a host does. ``.github/workflows/release-pypi.yml`` runs both, and
a maintainer can run them against a local build before dispatching anything.

**Why this is a file and not a step in the workflow.** An upload to the Python
package index cannot be undone: a deleted release does not free its version, so
the number is spent whatever happens next. A program handed to an interpreter on
a command line is the one part of a build nothing here can read or lint, which is
the wrong place for the checks standing in front of a permanent step.

**What it does not do, because this project refuses it.** It starts no process
and loads no module by a computed name, so it cannot walk the installed package
importing every module, and it cannot launch ``python -m openscript`` itself. The
workflow launches the command line as a host would and hands this the output.
Completeness is checked where it can be proved without either: ``dist`` compares
every module file in the wheel against the source tree.

**Standard library only.** ``scripts/check-python.mjs`` holds every file under
``engine/`` to it, and a release check that needed a download to run would be
the first thing in this directory a host could not run.
"""

import argparse
import json
import pathlib
import re
import sys
import sysconfig
import tarfile
import tomllib
import zipfile

ENGINE = pathlib.Path(__file__).resolve().parent.parent
REPOSITORY = ENGINE.parent

#: What the release probe must plot on each bar. The probe's source is in
#: ``scripts/release-python-probe.mjs``; its closes are chosen so that every
#: answer is exact in binary64, which is what lets these be compared with
#: equality. ``None`` is the engine's absent value: a three bar mean has nothing
#: to say on the first two bars, and zero there would be a wrong number.
CLOSES = (10.0, 12.0, 14.0, 16.0, 18.0)
EXPECTED = (
    (21.0, None),
    (25.0, None),
    (29.0, 12.0),
    (33.0, 14.0),
    (37.0, 16.0),
)

#: The prerelease spellings npm and the Python index both understand, and how
#: the index writes each one. A version outside this set is refused rather than
#: guessed at: one the index cannot normalise fails its upload after the npm half
#: may already have gone out, and one it normalises unexpectedly is a version
#: nobody chose.
PRERELEASE = re.compile(
    r"^(?P<base>\d+\.\d+\.\d+)-(?P<label>alpha|a|beta|b|rc|c|pre|preview)\.?(?P<number>\d+)$"
)
PRERELEASE_LABEL = {
    "alpha": "a",
    "a": "a",
    "beta": "b",
    "b": "b",
    "rc": "rc",
    "c": "rc",
    "pre": "rc",
    "preview": "rc",
}
STABLE = re.compile(r"^\d+\.\d+\.\d+$")


class ReleaseRefused(Exception):
    """A reason this build must not be published, written for whoever dispatched it."""


def project() -> dict:
    """``[project]`` from ``engine/pyproject.toml``, the one place its facts are written."""
    with open(ENGINE / "pyproject.toml", "rb") as handle:
        return tomllib.load(handle)["project"]


def index_version(declared: str) -> str:
    """The version as the Python package index will spell it.

    The two packages carry one version, written the npm way in both manifests.
    A stable version is spelled the same everywhere. A prerelease is not: npm's
    ``0.7.0-rc.1`` is the index's ``0.7.0rc1``, and the index never installs a
    prerelease unless asked, which is the guarantee the npm workflow gets by
    publishing a prerelease under its own tag instead of ``latest``.
    """
    if STABLE.match(declared):
        return declared
    found = PRERELEASE.match(declared)
    if found is None:
        raise ReleaseRefused(
            f"The version {declared!r} has no spelling on the Python package index that this "
            "release knows is safe. Use a stable version, or a prerelease labelled alpha, beta "
            "or rc with a number, such as 0.7.0-rc.1."
        )
    return f"{found['base']}{PRERELEASE_LABEL[found['label']]}{found['number']}"


def release_version(tag: str) -> str:
    """The tag names the version both manifests declare, spelled for the index.

    ``scripts/check-python.mjs`` already holds the two manifests equal on every
    build. It is checked again here because this stands in front of the upload,
    and a release should not depend on another script's scope to be safe.
    """
    python = project()["version"]
    with open(REPOSITORY / "package.json", encoding="utf-8") as handle:
        javascript = json.load(handle)["version"]
    if python != javascript:
        raise ReleaseRefused(
            f"engine/pyproject.toml says {python} and package.json says {javascript}. The two "
            "packages are one release and must carry one version."
        )
    if tag != f"v{python}":
        raise ReleaseRefused(
            f"The tag {tag!r} does not name version {python}. Dispatch v{python}, or bump both "
            "manifests first."
        )
    return index_version(python)


def headers(text: str) -> dict:
    """The header fields of a METADATA or PKG-INFO file, each name to its values."""
    fields: dict = {}
    for line in text.split("\n\n", 1)[0].splitlines():
        if ": " in line:
            key, value = line.split(": ", 1)
            fields.setdefault(key, []).append(value)
    return fields


# ---------------------------------------------------------------------------
# dist: the built files, read without installing them
# ---------------------------------------------------------------------------


def check_dist(dist: pathlib.Path, tag: str) -> None:
    version = release_version(tag)
    declared = project()
    name = declared["name"]
    wheel_name = f"{name}-{version}-py3-none-any.whl"
    sdist_name = f"{name}-{version}.tar.gz"

    # Exactly the two files and nothing else. The publishing step uploads every
    # file in this directory, so a stray build of another version here is a
    # second release nobody meant to make.
    files = sorted(path.name for path in dist.iterdir() if path.is_file())
    if files != sorted([wheel_name, sdist_name]):
        raise ReleaseRefused(
            f"{dist} should hold exactly {wheel_name} and {sdist_name}, and holds: "
            f"{', '.join(files) or 'nothing'}."
        )

    info = f"{name}-{version}.dist-info"
    with zipfile.ZipFile(dist / wheel_name) as wheel:
        names = set(wheel.namelist())
        metadata = headers(wheel.read(f"{info}/METADATA").decode("utf-8"))
    check_metadata(metadata, name, version, declared["requires-python"], wheel_name)

    # Every module the source tree has is in the wheel. The package list in
    # pyproject.toml is written by hand, and it once named only the top package,
    # so the distribution shipped the machine and none of the halves it calls:
    # `import openscript` worked and nothing a host needed did. Comparing module
    # files rather than packages also catches a module left out of a package
    # that is present.
    root = ENGINE / name
    source = {
        path.relative_to(ENGINE).as_posix()
        for path in root.rglob("*.py")
        if "__pycache__" not in path.parts
    }
    shipped = {entry for entry in names if entry.startswith(f"{name}/")}
    missing = sorted(source - shipped)
    if missing:
        raise ReleaseRefused(
            f"The wheel is missing {len(missing)} module(s) the source has: "
            f"{', '.join(missing[:8])}. Check [tool.setuptools] packages in engine/pyproject.toml."
        )

    # Nothing beside the package and its record. A wheel that carries the tests,
    # the tools or a stray top level module installs them into every host's
    # site-packages, where they can shadow a host's own modules.
    unexpected = sorted({entry.split("/", 1)[0] for entry in names} - {name, info})
    if unexpected:
        raise ReleaseRefused(f"The wheel installs more than the engine: {', '.join(unexpected)}.")

    stem = f"{name}-{version}"
    with tarfile.open(dist / sdist_name) as sdist:
        members = {member.name for member in sdist.getmembers()}
        pkg_info = sdist.extractfile(f"{stem}/PKG-INFO")
        sdist_metadata = headers(pkg_info.read().decode("utf-8")) if pkg_info else {}
    for needed in ("pyproject.toml", "README.md", "PKG-INFO"):
        if f"{stem}/{needed}" not in members:
            raise ReleaseRefused(f"The source distribution has no {needed}.")
    check_metadata(sdist_metadata, name, version, declared["requires-python"], sdist_name)

    print(f"dist: {wheel_name} and {sdist_name}")
    print(f"      {len(shipped)} files under {name}/, every one of the {len(source)} source modules")
    print(f"      version {version}, no runtime dependencies, nothing installed beside the engine")


def check_metadata(fields: dict, name: str, version: str, floor: str, where: str) -> None:
    """The fields a host and the index read, as this release means them."""

    def one(key: str) -> str:
        values = fields.get(key, [])
        return values[0] if values else ""

    if one("Name") != name:
        raise ReleaseRefused(f"{where} is named {one('Name')!r}, not {name!r}.")
    if one("Version") != version:
        raise ReleaseRefused(f"{where} says version {one('Version')!r}, not {version!r}.")
    # Empty, and it stays empty: pyproject.toml's own comment says why. A
    # distribution declaring a dependency makes every host download and trust
    # it, and that is decided in review, not discovered in a release.
    if fields.get("Requires-Dist"):
        raise ReleaseRefused(
            f"{where} declares runtime dependencies: {', '.join(fields['Requires-Dist'])}."
        )
    if one("Requires-Python") != floor:
        raise ReleaseRefused(
            f"{where} requires Python {one('Requires-Python')!r}, and pyproject.toml says {floor!r}."
        )


# ---------------------------------------------------------------------------
# installed: the engine as a host gets it
# ---------------------------------------------------------------------------


def check_installed(tag: str, program: pathlib.Path, described: pathlib.Path) -> None:
    # From the tag rather than the manifests alone: this also runs against the
    # engine installed from the index, where the question is whether the index
    # served the version that was dispatched.
    version = release_version(tag)

    try:
        import openscript
        from openscript.adapter.answers import describe, invoke
        from openscript.adapter.spellings import Malformed
    except ImportError as reason:
        raise ReleaseRefused(
            f"This interpreter ({sys.executable}) has no importable engine: {reason}. Install "
            "the distribution into it first, then run this with that interpreter."
        ) from None

    # **Installed, not the source tree.** An import that resolves to this
    # repository proves nothing about the distribution, and it is the easy
    # mistake: the tree has every directory whether or not the wheel carries
    # them. It happened once already, with a probe interpreter that had no
    # installer, so the "installed" engine was the checkout.
    module = pathlib.Path(openscript.__file__).resolve()
    purelib = pathlib.Path(sysconfig.get_paths()["purelib"]).resolve()
    if not module.is_relative_to(purelib) or module.is_relative_to(ENGINE):
        raise ReleaseRefused(
            f"openscript was imported from {module.parent}, not from this interpreter's "
            f"site-packages ({purelib}). Run this with the interpreter the distribution was "
            "installed into, from a directory outside the repository."
        )

    # The identity a host's conformance runner asks for. Through 0.5.0 it could
    # only be read from pyproject.toml, which is never installed, so every
    # installed copy refused `--describe`. It must now come from the record the
    # installer wrote, and name exactly this release.
    try:
        identity = describe()
    except Malformed as reason:
        raise ReleaseRefused(f"The installed engine cannot say what it is: {reason}") from None
    if identity.get("name") != project()["name"] or identity.get("version") != version:
        raise ReleaseRefused(
            f"The installed engine describes itself as {identity.get('name')} "
            f"{identity.get('version')}, and this release is {project()['name']} {version}."
        )

    # And the command line, launched by the workflow the way an adapter starts
    # the engine: `python -P -m openscript --describe` from an empty directory.
    # The answer it wrote must be the same identity, as one JSON object.
    try:
        answered = json.loads(described.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as reason:
        raise ReleaseRefused(
            f"python -m openscript --describe did not leave one JSON object in {described}: "
            f"{reason}"
        ) from None
    if answered != invoke(["--describe"]):
        raise ReleaseRefused(
            f"python -m openscript --describe answered {answered}, which is not the identity "
            "the installed package reports."
        )

    check_program(program)

    print(f"installed: {identity['name']} {identity['version']} from {module.parent}")
    print("           describes itself, answers on the command line, and plots the probe exactly")


def check_program(program: pathlib.Path) -> None:
    """Load the probe this release's compiler produced, and check every value.

    Through ``load_text``, the text boundary a host uses, and with the adapter's
    own library, which is the import that failed when the package list was
    incomplete. A program the two packages disagree about fails at the load; a
    library that computes something else fails at a column.
    """
    from openscript.adapter.serving import Serving
    from openscript.contracts import Bar
    from openscript.run import load_text

    loaded = load_text(program.read_text(encoding="utf-8"), library=Serving())
    if not loaded.ok:
        raise ReleaseRefused(
            "The installed engine refused the program this release's compiler emitted: "
            f"{loaded.diagnostic.code} {loaded.diagnostic.message}"
        )

    for index, (close, expected) in enumerate(zip(CLOSES, EXPECTED)):
        bar = Bar(
            time=1_700_000_000_000 + index * 60_000,
            open=close,
            high=close,
            low=close,
            close=close,
            volume=1.0,
        )
        result = loaded.run.execute_bar(index, bar)
        if not result.ok:
            raise ReleaseRefused(
                f"The probe stopped on bar {index}: "
                f"{result.diagnostic.code} {result.diagnostic.message}"
            )
        if tuple(result.columns) != expected:
            raise ReleaseRefused(
                f"On bar {index} with close {close} the probe plotted {list(result.columns)}, "
                f"and this release must plot {list(expected)}."
            )


def main(argv: list) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    commands = parser.add_subparsers(dest="command", required=True)

    dist = commands.add_parser("dist", help="check the built wheel and source distribution")
    dist.add_argument("directory", type=pathlib.Path)
    dist.add_argument("--tag", required=True)

    installed = commands.add_parser("installed", help="check the engine this interpreter has")
    installed.add_argument("--tag", required=True)
    installed.add_argument("--program", type=pathlib.Path, required=True)
    installed.add_argument("--describe-output", type=pathlib.Path, required=True)

    arguments = parser.parse_args(argv)
    try:
        if arguments.command == "dist":
            check_dist(arguments.directory, arguments.tag)
        else:
            check_installed(arguments.tag, arguments.program, arguments.describe_output)
    except ReleaseRefused as refusal:
        print(f"NOT RELEASABLE: {refusal}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
