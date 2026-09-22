/**
 * The conformance suite, run: `conformance.md` sections 9 and 10, executed.
 *
 * The runner walks the suite, invokes an adapter once per case as a child
 * process with a timeout, turns a crash, a hang, a timeout or a malformed
 * answer into the `error` outcome, and writes the result document of section
 * 9. It never loads an engine into its own process, so an engine in another
 * language is a participant and not a special case, and it never invokes an
 * adapter for the suite as a whole, for the reason section 9 gives and
 * `lib/adapter-call.mjs` repeats: only a caller holding a clock and a child
 * can report the three failures a program cannot report of itself.
 *
 * Two modes, section 10's:
 *
 *     node scripts/run-suite.mjs [--adapter <file>]
 *     node scripts/run-suite.mjs [--adapter <file>] --against <other-file>
 *
 * The first compares an engine with the expected files: each case is handed
 * to the adapter, which answers with a case result. The second compares two
 * engines with each other: each case is handed to both adapters with
 * `--actual`, each answers with what it computed and no comparison, and this
 * runner compares the two channel by channel with tolerance zero, whatever the
 * case declares, through the same function the adapter uses. The first
 * adapter's values are the `expected` side of a difference and the second's
 * are the `actual` side, and the document names both engines.
 *
 * Other arguments: `--cases <dir>` walks another suite root, `--timeout <ms>`
 * bounds one invocation (the default is below), and `--out <file>` writes the
 * document there instead of to standard output. The one-line summary always
 * goes to standard error, so standard output is the document and nothing
 * else. The default adapter is this repository's own.
 *
 * ## What decides the exit code
 *
 * Section 9: a failing run exits non-zero. A run fails on any `fail`,
 * `nonFinite` or `error`, and on any `unsupported` case, because section 8
 * says an implementation with one inside the profile it claims does not pass
 * that profile. A case outside the claimed profile is not run and is reported
 * `skipped`, which section 9 says is never a pass and never counted as one; it
 * does not fail the run because it makes no claim about that profile. Finding
 * no case at all is a refusal, for the reason at the top of `lib/files.mjs`.
 *
 * **In the second mode, a run that compared nothing is a refusal as well.**
 * There the claimed profile is both engines', so an engine claiming a narrow
 * one skips every case, and the run reports a pass with no comparison behind
 * it: the same green line a suite with no cases in it would print. Section 10
 * is a release gate and the thing it gates is two engines producing the same
 * numbers, so a build wiring that comparison in has to be able to tell "they
 * agree" from "neither was asked". The first mode keeps the softer rule,
 * because there a skipped case is one engine honestly saying which profile it
 * claims, and reporting that is the whole point of section 8.
 *
 * ## What it reads out of the page, and what it does not reach
 *
 * The profile order (section 8), the outcome vocabulary (section 9) and the
 * channel names (section 2) are read out of `spec/conformance.md`, so the
 * runner refuses an adapter that claims a profile the page does not list and
 * an answer whose outcome the page does not name. The suite revision has no
 * place the page fixes yet, so the document carries the package version the
 * cases shipped with, and says so here rather than inventing a spelling. A
 * per-column tolerance is not read, for the reason in `lib/compare.mjs`.
 *
 * `caseDirectories` in `lib/case-directory.mjs` walks the repository's own
 * suite and takes no root; the walk here takes one, because a second engine's
 * copy of the suite and a test's temporary one live elsewhere. When that
 * helper takes a root, the walk here goes.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { callAdapter, describeAdapter } from './lib/adapter-call.mjs';
import { CASES } from './lib/case-directory.mjs';
import { EXACT, compareChannels } from './lib/compare.mjs';
import {
  channelNames,
  compilerCategories,
  conformancePage,
  insideProfile,
  outcomeNames,
  profileOrder,
} from './lib/conformance-page.mjs';
import { nothingFound } from './lib/files.mjs';

/** This repository's own adapter, which is what a bare run is measured with. */
const OWN_ADAPTER = 'scripts/adapter.mjs';

/** Long enough for a case to run, short enough for a hang to be an outcome. */
const DEFAULT_TIMEOUT_MS = 60_000;

/** Where the package version, standing in for a suite revision, is written. */
const PACKAGE = 'package.json';

/** Section 2: the file every case directory holds, which is what makes a directory a case. */
const CASE_FILE = 'case.json';

/** The invocation of section 9 that answers with values rather than an outcome. */
const ACTUAL = '--actual';

function refuse(message) {
  console.error(message);
  process.exit(1);
}

// -------------------------------------------------------------- the arguments

const USAGE =
  'Usage: node scripts/run-suite.mjs [--adapter <file>] [--against <file>] [--cases <dir>] ' +
  '[--timeout <ms>] [--out <file>]';

