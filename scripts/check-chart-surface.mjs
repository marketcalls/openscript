/**
 * Chart surface check: what a program declares is what the chart is handed.
 *
 * The chart adapter is a mapping, and the way a mapping fails is not a crash.
 * It is one row of the table quietly not being written: a study declares two
 * grids and one is drawn, an alert computes a message from the bar that fired
 * and the notification carries the title instead, a band asks for a colour per
 * bar and is drawn in somebody else's. Every one of those compiles, runs to the
 * last bar and reports nothing anywhere, which is the failure this project
 * exists to prevent.
 *
 * So the mapping is checked rather than promised. This compiles one study that
 * declares two of everything the language can declare, builds a descriptor from
 * it, runs it over a short fixture, and then asks three questions.
 *
 * 1. **Is every declared field accounted for?** Each field of each declaration
 *    in `outputs` must be listed in `spec/chart-narrowings.json`, either as one
 *    the adapter carries or as one it cannot, with the reason it cannot. A field
 *    in neither is the shape of every defect above: something the compiler
 *    emits, nothing reads, and nobody wrote down. A field listed there that the
 *    format no longer has is stale and fails too, because a record nobody
 *    maintains is a record nobody can trust.
 *
 * 2. **Does the descriptor carry as many of each as the program declares?** A
 *    smaller number is allowed only where the record states the limit and says
 *    why. What a chart before a stated version has no room for, a second grid
 *    or a band coloured per bar, is built here as a host stating that version
 *    would build it and read back as drawn, and is refused with OS6024 below
 *    that version by a probe of its own in `lib/chart-refusals.mjs`.
 *
 * 3. **Does a setting the host stored reach the declaration it was written
 *    into?** An `input()` may be a declaration option, and until this check was
 *    widened the answer was no: `descriptorFor` took no settings at all, so a
 *    plot's width, a study's own precision and every other declared field read
 *    the default whatever a user had typed, while the engine beside it resolved
 *    the stored value. The record names which members resolve at build and
 *    which are asked for again per call, and one field of each kind is moved
 *    here to prove it.
 *
 * 4. **And does a stored value the engine will refuse stay out of it?** The
 *    answer to question 3 arrived with its own defect: a width of 99 against an
 *    input declared `max = 10` went into the declared shape as written, and a
 *    host can put that in a legend before it asks for a calculation. So the
 *    same field is moved twice more, once outside its declared bounds and once
 *    as a value of another type, and both the shape and the run are read: the
 *    shape holds the declared default and the run stops with OS6019. Either
 *    half alone is half a rule. A shape that refused to be built would be worse
 *    than both, because the dialog a reader corrects the setting in is built
 *    from it.
 *
 * The end of it is a handful of direct readings: the plot columns, the grid's
 * cells, the markers, the levels and the alert message a run computed. Those
 * are there because a field recorded as carried is still only a claim until
 * something reads the value out of a descriptor that was actually run.
 *
 * Run: node scripts/check-chart-surface.mjs [--list]
 */
import { existsSync, readFileSync } from 'node:fs';
import { CHART_ADAPTER_MODULE as ADAPTER_MODULE, CORE_MODULE, EMITTER_MODULE, fromRoot } from './lib/built.mjs';
import { gridsIn, hostFor, paintedBy, refusalProblems } from './lib/chart-refusals.mjs';
import { fieldsIn } from './lib/declared-fields.mjs';

const RECORD_PATH = 'spec/chart-narrowings.json';

/** The three built files this reads, as the working directory sees them. */
const CORE = fromRoot(CORE_MODULE);
const EMITTER = fromRoot(EMITTER_MODULE);
const ADAPTER = fromRoot(ADAPTER_MODULE);

