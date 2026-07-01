from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import settings
from app.database.database import engine
from app.database.redis import get_redis

router = APIRouter()


@router.get("")
async def health_check():
    """
    Checks all three layers — app, database, and Redis.
    Returns 200 if everything is healthy, 503 if any layer is down.
    Used by Docker health checks and AWS load balancers.
    """
    result = {
        "status": "healthy",
        "version": "1.0.0",
        "environment": settings.environment,
        "services": {
            "database": "ok",
            "redis": "ok",
        }
    }
    errors = []

    # -- Check PostgreSQL --
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as e:
        result["services"]["database"] = "error"
        errors.append(f"Database: {str(e)}")

    # -- Check Redis --
    try:
        redis = await get_redis()
        await redis.ping()
    except Exception as e:
        result["services"]["redis"] = "error"
        errors.append(f"Redis: {str(e)}")

    # -- Return 503 if anything is down --
    if errors:
        result["status"] = "unhealthy"
        result["errors"] = errors
        return JSONResponse(status_code=503, content=result)

    return result