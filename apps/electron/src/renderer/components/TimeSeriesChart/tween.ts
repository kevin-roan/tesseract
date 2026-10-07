import { CHART } from "./constants";
import { easeOut } from "./scale";

export class Tween {
  private from: number;
  private to: number;
  private start = 0;

  constructor(
    value: number,
    private readonly duration: number = CHART.tweenDurationS,
  ) {
    this.from = value;
    this.to = value;
  }

  get target(): number {
    return this.to;
  }

  set(target: number, now: number, animate = true): void {
    if (target === this.to) return;
    this.from = animate ? this.value(now) : target;
    this.to = target;
    this.start = now;
  }

  value(now: number): number {
    if (this.duration <= 0) return this.to;
    const progress = (now - this.start) / this.duration;
    if (progress >= 1) return this.to;
    return this.from + (this.to - this.from) * easeOut(progress);
  }

  running(now: number): boolean {
    return this.from !== this.to && now - this.start < this.duration;
  }
}
