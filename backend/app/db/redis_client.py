"""
Redis client for working memory (24h TTL)
"""
from typing import Any, Optional
import json
import redis.asyncio as redis

from app.core.config import get_settings

settings = get_settings()


class RedisClient:
    """Async Redis client for working memory."""
    
    _instance: Optional["RedisClient"] = None
    _pool: Optional[redis.ConnectionPool] = None
    
    def __new__(cls) -> "RedisClient":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    async def connect(self) -> None:
        """Initialize Redis connection pool."""
        if self._pool is None:
            self._pool = redis.ConnectionPool.from_url(
                settings.redis_url,
                decode_responses=True,
            )
    
    @property
    def client(self) -> redis.Redis:
        """Get Redis client from pool."""
        if self._pool is None:
            raise RuntimeError("Redis not connected. Call connect() first.")
        return redis.Redis(connection_pool=self._pool)
    
    async def close(self) -> None:
        """Close Redis connection pool."""
        if self._pool is not None:
            await self._pool.disconnect()
            self._pool = None
    
    # Working Memory Operations (24h TTL)
    
    async def set_working_memory(
        self, 
        user_id: str, 
        key: str, 
        value: Any, 
        ttl_seconds: int = 86400  # 24 hours
    ) -> None:
        """Store data in working memory with TTL."""
        full_key = f"working:{user_id}:{key}"
        await self.client.setex(
            full_key, 
            ttl_seconds, 
            json.dumps(value)
        )
    
    async def get_working_memory(self, user_id: str, key: str) -> Optional[Any]:
        """Retrieve data from working memory."""
        full_key = f"working:{user_id}:{key}"
        data = await self.client.get(full_key)
        return json.loads(data) if data else None
    
    async def delete_working_memory(self, user_id: str, key: str) -> None:
        """Delete data from working memory."""
        full_key = f"working:{user_id}:{key}"
        await self.client.delete(full_key)
    
    # Conversation History (last 20 messages)
    
    async def add_message(self, user_id: str, message: dict) -> None:
        """Add message to conversation history."""
        key = f"messages:{user_id}"
        await self.client.lpush(key, json.dumps(message))
        await self.client.ltrim(key, 0, 19)  # Keep only last 20
        await self.client.expire(key, 86400)  # 24h TTL
    
    async def get_messages(self, user_id: str, limit: int = 20) -> list[dict]:
        """Get recent messages from conversation history."""
        key = f"messages:{user_id}"
        messages = await self.client.lrange(key, 0, limit - 1)
        return [json.loads(m) for m in messages]
    
    async def clear_messages(self, user_id: str) -> None:
        """Clear conversation history."""
        key = f"messages:{user_id}"
        await self.client.delete(key)
    
    # Current State Cache
    
    async def set_user_state(self, user_id: str, state: dict) -> None:
        """Cache current user state."""
        key = f"state:{user_id}"
        await self.client.setex(key, 300, json.dumps(state))  # 5 min TTL
    
    async def get_user_state(self, user_id: str) -> Optional[dict]:
        """Get cached user state."""
        key = f"state:{user_id}"
        data = await self.client.get(key)
        return json.loads(data) if data else None


# Singleton instance
redis_client = RedisClient()


async def get_redis() -> RedisClient:
    """Dependency for getting Redis client."""
    await redis_client.connect()
    return redis_client
