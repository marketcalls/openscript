/**
 * The destination a backtest runs against: intents in, frames out.
 *
 * **This is a host, not part of the engine**, and the division is the one thing
 * to keep straight while reading it. `stdlib.md` 17.1 puts slippage and
 * commission on the destination: the engine folds the price it is told and
 * never adjusts one, so the price worsening below is a venue giving a worse
 * fill, which is what a venue does, and not an engine moving a number, which is
 * what the invariant forbids. Everything here could be a broker.
 *
 * **A frame is cumulative and reaches the engine between bars.** Every frame
 * restates the whole life of one order from its beginning, so a repeat costs
 * nothing, and none of them is handed over during an execution: they are
 * answered here and collected at the boundary, which is where
 * `host-interface.md` 7.4 puts the intake.
 *
 * **When a fill is known is not when it happened.** A market order decided at
 * the close of a bar and filled at the next bar's open is known at that open,
 * so its frame is delivered before that bar executes and the strategy holds the
 * position for the whole of it. An order that rested and traded somewhere
 * inside a bar is only known to have traded once that bar is complete, so its
 * frame is delivered before the bar after it. Both are the truthful reading of
 * what a venue could have told anybody at the time, and the difference between
 * them is why they are not folded together.
 *
 * **A bracket is answered with nothing at all**, exactly as a venue with no
 * order to report would answer. A bracket reaches a destination as a protective
 * instruction attached to a tag and the engine appends no row for it, so there
 * is nothing for a frame to be about: a fill reported against one would name an
 * intent no row holds and the fold would refuse it. The row a bracket wants is
 * decision 55 and it is not in this release, so a stop cannot fill here and a
 * page that says it can is ahead of the engine.
 *
 * **A destination that behaves badly does it on a schedule, stated before the
 * run and never by chance.** Every case harvested before this one ran against a
 * venue that filled every order whole and on time, so two engines were proved
 * to agree about the half of a day that costs nobody anything. The other half
 * is a partial fill, an order arriving in pieces, a rejection, a cancellation,
 * an expiry and a fill that turns up after the order has ended, and
 * `SimulatorOptions.fill` carries the schedule saying which order each of those
 * happens to and at which boundary. There is no random number here and there
 * will not be one: `stdlib.md` 8.2 keeps a script that answers differently on a
 * second run out of a conformance suite, and a venue rolling a die would make
 * every case it wrote unreproducible in the same breath. **An order the
 * schedule names is answered by the schedule and by nothing else**, so a run
 * stating none is the run the cases before this one were harvested from, to the
 * bit, which is what lets this exist at all.
 */
import type { Contract } from '../accounting/index.js';
import type { OrderFrame, OrderIntent, OrderSide, RoutedEffect } from '../engine/index.js';
import type { RecordedBar } from './record.js';
import { testResting } from './resting.js';
import type { RestingOrder } from './resting.js';
import { ENDED } from './acts.js';
import type { VenueAct, VenuePolicy } from './acts.js';

/** What the venue prices against and how it decides a fill. */
export interface SimulatorOptions {
  readonly bars: readonly RecordedBar[];
  readonly contract: Contract;
  readonly fill: VenuePolicy;
  /** Adverse always, in ticks, applied to a market fill and to a stop. */
  readonly slippageTicks: number;
  /** The declaration's own fill rule: where a market order is priced. */
  readonly fillOn: string;
}

/** One order this venue holds, and what it has said about it. */
interface Order {
  readonly intent: OrderIntent;
  readonly ref: string;
  readonly placedOn: number;
  /** Absent on a market order, which rests on nothing. */
  readonly rest: RestingOrder | null;
  /** The acts the schedule states about this order, in the order they were stated. */
  readonly acts: readonly VenueAct[];
  filledQty: number;
  /** This venue's average over `filledQty`, absent while nothing has filled. */
  avgPrice: number | null;
  live: boolean;
  /** Whether a stop limit has reached its trigger and is now a limit. */
  triggered: boolean;
}

/** `language.md` 13.3: a market order priced at the close of its own bar. */
const AT_CLOSE = 'close';

/**
 * A venue, for one run.
 *
 * It holds the orders it was handed and nothing else: no position, no money and
 * no view of what the strategy is doing, because a destination has none of
 * those about somebody else's strategy.
 */
