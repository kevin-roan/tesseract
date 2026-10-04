/** Maps browser pointer ids to the lowest free slot in `0..size-1` (Android pointer ids). */
export class PointerSlots {
  private readonly slots = new Map<number, number>();

  constructor(private readonly size: number) {}

  acquire(pointerId: number): number | null {
    const existing = this.slots.get(pointerId);
    if (existing !== undefined) return existing;
    const used = new Set(this.slots.values());
    for (let slot = 0; slot < this.size; slot += 1) {
      if (!used.has(slot)) {
        this.slots.set(pointerId, slot);
        return slot;
      }
    }
    return null;
  }

  get(pointerId: number): number | null {
    return this.slots.get(pointerId) ?? null;
  }

  release(pointerId: number): number | null {
    const slot = this.slots.get(pointerId);
    this.slots.delete(pointerId);
    return slot ?? null;
  }

  releaseAll(): void {
    this.slots.clear();
  }
}