function readArguments(argv) {
  const options = { adapter: OWN_ADAPTER, against: null, cases: CASES, timeout: DEFAULT_TIMEOUT_MS, out: null };
  for (let at = 0; at < argv.length; at += 2) {
    const flag = argv[at];
    const value = argv[at + 1];
    if (value === undefined) refuse(`${flag} needs a value.\n${USAGE}`);
    if (flag === '--adapter') options.adapter = value;
    else if (flag === '--against') options.against = value;
    else if (flag === '--cases') options.cases = value;
    else if (flag === '--out') options.out = value;
    else if (flag === '--timeout') {
      options.timeout = Number(value);
      if (!Number.isInteger(options.timeout) || options.timeout <= 0) refuse(`--timeout takes a whole number of milliseconds.\n${USAGE}`);
    } else refuse(`${flag} is not an argument this runner takes.\n${USAGE}`);
  }
  return options;
}

const options = readArguments(process.argv.slice(2));

// -------------------------------------------------------------------- the page

const page = conformancePage();
const profiles = profileOrder(page);
const outcomes = outcomeNames(page);
const channels = channelNames(page);
for (const [name, value] of [
  ['the profiles of section 8', profiles],
  ['the outcomes of section 9', outcomes],
  ['the channels of section 2', channels],
]) {
  if (value === null) refuse(`spec/conformance.md no longer prints ${name} in the form this runner reads.`);
}

// ------------------------------------------------------------------ the suite

/** Every case directory under a root, by id, with the id its case.json claims. */
function casesUnder(root) {
  const out = [];
  const walk = (dir, id) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((entry) => entry.isFile() && entry.name === CASE_FILE)) {
      let declared = null;
      try {
        declared = JSON.parse(readFileSync(join(dir, CASE_FILE), 'utf8'));
      } catch {
        declared = null;
      }
      out.push({ id, directory: dir.split('\\').join('/'), declared });
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) walk(join(dir, entry.name), id === '' ? entry.name : `${id}/${entry.name}`);
    }
  };
  walk(root, '');
  return out.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

const found = casesUnder(options.cases);
if (found.length === 0) refuse(nothingFound(`case directory under ${options.cases}/`) + '.');

// ---------------------------------------------------------------- the engines

const described = describeAdapter(options.adapter, options.timeout, profiles);
if (!described.ok) refuse(`${options.adapter}: ${described.reason}`);
const engine = described.identity;

let against = null;
if (options.against !== null) {
  const other = describeAdapter(options.against, options.timeout, profiles);
  if (!other.ok) refuse(`${options.against}: ${other.reason}`);
  against = other.identity;
}

/**
 * The categories no engine in this run has a compiler for.
 *
 * Section 8: an implementation reporting engine-only "runs every case except
 * the compiler-diagnostic categories, and its report says so". Which categories
 * those are is section 7's second column, read from the page rather than listed
 * again here.
 *
 * Empty unless an engine in this run says it is engine-only, so an ordinary run
 * is unchanged. With two engines it is either of them: a case one cannot be
 * asked about is a case they cannot be compared on.
 */
const noCompiler = [engine, against].some((one) => one !== null && one.engineOnly === true)
  ? compilerCategories(page)
  : [];
if (noCompiler === null) {
  refuse(
    'spec/conformance.md section 7 no longer prints a "Needs a compiler" column for every ' +
      'category, and section 8 says an engine-only implementation runs every case except the ' +
      'compiler-diagnostic ones. Without that column there is nothing to read that set from.',
  );
}

/** The profile a case has to be inside: both engines' when there are two. */
const claimed = [engine.profile, ...(against === null ? [] : [against.profile])];

// ---------------------------------------------------------------- the cases

/** The second mode: both engines asked for values, compared exactly here. */
function compareEngines(found) {
  const asserted = found.declared.asserts;
  if (!Array.isArray(asserted) || !asserted.every((channel) => channels.includes(channel))) {
    return { outcome: 'error', reason: 'case.json asserts no channel section 2 lists' };
  }
  const sides = [];
  for (const [name, adapter] of [[engine.name, options.adapter], [against.name, options.against]]) {
    const called = callAdapter(adapter, [ACTUAL, found.directory], options.timeout);
    if (!called.ok) return { outcome: 'error', engine: name, reason: called.reason };
    const answer = called.value;
    if (typeof answer.error === 'string') return { outcome: 'error', engine: name, reason: answer.error };
    if (Array.isArray(answer.unsupported) && answer.unsupported.length > 0) {
      return { outcome: 'unsupported', engine: name, feature: answer.unsupported.map(String).join('; ') };
    }
    if (answer.channels === null || typeof answer.channels !== 'object') {
      return { outcome: 'error', engine: name, reason: 'the adapter answered with no channels' };
    }
    for (const channel of asserted) {
      if (!(channel in answer.channels)) {
        return { outcome: 'error', engine: name, reason: `the adapter answered no ${channel}, which the case asserts` };
      }
    }
    sides.push(answer.channels);
  }
  return compareChannels(asserted, sides[1], sides[0], EXACT);
}

