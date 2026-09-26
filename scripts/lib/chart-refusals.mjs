/**
 * What the chart adapter refuses rather than drops, held to the record.
 *
 * `spec/chart-narrowings.json` lists under `refused` every declaration a chart
 * may have no room for, and `compiled-program.md` section 11 says a host
 * refuses such a program before any bar runs, with OS6024, instead of drawing
 * part of it. Each entry is proved here by a study that declares exactly the
 * thing and nothing else the chart cannot draw: the study is compiled, a
 * descriptor is built and asked for a calculation, and the calculation has to
 * throw the entry's code. A refusal nobody asks for is one that could have
 * stopped happening, which is the silent drop this record exists to end.
 *
 * **An entry that names the chart version it is drawn from is proved on both
 * sides of it**, and one that names none is proved refused on the version the
 * check's own fixture is built for as well, since it claims every chart. A host that states nothing, and a host that states the version
 * just before it, are refused; a host that states the version itself is not,
 * and the probe reads back that the thing was drawn: both grids with their own
 * cells, or a band answering the colours its bars computed. Proving only the
 * refusal would let the adapter refuse everywhere and pass, and proving only
 * the drawing would let an old chart drop the thing in silence again.
 *
 * The probes are written here, beside the check, and matched to the record by
 * key in both directions: a record entry with no probe proves nothing, and a
 * probe with no record entry is a refusal nobody wrote down.
 */

const PROBES = {
  'tables.count': {
    source: `version 1
study("Two grids", overlay = true)
first = table("Summary", 1, 1)
second = table("Detail", 1, 1)
cell(first, 0, 0, "a")
cell(second, 0, 0, "b")
plot(close, "C")
`,
    drawn(descriptor, surface) {
      const texts = gridsIn(descriptor, surface).map((one) => one.rows[0]?.[0]?.text);
      return texts.join('|') === 'a|b'
        ? undefined
        : `drew grids holding ${JSON.stringify(texts)}, and two holding "a" then "b" are right`;
    },
  },
  'fills.colorChannel': {
    source: `version 1
study("Band", overlay = true)
a = plot(high, "H")
b = plot(low, "L")
fill(a, b, colorUp = close > open ? lime : red)
`,
    drawn(descriptor, surface) {
      const painted = paintedBy(descriptor.fills?.[0], surface);
      return painted.size === 2
        ? undefined
        : `drew the band in ${painted.size} colour${painted.size === 1 ? '' : 's'}, and the two its bars computed are right`;
    },
  },
};

/** `major.minor.patch`, which is all a record entry's version may be. */
const RELEASE = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * The options a host stating the newest chart version the record names passes.
 *
 * The check builds its fixture's descriptor with these, so a declaration drawn
 * from that version is read back as drawn rather than refused.
 */
export function hostFor(record) {
  const versions = (record.refused ?? [])
    .map((one) => one.drawnFrom)
    .filter((one) => typeof one === 'string' && RELEASE.test(one))
    .sort((x, y) => compare(release(x), release(y)));
  const newest = versions[versions.length - 1];
  return newest === undefined ? {} : { chartVersion: newest };
}

/** Every grid a descriptor offers after a run, whichever hook offers them. */
export function gridsIn(descriptor, surface) {
  if (typeof descriptor.tables === 'function') return descriptor.tables(surface);
  const one = descriptor.table?.(surface);
  return one === undefined || one === null ? [] : [one];
}

/** Every colour a band's per-bar callback answers over a run, gaps left out. */
export function paintedBy(band, surface) {
  const painted = new Set();
  if (typeof band?.colorBy !== 'function') return painted;
  const [first, second] = band.between;
  for (let index = 0; index < surface.bars.length; index += 1) {
    const a = surface.values[first]?.[index] ?? null;
    const b = surface.values[second]?.[index] ?? null;
    const colour = band.colorBy({ index, a, b, values: surface.values, settings: surface.settings });
    if (colour !== undefined) painted.add(colour);
  }
  return painted;
}

