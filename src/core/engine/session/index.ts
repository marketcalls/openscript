/**
 * Sessions: the instrument's own trading hours, and the ones a script writes.
 *
 * One module because they are one arithmetic. The instrument's hours come from
 * the host's record (`host-interface.md` 4.3) and produce the per-bar facts of
 * `stdlib.md` 12.4; the script's are the spec string of 12.5 and produce one
 * test. Both read the same hours the same way, and keeping them behind one door
 * is what stops a script's overnight range and an instrument's overnight
 * session coming to disagree about which day a session belongs to.
 *
 * The hours themselves are behind the door rather than on it. Two spellings
 * reach them, and a third caller reading them raw would be a third spelling.
 */
export type { SessionFacts, SessionHours, SessionReader } from './record.js';
export { NO_SESSION, recordProblem, sessionReader, tradingDayOf } from './record.js';
export type { Placement } from './hours.js';

export { sessionHolds } from './spec.js';
