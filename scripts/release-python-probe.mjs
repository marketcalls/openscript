/**
 * Compile the release probe with this checkout's compiler, for the Python engine
 * a release is about to publish.
 *
 * ## Why a release needs a program compiled here
 *
 * The two packages ship as one release, and what a host actually depends on is
 * that they agree: the compiler it installs from one registry emits a program,
 * and the engine it installs from the other has to load it. Each package passes
 * its own tests without that ever being asked, because the Python engine's tests
 * build their programs by hand and the compiler's tests never meet the Python
 * engine. The conformance suite asks it, but against the source tree, not
 * against what was built for upload.
 *
 * So the release workflow compiles this probe with the compiler at the tag, and
 * `engine/tools/check_release.py installed` loads it into the engine installed
 * from the built wheel, and later from the index itself, and checks every value
 * it plots. A format change that reached one package and not the other fails
 * there, before and after the upload, rather than in a host.
 *
 * **The probe is fixed, and so is every number it must produce.** Arithmetic on
 * the close, and a three bar mean, over closes chosen so that every answer is
 * exact in binary64. `check_release.py` holds the expected columns, including
 * the two warmup bars on which the mean is absent. A probe that computed its own
 * expectations would agree with any engine.
 *
 * Run: node scripts/release-python-probe.mjs <output-path>
 * Needs `npm run build` first: it runs the compiler, not a reading of its source.
 */
import { writeFileSync } from 'node:fs';
import { CORE_MODULE, EMITTER_MODULE } from './lib/built.mjs';
import { frontEndWith } from './lib/example-run.mjs';

const PROBE_NAME = 'release-probe.os';

// Kept in step with EXPECTED in engine/tools/check_release.py, which names what
// each plot must answer on each bar. Change one and the release check says so.
const PROBE_SOURCE = [
  'version 1',
  'study("Release probe")',
  'plot(close * 2 + 1, "Arithmetic", aqua)',
  'plot(sma(close, 3), "Mean", orange)',
  '',
].join('\n');

const output = process.argv[2];
if (!output) {
  console.error('Usage: node scripts/release-python-probe.mjs <output-path>');
  process.exit(2);
}

const core = await import(CORE_MODULE);
const emitter = await import(EMITTER_MODULE);
const compile = frontEndWith(core, emitter);

const { diagnostics, program } = compile(PROBE_NAME, PROBE_SOURCE);
const errors = diagnostics.filter((one) => one.severity === 'error');
if (errors.length > 0 || program === undefined) {
  console.error('The release probe does not compile with this checkout, so nothing here can be released:');
  for (const one of errors) console.error(`  ${one.code}: ${one.message}`);
  process.exit(1);
}

// The canonical text rather than the emitter's own object: an engine in another
// language is handed bytes, and `load_text` refuses text that parses to a program
// but is spelled some other way.
const text = core.canonicalise(program);
writeFileSync(output, text, 'utf8');
console.log(`Release probe compiled with openalgo-script ${core.VERSION}: ${output}`);
