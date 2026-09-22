/**
 * What a suite test drives: the runner, as a child process, over a suite it
 * built for the purpose.
 *
 * The runner is run the way a person runs it, as a program with arguments,
 * rather than imported, because what these tests are about is the document it
 * writes and the exit code it leaves, and both only exist at the process
 * boundary. A suite a test needs to break is copied out of `cases/` into a
 * temporary directory first: `conformance.md` section 10 says a case is never
 * edited, and a test that edited one in place would be the first thing to
 * break that rule.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository root, from the built test tree. */
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

export const RUNNER = join(ROOT, 'scripts', 'run-suite.mjs');
export const OWN_ADAPTER = join(ROOT, 'scripts', 'adapter.mjs');
export const CASES = join(ROOT, 'cases');

/** A fake adapter under `tests/suite/adapters/`, by its file name. */
export const fake = (name: string): string => join(ROOT, 'tests', 'suite', 'adapters', `${name}.mjs`);

/** The package version, which the runner writes as the suite revision. */
export const packageVersion = (): string =>
  (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }).version;

/** One row of the result document's `cases` array. */
export interface CaseRow {
  readonly id: string;
  readonly outcome: string;
  /** The profile the case declares. The runner writes it on a skipped row,
   *  which is the row that has to say which profile it was outside of. */
  readonly profile?: string;
  readonly channel?: string;
  readonly column?: string | null;
  readonly index?: number | null;
  readonly expected?: string;
  readonly actual?: string;
  readonly bound?: string;
  readonly reason?: string;
  readonly feature?: string;
  readonly engine?: string;
  readonly durationMs: number;
}

/** The result document of `conformance.md` section 9, as this runner writes it. */
export interface SuiteDocument {
  readonly suiteRevision: string;
  readonly engine: { readonly name: string; readonly version: string; readonly profile: string };
  readonly against?: { readonly name: string; readonly version: string; readonly profile: string };
  readonly languageVersions: readonly number[];
  readonly schemaVersion: string;
  readonly platform: string;
  readonly startedAt: number;
  readonly cases: readonly CaseRow[];
  readonly summary: Readonly<Record<string, number>>;
}

export interface RunOutcome {
  readonly status: number | null;
  readonly document: SuiteDocument | null;
  readonly stderr: string;
}

/** Longer than any test here needs, and short enough that a runner that hangs fails the test. */
const RUNNER_BUDGET_MS = 120_000;

/** The runner, once, with these arguments, from the repository root. */
export function runSuite(args: readonly string[]): RunOutcome {
  const child = spawnSync(process.execPath, [RUNNER, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: RUNNER_BUDGET_MS,
    maxBuffer: 64 * 1024 * 1024,
  });
  let document: SuiteDocument | null = null;
  try {
    document = JSON.parse(child.stdout) as SuiteDocument;
  } catch {
    document = null;
  }
  return { status: child.status, document, stderr: child.stderr };
}

/**
 * A suite in a directory of its own, which a test may break: cases copied out
 * of `cases/`, cases a test made from a run of its own, or both.
 */
export interface TemporarySuite {
  readonly root: string;
  directoryOf(id: string): string;
  /** One case, written from the files a projection made, under its id. */
  write(id: string, files: Readonly<Record<string, string>>): void;
  /** One file of one case, parsed, changed and written back. */
  rewrite(id: string, file: string, change: (parsed: Record<string, unknown>) => void): void;
  /** One file of one case, removed. */
  drop(id: string, file: string): void;
  remove(): void;
}

export function temporarySuite(ids: readonly string[] = []): TemporarySuite {
  const root = mkdtempSync(join(tmpdir(), 'openscript-suite-'));
  const directoryOf = (id: string): string => join(root, ...id.split('/'));
  for (const id of ids) cpSync(join(CASES, ...id.split('/')), directoryOf(id), { recursive: true });
  return {
    root,
    directoryOf,
    write(id, files) {
      mkdirSync(directoryOf(id), { recursive: true });
      for (const [name, text] of Object.entries(files)) writeFileSync(join(directoryOf(id), name), text, 'utf8');
    },
    rewrite(id, file, change) {
      const path = join(directoryOf(id), file);
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
      change(parsed);
      writeFileSync(path, `${JSON.stringify(parsed)}\n`, 'utf8');
    },
    drop(id, file) {
      rmSync(join(directoryOf(id), file));
    },
    remove() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

/** The same number one bit further from zero, which no decimal rounding can tell apart. */
export function oneBitUp(value: number): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) + 1n);
  return view.getFloat64(0);
}