/** Every problem with the record's refusals, proved against the built adapter. */
export function refusalProblems({ core, emitter, adapter, record, recordPath, bars, ctx, host }) {
  const problems = [];
  const entries = record.refused ?? [];
  const keys = new Set(entries.map((one) => one.key));
  for (const key of Object.keys(PROBES)) {
    if (!keys.has(key)) problems.push(`the check probes ${key} and ${recordPath} records no refusal for it.`);
  }
  for (const entry of entries) {
    const probe = PROBES[entry.key];
    if (probe === undefined) {
      problems.push(`${recordPath} records the refusal ${entry.key} and nothing here probes it.`);
      continue;
    }
    if ((entry.why ?? '').trim().length === 0) problems.push(`${recordPath} refuses ${entry.key} with no reason given.`);
    const program = compiledProbe(core, emitter, entry.key, probe.source);
    if (program === undefined) {
      problems.push(`the probe for ${entry.key} did not compile, so its refusal was not asked for.`);
      continue;
    }
    const run = (options) => ranWith(adapter, program, options, bars, ctx);
    const refusedOn = [{ said: 'no chart version', options: {} }];
    // A refusal that names no version holds on every chart, the fixture's too.
    if (entry.drawnFrom === undefined && host.chartVersion !== undefined) {
      refusedOn.push({ said: `chart version ${host.chartVersion}`, options: host });
    }
    if (entry.drawnFrom !== undefined) {
      if (typeof entry.drawnFrom !== 'string' || !RELEASE.test(entry.drawnFrom)) {
        problems.push(`${recordPath} draws ${entry.key} from ${JSON.stringify(entry.drawnFrom)}, which is not a version.`);
        continue;
      }
      const before = previous(release(entry.drawnFrom));
      refusedOn.push({ said: `chart version ${before}`, options: { chartVersion: before } });
    }
    for (const { said, options } of refusedOn) {
      const code = run(options).code;
      if (code !== entry.code) {
        problems.push(
          `${recordPath} says the chart refuses ${entry.key} with ${entry.code}, and a study declaring ` +
            `it on a host stating ${said} ${code === undefined ? 'ran with nothing raised' : `was refused with ${code}`}.`,
        );
      }
    }
    if (entry.drawnFrom === undefined) continue;
    const drawn = run({ chartVersion: entry.drawnFrom });
    const wrong = drawn.code === undefined ? probe.drawn(drawn.descriptor, drawn.surface) : `was refused with ${drawn.code}`;
    if (wrong !== undefined) {
      problems.push(
        `${recordPath} says the chart draws ${entry.key} from version ${entry.drawnFrom}, and on a host ` +
          `stating it the study ${wrong}.`,
      );
    }
  }
  return problems;
}

function compiledProbe(core, emitter, key, source) {
  const file = core.sourceFile(`${key}.oscript`, source);
  const bag = new core.DiagnosticBag();
  const checked = core.check(file, core.parseTokens(file, core.lex(file, bag), bag), bag);
  return emitter.emit(file, checked, bag, {}).program;
}

/** One calculation under the host's options: what it refused with, or what it drew. */
function ranWith(adapter, program, options, bars, ctx) {
  const descriptor = adapter.descriptorFor(program, options);
  const settings = {};
  try {
    const values = descriptor.calc(bars, settings, {}, ctx);
    return { descriptor, surface: { bars, values, settings } };
  } catch (thrown) {
    return { descriptor, code: thrown?.diagnostic?.code ?? 'an error with no code' };
  }
}

function release(text) {
  return RELEASE.exec(text).slice(1, 4).map(Number);
}

function compare(x, y) {
  for (let part = 0; part < 3; part += 1) if (x[part] !== y[part]) return x[part] - y[part];
  return 0;
}

/** The release just before one, for proving a refusal on the near side of it. */
function previous([major, minor, patch]) {
  if (patch > 0) return `${major}.${minor}.${patch - 1}`;
  if (minor > 0) return `${major}.${minor - 1}.999`;
  return `${major - 1}.999.999`;
}
