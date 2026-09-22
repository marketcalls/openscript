/**
 * What the suite's own page fixes, read out of the page.
 *
 * `spec/conformance.md` names the files a case directory may hold (section
 * 2), the channels a case may assert (section 2), the profiles an
 * implementation may claim (section 8), the bounds a declared tolerance is
 * capped at (section 6) and the header a bars file starts with (section 3).
 * An adapter and a runner both act on every one of those lists, and a copy of
 * any of them here would be the second copy this repository's sixth rule
 * forbids: two lists that read as authoritative and drift the day one of them
 * is edited. So each is read out of the page by the shape the page gives it,
 * and a reader answers null when the page no longer prints it, so that the
 * caller refuses by name rather than acting on an empty list.
 *
 * The page's path is `CONFORMANCE` in `case-directory.mjs`, beside the one
 * reader that came before these, `suiteDefaultFacts`.
 */
import { readFileSync } from 'node:fs';
import { CONFORMANCE } from './case-directory.mjs';

/** The page, with its line endings normalised, because a pattern reads lines. */
export function conformancePage() {
  return readFileSync(CONFORMANCE, 'utf8').replace(/\r\n/g, '\n');
}

/** The heading each list sits under, as the page spells it. */
const CASE_SECTION = '## 2. A case on disk';
const BARS_HEADING = '### `bars.csv`';
const TOLERANCE_SECTION = '## 6. Comparing numbers';
const PROFILES_SECTION = '## 8. Profiles';
const RUNNING_SECTION = '## 9. Running the suite and reporting a result';

/** The placeholder the file table writes where a secondary series has a name. */
const NAME_SLOT = '<name>';

/**
 * The text of one section: from its heading to the next heading of the same
 * or a higher level, or null when the page has no such heading.
 */
function sectionOf(page, heading) {
  const at = page.indexOf(`\n${heading}\n`);
  if (at === -1) return null;
  const level = /^#+/.exec(heading)[0].length;
  const rest = page.slice(at + 1 + heading.length);
  const next = new RegExp(`\\n#{1,${level}} `).exec(rest);
  return next === null ? rest : rest.slice(0, next.index);
}

/**
 * Every table in a piece of text, as a header row and its body rows.
 *
 * A table is a run of lines starting with a bar, and its second line is the
 * dashes row markdown requires, which is dropped.
 */
function tablesIn(text) {
  const tables = [];
  let held = [];
  const close = () => {
    if (held.length >= 2) {
      const cells = (line) => line.split('|').slice(1, -1).map((cell) => cell.trim());
      tables.push({ header: cells(held[0]), rows: held.slice(2).map(cells) });
    }
    held = [];
  };
  for (const line of text.split('\n')) {
    if (line.startsWith('|')) held.push(line);
    else close();
  }
  close();
  return tables;
}

/** The first table of a section whose first header cell is the given word. */
function tableIn(page, heading, firstHeader) {
  const section = sectionOf(page, heading);
  if (section === null) return null;
  return tablesIn(section).find((table) => table.header[0] === firstHeader) ?? null;
}

/** A backticked word, without its backticks. */
const unticked = (cell) => /^`([^`]+)`$/.exec(cell)?.[1] ?? null;

/**
 * The names section 2's table gives the files of a case, in the table's order.
 *
 * `bars.<name>.csv` is returned as the page writes it; `caseFileMatcher`
 * turns the placeholder into what a directory may hold there.
 */
export function caseFileNames(page) {
  const table = tableIn(page, CASE_SECTION, 'File');
  if (table === null) return null;
  const names = table.rows.map((row) => unticked(row[0])).filter((name) => name !== null);
  return names.length === 0 ? null : names;
}

/**
 * Whether a file name is one the table names, with a placeholder standing for
 * a run of the characters a secondary series is named with.
 */
export function caseFileMatcher(names) {
  const patterns = names.map((name) => {
    const escaped = name.split(NAME_SLOT).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`^${escaped.join('[A-Za-z0-9_-]+')}$`);
  });
  return (fileName) => patterns.some((pattern) => pattern.test(fileName));
}

/**
 * The categories section 7 marks as needing a compiler.
 *
 * Section 8 says an implementation reporting engine-only runs every case except
 * the compiler-diagnostic categories, and this is where that set is written
 * down: the second column of section 7's table. Read rather than restated, so a
 * category added to the page without a value in that column stops the suite
 * instead of being handed to an engine that has no compiler to be about.
 *
 * Answers null when the page no longer prints the column, which the caller
 * turns into a refusal naming the page.
 */
export function compilerCategories(page) {
  const table = tableIn(page, '## 7. Categories of case', 'Category');
  if (table === null) return null;
  const at = table.header.indexOf('Needs a compiler');
  if (at === -1) return null;
  const out = [];
  for (const row of table.rows) {
    const said = (row[at] ?? '').trim();
    if (said !== 'yes' && said !== 'no') return null;
    if (said === 'yes') out.push(row[0].replace(/`/g, '').trim());
  }
  return out.length === 0 ? null : out;
}

/** The channels section 2 lets a case assert: the `asserts` row of its field table. */
export function channelNames(page) {
  const table = tableIn(page, CASE_SECTION, 'Field');
  if (table === null) return null;
  const row = table.rows.find((cells) => unticked(cells[0]) === 'asserts');
  if (row === undefined) return null;
  const listed = row[1].split('any of')[1];
  if (listed === undefined) return null;
  const names = [...listed.matchAll(/`([a-zA-Z]+)`/g)].map((match) => match[1]);
  return names.length === 0 ? null : names;
}

/**
 * The profiles section 8 lists, narrowest first.
 *
 * The order is the page's, and section 8 says a profile is cumulative, so a
 * case belongs to a claimed profile when its own profile is at or before the
 * claimed one in this list.
 */
export function profileOrder(page) {
  const table = tableIn(page, PROFILES_SECTION, 'Profile');
  if (table === null) return null;
  const names = table.rows.map((row) => unticked(row[0])).filter((name) => name !== null);
  return names.length === 0 ? null : names;
}

/** Whether a case's profile is inside a claimed one, by the order above. */
export function insideProfile(order, claimed, own) {
  const claimedAt = order.indexOf(claimed);
  const ownAt = order.indexOf(own);
  if (claimedAt === -1 || ownAt === -1) return false;
  return ownAt <= claimedAt;
}

/** The outcomes section 9 lets a case result carry, from its table. */
export function outcomeNames(page) {
  const table = tableIn(page, RUNNING_SECTION, 'Outcome');
  if (table === null) return null;
  const names = table.rows.map((row) => unticked(row[0])).filter((name) => name !== null);
  return names.length === 0 ? null : names;
}

/** The bounds section 6 caps a declared tolerance at. */
export function toleranceCaps(page) {
  const section = sectionOf(page, TOLERANCE_SECTION);
  if (section === null) return null;
  const found = /caps a declared tolerance at `rel = ([0-9.e-]+)` and `abs = ([0-9.e-]+)`/.exec(
    section.replace(/\n/g, ' '),
  );
  if (found === null) return null;
  const rel = Number(found[1]);
  const abs = Number(found[2]);
  if (!Number.isFinite(rel) || !Number.isFinite(abs)) return null;
  return { rel, abs };
}

/** The header line section 3 gives `bars.csv`: the first line of its fenced example. */
export function barsHeader(page) {
  const section = sectionOf(page, BARS_HEADING);
  if (section === null) return null;
  const fence = /```\n([^\n]*)\n/.exec(section);
  return fence === null || fence[1] === '' ? null : fence[1];
}