/** The study this checks against: two of everything a version 1 file can declare. */
const SOURCE = `version 1

study("Surface", overlay = true, precision = 2)

len = input(5, "Length")
levelColor = input(gray, "Level colour")
fast = ema(close, len)
slow = ema(close, len * 2)

a = plot(fast, "Fast", aqua, width = input(2, "Line width", min = 1, max = 10))
b = plot(slow, "Slow", orange)
plotCandles(open, high, low, close, "Bars", colorUp = lime, colorDown = red)
fill(a, b, colorUp = aqua, colorDown = orange, opacity = 0.5)
fill(a, b, colorUp = close > open ? lime : none, colorDown = close < open ? red : none)

level(100, "Hundred", levelColor)
level(50, "Fifty", silver)

if close > open
    signal("UP", shape = "triangleUp", at = "below", color = lime)
if close < open
    signal("DOWN", shape = "triangleDown", at = "above", color = red)

first = table("First", 1, 2, position = "topLeft", bgColor = navy, borderWidth = 1)
cell(first, 0, 0, "close", textColor = white)
cell(first, 0, 1, text(close, 2))
second = table("Second", 1, 1, position = "bottomRight")
cell(second, 0, 0, "second")

if close > open
    alert("up at " + text(close, 2), id = "up", title = "Went up")
if close < open
    alert("down at " + text(close, 2), id = "down", title = "Went down", frequency = "once")

barColor(close > open ? lime : none)
background(close > open ? fade(aqua, 90) : none)
`;

/** The bars the fixture runs on: alternating, so both branches are taken. */
function bars(count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const open = 100 + i;
    const close = i % 2 === 0 ? open + 1 : open - 1;
    out.push({
      time: 1_748_736_000 + i * 60,
      open,
      close,
      high: Math.max(open, close) + 0.5,
      low: Math.min(open, close) - 0.5,
      volume: 100,
    });
  }
  return out;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(CORE) || !existsSync(ADAPTER)) {
  fail(
    `${ADAPTER} is not built, so this check would inspect nothing. Run \`npm run build\` first.\n` +
      'It runs the compiler and the adapter rather than reading their source, because what is ' +
      'being checked is what a host is handed.',
  );
}

const core = await import(CORE_MODULE);
const emitter = await import(EMITTER_MODULE);
const adapter = await import(ADAPTER_MODULE);

const record = JSON.parse(readFileSync(RECORD_PATH, 'utf8'));
const HOST = hostFor(record);
const problems = [];

/** The fixture, compiled, with any refusal reported rather than worked around. */
function compiled() {
  const file = core.sourceFile('chart-surface.oscript', SOURCE);
  const bag = new core.DiagnosticBag();
  const tokens = core.lex(file, bag);
  const script = core.parseTokens(file, tokens, bag);
  const checked = core.check(file, script, bag);
  const result = emitter.emit(file, checked, bag, {});
  const refused = bag.ordered().filter(core.isError);
  if (result.program === undefined || refused.length > 0) {
    fail(
      'the fixture study did not compile, so nothing was checked: ' +
        refused.map((one) => `${one.code} ${one.message}`).join('; '),
    );
  }
  return result.program;
}

const program = compiled();

// 1. Every declared field is either carried or recorded as one that cannot be.
for (const [output, declared] of Object.entries(program.outputs)) {
  const entry = record.outputs?.[output];
  if (entry === undefined) {
    problems.push(
      `${RECORD_PATH} says nothing about outputs.${output}, which the compiled program carries. ` +
        'List its fields as carried, or record each one that is not with the reason it cannot be.',
    );
    continue;
  }
  const narrowed = new Map((entry.narrowed ?? []).map((one) => [one.field, one.why ?? '']));
  const carried = new Set(entry.carried ?? []);
  const present = fieldsIn(declared);

  for (const field of present) {
    const inCarried = carried.has(field);
    const inNarrowed = narrowed.has(field);
    if (inCarried && inNarrowed) {
      problems.push(
        `outputs.${output}.${field} is recorded as carried and as narrowed. It is one or the other.`,
      );
    } else if (!inCarried && !inNarrowed) {
      problems.push(
        `outputs.${output}.${field} is declared by the compiled program and ${RECORD_PATH} does ` +
          'not mention it. Carry it into the descriptor and list it, or record why the chart has ' +
          'nowhere to put it. A field nobody has decided about is one the adapter drops in silence.',
      );
    }
  }
  for (const field of carried) {
    if (!present.has(field)) {
      problems.push(
        `${RECORD_PATH} lists outputs.${output}.${field} as carried and the compiled program has ` +
          'no such field. Remove the stale entry.',
      );
    }
  }
  for (const [field, why] of narrowed) {
    if (!present.has(field)) {
      problems.push(
        `${RECORD_PATH} records outputs.${output}.${field} as narrowed and the compiled program ` +
          'has no such field. Remove the stale entry.',
      );
    }
    if (why.trim().length === 0) {
      problems.push(`outputs.${output}.${field} is recorded as narrowed with no reason given.`);
    }
  }
}

