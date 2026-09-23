import { randomBytes } from "node:crypto";
import { LIMITS, type Ticket } from "@theone/protocol";

const TICKET_BYTES = 32;
const MAX_OUTSTANDING = 10_000;

export class TicketStore {
  private readonly tickets = new Map<string, number>();

  constructor(
    private readonly ttlMs: number = LIMITS.ticketTtlMs,
    private readonly now: () => number = Date.now,
  ) {}

  issue(): Ticket {
    this.prune();
    if (this.tickets.size >= MAX_OUTSTANDING) {
      const oldest = this.tickets.keys().next().value;
      if (oldest !== undefined) this.tickets.delete(oldest);
    }
    const ticket = randomBytes(TICKET_BYTES).toString("base64url");
    const expiresAt = this.now() + this.ttlMs;
    this.tickets.set(ticket, expiresAt);
    return { ticket, expiresAt: new Date(expiresAt).toISOString() };
  }

  /** One-time use: a ticket is removed on the first attempt, valid or expired. */
  consume(ticket: string | null | undefined): boolean {
    if (!ticket) return false;
    const expiresAt = this.tickets.get(ticket);
    if (expiresAt === undefined) return false;
    this.tickets.delete(ticket);
    return expiresAt > this.now();
  }

  get size(): number {
    return this.tickets.size;
  }

  private prune(): void {
    const now = this.now();
    for (const [ticket, expiresAt] of this.tickets) {
      if (expiresAt <= now) this.tickets.delete(ticket);
    }
  }
}
