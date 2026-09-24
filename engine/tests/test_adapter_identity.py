"""The identity ``--describe`` reports, from a checkout and from an installed copy.

Section 9 of the conformance page has an adapter answer with the engine's own
name and version. Through 0.5.0 that was read only from ``pyproject.toml`` beside
the package, which is never installed, so ``python -m openscript --describe``
failed on every installed copy of the engine, 0.5.0 from the index included, and
no host could run the conformance suite against the engine it actually had.

Each test names the wrong implementation it catches.
"""

import tempfile
import unittest
from pathlib import Path

from openscript.adapter.answers import _identity, _installed
from openscript.adapter.spellings import Malformed

NAME = "openscript"


def _project(directory: Path, name: str, version: str) -> Path:
    """A ``pyproject.toml`` naming ``name`` at ``version``."""
    path = directory / "pyproject.toml"
    path.write_text(f'[project]\nname = "{name}"\nversion = "{version}"\n', encoding="utf-8")
    return path


def _record(site: Path, name: str, version: str) -> None:
    """The ``dist-info`` an installer writes beside a package it installed."""
    info = site / f"{name}-{version}.dist-info"
    info.mkdir()
    (info / "METADATA").write_text(
        f"Metadata-Version: 2.4\nName: {name}\nVersion: {version}\nRequires-Python: >=3.12\n\n"
        "The long description, which is not a header and must not be read as one.\n",
        encoding="utf-8",
    )


def _none(_name: str):
    return None


class Identity(unittest.TestCase):
    def setUp(self):
        self.directory = Path(tempfile.mkdtemp())

    def test_a_checkout_reads_the_project_file(self):
        """Catches the installed record being preferred in a checkout.

        The conformance suite runs from the source tree, where the project file is
        the release's own statement of its version.
        """
        project = _project(self.directory, NAME, "1.2.3")
        self.assertEqual(_identity(project, _none)["version"], "1.2.3")

    def test_an_installed_copy_reads_the_record_its_installer_wrote(self):
        """PORTED DEFECT: an installed copy refused, because the file is not installed.

        The installed record is not an invented version: the build wrote it from
        the same file, and it is what the installer and the index report.
        """
        missing = self.directory / "pyproject.toml"
        identity = _identity(missing, lambda name: {"Name": name, "Version": "4.5.6"})
        self.assertEqual((identity["name"], identity["version"]), (NAME, "4.5.6"))

    def test_a_project_file_naming_another_project_is_not_this_ones(self):
        """Catches reading any pyproject.toml found above the package.

        Beside an installed package the directory above is site-packages, where a
        stray project file from anything else would otherwise be reported as this
        engine's identity.
        """
        stray = _project(self.directory, "someone-else", "0.0.1")
        identity = _identity(stray, lambda name: {"Name": name, "Version": "7.8.9"})
        self.assertEqual((identity["name"], identity["version"]), (NAME, "7.8.9"))

    def test_neither_is_a_refusal_rather_than_a_guess(self):
        """Catches an identity with a made up or empty version in it."""
        with self.assertRaises(Malformed):
            _identity(self.directory / "pyproject.toml", _none)


class InstalledRecord(unittest.TestCase):
    def setUp(self):
        self.site = Path(tempfile.mkdtemp())

    def test_the_record_beside_the_package_is_read_with_its_headers(self):
        """Catches reading the long description as fields, or no fields at all."""
        _record(self.site, NAME, "0.6.0")
        recorded = _installed(NAME, self.site)
        self.assertEqual((recorded["Name"], recorded["Version"]), (NAME, "0.6.0"))

    def test_no_record_is_no_install_rather_than_an_error(self):
        """Catches a checkout being refused before its project file is tried."""
        self.assertIsNone(_installed(NAME, self.site))

    def test_two_records_are_refused_rather_than_one_picked(self):
        """Catches choosing the first record of a broken upgrade.

        Two records beside one package means an upgrade left the old one behind,
        and there is no telling which describes the files actually installed.
        """
        _record(self.site, NAME, "0.5.0")
        _record(self.site, NAME, "0.6.0")
        with self.assertRaises(Malformed):
            _installed(NAME, self.site)

    def test_a_record_for_another_distribution_is_not_read(self):
        """Catches matching every dist-info rather than this distribution's.

        Including a sibling whose name starts with this one. An installer writes
        a hyphen in a distribution's name as an underscore in its record, so
        ``openscript-extras`` is ``openscript_extras-<version>.dist-info`` and must
        not be read as this engine, alone or beside it.
        """
        _record(self.site, "unrelated", "9.9.9")
        _record(self.site, "openscript_extras", "1.0.0")
        self.assertIsNone(_installed(NAME, self.site))
        _record(self.site, NAME, "0.6.0")
        self.assertEqual(_installed(NAME, self.site)["Version"], "0.6.0")


if __name__ == "__main__":
    unittest.main()
