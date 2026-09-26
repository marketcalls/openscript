/**
 * What the host's chart can draw, read from the version the host states.
 *
 * The adapter declares the descriptor's shape rather than importing the chart
 * library, for the reason `contract.ts` gives, so it cannot ask the library
 * what it has. Two hooks arrived after the oldest chart the peer range accepts:
 * a band's per-bar colour callback and the list of grids, both in 2.5.4. A
 * chart ignores a hook it does not know, so a descriptor that relied on either
 * would draw, on an older chart, a band in the chart's own default colours or
 * the first grid alone, and say nothing. That is the failure OS6024 exists to
 * end, so where the adapter cannot tell, it refuses (`undrawable.ts`).
 *
 * **The host states the version, and the adapter reads what that version
 * has.** The library exports its own version string, and a host that imports
 * the chart already holds it: `descriptorFor(program, { chartVersion: VERSION })`.
 * A version rather than a switch per hook, because a switch is a fact about the
 * chart that the host has to look up and keep true through every upgrade and
 * downgrade, while the version is the chart it actually installed.
 *
 * **Nothing stated reads as the oldest chart**, which is the descriptor every
 * host got before the option existed: nothing it draws changes, and a program
 * that needs either hook is refused as it was. A string that is not a version
 * reads the same way, and the refusal says the string could not be read rather
 * than guessing at what it meant. A prerelease orders before its release, as
 * version precedence orders it, so `2.5.4-rc.1` reads as a chart without what
 * 2.5.4 added; build metadata after a `+` orders nothing and is ignored.
 */

/** What the chart this descriptor is registered with will read. */
export interface ChartCapabilities {
  /** A band's colour per bar, through the band's own colour callback. */
  readonly bandColours: boolean;
  /** Every declared grid, through the list of grids with an id each. */
  readonly grids: boolean;
  /** What the host stated, for the sentence a refusal carries. */
  readonly stated: string | undefined;
}

/** The two hooks this reads a version for. */
export type Capability = 'bandColours' | 'grids';

/** The chart version each hook arrived in. */
const SINCE: Readonly<Record<Capability, string>> = {
  bandColours: '2.5.4',
  grids: '2.5.4',
};

/** `major.minor.patch`, an optional prerelease, optional build metadata. */
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

interface Read {
  readonly release: readonly [number, number, number];
  readonly prerelease: boolean;
}

export function capabilitiesOf(stated: string | undefined): ChartCapabilities {
  const read = stated === undefined ? undefined : readVersion(stated);
  return {
    bandColours: read !== undefined && reaches(read, SINCE.bandColours),
    grids: read !== undefined && reaches(read, SINCE.grids),
    stated,
  };
}

/**
 * The sentence a refusal gives for a hook the chart may not have.
 *
 * `older` is what a chart without the hook does, in the words a reader of the
 * refusal needs; the rest says which version has it and what this host stated,
 * because the fix is the host's and it has to know which of the two to change.
 */
export function lacking(chart: ChartCapabilities, capability: Capability, older: string): string {
  const since = SINCE[capability];
  const stated = chart.stated;
  const which =
    stated === undefined
      ? 'this host stated no chart version'
      : readVersion(stated) === undefined
        ? `this host stated ${JSON.stringify(stated)}, which is not a version this adapter can read`
        : `this host stated version ${stated}`;
  return `${older} before chart version ${since}, and ${which}`;
}

function readVersion(text: string): Read | undefined {
  const match = VERSION.exec(text);
  if (match === null) return undefined;
  return {
    release: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] !== undefined,
  };
}

/** Whether a stated version is at or past the one a hook arrived in. */
function reaches(read: Read, since: string): boolean {
  const needed = readVersion(since);
  if (needed === undefined) return false;
  for (let part = 0; part < 3; part += 1) {
    const have = read.release[part] ?? 0;
    const need = needed.release[part] ?? 0;
    if (have !== need) return have > need;
  }
  return !read.prerelease;
}
