/**
 * An adapter that claims the narrowest profile and can answer no case.
 *
 * Two things are asserted with it, and they were one until `core` had cases.
 *
 * A runner that reads profiles the way section 8 says never hands this file a
 * `strategy` case. One that does gets an exit code that is not zero and a
 * reason on standard error, which the runner reports as an error.
 *
 * And a `core` case IS handed to it, because it claims `core`. It answers none
 * of them, so the run fails. That is the Phase 7 gate working: an engine that
 * implements nothing does not pass. While every case in the tree was
 * `strategy`, this file was handed nothing at all and the run was reported as
 * a pass, which is the outcome the test beside it used to assert.
 */
const [flag] = process.argv.slice(2);

if (flag === '--describe') {
  process.stdout.write(
    `${JSON.stringify({ name: 'narrow', version: '0', profile: 'core', languageVersions: [1], schemaVersion: '1.1' })}\n`,
  );
} else {
  console.error('narrow was handed a case outside its profile');
  process.exit(3);
}
