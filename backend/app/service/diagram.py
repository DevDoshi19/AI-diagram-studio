from sqlalchemy.ext.asyncio import AsyncSession
from app.models.diagram import Diagram
import uuid
async def save_diagram(
        db: AsyncSession,
    title: str,
    prompt: str,
    excalidraw_data: dict,
    llm_model: str,
    tokens_used: int | None,
    user_id: uuid.UUID
) -> Diagram:
    
    diagram = Diagram(
        title=title,
        prompt=prompt,
        excalidraw_data=excalidraw_data,
        llm_model=llm_model,
        tokens_used=tokens_used,
        user_id=user_id
    )

    db.add(diagram)
    await db.flush()
    return diagram