export class Simulator {
  private readonly options: SimulatorOptions;
  private readonly orders: Order[] = [];
  /** The intents handed over, in the order they were, whatever became of them. */
  readonly intents: OrderIntent[] = [];
  /** Brackets, held so that a run can say how many it was handed and answered. */
  readonly brackets: OrderIntent[] = [];
  private queued: Order[] = [];
  private answered: OrderFrame[] = [];
  private refs = 0;
  private seq = 0;

  constructor(options: SimulatorOptions) {
    this.options = options;
  }

  /** Step 9: what the strategy decided reaches the venue. */
  route(effect: RoutedEffect, barIndex: number): void {
    for (const intent of effect.intents) {
      this.intents.push(intent);
      if (intent.kind === 'bracket') {
        this.brackets.push(intent);
        continue;
      }
      if (intent.kind === 'cancel') {
        this.withdraw(intent, barIndex);
        continue;
      }
      this.accept(intent, barIndex);
    }
  }

  /**
   * The frames a boundary hands over: everything this venue can say now.
   *
   * The orders that were already resting are decided against this bar first and
   * the orders this bar sent are answered after, which is the order the venue
   * learned of them in.
   */
  framesFor(barIndex: number): readonly OrderFrame[] {
    const bar = this.options.bars[barIndex];
    if (bar !== undefined) {
      for (const order of this.orders) {
        // An order the schedule names is answered by the schedule, whether or
        // not it is still live: a fill after a cancellation is the one thing
        // this exists for and the order is dead by then.
        if (order.acts.length > 0) {
          if (order.placedOn < barIndex) this.perform(order, bar, barIndex);
          continue;
        }
        if (!order.live || order.rest === null || order.placedOn >= barIndex) continue;
        this.decide(order, bar, barIndex);
      }
    }

    const sent = this.queued;
    this.queued = [];
    for (const order of sent) this.open(order, barIndex);

    const out = this.answered;
    this.answered = [];
    return out;
  }

  /** How many orders this venue is still holding, which a run reports. */
  get working(): number {
    return this.orders.filter((order) => order.live).length;
  }

  /** An order the strategy sent, which this venue now holds. */
  private accept(intent: OrderIntent, barIndex: number): void {
    this.refs += 1;
    // The ordinal of this order among the orders taken, which is what an act
    // names. Read before the order joins them, so the first is one.
    const ordinal = this.orders.length + 1;
    const order: Order = {
      intent,
      ref: refOf(this.refs),
      placedOn: barIndex,
      rest: restingFor(intent),
      acts: (this.options.fill.schedule ?? []).filter((act) => act.order === ordinal),
      filledQty: 0,
      avgPrice: null,
      live: true,
      triggered: false,
    };
    this.orders.push(order);
    this.queued.push(order);
  }

  /**
   * A cancellation, which is about the orders a tag names and not about itself.
   *
   * Every live order carrying the tag is withdrawn and answered, which is what
   * releases the position they were claiming, and the cancellation is then
   * answered as an order of its own, because the engine appended a row for it
   * and a row nothing ever answers stays at `placed` for the life of the run.
   */
  private withdraw(intent: OrderIntent, barIndex: number): void {
    for (const order of this.orders) {
      if (!order.live || order.intent.tag !== intent.tag) continue;
      order.live = false;
      this.say(order.intent, order.ref, 'cancelled', order.filledQty, null, barIndex);
    }
    // The cancellation is confirmed after what it withdrew, which is the order
    // a venue does it in: the request is answered once it has been carried out.
    this.refs += 1;
    this.say(intent, refOf(this.refs), 'cancelled', 0, null, barIndex);
  }

  /**
   * The first thing a venue says about an order it has taken.
   *
   * A working frame before any fill, because 7.4 asks for a frame on every
   * change of status and a script waiting for a working order to clear waits
   * blind without one. A market order is then filled in the same breath where
   * the declaration prices it at this bar's close, and at the next bar's open
   * where it does not.
   */
  private open(order: Order, barIndex: number): void {
    // A scheduled order is answered by its schedule from its first breath. The
    // acknowledgement below is a thing this venue chooses to say, so a schedule
    // that wants one states it, and one that wants the destination to sit on an
    // order and say nothing gets that instead.
    if (order.acts.length > 0) {
      const bar = this.options.bars[barIndex];
      if (bar !== undefined) this.perform(order, bar, barIndex);
      return;
    }
    this.say(order.intent, order.ref, 'working', 0, null, barIndex);
    if (order.rest !== null) return;

    const atClose = this.options.fillOn === AT_CLOSE;
    const bar = this.options.bars[atClose ? barIndex : barIndex + 1];
    const price = atClose ? (bar?.close ?? null) : (bar?.open ?? null);
    // A market order sent on the last bar of a run and priced at the next open
    // has no next open. It stays working and is reported as an order the run
    // ended holding, which is what it is.
    if (price === null) return;
    this.complete(order, this.worsen(price, order.intent.side), barIndex);
  }

