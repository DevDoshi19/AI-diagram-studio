import json
import uuid

from fastapi.responses import StreamingResponse
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependecies import get_current_user
from app.database.database import get_db
from app.models.diagram import Diagram
from app.models.user import User
from app.schemas.diagram import DiagramGenerateRequest, DiagramGenerateResponse, DiagramUpdateRequest
from app.service.diagram import save_diagram
from app.service.llm import stream_mermaid, get_model, generate_mermaid
from app.service.cache import get_cached_diagram, set_cached_diagram
from app.service.github import push_diagram_to_github

router = APIRouter()


@router.get("/", response_model=list[DiagramGenerateResponse])
async def list_diagrams(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Diagram)
        .where(Diagram.user_id == current_user.id)
        .order_by(Diagram.created_at.desc())
        .limit(20)
    )
    return result.scalars().all()


@router.post("/generate", response_model=DiagramGenerateResponse)
async def generate_diagram(
    request: DiagramGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check cache first
    cached = await get_cached_diagram(request.prompt)

    if cached:
        # Cache hit to save to DB only, GitHub already has this file
        diagram = await save_diagram(
            db=db,
            title=request.prompt[:50],
            prompt=request.prompt,
            excalidraw_data=cached,
            llm_model="cached",
            tokens_used=0,
            user_id=current_user.id
        )
        return diagram

    # Cache miss then call OpenAI
    try:
        mermaid_code, model, tokens = await generate_mermaid(request.prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {str(e)}")

    data = {"mermaid": mermaid_code}

    # Save to cache for future requests
    await set_cached_diagram(request.prompt, data)

    diagram = await save_diagram(
        db=db,
        title=request.prompt[:50],
        prompt=request.prompt,
        excalidraw_data=data,
        llm_model=model,
        tokens_used=tokens,
        user_id=current_user.id
    )

    # Push to GitHub — will skip automatically if prompt hash already exists
    github_url = await push_diagram_to_github(
        diagram_id=str(diagram.id),
        prompt=request.prompt,
        excalidraw_data=data,
        user_email=current_user.email
    )
    if github_url:
        print(f"Pushed to GitHub: {github_url}")

    return diagram


@router.get("/stream")
async def stream_diagram(
    prompt: str,
    token: str,
    db: AsyncSession = Depends(get_db),
):
    from app.core.security import decode_access_token

    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    current_user = result.scalar_one_or_none()
    if not current_user:
        raise HTTPException(status_code=401, detail="User not found")

    async def event_generator():

        cached = await get_cached_diagram(prompt)
        if cached:
            mermaid_code = cached.get("mermaid", "")
            diagram = await save_diagram(
                db=db,
                title=prompt[:50],
                prompt=prompt,
                excalidraw_data=cached,
                llm_model="cached",
                tokens_used=0,
                user_id=current_user.id
            )
            await db.commit()
            print(f"Stream: served from cache for prompt: {prompt[:50]}")
            yield f"data: {json.dumps({'type': 'done', 'diagram_id': str(diagram.id), 'mermaid': mermaid_code})}\n\n"
            return
    
        # Cache miss then stream from OpenAI
        full_response = ""

        async for chunk in stream_mermaid(prompt):
            if chunk == "[DONE]":
                mermaid_code = full_response.strip()
                data = {"mermaid": mermaid_code}

                # Cache it so next time we skip the LLM + GitHub entirely
                await set_cached_diagram(prompt, data)

                diagram = await save_diagram(
                    db=db,
                    title=prompt[:50],
                    prompt=prompt,
                    excalidraw_data=data,
                    llm_model=get_model(),
                    tokens_used=None,
                    user_id=current_user.id
                )
                await db.commit()

                # Push to GitHub — will skip if prompt hash already exists
                github_url = await push_diagram_to_github(
                    diagram_id=str(diagram.id),
                    prompt=prompt,
                    excalidraw_data=data,
                    user_email=current_user.email
                )
                if github_url:
                    print(f"Pushed to GitHub: {github_url}")

                yield f"data: {json.dumps({'type': 'done', 'diagram_id': str(diagram.id), 'mermaid': mermaid_code})}\n\n"

            else:
                full_response += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@router.patch("/{diagram_id}")
async def update_diagram(
    diagram_id: str,
    payload: DiagramUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Diagram).where(
            Diagram.id == uuid.UUID(diagram_id),
            Diagram.user_id == current_user.id
        )
    )
    diagram = result.scalar_one_or_none()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")

    diagram.excalidraw_data = payload.excalidraw_data
    await db.commit()
    await db.refresh(diagram)
    return diagram