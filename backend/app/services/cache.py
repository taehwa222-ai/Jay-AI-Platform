from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from time import monotonic


@dataclass(frozen=True)
class _CacheEntry[T]:
    value: T
    expires_at: float


@dataclass(frozen=True)
class CacheSnapshot:
    name: str
    ttl_seconds: float
    entries: int
    requests: int
    hits: int
    misses: int
    loads: int
    load_errors: int
    coalesced_waits: int
    hit_rate: float
    last_hit_at: datetime | None
    last_miss_at: datetime | None
    last_load_at: datetime | None


class AsyncTTLCache[T]:
    """Small process-local TTL cache with per-key request coalescing."""

    def __init__(self, ttl_seconds: float, *, name: str = "cache"):
        self.ttl_seconds = ttl_seconds
        self.name = name
        self._entries: dict[str, _CacheEntry[T]] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._requests = 0
        self._hits = 0
        self._misses = 0
        self._loads = 0
        self._load_errors = 0
        self._coalesced_waits = 0
        self._last_hit_at: datetime | None = None
        self._last_miss_at: datetime | None = None
        self._last_load_at: datetime | None = None

    async def get_or_create(self, key: str, factory: Callable[[], Awaitable[T]]) -> T:
        self._requests += 1
        cached = self._fresh_value(key)
        if cached is not None:
            self._hits += 1
            self._last_hit_at = datetime.now(UTC)
            return cached

        lock = self._locks.setdefault(key, asyncio.Lock())
        if lock.locked():
            self._coalesced_waits += 1
        async with lock:
            cached = self._fresh_value(key)
            if cached is not None:
                self._hits += 1
                self._last_hit_at = datetime.now(UTC)
                return cached
            self._misses += 1
            self._last_miss_at = datetime.now(UTC)
            try:
                value = await factory()
            except Exception:
                self._load_errors += 1
                raise
            self._entries[key] = _CacheEntry(
                value=value,
                expires_at=monotonic() + self.ttl_seconds,
            )
            self._loads += 1
            self._last_load_at = datetime.now(UTC)
            return value

    def clear(self) -> None:
        self._entries.clear()

    def snapshot(self) -> CacheSnapshot:
        self._prune_expired()
        hit_rate = self._hits / self._requests if self._requests else 0.0
        return CacheSnapshot(
            name=self.name,
            ttl_seconds=self.ttl_seconds,
            entries=len(self._entries),
            requests=self._requests,
            hits=self._hits,
            misses=self._misses,
            loads=self._loads,
            load_errors=self._load_errors,
            coalesced_waits=self._coalesced_waits,
            hit_rate=round(hit_rate, 4),
            last_hit_at=self._last_hit_at,
            last_miss_at=self._last_miss_at,
            last_load_at=self._last_load_at,
        )

    def _fresh_value(self, key: str) -> T | None:
        entry = self._entries.get(key)
        if entry is None:
            return None
        if entry.expires_at <= monotonic():
            self._entries.pop(key, None)
            return None
        return entry.value

    def _prune_expired(self) -> None:
        now = monotonic()
        expired = [key for key, entry in self._entries.items() if entry.expires_at <= now]
        for key in expired:
            self._entries.pop(key, None)
