from .scale import ease_out

DURATION_S = 0.35


class Tween:
    def __init__(self, value: float, duration_s: float = DURATION_S) -> None:
        self._from = value
        self._to = value
        self._start = 0.0
        self._duration = duration_s

    @property
    def target(self) -> float:
        return self._to

    def set(self, target: float, now: float, animate: bool = True) -> None:
        if target == self._to:
            return
        self._from = self.value(now) if animate else target
        self._to = target
        self._start = now

    def value(self, now: float) -> float:
        if self._duration <= 0:
            return self._to
        progress = (now - self._start) / self._duration
        if progress >= 1:
            return self._to
        return self._from + (self._to - self._from) * ease_out(progress)

    def running(self, now: float) -> bool:
        return self._from != self._to and now - self._start < self._duration
