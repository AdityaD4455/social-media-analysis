"""
services/cache.py — Simple in-memory TTL cache
"""
import time
from typing import Any, Optional
from core.config import settings

_store: dict = {}  # key → (value, expires_at)


def get(key: str) -> Optional[Any]:
    """Retrieve a cached value, or None if expired/absent."""
    entry = _store.get(key)
    if entry is None:
        return None
    value, expires_at = entry
    if time.time() > expires_at:
        del _store[key]
        return None
    return value


def set(key: str, value: Any, ttl: Optional[int] = None) -> None:
    """Store a value with TTL (defaults to settings.cache_ttl_seconds)."""
    if ttl is None:
        ttl = settings.cache_ttl_seconds
    _store[key] = (value, time.time() + ttl)
    # Evict if over limit
    if len(_store) > settings.max_cache_items:
        oldest = min(_store.items(), key=lambda x: x[1][1])
        del _store[oldest[0]]


def delete(key: str) -> None:
    """Delete a cached key."""
    _store.pop(key, None)


def clear() -> None:
    """Clear the entire cache."""
    _store.clear()


def stats() -> dict:
    """Return cache statistics."""
    now = time.time()
    alive = sum(1 for _, (_, exp) in _store.items() if exp > now)
    return {"total_keys": len(_store), "alive_keys": alive}
