/**
 * A range of wall clock hours, and where one reading sits inside it.
 *
 * Two different things in this repository are a range of hours: the
 * instrument's own trading session, which a host states in its instrument
 * record (`host-interface.md` 4.3), and the range a script writes for
 * `session.isIn` (`stdlib.md` 12.5). They are spelled differently and they mean
 * different things, but the arithmetic is one arithmetic, and it is here so
 * that it is one rule rather than two that can drift.
 *
 * **The open is inclusive and the close is exclusive**, so two ranges written
 * back to back cover every minute once and no minute twice. A range whose start
 * and end are the same minute holds nothing, which is what writing a zero length
 * range says.
 *
 * **A range whose end is before its start crosses midnight and is read that
 * way**, which is what an overnight session needs. The day list then names the
 * day the range opened on rather than the day the reading falls on, because a
 * session that opens on Friday evening and closes on Saturday morning is a
 * Friday session: reading the list against the reading's own day would drop
 * half of every overnight session and keep the wrong half.
 *
 * **A session is named by the day it opened on**, which is what tells two
 * readings in one session from two readings in two. Naming it by an instant
 * would be wrong across a seasonal clock change, where a wall clock hour inside
 * a session is not an hour of elapsed time.
 */
import type { Civil } from '../../stdlib/index.js';
import { dayNumber, weekdayOfDay } from '../../stdlib/index.js';

/** Minutes in a day, so the wrap is named rather than written as a number. */
const DAY = 1440;

/** Hours as minutes from midnight, and the days they open on. */
export interface Hours {
  readonly from: number;
  /** Minutes from midnight at the close, which may be at 24:00. */
  readonly to: number;
  /** The days it opens on, Monday as 1, or nothing for every day. */
  readonly days: readonly number[] | null;
}

/** Where one reading sits in a range of hours. */
export interface Standing {
  readonly inside: boolean;
  /** Minutes since the hours opened, zero on the minute they opened. */
  readonly elapsed: number;
  /** Minutes until they are scheduled to close. */
  readonly remaining: number;
  /** The day they opened on, which is the name of this one session. */
  readonly openingDay: number;
}

const OUTSIDE: Standing = { inside: false, elapsed: 0, remaining: 0, openingDay: 0 };

/** Where a wall clock reading sits in a range of hours, or outside every one. */
export function standingIn(hours: Hours, at: Civil): Standing {
  const minutes = at.hour * 60 + at.minute + at.second / 60;
  const today = dayNumber(at.year, at.month, at.day);

  if (hours.to > hours.from) {
    if (minutes < hours.from || minutes >= hours.to) return OUTSIDE;
    return held(hours, today, minutes - hours.from, hours.to - minutes);
  }
  if (hours.to === hours.from) return OUTSIDE;

  // Crossing midnight: the evening part belongs to today's session and the
  // morning part to yesterday's, which is the day the list is read against.
  if (minutes >= hours.from) {
    return held(hours, today, minutes - hours.from, DAY - minutes + hours.to);
  }
  if (minutes < hours.to) {
    return held(hours, today - 1, DAY - hours.from + minutes, hours.to - minutes);
  }
  return OUTSIDE;
}

/** Which trading day a reading belongs to, and how far into it. */
export interface Placement {
  /** The day number of the day the hours opened on. */
  readonly day: number;
  /** Minutes from that day's open: negative before it, past the close after it. */
  readonly elapsed: number;
}

/**
 * The trading day a wall clock reading belongs to, and the minutes since it
 * opened, for counting intraday buckets from the open (`compiled-program.md`
 * 2.16.2).
 *
 * Unlike `standingIn` it answers outside the hours as well, because a bar
 * outside them still has to land in some bucket: before the open it is a
 * negative count on the same day. The one reading that belongs to the day
 * before is the morning part of a range that crosses midnight, which is the
 * same rule `standingIn` applies inside the hours. The day list plays no part:
 * where a bucket begins is a question about the clock, and whether the day is
 * a trading day is not.
 */
export function placementIn(hours: Hours, at: Civil): Placement {
  const minutes = at.hour * 60 + at.minute + at.second / 60;
  const today = dayNumber(at.year, at.month, at.day);
  if (hours.to < hours.from && minutes < hours.to) {
    return { day: today - 1, elapsed: DAY - hours.from + minutes };
  }
  return { day: today, elapsed: minutes - hours.from };
}

function held(
  hours: Hours,
  openingDay: number,
  elapsed: number,
  remaining: number,
): Standing {
  if (hours.days !== null && !hours.days.includes(weekdayOfDay(openingDay))) return OUTSIDE;
  return { inside: true, elapsed, remaining, openingDay };
}
