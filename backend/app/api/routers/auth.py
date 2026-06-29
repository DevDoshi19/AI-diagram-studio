from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.database import get_db
from app.schemas.user import UserRegister ,UserOut,TokenOut,UserLogin
from app.service.auth import register_user, login_user 

router = APIRouter()

@router.post("/register", response_model=TokenOut)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    user,token = await register_user(
        db=db,
        email=payload.email,
        name=payload.name,
        password=payload.password
    )
    return TokenOut(
        access_token=token,
        user=UserOut.model_validate(user)
    )

@router.post("/login",response_model=TokenOut)
async def login(payload: UserLogin,db:AsyncSession=Depends(get_db)):
    user,token = await login_user(
        db=db,
        email=payload.email,
        password=payload.password
    )

    return TokenOut(
        access_token=token,
        user=UserOut.model_validate(user)
    )

