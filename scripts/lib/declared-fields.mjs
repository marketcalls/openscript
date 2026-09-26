/**
 * The field names a compiled program's output declarations carry.
 *
 * `check-chart-surface.mjs` reads every one of them against
 * `spec/chart-narrowings.json`, so a field the compiler emits and nothing
 * decided about is a failure rather than a silent drop. The walk is here, apart
 * from the check, because it is the one part of that check that knows nothing
 * about charts.
 */

/**
 * Every field name one declaration carries, nested objects included.
 *
 * A nested object is walked one level and named `ohlc.colorUp`, because that is
 * where a candle plot's four colours and a grid's three style fields live, and a
 * record that stopped at `ohlc` would let four fields be dropped behind a name
 * that was accounted for.
 */
export function fieldsOf(declaration, prefix = '') {
  const names = new Set();
  for (const [name, value] of Object.entries(declaration)) {
    names.add(`${prefix}${name}`);
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // An input reference is a value, not a nested declaration: `{ input: key }`
      // is how a tunable field is written and its shape is not a field list.
      if ('input' in value) continue;
      for (const nested of fieldsOf(value, `${prefix}${name}.`)) names.add(nested);
    }
  }
  return names;
}

/** Every field name an output list carries, over all of its declarations. */
export function fieldsIn(declared) {
  const names = new Set();
  const list = Array.isArray(declared) ? declared : declared === null ? [] : [declared];
  for (const one of list) for (const name of fieldsOf(one)) names.add(name);
  return names;
}
