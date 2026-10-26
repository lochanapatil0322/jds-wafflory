import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


class RateLimiter:
    """Allows at most max_calls requests per connection in per_seconds seconds."""

    def __init__(self, max_calls: int, per_seconds: int, message: str):
        self.max_calls = max_calls
        self.per_seconds = per_seconds
        self.message = message
        self.calls: dict[str, deque] = defaultdict(deque)

    def __call__(self, request: Request) -> None:
        now = time.monotonic()
        recent = self.calls[client_ip(request)]
        while recent and now - recent[0] > self.per_seconds:
            recent.popleft()
        if len(recent) >= self.max_calls:
            raise HTTPException(status_code=429, detail=self.message)
        recent.append(now)
        if len(self.calls) > 5000:  # keep memory small
            self.calls.clear()


class AttemptLimiter:
    """Counts only FAILED attempts, and blocks a connection that fails too often."""

    def __init__(self, max_failures: int, per_seconds: int, message: str):
        self.max_failures = max_failures
        self.per_seconds = per_seconds
        self.message = message
        self.failures: dict[str, deque] = defaultdict(deque)

    def _recent(self, request: Request) -> deque:
        now = time.monotonic()
        recent = self.failures[client_ip(request)]
        while recent and now - recent[0] > self.per_seconds:
            recent.popleft()
        return recent

    def check(self, request: Request) -> None:
        if len(self._recent(request)) >= self.max_failures:
            raise HTTPException(status_code=429, detail=self.message)

    def record_failure(self, request: Request) -> None:
        self._recent(request).append(time.monotonic())
        if len(self.failures) > 5000:
            self.failures.clear()



class KeyedAttemptLimiter:
    """Counts FAILED attempts per key (for example per order number),
    whoever the visitor is, and blocks the key after too many failures."""

    def __init__(self, max_failures: int, per_seconds: int, message: str):
        self.max_failures = max_failures
        self.per_seconds = per_seconds
        self.message = message
        self.failures: dict[str, deque] = defaultdict(deque)

    def _recent(self, key) -> deque:
        now = time.monotonic()
        recent = self.failures[str(key)]
        while recent and now - recent[0] > self.per_seconds:
            recent.popleft()
        return recent

    def check(self, key) -> None:
        if len(self._recent(key)) >= self.max_failures:
            raise HTTPException(status_code=429, detail=self.message)

    def record_failure(self, key) -> None:
        self._recent(key).append(time.monotonic())
        if len(self.failures) > 5000:
            self.failures.clear()