// 2. The descriptor carries as many of each declaration as the program does.
const descriptor = adapter.descriptorFor(program, HOST);
const data = bars(12);
const settings = {};
const store = {};
const ctx = {
  barState: { isNew: true, isConfirmed: true, isRealtime: false, lastIndex: data.length - 1 },
  timezone: 'Etc/UTC',
  now: () => 1_748_736_000 + data.length * 60,
};
let values;
try {
  values = descriptor.calc(data, settings, store, ctx);
} catch (thrown) {
  fail(`the fixture study was refused on a host passing ${JSON.stringify(HOST)}, so nothing it declares was read back: ${thrown?.message ?? thrown}`);
}
const surface = { bars: data, values, settings };

const limits = new Map((record.counts ?? []).map((one) => [one.output, one]));
const counted = {
  plots: descriptor.plots.length,
  fills: (descriptor.fills ?? []).length,
  levels: (descriptor.levels?.({ ...settings, bars: data, values }) ?? []).length,
  alerts: (descriptor.alerts ?? []).length,
  tables: gridsIn(descriptor, surface).length,
};

for (const [output, carried] of Object.entries(counted)) {
  const declared = program.outputs[output].length;
  const limit = limits.get(output);
  if (limit === undefined) {
    if (carried < declared) {
      problems.push(
        `the program declares ${declared} of outputs.${output} and the descriptor carries ` +
          `${carried}. Carry them all, or record the limit and its reason in ${RECORD_PATH}.`,
      );
    }
    continue;
  }
  if ((limit.why ?? '').trim().length === 0) {
    problems.push(`${RECORD_PATH} limits outputs.${output} with no reason given.`);
  }
  if (carried !== Math.min(declared, limit.carries)) {
    problems.push(
      `${RECORD_PATH} says the descriptor carries ${limit.carries} of outputs.${output} and it ` +
        `carried ${carried} of ${declared}. Correct the record, or the adapter.`,
    );
  }
}
for (const output of limits.keys()) {
  if (!(output in counted)) {
    problems.push(`${RECORD_PATH} limits outputs.${output}, which this check does not count.`);
  }
}
problems.push(...refusalProblems({ core, emitter, adapter, record, recordPath: RECORD_PATH, bars: data, ctx, host: HOST }));

/**
 * 3. What was carried is read back out of a run.
 *
 * A record entry is a claim until a value comes out the other end, and each of
 * these is a claim that has been wrong: a plot with no column, a grid read per
 * bar, a marker on every bar, a level fixed before the data, an alert message
 * replaced by the title.
 */
function reading(what, got, wanted) {
  if (got !== wanted) problems.push(`${what}: the descriptor gave ${got}, and ${wanted} is right.`);
}

for (const plot of descriptor.plots) {
  if (values[plot.key] === undefined) {
    problems.push(`plot ${plot.key} has no column in the table the calculation returned.`);
  }
}

const grid = descriptor.table?.(surface);
reading('the grid the first declaration asks for', grid?.rows.length, 1);
reading('its declared column count', grid?.rows[0]?.length, 2);
reading('a cell the script wrote', grid?.rows[0]?.[0]?.text, 'close');
reading('a cell the second grid was written', gridsIn(descriptor, surface)[1]?.rows[0]?.[0]?.text, 'second');
const banded = [...paintedBy(descriptor.fills?.[1], surface)].map((one) => (/, 0\)$/.test(one) ? 'unpainted' : 'painted'));
reading('the second band, computed where a bar rose and absent where it fell', banded.sort().join(' and '), 'painted and unpainted');