  /** One resting order against one bar. */
  private decide(order: Order, bar: RecordedBar, barIndex: number): void {
    const rest = order.rest;
    if (rest === null) return;
    const outcome = testResting(order.triggered ? asLimit(rest) : rest, bar, this.options.fill);
    if (!outcome.filled) {
      if (outcome.triggered) order.triggered = true;
      return;
    }
    const price = outcome.slips ? this.worsen(outcome.price, order.intent.side) : outcome.price;
    this.complete(order, price, barIndex);
  }

  /**
   * The whole of an order, filled at one price.
   *
   * **The quantity is converted into units here, because that is what a fill
   * is counted in and what every money figure is folded over.** A quantity
   * travels in the unit its intent names (`host-interface.md` 7.1) and the
   * destination is the party that converts it. This filled the number verbatim,
   * so a strategy sizing in lots on a lot of sixty five traded one sixty fifth
   * of what it asked for and the whole report was out by that factor. The units
   * this destination cannot arrive at are refused before the first bar rather
   * than guessed at here, so by this point the unit is one of two.
   */
  private complete(order: Order, price: number, barIndex: number): void {
    const qty = this.unitsOf(order.intent);
    order.filledQty = qty;
    order.avgPrice = price;
    order.live = false;
    this.say(order.intent, order.ref, 'filled', qty, price, barIndex);
  }

  /**
   * The acts due at this boundary, in the order the schedule stated them.
   *
   * Due is counted from the bar that sent the order, so an act names a moment
   * in the life of its own order rather than a bar of the run. Two acts due
   * together are answered as written, which is how a schedule states a
   * cancellation and the fill that raced it.
   *
   * Liveness is not consulted. An order that has ended can still be spoken
   * about, because the frame that arrives after it ended is the whole reason
   * this is here: `stdlib.md` 17.8's fill after a terminal status, which a
   * venue sends whenever a cancel races a fill and which an engine refusing it
   * loses, leaving a position the strategy cannot see.
   */
  private perform(order: Order, bar: RecordedBar, barIndex: number): void {
    for (const act of order.acts) {
      if (order.placedOn + act.afterBars !== barIndex) continue;
      if (act.does === 'fill') {
        this.report(order, act, bar, barIndex);
        continue;
      }
      // The order ends, reporting what it filled before it ended, because a
      // frame is cumulative: `stdlib.md` 17.8 has the row keeping the terminal
      // word and the quantity recording what traded, both true at once.
      order.live = false;
      const ended = ENDED[act.does];
      const price = order.filledQty > 0 ? order.avgPrice : null;
      this.say(order.intent, order.ref, ended, order.filledQty, price, barIndex, act.text ?? '');
    }
  }

  /**
   * A fill the schedule stated, at this bar's close and worsened like any other.
   *
   * **The average is this venue's own, over the cumulative quantity**, the
   * figure `stdlib.md` 17.8 step 3 says the row takes whole. A venue reporting
   * the last piece's price and calling it an average hands the engine a number
   * that is not one, and the engine may not work its own out from two of them,
   * so the lie settles into the ledger and into every trade folded from it.
   *
   * A stated quantity at or below what this venue has already reported adds
   * nothing and moves nothing: that is a repeated or a stale frame, which a real
   * destination sends and the fold has to swallow. It carries the average this
   * venue holds now rather than then, because it keeps no history of its own
   * averages and the fold ignores the price of a frame adding no quantity. A
   * bar with no close prices nothing, so an act due at one says nothing rather
   * than raising a quantity with no price against it, which step 3 refuses.
   */
  private report(order: Order, act: VenueAct, bar: RecordedBar, barIndex: number): void {
    const whole = this.unitsOf(order.intent);
    const stated = act.units ?? whole;
    const delta = stated - order.filledQty;
    if (delta > 0) {
      if (bar.close === null) return;
      // Written in this order and left in it: the source order of a sum is
      // what decides its last bit, and a case harvested from this venue is
      // asserted to the bit.
      const price = this.worsen(bar.close, order.intent.side);
      order.avgPrice = ((order.avgPrice ?? 0) * order.filledQty + price * delta) / stated;
      order.filledQty = stated;
      if (order.filledQty >= whole) order.live = false;
    }
    // `working` is live and not completely filled, `filled` is the whole
    // quantity: 17.7's two words read off the quantity rather than stated
    // twice by a schedule that could disagree with the number beside them.
    const status = order.filledQty >= whole ? 'filled' : 'working';
    const price = stated > 0 ? order.avgPrice : null;
    this.say(order.intent, order.ref, status, stated, price, barIndex, act.text ?? '');
  }

