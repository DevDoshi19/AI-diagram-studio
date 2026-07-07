from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

def get_user_or_ip(request: Request) -> str:
    """
    For authenticated endpoints — rate limit per user ID.
    For unauthenticated endpoints — rate limit per IP.
    Also handles the /stream endpoint which passes token as a query param.
    """
    # Check Authorization header first (generate endpoint)
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "").strip()

    # Fallback: check query param (stream endpoint uses ?token=...)
    if not token:
        token = request.query_params.get("token", "")

    if token:
        try:
            from app.core.security import decode_access_token
            user_id = decode_access_token(token)
            if user_id:
                return f"user:{user_id}"
        except Exception:
            pass

    # Unauthenticated — fall back to IP
    return get_remote_address(request)

limiter = Limiter(key_func=get_user_or_ip)