const texts = new Set((descriptor.markers?.(surface) ?? []).map((one) => one.text));
for (const wanted of ['UP', 'DOWN']) {
  if (!texts.has(wanted)) problems.push(`the marker "${wanted}" reached no bar of the fixture.`);
}

for (const spec of descriptor.alerts ?? []) {
  if (typeof spec.message !== 'function') {
    problems.push(
      `alert ${spec.id} carries no message. The declaration has a message channel, the chart's ` +
        'entry takes a function of the bar it fired on, and a title in its place is the study ' +
        "saying nothing about what happened.",
    );
    continue;
  }
  const fired = [];
  for (let index = 0; index < data.length; index += 1) {
    if (spec.when({ ...surface, index })) fired.push(index);
  }
  if (fired.length === 0) {
    problems.push(`alert ${spec.id} fired on no bar of the fixture, so its message was not read.`);
    continue;
  }
  const first = fired[0];
  const message = spec.message({ ...surface, index: first });
  if (message === spec.title || !message.includes('at ')) {
    problems.push(
      `alert ${spec.id} on bar ${first} gave "${message}", which is not the message the script ` +
        'computed on that bar.',
    );
  }
}

/**
 * 4. A stored setting reaches the declared shape, and the record says when.
 *
 * A declaration option may be written as an `input()`, which is the reader's
 * way of changing something the declaration decides. The engine resolves such a
 * field against the settings it was loaded with; the descriptor's declared
 * shape is a set of values rather than a set of calls, so it can only resolve
 * one against settings a host states when it is built. It did not take any, and
 * every one of those fields read the declared default for the life of this
 * module: the number a user typed reached the plotted column and reached
 * nothing the chart drew it with.
 *
 * So the record names which members are resolved at build and which are asked
 * for again per call, and this proves both halves by moving one field of each
 * kind. A sentence saying when something resolves is exactly the sentence that
 * stays true in a file while stopping being true in the code.
 */
const STORED = { 'Line width': 4, levelColor: 'rgba(1, 2, 3, 1)' };
const DECLARED_WIDTH = 2;
const resolution = record.resolution ?? {};
const atBuild = new Set(resolution.atBuild?.members ?? []);
const perCall = new Set(resolution.perCall?.members ?? []);

if (atBuild.size === 0 || perCall.size === 0) {
  problems.push(
    `${RECORD_PATH} records no "resolution" members. Both halves are named there, because a ` +
      'descriptor with no half named is one whose settings behaviour nobody has decided.',
  );
}
for (const member of atBuild) {
  if (perCall.has(member)) {
    problems.push(`${RECORD_PATH} lists resolution member ${member} as both at build and per call.`);
  }
}
for (const member of Object.keys(descriptor)) {
  if (atBuild.has(member) || perCall.has(member)) continue;
  problems.push(
    `the descriptor carries ${member} and ${RECORD_PATH} does not say when it resolves a ` +
      'declaration field. Name it under resolution.atBuild or resolution.perCall. A member ' +
      'nobody has decided about is one whose answer to a settings change is whatever it happens ' +
      'to be.',
  );
}

const tuned = adapter.descriptorFor(program, { ...HOST, settings: STORED });
reading(
  'a plot width the script wrote as an input(), with nothing stored',
  descriptor.plots[0]?.style?.lineWidth,
  DECLARED_WIDTH,
);
reading(
  'the same width with the host\'s stored setting handed to descriptorFor',
  tuned.plots[0]?.style?.lineWidth,
  STORED['Line width'],
);

const levelsWith = (held) => descriptor.levels?.({ ...held, bars: data, values }) ?? [];
reading(
  'a level colour the script wrote as an input(), read against the call\'s own settings',
  levelsWith(STORED)[0]?.color,
  STORED.levelColor,
);
if (levelsWith({})[0]?.color === STORED.levelColor) {
  problems.push(
    'the level colour read the stored setting when the call was handed none, so the per-call ' +
      'half of the record proves nothing: the two settings maps have to give two answers.',
  );
}

