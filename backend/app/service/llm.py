from openai import AsyncOpenAI
from app.core.config import settings

def get_llm_client()->AsyncOpenAI:
    return AsyncOpenAI(
        api_key=settings.openai_api_key,
    )

def get_model() -> str:
    return settings.openai_model

EXCALIDRAW_SYSTEM_PROMPT = """You are an Excalidraw diagram generator.

Return ONLY a valid JSON object. No markdown, no code fences, no explanation.

Use this exact structure:
{
  "type": "excalidraw",
  "version": 2,
  "elements": [],
  "appState": { "viewBackgroundColor": "#ffffff" }
}

Keep diagrams SMALL — max 4 to 5 boxes, simple arrows between them.
Every element must have: id (unique string), type, x, y, width, height, strokeColor, backgroundColor, fillStyle.
For arrows: type is "arrow", add startBinding and endBinding with the connected element's id."""

async def generate_excalidraw(prompt: str) -> tuple[dict, str, int]:
    client = get_llm_client()
    model = get_model()

    response = await client.chat.completions.create(
        model=model,
        temperature=0.2,
        max_tokens=2048,
        messages=[
            {"role": "system", "content": EXCALIDRAW_SYSTEM_PROMPT},
            {"role": "user", "content": f"Create a small simple diagram for: {prompt}"}
        ]
    )

    raw = response.choices[0].message.content.strip()
    tokens = response.usage.total_tokens

    # Strip markdown fences
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    import json
    data = json.loads(raw)
    return data, model, tokens

async def stream_excalidraw(prompt: str):
    """
    Yields raw text chunks as they come from OpenAI.
    Last chunk is always [DONE].
    """
    client = get_llm_client()
    model = get_model()

    stream = await client.chat.completions.create(
        model=model,
        temperature=0.2,
        max_tokens=2048,
        stream=True,                    
        messages=[
            {"role": "system", "content": EXCALIDRAW_SYSTEM_PROMPT},
            {"role": "user", "content": f"Create a small simple diagram for: {prompt}"}
        ]
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta

    yield "[DONE]"