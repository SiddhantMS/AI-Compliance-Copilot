"""
AI COMPLIANCE COPILOT — HIGH-SPEED REDIS & MEMORY CACHING ENGINE
Provides sub-second response caching for repeat RAG queries and ticket list requests.
"""

import os
import time
import json
import logging
from typing import Optional, Any
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("cache")

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

# Redis Client Instance (or fallback in-memory dictionary)
_redis_client = None
_memory_cache = {}

try:
    import redis
    client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, socket_timeout=1)
    client.ping()
    _redis_client = client
    logger.info(f"Connected to Redis cache server at {REDIS_HOST}:{REDIS_PORT}")
except Exception:
    logger.info("Redis server unavailable. Using high-speed Python Memory Cache fallback.")
    _redis_client = None


def get_cache(key: str) -> Optional[Any]:
    """Retrieve value from Redis or Memory Cache by key."""
    if _redis_client:
        try:
            val = _redis_client.get(key)
            if val:
                return json.loads(val.decode("utf-8"))
        except Exception:
            pass

    # Memory cache fallback
    entry = _memory_cache.get(key)
    if entry:
        val, exp = entry
        if time.time() < exp:
            return val
        else:
            del _memory_cache[key]
    return None


def set_cache(key: str, value: Any, ttl_seconds: int = 3600) -> bool:
    """Store value in Redis or Memory Cache with specified TTL."""
    try:
        json_val = json.dumps(value)
        if _redis_client:
            try:
                _redis_client.setex(key, ttl_seconds, json_val)
                return True
            except Exception:
                pass

        # Memory cache fallback
        _memory_cache[key] = (value, time.time() + ttl_seconds)
        return True
    except Exception as e:
        logger.warning(f"Error setting cache key '{key}': {e}")
        return False


def invalidate_cache(key_pattern: str = None):
    """Clear memory or Redis cache keys."""
    global _memory_cache
    _memory_cache.clear()
    if _redis_client:
        try:
            _redis_client.flushdb()
        except Exception:
            pass
    logger.info("Cache flushed successfully.")
