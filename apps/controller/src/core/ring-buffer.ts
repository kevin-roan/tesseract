export class RingBuffer<T> {
  private readonly items: (T | undefined)[];
  private start = 0;
  private count = 0;

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError("RingBuffer capacity must be a positive integer");
    this.items = new Array<T | undefined>(capacity);
  }

  get size(): number {
    return this.count;
  }

  push(item: T): void {
    const index = (this.start + this.count) % this.capacity;
    this.items[index] = item;
    if (this.count < this.capacity) this.count += 1;
    else this.start = (this.start + 1) % this.capacity;
  }

  last(n: number): T[] {
    const wanted = Math.floor(n);
    const take = wanted > 0 ? Math.min(wanted, this.count) : 0;
    const result: T[] = [];
    for (let i = this.count - take; i < this.count; i += 1) {
      result.push(this.items[(this.start + i) % this.capacity] as T);
    }
    return result;
  }

  toArray(): T[] {
    return this.last(this.count);
  }
}
