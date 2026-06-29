from pydantic import BaseModel,Field
from typing import Any
import uuid
from datetime import datetime

class DiagramGenerateRequest(BaseModel):
    prompt:str=Field(description="Write an prompt about what you want to genrate",min_length=10,max_length=2000)

class DiagramGenerateResponse(BaseModel):
    id: uuid.UUID
    title: str
    prompt: str
    excalidraw_data: dict[str, Any]
    tokens_used: int | None
    created_at: datetime
    user_id: uuid.UUID
    model_config = {"from_attributes": True}