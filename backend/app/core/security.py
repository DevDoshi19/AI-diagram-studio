from datetime import datetime, timedelta,timezone
from jose import jwt,JWTError
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain:str,hashed:str) -> bool :
    return pwd_context.verify(plain,hashed)

def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    payload = {
        "sub": user_id,
        "exp": expire
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")

def decode_access_token(token:str) -> str|None :
    try:
        payload =jwt.decode(token,settings.secret_key,algorithms=["HS256"])
        return payload.get("sub")
    except JWTError:
        return None