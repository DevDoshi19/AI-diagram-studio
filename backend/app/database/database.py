from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=False)

# this will create a local session 
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

class Base(DeclarativeBase):
    pass

# this we go in lifespane function in main file , yield will allow a seesion on start of our app
async def get_db():
    async with AsyncSessionLocal() as session :
        try :
            yield session
            await session.commit()
        except Exception :
            await session.rollback()
            raise 