  /**
   * The order's quantity in units, which is what a fill is counted in.
   *
   * The conversion `complete` did inline, wanted in two places the moment a
   * schedule can fill an order in pieces: the whole a piece is measured
   * against has to be the number the fill path would have reported.
   *
   * **The unit is the intent's own and never the declaration's.**
   * `host-interface.md` 7.1 passes a quantity with the unit it was counted in,
   * and a quantity the engine worked out from filled quantities, which every
   * `close()` with no quantity is, states units whatever the declaration counts
   * in. This read the declaration's unit instead, so under `qtyType = "lots"`
   * the close of a one lot long of sixty five units was multiplied again and
   * sold sixty five lots, leaving a short of four thousand one hundred and sixty
   * units that a long-only strategy never closed. Every strategy sized in lots
   * was wrong from its first exit. The units the declaration cannot convert are
   * refused before the first bar by `checkSettings`, so only units and lots
   * reach here.
   */
  private unitsOf(intent: OrderIntent): number {
    const stated = intent.qty ?? 0;
    const lot = this.options.contract.lotSize;
    return intent.qtyType === 'lots' && lot !== null && lot > 0 ? stated * lot : stated;
  }

  /**
   * A price worsened by the slippage the run was carried out under.
   *
   * **Adverse always: a buy pays more and a sell receives less.** The sign is
   * taken as written rather than as a magnitude, because a slippage below zero
   * is refused before the first bar and taking its magnitude here would be this
   * function quietly covering for a hole in that refusal. It went uncovered for
   * a while: `scheduleProblem` has always refused a negative rate, and
   * `checkSettings` asked it only about a schedule the host supplied, so a
   * declaration stating a slippage of minus one improved both sides of every
   * fill and the backtest paid the strategy to trade.
   *
   * A slippage in ticks with no tick size to measure a tick in charges nothing.
   * The comment here once said that was refused before the first bar and it was
   * not; it still is not, because an instrument with no tick is a fact a host
   * may legitimately not hold, and a run that charges no slippage is a study
   * before slippage rather than a wrong answer. What has changed is that this
   * says so instead of claiming a refusal that never existed.
   */
  private worsen(price: number, side: OrderSide | null): number {
    const tick = this.options.contract.tickSize;
    if (tick === null || this.options.slippageTicks === 0) return price;
    const move = this.options.slippageTicks * tick;
    return side === 'sell' ? price - move : price + move;
  }

  /** One frame, cumulative, in the order this venue spoke. */
  private say(
    intent: OrderIntent,
    ref: string,
    status: string,
    filledQty: number,
    avgFillPrice: number | null,
    barIndex: number,
    text = '',
  ): void {
    this.seq += 1;
    this.answered.push({
      intentId: intent.intentId,
      status,
      filledQty,
      avgFillPrice,
      orderRef: ref,
      sentInstrument: intent.instrument,
      sentProduct: intent.product,
      time: this.options.bars[barIndex]?.time ?? null,
      text,
      seq: this.seq,
    });
  }
}

/** This venue's own reference for an order, which the engine records and never parses. */
function refOf(count: number): string {
  return 'ORD-' + String(count);
}

/** The resting order an intent is, or nothing where it is a market order. */
function restingFor(intent: OrderIntent): RestingOrder | null {
  if (intent.type === null || intent.type === 'market' || intent.side === null) return null;
  return { side: intent.side, type: intent.type, limit: intent.limit, trigger: intent.trigger };
}

/** A stop limit that has triggered, which is a limit from that moment on. */
function asLimit(rest: RestingOrder): RestingOrder {
  return { side: rest.side, type: 'limit', limit: rest.limit, trigger: null };
}
