from contextlib import asynccontextmanager

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.limiter import limiter


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from scalar_fastapi import get_scalar_api_reference
from rich import panel, print

from app.core.config import settings
from app.database.database import engine, Base 
from app.database.redis import get_redis, close_redis
from app.models import diagram ,user # noqa: F401
from app.api.routers import auth,diagrams,health

@asynccontextmanager
async def lifespan_handler(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    redis = await get_redis()
    await redis.ping()  # verify connection

    print(panel.Panel(
        f"[green]DB connected | Redis connected | Provider: {settings.llm_provider} | Model: {settings.openai_model}[/green]",
        border_style="green",
        title="Starting up AI Diagram Studio"
    ))
    yield

    await close_redis()
    print(panel.Panel("Goodbye!", border_style="red", title="Shutting down"))


app = FastAPI(
    title=settings.app_name,              
    summary="Convert plain text to Excalidraw diagrams using AI",
    lifespan=lifespan_handler
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(diagrams.router, prefix="/api/v1/diagrams", tags=["Diagrams"])
app.include_router(auth.router , prefix="/api/v1/auth",tags=["Auth"])
app.include_router(health.router, prefix="/api/v1/health", tags=["Health"])

@app.get("/", response_model=None)
async def root():
    return {
        "message": f"{settings.app_name} is running",
        "environment": settings.environment,
        "provider": settings.llm_provider,
    }


@app.get("/scalar", include_in_schema=False)
async def scalar_html():
    return get_scalar_api_reference(
        openapi_url=app.openapi_url,
        scalar_proxy_url="https://proxy.scalar.com",
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)