/** The first mode: the adapter answers with an outcome, held to section 9's vocabulary. */
function askAdapter(found) {
  const called = callAdapter(options.adapter, [found.directory], options.timeout);
  if (!called.ok) return { outcome: 'error', reason: called.reason };
  const { id: _id, ...row } = called.value;
  if (!outcomes.includes(row.outcome)) {
    return { outcome: 'error', reason: `the adapter reported the outcome ${JSON.stringify(row.outcome)}, which section 9 does not list` };
  }
  return row;
}

function runOne(found) {
  const declared = found.declared;
  if (declared === null || typeof declared !== 'object') {
    return { outcome: 'error', reason: `${CASE_FILE} is missing or is not JSON` };
  }
  if (declared.id !== found.id) {
    return {
      outcome: 'error',
      reason: `${CASE_FILE} says its id is ${JSON.stringify(declared.id)} and the directory is ${found.id} (section 2)`,
    };
  }
  if (!profiles.includes(declared.profile)) {
    return { outcome: 'error', reason: `${CASE_FILE} names the profile ${JSON.stringify(declared.profile)}, which section 8 does not list` };
  }
  if (noCompiler.includes(declared.category)) {
    // Section 8. An engine that is handed compiled programs has no compiler for
    // a compiler-diagnostic case to be about, so the case makes no claim about
    // it either way: skipped, which section 9 says is never a pass.
    return {
      outcome: 'skipped',
      profile: declared.profile,
      reason: `the ${declared.category} category needs a compiler and an engine here reports engine-only`,
    };
  }
  if (!claimed.every((profile) => insideProfile(profiles, profile, declared.profile))) {
    return { outcome: 'skipped', profile: declared.profile, reason: `outside the claimed profile ${claimed.join(' and ')}` };
  }
  return against === null ? askAdapter(found) : compareEngines(found);
}

const startedAt = Date.now();
const rows = [];
for (const one of found) {
  const began = Date.now();
  const row = runOne(one);
  rows.push({ id: one.id, ...row, durationMs: Date.now() - began });
}

// ------------------------------------------------------------ the document

const summary = { total: rows.length };
for (const outcome of outcomes) summary[outcome] = rows.filter((row) => row.outcome === outcome).length;

const identity = ({ name, version, profile }) => ({ name, version, profile });
const document = {
  suiteRevision: JSON.parse(readFileSync(PACKAGE, 'utf8')).version,
  engine: identity(engine),
  ...(against === null ? {} : { against: identity(against) }),
  languageVersions: engine.languageVersions,
  schemaVersion: engine.schemaVersion,
  platform: `${process.platform} ${process.arch} ${process.release.name} ${process.version}`,
  startedAt,
  cases: rows,
  summary,
};

const text = `${JSON.stringify(document, null, 2)}\n`;
if (options.out === null) process.stdout.write(text);
else writeFileSync(options.out, text, 'utf8');

const failing = rows.filter((row) => row.outcome !== 'pass' && row.outcome !== 'skipped');
const counts = outcomes.map((outcome) => `${summary[outcome]} ${outcome}`).join(', ');
const who = against === null
  ? `${engine.name} ${engine.version} (${engine.profile}) against the expected files`
  : `${engine.name} ${engine.version} against ${against.name} ${against.version}, exactly`;

if (failing.length > 0) {
  for (const row of failing) {
    const where = [row.channel, row.column, row.index === undefined ? null : `index ${row.index}`].filter((part) => part !== null && part !== undefined).join(' ');
    const said = row.reason ?? row.feature ?? (row.expected === undefined ? '' : `expected ${row.expected}, actual ${row.actual}${row.bound === undefined ? '' : ` (${row.bound})`}`);
    console.error(`${row.id}: ${row.outcome}${where === '' ? '' : ` at ${where}`}${said === '' ? '' : `: ${said}`}`);
  }
  console.error(
    `\nSuite failed: ${counts} of ${rows.length}, ${who}. A case that fails, errors or is ` +
      'unsupported inside the claimed profile is not a passing run (conformance.md sections 8 and 9), ' +
      'and section 10 says the case is never the thing that gets changed.',
  );
  process.exit(1);
}

if (against !== null && summary.pass === 0) {
  console.error(
    `\n${nothingFound('case inside the profile both engines claim')}. ${who}, and section 10 is ` +
      'about two engines producing the same numbers, so a run where neither engine was asked ' +
      'about a single case is not agreement: it is the same evidence a suite with no cases in it ' +
      'would produce. Every case here was skipped, which section 9 says is never a pass.',
  );
  process.exit(1);
}

console.error(
  `Suite passed: ${counts} of ${rows.length}, ${who}, each case in a child process of its own ` +
    `with ${options.timeout} ms to answer. What this does not reach: a case outside the claimed ` +
    `profile is skipped and not run (${summary.skipped} here); a per-column tolerance is not read; ` +
    'and every adapter is started by this runtime, so one in another language is started through ' +
    'a JavaScript file of its own.',
);
