from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from time import monotonic


@dataclass(frozen=True)
class _CacheEntry[T]:
    value: T
    expires_at: float


class AsyncTTLCache[T]:
    """Small process-local TTL cache with per-key request coalescing."""

    def __init__(self, ttl_seconds: float):
        self.ttl_seconds = ttl_seconds
        self._entries: dict[str, _CacheEntry[T]] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    async def get_or_create(self, key: str, factory: Callable[[], Awaitable[T]]) -> T:
        cached = self._fresh_value(key)
        if cached is not None:
            return cached

        lock = self._locks.setdefault(key, asyncio.Lock())
        async with lock:
            cached = self._fresh_value(key)
            if cached is not None:
                return cached
            value = await factory()
            self._entries[key] = _CacheEntry(
                value=value,
                expires_at=monotonic() + self.ttl_seconds,
            )
            return value

    def clear(self) -> None:
        self._entries.clear()

    def _fresh_value(self, key: str) -> T | None:
        entry = self._entries.get(key)
        if entry is None:
            return None
        if entry.expires_at <= monotonic():
            self._entries.pop(key, None)
            return None
        return entry.value
