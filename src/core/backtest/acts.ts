/**
 * What a simulated destination does to the orders a schedule names.
 *
 * Split from `simulate.ts`, which is the venue, because a schedule is a
 * statement made before the run about how the venue behaves, and the words it
 * is written in are read by the harvest and the record as well as by the venue.
 * The reasoning for having a schedule at all is in that file's header.
 */
import type { FillPolicy } from './settings.js';

/**
 * What this destination does to one order, at one boundary.
 *
 * Four words reaching every status of `stdlib.md` 17.7 a host may send. `fill`
 * carries the cumulative quantity, so one word covers the acknowledgement
 * before anything has traded, a fill of part of the order and a fill of the
 * whole of it: `working` and `filled` are that quantity read against the
 * order's own rather than two instructions. The other three are the three ways
 * an order ends carrying less than it asked for, and an engine never handed
 * one has never been asked what it does with the quantity still working.
 */
export type VenueDoes = 'fill' | 'reject' | 'cancel' | 'expire';

/** One act of the schedule: what the destination does, to which order, when. */
export interface VenueAct {
  /**
   * The nth order this destination took, counting from one.
   *
   * Orders and not intents: a bracket is never taken and a cancellation is
   * answered without being held, so neither is counted and neither can be named
   * here. An ordinal for the reason `conformance.md` section 3 gives a case's
   * own frames: nobody writing a schedule knows the id an engine will mint.
   */
  readonly order: number;
  /**
   * Boundaries after the one the order arrived at, `0` being that boundary.
   *
   * Counted from the order rather than stated as a bar index, because the bar
   * a strategy decides an order on moves the moment anything else about the run
   * does, and a schedule in bar indices is one nobody can read back.
   */
  readonly afterBars: number;
  readonly does: VenueDoes;
  /**
   * The cumulative quantity a fill reports, in units, or absent for all of it.
   *
   * Cumulative because a frame is (`stdlib.md` 17.8): `0` is the
   * acknowledgement a venue sends before anything has traded, a number below
   * the order's own is a partial fill, and one at or above it completes the
   * order. A quantity below what this venue has already reported is a stale
   * frame, which a venue really sends and the fold has to swallow, so it is
   * stated here rather than refused.
   */
  readonly units?: number | null;
  /** The destination's own text, which the ledger records against the row. */
  readonly text?: string;
}

/**
 * The fill policy, and what this destination does to the orders it names.
 *
 * The schedule sits on the policy because it is the same kind of fact: how this
 * destination decides a fill, chosen before the first bar and carried in the
 * record beside the policy's own version, so a stored run replays as it ran.
 */
export interface VenuePolicy extends FillPolicy {
  readonly schedule?: readonly VenueAct[];
}

/**
 * The word this venue reports each ending under.
 *
 * A destination with words of its own maps them onto the vocabulary in its
 * adapter, which is where `stdlib.md` 17.7 puts the mapping because a status
 * vocabulary differs per destination. This is this one's, and the whole of what
 * a schedule's verb means.
 */
export const ENDED: Readonly<Record<Exclude<VenueDoes, 'fill'>, string>> = {
  reject: 'rejected',
  cancel: 'cancelled',
  expire: 'expired',
};