/**
 * 4. A stored value the input's own declaration forbids reaches neither.
 *
 * The declared shape is built before a calculation is asked for, so it is what
 * a host holds while a settings map that cannot run is stored. The rule this
 * proves is one rule for both sides: the engine's own check decides what a
 * stored value is worth, a value it refuses reads as the declared default in
 * the shape, and the value still travels to the engine, so the run stops. The
 * three wrong implementations are all reachable from here: carrying the stored
 * value into the shape, which is what this found; repairing it on the way to
 * the engine, which is a dialog that ignores what a user typed; and refusing to
 * build the shape at all, which takes the dialog away.
 */
const WIDTH_BOUND = 10;
for (const forbidden of [99, 'wide', null]) {
  const held = { 'Line width': forbidden };
  const shape = adapter.descriptorFor(program, { ...HOST, settings: held });
  const width = shape.plots[0]?.style?.lineWidth;
  if (width !== DECLARED_WIDTH) {
    problems.push(
      `a stored width of ${JSON.stringify(forbidden)} against an input declared max = ` +
        `${WIDTH_BOUND} put ${JSON.stringify(width)} in the declared shape. A value the engine ` +
        'will refuse reads as the declared default there, because the shape is handed out ' +
        'before anything is calculated and a host draws a legend from it.',
    );
  }
  let refusal;
  try {
    shape.calc(data, held, {}, ctx);
  } catch (thrown) {
    refusal = thrown?.diagnostic?.code;
  }
  if (refusal !== 'OS6019') {
    problems.push(
      `a stored width of ${JSON.stringify(forbidden)} ran instead of being refused ` +
        `(${refusal ?? 'nothing was raised'}). The declared default in the shape is not a repair: ` +
        'the value the host stored still travels to the engine, so the reader is told which ' +
        'row and which bound rather than being shown a study drawn to a setting nobody chose.',
    );
  }
}

const unexercised = [...atBuild, ...perCall].filter((member) => !(member in descriptor));
if (process.argv.includes('--list')) {
  for (const [output, entry] of Object.entries(record.outputs ?? {})) {
    for (const one of entry.narrowed ?? []) console.log(`${output}.${one.field}: ${one.why}`);
  }
  for (const one of record.counts ?? []) {
    console.log(`${one.output}: ${one.carries} of however many are declared. ${one.why}`);
  }
  for (const one of record.refused ?? []) console.log(`refused ${one.key}, ${one.code}: ${one.why}`);
}

if (problems.length > 0) {
  fail(
    `Chart surface check failed with ${problems.length} problem` +
      `${problems.length === 1 ? '' : 's'}:\n- ${problems.join('\n- ')}`,
  );
}

const narrowings = Object.values(record.outputs ?? {}).reduce(
  (total, entry) => total + (entry.narrowed ?? []).length,
  0,
);
console.log(
  `Chart surface: every field of ${Object.keys(program.outputs).length} outputs is accounted for, ` +
    `${narrowings} of them recorded as narrowings, ${(record.counts ?? []).length} count limit ` +
    `recorded, ${(record.refused ?? []).length} refusals proved by a study that declares each, ` +
    'and the descriptor read back what it was asked for. A stored setting reached a ' +
    `declaration option at build and another at the call, over ${atBuild.size + perCall.size} ` +
    'members recorded as one or the other, and three stored values the input forbids reached ' +
    'the declared default in the shape and OS6019 from the run.',
);

if (unexercised.length > 0) {
  console.log(
    `\n${unexercised.length} recorded member${unexercised.length === 1 ? '' : 's'} the fixture ` +
      `does not declare, so nothing here classified ${unexercised.length === 1 ? 'it' : 'them'}: ` +
      `${unexercised.join(', ')}. They are named rather than passed over: a member this study ` +
      'never reaches is one whose row could be stale without anything saying so.',
  );
}
