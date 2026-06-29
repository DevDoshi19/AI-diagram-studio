import json

from fastapi.responses import StreamingResponse
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependecies import get_current_user
from app.database.database import get_db
from app.models.diagram import Diagram
from app.models.user import User
from app.schemas.diagram import DiagramGenerateRequest, DiagramGenerateResponse
from app.service.diagram import save_diagram
from app.service.llm import generate_excalidraw, get_model , stream_excalidraw
from app.service.cache import get_cached_diagram, set_cached_diagram
from app.service.github import push_diagram_to_github

router = APIRouter()


@router.get("/", response_model=list[DiagramGenerateResponse])
async def list_diagrams(db: AsyncSession = Depends(get_db),current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Diagram).where(Diagram.user_id == current_user.id
                              ).order_by(Diagram.created_at.desc()).limit(20)
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
        # save to DB but skip openai call 
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
    # if cache miss -> call openai to genrate a new diagram 
    try:
        data, model, tokens = await generate_excalidraw(request.prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error :{str(e)}")

    # save diagram to cache
    await set_cached_diagram(request.prompt,data)

    diagram = await save_diagram(
        db=db,
        title=request.prompt[:50],  
        prompt=request.prompt,
        excalidraw_data=data,
        llm_model=model,
        tokens_used=tokens,
        user_id=current_user.id
    )

    github_url = await push_diagram_to_github(
            diagram_id=str(diagram.id),
            prompt=request.prompt,
            excalidraw_data=data,
            user_email=current_user.email
        )
    
    if github_url :
        print(f"Pushed to Github : {github_url}")

    return diagram

@router.get("/stream")
async def stream_diagram(
    prompt: str,
    token: str,                          
    db: AsyncSession = Depends(get_db),
):

    from app.core.security import decode_access_token
    from sqlalchemy import select

    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    current_user = result.scalar_one_or_none()
    if not current_user:
        raise HTTPException(status_code=401, detail="User not found")

    async def event_generator():
        full_response = ""

        async for chunk in stream_excalidraw(prompt):
            if chunk == "[DONE]":
                # parse full response and save to DB
                try:
                    raw = full_response.strip()
                    if raw.startswith("```"):
                        raw = raw.split("```")[1]
                        if raw.startswith("json"):
                            raw = raw[4:]
                        raw = raw.strip()

                    data = json.loads(raw)

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

                    # send final event with saved diagram id
                    yield f"data: {json.dumps({'type': 'done', 'diagram_id': str(diagram.id)})}\n\n"

                except Exception as e:
                    yield f"data: {json.dumps({'type': 'error', 'detail': str(e)})}\n\n"
            else:
                full_response += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
        github_url = await push_diagram_to_github(
            diagram_id=str(diagram.id),
            prompt=prompt,
            excalidraw_data=data,
            user_email=current_user.email
        )
        if github_url:
            print(f"Pushed to GitHub: {github_url}")
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"       # important for nginx later
        }
    )