# Releasing

Every release after the first is automated and needs no credential. The first one
cannot be, and this page exists because that is the step every guide skips.

---

## The chicken and the egg

The release workflow publishes with **trusted publishing**: the registry checks
the workflow's own identity instead of a stored token, so there is no long-lived
credential anywhere. That is the right way to publish and it is why the workflow
holds no secret.

It is also not usable until the package exists.

A trusted publisher is configured **on a package**, through that package's
settings page on the registry. A package that has never been published has no
settings page, so there is nothing to configure. The registry's own documentation
does not spell this out; the setup instructions simply begin "navigate to your
package settings", which presupposes the package is there.

So the first publish is manual, from a person's machine, once. After that the
automation takes over permanently.

## The bootstrap, once

Only somebody with publish rights on the account can do this.

**1. Take the package out of private.** `package.json` carries `"private": true`
deliberately, and the release workflow refuses to publish while it does. Remove
it in the same commit that sets the first version.

**2. Publish once, by hand.**

```bash
npm login
npm publish --access public
```

Use a pre-release version. `0.0.1` or `0.1.0-alpha.0` both say clearly that this
is a placeholder rather than something to build on, and a `0.x` version already
means unstable by convention.

Consider publishing it under a tag other than `latest`:

```bash
npm publish --access public --tag alpha
```

so that `npm install` does not hand a stub to somebody who was looking for a
working compiler. Check what the tags actually point at afterwards, because the
first publish of a new package may create `latest` regardless:

```bash
npm dist-tag ls openalgo-script
```

**3. Configure the trusted publisher**, now that there is a settings page for it.
On the package's settings, under Trusted Publisher, name:

| Field | Value |
|---|---|
| Repository | the GitHub repository holding this file |
| Workflow | `release.yml` |
| Environment | `release` |

**Allow npm publish must be enabled.** Without it only staging is permitted and
the workflow's direct publish is refused, which fails late and confusingly.

**4. Confirm the automation before trusting it.** Tag a patch release and dispatch
the workflow. If that publishes with provenance and no token, the bootstrap is
done and nobody needs to log in again.

## Every release after that

1. Update the version in `package.json` and the changelog.
2. `npm test`, which runs the seven checks, the real build and the unit tests.
3. Commit, tag, push the tag.
4. Dispatch both release workflows manually with that tag: `Release`, which
   publishes the npm package, and `Release to PyPI`, which publishes the
   Python engine. The section on the Python engine below has what the second
   one checks.

The tag push alone publishes nothing. A tag is cheap to create by accident and
publishing is not reversible, so the two are kept separate on purpose.

Before it publishes anything the workflow refuses:

- a red suite, because a release is the worst moment to discover one
- a runtime dependency advisory
- a non-empty `dependencies`, since zero of them is a promise this project makes
  and a promise held only in a README lasts until the first convenience
- a package still marked private
- a tag, manifest or built artifact that disagree about the version
- **a compiled format version that the specification does not document**

That last one matters more than it looks. Somebody implementing the compiled
program in another language targets a **format** version, not this package's
version, and the two move at different speeds on purpose: the package can reach
2.0 for an API change while the format stays at 1 and their engine keeps working.
What must never happen is the format version drifting between the document they
implemented from and the compiler that emits it.

## When to do the bootstrap

Two honest options.

**Now.** The name is free today and it is the only thing standing between this
project and somebody else taking it. It also unblocks the trusted publisher
configuration, so the automation can be proved to work long before there is
anything important to publish. The cost is a stub on the registry for a while.

**At the first useful version.** The compiler cannot yet compute a moving
average, so an install today repays nobody. The risk is small but real, and
losing the name after building on it is far worse than an early stub.

The deciding argument is the second one in the first option: automation that has
never run is not automation. Proving the path works while the stakes are a
placeholder is better than discovering a misconfigured publisher on the day a
release matters.

## The Python engine, to PyPI

Two packages ship as one release. `scripts/check-python.mjs` holds their version
numbers equal, so the Python engine is published from the same tag as the npm
package, in the same release, and never on its own.

**Dispatch `Release to PyPI` (`.github/workflows/release-pypi.yml`) with the
tag**, beside the npm `Release` workflow. It publishes through trusted
publishing, so no token is stored anywhere and none is ever typed.

Its `build` job refuses before anything is uploaded, and holds no identity the
index would accept, so nothing in it can upload:

- a red suite: the full `npm test`, both engines included, and a missing
  changelog entry
- a tag that does not name the version both manifests declare, or a version the
  index cannot spell safely. A prerelease written `0.7.0-rc.1` for npm becomes
  `0.7.0rc1` on the index, which never installs a prerelease unless asked; a
  label other than alpha, beta or rc is refused rather than guessed at
- `engine/tools/check_release.py dist`: anything but exactly the wheel and the
  source distribution for this version, a declared runtime dependency, a source
  module missing from the wheel, or anything the wheel would install beside the
  engine
- `engine/tools/check_release.py installed`: the wheel installed into a fresh
  interpreter with nothing fetched and used from outside the repository, where it
  must describe itself as this release, answer `python -m openscript
  --describe`, and load a probe compiled by this release's own compiler and plot
  every value exactly

Then `publish` uploads exactly what was checked, and nothing else runs in that
job. Afterwards `confirm` installs the version the index is serving and runs the
same installed checks against it. A red `confirm` is not a reason to publish
again, which the index would refuse anyway: it is a reason to look at what the
index is serving.

**The two checks that have been wrong before, and why they are mechanical now.**
`[tool.setuptools] packages` is a hand-written list, and it once named only
`openscript`, so the distribution shipped the machine and none of the halves it
calls. And a check once reported an installed engine that was really the
checkout, because the probe interpreter had no installer. `dist` compares every
module file in the wheel against the source tree, and `installed` refuses an
engine imported from anywhere but the interpreter's own site-packages.

### The trusted publisher, once

On pypi.org, under the `openscript` project: Manage, then Publishing, then add a
new trusted publisher for a repository workflow, with exactly these values.

| Field | Value |
|---|---|
| Owner | `marketcalls` |
| Repository name | `openscript` |
| Workflow name | `release-pypi.yml` |
| Environment name | `release` |

The environment is the one the npm release already uses, so its protection
rules, the required reviewers and which refs may deploy, cover both registries.
Then delete any API token made for this project. With a trusted publisher nothing
needs one, and a token that exists is a token that can leak.

### Checking a build by hand

The same checks run locally, before anything is dispatched. From the repository
root, with a scratch directory of your own in place of `$T`:

```
python -m pip install build==1.6.1
python -m build engine --outdir "$T/dist"
python engine/tools/check_release.py dist "$T/dist" --tag vX.Y.Z

npm run build
node scripts/release-python-probe.mjs "$T/probe.program.json"

python -m venv "$T/host"
"$T/host/bin/python" -m pip install --no-index "$T"/dist/*.whl
mkdir "$T/elsewhere" && cd "$T/elsewhere"
"$T/host/bin/python" -P -m openscript --describe > describe.json
"$T/host/bin/python" <repository>/engine/tools/check_release.py installed \
  --tag vX.Y.Z --program "$T/probe.program.json" --describe-output describe.json
```

On Windows the interpreter is `Scripts/python.exe` in place of `bin/python`.
`python -m build` leaves `engine/openscript.egg-info` behind, which
`scripts/check-no-eval.mjs` refuses to walk past because it cannot place it;
delete it before running `npm test` again.
