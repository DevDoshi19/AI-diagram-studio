import hashlib
import json
from app.core.config import settings
from app.database.redis import get_redis

def make_cache_key(prompt:str)->str:
    hashed = hashlib.md5(prompt.strip().lower().encode()).hexdigest()
    return f"diagram prompt:{hashed}"

async def get_cached_diagram(prompt:str)->dict|None:
    redis = await get_redis()
    cache_key = make_cache_key(prompt)
    cached_data = await redis.get(cache_key)
    if cached_data:
        return json.loads(cached_data)
    return None

async def set_cached_diagram(prompt:str, diagram_data:dict)->None:
    redis = await get_redis()
    cache_key = make_cache_key(prompt)
    await redis.set(cache_key, json.dumps(diagram_data), ex=settings.cache_ttl)